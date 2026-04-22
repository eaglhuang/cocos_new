// @spec-source → 見 docs/cross-reference-index.md (UCUF Wave 3)
/**
 * TigerTallyComposite — 虎符卡片區（Composite 版）
 * Wave 3 migration from TigerTallyPanel - manage complex 4-card battle unit roster
 * 
 * 職責：
 *   1. 顯示最多 4 張兵種卡片（固定 160px 高）
 *   2. 每張卡片填入名稱、攻血、糧草費用、稀有度框、冷卻遮罩
 *   3. 點擊卡片 → emit CardSelected 事件
 *   4. 冷卻卡片只顯示遮罩，點擊仍可查看資訊
 */
import { _decorator, Button, Color, EventTouch, Label, Node, Sprite, SpriteFrame, UITransform, view, Widget } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { UI_EVENTS } from '../core/UIEvents';
import { emitDeployDragDebug } from './DeployDragDebug';
import { logBattleUIPosition } from './BattleUIDiag';
import type { BattleSkillTargetMode, BattleSkillTiming, SkillSourceType } from '../../shared/SkillRuntimeContract';

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

const DEFAULT_BADGE_DEF = { icon: '？', color: new Color(220, 220, 220, 255) };
const TALLY_CARD_ART_FALLBACK_PATH = 'ui/tiger-tally/card-art/troops/spriteFrame';
const TALLY_TYPE_BADGE_FALLBACK_PATH = 'sprites/battle/battle_unit_type_underlay';
const TROOP_TYPE_SUITE_UNDERLAY_PATH = 'sprites/battle/battle_unit_type_underlay';
const WHITE = new Color(255, 255, 255, 255);
const TALLY_SHELL_CORE_BORDER = [40, 40, 40, 40] as const;
const RARITY_TEXT_COLORS: Record<TallyCardData['rarity'], Color> = {
    normal: new Color(210, 172, 114, 255),
    rare: new Color(150, 216, 206, 255),
    epic: new Color(255, 223, 142, 255),
    legendary: new Color(255, 214, 118, 255),
    mythic: new Color(226, 244, 232, 255),
};
const TALLY_TIER_STYLE: Record<TallyCardData['rarity'], {
    coreTint: Color;
    plaqueTint: Color;
    chipTint: Color;
    bandTint: Color;
    railDarkTint: Color;
    railAccentTint: Color;
    badgeTint: Color;
    accentActive: boolean;
}> = {
    normal: {
        coreTint: new Color(174, 139, 92, 255),
        plaqueTint: new Color(188, 152, 105, 255),
        chipTint: new Color(156, 124, 82, 255),
        bandTint: new Color(150, 118, 76, 255),
        railDarkTint: new Color(96, 74, 58, 255),
        railAccentTint: new Color(132, 92, 54, 255),
        badgeTint: new Color(170, 140, 90, 255),
        accentActive: false,
    },
    rare: {
        coreTint: new Color(115, 150, 152, 255),
        plaqueTint: new Color(144, 193, 191, 255),
        chipTint: new Color(92, 139, 142, 255),
        bandTint: new Color(86, 128, 133, 255),
        railDarkTint: new Color(49, 83, 97, 255),
        railAccentTint: new Color(126, 207, 201, 255),
        badgeTint: new Color(98, 168, 176, 255),
        accentActive: true,
    },
    epic: {
        coreTint: new Color(192, 155, 93, 255),
        plaqueTint: new Color(232, 194, 118, 255),
        chipTint: new Color(205, 167, 90, 255),
        bandTint: new Color(214, 172, 98, 255),
        railDarkTint: new Color(104, 73, 35, 255),
        railAccentTint: new Color(246, 195, 90, 255),
        badgeTint: new Color(222, 183, 104, 255),
        accentActive: true,
    },
    legendary: {
        coreTint: new Color(176, 118, 66, 255),
        plaqueTint: new Color(241, 196, 111, 255),
        chipTint: new Color(197, 132, 67, 255),
        bandTint: new Color(206, 143, 74, 255),
        railDarkTint: new Color(108, 53, 33, 255),
        railAccentTint: new Color(255, 182, 56, 255),
        badgeTint: new Color(231, 176, 88, 255),
        accentActive: true,
    },
    mythic: {
        coreTint: new Color(188, 175, 132, 255),
        plaqueTint: new Color(233, 243, 226, 255),
        chipTint: new Color(181, 190, 156, 255),
        bandTint: new Color(172, 188, 151, 255),
        railDarkTint: new Color(71, 99, 110, 255),
        railAccentTint: new Color(152, 225, 211, 255),
        badgeTint: new Color(192, 226, 214, 255),
        accentActive: true,
    },
};

export interface TallyTraitDetail {
    label: string;
    detail?: string;
}

export interface TallyAbilityDetail {
    name: string;
    detail?: string;
}

export interface TallySourceInfo {
    faction?: string;
    origin?: string;
    sourceType?: string;
    obtainHint?: string;
}

export interface TallyLoreInfo {
    title?: string;
    summary?: string;
    body?: string;
}

export interface TallyCardData {
    unitType: string;
    unitName: string;
    unitSub: string;
    atk:  number;
    def:  number;
    hp:   number;
    spd:  number;
    cost: number;
    rarity: 'normal' | 'rare' | 'epic' | 'legendary' | 'mythic';
    traits: string[];
    abilities: string[];
    desc: string;
    traitDetails?: TallyTraitDetail[];
    abilityDetails?: TallyAbilityDetail[];
    source?: TallySourceInfo;
    lore?: TallyLoreInfo;
    tacticId?: string;
    battleSkillId?: string;
    battleSkillSourceType?: SkillSourceType;
    targetMode?: BattleSkillTargetMode;
    timing?: BattleSkillTiming;
    isDisabled?: boolean;
    rarityLabel?: string;
    stars?: string;
    artResource?: string;
    rarityResource?: string;
    typeBadgeResource?: string;
    typeIconResource?: string;
}

@ccclass('TigerTallyComposite')
export class TigerTallyComposite extends CompositePanel {
    private _templateBinder: UITemplateBinder | null = null;
    private _cards: TallyCardData[] = [];
    private _cardNodes: Node[] = [];
    private _isMounted = false;
    private readonly _cardLoadSeq = [0, 0, 0, 0];
    private readonly _warnedFallbacks = new Set<string>();

    async onLoad(): Promise<void> {
        services().initialize(this.node);
        await this.mount();
    }

    protected onDestroy(): void {
        this.unmount();
        this._isMounted = false;
    }

    public async mount(): Promise<void> {
        if (this._isMounted) return;
        try {
            console.log('[TigerTallyComposite] mount() start — node:', this.node.name, 'parent:', this.node.parent?.name);
            await super.mount('tiger-tally-screen');
            this._isMounted = true;
            // 診斷：mount 完成後記錄位置資訊
            const root = this.node.children[0];
            if (root) {
                logBattleUIPosition('TigerTallyComposite', root);
            }
        } catch (e) {
            console.warn('[TigerTallyComposite] mount failed', e);
            this._isMounted = true;
        }
    }

    public setCards(cards: TallyCardData[]): void {
        this._cards = cards;
        this._populateCards();
    }

    public getCards(): TallyCardData[] {
        return [...this._cards];
    }

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._templateBinder = binder;
        this._cardNodes = [];
        for (let i = 1; i <= 4; i++) {
            const card = binder.getNode(`TallyCard${i}`);
            if (card) this._cardNodes.push(card);
        }
        console.log(`[TigerTallyComposite] ready - ${this._cardNodes.length} card slots`);

        // 診斷：_onAfterBuildReady 時記錄詳細位置
        const root = this.node.children[0];
        if (root) {
            logBattleUIPosition('TigerTallyComposite._onAfterBuildReady', root);
        }

        // 若 setCards() 在 buildScreen 完成前被呼叫（競態），此處重播
        if (this._cards.length > 0) {
            this._populateCards();
        }
    }

    private _populateCards(): void {
        if (!this._templateBinder) return;

        for (let i = 0; i < this._cardNodes.length; i++) {
            const cardNode = this._cardNodes[i];
            if (!cardNode) continue;
            const slot = i + 1;
            const data = this._cards[i] ?? null;

            if (!data) {
                cardNode.active = false;
                continue;
            }
            cardNode.active = true;

            const nameLabel = this._templateBinder.getNode(`UnitName${slot}`)?.getComponent(Label);
            if (nameLabel) { nameLabel.string = data.unitName; }

            const subLabelNode = this._templateBinder.getNode(`UnitSub${slot}`);
            const subLabel = subLabelNode?.getComponent(Label);
            if (subLabel) {
                subLabel.string = data.unitSub || data.unitType;
                subLabelNode!.active = false;
            }

            const atkLabel = this._templateBinder.getNode(`AtkLabel${slot}`)?.getComponent(Label);
            if (atkLabel) { atkLabel.string = `${data.atk}`; }

            const hpLabel = this._templateBinder.getNode(`HpLabel${slot}`)?.getComponent(Label);
            if (hpLabel) { hpLabel.string = `${data.hp}`; }

            const costLabel = this._templateBinder.getNode(`CostBadge${slot}`)?.getComponent(Label);
            if (costLabel) { costLabel.string = String(data.cost); }

            const rarityLabel = this._templateBinder.getNode(`RarityLabel${slot}`)?.getComponent(Label);
            if (rarityLabel) {
                rarityLabel.string = this._resolveRarityLabel(data);
                rarityLabel.color = this._resolveRarityTextColor(data.rarity);
            }

            const starsLabel = this._templateBinder.getNode(`StarsLabel${slot}`)?.getComponent(Label);
            if (starsLabel) {
                starsLabel.string = this._resolveStars(data);
                starsLabel.color = this._resolveRarityTextColor(data.rarity);
            }

            const loadSeq = ++this._cardLoadSeq[slot - 1];
            void this._applyShellFamily(cardNode, slot, data, loadSeq);
            void this._applyCardArt(slot, data, loadSeq);
            this._applyUnitTypeBadge(slot, data, loadSeq);

            const disabledMask = this._templateBinder.getNode(`DisabledMask${slot}`);
            if (disabledMask) { disabledMask.active = data.isDisabled ?? false; }

            cardNode.off(Button.EventType.CLICK);
            cardNode.on(Button.EventType.CLICK, () => {
                emitDeployDragDebug('TigerTallyComposite', 'emit-card-selected', {
                    index: i,
                    unitType: data.unitType,
                });
                services().event.emit(UI_EVENTS.CardSelected, { index: i, data });
            }, this);

            // 長按拖曳 → emit CardDragStart，由 DeployComposite 接收啟動 ghost drag
            cardNode.off(Node.EventType.TOUCH_START);
            cardNode.on(Node.EventType.TOUCH_START, (ev: EventTouch) => {
                emitDeployDragDebug('TigerTallyComposite', 'emit-card-drag-start', {
                    index: i,
                    unitType: data.unitType,
                });
                services().event.emit(UI_EVENTS.CardDragStart, { ev, data });
            }, this);
        }

        // Hide unused slots
        for (let i = this._cards.length; i < this._cardNodes.length; i++) {
            this._cardNodes[i].active = false;
        }
    }

    private _applyUnitTypeBadge(slot: number, data: TallyCardData, loadSeq: number): void {
        const badgeNode = this._templateBinder?.getNode(`UnitTypeBadge${slot}`);
        if (!badgeNode) return;

        const sprite = badgeNode.getComponent(Sprite);
        const textNode = badgeNode.getChildByName(`BadgeText${slot}`);
        if (!textNode) return;

        textNode.setSiblingIndex(badgeNode.children.length - 1);
        textNode.active = true;

        const badgeDef = UNIT_TYPE_BADGES[data.unitType] ?? DEFAULT_BADGE_DEF;
        const label = textNode.getComponent(Label);
        if (label) {
            label.string = badgeDef.icon;
            label.color = badgeDef.color;
            label.fontSize = 16;
            label.lineHeight = 18;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.overflow = Label.Overflow.NONE;
            label.isBold = true;
        }
        textNode.setPosition(0, 0, 0);
        textNode.active = false;

        if (sprite) {
            sprite.color = TALLY_TIER_STYLE[data.rarity]?.badgeTint ?? WHITE;
            void this._applyTypeBadgeSprite(sprite, slot, data, loadSeq);
        }
    }

    private async _applyShellFamily(cardNode: Node, slot: number, data: TallyCardData, loadSeq: number): Promise<void> {
        const tier = this._resolveShellTier(data.rarity);
        await Promise.all([
            this._applyShellSprite(cardNode.getComponent(Sprite), `ui/tiger-tally/frame-parts/${tier}/tally_frame_core_${tier}`, loadSeq, slot, true),
            this._applyShellSprite(this._templateBinder?.getSprite(`FrameShell${slot}`) ?? null, `ui/tiger-tally/frame-parts/${tier}/tally_frame_full_${tier}`, loadSeq, slot),
            this._applyShellSprite(this._templateBinder?.getSprite(`FrameTitlePlaque${slot}`) ?? null, `ui/tiger-tally/frame-parts/${tier}/tally_frame_title_plaque_${tier}`, loadSeq, slot),
            this._applyShellSprite(this._templateBinder?.getSprite(`FrameLeftChip${slot}`) ?? null, `ui/tiger-tally/frame-parts/${tier}/tally_frame_left_chip_${tier}`, loadSeq, slot),
            this._applyShellSprite(this._templateBinder?.getSprite(`FrameRarityBadgePlaque${slot}`) ?? null, `ui/tiger-tally/frame-parts/${tier}/tally_frame_rarity_badge_plaque_${tier}`, loadSeq, slot),
            this._applyShellSprite(this._templateBinder?.getSprite(`FrameRightRailDark${slot}`) ?? null, `ui/tiger-tally/frame-parts/${tier}/tally_frame_side_rail_dark_${tier}`, loadSeq, slot),
            this._applyShellSprite(this._templateBinder?.getSprite(`FrameBottomBand${slot}`) ?? null, `ui/tiger-tally/frame-parts/${tier}/tally_frame_bottom_band_${tier}`, loadSeq, slot),
        ]);

        const amberRail = this._templateBinder?.getSprite(`FrameRightRailAmber${slot}`) ?? null;
        if (!amberRail) return;
        const style = TALLY_TIER_STYLE[data.rarity] ?? TALLY_TIER_STYLE.epic;
        this._applyTierTint(cardNode, slot, data.rarity);
        const useAmberAccent = style.accentActive;
        amberRail.node.active = useAmberAccent;
        if (useAmberAccent) {
            await this._applyShellSprite(amberRail, `ui/tiger-tally/frame-parts/${tier}/tally_frame_side_rail_amber_${tier}`, loadSeq, slot);
            amberRail.color = style.railAccentTint;
        }
    }

    private _applyTierTint(cardNode: Node, slot: number, rarity: TallyCardData['rarity']): void {
        const style = TALLY_TIER_STYLE[rarity] ?? TALLY_TIER_STYLE.epic;
        const cardSprite = cardNode.getComponent(Sprite);
        if (cardSprite) {
            cardSprite.color = style.coreTint;
        }

        const tintMap: Array<[string, Color]> = [
            [`FrameShell${slot}`, style.coreTint],
            [`FrameTitlePlaque${slot}`, style.plaqueTint],
            [`FrameRarityBadgePlaque${slot}`, style.plaqueTint],
            [`FrameLeftChip${slot}`, style.chipTint],
            [`FrameBottomBand${slot}`, style.bandTint],
            [`FrameRightRailDark${slot}`, style.railDarkTint],
        ];
        for (const [id, color] of tintMap) {
            const sprite = this._templateBinder?.getSprite(id);
            if (sprite) sprite.color = color;
        }
    }

    private async _applyShellSprite(
        sprite: Sprite | null,
        path: string,
        loadSeq: number,
        slot: number,
        sliced = false,
    ): Promise<void> {
        if (!sprite) return;

        const spriteFrame = await services().resource.loadSpriteFrame(path, { preferTextureFallback: true }).catch(() => null);
        if (!spriteFrame || !this._isLoadSeqCurrent(slot, loadSeq)) return;

        sprite.spriteFrame = spriteFrame;
        sprite.color = WHITE;
        if (sliced && sprite.spriteFrame) {
            sprite.type = Sprite.Type.SLICED;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            const [top, right, bottom, left] = TALLY_SHELL_CORE_BORDER;
            sprite.spriteFrame.insetTop = top;
            sprite.spriteFrame.insetRight = right;
            sprite.spriteFrame.insetBottom = bottom;
            sprite.spriteFrame.insetLeft = left;
        } else {
            sprite.type = Sprite.Type.SIMPLE;
        }
        sprite.node.active = true;
    }

    private async _applyCardArt(slot: number, data: TallyCardData, loadSeq: number): Promise<void> {
        const artSprite = this._templateBinder?.getSprite(`ArtBg${slot}`) ?? this._templateBinder?.getSprite(`artBg${slot}`);
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
            ]),
            TALLY_TYPE_BADGE_FALLBACK_PATH,
        );
        if (!spriteFrame || !this._isLoadSeqCurrent(slot, loadSeq)) return;

        sprite.spriteFrame = spriteFrame;
        sprite.color = WHITE;
        sprite.node.active = true;
    }

    private _buildArtCandidates(data: TallyCardData): string[] {
        return this._uniquePaths([data.artResource]);
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
            `[TigerTallyComposite] ${slotKey} 缺少正式資源，改用 fallback: ${fallbackPath} | tried=${preferredPaths.join(', ')}`,
        );
    }

    private _warnMissing(slotKey: string, preferredPaths: string[], fallbackPath: string): void {
        const key = `${slotKey}|missing|${preferredPaths.join(',')}|${fallbackPath}`;
        if (this._warnedFallbacks.has(key)) return;
        this._warnedFallbacks.add(key);
        console.warn(
            `[TigerTallyComposite] ${slotKey} 載入失敗，正式資源與 fallback 皆不存在 | tried=${preferredPaths.join(', ')} | fallback=${fallbackPath}`,
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

    private _resolveShellTier(rarity: TallyCardData['rarity']): 'r' | 'sr' | 'ssr' | 'ur' | 'lr' {
        switch (rarity) {
            case 'normal':
                return 'r';
            case 'rare':
                return 'sr';
            case 'epic':
                return 'ssr';
            case 'legendary':
                return 'ur';
            case 'mythic':
                return 'lr';
            default:
                return 'ssr';
        }
    }

    private _resolveRarityTextColor(rarity: TallyCardData['rarity']): Color {
        return RARITY_TEXT_COLORS[rarity] ?? RARITY_TEXT_COLORS.epic;
    }

    private _isLoadSeqCurrent(slot: number, loadSeq: number): boolean {
        return this._cardLoadSeq[slot - 1] === loadSeq;
    }

    private _resolveRarityLabel(data: TallyCardData): string {
        if (typeof data.rarityLabel === 'string' && data.rarityLabel.trim().length > 0) {
            return data.rarityLabel.trim().toUpperCase();
        }

        switch (data.rarity) {
            case 'normal':
                return 'R';
            case 'rare':
                return 'SR';
            case 'epic':
                return 'SSR';
            case 'legendary':
                return 'UR';
            case 'mythic':
                return 'LR';
            default:
                return 'R';
        }
    }

    private _resolveStars(data: TallyCardData): string {
        if (typeof data.stars === 'string' && data.stars.trim().length > 0) {
            return data.stars;
        }

        switch (data.rarity) {
            case 'normal':
                return '★';
            case 'rare':
                return '★★';
            case 'epic':
                return '★★★';
            case 'legendary':
                return '★★★★';
            case 'mythic':
                return '★★★★★';
            default:
                return '';
        }
    }
}
