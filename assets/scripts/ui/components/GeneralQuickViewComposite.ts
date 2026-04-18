// @spec-source → 見 docs/cross-reference-index.md (UCUF Wave 2)
/**
 * GeneralQuickViewComposite — 武將快速檢視卡片（Composite 版）
 * Wave 2 migration from GeneralQuickViewPanel - compact general info popup
 */
import { _decorator, Label, Node, Sprite, tween, UIOpacity } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';
import type { GeneralConfig } from '../../core/models/GeneralUnit';

const { ccclass } = _decorator;

@ccclass('GeneralQuickViewComposite')
export class GeneralQuickViewComposite extends CompositePanel {
    private _binder: UITemplateBinder | null = null;
    private _isMounted = false;
    private _visible = false;

    protected onDestroy(): void {
        this.unmount();
        this._isMounted = false;
    }

    public async show(general: GeneralConfig, position?: { x: number; y: number }): Promise<void> {
        if (!this._isMounted) {
            await this.mount('general-quick-view-screen');
            this._isMounted = true;
        }

        this._populateFromGeneral(general);
        if (position) {
            this.node.setPosition(position.x, position.y, 0);
        }

        this.node.active = true;
        this._visible = true;
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity).to(0.2, { opacity: 255 }).start();
    }

    public hide(): void {
        if (!this._visible) return;
        this._visible = false;
        const opacity = this.node.getComponent(UIOpacity);
        if (opacity) {
            tween(opacity).to(0.15, { opacity: 0 }).call(() => {
                this.node.active = false;
            }).start();
        } else {
            this.node.active = false;
        }
    }

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._binder = binder;
        this.node.on(Node.EventType.TOUCH_END, this.hide, this);
    }

    private _populateFromGeneral(general: GeneralConfig): void {
        if (!this._binder) return;

        this._binder.setTexts({
            NameText: general.name ?? '—',
            TitleText: general.title ?? '',
            FactionText: general.faction ?? '—',
            TemplateText: general.template ?? '—',
            StrText: String(general.str ?? 0),
            IntText: String(general.int ?? 0),
            LeaText: String(general.lea ?? 0),
            PolText: String(general.pol ?? 0),
            ChaText: String(general.cha ?? 0),
            LukText: String(general.luk ?? 0),
        });
    }

    public get isVisible(): boolean { return this._visible; }
}
