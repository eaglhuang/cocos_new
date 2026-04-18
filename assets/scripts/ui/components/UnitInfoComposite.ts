// @spec-source → 見 docs/cross-reference-index.md (UCUF Wave 2)
/**
 * UnitInfoComposite — 從左側滑入的兵種詳細資訊面板（CompositePanel 版）
 *
 * UCUF Wave 2 — 將 UnitInfoPanel（UIPreviewBuilder）遷移至 CompositePanel 架構。
 *
 * 職責：
 *   1. 點擊虎符卡片後顯示（fadeIn/fadeOut 進場退場）
 *   2. 填入兵種數值、特性標籤、特殊能力、兵種描述
 *   3. BtnClose 或外部呼叫 hide() 關閉面板
 *
 * 遷移重點：
 *   - buildScreen() → mount('unit-info-panel-screen')
 *   - onReady(binder) → _onAfterBuildReady(binder)
 *   - 保留 show(data) / hide() / isVisible 公開 API 相同
 *   - 動態 trait 標籤與 ability 列表建立邏輯相同
 *
 * Unity 對照：CharacterInfoPanel，帶 SlideIn 動畫的 UGUI Panel
 */
import { _decorator, Button, Color, Label, Node, Sprite, SpriteFrame } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { TallyCardData } from './TigerTallyComposite';

const { ccclass } = _decorator;
const UNITINFO_TYPE_ICON_FALLBACK_PATH = 'sprites/battle/unitinfo_type_icon';
const WHITE = new Color(255, 255, 255, 255);

@ccclass('UnitInfoComposite')
export class UnitInfoComposite extends CompositePanel {

    // ── 內容節點引用（由 _onAfterBuildReady 填入） ────────────────
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

    private _isMounted = false;
    private _visible = false;

    // ── 生命週期 ─────────────────────────────────────────────

    protected onDestroy(): void {
        this.unmount();
        this._isMounted = false;
    }

    // ── 公開 API ──────────────────────────────────────────────

    /**
     * 掛載並顯示面板。
     * 初次呼叫時掛載 screen；後續呼叫僅更新資料。
     */
    public async show(data: TallyCardData): Promise<void> {
        if (!this._isMounted) {
            await this.mount('unit-info-panel-screen');
            this._isMounted = true;
        }

        this._populate(data);
        this.node.active = true;
        this._visible = true;
        this.playEnterTransition(this.node, { enter: 'fadeIn', duration: 0.2 });
    }

    /**
     * 關閉面板（退場動畫後 active = false）。
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

    // ── CompositePanel 鉤子 ───────────────────────────────────

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
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

        console.log(`[UnitInfoComposite] 綁定完成 — name:${!!this._unitName} desc:${!!this._descText}`);
    }

    // ── 私有：資料填充 ────────────────────────────────────────

    private _populate(data: TallyCardData): void {
        if (this._unitName)  this._unitName.string  = data.unitName;
        if (this._unitSub)   this._unitSub.string   = data.unitSub;
        if (this._atkRow)    this._atkRow.string     = `攻擊：${data.atk}`;
        if (this._defRow)    this._defRow.string     = `防禦：${data.def}`;
        if (this._hpRow)     this._hpRow.string      = `血量：${data.hp}`;
        if (this._spdRow)    this._spdRow.string     = `速度：${data.spd}`;
        if (this._costRow)   this._costRow.string    = `費用：${data.cost}`;
        if (this._descText)  this._descText.string   = this._buildDetailText(data);
        void this._applyTypeIcon(data);

        this._fillTraitTags(data);
        this._fillAbilityList(data);
    }

    private _fillTraitTags(data: TallyCardData): void {
        if (!this._traitTags) return;
        this._traitTags.removeAllChildren();
        const traits = data.traitDetails?.map(detail => detail.label) ?? data.traits;
        for (const trait of traits) {
            const tagNode = new Node(`Trait_${trait}`);
            tagNode.parent = this._traitTags;
            const label = tagNode.addComponent(Label);
            label.string   = trait;
            label.fontSize = 11;
        }
    }

    private _fillAbilityList(data: TallyCardData): void {
        if (!this._abilityList) return;
        this._abilityList.removeAllChildren();
        const abilityRows = data.abilityDetails?.map(detail => detail.detail ? `${detail.name}：${detail.detail}` : detail.name)
            ?? data.abilities;
        for (const ability of abilityRows) {
            const rowNode = new Node(`Ability_${ability}`);
            rowNode.parent = this._abilityList;
            const label = rowNode.addComponent(Label);
            label.string   = `• ${ability}`;
            label.fontSize = 12;
        }
    }

    private _buildDetailText(data: TallyCardData): string {
        const blocks: string[] = [];
        if (data.desc) blocks.push(data.desc);

        const sourceLine = [data.source?.origin, data.source?.sourceType].filter(Boolean).join(' / ');
        if (sourceLine) {
            blocks.push(`出處：${sourceLine}`);
        }

        if (data.source?.obtainHint) {
            blocks.push(`取得：${data.source.obtainHint}`);
        }

        const loreParts = [data.lore?.title, data.lore?.summary].filter(Boolean);
        if (loreParts.length > 0) {
            blocks.push(`典故：${loreParts.join('｜')}`);
        }

        return blocks.join('\n');
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
