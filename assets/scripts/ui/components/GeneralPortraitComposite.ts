// @spec-source → 見 docs/cross-reference-index.md (UCUF Wave 2)
/**
 * GeneralPortraitComposite — 武將立繪顯示面板（Composite 版）
 * Wave 2 migration from GeneralPortraitPanel - displays character portrait/artwork
 */
import { _decorator, Node, Sprite, SpriteFrame, Label, tween, UIOpacity } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';

const { ccclass } = _decorator;

@ccclass('GeneralPortraitComposite')
export class GeneralPortraitComposite extends CompositePanel {
    private _binder: UITemplateBinder | null = null;
    private _isMounted = false;
    private _portraitSprite: Sprite | null = null;
    private _nameLabel: Label | null = null;

    protected onDestroy(): void {
        this.unmount();
        this._isMounted = false;
    }

    public async show(portraitPath: string, generalName: string = ''): Promise<void> {
        if (!this._isMounted) {
            await this.mount('general-portrait-screen');
            this._isMounted = true;
        }

        await this._loadAndDisplayPortrait(portraitPath, generalName);

        this.node.active = true;
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity).to(0.25, { opacity: 255 }).start();
    }

    public hide(): void {
        const opacity = this.node.getComponent(UIOpacity);
        if (opacity) {
            tween(opacity).to(0.2, { opacity: 0 }).call(() => {
                this.node.active = false;
            }).start();
        } else {
            this.node.active = false;
        }
    }

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._binder = binder;
        this._portraitSprite = binder.getSprite('PortraitImage');
        this._nameLabel = binder.getLabel('GeneralNameLabel');
    }

    private async _loadAndDisplayPortrait(path: string, name: string): Promise<void> {
        try {
            const frame = await services().resource.loadSpriteFrame(path);
            if (frame && this._portraitSprite) {
                this._portraitSprite.spriteFrame = frame;
            }
        } catch (e) {
            console.warn(`[GeneralPortraitComposite] Failed to load portrait: ${path}`, e);
        }

        if (this._nameLabel) {
            this._nameLabel.string = name;
        }
    }
}
