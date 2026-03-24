/**
 * run-cli.ts — CLI 直接入口（由 tools/run-tests.js 以 ts-node 執行）
 *
 * 此檔案不依賴任何 Cocos 模組，僅串接純邏輯測試 + DeprecatedApiScanner。
 * 用途：在 CI 或開發機上不開 Cocos Editor 即可快速執行測試。
 *
 * 注意：path 以 require() 坐落在 async IIFE 內部，避免 Cocos Creator
 *        在編譯時將頂層 import 要求載入 Node.js 內建模組導致場景錯誤。
 */
import { TestRunner } from './TestRunner';
import { createFormulaSuite } from './FormulaSystem.test';
import { createBuffSuite } from './BuffSystem.test';
import { createEventSystemSuite } from './EventSystem.test';
import { createActionSystemSuite } from './ActionSystem.test';
import { createBuffParticleProfileConfigSuite } from './BuffParticleProfileConfig.test';
import { createVfxEffectConfigSuite } from './VfxEffectConfig.test';
import { createUIManagerSuite } from './UIManager.test';
import { createCurveSuite } from './CurveSystem.test';
import { createDeprecatedApiSuite } from './DeprecatedApiScanner';

/**
 * 只在 Node.js CLI 環境（ts-node）下執行。
 * 在 Cocos Creator 預覽環境（Electron）中，`window` 是全域物件 → 跳過 IIFE，
 * 避免 process.exit() 殺掉 Cocos 的 Electron 預覽進程導致場景永遠卡在 loading。
 *
 * Unity 對照：相當於 #if UNITY_EDITOR 條件編譯，讓程式碼只在編輯器工具鏈中執行。
 */
if (typeof window === 'undefined') {
(async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const runner = new TestRunner();

    // 蝝?頛舀葫閰?
    runner.register(createFormulaSuite());
    runner.register(createBuffSuite());
    runner.register(createEventSystemSuite());
    runner.register(createActionSystemSuite());
    runner.register(createBuffParticleProfileConfigSuite());
    runner.register(createVfxEffectConfigSuite());
    runner.register(createUIManagerSuite());
    runner.register(createCurveSuite());

    // Deprecated API 靜態掃描
    // __dirname = assets/scripts/tools/tests/  →  ../../../../ = 專案根目錄
    const projectRoot = path.resolve(__dirname, '../../../../');
    runner.register(createDeprecatedApiSuite({
        scanRoots: [
            path.join(projectRoot, 'assets/scripts'),  // 遊戲邏輯腳本
            path.join(projectRoot, 'extensions'),       // 編輯器擴充套件 .ts
            path.join(projectRoot, 'tools'),            // 工具腳本 .ts
        ],
        relativeBase: projectRoot,  // violation 路徑與 whitelist 均相對此目錄
    }));

    const summary = await runner.runAll();

    // CLI 退出碼：有失敗 → 非 0（可被 CI 捕捉）
    process.exit(summary.failed > 0 ? 1 : 0);
})();
} // end: typeof window === 'undefined' guard
