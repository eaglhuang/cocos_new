/**
 * TestEntryPoint — Cocos Creator DevMode 測試入口
 *
 * 在 BattleScene 或任意 Component 的 start() 中加入以下程式碼即可觸發：
 *
 *   import { runAllTests } from '../tools/tests/TestEntryPoint';
 *   // 在 onLoad 或 start() 的最前面：
 *   if (CC_DEV) { runAllTests(); }
 *
 * 注意：DeprecatedApiScanner 依賴 Node.js fs 模組，在 Cocos 瀏覽器環境中
 *       會靜默跳過（不影響 runtime）。其他純邏輯測試（Formula / Buff）
 *       在任何環境下均可執行。
 *
 * Unity 對照：
 *   相當於 Unity Test Runner 的 PlayMode Tests，在編輯器 Play 時執行
 */

import { TestRunner } from './TestRunner';
import { createFormulaSuite } from './FormulaSystem.test';
import { createBuffSuite } from './BuffSystem.test';
import { createSyncManagerSuite } from './SyncManager.test';
import { createNetworkServiceSuite } from './NetworkService.test';
import { createGeneralListPanelSuite } from './GeneralListPanel.test';

// DeprecatedApiScanner 只在 Node.js 環境執行
let createDeprecatedApiSuite: ((dir: string) => import('./TestRunner').TestSuite) | null = null;
try {
    // 動態 require：在 Cocos 瀏覽器環境下這一行會失敗，但 catch 掉
    const mod = require('./DeprecatedApiScanner');
    createDeprecatedApiSuite = mod.createDeprecatedApiSuite;
} catch (_) {
    // 非 Node.js 環境（如 Cocos 瀏覽器），靜默跳過
}

/** 執行全部測試，回傳 RunSummary */
export async function runAllTests() {
    const runner = new TestRunner();

    // 純邏輯測試 — 任何環境均可執行
    runner.register(createFormulaSuite());
    runner.register(createBuffSuite());
    runner.register(createSyncManagerSuite());
    runner.register(createNetworkServiceSuite());
    runner.register(createGeneralListPanelSuite());

    // 靜態掃描測試 — 僅 Node.js 環境
    if (createDeprecatedApiSuite) {
        // 在 Cocos 專案中，腳本目錄相對路徑需要對應到 assets/scripts
        // CLI 執行時由 tools/run-tests.js 傳入正確路徑
        const scriptsDir = typeof __dirname !== 'undefined'
            ? require('path').resolve(__dirname, '../../')  // 從 tests/ 退兩層到 scripts/
            : null;
        if (scriptsDir) {
            runner.register(createDeprecatedApiSuite(scriptsDir));
        }
    }

    const summary = await runner.runAll();
    return summary;
}

// 允許在 Cocos 控制台直接呼叫
if (typeof window !== 'undefined') {
    (window as any).__runTests = runAllTests;
}
