// @spec-source → 見 docs/cross-reference-index.md
/**
 * {{PanelClassName}} — fullscreen-result family Panel（Phase F 自動生成骨架）
 *
 * 適用場景：戰鬥結算頁面、獲得武將、抽卡結果等全螢幕結果展示。
 *
 * Unity 對照：MonoBehaviour，繼承 UIPreviewBuilder（= Prefab + Inspector 自動連結）
 *
 * ⚠️ 本檔案由 scaffold-ui-component.js 自動生成，請在 onReady 中填充業務邏輯。
 *
 * Content Contract：fullscreen-result-content（schemaId）
 *   - 必填：resultType, titleKey, descKey
 *   - 可選：confirmKey（預設 common.confirm）
 *   - 參見：assets/resources/ui-spec/contracts/fullscreen-result-content.schema.json
 */

import { _decorator } from 'cc';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { UIContentBinder } from '../core/UIContentBinder';
import type { ContentContractRef } from '../core/UISpecTypes';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

/** 結果類型（對應 fullscreen-result-content schema 的 resultType 枚舉） */
type ResultType = 'win' | 'lose' | 'draw' | 'acquire';

/** Content Contract 宣告 */
const CONTRACT: ContentContractRef = {
    schemaId: 'fullscreen-result-content',
    familyId: 'fullscreen-result',
    requiredFields: ['resultType', 'titleKey', 'descKey'],
};

@ccclass('{{PanelClassName}}')
export class {{PanelClassName}} extends UIPreviewBuilder {

    private _contentData: Record<string, unknown> = {};
    private readonly _contentBinder = new UIContentBinder();
    private _onDismiss: (() => void) | null = null;

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

        // ── 2. resultType 視覺主題切換 ────────────────────────────────────────
        // TODO: 根據 resultType 更換 skin 或播放進場動畫
        //
        // 範例：
        // const resultType = this._contentData.resultType as ResultType;
        // switch (resultType) {
        //     case 'win':     this._applyWinTheme(binder); break;
        //     case 'lose':    this._applyLoseTheme(binder); break;
        //     case 'draw':    this._applyDrawTheme(binder); break;
        //     case 'acquire': this._applyAcquireTheme(binder); break;
        // }

        // ── 3. 確認按鈕 ───────────────────────────────────────────────────────
        // TODO: 綁定確認/繼續按鈕
        // const btnConfirm = binder.getButton('BtnConfirm');
        // btnConfirm?.node.on('click', () => {
        //     this._onDismiss?.();
        //     services().ui.close(UIID.{{uiId}});
        // }, this);
    }

    // ─── 公開 API ─────────────────────────────────────────────────────────────

    public setContentData(data: Record<string, unknown>): void {
        this._contentData = data;
    }

    public setOnDismiss(callback: () => void): void {
        this._onDismiss = callback;
    }
}
