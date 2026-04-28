#!/usr/bin/env node

const cp = require('child_process');
const path = require('path');

const ROOT = process.cwd();
const guardedWorkflowPath = path.resolve(ROOT, 'tools_node', 'run-guarded-workflow.js');

const BUILTIN_WORKFLOWS = new Map([
  ['html-to-ucuf', () => [process.execPath, path.resolve(ROOT, 'tools_node', 'run-html-to-ucuf-workflow.js')]],
  ['html-to-ucuf-recurring', () => [process.execPath, path.resolve(ROOT, 'tools_node', 'run-html-to-ucuf-workflow.js')]],
]);

function parseArgs(argv) {
  const guardArgs = [];
  const workflowArgs = [];
  const explicitCommand = [];
  let workflowId = '';
  let inCommand = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') {
      inCommand = true;
      continue;
    }
    if (inCommand) {
      explicitCommand.push(token);
      continue;
    }

    if (token === '--workflow') {
      workflowId = argv[index + 1] || '';
      guardArgs.push(token, workflowId);
      index += 1;
      continue;
    }

    if (token === '--task' || token === '--goal' || token === '--top') {
      const value = argv[index + 1] || '';
      guardArgs.push(token, value);
      index += 1;
      continue;
    }

    if (token === '--changed' || token === '--allow-warn' || token === '--allow-hard-stop' || token === '--summary-only') {
      guardArgs.push(token);
      continue;
    }

    if (token === '--files' || token === '--dirs' || token === '--diff-files' || token === '--summary-files') {
      guardArgs.push(token);
      index += 1;
      while (index < argv.length && !argv[index].startsWith('--')) {
        guardArgs.push(argv[index]);
        index += 1;
      }
      index -= 1;
      continue;
    }

    workflowArgs.push(token);
    const next = argv[index + 1];
    if (token.startsWith('--') && next && !next.startsWith('--')) {
      workflowArgs.push(next);
      index += 1;
    }
  }

  return { workflowId, guardArgs, workflowArgs, explicitCommand };
}

function buildInjectedCommand(workflowId, workflowArgs) {
  const factory = BUILTIN_WORKFLOWS.get(workflowId);
  if (!factory) return [];
  return [...factory(), ...workflowArgs];
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed.explicitCommand.length > 0
    ? parsed.explicitCommand
    : buildInjectedCommand(parsed.workflowId, parsed.workflowArgs);

  if (parsed.explicitCommand.length === 0 && parsed.workflowArgs.length > 0 && command.length === 0) {
    console.error(`[run-ui-workflow] unknown workflow "${parsed.workflowId || '(unset)'}"; provide --workflow html-to-ucuf or pass an explicit command after --`);
    process.exit(2);
  }

  const guardedArgs = ['--mode', 'ui', ...parsed.guardArgs];
  if (command.length > 0) {
    guardedArgs.push('--', ...command);
  }

  const result = cp.spawnSync(process.execPath, [guardedWorkflowPath, ...guardedArgs], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });

  if (typeof result.status === 'number') {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

main();
