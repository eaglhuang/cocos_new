#!/usr/bin/env node

const guard = require('./lib/context-guard-core');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_BUDGET_BASELINE = path.join(PROJECT_ROOT, '.github', 'context-budget-baseline.json');
const DEFAULT_TASK_LOCK_DIR = path.join(PROJECT_ROOT, '.task-locks');
const TEXT_EXTS = new Set(['.md', '.json', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.ps1', '.txt', '.log', '.yml', '.yaml', '.toml', '.csv']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const BUDGET_THRESHOLDS = {
  singleWarnTokens: 6000,
  bundleWarnTokens: 18000,
  bundleHardTokens: 30000,
  imageWarnCount: 3,
  imageWarnBytes: 4 * 1024 * 1024,
};

function loadTestStubs() {
  const raw = process.env.FINALIZE_AGENT_TURN_TEST_STUBS;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const args = {
    workflow: '',
    task: '',
    files: [],
    dirs: [],
    changed: false,
    staged: false,
    top: 5,
    json: false,
    skipUcuf: false,
    budgetBaseline: '',
    taskScope: false,
    taskLockDir: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--workflow') {
      args.workflow = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--task') {
      args.task = argv[i + 1] || '';
      i += 1;
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
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--skip-ucuf') {
      args.skipUcuf = true;
      continue;
    }
    if (arg === '--budget-baseline') {
      args.budgetBaseline = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--task-scope') {
      args.taskScope = true;
      continue;
    }
    if (arg === '--task-lock-dir') {
      args.taskLockDir = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--files' || arg === '--dirs') {
      const target = arg === '--files' ? args.files : args.dirs;
      i += 1;
      while (i < argv.length && !argv[i].startsWith('--')) {
        target.push(argv[i]);
        i += 1;
      }
      i -= 1;
    }
  }

  if (!args.changed && !args.staged && !args.taskScope && args.files.length === 0 && args.dirs.length === 0) {
    args.changed = true;
  }

  return args;
}

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegExp(pattern) {
  const normalized = toPosix(pattern).trim();
  const placeholder = '__DOUBLE_STAR__';
  const escaped = escapeRegExp(normalized)
    .replace(/\*\*/g, placeholder)
    .replace(/\*/g, '[^/]*')
    .replace(new RegExp(placeholder, 'g'), '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function loadBudgetBaseline(filePath) {
  if (!filePath) {
    return { active: false, path: '', patterns: [], excluded: [], included: [], error: '' };
  }

  const absPath = path.resolve(PROJECT_ROOT, filePath);
  if (!fs.existsSync(absPath)) {
    return { active: false, path: absPath, patterns: [], excluded: [], included: [], error: `baseline file not found: ${filePath}` };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    const rawPatterns = [];
    if (Array.isArray(parsed.ignore)) rawPatterns.push(...parsed.ignore);
    if (Array.isArray(parsed.exclude)) rawPatterns.push(...parsed.exclude);
    if (Array.isArray(parsed.patterns)) rawPatterns.push(...parsed.patterns);
    const patterns = rawPatterns
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    return { active: true, path: absPath, patterns, excluded: [], included: [], error: '' };
  } catch (error) {
    return {
      active: false,
      path: absPath,
      patterns: [],
      excluded: [],
      included: [],
      error: `failed to parse baseline: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function applyBudgetBaseline(filePaths, baselineInfo) {
  if (!baselineInfo.active || baselineInfo.patterns.length === 0) {
    return {
      ...baselineInfo,
      included: [...filePaths],
      excluded: [],
    };
  }

  const matchers = baselineInfo.patterns.map((pattern) => ({
    pattern,
    regex: globToRegExp(pattern),
  }));

  const included = [];
  const excluded = [];

  for (const filePath of filePaths) {
    const relPath = toPosix(filePath);
    if (matchers.some((matcher) => matcher.regex.test(relPath))) {
      excluded.push(relPath);
    } else {
      included.push(relPath);
    }
  }

  return {
    ...baselineInfo,
    included,
    excluded,
  };
}

function buildEmptyBudgetReport() {
  return {
    status: 'ok',
    reasons: [],
    totals: {
      files: 0,
      textFiles: 0,
      imageFiles: 0,
      otherFiles: 0,
      totalBytes: 0,
      estTokens: 0,
      imageBytes: 0,
    },
    topItems: [],
  };
}

function buildEmptyTurnUsage() {
  return {
    tier: '少',
    estimateOnly: true,
    totals: {
      files: 0,
      textFiles: 0,
      imageFiles: 0,
      otherFiles: 0,
      estTokens: 0,
    },
    topFiles: [],
    highlights: [],
  };
}

function loadTaskScope(args) {
  if (!args.taskScope || !args.task) {
    return { active: false, path: '', files: [], error: '' };
  }

  const lockDir = args.taskLockDir
    ? path.resolve(PROJECT_ROOT, args.taskLockDir)
    : DEFAULT_TASK_LOCK_DIR;
  const lockPath = path.join(lockDir, `${args.task}.lock.json`);
  if (!fs.existsSync(lockPath)) {
    return { active: false, path: lockPath, files: [], error: `task lock not found: ${args.task}` };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const files = Array.isArray(parsed.files)
      ? parsed.files.map((entry) => toPosix(entry)).filter(Boolean)
      : [];
    return { active: true, path: lockPath, files, error: '' };
  } catch (error) {
    return {
      active: false,
      path: lockPath,
      files: [],
      error: `failed to parse task lock: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function safeStat(absPath) {
  try {
    return fs.statSync(absPath);
  } catch {
    return null;
  }
}

function estimateTextTokensFromBuffer(buffer) {
  const text = buffer.toString('utf8');
  let ascii = 0;
  let nonAscii = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) <= 0x7f) ascii += 1;
    else nonAscii += 1;
  }
  return Math.ceil(ascii / 4 + nonAscii * 0.9);
}

function classifyBudgetFile(relPath) {
  const ext = path.extname(String(relPath || '').toLowerCase());
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (TEXT_EXTS.has(ext)) return 'text';
  return 'other';
}

function summarizeBudgetFiles(filePaths, top) {
  const items = [];

  for (const relPath of filePaths) {
    const normalized = toPosix(relPath);
    const absPath = path.resolve(PROJECT_ROOT, normalized);
    const stat = safeStat(absPath);
    if (!stat || !stat.isFile()) {
      continue;
    }

    const kind = classifyBudgetFile(normalized);
    const item = {
      path: normalized,
      bytes: stat.size,
      kind,
      estTokens: 0,
      risk: [],
      reasons: [],
    };

    if (kind === 'text') {
      const buffer = fs.readFileSync(absPath);
      item.estTokens = estimateTextTokensFromBuffer(buffer);
      if (item.estTokens >= BUDGET_THRESHOLDS.singleWarnTokens) {
        item.risk.push('single_file_large');
        item.reasons.push('single_file_large');
      }
      if (/keep\.md$/i.test(normalized)) {
        item.risk.push('always_loaded_core_doc');
        item.reasons.push('keep_doc');
      }
      if (/ui-quality-todo\.json$/i.test(normalized)) {
        item.risk.push('large_manifest');
        item.reasons.push('large_manifest');
      }
    } else if (kind === 'image') {
      item.risk.push('image_payload');
      item.reasons.push('image_payload');
      if (/compare-board|contact-sheet|screenshot|battle(scene)?\.png|GeneralDetailOverview\.png/i.test(normalized)) {
        item.risk.push('visual_diff_asset');
        item.reasons.push('visual_diff_asset');
      }
    } else {
      item.risk.push('non_text_binary');
      item.reasons.push('binary_asset');
    }

    items.push(item);
  }

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
  if (totals.estTokens >= BUDGET_THRESHOLDS.bundleHardTokens) reasons.push('bundle_hard_stop');
  else if (totals.estTokens >= BUDGET_THRESHOLDS.bundleWarnTokens) reasons.push('bundle_warn');
  if (totals.imageFiles >= BUDGET_THRESHOLDS.imageWarnCount) reasons.push('too_many_images');
  if (totals.imageBytes >= BUDGET_THRESHOLDS.imageWarnBytes) reasons.push('image_bytes_high');
  if (items.some((item) => item.risk.includes('visual_diff_asset'))) reasons.push('visual_diff_assets_present');
  if (items.some((item) => item.risk.includes('large_manifest'))) reasons.push('large_manifest_present');

  const status = reasons.includes('bundle_hard_stop')
    ? 'hard-stop'
    : reasons.length > 0
      ? 'warn'
      : 'ok';

  const rankedItems = [...items].sort((a, b) => {
    const scoreA = a.estTokens > 0 ? a.estTokens : Math.ceil(a.bytes / 1024);
    const scoreB = b.estTokens > 0 ? b.estTokens : Math.ceil(b.bytes / 1024);
    return scoreB - scoreA;
  });

  const usageTier = (
    totals.estTokens >= 20000 ||
    totals.imageFiles >= 3 ||
    items.some((item) => item.reasons.includes('visual_diff_asset'))
  )
    ? '大'
    : (
      totals.estTokens >= 8000 ||
      totals.imageFiles >= 1 ||
      items.some((item) => item.reasons.includes('single_file_large'))
    )
      ? '中'
      : '少';

  const topFiles = rankedItems.slice(0, top);
  const highlights = topFiles.map((item) => (
    item.kind === 'text' ? `${item.path} (${item.estTokens} tok)` : `${item.path} (${item.kind})`
  ));

  return {
    budget: {
      status,
      reasons,
      totals,
      topItems: rankedItems,
    },
    usage: {
      tier: usageTier,
      estimateOnly: true,
      totals: {
        files: totals.files,
        textFiles: totals.textFiles,
        imageFiles: totals.imageFiles,
        otherFiles: totals.otherFiles,
        estTokens: totals.estTokens,
      },
      topFiles,
      highlights,
    },
  };
}

/**
 * UCUF Pre-Submit Gate（M11）
 *
 * 執行項目：
 *   1. validate-ui-specs.js --strict — 靜態規則 R1~R28 全量驗證
 *   2. ucuf-conflict-detect.js       — 衝突偵測（僅在 workflow 含 'ucuf' 時執行）
 *
 * 回傳：{ passed: boolean, errors: string[], warnings: string[] }
 */
function runUcufPreSubmitGate(args) {
  const errors = [];
  const warnings = [];
  const toolsDir = __dirname;
  const projectRoot = path.resolve(toolsDir, '..');
  const isUcufWorkflow = (args.workflow || '').toLowerCase().includes('ucuf');
  const testStubs = loadTestStubs();

  function runNodeScript(scriptName, scriptArgs = []) {
    if (testStubs && Object.prototype.hasOwnProperty.call(testStubs, scriptName)) {
      const stub = testStubs[scriptName] || {};
      const status = Number.isInteger(stub.status) ? stub.status : (stub.ok === false ? 1 : 0);
      return {
        ok: status === 0,
        stdout: String(stub.stdout || ''),
        stderr: String(stub.stderr || ''),
        status,
      };
    }

    const scriptPath = path.join(toolsDir, scriptName);
    const result = spawnSync(
      process.execPath,
      [scriptPath, ...scriptArgs],
      { cwd: projectRoot, stdio: 'pipe', encoding: 'utf8', shell: false },
    );

    return {
      ok: (result.status ?? 1) === 0,
      stdout: (result.stdout || '').toString(),
      stderr: (result.stderr || '').toString(),
      status: result.status ?? 1,
    };
  }

  function pickFirstLine(output, fallback) {
    const line = String(output || '')
      .split(/\r?\n/)
      .map((v) => v.trim())
      .find(Boolean);
    return line || fallback;
  }

  // 1. validate-ui-specs --strict --check-content-contract
  const validateResult = runNodeScript('validate-ui-specs.js', ['--strict', '--check-content-contract']);
  if (!validateResult.ok) {
    errors.push(
      `[ucuf-gate] validate-ui-specs --strict --check-content-contract 失敗：${pickFirstLine(
        validateResult.stderr || validateResult.stdout,
        `exit=${validateResult.status}`,
      )}`,
    );
  }

  // 2. ucuf-runtime-check --changed（僅當 workflow 含 'ucuf'）
  if (isUcufWorkflow) {
    const runtimeResult = runNodeScript('ucuf-runtime-check.js', ['--changed', '--strict', '--json']);
    if (!runtimeResult.ok) {
      let runtimeDetail = pickFirstLine(
        runtimeResult.stderr || runtimeResult.stdout,
        `exit=${runtimeResult.status}`,
      );
      try {
        const parsed = JSON.parse(runtimeResult.stdout || '{}');
        const firstError = Array.isArray(parsed.errors) ? parsed.errors[0] : null;
        if (firstError && firstError.ruleId && firstError.message) {
          runtimeDetail = `${firstError.ruleId}: ${firstError.message}`;
        }
      } catch {
        // Keep fallback detail
      }
      errors.push(
        `[ucuf-gate] ucuf-runtime-check --changed 失敗：${runtimeDetail}`,
      );
    }
  }

  // 3. ucuf-conflict-detect（僅當 workflow 含 'ucuf'）
  if (isUcufWorkflow) {
    const conflictResult = runNodeScript('ucuf-conflict-detect.js', ['--strict']);
    if (!conflictResult.ok) {
      errors.push(
        `[ucuf-gate] ucuf-conflict-detect --strict 失敗：${pickFirstLine(
          conflictResult.stderr || conflictResult.stdout,
          `exit=${conflictResult.status}`,
        )}`,
      );
    }
  }

  // 4. check-encoding-touched（全 workflow 執行）
  const encodingArgs = [];
  if (Array.isArray(args.files) && args.files.length > 0) {
    encodingArgs.push('--files', ...args.files);
  }
  const encodingResult = runNodeScript('check-encoding-touched.js', encodingArgs);
  if (!encodingResult.ok) {
    const encodingMessage = `[ucuf-gate] check-encoding-touched 失敗：${pickFirstLine(
      encodingResult.stderr || encodingResult.stdout,
      `exit=${encodingResult.status}`,
    )}`;
    if (Array.isArray(args.files) && args.files.length > 0) {
      errors.push(encodingMessage);
    } else {
      warnings.push(`${encodingMessage}（未指定 --files，改列為警告）`);
    }
  }

  return { passed: errors.length === 0, errors, warnings };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scopedFiles = guard.buildFileSet({
    files: args.files,
    dirs: args.dirs,
    changed: args.changed,
    staged: args.staged,
  });
  const taskScope = loadTaskScope(args);
  const taskScopedFiles = Array.from(new Set([...scopedFiles, ...taskScope.files]));
  const baselinePath = args.budgetBaseline || (fs.existsSync(DEFAULT_BUDGET_BASELINE) ? DEFAULT_BUDGET_BASELINE : '');
  const baselineInfo = applyBudgetBaseline(taskScopedFiles, loadBudgetBaseline(baselinePath));
  const summary = baselineInfo.included.length > 0
    ? summarizeBudgetFiles(baselineInfo.included, args.top)
    : { budget: buildEmptyBudgetReport(), usage: buildEmptyTurnUsage() };
  const budget = summary.budget;
  const usage = summary.usage;

  // UCUF Pre-Submit Gate（M11）
  const ucufGate = args.skipUcuf
    ? { passed: true, errors: [], warnings: [], skipped: true }
    : runUcufPreSubmitGate(args);

  const result = {
    workflow: args.workflow,
    task: args.task,
    budgetStatus: budget.status,
    budgetReasons: budget.reasons,
    budgetBaseline: {
      active: baselineInfo.active,
      path: baselineInfo.path,
      patterns: baselineInfo.patterns,
      excludedCount: baselineInfo.excluded.length,
      excludedFiles: baselineInfo.excluded,
      includedCount: baselineInfo.included.length,
      error: baselineInfo.error,
    },
    taskScope: {
      active: taskScope.active,
      path: taskScope.path,
      fileCount: taskScope.files.length,
      files: taskScope.files,
      error: taskScope.error,
    },
    keepNote: budget.status === 'ok' ? '' : guard.buildKeepNoteLine(budget),
    turnUsage: usage,
    ucufGate,
    finalLine: `Token 量級：${usage.tier}（估算約 ${usage.totals.estTokens} tokens，非 API 精準值）`,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`[finalize-agent-turn] workflow=${args.workflow || '(unset)'} task=${args.task || '(unset)'}`);
  if (baselineInfo.active) {
    console.log(`[finalize-agent-turn] budget-baseline=${baselineInfo.path} excluded=${baselineInfo.excluded.length} remaining=${baselineInfo.included.length}`);
  } else if (baselineInfo.error) {
    console.warn(`[finalize-agent-turn] budget-baseline warning=${baselineInfo.error}`);
  }
  if (taskScope.active) {
    console.log(`[finalize-agent-turn] task-scope=${taskScope.path} files=${taskScope.files.length}`);
  } else if (taskScope.error) {
    console.warn(`[finalize-agent-turn] task-scope warning=${taskScope.error}`);
  }
  guard.printBudgetSummary(budget, 'finalize-agent-turn');
  guard.printTurnUsageSummary(usage, 'finalize-agent-turn');
  if (result.keepNote) {
    console.log(`[finalize-agent-turn] keep-note=${result.keepNote}`);
  }

  // Print gate result
  if (ucufGate.skipped) {
    console.log('[finalize-agent-turn] ucuf-gate: skipped (--skip-ucuf)');
  } else if (ucufGate.passed) {
    console.log('[finalize-agent-turn] ucuf-gate: PASS');
  } else {
    for (const err of ucufGate.errors) {
      console.error(`[finalize-agent-turn] ${err}`);
    }
    console.warn(`[finalize-agent-turn] ucuf-gate: FAIL (${ucufGate.errors.length} 個錯誤)`);
  }

  console.log(result.finalLine);
}

main();

