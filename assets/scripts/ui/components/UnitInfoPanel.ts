// @spec-source → 見 docs/cross-reference-index.md
/**
 * UnitInfoPanel — 從左側滑入的兵種詳細資訊面板
 *
 * 職責：
 *   1. 點擊虎符卡片後顯示（slideRight 進場，slideLeft 退場）
 *   2. 填入兵種數值、特性標籤、特殊能力、兵種描述
 *   3. BtnClose 或外部呼叫 hide() 關閉面板
 *
 * 滑動動畫策略：
 *   - 依賴 UIPreviewBuilder.playEnterTransition / playExitTransition（fade）
 *   - Widget 固定 left:16%, top:88；動畫不改變 Widget，僅驅動 UIOpacity
 *   - 若未來需要真實 translate slide，可在此換成 tween(position) + 暫時關閉 Widget
 *
 * Unity 對照：CharacterInfoPanel（帶SlideIn動畫的 UGUI Panel）
 */
import { _decorator, Button, Color, Label, Node, Sprite, SpriteFrame } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { TallyCardData } from './TigerTallyPanel';

const { ccclass } = _decorator;
const UNITINFO_TYPE_ICON_FALLBACK_PATH = 'sprites/battle/unitinfo_type_icon';
const TROOP_TYPE_SUITE_GLYPH_PREFIX = 'sprites/battle/battle_unit_type_glyph_';
const WHITE = new Color(255, 255, 255, 255);

@ccclass('UnitInfoPanel')
export class UnitInfoPanel extends UIPreviewBuilder {

    private get _specLoader() { return services().specLoader; }
    private _initialized = false;
    private _visible = false;

    // ── 內容節點引用（由 onReady 填入） ────────────────
    private _unitName:  Label | null = null;
    private _unitSub:   Label | null = null;
    private _typeIcon:  Sprite | null = null;
    private _atkRow:    Label | null = null;
    private _defRow:    Label | null = null;
    private _hpRow:     Label | null = null;
    private _spdRow:    Label | null = null;
    private _costRow:   Label | null = null;
    private _traitTags: Node  | null = null;
    private _abilityList: Node | null = null;
    private _descText:  Label | null = null;

    // ── 生命週期 ─────────────────────────────────────────────

    async onLoad(): Promise<void> {
        services().initialize(this.node);
        await this._initialize();
        // 初始隱藏（active 已在場景中關閉，或透過 BattleScenePanel.initialActive:false）
        this.node.active = false;
    }

    private async _initialize(): Promise<void> {
        if (this._initialized) return;
        try {
            const [fullScreen, i18n, tokens] = await Promise.all([
                this._specLoader.loadFullScreen('unit-info-panel-screen'),
                this._specLoader.loadI18n(services().i18n.currentLocale),
                this._specLoader.loadDesignTokens(),
            ]);
            await this.buildScreen(fullScreen.layout, fullScreen.skin, i18n, tokens);
            this._initialized = true;
        } catch (e) {
            console.warn('[UnitInfoPanel] 規格載入失敗，退回白模', e);
            this._initialized = true;
        }
    }

    // ── 覆寫建構點：透過 binder 自動綁定節點引用 ─────────────────────────────

    protected onReady(binder: UITemplateBinder): void {
        this._unitName    = binder.getLabel('UnitName');
        this._unitSub     = binder.getLabel('UnitSub');
        this._typeIcon    = binder.getSprite('TypeIcon');
        this._atkRow      = binder.getLabel('AtkRow');
        this._defRow      = binder.getLabel('DefRow');
        this._hpRow       = binder.getLabel('HpRow');
        this._spdRow      = binder.getLabel('SpdRow');
        this._costRow     = binder.getLabel('CostRow');
        this._traitTags   = binder.getNode('TraitTags');
        this._abilityList = binder.getNode('AbilityList');
        this._descText    = binder.getLabel('DescText');

        binder.getNode('BtnClose')?.on(Button.EventType.CLICK, this.hide, this);

        console.log(`[UnitInfoPanel] 綁定完成 — name:${!!this._unitName} desc:${!!this._descText}`);
    }

    // ── 公開 API ──────────────────────────────────────────────

    /**
     * 顯示面板並填入資料。
     * 對應 Unity：panel.Show(CharacterData data)
     */
    public show(data: TallyCardData): void {
        if (!this._initialized) {
            console.warn('[UnitInfoPanel] 尚未初始化，無法顯示');
            return;
        }
        this._populate(data);
        this.node.active = true;
        this._visible = true;
        // 入場動畫（UIPreviewBuilder 提供 fade-in；日後可擴充 slide）
        this.playEnterTransition(this.node, { enter: 'fadeIn', duration: 0.2 });
    }

    /**
     * 關閉面板（退場動畫後 active = false）。
     * 對應 Unity：panel.Hide()
     */
    public hide(): void {
        if (!this._visible) return;
        this._visible = false;
        this.playExitTransition(this.node, { exit: 'fadeOut', duration: 0.18 }, () => {
            this.node.active = false;
        });
    }

    /** 面板是否目前可見 */
    public get isVisible(): boolean { return this._visible; }

    // ── 私有：資料填充 ────────────────────────────────────────

    private _populate(data: TallyCardData): void {
        if (this._unitName)  this._unitName.string  = data.unitName;
        if (this._unitSub)   this._unitSub.string   = data.unitSub;
        if (this._atkRow)    this._atkRow.string     = `攻擊：${data.atk}`;
        if (this._defRow)    this._defRow.string     = `防禦：${data.def}`;
        if (this._hpRow)     this._hpRow.string      = `血量：${data.hp}`;
        if (this._spdRow)    this._spdRow.string     = `速度：${data.spd}`;
        if (this._costRow)   this._costRow.string    = `費用：${data.cost}`;
        if (this._descText)  this._descText.string   = data.desc;
        void this._applyTypeIcon(data);

        // 特性標籤：每個 trait 建立一個 Label 子節點
        this._fillTraitTags(data.traits);

        // 能力列表：每條能力建一個 Label 子節點
        this._fillAbilityList(data.abilities);
    }

    /**
     * 動態建立特性標籤。
     * Unity 對照：FlowLayout 中 Instantiate prefab + setText
     */
    private _fillTraitTags(traits: string[]): void {
        if (!this._traitTags) return;
        // 清空舊標籤
        this._traitTags.removeAllChildren();
        for (const trait of traits) {
            const tagNode = new Node(`Trait_${trait}`);
            tagNode.parent = this._traitTags;
            const label = tagNode.addComponent(Label);
            label.string   = trait;
            label.fontSize = 11;
        }
    }

    /**
     * 動態建立能力列表。
     */
    private _fillAbilityList(abilities: string[]): void {
        if (!this._abilityList) return;
        this._abilityList.removeAllChildren();
        for (const ability of abilities) {
            const rowNode = new Node(`Ability_${ability}`);
            rowNode.parent = this._abilityList;
            const label = rowNode.addComponent(Label);
            label.string   = `• ${ability}`;
            label.fontSize = 12;
        }
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

    private _buildTypeIconCandidates(data: TallyCardData): string[] {
        const normalizedType = this._normalizeKey(data.unitType);
        return this._uniquePaths([
            data.typeIconResource,
            normalizedType ? `${TROOP_TYPE_SUITE_GLYPH_PREFIX}${normalizedType}` : null,
            normalizedType ? `sprites/battle/unitinfo_type_icon_${normalizedType}` : null,
        ]);
    }

    private async _loadSpriteFrameWithFallback(
        preferredPaths: string[],
        fallbackPath: string,
    ): Promise<SpriteFrame | null> {
        for (const path of preferredPaths) {
            const spriteFrame = await services().resource.loadSpriteFrame(path).catch(() => null);
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
