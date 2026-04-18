/**
 * GeneralDetailSkillsChild
 *
 * UCUF M4 ChildPanel — 戰技 Tab（Skills）。
 * 對應 fragment: gd-tab-skills.json
 * dataSource: 'config'
 */
import { Label, Button } from 'cc';
import type { Node } from 'cc';
import { ChildPanelBase } from '../../core/ChildPanelBase';
import type { UISkinResolver } from '../../core/UISkinResolver';
import type { UITemplateBinder } from '../../core/UITemplateBinder';
import type { GeneralConfig, GeneralTacticSlotConfig, GeneralUltimateSlotConfig } from '../../../core/models/GeneralUnit';
import {
    formatBulletList,
    formatList,
    formatSkillSource,
    formatTacticCategory,
    SKILL_DISPLAY_NAME,
} from './GeneralDetailFormatters';
import { services } from '../../../core/managers/ServiceLoader';
import { UCUFLogger, LogCategory } from '../../core/UCUFLogger';
import { buildIdMap } from '../../../shared/SkillRuntimeContract';
import type {
    JsonListEnvelope,
    CanonicalTacticDefinition,
    CanonicalUltimateDefinition,
} from '../../../shared/SkillRuntimeContract';

let tacticDefinitionMapPromise: Promise<Map<string, CanonicalTacticDefinition>> | null = null;
let ultimateDefinitionMapPromise: Promise<Map<string, CanonicalUltimateDefinition>> | null = null;

async function loadTacticDefinitionMap(): Promise<Map<string, CanonicalTacticDefinition>> {
    if (!tacticDefinitionMapPromise) {
        tacticDefinitionMapPromise = services().resource
            .loadJson<JsonListEnvelope<CanonicalTacticDefinition>>('data/master/tactic-library', { tags: ['ui', 'general-detail'] })
            .then((json) => buildIdMap(json.data));
    }
    return tacticDefinitionMapPromise;
}

async function loadUltimateDefinitionMap(): Promise<Map<string, CanonicalUltimateDefinition>> {
    if (!ultimateDefinitionMapPromise) {
        ultimateDefinitionMapPromise = services().resource
            .loadJson<JsonListEnvelope<CanonicalUltimateDefinition>>('data/master/ultimate-definitions', { tags: ['ui', 'general-detail'] })
            .then((json) => buildIdMap(json.data));
    }
    return ultimateDefinitionMapPromise;
}

export class GeneralDetailSkillsChild extends ChildPanelBase {
    override dataSource = 'config';
    private static readonly ROOT_PATH = 'TabSkillsContent';

    private _lPrimary!:   Label;
    private _lLearned!:   Label;
    private _lInspired!:  Label;
    private _lLocked!:    Label;
    private _lNote!:      Label;
    private _noteNode!:   Node | null;
    private _tacticsById: Map<string, CanonicalTacticDefinition> = new Map();
    private _ultimatesById: Map<string, CanonicalUltimateDefinition> = new Map();

    _lastData: GeneralConfig | null = null;

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    async onMount(_spec: Record<string, unknown>): Promise<void> {
        const h = this.hostNode;
        this._lPrimary  = this._label(h, 'PrimarySkillCard/PrimarySkillValue');
        this._lLearned  = this._label(h, 'LearnedSkillsCard/LearnedSkillsValue');
        this._lInspired = this._label(h, 'InspiredSkillsCard/InspiredSkillsValue');
        this._lLocked   = this._label(h, 'LockedSkillsCard/LockedSkillsValue');
        this._lNote     = this._label(h, 'SkillNoteCard/SkillNoteValue');
        this._noteNode  = this._requireNode(h, 'SkillNoteCard/SkillNoteValue');
        try {
            const [tacticsById, ultimatesById] = await Promise.all([
                loadTacticDefinitionMap(),
                loadUltimateDefinitionMap(),
            ]);
            this._tacticsById = tacticsById;
            this._ultimatesById = ultimatesById;
        } catch (error) {
            UCUFLogger.warn(LogCategory.DATA, '[SkillsChild] 載入 tactic/ultimate 定義失敗，回退舊欄位顯示', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    onDataUpdate(data: unknown): void {
        this._lastData = data as GeneralConfig;
        const cfg = this._lastData;

        const primaryDisplay = this._buildPrimaryDisplay(cfg);
        const tacticLines = this._buildTacticLines(cfg);
        const unlockedUltLines = this._buildUnlockedUltimateLines(cfg);
        const lockedUltLines = this._buildLockedUltimateLines(cfg);
        const noteDisplay = this._buildNoteDisplay(cfg, tacticLines.length, unlockedUltLines.length, lockedUltLines.length);

        this._set(this._lPrimary,
            `主戰技\n${primaryDisplay}`
        );
        this._set(this._lLearned,
            `天賦戰法\n${formatBulletList(tacticLines, '• 尚未配置天賦戰法')}`
        );
        this._set(this._lInspired,
            `已定義奧義\n${formatBulletList(unlockedUltLines, '• 此武將目前無專屬奧義')}`
        );
        this._set(this._lLocked,
            `奧義解鎖條件\n${formatBulletList(lockedUltLines, '• 無待解鎖奧義槽')}`
        );

        const demoSkillId = this._resolveDemoSkillId(cfg);
        if (demoSkillId) {
            this._set(this._lNote, `${noteDisplay}\n點擊此卡可預覽：${SKILL_DISPLAY_NAME[demoSkillId] ?? demoSkillId}`);
            this._bindSkillDemo(cfg, demoSkillId);
        } else {
            this._set(this._lNote, noteDisplay);
            this._clearSkillDemoBinding();
        }
    }

    protected override _refreshLabels(): void {
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    validateDataFormat(data: unknown): string | null {
        if (!data || typeof data !== 'object') return 'data must be a GeneralConfig object';
        return null;
    }

    onUnmount(): void {
        this._clearSkillDemoBinding();
    }

    private _bindSkillDemo(cfg: GeneralConfig, demoSkillId: string): void {
        if (!this._noteNode) return;
        const btn = this._noteNode.getComponent(Button) ?? this._noteNode.addComponent(Button);
        this._clearSkillDemoBinding();
        btn.node.on(Button.EventType.CLICK, () => {
            UCUFLogger.info(LogCategory.LIFECYCLE, '[SkillsChild] Playing skill action from Skills tab', { demoSkillId, generalId: cfg.id });
            services().action.playSkill(demoSkillId, {
                casterUnitId: cfg.id,
                casterPos: { x: 0, y: 0, z: 0 },
                casterNode: this.hostNode,
                targetUnitIds: ['dummy-target'],
                targetPositions: [{ x: 500, y: 0, z: 0 }],
            });
        }, this);
    }

    private _clearSkillDemoBinding(): void {
        if (!this._noteNode || !this._noteNode.isValid) return;
        try {
            this._noteNode.targetOff(this);
        } catch (error) {
            UCUFLogger.warn(LogCategory.LIFECYCLE, '[SkillsChild] 忽略技能預覽事件解綁失敗', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private _buildPrimaryDisplay(cfg: GeneralConfig): string {
        const primarySkillId = this._resolveDemoSkillId(cfg) ?? cfg.battlePrimarySkillId ?? cfg.skillId ?? null;
        if (!primarySkillId) return '尚未綁定主戰技';
        return SKILL_DISPLAY_NAME[primarySkillId] ?? primarySkillId;
    }

    private _buildTacticLines(cfg: GeneralConfig): string[] {
        if (Array.isArray(cfg.tacticSlots) && cfg.tacticSlots.length > 0) {
            return cfg.tacticSlots.map((slot, index) => this._formatTacticSlotLine(slot, index));
        }

        const legacy = cfg.learnedTactics ?? [];
        return legacy.map((name) => name);
    }

    private _buildUnlockedUltimateLines(cfg: GeneralConfig): string[] {
        if (!Array.isArray(cfg.ultimateSlots) || cfg.ultimateSlots.length === 0) {
            return cfg.inspiredTactics ?? [];
        }

        return cfg.ultimateSlots.map((slot) => this._formatUltimateLine(slot, false));
    }

    private _buildLockedUltimateLines(cfg: GeneralConfig): string[] {
        if (!Array.isArray(cfg.ultimateSlots) || cfg.ultimateSlots.length === 0) {
            return cfg.lockedTactics ?? [];
        }

        return cfg.ultimateSlots.map((slot) => this._formatUltimateLine(slot, true));
    }

    private _buildNoteDisplay(cfg: GeneralConfig, tacticCount: number, ultimateCount: number, lockedCount: number): string {
        const summaryParts = [
            `${cfg.name} 目前已配置 ${tacticCount} 個天賦戰法`,
            `${ultimateCount} 個奧義定義`,
            `${lockedCount} 個轉生解鎖節點`,
        ];
        if ((cfg.ultimateSlots?.length ?? 0) > 0) {
            return `${summaryParts.join('，')}。奧義依 1~5 轉逐步開放。`;
        }
        return `${summaryParts.join('，')}。此武將目前仍走一般戰法成長線。`;
    }

    private _formatTacticSlotLine(slot: GeneralTacticSlotConfig, index: number): string {
        const tactic = this._tacticsById.get(slot.tacticId);
        const displayName = tactic?.displayName ?? slot.tacticId;
        const category = formatTacticCategory(tactic?.category ?? slot.category);
        const source = formatSkillSource(slot.source);
        return `${index + 1}. ${displayName}［${category} / ${source}］`;
    }

    private _formatUltimateLine(slot: GeneralUltimateSlotConfig, lockMode: boolean): string {
        const ultimate = this._ultimatesById.get(slot.ultimateId);
        const name = ultimate?.name ?? slot.ultimateId;
        const unlockReincarnation = ultimate?.unlockReincarnation ?? slot.unlockReincarnation ?? slot.slot;
        if (lockMode) {
            return `${name}：${unlockReincarnation} 轉解鎖`;
        }
        const description = ultimate?.description ? ` — ${ultimate.description}` : '';
        return `${slot.slot}. ${name}${description}`;
    }

    private _resolveDemoSkillId(cfg: GeneralConfig): string | null {
        const direct = cfg.battlePrimarySkillId ?? cfg.skillId ?? null;
        if (direct) return direct;

        for (const slot of cfg.ultimateSlots ?? []) {
            const battleSkillId = this._ultimatesById.get(slot.ultimateId)?.battleSkillId ?? null;
            if (battleSkillId) return battleSkillId;
        }

        for (const slot of cfg.tacticSlots ?? []) {
            const battleSkillId = this._tacticsById.get(slot.tacticId)?.battleSkillId ?? null;
            if (battleSkillId) return battleSkillId;
        }

        return null;
    }

    private _label(root: Node, path: string): Label {
        const fullPath = `${GeneralDetailSkillsChild.ROOT_PATH}/${path}`;
        const label = root.getChildByPath(fullPath)?.getComponent(Label);
        if (!label) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[SkillsChild] 必要 Label 缺失 ${fullPath}`);
            throw new Error(`[SkillsChild] 必要 Label 缺失 ${fullPath}`);
        }
        return label;
    }

    private _requireNode(root: Node, path: string): Node {
        const fullPath = `${GeneralDetailSkillsChild.ROOT_PATH}/${path}`;
        const node = root.getChildByPath(fullPath);
        if (!node) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[SkillsChild] 缺少必要節點 ${fullPath}`);
            throw new Error(`[SkillsChild] 缺少必要節點 ${fullPath}`);
        }
        return node;
    }

    private _set(label: Label | null, text: string): void {
        if (label) label.string = text;
    }
}
