#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || index + 1 >= process.argv.length) {
    return fallback;
  }
  return process.argv[index + 1];
}

function buildRunId() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

const projectRoot = path.resolve(__dirname, '..');
const captureScriptPath = path.join(__dirname, 'capture-ui-screens.js');
const browserPath = parseArg('browser', '');
const timeout = parseArg('timeout', '70000');
const retries = parseArg('retries', '1');
const refreshBefore = parseArg('refreshBefore', 'true');
const maxWidth = parseArg('maxWidth', '125');
const outDir = parseArg(
  'outDir',
  path.join('artifacts', 'ui-qa', `gacha-lobby-flow-smoke-${buildRunId()}`),
);

const gachaScreenDir = path.join(projectRoot, 'artifacts', 'ui-source', 'gacha-main');
fs.mkdirSync(gachaScreenDir, { recursive: true });

const args = [
  captureScriptPath,
  '--target', 'GachaFromLobby',
  '--outDir', outDir,
  '--timeout', timeout,
  '--retries', retries,
  '--refreshBefore', refreshBefore,
  '--maxWidth', maxWidth,
];

if (browserPath) {
  args.push('--browser', browserPath);
}

console.log('[check-gacha-lobby-flow-smoke] 驗證路徑：LobbyScene -> onClickGachaMain() -> UIID.GachaMain');
console.log(`[check-gacha-lobby-flow-smoke] output: ${outDir}`);

const result = spawnSync(process.execPath, args, {
  cwd: projectRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error('[check-gacha-lobby-flow-smoke] failed to spawn capture-ui-screens:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);