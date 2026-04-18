#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();

const TEXT_EXTS = new Set([
  '.md',
  '.json',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ps1',
  '.txt',
  '.log',
  '.yml',
  '.yaml',
  '.toml',
  '.csv',
]);

const IMAGE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
]);

const DEFAULT_SCAN_DIRS = [
  'docs',
  '.agents/workflows',
  '.github/skills',
  'artifacts',
];

const THRESHOLDS = {
  singleWarnTokens: 6000,
  bundleWarnTokens: 18000,
  bundleHardTokens: 30000,
  imageWarnCount: 3,
  imageWarnBytes: 4 * 1024 * 1024,
};

function parseArgs(argv) {
  const args = {
    files: [],
    dirs: [],
    changed: false,
    staged: false,
    scanDefault: false,
    top: 20,
    emitKeepNote: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--files') {
      i += 1;
      while (i < argv.length && !argv[i].startsWith('--')) {
        args.files.push(argv[i]);
        i += 1;
      }
      i -= 1;
      continue;
    }
    if (arg === '--dirs') {
      i += 1;
      while (i < argv.length && !argv[i].startsWith('--')) {
        args.dirs.push(argv[i]);
        i += 1;
      }
      i -= 1;
      continue;
    }
    if (arg === '--top') {
      args.top = Number(argv[i + 1] || args.top);
      i += 1;
      continue;
    }
    if (arg === '--changed') {
      args.changed = true;
      continue;
    }
    if (arg === '--staged') {
      args.staged = true;
      continue;
    }
    if (arg === '--scan-default') {
      args.scanDefault = true;
      continue;
    }
    if (arg === '--emit-keep-note') {
      args.emitKeepNote = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
    }
  }

  if (!args.changed && !args.staged && !args.scanDefault && args.files.length === 0 && args.dirs.length === 0) {
    args.scanDefault = true;
  }

  return args;
}

function normalizeRel(inputPath) {
  return path.relative(ROOT, path.resolve(ROOT, inputPath)).replace(/\\/g, '/');
}

function safeStat(absPath) {
  try {
    return fs.statSync(absPath);
  } catch {
    return null;
  }
}

function collectFilesFromDir(relDir) {
  const absDir = path.resolve(ROOT, relDir);
  const out = [];
  const stack = [absDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'library' || entry.name === 'temp') {
        continue;
      }
      const absEntry = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absEntry);
      } else if (entry.isFile()) {
        out.push(path.relative(ROOT, absEntry).replace(/\\/g, '/'));
      }
    }
  }
  return out;
}

function collectChangedFiles() {
  try {
    const output = cp.execSync('git status --short', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.replace(/\r/g, ''))
      .filter(Boolean)
      .map((line) => {
        const body = line.length > 3 ? line.slice(3).trim() : '';
        const renamed = body.includes(' -> ') ? body.split(' -> ').pop() : body;
        return String(renamed || '').replace(/\\/g, '/');
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function collectStagedFiles() {
  try {
    const output = cp.execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.replace(/\r/g, '').trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function estimateTextTokens(buffer) {
  const text = buffer.toString('utf8');
  let ascii = 0;
  let nonAscii = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) <= 0x7f) {
      ascii += 1;
    } else {
      nonAscii += 1;
    }
  }
  return Math.ceil(ascii / 4 + nonAscii * 0.9);
}

function classify(relPath) {
  const lower = relPath.toLowerCase();
  const ext = path.extname(lower);
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (TEXT_EXTS.has(ext)) return 'text';
  return 'other';
}

function analyzeFile(relPath) {
  const absPath = path.resolve(ROOT, relPath);
  const stat = safeStat(absPath);
  if (!stat || !stat.isFile()) {
    return null;
  }
  const kind = classify(relPath);
  const item = {
    path: relPath.replace(/\\/g, '/'),
    bytes: stat.size,
    kind,
    estTokens: 0,
    risk: [],
  };

  if (kind === 'text') {
    const buffer = fs.readFileSync(absPath);
    item.estTokens = estimateTextTokens(buffer);
    if (item.estTokens >= THRESHOLDS.singleWarnTokens) {
      item.risk.push('single_file_large');
    }
    if (/keep\.md$/i.test(relPath)) {
      item.risk.push('always_loaded_core_doc');
    }
    if (/ui-quality-todo\.json$/i.test(relPath)) {
      item.risk.push('large_manifest');
    }
  } else if (kind === 'image') {
    item.risk.push('image_payload');
    if (/compare-board|contact-sheet|screenshot|battle(scene)?\.png|GeneralDetailOverview\.png/i.test(relPath)) {
      item.risk.push('visual_diff_asset');
    }
  } else {
    item.risk.push('non_text_binary');
  }

  return item;
}

function buildReport(items) {
  const totals = {
    files: items.length,
    textFiles: items.filter((item) => item.kind === 'text').length,
    imageFiles: items.filter((item) => item.kind === 'image').length,
    otherFiles: items.filter((item) => item.kind === 'other').length,
    totalBytes: items.reduce((sum, item) => sum + item.bytes, 0),
    estTokens: items.reduce((sum, item) => sum + item.estTokens, 0),
    imageBytes: items.filter((item) => item.kind === 'image').reduce((sum, item) => sum + item.bytes, 0),
  };

  const reasons = [];
  if (totals.estTokens >= THRESHOLDS.bundleHardTokens) {
    reasons.push('bundle_hard_stop');
  } else if (totals.estTokens >= THRESHOLDS.bundleWarnTokens) {
    reasons.push('bundle_warn');
  }
  if (totals.imageFiles >= THRESHOLDS.imageWarnCount) {
    reasons.push('too_many_images');
  }
  if (totals.imageBytes >= THRESHOLDS.imageWarnBytes) {
    reasons.push('image_bytes_high');
  }
  if (items.some((item) => item.risk.includes('visual_diff_asset'))) {
    reasons.push('visual_diff_assets_present');
  }
  if (items.some((item) => item.risk.includes('large_manifest'))) {
    reasons.push('large_manifest_present');
  }

  const status = reasons.includes('bundle_hard_stop')
    ? 'hard-stop'
    : reasons.length > 0
      ? 'warn'
      : 'ok';

  const topItems = [...items]
    .sort((a, b) => {
      const scoreA = a.estTokens > 0 ? a.estTokens : Math.ceil(a.bytes / 1024);
      const scoreB = b.estTokens > 0 ? b.estTokens : Math.ceil(b.bytes / 1024);
      return scoreB - scoreA;
    });

  return { status, reasons, totals, topItems };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildKeepNote(report) {
  const reasons = [];
  if (report.reasons.includes('visual_diff_assets_present')) {
    reasons.push('compare board / screenshot / QA 圖片被納入上下文');
  }
  if (report.reasons.includes('large_manifest_present')) {
    reasons.push('大型 manifest 或 keep/todo 類文件被整份讀入');
  }
  if (report.reasons.includes('too_many_images') || report.reasons.includes('image_bytes_high')) {
    reasons.push('一次帶入過多圖片資產');
  }
  if (report.reasons.includes('bundle_warn') || report.reasons.includes('bundle_hard_stop')) {
    reasons.push(`總估算上下文約 ${report.totals.estTokens} tokens`);
  }

  const joined = reasons.length > 0 ? reasons.join('；') : '需要檢查 handoff 與檔案讀取策略';
  return `- ContextBudget 警告：本回合估算上下文 ${report.totals.estTokens} tokens，疑似原因：${joined}。先改用摘要卡、路徑索引與單圖抽樣，再繼續 handoff。`;
}

function printHuman(report, top) {
  console.log(`[context-budget] status=${report.status}`);
  console.log(`[context-budget] estTokens=${report.totals.estTokens} textFiles=${report.totals.textFiles} imageFiles=${report.totals.imageFiles} totalBytes=${formatBytes(report.totals.totalBytes)}`);
  if (report.reasons.length > 0) {
    console.log(`[context-budget] reasons=${report.reasons.join(', ')}`);
  }
  console.log('[context-budget] top-risk-files:');
  for (const item of report.topItems.slice(0, top)) {
    const score = item.estTokens > 0 ? `${item.estTokens} tok` : formatBytes(item.bytes);
    const risk = item.risk.length > 0 ? ` risk=${item.risk.join('|')}` : '';
    console.log(`  - ${item.path} (${item.kind}, ${score}${risk})`);
  }
  console.log('[context-budget] suggestions:');
  console.log('  - 不要把 PNG / compare board / binary diff 直接塞進 handoff；只傳路徑與 3~6 行摘要。');
  console.log('  - 大型 docs/json 先做 shard 或摘要卡；單檔超過 6000 tokens 時只允許節錄。');
  console.log('  - 真要看圖時，一次只帶 1 張主圖 + 1 張對照圖，其餘只保留索引。');
  console.log('  - handoff 前先跑 `node tools_node/check-context-budget.js --changed --emit-keep-note`。');
  if (report.status !== 'ok') {
    console.log('[context-budget] keep-note:');
    console.log(`  ${buildKeepNote(report)}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const relFiles = new Set();

  for (const file of args.files) {
    relFiles.add(normalizeRel(file));
  }
  for (const dir of args.dirs) {
    for (const file of collectFilesFromDir(dir)) {
      relFiles.add(file);
    }
  }
  if (args.scanDefault) {
    for (const dir of DEFAULT_SCAN_DIRS) {
      for (const file of collectFilesFromDir(dir)) {
        relFiles.add(file);
      }
    }
  }
  if (args.changed) {
    for (const file of collectChangedFiles()) {
      relFiles.add(file);
    }
  }
  if (args.staged) {
    for (const file of collectStagedFiles()) {
      relFiles.add(file);
    }
  }

  const items = [...relFiles]
    .map((relPath) => analyzeFile(relPath))
    .filter(Boolean);

  const report = buildReport(items);

  if (args.json) {
    const payload = {
      ...report,
      keepNote: args.emitKeepNote ? buildKeepNote(report) : null,
    };
    console.log(JSON.stringify(payload, null, 2));
    process.exit(report.status === 'hard-stop' ? 2 : report.status === 'warn' ? 1 : 0);
  }

  printHuman(report, args.top);
  if (args.emitKeepNote && report.status !== 'ok') {
    console.log(`[context-budget] keep-note-inline=${buildKeepNote(report)}`);
  }
  process.exit(report.status === 'hard-stop' ? 2 : report.status === 'warn' ? 1 : 0);
}

main();
