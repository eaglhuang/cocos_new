#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
});

if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
}

console.log('[hooks] core.hooksPath set to .githooks');
