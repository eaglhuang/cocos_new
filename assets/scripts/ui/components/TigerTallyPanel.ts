// @spec-source → 見 docs/cross-reference-index.md
/**
 * @deprecated
 * TigerTallyPanel — Zone 3: 虎符卡片區（已廢止，請使用 TigerTallyComposite）
 *
 * 職責（已遷移至 CompositePanel）：
 *   1. 顯示最多 4 張兵種卡片（固定 160px 高）已遷移
 *   2. 卡片資料綁定已遷移
 *   3. 點擊卡片事件已遷移
 *   4. 冷卻遮罩邏輯已遷移
 *
 * 遷移完成時間：2026-04-13 (Wave 3)
 * 預計刪除：2026-05-13 (Wave 3 全部遷移後)
 *
 * Unity 對照：HandCardManager
 */
import { _decorator, Button, Color, Label, Node, Sprite, SpriteFrame } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { UI_EVENTS } from '../core/UIEvents';

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
    normal:    new Color(110, 122, 138, 255),
    rare:      new Color(212, 175, 55, 255),
    epic:      new Color(168, 85, 247, 255),
    legendary: new Color(168, 85, 247, 255),
    mythic:    new Color(255, 215, 0, 255),
};

const DEFAULT_BADGE_DEF = { icon: '？', color: new Color(220, 220, 220, 255) };
const TALLY_CARD_ART_FALLBACK_PATH = 'sprites/battle/tally_card_art_placeholder/spriteFrame';
const TALLY_TYPE_BADGE_FALLBACK_PATH = 'sprites/battle/battle_unit_type_underlay';
const TROOP_TYPE_SUITE_UNDERLAY_PATH = 'sprites/battle/battle_unit_type_underlay';
const WHITE = new Color(255, 255, 255, 255);
const TALLY_RARITY_PATHS: Record<TallyCardData['rarity'], string> = {
    normal:    'sprites/battle/tally_rarity_normal',
    rare:      'sprites/battle/tally_rarity_rare',
    epic:      'sprites/battle/tally_rarity_epic',
    legendary: 'sprites/battle/tally_rarity_epic',
    mythic:    'sprites/battle/tally_rarity_epic',
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
    rarity: 'normal' | 'rare' | 'epic' | 'legendary' | 'mythic';
    /** 特性標籤列表（如：['衝鋒', '重甲']）*/
    traits: string[];
    /** 特殊能力描述列表 */
    abilities: string[];
    /** 兵種描述文字 */
    desc: string;
    /** 是否冷卻中（顯示灰色遮罩） */
    isDisabled?: boolean;
    /** 可選：指定正式 card art 資源路徑，未填時依 unitType/rarity 命名規則推導。 */
    artResource?: string;
    /** 可選：指定 rarity 框資源路徑，未填時依 rarity 推導。 */
    rarityResource?: string;
    /** 可選：指定兵種 badge 資源路徑，未填時依 unitType 推導。 */
    typeBadgeResource?: string;
    typeIconResource?: string;
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
    private readonly _cardLoadSeq = [0, 0, 0, 0];
    private readonly _warnedFallbacks = new Set<string>();

    /**
     * [P3-R1b] 卡片點擊現改由 UI Event Bus (UI_EVENTS.CardSelected) 廣播，
     * 不再需要由 BattleScenePanel 注入函式指標，消除初始化時序競爭。
     *
     * 保留此欄位為 @deprecated — 舊有注入點，不再有功能作用，後續可移除。
     * @deprecated 請改訂閱 services().event.on(UI_EVENTS.CardSelected, handler)
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
            const [fullScreen, i18n, tokens] = await Promise.all([
                this._specLoader.loadFullScreen('tiger-tally-screen'),
                this._specLoader.loadI18n(services().i18n.currentLocale),
                this._specLoader.loadDesignTokens(),
            ]);
            console.log('[TigerTallyPanel] 規格載入完成，開始 buildScreen...');
            await this.buildScreen(fullScreen.layout, fullScreen.skin, i18n, tokens);
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
        const subLabelNode  = cardNode.getChildByName(`UnitSub${slot}`);
        const costLabelNode = cardNode.getChildByName(`CostBadge${slot}`);
        const atkLabel  = atkLabelNode?.getComponent(Label)  ?? null;
        const hpLabel   = hpLabelNode?.getComponent(Label)   ?? null;
        const nameLabel = nameLabelNode?.getComponent(Label) ?? null;
        const subLabel  = subLabelNode?.getComponent(Label)  ?? null;
        const costLabel = costLabelNode?.getComponent(Label) ?? null;

        if (atkLabel) {
            atkLabel.string = `${data.atk}`;
            atkLabelNode!.active = true;
        } else { console.warn(`[TigerTallyPanel] 找不到 AtkLabel${slot}`); }

        if (hpLabel) {
            hpLabel.string = `${data.hp}`;
            hpLabelNode!.active = true;
        } else { console.warn(`[TigerTallyPanel] 找不到 HpLabel${slot}`); }

        if (nameLabel) {
            nameLabel.string = data.unitName;
            nameLabelNode!.active = true;
        } else { console.warn(`[TigerTallyPanel] 找不到 UnitName${slot}`); }

        if (subLabel) {
            subLabel.string = data.unitSub || data.unitType;
            subLabelNode!.active = true;
        }

        if (costLabel) {
            costLabel.string = `${data.cost}`;
            costLabelNode!.active = true;
        } else { console.warn(`[TigerTallyPanel] 找不到 CostBadge${slot}`); }

        const loadSeq = ++this._cardLoadSeq[slot - 1];
        void this._applyCardArt(slot, data, loadSeq);
        void this._applyRarityBorder(slot, data, loadSeq);
        this._applyUnitTypeBadge(slot, data, loadSeq);

        const mask = this._binder?.getNode(`disabledMask${slot}`)
            ?? this._binder?.getNode(`DisabledMask${slot}`)
            ?? cardNode.getChildByName(`DisabledMask${slot}`);
        if (mask) mask.active = !!data.isDisabled;

        const btn = cardNode.getComponent(Button);
        if (btn) btn.interactable = true;

        console.log(`[TigerTallyPanel] _bindCard slot${slot}: ` +
            `name="${data.unitName}" atk=${data.atk} hp=${data.hp} type=${data.unitType} ` +
            `nameLabel=${!!nameLabel} atkLabel=${!!atkLabel} hpLabel=${!!hpLabel}`);
    }

    // ── 事件：卡片點擊 ───────────────────────────────────────

    /**
     * [P3-R1b] 卡片點擊處理：以 UI Event Bus 廣播，取代函式指標注入。
     * 訂閱方（BattleScenePanel）收到 UI_EVENTS.CardSelected 後執行業務邏輯，
     * 面板本身無需知道誰在監聽，徹底消除時序依賴。
     *
     * Unity 對照：button.onClick.Invoke() → MessageBus.Publish<CardSelectedMessage>()
     */
    private _onCardClick(index: number): void {
        const data = this._cards[index];
        if (!data) return;
        // 優先使用事件總線廣播
        services().event.emit(UI_EVENTS.CardSelected, { index, data });
        // 向後相容：若外部仍設定了舊式回呼，一併呼叫（deprecated）
        this.onCardSelect?.(index, data);
    }

    /**
     * 依兵種套用徽章文字與顏色。
     * BadgeText 節點已定義於 tiger-tally-main.json layout，此處只填資料。
     * Unity 對照：只更新已存在的 Text component，不建立新物件。
     */
    private _applyUnitTypeBadge(slot: number, data: TallyCardData, loadSeq: number): void {
        const badgeNode = this._binder?.getNode(`UnitTypeBadge${slot}`);
        if (!badgeNode) return;

        const sprite = badgeNode.getComponent(Sprite);

        // BadgeText 節點由 Layout JSON 建立，此處直接取用並填入資料
        const textNode = badgeNode.getChildByName(`BadgeText${slot}`);
        if (!textNode) {
            console.warn(`[TigerTallyPanel] BadgeText${slot} 未在 layout 中建立，請確認 tiger-tally-main.json`);
            return;
        }

        // 把文字節點推到最上層，避免被 SolidBackground 遮擋
        textNode.setSiblingIndex(badgeNode.children.length - 1);
        textNode.active = true;

        const badgeDef = UNIT_TYPE_BADGES[data.unitType] ?? DEFAULT_BADGE_DEF;
        const label = textNode.getComponent(Label);
        if (label) {
            label.string = badgeDef.icon;
            // 側欄卡縮成角標後，兵種縮寫維持精簡小號即可。
            label.color  = badgeDef.color; 
            label.fontSize = 16;
            label.lineHeight = 18;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign   = Label.VerticalAlign.CENTER;
            label.overflow = Label.Overflow.NONE;
            label.isBold = true;
        }
        textNode.setPosition(0, 0, 0);
        textNode.active = false;

        if (sprite) {
            sprite.color = WHITE;
            void this._applyTypeBadgeSprite(sprite, slot, data, loadSeq);
        }
    }

    private async _applyCardArt(slot: number, data: TallyCardData, loadSeq: number): Promise<void> {
        const artSprite = this._binder?.getSprite(`ArtBg${slot}`) ?? this._binder?.getSprite(`artBg${slot}`);
        if (!artSprite) return;

        const spriteFrame = await this._loadSpriteFrameWithFallback(
            `tally.card.art[${slot}]`,
            this._buildArtCandidates(data),
            TALLY_CARD_ART_FALLBACK_PATH,
            { preferTextureFallback: true },
        );
        if (!spriteFrame || !this._isLoadSeqCurrent(slot, loadSeq)) return;

        artSprite.spriteFrame = spriteFrame;
        artSprite.color = WHITE;
        artSprite.node.active = true;
    }

    private async _applyRarityBorder(slot: number, data: TallyCardData, loadSeq: number): Promise<void> {
        const rarityBorder = this._binder?.getSprite(`rarityBorder${slot}`) ?? this._binder?.getSprite(`RarityBorder${slot}`);
        if (!rarityBorder) return;

        const rarityPath = TALLY_RARITY_PATHS[data.rarity] ?? TALLY_RARITY_PATHS.normal;
        const spriteFrame = await this._loadSpriteFrameWithFallback(
            `tally.card.rarity[${slot}]`,
            this._uniquePaths([data.rarityResource, rarityPath]),
            TALLY_RARITY_PATHS.normal,
        );
        if (!spriteFrame || !this._isLoadSeqCurrent(slot, loadSeq)) return;

        rarityBorder.spriteFrame = spriteFrame;
        rarityBorder.color = RARITY_BORDER_COLORS[data.rarity] ?? RARITY_BORDER_COLORS.normal;
        rarityBorder.node.active = true;
    }

    private async _applyTypeBadgeSprite(
        sprite: Sprite,
        slot: number,
        data: TallyCardData,
        loadSeq: number,
    ): Promise<void> {
        const normalizedType = this._normalizeKey(data.unitType);
        const spriteFrame = await this._loadSpriteFrameWithFallback(
            `tally.badge.type[${slot}]`,
            this._uniquePaths([
                data.typeBadgeResource,
                normalizedType ? `sprites/battle/battle_unit_type_icon_${normalizedType}` : null,
                TROOP_TYPE_SUITE_UNDERLAY_PATH,
                normalizedType ? `sprites/battle/tally_badge_type_${normalizedType}` : null,
            ]),
            TALLY_TYPE_BADGE_FALLBACK_PATH,
        );
        if (!spriteFrame || !this._isLoadSeqCurrent(slot, loadSeq)) return;

        sprite.spriteFrame = spriteFrame;
        sprite.color = WHITE;
        sprite.node.active = true;
    }

    private _buildArtCandidates(data: TallyCardData): string[] {
        const normalizedType = this._normalizeKey(data.unitType);
        return this._uniquePaths([
            data.artResource,
            normalizedType ? `sprites/battle/tally_card_art_${normalizedType}_${data.rarity}` : null,
            normalizedType ? `sprites/battle/tally_card_art_${normalizedType}` : null,
        ]);
    }

    private async _loadSpriteFrameWithFallback(
        slotKey: string,
        preferredPaths: string[],
        fallbackPath: string,
        preferredLoadOptions?: { preferTextureFallback?: boolean },
    ): Promise<SpriteFrame | null> {
        for (const path of preferredPaths) {
            const spriteFrame = await services().resource.loadSpriteFrame(path, preferredLoadOptions).catch(() => null);
            if (spriteFrame) {
                return spriteFrame;
            }
        }

        const fallbackFrame = await services().resource.loadSpriteFrame(fallbackPath).catch(() => null);
        if (fallbackFrame) {
            if (preferredPaths.length > 0) {
                this._warnFallback(slotKey, preferredPaths, fallbackPath);
            }
            return fallbackFrame;
        }

        this._warnMissing(slotKey, preferredPaths, fallbackPath);
        return null;
    }

    private _warnFallback(slotKey: string, preferredPaths: string[], fallbackPath: string): void {
        const key = `${slotKey}|${preferredPaths.join(',')}|${fallbackPath}`;
        if (this._warnedFallbacks.has(key)) return;
        this._warnedFallbacks.add(key);
        console.log(
            `[TigerTallyPanel] ${slotKey} 缺少正式資源，改用 fallback: ${fallbackPath} | tried=${preferredPaths.join(', ')}`,
        );
    }

    private _warnMissing(slotKey: string, preferredPaths: string[], fallbackPath: string): void {
        const key = `${slotKey}|missing|${preferredPaths.join(',')}|${fallbackPath}`;
        if (this._warnedFallbacks.has(key)) return;
        this._warnedFallbacks.add(key);
        console.warn(
            `[TigerTallyPanel] ${slotKey} 載入失敗，正式資源與 fallback 皆不存在 | tried=${preferredPaths.join(', ')} | fallback=${fallbackPath}`,
        );
    }

    private _uniquePaths(paths: Array<string | null | undefined>): string[] {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const path of paths) {
            const normalized = path?.trim();
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            result.push(normalized);
        }
        return result;
    }

    private _normalizeKey(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    private _isLoadSeqCurrent(slot: number, loadSeq: number): boolean {
        return this._cardLoadSeq[slot - 1] === loadSeq;
    }

    private _flushReadyWaiters(ready: boolean): void {
        while (this._readyWaiters.length > 0) {
            const resolve = this._readyWaiters.shift();
            resolve?.(ready);
        }
    }

}
