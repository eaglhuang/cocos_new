// @spec-source → 見 docs/cross-reference-index.md
/**
 * UltimateSelectPopup — 奧義選擇小窗 (v3-6)
 *
 * 職責：
 *   1. SP 滿時由 ActionCommandPanel 呼叫 show(skills)，顯示可選奧義列表
 *   2. 點擊某一項 → emit EVENT_NAMES.UltimateSkillSelected { skillId } → 關閉小窗
 *   3. 點擊小窗外部 → 關閉不發動
 *   4. 使用 dialog-select Template 驅動排版（不含視覺排版硬碼）
 *
 * 觸發鏈：
 *   ActionCommandPanel._onUltimateClick()
 *   → UltimateSelectPopup.show(skills)
 *   → 玩家點擊某技能
 *   → services().event.emit(UltimateSkillSelected, { skillId })
 *   → BattleController 執行奧義
 *
 * Unity 對照：UltimateSkillSelectPopup（SkillSelectUI.cs — SetActive(true) + 填入技能列表）
 *
 * 設計規格：docs/主戰場UI規格書.md §4.4
 * Template：dialog-select（assets/resources/ui-spec/templates/dialog-select.json）
 */
import { _decorator, Button, Color, Label, Layout, Node, tween, UIOpacity, UITransform, Vec3, ScrollView } from 'cc';
import { EVENT_NAMES } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { UITemplateResolver } from '../core/UITemplateResolver';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { SolidBackground } from './SolidBackground';

const { ccclass, property } = _decorator;

/** 奧義技能項目 */
export interface UltimateSkillItem {
    /** 技能 ID（對應 skills.json） */
    skillId: string;
    /** 顯示名稱 */
    label: string;
    /** SP 消耗（通常 = maxSp） */
    costSp: number;
}

@ccclass('UltimateSelectPopup')
export class UltimateSelectPopup extends UIPreviewBuilder {

    private get _specLoader() { return services().specLoader; }
    private readonly _resolver    = new UITemplateResolver();
    private _binder: UITemplateBinder | null = null;
    private _isBuilt   = false;
    private _skillItems: UltimateSkillItem[] = [];
    private _rootNode: Node | null = null;
    private _dialogCard: Node | null = null;
    private _scrollPanel: Node | null = null;
    private _scrollView: ScrollView | null = null;
    private _anchorNode: Node | null = null;
    /** show() 在 build 完成前若被呼叫，暫存技能列表，onReady 後自動重播 */
    private _pendingSkills: UltimateSkillItem[] | null = null;

    // ── 生命週期 ─────────────────────────────────────────────

    async onLoad(): Promise<void> {
        this.node.active = false;
        await this._build();
    }

    private async _build(): Promise<void> {
        if (this._isBuilt) return;
        try {
            const [template, skin, i18n] = await Promise.all([
                this._specLoader.loadTemplate('dialog-select'),
                this._specLoader.loadSkin('dialog-select-default'),
                this._specLoader.loadI18n(services().i18n.currentLocale),
            ]);
            const layout = await this._resolver.resolve(template, {
                title: 'UI_ULTIMATE_TITLE',
                width:  220,
                height: 280,
            });
            await this.buildScreen(layout, skin, i18n);
            this._isBuilt = true;
        } catch (e) {
            console.warn('[UltimateSelectPopup] Template 載入失敗，使用白模', e);
            this._isBuilt = true;
        }
    }

    protected onBuildComplete(rootNode: Node): void {
        this._rootNode = rootNode;
    }

    protected onReady(binder: UITemplateBinder): void {
        this._binder = binder;
        this._dialogCard = binder.getNode('DialogCard');
        this._scrollPanel = binder.getNode('ScrollPanel');
        this._scrollView = binder.getScrollView('scrollView') ?? binder.getScrollView('ScrollView');

        // 關閉按鈕（面板 header 的 × 或 footer cancel）
        binder.getButton('closeBtn')?.node.on(Button.EventType.CLICK, this.hide, this);

        const primaryBtn = binder.getButton('btnPrimary');
        const secondaryBtn = binder.getButton('btnSecondary') ?? primaryBtn;
        if (primaryBtn && primaryBtn !== secondaryBtn) {
            primaryBtn.node.active = false;
        }
        if (secondaryBtn) {
            this._setButtonLabel(secondaryBtn, '取消');
            secondaryBtn.node.on(Button.EventType.CLICK, this.hide, this);
        }

        // 背景遮罩點擊 → 關閉
        binder.getNode('OverlayMask')?.on(Node.EventType.TOUCH_END, this.hide, this);

        // 若 show() 在 build 完成前被呼叫，在此重播
        if (this._pendingSkills !== null) {
            const skills = this._pendingSkills;
            this._pendingSkills = null;
            this.show(skills);
        }

        console.log('[UltimateSelectPopup] onReady — binder 就緒');
    }

    // ── 公開 API ─────────────────────────────────────────────

    /**
     * 填入技能列表並顯示小窗。
     * @param skills 可選奧義列表（由 ActionCommandPanel 從 GeneralUnit.skillId 組裝）
     *
     * Unity 對照：UltimateSkillSelectPopup.Show(SkillData[] skills)
     */
    show(skills: UltimateSkillItem[], anchorNode?: Node): void {
        // build 尚未完成 → 暫存，onReady 後自動重播（消除 addComponent 後立即呼叫的競態）
        if (!this._binder) {
            this._pendingSkills = skills;
            this._anchorNode = anchorNode ?? null;
            this.node.active = true;          // 觸發 Cocos 呼叫 onLoad → _build → onReady
            return;
        }

        this._skillItems = skills;
        this._anchorNode = anchorNode ?? this._anchorNode;
        this._buildSkillButtons(skills);
        this._resizePopup(skills.length);

        this.node.active = true;
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        opacity.opacity = 0;
        this._positionAboveAnchor();
        tween(opacity).to(0.12, { opacity: 255 }).start();
    }

    hide(): void {
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        tween(opacity)
            .to(0.10, { opacity: 0 })
            .call(() => { this.node.active = false; })
            .start();
    }

    // ── 內部實作 ─────────────────────────────────────────────

    /**
     * 動態建立每個技能按鈕。
     * 因為 dialog-select 的 scroll-panel 是靜態結構，我們直接在 ScrollContent 節點下建立子按鈕。
     *
     * Unity 對照：Instantiate(skillItemPrefab, contentParent) per skill
     */
    private _buildSkillButtons(skills: UltimateSkillItem[]): void {
        const contentNode = this._scrollView?.content ?? this._binder?.getNode('Content');
        if (!contentNode) {
            console.warn('[UltimateSelectPopup] ScrollContent 節點未找到，技能按鈕無法建立');
            return;
        }

        // 清除舊按鈕
        contentNode.removeAllChildren();
        this._ensureVerticalLayout(contentNode);

        skills.forEach((skill) => {
            const rowNode = new Node(`SkillBtn_${skill.skillId}`);
            rowNode.layer = contentNode.layer;
            rowNode.parent = contentNode;

            const rowTransform = rowNode.addComponent(UITransform);
            rowTransform.setContentSize(200, 48);

            const background = rowNode.addComponent(SolidBackground);
            background.color = new Color(26, 32, 42, 216);

            const button = rowNode.addComponent(Button);
            button.target = rowNode;

            const rowLayout = rowNode.addComponent(Layout);
            rowLayout.type = Layout.Type.HORIZONTAL;
            rowLayout.spacingX = 8;
            rowLayout.paddingLeft = 12;
            rowLayout.paddingRight = 12;
            rowLayout.paddingTop = 8;
            rowLayout.paddingBottom = 8;
            rowLayout.resizeMode = Layout.ResizeMode.NONE;

            const iconNode = this._createSkillLabel(rowNode, `Icon_${skill.skillId}`, 32, this._iconForSkill(skill.skillId), 18, new Color(212, 175, 55, 255));
            iconNode.getComponent(Label)!.horizontalAlign = Label.HorizontalAlign.CENTER;

            const nameNode = this._createSkillLabel(rowNode, `Name_${skill.skillId}`, 104, skill.label, 16, new Color(232, 228, 220, 255));
            nameNode.getComponent(Label)!.horizontalAlign = Label.HorizontalAlign.LEFT;

            const costNode = this._createSkillLabel(rowNode, `Cost_${skill.skillId}`, 44, `${skill.costSp}`, 14, new Color(126, 200, 247, 255));
            costNode.getComponent(Label)!.horizontalAlign = Label.HorizontalAlign.RIGHT;

            rowNode.on(Button.EventType.CLICK, () => {
                services().event.emit(EVENT_NAMES.UltimateSkillSelected, { skillId: skill.skillId });
                this.hide();
            }, this);
        });

        const contentTransform = contentNode.getComponent(UITransform);
        if (contentTransform) {
            const totalHeight = Math.max(56, skills.length * 56 + 16);
            contentTransform.setContentSize(contentTransform.width, totalHeight);
        }

        console.log(`[UltimateSelectPopup] 建立 ${skills.length} 個技能按鈕`);
    }

    private _ensureVerticalLayout(contentNode: Node): void {
        const layout = contentNode.getComponent(Layout) ?? contentNode.addComponent(Layout);
        layout.type = Layout.Type.VERTICAL;
        layout.spacingY = 8;
        layout.paddingTop = 8;
        layout.paddingBottom = 8;
        layout.paddingLeft = 10;
        layout.paddingRight = 10;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
    }

    private _resizePopup(skillCount: number): void {
        const listHeight = Math.min(280, Math.max(56, skillCount * 56 + 16));
        const cardHeight = 56 + listHeight + 72;

        const scrollTransform = this._scrollPanel?.getComponent(UITransform);
        if (scrollTransform) {
            scrollTransform.setContentSize(scrollTransform.width, listHeight);
        }

        const dialogTransform = this._dialogCard?.getComponent(UITransform);
        if (dialogTransform) {
            dialogTransform.setContentSize(dialogTransform.width, cardHeight);
        }

        this._dialogCard?.getComponent(Layout)?.updateLayout();
    }

    private _positionAboveAnchor(): void {
        if (!this._rootNode || !this._dialogCard || !this._anchorNode) {
            return;
        }

        const rootTransform = this._rootNode.getComponent(UITransform);
        const anchorTransform = this._anchorNode.getComponent(UITransform);
        const dialogTransform = this._dialogCard.getComponent(UITransform);
        if (!rootTransform || !anchorTransform || !dialogTransform) {
            return;
        }

        const anchorWorld = anchorTransform.convertToWorldSpaceAR(new Vec3());
        const anchorLocal = rootTransform.convertToNodeSpaceAR(anchorWorld);
        const buttonHeight = anchorTransform.contentSize.height;
        const cardWidth = dialogTransform.contentSize.width;
        const cardHeight = dialogTransform.contentSize.height;
        const rootWidth = rootTransform.contentSize.width;
        const rootHeight = rootTransform.contentSize.height;

        const targetX = Math.max(
            -rootWidth / 2 + cardWidth / 2 + 12,
            Math.min(rootWidth / 2 - cardWidth / 2 - 12, anchorLocal.x),
        );
        const targetY = Math.max(
            -rootHeight / 2 + cardHeight / 2 + 12,
            Math.min(rootHeight / 2 - cardHeight / 2 - 12, anchorLocal.y + buttonHeight / 2 + cardHeight / 2 + 8),
        );

        this._dialogCard.setPosition(targetX, targetY, 0);
    }

    private _setButtonLabel(button: Button, text: string): void {
        const labelNode = button.node.getChildByName('Label');
        const label = labelNode?.getComponent(Label);
        if (label) {
            label.string = text;
        }
    }

    private _createSkillLabel(
        parent: Node,
        name: string,
        width: number,
        text: string,
        fontSize: number,
        color: Color,
    ): Node {
        const node = new Node(name);
        node.layer = parent.layer;
        node.parent = parent;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(width, 32);

        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.max(fontSize + 4, 20);
        label.color = color;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return node;
    }

    private _iconForSkill(skillId: string): string {
        if (skillId.includes('roar')) return '⚡';
        if (skillId.includes('slash')) return '🗡';
        if (skillId.includes('tactics')) return '📜';
        if (skillId.includes('rampage')) return '🔥';
        return '奧';
    }
}
