// @spec-source → 見 docs/cross-reference-index.md
import { _decorator } from 'cc';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { services } from '../../core/managers/ServiceLoader';
import { UITemplateBinder } from '../core/UITemplateBinder';

const { ccclass, property } = _decorator;

/**
 * UIScreenPreviewHost — 供 Editor / QA 使用的 screen-driven 預覽掛載點。
 *
 * Unity 對照：相當於一個專門 Instantiate UI Prefab Variant 的 PreviewBootstrap，
 * 讓 QA 驗的是 JSON 契約建出的最終畫面，而不是 legacy 手刻版本。
 */
@ccclass('UIScreenPreviewHost')
export class UIScreenPreviewHost extends UIPreviewBuilder {
    @property({ tooltip: '預覽時使用的語系檔，預設 zh-TW。' })
    public locale = 'zh-TW';

    private get _specLoader() { return services().specLoader; }
    private _currentScreenId = '';
    private _isLoading = false;
    private _binder: UITemplateBinder | null = null;

    public get binder(): UITemplateBinder | null {
        return this._binder;
    }

    public async showScreen(screenId: string): Promise<void> {
        if (!screenId) {
            console.warn('[UIScreenPreviewHost] screenId 為空，略過載入');
            return;
        }

        if (this._isLoading) {
            console.warn(`[UIScreenPreviewHost] 正在載入中，略過重複請求: ${screenId}`);
            return;
        }

        if (this._currentScreenId === screenId && this.node.children.length > 0) {
            console.log(`[UIScreenPreviewHost] screen 已掛載，略過重建: ${screenId}`);
            return;
        }

        this._isLoading = true;
        try {
            this._destroyBuiltChildren();

            const { screen, layout, skin } = await this._specLoader.loadFullScreen(screenId);
            const i18n = await this._specLoader.loadI18n(this.locale);
            const tokens = await this._specLoader.loadDesignTokens();

            await this.buildScreen(layout, skin, i18n, tokens);
            this._currentScreenId = screenId;

            console.log(`[UIScreenPreviewHost] mounted ${screenId} -> ${screen.uiId}`);
        } catch (error) {
            console.error(`[UIScreenPreviewHost] 載入 screen 失敗: ${screenId}`, error);
            throw error;
        } finally {
            this._isLoading = false;
        }
    }

    private _destroyBuiltChildren(): void {
        this._binder = null;
        const children = [...this.node.children];
        for (const child of children) {
            child.destroy();
        }
    }

    protected onReady(binder: UITemplateBinder): void {
        this._binder = binder;
    }
}