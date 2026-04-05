// @spec-source → 見 docs/cross-reference-index.md
/**
 * TigerTallyPanel — Zone 3: 虎符卡片區
 *
 * 職責：
 *   1. 顯示最多 4 張兵種卡片（固定 160px 高）
 *   2. 每張卡片填入名稱、攻血、糧草費用、稀有度框、冷卻遮罩
 *   3. 點擊卡片 → 呼叫 onCardSelect 回呼（由 BattleScenePanel 注入）
 *   4. 冷卻卡片只顯示遮罩，點擊仍可查看資訊（isDisabled 不阻擋查看）
 *
 * Unity 對照：HandCardManager（卡片對應 Prefab 池，資料綁定到 UGUI Image/Text）
 */
import { _decorator, Button, Color, Label, Node, Sprite } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { UITemplateBinder } from '../core/UITemplateBinder';

const { ccclass } = _decorator;

const UNIT_TYPE_BADGES: Record<string, { icon: string; color: Color }> = {
    cavalry:  { icon: 'CV', color: new Color(212, 175, 55, 255) },
    infantry: { icon: 'IN', color: new Color(58, 143, 217, 255) },
    archer:   { icon: 'AR', color: new Color(155, 109, 255, 255) },
    shield:   { icon: 'SH', color: new Color(136, 136, 136, 255) },
    pikeman:  { icon: 'PK', color: new Color(46, 204, 113, 255) },
    engineer: { icon: 'EN', color: new Color(224, 140, 60, 255) },
    medic:    { icon: 'MD', color: new Color(86, 204, 242, 255) },
    navy:     { icon: 'NV', color: new Color(52, 152, 219, 255) },
};

const RARITY_BORDER_COLORS: Record<TallyCardData['rarity'], Color> = {
    normal: new Color(110, 122, 138, 255),
    rare:   new Color(212, 175, 55, 255),
    epic:   new Color(168, 85, 247, 255),
};

/** 虎符卡片資料結構（打通 TigerTallyPanel ↔ UnitInfoPanel 的資料契約） */
export interface TallyCardData {
    /** 兵種識別字，對應 TroopType 字串（如 'cavalry'） */
    unitType: string;
    /** 顯示名稱（如：虎豹騎） */
    unitName: string;
    /** 副標題（如：重騎兵） */
    unitSub: string;
    atk:  number;
    def:  number;
    hp:   number;
    spd:  number;
    /** 糧草費用 */
    cost: number;
    rarity: 'normal' | 'rare' | 'epic';
    /** 特性標籤列表（如：['衝鋒', '重甲']）*/
    traits: string[];
    /** 特殊能力描述列表 */
    abilities: string[];
    /** 兵種描述文字 */
    desc: string;
    /** 是否冷卻中（顯示灰色遮罩） */
    isDisabled?: boolean;
}

@ccclass('TigerTallyPanel')
export class TigerTallyPanel extends UIPreviewBuilder {

    private get _specLoader() { return services().specLoader; }
    private _initialized = false;
    private _buildCompleted = false;
    private readonly _readyWaiters: Array<(ready: boolean) => void> = [];

    private _cards:     TallyCardData[] = [];
    private _cardNodes: Node[]          = [];
    private _binder:    UITemplateBinder | null = null;

    /**
     * 卡片選中回呼，由 BattleScenePanel 注入。
     * 冷卻卡片仍可觸發（允許查看資訊），由 UnitInfoPanel 顯示時決定互動行為。
     *
     * Unity 對照：public Action<int, TallyCardData> onCardSelect;
     */
    public onCardSelect: ((index: number, data: TallyCardData) => void) | null = null;

    // ── 生命週期 ─────────────────────────────────────────────

    async onLoad(): Promise<void> {
        console.log('[TigerTallyPanel] onLoad — node:', this.node.name, 'layer:', this.node.layer,
            'parent:', this.node.parent?.name,
            'parentLayer:', this.node.parent?.layer);
        services().initialize(this.node);
        await this._initialize();
    }

    private async _initialize(): Promise<void> {
        if (this._initialized) return;
        try {
            console.log('[TigerTallyPanel] _initialize 開始載入規格...');
            const [fullScreen, i18n] = await Promise.all([
                this._specLoader.loadFullScreen('tiger-tally-screen'),
                this._specLoader.loadI18n('zh-TW'),
            ]);
            console.log('[TigerTallyPanel] 規格載入完成，開始 buildScreen...');
            await this.buildScreen(fullScreen.layout, fullScreen.skin, i18n);
            this._initialized = true;
            console.log('[TigerTallyPanel] _initialize: buildScreen 完成，node active:', this.node.active,
                'layer:', this.node.layer);
        } catch (e) {
            console.warn('[TigerTallyPanel] 規格載入失敗，退回白模', e);
            this._initialized = true;
            this._flushReadyWaiters(false);
        }
    }

    // ── 覆寫建構點：綁定卡片節點 ─────────────────────────────

    protected onReady(binder: UITemplateBinder): void {
        this._binder = binder;
        const cardNames = ['TallyCard1', 'TallyCard2', 'TallyCard3', 'TallyCard4'];
        this._cardNodes = cardNames
            .map(name => binder.getNode(name))
            .filter((n): n is Node => n !== null);

        console.log(`[TigerTallyPanel] onReady — cardNodes:${this._cardNodes.length}/4`);

        this._cardNodes.forEach((cardNode, i) => {
            cardNode.on(Button.EventType.CLICK, () => this._onCardClick(i), this);
        });

        // 若 setCards() 在 buildScreen() 完成前被呼叫（競態），此處重播
        if (this._cards.length > 0) {
            this.setCards(this._cards);
        }

        console.log(`[TigerTallyPanel] 綁定完成 — cardNodes:${this._cardNodes.length}`);
        this._buildCompleted = true;
        this._flushReadyWaiters(true);
    }

    // ── 公開 API ──────────────────────────────────────────────

    /**
     * 設定卡片資料並刷新所有卡槽。
     * cards.length < 4 的剩餘槽位自動隱藏。
     *
     * Unity 對照：RefreshHandCards(List<TallyCardData> cards)
     */
    public setCards(cards: TallyCardData[]): void {
        this._cards = cards;
        this._cardNodes.forEach((cardNode, i) => {
            const data = cards[i] ?? null;
            if (data) {
                this._bindCard(cardNode, i + 1, data);
                cardNode.active = true;
            } else {
                // 超出資料範圍的卡片隱藏
                cardNode.active = false;
            }
        });
    }

    public waitUntilReady(timeoutMs = 5000): Promise<boolean> {
        if (this._buildCompleted) {
            return Promise.resolve(true);
        }

        return new Promise<boolean>((resolve) => {
            let settled = false;
            const finish = (ready: boolean) => {
                if (settled) return;
                settled = true;
                resolve(ready);
            };

            this._readyWaiters.push(finish);
            this.scheduleOnce(() => finish(this._buildCompleted), Math.max(0, timeoutMs) / 1000);
        });
    }

    // ── 私有：綁定單張卡片視覺 ──────────────────────────────

    private _bindCard(cardNode: Node, slot: number, data: TallyCardData): void {
        // 直接從 cardNode 樹查找 Layout-建立的 Label（用於設值）
        const atkLabelNode  = cardNode.getChildByName(`AtkLabel${slot}`);
        const hpLabelNode   = cardNode.getChildByName(`HpLabel${slot}`);
        const nameLabelNode = cardNode.getChildByName(`UnitName${slot}`);
        const costLabelNode = cardNode.getChildByName(`CostBadge${slot}`);
        const atkLabel  = atkLabelNode?.getComponent(Label)  ?? null;
        const hpLabel   = hpLabelNode?.getComponent(Label)   ?? null;
        const nameLabel = nameLabelNode?.getComponent(Label) ?? null;
        const costLabel = costLabelNode?.getComponent(Label) ?? null;

        if (atkLabel) {
            atkLabel.string = `ATK ${data.atk}`;
            atkLabel.color = new Color(0xFF, 0x6B, 0x6B, 0xFF);
            atkLabel.fontSize = 22;
            atkLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
            atkLabel.overflow = Label.Overflow.NONE;
            atkLabelNode!.active = true;
        } else { console.warn(`[TigerTallyPanel] 找不到 AtkLabel${slot}`); }

        if (hpLabel) {
            hpLabel.string = `HP ${data.hp}`;
            hpLabel.color = new Color(0x6B, 0xCB, 0x77, 0xFF);
            hpLabel.fontSize = 22;
            hpLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
            hpLabel.overflow = Label.Overflow.NONE;
            hpLabelNode!.active = true;
        } else { console.warn(`[TigerTallyPanel] 找不到 HpLabel${slot}`); }

        if (nameLabel) {
            nameLabel.string = data.unitName;
            nameLabel.color = new Color(0xE8, 0xE4, 0xDC, 0xFF);
            nameLabel.fontSize = 24;
            nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            nameLabel.overflow = Label.Overflow.NONE;
            nameLabelNode!.active = true;
        } else { console.warn(`[TigerTallyPanel] 找不到 UnitName${slot}`); }

        if (costLabel) {
            costLabel.string = `${data.cost}`;
            costLabel.color = new Color(0xD4, 0xAF, 0x37, 0xFF);
            costLabel.fontSize = 22;
            costLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            costLabel.overflow = Label.Overflow.NONE;
            costLabelNode!.active = true;
        } else { console.warn(`[TigerTallyPanel] 找不到 CostBadge${slot}`); }

        const b = this._binder;
        const rarityBorder = b?.getSprite(`rarityBorder${slot}`) ?? b?.getSprite(`RarityBorder${slot}`);
        if (rarityBorder) {
            rarityBorder.color = RARITY_BORDER_COLORS[data.rarity] ?? RARITY_BORDER_COLORS.normal;
        }

        this._applyUnitTypeBadge(slot, data.unitType);

        const mask = b?.getNode(`DisabledMask${slot}`);
        if (mask) mask.active = !!data.isDisabled;

        const btn = cardNode.getComponent(Button);
        if (btn) btn.interactable = true;

        console.log(`[TigerTallyPanel] _bindCard slot${slot}: ` +
            `name="${data.unitName}" atk=${data.atk} hp=${data.hp} type=${data.unitType} ` +
            `nameLabel=${!!nameLabel} atkLabel=${!!atkLabel} hpLabel=${!!hpLabel}`);
    }

    // ── 事件：卡片點擊 ───────────────────────────────────────

    private _onCardClick(index: number): void {
        const data = this._cards[index];
        if (!data) return;
        this.onCardSelect?.(index, data);
    }

    /**
     * 依兵種套用徽章文字與顏色。
     * BadgeText 節點已定義於 tiger-tally-main.json layout，此處只填資料。
     * Unity 對照：只更新已存在的 Text component，不建立新物件。
     */
    private _applyUnitTypeBadge(slot: number, unitType: string): void {
        const badgeNode = this._binder?.getNode(`UnitTypeBadge${slot}`);
        if (!badgeNode) return;

        // 套用徽章底色（Sprite tint）
        const sprite = badgeNode.getComponent(Sprite);
        if (sprite) sprite.color = new Color(0, 0, 0, 180);

        // BadgeText 節點由 Layout JSON 建立，此處直接取用並填入資料
        const textNode = badgeNode.getChildByName(`BadgeText${slot}`);
        if (!textNode) {
            console.warn(`[TigerTallyPanel] BadgeText${slot} 未在 layout 中建立，請確認 tiger-tally-main.json`);
            return;
        }

        // 把文字節點推到最上層，避免被 SolidBackground 遮擋
        textNode.setSiblingIndex(badgeNode.children.length - 1);
        textNode.active = true;

        const badgeDef = UNIT_TYPE_BADGES[unitType] ?? { icon: '？', color: new Color(220, 220, 220, 255) };
        const label = textNode.getComponent(Label);
        if (label) {
            label.string = badgeDef.icon;
            // 套用對應的專屬顏色，讓 CV 變金、IN 變藍 等等
            label.color  = badgeDef.color; 
            label.fontSize = 20;
            label.lineHeight = 24;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign   = Label.VerticalAlign.CENTER;
            label.overflow = Label.Overflow.NONE;
            label.isBold = true;
        }
        textNode.setPosition(0, 0, 0);
    }

    private _flushReadyWaiters(ready: boolean): void {
        while (this._readyWaiters.length > 0) {
            const resolve = this._readyWaiters.shift();
            resolve?.(ready);
        }
    }

}
