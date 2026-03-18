#!/usr/bin/env node
/**
 * watch-tests.js — 監看檔案變更，自動重跑測試
 *
 * 執行方式：
 *   node tools/watch-tests.js        (或 npm run test:watch)
 *
 * 行為：
 *   1. 啟動後立刻跑一次完整測試
 *   2. 監看 assets/scripts/、extensions/、tools/ 下的 .ts / .js 變更
 *   3. 偵測到變更後 debounce 500ms 再次執行（避免編輯器批次寫入觸發多次）
 *   4. Ctrl+C 乾淨退出
 *
 * 設計原則：
 *   - 不依賴 chokidar / nodemon 等第三方套件，使用 Node 內建 fs.watch
 *   - Windows 上 fs.watch recursive:true 原生支援
 *   - 所有測試透過 tools/run-tests.js 執行（共用同一入口，行為一致）
 *
 * Unity 對照：
 *   類似 JetBrains Rider 的「持續測試」模式，或 Guard / Jest --watch
 */

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

// ── 監看目錄（相對於 projectRoot）────────────────────────────────────────────

const WATCH_DIRS = [
    'assets/scripts',
    'extensions',
    'tools',
].map(d => path.join(projectRoot, d)).filter(d => fs.existsSync(d));

// ── 執行一次測試 ──────────────────────────────────────────────────────────────

function runTests() {
    console.log('\n' + '─'.repeat(60));
    console.log(`⏱  ${new Date().toLocaleTimeString()}  開始執行測試...\n`);

    const result = spawnSync(
        'node',
        [path.join(__dirname, 'run-tests.js')],
        { stdio: 'inherit', cwd: projectRoot, shell: false }
    );

    if (result.error) {
        console.error('❌  無法啟動測試 runner:', result.error.message);
    }
    console.log('\n👀  監看中，儲存 .ts / .js 檔案即可觸發重跑...');
}

// ── Debounce 機制 ─────────────────────────────────────────────────────────────

let debounceTimer = null;

function onFileChange(eventType, filename) {
    if (!filename) return;
    // 只關心 TypeScript / JavaScript 原始碼
    if (!filename.endsWith('.ts') && !filename.endsWith('.js')) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        console.log(`\n🔔  偵測到變更：${filename}`);
        runTests();
    }, 500);
}

// ── 啟動監看 ──────────────────────────────────────────────────────────────────

console.log('👀  Watch 模式啟動');
console.log('   監看目錄：');
WATCH_DIRS.forEach(d => console.log(`     • ${path.relative(projectRoot, d)}`));
console.log('');

// 初次執行
runTests();

// 啟動 fs.watch
const watchers = WATCH_DIRS.map(dir =>
    fs.watch(dir, { recursive: true }, onFileChange)
);

// 乾淨退出
function cleanup() {
    clearTimeout(debounceTimer);
    watchers.forEach(w => w.close());
    console.log('\n\n🛑  Watch 模式已停止。');
    process.exit(0);
}

process.on('SIGINT',  cleanup);
process.on('SIGTERM', cleanup);
