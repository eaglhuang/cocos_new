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
import { _decorator, Button, Label, Node } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';

const { ccclass } = _decorator;

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

    private readonly _specLoader = new UISpecLoader();
    private _initialized = false;

    private _cards:     TallyCardData[] = [];
    private _cardNodes: Node[]          = [];

    /**
     * 卡片選中回呼，由 BattleScenePanel 注入。
     * 冷卻卡片仍可觸發（允許查看資訊），由 UnitInfoPanel 顯示時決定互動行為。
     *
     * Unity 對照：public Action<int, TallyCardData> onCardSelect;
     */
    public onCardSelect: ((index: number, data: TallyCardData) => void) | null = null;

    // ── 生命週期 ─────────────────────────────────────────────

    async onLoad(): Promise<void> {
        services().initialize(this.node);
        await this._initialize();
    }

    private async _initialize(): Promise<void> {
        if (this._initialized) return;
        try {
            const [fullScreen, i18n] = await Promise.all([
                this._specLoader.loadFullScreen('tiger-tally-screen'),
                this._specLoader.loadI18n('zh-TW'),
            ]);
            await this.buildScreen(fullScreen.layout, fullScreen.skin, i18n);
            this._initialized = true;
        } catch (e) {
            console.warn('[TigerTallyPanel] 規格載入失敗，退回白模', e);
            this._initialized = true;
        }
    }

    // ── 覆寫建構點：綁定卡片節點 ─────────────────────────────

    protected onBuildComplete(_rootNode: Node): void {
        const cardNames = ['TallyCard1', 'TallyCard2', 'TallyCard3', 'TallyCard4'];
        this._cardNodes = cardNames
            .map(name => this._deepFind(name))
            .filter((n): n is Node => n !== null);

        this._cardNodes.forEach((cardNode, i) => {
            // 點擊觸發回呼（冷卻卡也能查看，不阻擋）
            cardNode.on(Button.EventType.CLICK, () => this._onCardClick(i), this);
        });

        console.log(`[TigerTallyPanel] 綁定完成 — cards:${this._cardNodes.length}`);
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

    // ── 私有：綁定單張卡片視覺 ──────────────────────────────

    private _bindCard(cardNode: Node, slot: number, data: TallyCardData): void {
        const findInCard = (name: string) => this._deepFindIn(cardNode, name);

        // 名稱
        const nameLabel = findInCard(`UnitName${slot}`)?.getComponent(Label);
        if (nameLabel) nameLabel.string = data.unitName;

        // 攻擊/生命分開顯示（v3 規格：⚔N / ❤N）
        const atkLabel = findInCard(`AtkLabel${slot}`)?.getComponent(Label);
        if (atkLabel) atkLabel.string = `⚔${data.atk}`;

        const hpLabel = findInCard(`HpLabel${slot}`)?.getComponent(Label);
        if (hpLabel) hpLabel.string = `❤${data.hp}`;

        // 糧草費用
        const costLabel = findInCard(`CostBadge${slot}`)?.getComponent(Label);
        if (costLabel) costLabel.string = `${data.cost}`;

        // 冷卻遮罩
        const mask = findInCard(`DisabledMask${slot}`);
        if (mask) mask.active = !!data.isDisabled;

        // 冷卻狀態下 Button.interactable 關閉 click 冒泡，改在父節點監聽
        const btn = cardNode.getComponent(Button);
        if (btn) btn.interactable = !data.isDisabled;
    }

    // ── 事件：卡片點擊 ───────────────────────────────────────

    private _onCardClick(index: number): void {
        const data = this._cards[index];
        if (!data) return;
        this.onCardSelect?.(index, data);
    }

    // ── 工具：BFS 深度搜尋 ────────────────────────────────────

    private _deepFind(name: string): Node | null {
        return this._deepFindIn(this.node, name);
    }

    private _deepFindIn(root: Node, name: string): Node | null {
        const queue: Node[] = [root];
        while (queue.length > 0) {
            const cur = queue.shift()!;
            if (cur.name === name) return cur;
            queue.push(...cur.children);
        }
        return null;
    }
}
