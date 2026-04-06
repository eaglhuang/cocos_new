#!/usr/bin/env node

const guard = require('./lib/context-guard-core');

function parseArgs(argv) {
  const args = {
    workflow: '',
    task: '',
    files: [],
    dirs: [],
    changed: false,
    top: 5,
    json: false,
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
    if (arg === '--json') {
      args.json = true;
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

  if (!args.changed && args.files.length === 0 && args.dirs.length === 0) {
    args.changed = true;
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const budget = guard.runBudgetCheck({
    files: args.files,
    dirs: args.dirs,
    changed: args.changed,
    top: args.top,
  });
  const usage = guard.runTurnUsage({
    files: args.files,
    changed: args.changed,
    top: args.top,
  });

  const result = {
    workflow: args.workflow,
    task: args.task,
    budgetStatus: budget.status,
    budgetReasons: budget.reasons,
    keepNote: budget.status === 'ok' ? '' : guard.buildKeepNoteLine(budget),
    turnUsage: usage,
    finalLine: `Token 量級：${usage.tier}（估算約 ${usage.totals.estTokens} tokens，非 API 精準值）`,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`[finalize-agent-turn] workflow=${args.workflow || '(unset)'} task=${args.task || '(unset)'}`);
  guard.printBudgetSummary(budget, 'finalize-agent-turn');
  guard.printTurnUsageSummary(usage, 'finalize-agent-turn');
  if (result.keepNote) {
    console.log(`[finalize-agent-turn] keep-note=${result.keepNote}`);
  }
  console.log(result.finalLine);
}

main();
