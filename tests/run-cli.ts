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
import { createUnityParticlePrefabParserSuite } from './UnityParticlePrefabParser.test';
import { createDeprecatedApiSuite } from './DeprecatedApiScanner';
import { createSyncManagerSuite } from './SyncManager.test';
import { createNetworkServiceSuite } from './NetworkService.test';
import { createSkinLayersSuite } from './ucuf/skinLayers.test';
import { createCompositePanelSuite } from './ucuf/compositePanel.test';
import { createAttributePanelSuite } from './ucuf/attributePanel.test';
import { createGridPanelSuite } from './ucuf/gridPanel.test';
import { createScrollListPanelSuite } from './ucuf/scrollListPanel.test';
import { createRadarChartPanelSuite } from './ucuf/radarChartPanel.test';
import { createProgressBarPanelSuite } from './ucuf/progressBarPanel.test';
import { createUCUFLoggerSuite } from './ucuf/ucufLogger.test';
import { createRuntimeRuleCheckerSuite } from './ucuf/runtimeRuleChecker.test';
import { createDataBindingValidatorSuite } from './ucuf/dataBindingValidator.test';
import { createCompositePanelDisposeSuite } from './ucuf/compositePanelDispose.test';
import { createAssetRegistryEntrySuite } from './ucuf/assetRegistryEntry.test';
import { createI18nIntegrationSuite } from './ucuf/i18nIntegration.test';
import { createPerformanceOptimizationSuite } from './ucuf/performanceOptimization.test';
import { createArchitectureGovernanceSuite } from './ucuf/architectureGovernance.test';
import { createScaffoldV2Suite } from './ucuf/scaffoldV2.test';
import { createValidateUiSpecsCliSuite } from './ucuf/validateUiSpecsCli.test';
import { createAgentGovernanceSuite } from './ucuf/agentGovernance.test';
import { createFinalizeAgentTurnCliSuite } from './ucuf/finalizeAgentTurnCli.test';
import { createUcufRuntimeCheckCliSuite } from './ucuf/ucufRuntimeCheckCli.test';
import { createDeployDragDebugSuite } from './DeployDragDebug.test';
import { createBattleSkillExecutorSuite } from './BattleSkillExecutor.test';
import { createBattleSkillTargetSelectorSuite } from './BattleSkillTargetSelector.test';
import { createBattleSkillDamageResolverSuite } from './BattleSkillDamageResolver.test';

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

    // Registered test suites
    runner.register(createFormulaSuite());
    runner.register(createBuffSuite());
    runner.register(createEventSystemSuite());
    runner.register(createActionSystemSuite());
    runner.register(createBuffParticleProfileConfigSuite());
    runner.register(createVfxEffectConfigSuite());
    runner.register(createUIManagerSuite());
    runner.register(createCurveSuite());
    runner.register(createUnityParticlePrefabParserSuite());
    runner.register(createSyncManagerSuite());
    runner.register(createNetworkServiceSuite());
    runner.register(createSkinLayersSuite());
    runner.register(createCompositePanelSuite());
    runner.register(createAttributePanelSuite());
    runner.register(createGridPanelSuite());
    runner.register(createScrollListPanelSuite());
    runner.register(createRadarChartPanelSuite());
    runner.register(createProgressBarPanelSuite());
    // M5
    runner.register(createUCUFLoggerSuite());
    runner.register(createRuntimeRuleCheckerSuite());
    runner.register(createDataBindingValidatorSuite());
    runner.register(createCompositePanelDisposeSuite());

    // M6
    runner.register(createAssetRegistryEntrySuite());

    // M7
    runner.register(createI18nIntegrationSuite());

    // M8
    runner.register(createPerformanceOptimizationSuite());

    // M9
    runner.register(createArchitectureGovernanceSuite());

    // M10
    runner.register(createScaffoldV2Suite());
    runner.register(createValidateUiSpecsCliSuite());

    // M11
    runner.register(createAgentGovernanceSuite());
    runner.register(createFinalizeAgentTurnCliSuite());
    runner.register(createUcufRuntimeCheckCliSuite());
    runner.register(createDeployDragDebugSuite());
    runner.register(createBattleSkillExecutorSuite());
    runner.register(createBattleSkillTargetSelectorSuite());
    runner.register(createBattleSkillDamageResolverSuite());

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

    // --layer N 过濾：只執行指定 層的 suite
    const layerArg = process.argv.find(a => a.startsWith('--layer=') || a === '--layer');
    let layerFilter: 1 | 2 | 3 | undefined;
    if (layerArg) {
        const raw = layerArg.includes('=') ? layerArg.split('=')[1] : process.argv[process.argv.indexOf(layerArg) + 1];
        const n = Number(raw);
        if (n === 1 || n === 2 || n === 3) layerFilter = n;
    }

    const summary = await runner.runAll(layerFilter);

    // CLI 退出碼：有失敗 → 非 0（可被 CI 捕捉）
    process.exit(summary.failed > 0 ? 1 : 0);
})();
} // end: typeof window === 'undefined' guard
