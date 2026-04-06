// @spec-source → 見 docs/cross-reference-index.md
/**
 * {{PanelClassName}} — dialog-card family Panel（Phase F 自動生成骨架）
 *
 * 適用場景：確認對話框、提示訊息框、選擇框等互動彈窗。
 *
 * Unity 對照：MonoBehaviour，繼承 UIPreviewBuilder（= Prefab + Inspector 自動連結）
 *
 * ⚠️ 本檔案由 scaffold-ui-component.js 自動生成，請在 onReady 中填充業務邏輯。
 *
 * Content Contract：dialog-card-content（schemaId）
 *   - 必填：titleKey, bodyKey, primaryKey
 *   - 參見：assets/resources/ui-spec/contracts/dialog-card-content.schema.json
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
    schemaId: 'dialog-card-content',
    familyId: 'dialog-card',
    requiredFields: ['titleKey', 'bodyKey', 'primaryKey'],
};

@ccclass('{{PanelClassName}}')
export class {{PanelClassName}} extends UIPreviewBuilder {

    private _contentData: Record<string, unknown> = {};
    private readonly _contentBinder = new UIContentBinder();

    /** 主要行動回調（confirm） */
    private _onConfirm: (() => void) | null = null;
    /** 次要行動回調（cancel / dismiss） */
    private _onCancel: (() => void) | null = null;

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

        // ── 2. 主要按鈕（Confirm）────────────────────────────────────────────
        // TODO: 綁定確認按鈕
        // const btnPrimary = binder.getButton('BtnPrimary');
        // btnPrimary?.node.on('click', () => {
        //     this._onConfirm?.();
        //     services().ui.close(UIID.{{uiId}});
        // }, this);

        // ── 3. 次要按鈕（Cancel / 可選）──────────────────────────────────────
        // TODO: 綁定取消按鈕（若 secondaryKey 不存在則隱藏）
        // const btnSecondary = binder.getButton('BtnSecondary');
        // if (btnSecondary) {
        //     const hasSecondary = !!this._contentData.secondaryKey;
        //     btnSecondary.node.active = hasSecondary;
        //     if (hasSecondary) {
        //         btnSecondary.node.on('click', () => {
        //             this._onCancel?.();
        //             services().ui.close(UIID.{{uiId}});
        //         }, this);
        //     }
        // }
    }

    // ─── 公開 API ─────────────────────────────────────────────────────────────

    public setContentData(data: Record<string, unknown>): void {
        this._contentData = data;
    }

    public setCallbacks(onConfirm: () => void, onCancel?: () => void): void {
        this._onConfirm = onConfirm;
        this._onCancel = onCancel ?? null;
    }
}
