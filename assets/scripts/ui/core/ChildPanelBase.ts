// @spec-source → 見 docs/cross-reference-index.md  (UCUF M2)
/**
 * ChildPanelBase
 *
 * UCUF M2 — CompositePanel 的子面板抽象基底。
 * 每個具體 ChildPanel 負責一個獨立的資料/視覺區塊（如屬性列表、技能欄、等級資訊）。
 *
 * 設計原則（H-04 務實）：
 *   - 接收 cc.Node 作為掛載點，但本身不 import cc 執行函式。
 *   - 依賴注入：hostNode / skinResolver / binder 由 CompositePanel 在建立時注入。
 *   - 生命週期：mount → onDataUpdate → (optionally) onUnmount
 *
 * Unity 對照：MonoBehaviour sub-panel with dependency injection via constructor args。
 */
import type { Node } from 'cc';
import type { UISkinResolver } from './UISkinResolver';
import type { UITemplateBinder } from './UITemplateBinder';
import type { ICompositeRenderer } from './interfaces/ICompositeRenderer';
import type { IScrollVirtualizer } from './interfaces/IScrollVirtualizer';
import type { AssetRefType } from './AssetRegistryEntry';
import type { I18nSystem, LocaleCode } from '../../core/systems/I18nSystem';
import { UCUFLogger, LogCategory } from './UCUFLogger';

/**
 * 動態資源登記 callback（M6）。
 * 由 CompositePanel.registerChildPanel() 注入，
 * ChildPanel 呼叫 registerDynamicAsset() 時會透過此 callback 回報宿主。
 */
export type DynamicAssetCallback = (path: string, assetType: AssetRefType) => void;

/**
 * Panel 服務包（UCUF M3 DI）。
 * 由 CompositePanel.registerChildPanel() 自動注入。
 * ChildPanel 子類透過 this._services.renderer / this._services.virtualizer 取用。
 *
 * Unity 對照：相當於 [Inject] 標注的依賴屬性，由容器（CompositePanel）自動填充。
 */
export interface PanelServices {
    renderer?:    ICompositeRenderer;
    virtualizer?: IScrollVirtualizer;
    /** M7: I18n 服務，由 CompositePanel.registerChildPanel() 自動注入 */
    i18n?:        I18nSystem;
}

export abstract class ChildPanelBase {
    // ─── Injected dependencies ────────────────────────────────────────────────

    /** CompositePanel 分配給此子面板的宿主 Node（對應 lazySlot 節點） */
    readonly hostNode: Node;

    /** skin 解析器（從 CompositePanel 繼承） */
    readonly skinResolver: UISkinResolver;

    /** template binder（從 CompositePanel 繼承） */
    readonly binder: UITemplateBinder;

    // ─── Panel 識別 ───────────────────────────────────────────────────────────

    /**
     * 此 ChildPanel 訂閱的資料鍵。
     * CompositePanel.applyContentState(state) 會用此鍵從 state 中取出對應資料
     * 再傳入 onDataUpdate()。
     * 子類別應覆寫為具體字串，例如 `'attributes'` 或 `'skills'`。
     */
    dataSource: string = '';

    /** 任意自訂屬性，供子類別擴充使用 */
    customProps: Record<string, unknown> = {};

    /**
     * 最後一次 onDataUpdate / onDiffUpdate 收到的資料（M9）。
     * 供 _shallowDiff() 比較使用；CompositePanel 在呼叫 onDiffUpdate 後自動更新。
     */
    _lastData: unknown = null;

    // ─── M3 Services DI ──────────────────────────────────────────────────────

    /**
     * 由 CompositePanel.registerChildPanel() 在登記後自動注入。
     * 子類透過 this._services.renderer / this._services.virtualizer 取用引擎渲染能力，
     * 不需要直接 import Cocos runtime 元件（H-04 合規）。
     */
    protected _services: PanelServices = {};

    // ─── M7 I18n ─────────────────────────────────────────────────────────────

    /**
     * I18nSystem 實例，由 CompositePanel.registerChildPanel() 透過 PanelServices.i18n 注入。
     * 無需手動設定。
     */
    protected _i18nSystem: I18nSystem | null = null;

    /**
     * 可選：指定此子面板使用的語系。
     * 若設定，則 t() 會嘗試從對應語系查詢（如果已快取），否則回落回 key。
     * 留空則跟隨 I18nSystem 當前全域語系。
     */
    localeOverride?: LocaleCode;

    // ─── M6 動態資源登記 ──────────────────────────────────────────────────────

    /**
     * 動態資源登記 callback，由 CompositePanel 在 registerChildPanel() 時注入。
     * ChildPanel 子類呼叫 registerDynamicAsset() 來回報 runtime 載入的非 spec 宣告資源。
     */
    private _onDynamicAsset: DynamicAssetCallback | null = null;

    /**
     * 注入 PanelServices。由 CompositePanel 呼叫，子類通常不需覆寫。
     */
    setServices(services: PanelServices): void {
        this._services = services;
        if (services.i18n) {
            this._i18nSystem = services.i18n;
        }
    }

    /**
     * 注入動態資源登記 callback（M6）。由 CompositePanel.registerChildPanel() 呼叫。
     */
    setDynamicAssetCallback(cb: DynamicAssetCallback): void {
        this._onDynamicAsset = cb;
    }

    // ─── 建構 ─────────────────────────────────────────────────────────────────

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        this.hostNode    = hostNode;
        this.skinResolver = skinResolver;
        this.binder       = binder;
    }

    // ─── 抽象生命週期 ─────────────────────────────────────────────────────────

    /**
     * 掛載：根據 spec（通常為 fragment 根節點解析後的 spec）初始化子節點。
     * CompositePanel.switchSlot() 在 fragment 建構完成後呼叫此方法。
     * @param spec  fragment spec（Record 形式，避免直接依賴 UILayoutNodeSpec）
     */
    abstract onMount(spec: Record<string, unknown>): Promise<void>;

    /**
     * 資料更新：由 CompositePanel.applyContentState() 驅動。
     * @param data  來自 state[this.dataSource] 的原始資料
     */
    abstract onDataUpdate(data: unknown): void;

    /**
     * 增量資料更新（M9）。
     * 僅在淺比對發現變化時才被呼叫，預設 fallback 到 `onDataUpdate(data)` 以向後相容。
     * 子類可覆寫此方法實作增量刷新邏輯，透過 `changedKeys` 判斷哪些欄位實際改變。
     *
     * @param data        新的完整資料物件
     * @param changedKeys 淺比對後偵測到改變的 key 清單
     */
    onDiffUpdate(data: unknown, changedKeys: string[]): void {   // eslint-disable-line @typescript-eslint/no-unused-vars
        UCUFLogger.info(LogCategory.LIFECYCLE, '[ChildPanelBase] onDiffUpdate → onDataUpdate (default fallback)', {
            panel: this.constructor.name,
            changedKeys,
        });
        this.onDataUpdate(data);
    }

    /**
     * 驗證資料格式。
     * @returns `null` 表示合法；否則回傳錯誤訊息字串。
     */
    abstract validateDataFormat(data: unknown): string | null;

    // ─── 可選鉤子 ─────────────────────────────────────────────────────────────

    /**
     * 登記動態資源（M6）。
     * 子類在 runtime 載入非 spec 宣告的資源時呼叫此方法，
     * 例如根據武將 ID 動態載入立繪 spriteFrame。
     * 資源路徑會透過 callback 回報 CompositePanel._loadedAssetPaths。
     *
     * @param path      資源路徑（相對於 assets/resources/）
     * @param assetType 資源類型（預設 'dynamic'）
     */
    protected registerDynamicAsset(path: string, assetType: AssetRefType = 'dynamic'): void {
        if (this._onDynamicAsset) {
            this._onDynamicAsset(path, assetType);
        }
    }

    /**
     * 卸載：CompositePanel.unmount() 時呼叫。
     * 預設為 no-op；有資源需清理的子類別應覆寫。
     */
    onUnmount(): void { /* no-op */ }

    // ─── M9 diff-update ──────────────────────────────────────────────────────

    /**
     * 淺比對：比較 prev 與 next 的 top-level key，回傳值不同（=== 嚴格比較）的 key 清單。
     * 若 prev/next 任一不是 plain object，回傳空陣列（呼叫方應視為全量更新）。
     *
     * Unity 對照：類似 IEquatable<T>.Equals 的欄位逐一比對，但僅比第一層。
     */
    _shallowDiff(prev: unknown, next: unknown): string[] {
        if (prev === null || typeof prev !== 'object' || Array.isArray(prev)) return [];
        if (next === null || typeof next !== 'object' || Array.isArray(next)) return [];
        const prevObj = prev as Record<string, unknown>;
        const nextObj = next as Record<string, unknown>;
        const changedKeys: string[] = [];
        const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
        for (const key of allKeys) {
            if (prevObj[key] !== nextObj[key]) {
                changedKeys.push(key);
            }
        }
        return changedKeys;
    }

    // ─── M7 I18n helpers ─────────────────────────────────────────────────────

    /**
     * 翻譯查詢 helper。
     * 若已注入 I18nSystem，則委託給它查詢；否則回傳 key 本身（防白畫面）。
     * 子類顯示靜態標籤時應用 `this.t('ui.general.str')` 取代硬編碼中文。
     */
    protected t(key: string, ...args: string[]): string {
        if (!this._i18nSystem) return key;
        return this._i18nSystem.t(key, ...args);
    }

    /**
     * 語系刷新鉤子。
     * CompositePanel 訂閱 I18nSystem.onLocaleChanged 後，會對所有已登記的 ChildPanel 呼叫此方法。
     * 子類應覆寫此方法，重新將所有靜態標籤文字用 `this.t()` 更新。
     */
    protected _refreshLabels(): void { /* 子類覆寫 */ }

    // ─── 工具 ─────────────────────────────────────────────────────────────────

    /**
     * 設定自訂屬性並觸發 onCustomPropChanged 鉤子。
     */
    setCustomProp(key: string, value: unknown): void {
        this.customProps[key] = value;
        this.onCustomPropChanged(key, value);
    }

    /**
     * 自訂屬性變更鉤子。
     * 子類別可覆寫以在屬性改變時驅動視覺更新。
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onCustomPropChanged(_key: string, _value: unknown): void { /* no-op */ }
}
