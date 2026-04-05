// @spec-source → 見 docs/cross-reference-index.md
import { _decorator } from 'cc';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

/**
 * StyleCheckPanel — UI 風格全家桶驗證面板
 * 用於快速預覽 Design Tokens v2.2 在不同解析度下的呈現效果。
 */
@ccclass('StyleCheckPanel')
export class StyleCheckPanel extends UIPreviewBuilder {
    private get _specLoader() { return services().specLoader; }

    async onLoad(): Promise<void> {
        // 1. 載入規格
        const layout = await this._specLoader.loadLayout('style-check-main');
        const skin   = await this._specLoader.loadSkin('style-check-default');
        const i18n   = await this._specLoader.loadI18n(services().i18n.currentLocale);
        const tokens = await this._specLoader.loadDesignTokens();

        // 2. 建構畫面
        await this.buildScreen(layout, skin, i18n, tokens);

    }

    protected onReady(_binder: UITemplateBinder): void {
        console.log('[StyleCheck] 驗證畫面建構完成');
    }
}
