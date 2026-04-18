// @spec-source → docs/UCUF規範文件.md §3  (UCUF M5)
/**
 * RuntimeRuleChecker — UCUF Runtime 規則檢查器
 *
 * 內建 RT-01 ~ RT-10 規則（見 UCUF規範文件.md §3 Lint 規則總表）：
 *   RT-01  節點深度超過 8 層                   warning
 *   RT-02  同一 dataSource 被多個 ChildPanel 綁定  error
 *   RT-03  skinLayers 引用的 skinSlot 不存在       error
 *   RT-04  lazySlot 的 defaultFragment 載入失敗    error
 *   RT-05  同 parent 下多兄弟節點使用相同 widget    warning
 *   RT-06  composite-image layers 超過 12 層       warning
 *   RT-07  ChildPanel config 缺少必要欄位          error
 *   RT-08  Tab 路由表引用不存在的 fragment          error
 *   RT-09  content state 欄位與 dataSource 不匹配  warning
 *   RT-10  skinSlot ID 重複但指向不同資源           error
 *
 * 觸發時機（見規範文件 §3「觸發點彙整表」）：
 *   mount() 完成後      → RT-01~RT-10（僅 DEBUG_MODE）
 *   switchSlot() 完成後 → RT-01, RT-04（僅 DEBUG_MODE）
 *   applyContentState() → RT-02, RT-09（僅 DEBUG_MODE）
 *
 * Unity 對照：Editor OnValidate() + PlayMode Assert 的組合。
 */

import type { Node } from 'cc';
import { UCUFLogger, LogCategory, LogLevel } from './UCUFLogger';
import type { UCUFRuleRegistry } from './UCUFRuleRegistry';

// ─── 結果型別 ──────────────────────────────────────────────────────────────────

export type RuleSeverity = 'warning' | 'error';

export interface RuleResult {
    ruleId:   string;
    severity: RuleSeverity;
    passed:   boolean;
    message:  string;
}

// ─── 主類別 ────────────────────────────────────────────────────────────────────

export class RuntimeRuleChecker {

    // ── 動態規則訂閱（M11） ────────────────────────────────────────────────────

    private static _registry: UCUFRuleRegistry | null = null;

    /**
     * 注入 UCUFRuleRegistry，啟用動態規則訂閱能力。
     * 注入後 runScopeChecks() 將從 registry 取得規則並執行 checkFn。
     * Unity 對照：類似在 Editor 中呼叫 CustomEditor.SetRuleProvider()。
     */
    static setRegistry(registry: UCUFRuleRegistry): void {
        RuntimeRuleChecker._registry = registry;
    }

    /**
     * 執行指定觸發點的所有動態規則。
     * 只執行 registry 內 enabled=true 且含指定 scope 的規則，且規則必須有 checkFn。
     * 若未注入 registry，回傳空陣列（原有 static checkRTxx 方法仍正常運作）。
     *
     * @param scope   觸發時機，例如 'mount' / 'switchSlot' / 'applyContentState'
     * @param context 傳入檢查函式的自訂上下文物件
     */
    static runScopeChecks(scope: string, context: unknown): RuleResult[] {
        if (!RuntimeRuleChecker._registry) { return []; }
        const rules = RuntimeRuleChecker._registry.getRulesByScope(scope);
        const results: RuleResult[] = [];
        for (const rule of rules) {
            if (typeof rule.checkFn !== 'function') { continue; }
            let passed = false;
            try {
                passed = rule.checkFn(context);
            } catch (err) {
                passed = false;
            }
            const result: RuleResult = {
                ruleId:   rule.id,
                severity: rule.severity,
                passed,
                message:  passed
                    ? `${rule.id} PASS: ${rule.name}`
                    : `${rule.id} FAIL: ${rule.name}`,
            };
            if (!passed) {
                if (rule.severity === 'error') {
                    UCUFLogger.error(LogCategory.RULE, result.message);
                } else {
                    UCUFLogger.warn(LogCategory.RULE, result.message);
                }
            }
            results.push(result);
        }
        return results;
    }

    // ── 內建靜態規則（RT-01~RT-10，向後相容） ─────────────────────────────────

    /** RT-01：節點深度 ≤ 8 層 */
    static checkRT01_nodeDepth(
        root:     Node,
        maxDepth: number = 8,
    ): RuleResult {
        const depth = RuntimeRuleChecker._maxDepth(root, 0);
        const passed = depth <= maxDepth;
        const result: RuleResult = {
            ruleId:   'RT-01',
            severity: 'warning',
            passed,
            message:  passed
                ? `RT-01 PASS: 最大節點深度 ${depth}`
                : `RT-01 FAIL: 節點深度 ${depth} 超過上限 ${maxDepth}`,
        };
        if (!passed) {
            UCUFLogger.warn(LogCategory.RULE, result.message);
        }
        return result;
    }

    /** RT-02：同一 dataSource 不被多個 ChildPanel 使用 */
    static checkRT02_duplicateDataSource(
        dataSources: string[],
    ): RuleResult {
        const seen = new Set<string>();
        const dupes: string[] = [];
        for (const ds of dataSources) {
            if (seen.has(ds)) { dupes.push(ds); }
            seen.add(ds);
        }
        const passed = dupes.length === 0;
        const result: RuleResult = {
            ruleId:   'RT-02',
            severity: 'error',
            passed,
            message:  passed
                ? 'RT-02 PASS: 無重複 dataSource'
                : `RT-02 FAIL: 重複 dataSource [${dupes.join(', ')}]`,
        };
        if (!passed) {
            UCUFLogger.error(LogCategory.RULE, result.message);
        }
        return result;
    }

    /** RT-03：skinLayers 引用的 skinSlot 必須存在於 skinManifest */
    static checkRT03_skinLayerSlotExists(
        skinLayerSlots:     string[],
        knownManifestSlots: Set<string>,
    ): RuleResult {
        const missing = skinLayerSlots.filter(s => !knownManifestSlots.has(s));
        const passed  = missing.length === 0;
        const result: RuleResult = {
            ruleId:   'RT-03',
            severity: 'error',
            passed,
            message:  passed
                ? 'RT-03 PASS: 所有 skinLayer slot 均存在於 manifest'
                : `RT-03 FAIL: 缺失 skinSlot [${missing.join(', ')}]`,
        };
        if (!passed) {
            UCUFLogger.error(LogCategory.RULE, result.message);
        }
        return result;
    }

    /** RT-04：lazySlot defaultFragment 載入失敗 */
    static reportRT04_fragmentLoadFailed(
        slotId:     string,
        fragmentId: string,
        error:      unknown,
    ): RuleResult {
        const result: RuleResult = {
            ruleId:   'RT-04',
            severity: 'error',
            passed:   false,
            message:  `RT-04 FAIL: slotId="${slotId}" fragment="${fragmentId}" 載入失敗: ${String(error)}`,
        };
        UCUFLogger.error(LogCategory.RULE, result.message);
        return result;
    }

    /** RT-05：同一 parent 下多個 siblings 不可使用完全相同的 widget */
    static checkRT05_duplicateWidgetSiblings(
        parentName: string,
        childWidgets: Array<{ name: string; widgetHash: string }>,
    ): RuleResult {
        const widgetMap = new Map<string, string[]>();
        for (const { name, widgetHash } of childWidgets) {
            const group = widgetMap.get(widgetHash) ?? [];
            group.push(name);
            widgetMap.set(widgetHash, group);
        }
        const dupes: string[] = [];
        for (const [hash, names] of widgetMap) {
            if (names.length > 1) {
                dupes.push(`widget{${hash}}: [${names.join(', ')}]`);
            }
        }
        const passed = dupes.length === 0;
        const result: RuleResult = {
            ruleId:   'RT-05',
            severity: 'warning',
            passed,
            message:  passed
                ? `RT-05 PASS: "${parentName}" 無重複 widget siblings`
                : `RT-05 FAIL: "${parentName}" 有重複 widget siblings — ${dupes.join(' / ')}`,
        };
        if (!passed) {
            UCUFLogger.warn(LogCategory.RULE, result.message);
        }
        return result;
    }

    /** RT-06：composite-image layers ≤ 12 */
    static checkRT06_compositeImageLayerCount(
        nodeName:   string,
        layerCount: number,
        maxCount:   number = 12,
    ): RuleResult {
        const passed = layerCount <= maxCount;
        const result: RuleResult = {
            ruleId:   'RT-06',
            severity: 'warning',
            passed,
            message:  passed
                ? `RT-06 PASS: "${nodeName}" ${layerCount} layers`
                : `RT-06 FAIL: "${nodeName}" composite-image 有 ${layerCount} 層，超過上限 ${maxCount}`,
        };
        if (!passed) {
            UCUFLogger.warn(LogCategory.RULE, result.message);
        }
        return result;
    }

    /** RT-07：ChildPanel config 必須包含所有 requiredFields */
    static checkRT07_childPanelConfig(
        panelType:      string,
        config:         Record<string, unknown>,
        requiredFields: string[],
    ): RuleResult {
        const missing = requiredFields.filter(f => config[f] === undefined);
        const passed  = missing.length === 0;
        const result: RuleResult = {
            ruleId:   'RT-07',
            severity: 'error',
            passed,
            message:  passed
                ? `RT-07 PASS: ${panelType} config 完整`
                : `RT-07 FAIL: ${panelType} config 缺少欄位 [${missing.join(', ')}]`,
        };
        if (!passed) {
            UCUFLogger.error(LogCategory.RULE, result.message);
        }
        return result;
    }

    /** RT-08：Tab 路由表中的 fragment 載入失敗 */
    static reportRT08_tabRoutingFragmentFailed(
        tabKey:     string,
        fragmentId: string,
        error:      unknown,
    ): RuleResult {
        const result: RuleResult = {
            ruleId:   'RT-08',
            severity: 'error',
            passed:   false,
            message:  `RT-08 FAIL: tabKey="${tabKey}" fragment="${fragmentId}" 不存在或載入失敗: ${String(error)}`,
        };
        UCUFLogger.error(LogCategory.RULE, result.message);
        return result;
    }

    /** RT-09：content state 的 key 應與已登記 ChildPanel 的 dataSource 集合一致 */
    static checkRT09_contentStateKeyMatch(
        stateKeys:       string[],
        registeredSources: string[],
    ): RuleResult {
        const sourceSet = new Set(registeredSources);
        const extra  = stateKeys.filter(k => !sourceSet.has(k));
        const passed = extra.length === 0;
        const result: RuleResult = {
            ruleId:   'RT-09',
            severity: 'warning',
            passed,
            message:  passed
                ? 'RT-09 PASS: content state keys 與 ChildPanel dataSources 一致'
                : `RT-09 WARN: content state 有多餘 key [${extra.join(', ')}] 未被任何 ChildPanel 消費`,
        };
        if (!passed) {
            UCUFLogger.warn(LogCategory.RULE, result.message);
        }
        return result;
    }

    /** RT-10：skin manifest 中同一 slot ID 不應指向不同路徑 */
    static checkRT10_skinSlotPathUnique(
        slotPathPairs: Array<{ slotId: string; path: string }>,
    ): RuleResult {
        const slotToPath = new Map<string, string>();
        const conflicts: string[] = [];
        for (const { slotId, path } of slotPathPairs) {
            const existing = slotToPath.get(slotId);
            if (existing !== undefined && existing !== path) {
                conflicts.push(`${slotId}: "${existing}" vs "${path}"`);
            } else {
                slotToPath.set(slotId, path);
            }
        }
        const passed = conflicts.length === 0;
        const result: RuleResult = {
            ruleId:   'RT-10',
            severity: 'error',
            passed,
            message:  passed
                ? 'RT-10 PASS: 無 skinSlot 路徑衝突'
                : `RT-10 FAIL: skinSlot 路徑衝突 [${conflicts.join(' | ')}]`,
        };
        if (!passed) {
            UCUFLogger.error(LogCategory.RULE, result.message);
        }
        return result;
    }

    // ── 工具方法 ─────────────────────────────────────────────────────────────

    /** 檢查是否應執行 runtime 規則（DEBUG_MODE = LogLevel.DEBUG） */
    static isDebugMode(): boolean {
        return UCUFLogger.getLevel() === LogLevel.DEBUG;
    }

    /** 遞迴計算節點最大深度 */
    private static _maxDepth(node: Node, current: number): number {
        let max = current;
        for (const child of (node as unknown as { children?: Node[] }).children ?? []) {
            const d = RuntimeRuleChecker._maxDepth(child, current + 1);
            if (d > max) { max = d; }
        }
        return max;
    }
}
