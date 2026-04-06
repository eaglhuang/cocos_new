// @spec-source → 見 docs/cross-reference-index.md
/**
 * {{PanelClassName}} — detail-split family Panel（Phase F 自動生成骨架）
 *
 * 適用場景：武將詳情、血脈命鏡、精銳兵典等具有多分頁結構的詳情頁面。
 *
 * Unity 對照：MonoBehaviour，繼承 UIPreviewBuilder（= Prefab + Inspector 自動連結）
 *
 * ⚠️ 本檔案由 scaffold-ui-component.js 自動生成，請在 onReady 中填充業務邏輯。
 *    不要手改 Screen ID 宣告（__SCREEN_ID__）；請透過 UIConfig 管理入口。
 *
 * Content Contract：detail-split-content（schemaId）
 *   - 必填：titleKey, tabs
 *   - 參見：assets/resources/ui-spec/contracts/detail-split-content.schema.json
 */

import { _decorator } from 'cc';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { UIContentBinder } from '../core/UIContentBinder';
import type { ContentContractRef } from '../core/UISpecTypes';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

/** Content Contract 宣告（與 screen spec 中 contentRequirements 對應） */
const CONTRACT: ContentContractRef = {
    schemaId: 'detail-split-content',
    familyId: 'detail-split',
    requiredFields: ['titleKey', 'tabs'],
};

@ccclass('{{PanelClassName}}')
export class {{PanelClassName}} extends UIPreviewBuilder {

    // ── 初始化時從外部注入 / 或透過路由參數傳入 ──────────────────────────────

    /** 依 screen spec 規格傳入的內容資料（titleKey / tabs 等） */
    private _contentData: Record<string, unknown> = {};

    /** Content Binder 實例 */
    private readonly _contentBinder = new UIContentBinder();

    // ─── Screen ID ───────────────────────────────────────────────────────────

    /** 對應 screen spec 的 id，用於 UISpecLoader 查詢 */
    private static readonly SCREEN_ID = '{{screenId}}';

    // ─── 生命週期（onLoad → buildScreen → onReady）──────────────────────────

    protected async onLoad(): Promise<void> {
        try {
            const loader = services().specLoader;
            const screen = await loader.loadScreenSpec({{PanelClassName}}.SCREEN_ID);
            const layout = await loader.loadLayoutSpec(screen.layout);
            const skin = await loader.loadSkinManifest(screen.skin);
            const i18n = await services().i18n.loadLocale(services().i18n.currentLocale);
            const tokens = await loader.loadDesignTokens();

            await this.buildScreen(layout, skin, i18n, tokens);
        } catch (e) {
            console.error(`[{{PanelClassName}}] 初始化失敗：`, e);
        }
    }

    /**
     * buildScreen 完成後自動呼叫。
     * 在此處完成業務邏輯初始化：數據綁定、事件監聽、初始狀態設定。
     *
     * Unity 對照：MonoBehaviour.Start()，此時所有 SerializeField 已就緒。
     */
    protected override onReady(binder: UITemplateBinder): void {
        // ── 1. 驗證並注入 Content Contract ───────────────────────────────────
        const { valid, missing } = this._contentBinder.validate(CONTRACT, this._contentData);
        if (!valid) {
            console.warn(`[{{PanelClassName}}] Content Contract 缺少必填欄位：${missing.join(', ')}`);
        }
        this._contentBinder.bind(binder, CONTRACT, this._contentData);

        // ── 2. 分頁切換邏輯（detail-split 核心功能）──────────────────────────
        // TODO: 依 this._contentData.tabs 陣列動態建立分頁按鈕邏輯
        //
        // 範例：
        // const tabs = this._contentData.tabs as string[];
        // tabs.forEach((tabId, index) => {
        //     const btn = binder.getButton(`BtnTab${index}`);
        //     btn?.node.on('click', () => this._switchTab(index, binder), this);
        // });

        // ── 3. 底部關閉按鈕 ───────────────────────────────────────────────────
        // TODO: 綁定關閉按鈕
        // const btnClose = binder.getButton('BtnClose');
        // btnClose?.node.on('click', () => services().ui.close(UIID.{{uiId}}), this);
    }

    // ─── 公開 API（供外部注入資料）──────────────────────────────────────────

    /** 設定內容資料（在 openAsync 之前，或透過路由參數傳入） */
    public setContentData(data: Record<string, unknown>): void {
        this._contentData = data;
    }
}
