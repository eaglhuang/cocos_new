// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Label, Button, Sprite, SpriteFrame, Color, Texture2D, resources } from 'cc';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

export interface GeneralPortraitConfig {
    id: string; 
    templateId: string;
    title: string; 
    name: string; 
    gender: string; 
    age: number;
    vitality: number; 
    maxVitality: number;
    role: string;
    stats: { str: number; int: number; lea: number; pol: number; cha: number; luk: number };
    coreTags: string[];
    portraitPath?: string; // e.g. "sprites/generals/zhang_fei/spriteFrame"
}

@ccclass('GeneralPortraitPanel')
export class GeneralPortraitPanel extends UIPreviewBuilder {

    public onClose: (() => void) | null = null;
    private get _specLoader() { return services().specLoader; }
    private _isBuilt = false;

    public async show(config: GeneralPortraitConfig): Promise<void> {
        this.node.active = true;
        
        if (!this._isBuilt) {
            const layout = await this._specLoader.loadLayout('general-portrait-main');
            const skin = await this._specLoader.loadSkin('general-portrait-default');
            const i18n = await this._specLoader.loadI18n('zh-TW');
            const tokens = await this._specLoader.loadDesignTokens();
            
            await this.buildScreen(layout, skin, i18n, tokens);
            this._isBuilt = true;

            const btnClose = this.node.getChildByPath('GeneralPortraitRoot/InfoPanel/BtnClose');
            if (btnClose) {
                const btn = btnClose.getComponent(Button) || btnClose.addComponent(Button);
                btn.node.on(Button.EventType.CLICK, this.hide, this);
            }

            const overlay = this.node.getChildByPath('GeneralPortraitRoot/Overlay');
            if (overlay) {
                const btn = overlay.getComponent(Button) || overlay.addComponent(Button);
                btn.node.on(Button.EventType.CLICK, this.hide, this);
            }
        }

        this._populateUI(config);
        
        this.playEnterTransition(this.node.getChildByName('GeneralPortraitRoot')!);
    }

    public hide(): void {
        this.playExitTransition(this.node.getChildByName('GeneralPortraitRoot')!, undefined, () => {
            this.node.active = false;
            if (this.onClose) this.onClose();
        });
    }

    private _populateUI(config: GeneralPortraitConfig): void {
        const infoPath = 'InfoPanel/';
        
        const roleDisplay = config.role === 'Combat' ? '戰鬥武將' : '專業教官';
        this._setLabel(`${infoPath}HeaderContent/TitleText`, config.title);
        this._setLabel(`${infoPath}HeaderContent/NameText`, config.name);
        this._setLabel(`${infoPath}HeaderContent/AgeRoleText`, `${config.age}歲 | ${roleDisplay}`);
        
        this._setLabel(`${infoPath}VitalityBox/VitValue`, `${config.vitality} / ${config.maxVitality}`);
        
        // Stats
        this._setLabel(`${infoPath}StatsBox/StatStr`, `武力: ${config.stats.str}`);
        this._setLabel(`${infoPath}StatsBox/StatInt`, `智力: ${config.stats.int}`);
        this._setLabel(`${infoPath}StatsBox/StatLea`, `統率: ${config.stats.lea}`);
        this._setLabel(`${infoPath}StatsBox/StatPol`, `政治: ${config.stats.pol}`);
        this._setLabel(`${infoPath}StatsBox/StatCha`, `魅力: ${config.stats.cha}`);
        this._setLabel(`${infoPath}StatsBox/StatLuk`, `運氣: ${config.stats.luk}`);

        // Tags
        this._setLabel(`${infoPath}TagsBox/TagsValue`, config.coreTags.join(' / '));

        // 如果傳入了明確的頭像路徑，嘗試動態載入 SpriteFrame
        if (config.portraitPath) {
            this._loadPortrait(config.portraitPath);
        }
    }

    private async _loadPortrait(path: string): Promise<void> {
        const fullPath = `GeneralPortraitRoot/PortraitImage`;
        const n = this.node.getChildByPath(fullPath);
        if (!n) return;

        try {
            // 優先嘗試正式的 SpriteFrame 路徑
            let spriteFrame = await services().resource.loadSpriteFrame(path).catch(() => null);
            
            if (!spriteFrame) {
                // 退回策略：它可能只是一個普通的 Texture2D (Cocos 預設匯入型別)
                const texPath = path.replace('/spriteFrame', '');
                spriteFrame = await new Promise<SpriteFrame>((resolve) => {
                    resources.load(texPath, Texture2D, (err, tex) => {
                        if (tex) {
                            const sf = new SpriteFrame();
                            sf.texture = tex;
                            resolve(sf);
                        } else {
                            resolve(null as any);
                        }
                    });
                });
            }

            if (spriteFrame) {
                const sprite = n.getComponent(Sprite) || n.addComponent(Sprite);
                sprite.spriteFrame = spriteFrame;
                sprite.sizeMode = Sprite.SizeMode.RAW; // ⭐️ 使用原始大小，不被 Layout 無腦拉伸變形
            } else {
                console.warn(`[GeneralPortraitPanel] 無法載入立繪: ${path}，請檢查檔案是否存在於 resources 中。`);
            }
        } catch (e) {
            console.warn('[GeneralPortraitPanel] 載入立繪時發生意外:', e);
        }
    }

    private _setLabel(path: string, text: string): void {
        const fullPath = `GeneralPortraitRoot/${path}`;
        const n = this.node.getChildByPath(fullPath);
        if (!n) return;
        const lbl = n.getComponent(Label);
        if (lbl) lbl.string = text;
    }
}
