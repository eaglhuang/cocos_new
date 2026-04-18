// @spec-source → 見 docs/cross-reference-index.md
/**
 * {{PanelClassName}} — composite-panel family Panel（M10 scaffold --ucuf 自動生成骨架）
 *
 * 適用場景：具有多個 lazySlot 子區域、需要按需載入 Fragment、且有 Content Contract 的複合面板。
 *
 * Unity 對照：MonoBehaviour，繼承 CompositePanel（≈ 支援 lazySlot 的 Prefab 根組件）
 *
 * ⚠️ 本檔案由 scaffold-ui-component.js --ucuf 自動生成；請在 _onAfterBuildReady 中填充業務邏輯。
 *    不要手改 SCREEN_ID 宣告；請透過 UIConfig 管理入口。
 *
 * Content Contract：{{familyId}}-content（schemaId）
 *   - 必填：請參見 assets/resources/ui-spec/contracts/{{screenId}}-content.schema.json
 */

import { _decorator } from 'cc';
import { CompositePanel } from '../core/CompositePanel';
import type { ChildPanelBase } from '../core/ChildPanelBase';
import type { UITemplateBinder } from '../core/UITemplateBinder';
import type { ContentContractRef } from '../core/UISpecTypes';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

/** Content Contract 宣告（與 screen spec 中 contentRequirements 對應） */
const CONTRACT: ContentContractRef = {
    schemaId: '{{familyId}}-content',
    familyId: '{{familyId}}',
    requiredFields: [], // TODO: 根據 {{screenId}}-content.schema.json 填入必填欄位
};

@ccclass('{{PanelClassName}}')
export class {{PanelClassName}} extends CompositePanel {

    // ── Screen ID（對應 screen spec 的 id，由 mount() 傳入）──────────────────
    private static readonly SCREEN_ID = '{{screenId}}';

    // ── 子面板實例（各 slotId 對應的 ChildPanel）────────────────────────────
    // TODO: 宣告並初始化各 ChildPanel，例如：
    // private readonly _overviewChild = new ExampleOverviewChild();

    // ── 是否已掛載 ────────────────────────────────────────────────────────────
    private _isMounted = false;

    // ─── 公開 API — 入口 ─────────────────────────────────────────────────────

    /**
     * 顯示此面板並載入資料。
     * 外部呼叫者（UI Manager / 路由系統）傳入 data，Panel 負責掛載 + 渲染。
     *
     * Unity 對照：相當於 MonoBehaviour.OnEnable() + 注入 ViewModel
     */
    public async show(data: Record<string, unknown>): Promise<void> {
        if (!this._isMounted) {
            await this.mount({{PanelClassName}}.SCREEN_ID);
            this._isMounted = true;
        }
        this.node.active = true;
        // TODO: 將 data 傳入各 ChildPanel，例如：
        // this._overviewChild.setData(data);
        await this.applyContentState(data);
    }

    /** 隱藏面板（不銷毀，保留 lazySlot 快取） */
    public hide(): void {
        this.node.active = false;
    }

    // ─── 生命週期覆寫 — buildScreen 完成後觸發 ──────────────────────────────

    /**
     * 所有 slot 建置完成後的初始化鉤子。
     * 在此登記 ChildPanel 並綁定靜態事件。
     *
     * Unity 對照：MonoBehaviour.Start()，此時 Prefab 節點已全部就緒。
     */
    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        // ── 1. 登記 ChildPanel（每個 lazySlot 都需要一個 ChildPanel）──────────
        // TODO: 替換為實際的 ChildPanel 子類，例如：
        // this.registerChildPanel('SlotMain',    this._overviewChild);
        // this.registerChildPanel('SlotSidebar', this._sidebarChild);

        // ── 2. 繫結靜態 UI 元件事件 ──────────────────────────────────────────
        // TODO: 綁定關閉按鈕、工具列等靜態元件，例如：
        // const btnClose = binder.getButton('BtnClose');
        // btnClose?.node.on('click', () => services().ui.close('{{screenId}}'), this);

        // ── 3. 分頁切換（若有 tabRouting）────────────────────────────────────
        // TODO: 動態建立分頁按鈕並呼叫 this.switchTab(tabKey)，例如：
        // const tabKeys = ['TabA', 'TabB'];
        // tabKeys.forEach(key => {
        //     const btn = binder.getButton(`Btn${key}`);
        //     btn?.node.on('click', () => this.switchTab(key), this);
        // });
    }

    // ─── 事件監聽（slot 切換通知）────────────────────────────────────────────

    /**
     * （可選）在 _onAfterBuildReady 內呼叫 this.onSlotEvent 訂閱 slot 切換完成事件，
     * 進行後處理（例如更新頁碼指示器）。
     * Unity 對照：UnityEvent.AddListener()
     *
     * 範例用法（加入 _onAfterBuildReady 中）：
     * this.onSlotEvent('slot:switched', ({ slotId, fragmentId }) => {
     *     // 根據 slotId / fragmentId 更新對應的 indicator 或狀態
     * });
     */
}
