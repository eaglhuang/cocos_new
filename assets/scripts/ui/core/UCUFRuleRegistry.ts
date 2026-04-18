// @spec-source → docs/UCUF規範文件.md §3  (UCUF M11)
/**
 * UCUFRuleRegistry — 動態規則注冊器
 *
 * 設計目標：
 *   - 集中管理 RT-01~RT-10 及未來新增規則
 *   - 支援 register / unregister / getRulesByScope / onRuleAdded
 *   - 可由 RuntimeRuleChecker.setRegistry() 注入，提供動態規則訂閱能力
 *   - 不依賴 cc runtime，可在 Node.js 測試環境直接使用
 *
 * 建構時自動預載入 RT-01~RT-10（向後相容，靜默，不發送 onRuleAdded 事件）。
 * 呼叫 register() 新增規則時，才透過 IEventBus 廣播 'ucuf-rule-added' 事件。
 *
 * Unity 對照：類似 Editor 的 CustomEditor 屬性 + ScriptableObject Registry，
 *             讓規則可在執行期熱插拔而無需修改核心 Checker。
 */

// ─── 型別定義 ──────────────────────────────────────────────────────────────────

export type RuleSeverity = 'warning' | 'error';

export interface RuleEntry {
    /** 規則唯一識別碼，例如 'RT-01' */
    id: string;
    /** 規則顯示名稱 */
    name: string;
    /** 違反時的嚴重等級 */
    severity: RuleSeverity;
    /** 是否啟用（停用規則不參與 runScopeChecks） */
    enabled: boolean;
    /** 觸發時機清單，例如 ['mount', 'switchSlot'] */
    triggerPoints: string[];
    /**
     * 可選的即時檢查函式。
     * 若為 undefined，表示此規則由 RuntimeRuleChecker 的原有 static 方法負責執行；
     * 若提供，則由 runScopeChecks 自動呼叫。
     */
    checkFn?: (context: unknown) => boolean;
    /** 規則自訂參數，例如 { maxDepth: 8 } */
    params?: Record<string, unknown>;
}

/** 最小事件匯流排介面，UCUFRuleRegistry 只需要 on / emit，不依賴完整 EventSystem */
export interface IEventBus {
    on<T = unknown>(eventName: string, handler: (payload?: T) => void): () => void;
    emit<T = unknown>(eventName: string, payload?: T): void;
}

// ─── 主類別 ────────────────────────────────────────────────────────────────────

export class UCUFRuleRegistry {

    private readonly _rules = new Map<string, RuleEntry>();
    private readonly _bus: IEventBus | null;

    /**
     * @param eventBus 可選。傳入 EventSystem 實例以啟用 onRuleAdded 訂閱。
     *                 若未傳入，onRuleAdded 將回傳 noop 並印出 warn。
     */
    constructor(eventBus?: IEventBus) {
        this._bus = eventBus ?? null;
        this._preRegisterBuiltins();
    }

    // ── 公開 API ───────────────────────────────────────────────────────────────

    /**
     * 動態注冊一條規則。若 id 已存在則覆蓋。
     * 成功後透過 eventBus 廣播 'ucuf-rule-added'。
     */
    register(entry: RuleEntry): void {
        this._rules.set(entry.id, entry);
        this._bus?.emit<RuleEntry>('ucuf-rule-added', entry);
    }

    /** 移除規則。若 id 不存在則靜默忽略。 */
    unregister(ruleId: string): void {
        this._rules.delete(ruleId);
    }

    /**
     * 取得符合指定觸發點的所有啟用規則。
     * @param scope 觸發時機字串，例如 'mount' / 'switchSlot' / 'applyContentState'
     */
    getRulesByScope(scope: string): RuleEntry[] {
        return [...this._rules.values()].filter(
            r => r.enabled && r.triggerPoints.includes(scope),
        );
    }

    /** 依 id 取得規則定義。若不存在回傳 undefined。 */
    getRuleById(ruleId: string): RuleEntry | undefined {
        return this._rules.get(ruleId);
    }

    /** 取得所有已注冊規則（含停用）。 */
    getAllRules(): RuleEntry[] {
        return [...this._rules.values()];
    }

    /**
     * 訂閱新規則被 register() 時的事件。
     * @returns 取消訂閱函式（呼叫即解除監聽）
     */
    onRuleAdded(handler: (entry?: RuleEntry) => void): () => void {
        if (!this._bus) {
            console.warn('[UCUFRuleRegistry] onRuleAdded: 未設定 eventBus，handler 不會被呼叫');
            return () => { /* noop */ };
        }
        return this._bus.on<RuleEntry>('ucuf-rule-added', handler);
    }

    /**
     * 從 JSON 物件批次載入規則（格式見 ucuf-rules-registry.json）。
     * 每條規則均透過 register() 加入，並觸發 onRuleAdded 事件。
     * 若 id 或 name 缺失則略過該條並印 warn。
     */
    loadFromJson(json: { version?: string; rules: Partial<RuleEntry>[] }): void {
        for (const raw of (json.rules ?? [])) {
            if (!raw.id || !raw.name) {
                console.warn('[UCUFRuleRegistry] loadFromJson: 略過缺少 id/name 的規則條目', raw);
                continue;
            }
            const entry: RuleEntry = {
                id:            raw.id,
                name:          raw.name,
                severity:      raw.severity      ?? 'warning',
                enabled:       raw.enabled       ?? true,
                triggerPoints: raw.triggerPoints ?? [],
                params:        raw.params,
            };
            this.register(entry);
        }
    }

    // ── 私有方法 ───────────────────────────────────────────────────────────────

    /**
     * 預載入 RT-01~RT-10。
     * 直接寫入 _rules Map（不呼叫 register），避免在初始化時觸發 onRuleAdded 事件。
     */
    private _preRegisterBuiltins(): void {
        const builtins: RuleEntry[] = [
            {
                id: 'RT-01', name: 'nodeDepthCheck',
                severity: 'warning', enabled: true,
                triggerPoints: ['mount', 'switchSlot'],
                params: { maxDepth: 8 },
            },
            {
                id: 'RT-02', name: 'duplicateDataSource',
                severity: 'error', enabled: true,
                triggerPoints: ['mount', 'applyContentState'],
            },
            {
                id: 'RT-03', name: 'skinLayerSlotExists',
                severity: 'error', enabled: true,
                triggerPoints: ['mount'],
            },
            {
                id: 'RT-04', name: 'fragmentLoadFailed',
                severity: 'error', enabled: true,
                triggerPoints: ['mount', 'switchSlot'],
            },
            {
                id: 'RT-05', name: 'duplicateWidgetSiblings',
                severity: 'warning', enabled: true,
                triggerPoints: ['mount'],
            },
            {
                id: 'RT-06', name: 'compositeImageLayerCount',
                severity: 'warning', enabled: true,
                triggerPoints: ['mount'],
                params: { maxCount: 12 },
            },
            {
                id: 'RT-07', name: 'childPanelConfig',
                severity: 'error', enabled: true,
                triggerPoints: ['mount'],
            },
            {
                id: 'RT-08', name: 'tabRoutingFragmentFailed',
                severity: 'error', enabled: true,
                triggerPoints: ['mount', 'switchSlot'],
            },
            {
                id: 'RT-09', name: 'contentStateKeyMatch',
                severity: 'warning', enabled: true,
                triggerPoints: ['applyContentState'],
            },
            {
                id: 'RT-10', name: 'skinSlotPathUnique',
                severity: 'error', enabled: true,
                triggerPoints: ['mount'],
            },
        ];

        for (const entry of builtins) {
            this._rules.set(entry.id, entry);
        }
    }
}
