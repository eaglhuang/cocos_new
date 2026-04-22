// @spec-source → 見 docs/cross-reference-index.md
/**
 * TigerTallyDetailComposite — 戰鬥場景右側虎符詳情抽屜（第一版）
 *
 * 職責：
 *   1. 點擊左側 tiger tally 卡後，於右側顯示完整的虎符內容摘要
 *   2. 顯示卡面預覽、稀有度、星數、糧耗、基礎數值、來源與典故摘要
 *   3. 呈現 trait / ability 的 detail-ready 內容，作為後續完整 item-card 的前置版本
 *
 * Unity 對照：Screen Space Overlay Canvas 右側抽屜式 Detail Panel
 */
import { _decorator, Button, Color, Label, Layout, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { TallyCardData } from './TigerTallyComposite';

const { ccclass } = _decorator;

const UNITINFO_TYPE_ICON_FALLBACK_PATH = 'sprites/battle/battle_unit_type_underlay';
const TROOP_TYPE_SUITE_GLYPH_PREFIX = 'sprites/battle/battle_unit_type_glyph_';
const TALLY_CARD_ART_FALLBACK_PATH = 'sprites/battle/tally_card_art_placeholder/spriteFrame';
const WHITE = new Color(255, 255, 255, 255);
const DETAIL_TITLE_COLOR = new Color(245, 228, 180, 255);
const DETAIL_BODY_COLOR = new Color(224, 216, 198, 255);
const DETAIL_MUTED_COLOR = new Color(196, 182, 156, 255);
const DETAIL_TRAIT_COLOR = new Color(149, 212, 198, 255);
const DETAIL_ABILITY_COLOR = new Color(244, 203, 129, 255);

@ccclass('TigerTallyDetailComposite')
export class TigerTallyDetailComposite extends CompositePanel {
    private _unitName: Label | null = null;
    private _unitSub: Label | null = null;
    private _rarityLabel: Label | null = null;
    private _starsLabel: Label | null = null;
    private _sourceFaction: Label | null = null;
    private _sourceLine: Label | null = null;
    private _sourceOriginValue: Label | null = null;
    private _sourceTypeValue: Label | null = null;
    private _sourceObtainValue: Label | null = null;
    private _loreTitle: Label | null = null;
    private _loreSummary: Label | null = null;
    private _loreBody: Label | null = null;
    private _typeIcon: Sprite | null = null;
    private _artImage: Sprite | null = null;
    private _atkValue: Label | null = null;
    private _defValue: Label | null = null;
    private _hpValue: Label | null = null;
    private _spdValue: Label | null = null;
    private _costValue: Label | null = null;
    private _summaryText: Label | null = null;
    private _traitCards: Node | null = null;
    private _abilityCards: Node | null = null;
    private _isMounted = false;
    private _visible = false;

    protected onDestroy(): void {
        this.unmount();
        this._isMounted = false;
    }

    public async show(data: TallyCardData): Promise<void> {
        if (!this._isMounted) {
            await this.mount('tiger-tally-detail-panel-screen');
            this._isMounted = true;
        }

        this._populate(data);
        this.node.active = true;
        this._visible = true;
        this.playEnterTransition(this.node, { enter: 'slideLeft', duration: 0.2 });
    }

    public hide(): void {
        if (!this._visible) return;
        this._visible = false;
        this.playExitTransition(this.node, { exit: 'slideRight', duration: 0.18 }, () => {
            this.node.active = false;
        });
    }

    public get isVisible(): boolean { return this._visible; }

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._unitName = binder.getLabel('UnitName');
        this._unitSub = binder.getLabel('UnitSub');
        this._rarityLabel = binder.getLabel('RarityLabel');
        this._starsLabel = binder.getLabel('StarsLabel');
        this._sourceFaction = binder.getLabel('SourceFaction');
        this._sourceLine = binder.getLabel('SourceLine');
        this._sourceOriginValue = binder.getLabel('SourceOriginValue');
        this._sourceTypeValue = binder.getLabel('SourceTypeValue');
        this._sourceObtainValue = binder.getLabel('SourceObtainValue');
        this._loreTitle = binder.getLabel('LoreTitle');
        this._loreSummary = binder.getLabel('LoreSummary');
        this._loreBody = binder.getLabel('LoreBody');
        this._typeIcon = binder.getSprite('TypeIcon');
        this._artImage = binder.getSprite('DetailArt');
        this._atkValue = binder.getLabel('AtkValue');
        this._defValue = binder.getLabel('DefValue');
        this._hpValue = binder.getLabel('HpValue');
        this._spdValue = binder.getLabel('SpdValue');
        this._costValue = binder.getLabel('CostValue');
        this._summaryText = binder.getLabel('SummaryText');
        this._traitCards = binder.getNode('TraitCards');
        this._abilityCards = binder.getNode('AbilityCards');

        binder.getNode('BtnClose')?.on(Button.EventType.CLICK, this.hide, this);
        this.node.active = false;
    }

    private _populate(data: TallyCardData): void {
        if (this._unitName) this._unitName.string = data.unitName;
        if (this._unitSub) this._unitSub.string = data.unitSub;
        if (this._rarityLabel) this._rarityLabel.string = data.rarityLabel ?? '';
        if (this._starsLabel) this._starsLabel.string = data.stars ?? '';
        if (this._sourceFaction) this._sourceFaction.string = data.source?.faction ?? '未設定陣營';
        if (this._sourceLine) {
            this._sourceLine.string = [data.source?.origin, data.source?.sourceType].filter(Boolean).join(' / ');
        }
        if (this._sourceOriginValue) this._sourceOriginValue.string = data.source?.origin ?? '未設定來源';
        if (this._sourceTypeValue) this._sourceTypeValue.string = data.source?.sourceType ?? '未設定取得類型';
        if (this._sourceObtainValue) this._sourceObtainValue.string = data.source?.obtainHint ?? '未提供取得條件';
        if (this._loreTitle) this._loreTitle.string = data.lore?.title ?? '虎符典故';
        if (this._loreSummary) this._loreSummary.string = data.lore?.summary ?? '尚未提供典故摘要';
        if (this._loreBody) this._loreBody.string = this._buildLoreBody(data);
        if (this._atkValue) this._atkValue.string = `${data.atk}`;
        if (this._defValue) this._defValue.string = `${data.def}`;
        if (this._hpValue) this._hpValue.string = `${data.hp}`;
        if (this._spdValue) this._spdValue.string = `${data.spd}`;
        if (this._costValue) this._costValue.string = `${data.cost}`;
        if (this._summaryText) this._summaryText.string = this._buildSummary(data);

        void this._applyTypeIcon(data);
        void this._applyArt(data);
        this._fillTraitCards(data);
        this._fillAbilityCards(data);
    }

    private _buildSummary(data: TallyCardData): string {
        const lines: string[] = [];
        if (data.desc) lines.push(data.desc);
        if (data.source?.obtainHint) lines.push(`取得：${data.source.obtainHint}`);
        return lines.join('\n');
    }

    private _buildLoreBody(data: TallyCardData): string {
        const blocks: string[] = [];
        if (data.lore?.body) blocks.push(data.lore.body);
        if (blocks.length === 0) {
            blocks.push('此虎符目前尚未補齊完整典故敘述。');
        }
        return blocks.join('\n');
    }

    private _fillTraitCards(data: TallyCardData): void {
        if (!this._traitCards) return;
        this._traitCards.removeAllChildren();
        const rows = data.traitDetails?.length
            ? data.traitDetails.map((detail) => ({ title: detail.label, body: detail.detail ?? '' }))
            : data.traits.map((trait) => ({ title: trait, body: '' }));

        for (const [index, row] of rows.entries()) {
            this._appendDetailRow(this._traitCards, `Trait_${index}`, row.title, row.body, DETAIL_TRAIT_COLOR);
        }
        this._traitCards.getComponent(Layout)?.updateLayout();
    }

    private _fillAbilityCards(data: TallyCardData): void {
        if (!this._abilityCards) return;
        this._abilityCards.removeAllChildren();
        const rows = data.abilityDetails?.length
            ? data.abilityDetails.map((detail) => ({ title: detail.name, body: detail.detail ?? '' }))
            : data.abilities.map((ability) => ({ title: ability, body: '' }));

        for (const [index, row] of rows.entries()) {
            this._appendDetailRow(this._abilityCards, `Ability_${index}`, row.title, row.body, DETAIL_ABILITY_COLOR);
        }
        this._abilityCards.getComponent(Layout)?.updateLayout();
    }

    private _appendDetailRow(
        container: Node,
        nodeName: string,
        title: string,
        body: string,
        titleColor: Color,
    ): void {
        const parentTransform = container.getComponent(UITransform);
        const width = Math.max((parentTransform?.width ?? 320) - 8, 220);
        const rowHeight = body ? 42 : 22;

        const row = new Node(nodeName);
        row.parent = container;
        const rowTransform = row.addComponent(UITransform);
        rowTransform.setContentSize(width, rowHeight);

        const rowLayout = row.addComponent(Layout);
        rowLayout.type = Layout.Type.VERTICAL;
        rowLayout.spacingY = body ? 2 : 0;
        rowLayout.resizeMode = Layout.ResizeMode.CONTAINER;

        this._appendRowLabel(row, `${nodeName}_Title`, title, titleColor, 13, 18, true);
        if (body) {
            this._appendRowLabel(row, `${nodeName}_Body`, body, DETAIL_BODY_COLOR, 12, 17, false);
        }
        rowLayout.updateLayout();
    }

    private _appendRowLabel(
        parent: Node,
        nodeName: string,
        text: string,
        color: Color,
        fontSize: number,
        lineHeight: number,
        isBold: boolean,
    ): void {
        const labelNode = new Node(nodeName);
        labelNode.parent = parent;
        const transform = labelNode.addComponent(UITransform);
        transform.setContentSize(Math.max((parent.getComponent(UITransform)?.width ?? 320) - 6, 210), lineHeight + 2);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = lineHeight;
        label.color = color;
        label.isBold = isBold;
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP;
    }

    private async _applyTypeIcon(data: TallyCardData): Promise<void> {
        if (!this._typeIcon) return;
        const spriteFrame = await this._loadSpriteFrameWithFallback(
            this._buildTypeIconCandidates(data),
            UNITINFO_TYPE_ICON_FALLBACK_PATH,
        );
        if (!spriteFrame) {
            this._typeIcon.node.active = false;
            return;
        }

        this._typeIcon.spriteFrame = spriteFrame;
        this._typeIcon.color = WHITE;
        this._typeIcon.node.active = true;
    }

    private async _applyArt(data: TallyCardData): Promise<void> {
        if (!this._artImage) return;
        const spriteFrame = await this._loadSpriteFrameWithFallback(
            this._buildArtCandidates(data),
            TALLY_CARD_ART_FALLBACK_PATH,
            { preferTextureFallback: true },
        );
        if (!spriteFrame) {
            this._artImage.node.active = false;
            return;
        }

        this._artImage.spriteFrame = spriteFrame;
        this._artImage.color = WHITE;
        this._artImage.node.active = true;
    }

    private _buildTypeIconCandidates(data: TallyCardData): string[] {
        const normalizedType = this._normalizeKey(data.unitType);
        return this._uniquePaths([
            data.typeIconResource,
            normalizedType ? `sprites/battle/battle_unit_type_icon_${normalizedType}` : null,
            normalizedType ? `${TROOP_TYPE_SUITE_GLYPH_PREFIX}${normalizedType}` : null,
        ]);
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

        return services().resource.loadSpriteFrame(fallbackPath).catch(() => null);
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
}
