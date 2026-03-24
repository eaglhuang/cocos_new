#!/usr/bin/env node
/**
 * run-tests.js — Node.js CLI 測試 Runner
 *
 * 執行方式（在專案根目錄）:
 *   node tools/run-tests.js
 *
 * 或在 package.json 加入 scripts（選配）:
 *   "test": "node tools/run-tests.js"
 *   然後執行: npm test
 *
 * 原理：
 *   1. 使用 ts-node 直接執行 TypeScript（若已安裝）
 *   2. 若無 ts-node，會提示安裝指令
 *
 * 注意：此腳本不依賴 Cocos Creator 引擎 API。
 *       測試案例中有 import from 'cc' 的模組不在純 Node.js 下執行；
 *       純邏輯類（FormulaSystem, BuffSystem, DeprecatedApiScanner）可正常跑。
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const entryFile   = path.join(projectRoot, 'assets/scripts/tools/tests/run-cli.ts');

// 確認是否有 ts-node
function hasTsNode() {
    try {
        execSync('npx ts-node --version', { stdio: 'ignore', cwd: projectRoot });
        return true;
    } catch (_) { return false; }
}

if (!hasTsNode()) {
    console.error('❌  需要 ts-node 才能執行測試');
    console.error('   請執行：npm install --save-dev ts-node typescript');
    process.exit(1);
}

console.log('🚀  執行 UnitTest...\n');

const result = spawnSync(
    'npx', ['ts-node',
        '--transpile-only',          // 跳過型別檢查（cc mock 型別不完整），只做轉譯
        '-r', 'tsconfig-paths/register',
        '--project', path.join(projectRoot, 'tsconfig.test.json'),
        entryFile],
    { stdio: 'inherit', cwd: projectRoot, shell: true }
);

process.exit(result.status ?? 0);
