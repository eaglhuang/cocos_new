/**
 * run-cli.ts — CLI 直接入口（由 tools/run-tests.js 以 ts-node 執行）
 *
 * 此檔案不依賴任何 Cocos 模組，僅串接純邏輯測試 + DeprecatedApiScanner。
 * 用途：在 CI 或開發機上不開 Cocos Editor 即可快速執行測試。
 */

import * as path from 'path';
import { TestRunner } from './TestRunner';
import { createFormulaSuite } from './FormulaSystem.test';
import { createBuffSuite } from './BuffSystem.test';
import { createDeprecatedApiSuite } from './DeprecatedApiScanner';

(async () => {
    const runner = new TestRunner();

    // 純邏輯測試
    runner.register(createFormulaSuite());
    runner.register(createBuffSuite());

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
