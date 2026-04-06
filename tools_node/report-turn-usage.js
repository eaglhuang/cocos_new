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

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

function parseArgs(argv) {
  const args = {
    files: [],
    changed: false,
    json: false,
    emitFinalLine: false,
    top: 3,
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
    if (arg === '--changed') {
      args.changed = true;
      continue;
    }
    if (arg === '--top') {
      args.top = Number(argv[i + 1] || args.top);
      i += 1;
      continue;
    }
    if (arg === '--emit-final-line') {
      args.emitFinalLine = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
    }
  }

  if (!args.changed && args.files.length === 0) {
    args.changed = true;
  }

  return args;
}

function normalizeRel(filePath) {
  return path.relative(ROOT, path.resolve(ROOT, filePath)).replace(/\\/g, '/');
}

function changedFiles() {
  try {
    const output = cp.execSync('git status --short', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.slice(3).trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function classify(filePath) {
  const ext = path.extname(filePath.toLowerCase());
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (TEXT_EXTS.has(ext)) return 'text';
  return 'other';
}

function safeStat(filePath) {
  try {
    return fs.statSync(path.resolve(ROOT, filePath));
  } catch {
    return null;
  }
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(path.resolve(ROOT, filePath), 'utf8');
  } catch {
    return '';
  }
}

function estimateTokens(text) {
  let ascii = 0;
  let nonAscii = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) <= 0x7f) ascii += 1;
    else nonAscii += 1;
  }
  return Math.ceil(ascii / 4 + nonAscii * 0.9);
}

function summarizeFile(filePath) {
  const stat = safeStat(filePath);
  if (!stat || !stat.isFile()) return null;

  const kind = classify(filePath);
  const item = {
    path: filePath,
    kind,
    bytes: stat.size,
    estTokens: 0,
    reasons: [],
  };

  if (kind === 'text') {
    item.estTokens = estimateTokens(safeRead(filePath));
    if (item.estTokens >= 6000) item.reasons.push('single_file_large');
    if (/keep\.md$/i.test(filePath)) item.reasons.push('keep_doc');
    if (/ui-quality-todo\.json$/i.test(filePath)) item.reasons.push('large_manifest');
  } else if (kind === 'image') {
    item.reasons.push('image_payload');
    if (/compare-board|contact-sheet|screenshot/i.test(filePath)) {
      item.reasons.push('visual_diff_asset');
    }
  } else {
    item.reasons.push('binary_asset');
  }

  return item;
}

function buildReport(items, top) {
  const totals = {
    files: items.length,
    textFiles: items.filter((item) => item.kind === 'text').length,
    imageFiles: items.filter((item) => item.kind === 'image').length,
    otherFiles: items.filter((item) => item.kind === 'other').length,
    estTokens: items.reduce((sum, item) => sum + item.estTokens, 0),
  };

  let tier = '少';
  if (
    totals.estTokens >= 20000 ||
    totals.imageFiles >= 3 ||
    items.some((item) => item.reasons.includes('visual_diff_asset'))
  ) {
    tier = '大';
  } else if (
    totals.estTokens >= 8000 ||
    totals.imageFiles >= 1 ||
    items.some((item) => item.reasons.includes('single_file_large'))
  ) {
    tier = '中';
  }

  const topFiles = [...items]
    .sort((a, b) => {
      const scoreA = a.estTokens > 0 ? a.estTokens : Math.ceil(a.bytes / 1024);
      const scoreB = b.estTokens > 0 ? b.estTokens : Math.ceil(b.bytes / 1024);
      return scoreB - scoreA;
    })
    .slice(0, top);

  const highlights = [];
  for (const item of topFiles) {
    if (item.kind === 'text') highlights.push(`${item.path} (${item.estTokens} tok)`);
    else highlights.push(`${item.path} (${item.kind})`);
  }

  return {
    tier,
    estimateOnly: true,
    totals,
    topFiles,
    highlights,
  };
}

function buildFinalLine(report) {
  const highlights = report.highlights.length > 0
    ? `；主因：${report.highlights.join('、')}`
    : '';
  return `Token 量級：${report.tier}（估算約 ${report.totals.estTokens} tokens，非 API 精準值${highlights}）`;
}

function printHuman(report) {
  console.log(`[turn-usage] tier=${report.tier} estTokens=${report.totals.estTokens} files=${report.totals.files} textFiles=${report.totals.textFiles} imageFiles=${report.totals.imageFiles}`);
  console.log('[turn-usage] note=estimate only; not exact API billing');
  if (report.highlights.length > 0) {
    console.log(`[turn-usage] highlights=${report.highlights.join(' | ')}`);
  }
  console.log(`[turn-usage] final-line=${buildFinalLine(report)}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileSet = new Set();

  if (args.changed) {
    for (const file of changedFiles()) fileSet.add(file);
  }
  for (const file of args.files) {
    fileSet.add(normalizeRel(file));
  }

  const items = [...fileSet]
    .map((file) => summarizeFile(file))
    .filter(Boolean);

  const report = buildReport(items, args.top);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (args.emitFinalLine) {
    console.log(buildFinalLine(report));
    return;
  }
  printHuman(report);
}

main();
