// @spec-source → 見 docs/cross-reference-index.md (UCUF Wave 2)
/**
 * UltimateSelectPopupComposite — 奧義選擇小窗（Composite 版）
 * Wave 2 migration from UltimateSelectPopup + Template-driven composition
 */
import { _decorator, Button, Label, Layout, Node, tween, UIOpacity, ScrollView } from 'cc';
import { EVENT_NAMES } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';

const { ccclass, property } = _decorator;

export interface UltimateSkillItem {
    skillId: string;
    label: string;
    costSp: number;
}

@ccclass('UltimateSelectPopupComposite')
export class UltimateSelectPopupComposite extends CompositePanel {
    @property(ScrollView)
    scrollView: ScrollView | null = null;

    private _binder: UITemplateBinder | null = null;
    private _skillItems: UltimateSkillItem[] = [];
    private _anchorNode: Node | null = null;
    private _isMounted = false;

    protected onDestroy(): void {
        this.unmount();
        this._isMounted = false;
    }

    public async show(skills: UltimateSkillItem[], anchorNode?: Node): Promise<void> {
        if (!this._isMounted) {
            await this.mount('ultimate-select-popup-screen');
            this._isMounted = true;
        }

        this._skillItems = skills;
        this._anchorNode = anchorNode;
        this._buildSkillButtons(skills);

        this.node.active = true;
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity).to(0.12, { opacity: 255 }).start();
    }

    public hide(): void {
        const opacity = this.node.getComponent(UIOpacity);
        if (opacity) {
            tween(opacity).to(0.1, { opacity: 0 }).call(() => {
                this.node.active = false;
            }).start();
        } else {
            this.node.active = false;
        }
    }

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._binder = binder;
        if (!this.scrollView) {
            this.scrollView = binder.getScrollView('scrollView') ?? null;
        }
        binder.getButton('closeBtn')?.node.on(Button.EventType.CLICK, this.hide, this);
        binder.getNode('OverlayMask')?.on(Node.EventType.TOUCH_END, this.hide, this);
    }

    private _buildSkillButtons(skills: UltimateSkillItem[]): void {
        if (!this._binder) return;
        const itemsNode = this._binder.getNode('SkillItems');
        if (!itemsNode) return;
        itemsNode.removeAllChildren();

        for (const skill of skills) {
            const btn = new Node(`Skill_${skill.skillId}`);
            btn.parent = itemsNode;
            const label = btn.addComponent(Label);
            label.string = `${skill.label} (SP ${skill.costSp})`;
            btn.on(Node.EventType.TOUCH_END, () => {
                services().event.emit(EVENT_NAMES.UltimateSkillSelected, { skillId: skill.skillId });
                this.hide();
            });
        }
    }
}
