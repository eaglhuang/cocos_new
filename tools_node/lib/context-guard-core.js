const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();

function normalizeRel(inputPath) {
  return path.relative(ROOT, path.resolve(ROOT, inputPath)).replace(/\\/g, '/');
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
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.slice(3).trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function buildFileSet({ files = [], dirs = [], changed = false }) {
  const fileSet = new Set();

  if (changed) {
    for (const file of collectChangedFiles()) {
      fileSet.add(file);
    }
  }

  for (const file of files) {
    fileSet.add(normalizeRel(file));
  }

  for (const dir of dirs) {
    for (const file of collectFilesFromDir(dir)) {
      fileSet.add(file);
    }
  }

  return [...fileSet];
}

function runNodeTool(scriptName, args = [], options = {}) {
  const scriptPath = path.resolve(ROOT, 'tools_node', scriptName);
  const result = cp.spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowNonZero) {
    const message = result.stderr || result.stdout || `${scriptName} exited with code ${result.status}`;
    throw new Error(message);
  }

  return result.stdout || '';
}

function pushArgs(target, flag, values) {
  if (!values || values.length === 0) return;
  target.push(flag, ...values);
}

function runBudgetCheck(options = {}) {
  const args = [];
  pushArgs(args, '--files', options.files);
  pushArgs(args, '--dirs', options.dirs);
  if (options.changed) args.push('--changed');
  if (options.scanDefault) args.push('--scan-default');
  if (options.top) args.push('--top', String(options.top));
  args.push('--json');
  return JSON.parse(runNodeTool('check-context-budget.js', args, { allowNonZero: true }));
}

function runTurnUsage(options = {}) {
  const args = [];
  pushArgs(args, '--files', options.files);
  if (options.changed) args.push('--changed');
  if (options.top) args.push('--top', String(options.top));
  args.push('--json');
  return JSON.parse(runNodeTool('report-turn-usage.js', args));
}

function runDiffSummary(filePath) {
  return runNodeTool('summarize-structured-diff.js', ['--git', normalizeRel(filePath)]);
}

function runContextSummary(options = {}) {
  const args = [];
  if (options.task) args.push('--task', options.task);
  if (options.goal) args.push('--goal', options.goal);
  pushArgs(args, '--files', options.files);
  if (options.changed) args.push('--changed');
  if (options.maxFiles) args.push('--max-files', String(options.maxFiles));
  return runNodeTool('generate-context-summary.js', args);
}

function buildKeepNoteLine(report) {
  const reasons = [];
  if (report.reasons.includes('visual_diff_assets_present')) {
    reasons.push('compare board / screenshot / QA image batch');
  }
  if (report.reasons.includes('large_manifest_present')) {
    reasons.push('large manifest or full keep/todo inline');
  }
  if (report.reasons.includes('too_many_images') || report.reasons.includes('image_bytes_high')) {
    reasons.push('too many image payloads');
  }
  if (report.reasons.includes('bundle_warn') || report.reasons.includes('bundle_hard_stop')) {
    reasons.push(`bundle tokens ${report.totals.estTokens}`);
  }
  const reasonText = reasons.length > 0 ? reasons.join('; ') : 'handoff payload exceeded safe budget';
  return `- ContextBudget 警報：本輪估算約 ${report.totals.estTokens} tokens；原因：${reasonText}；需改走摘要卡與節錄。`;
}

function shouldBlock(report, options = {}) {
  const blockWarn = options.blockWarn !== false;
  const blockHard = options.blockHard !== false;
  if (report.status === 'hard-stop' && blockHard) {
    return {
      blocked: true,
      code: 2,
      reason: `hard-stop (${report.reasons.join(', ')})`,
    };
  }
  if (report.status === 'warn' && blockWarn) {
    return {
      blocked: true,
      code: 1,
      reason: `warn (${report.reasons.join(', ')})`,
    };
  }
  return {
    blocked: false,
    code: 0,
    reason: '',
  };
}

function printBudgetSummary(report, label = 'guard') {
  console.log(`[${label}] budget status=${report.status} estTokens=${report.totals.estTokens} textFiles=${report.totals.textFiles} imageFiles=${report.totals.imageFiles}`);
  if (report.reasons.length > 0) {
    console.log(`[${label}] budget reasons=${report.reasons.join(', ')}`);
  }
  for (const item of report.topItems.slice(0, 5)) {
    const score = item.estTokens > 0 ? `${item.estTokens} tok` : `${item.bytes} bytes`;
    console.log(`[${label}] risk ${item.path} (${item.kind}, ${score})`);
  }
}

function printTurnUsageSummary(report, label = 'finalize') {
  console.log(`[${label}] turnUsage tier=${report.tier} estTokens=${report.totals.estTokens}`);
  if (report.highlights.length > 0) {
    console.log(`[${label}] turnUsage highlights=${report.highlights.join(' | ')}`);
  }
}

function spawnWrappedCommand(commandParts) {
  if (!commandParts || commandParts.length === 0) {
    return 0;
  }

  const result = cp.spawnSync(commandParts[0], commandParts.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });

  if (typeof result.status === 'number') {
    return result.status;
  }
  if (result.error) {
    throw result.error;
  }
  return 0;
}

module.exports = {
  ROOT,
  normalizeRel,
  buildFileSet,
  collectChangedFiles,
  runNodeTool,
  runBudgetCheck,
  runTurnUsage,
  runDiffSummary,
  runContextSummary,
  buildKeepNoteLine,
  shouldBlock,
  printBudgetSummary,
  printTurnUsageSummary,
  spawnWrappedCommand,
};
