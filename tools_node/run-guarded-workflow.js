#!/usr/bin/env node

const guard = require('./lib/context-guard-core');

function parseArgs(argv) {
  const args = {
    workflow: '',
    mode: 'generic',
    task: '',
    goal: '',
    files: [],
    dirs: [],
    diffFiles: [],
    summaryFiles: [],
    changed: false,
    top: 5,
    allowWarn: false,
    allowHardStop: false,
    summaryOnly: false,
    command: [],
  };

  let inCommand = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      inCommand = true;
      continue;
    }
    if (inCommand) {
      args.command.push(arg);
      continue;
    }
    if (arg === '--workflow') {
      args.workflow = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--mode') {
      args.mode = argv[i + 1] || args.mode;
      i += 1;
      continue;
    }
    if (arg === '--task') {
      args.task = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--goal') {
      args.goal = argv[i + 1] || '';
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
    if (arg === '--allow-warn') {
      args.allowWarn = true;
      continue;
    }
    if (arg === '--allow-hard-stop') {
      args.allowHardStop = true;
      continue;
    }
    if (arg === '--summary-only') {
      args.summaryOnly = true;
      continue;
    }
    if (arg === '--files' || arg === '--dirs' || arg === '--diff-files' || arg === '--summary-files') {
      const target =
        arg === '--files' ? args.files :
          arg === '--dirs' ? args.dirs :
            arg === '--diff-files' ? args.diffFiles :
              args.summaryFiles;
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
  if (args.summaryFiles.length === 0) {
    args.summaryFiles = [...args.files];
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = args.mode === 'ui' ? 'run-ui-workflow' : 'run-guarded-workflow';

  console.log(`[${label}] workflow=${args.workflow || '(unset)'} mode=${args.mode}`);
  console.log(`[${label}] preflight=context-budget-guard`);

  const budget = guard.runBudgetCheck({
    files: args.files,
    dirs: args.dirs,
    changed: args.changed,
    top: args.top,
  });
  guard.printBudgetSummary(budget, label);

  if (args.summaryFiles.length > 0 && (args.task || args.goal)) {
    console.log(`[${label}] summary-card:`);
    process.stdout.write(guard.runContextSummary({
      task: args.task,
      goal: args.goal,
      files: args.summaryFiles,
    }));
  }

  for (const file of args.diffFiles) {
    console.log(`[${label}] diff-summary ${guard.normalizeRel(file)}:`);
    process.stdout.write(guard.runDiffSummary(file));
  }

  const block = guard.shouldBlock(budget, {
    blockWarn: !args.allowWarn,
    blockHard: !args.allowHardStop,
  });

  if (block.blocked) {
    console.error(`[${label}] blocked=${block.reason}`);
    console.error(`[${label}] keep-note=${guard.buildKeepNoteLine(budget)}`);
    process.exit(block.code);
  }

  if (args.summaryOnly || args.command.length === 0) {
    console.log(`[${label}] preflight passed`);
    return;
  }

  console.log(`[${label}] executing=${args.command.join(' ')}`);
  const status = guard.spawnWrappedCommand(args.command);
  process.exit(status);
}

main();
