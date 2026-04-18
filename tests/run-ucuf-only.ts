import { TestRunner } from './TestRunner';
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
import { createAssetEvictionClosedLoopSuite } from './ucuf/assetEvictionClosedLoop.test';
import { createSceneSwitchDisposeSuite } from './ucuf/sceneSwitchDispose.integration.test';
import { createSpecVersionDegradationSuite } from './ucuf/specVersionDegradation.test';
import { createValidateTaskCardCliSuite } from './ucuf/validateTaskCardCli.test';
import { createEditableTextPanelSuite } from './ucuf/editableTextPanel.test';

if (typeof window === 'undefined') {
    (async () => {
        // --suite <name> 支援：只跑名稱包含 <name> 的 suite（不分大小寫）
        const suiteFilter = (() => {
            const idx = process.argv.indexOf('--suite');
            return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1].toLowerCase() : null;
        })();

        const runner = new TestRunner();
        runner.register(createSkinLayersSuite());
        runner.register(createCompositePanelSuite());
        runner.register(createAttributePanelSuite());
        runner.register(createGridPanelSuite());
        runner.register(createScrollListPanelSuite());
        runner.register(createRadarChartPanelSuite());
        runner.register(createProgressBarPanelSuite());
        runner.register(createUCUFLoggerSuite());
        runner.register(createRuntimeRuleCheckerSuite());
        runner.register(createDataBindingValidatorSuite());
        runner.register(createCompositePanelDisposeSuite());
        runner.register(createAssetRegistryEntrySuite());
        runner.register(createI18nIntegrationSuite());
        runner.register(createPerformanceOptimizationSuite());
        runner.register(createArchitectureGovernanceSuite());
        runner.register(createScaffoldV2Suite());
        runner.register(createValidateUiSpecsCliSuite());
        runner.register(createAgentGovernanceSuite());
        runner.register(createFinalizeAgentTurnCliSuite());
        runner.register(createUcufRuntimeCheckCliSuite());
        runner.register(createAssetEvictionClosedLoopSuite());
        runner.register(createSceneSwitchDisposeSuite());
        runner.register(createSpecVersionDegradationSuite());
        runner.register(createValidateTaskCardCliSuite());
        runner.register(createEditableTextPanelSuite());

        if (suiteFilter) {
            // 用 name filter 取代 layer filter — 只跑匹配的 suite
            const filtered = (runner as any).suites.filter(
                (s: any) => s.name.toLowerCase().includes(suiteFilter)
            );
            if (filtered.length === 0) {
                console.error(`No suite matching '${suiteFilter}'`);
                process.exit(1);
            }
            const tmpRunner = new TestRunner();
            for (const s of filtered) tmpRunner.register(s);
            const summary = await tmpRunner.runAll();
            process.exit(summary.failed > 0 ? 1 : 0);
        } else {
            const summary = await runner.runAll();
            process.exit(summary.failed > 0 ? 1 : 0);
        }
    })();
}