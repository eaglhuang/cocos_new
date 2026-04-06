// @spec-source → 見 docs/cross-reference-index.md
/**
 * {{PanelClassName}} — rail-list family Panel（Phase F 自動生成骨架）
 *
 * 適用場景：武將列表、商城商品列表、戰報條目列表等捲動列表頁面。
 *
 * Unity 對照：MonoBehaviour，繼承 UIPreviewBuilder（= Prefab + Inspector 自動連結）
 *
 * ⚠️ 本檔案由 scaffold-ui-component.js 自動生成，請在 onReady 中填充業務邏輯。
 *
 * Content Contract：rail-list-content（schemaId）
 *   - 必填：titleKey, railItems
 *   - 參見：assets/resources/ui-spec/contracts/rail-list-content.schema.json
 */

import { _decorator } from 'cc';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { UIContentBinder } from '../core/UIContentBinder';
import type { ContentContractRef } from '../core/UISpecTypes';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

/** Content Contract 宣告 */
const CONTRACT: ContentContractRef = {
    schemaId: 'rail-list-content',
    familyId: 'rail-list',
    requiredFields: ['titleKey', 'railItems'],
};

@ccclass('{{PanelClassName}}')
export class {{PanelClassName}} extends UIPreviewBuilder {

    private _contentData: Record<string, unknown> = {};
    private readonly _contentBinder = new UIContentBinder();

    private static readonly SCREEN_ID = '{{screenId}}';

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
     * Unity 對照：MonoBehaviour.Start()
     */
    protected override onReady(binder: UITemplateBinder): void {
        // ── 1. Content Contract 驗證與注入 ────────────────────────────────────
        const { valid, missing } = this._contentBinder.validate(CONTRACT, this._contentData);
        if (!valid) {
            console.warn(`[{{PanelClassName}}] Content Contract 缺少必填欄位：${missing.join(', ')}`);
        }
        this._contentBinder.bind(binder, CONTRACT, this._contentData);

        // ── 2. 列表項目渲染 ───────────────────────────────────────────────────
        // TODO: 依 this._contentData.railItems 動態填充列表項目
        //
        // 範例：
        // const items = this._contentData.railItems as Array<{ id: string; name: string }>;
        // const scrollView = binder.getScrollView('ListScrollView');
        // items.forEach((item, index) => {
        //     // 建立列表卡片節點並加入 scrollView.content
        // });

        // ── 3. 空清單狀態 ──────────────────────────────────────────────────────
        // TODO: 若 railItems 為空，顯示 emptyState
        // const items = this._contentData.railItems as unknown[];
        // const emptyState = binder.getNode('EmptyState');
        // if (emptyState) emptyState.active = items.length === 0;

        // ── 4. 排序列（可選）───────────────────────────────────────────────────
        // TODO: 若 sortOptions 存在則渲染排序按鈕
        // const sortBar = binder.getNode('SortBar');
        // if (sortBar) sortBar.active = !!this._contentData.sortOptions;

        // ── 5. 關閉按鈕 ───────────────────────────────────────────────────────
        // TODO: 綁定關閉按鈕
        // const btnClose = binder.getButton('BtnClose');
        // btnClose?.node.on('click', () => services().ui.close(UIID.{{uiId}}), this);
    }

    // ─── 公開 API ─────────────────────────────────────────────────────────────

    public setContentData(data: Record<string, unknown>): void {
        this._contentData = data;
    }
}
