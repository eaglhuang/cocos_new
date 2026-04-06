#!/usr/bin/env node

const cp = require('child_process');
const path = require('path');

const ROOT = process.cwd();
const scriptPath = path.resolve(ROOT, 'tools_node', 'run-guarded-workflow.js');
const args = ['--mode', 'ui', ...process.argv.slice(2)];

const result = cp.spawnSync(process.execPath, [scriptPath, ...args], {
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
