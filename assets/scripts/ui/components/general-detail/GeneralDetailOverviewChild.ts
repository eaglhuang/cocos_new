/**
 * GeneralDetailOverviewChild
 *
 * UCUF M4 ChildPanel — 總覽 Tab（Overview）。
 * 對應 fragment: gd-tab-overview.json
 * dataSource: 'overview'
 */
import { Color } from 'cc';
import type { Node } from 'cc';
import { ChildPanelBase } from '../../core/ChildPanelBase';
import { UIContentBinder } from '../../core/UIContentBinder';
import type { ContentContractSchema } from '../../core/UIContentBinder';
import type { UISkinResolver } from '../../core/UISkinResolver';
import type { ContentContractRef } from '../../core/UISpecTypes';
import type { UITemplateBinder } from '../../core/UITemplateBinder';
import type { GeneralDetailOverviewContentState } from '../GeneralDetailOverviewMapper';
import { UCUFLogger, LogCategory } from '../../core/UCUFLogger';
import { services } from '../../../core/managers/ServiceLoader';
import { OVERVIEW_CONTENT_CONTRACT_REF, resolveOverviewBindPathForTarget } from './GeneralDetailOverviewBindPathPolicy';
import {
    applyOverviewAwakeningProgress,
    applyOverviewCrestState,
    applyOverviewEmptyCrestFace,
    applyOverviewFallbackCrestFace,
    applyOverviewLoadedCrestFace,
    applyOverviewVisualPass,
} from './GeneralDetailOverviewVisuals';

const CORE_STAT_VALUE_COLOR = new Color(255, 224, 136, 255);
const CORE_STAT_KEY_COLORS = {
    str: new Color(111, 168, 255, 255),
    lea: new Color(134, 225, 165, 255),
    cha: new Color(255, 155, 186, 255),
    int: new Color(196, 148, 255, 255),
    pol: new Color(224, 224, 224, 255),
    luk: new Color(255, 141, 110, 255),
} as const;
const ROLE_BULLET_COLOR = new Color(63, 106, 98, 255);
const TRAIT_BULLET_COLOR = new Color(212, 175, 55, 255);
const LIST_TEXT_COLOR = new Color(232, 228, 220, 255);

const CORE_STAT_ITEMS = [
    {
        key: 'str' as const,
        label: '武',
        keyPath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow1/CoreStatItem1/CoreStatKey1',
        valuePath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow1/CoreStatItem1/CoreStatValue1',
    },
    {
        key: 'lea' as const,
        label: '統',
        keyPath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow1/CoreStatItem2/CoreStatKey2',
        valuePath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow1/CoreStatItem2/CoreStatValue2',
    },
    {
        key: 'cha' as const,
        label: '魅',
        keyPath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow2/CoreStatItem3/CoreStatKey3',
        valuePath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow2/CoreStatItem3/CoreStatValue3',
    },
    {
        key: 'int' as const,
        label: '智',
        keyPath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow2/CoreStatItem4/CoreStatKey4',
        valuePath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow2/CoreStatItem4/CoreStatValue4',
    },
    {
        key: 'pol' as const,
        label: '政',
        keyPath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow3/CoreStatItem5/CoreStatKey5',
        valuePath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow3/CoreStatItem5/CoreStatValue5',
    },
    {
        key: 'luk' as const,
        label: '運',
        keyPath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow3/CoreStatItem6/CoreStatKey6',
        valuePath: 'OverviewSummaryModules/CoreStatsCard/CoreStatsGrid/CoreStatsRow3/CoreStatItem6/CoreStatValue6',
    },
] as const;

const ROLE_LINE_PATHS = [
    {
        rowPath: 'OverviewSummaryModules/RoleCard/RoleList/RoleLine1',
        bulletPath: 'OverviewSummaryModules/RoleCard/RoleList/RoleLine1/RoleBullet1',
        textPath: 'OverviewSummaryModules/RoleCard/RoleList/RoleLine1/RoleText1',
    },
    {
        rowPath: 'OverviewSummaryModules/RoleCard/RoleList/RoleLine2',
        bulletPath: 'OverviewSummaryModules/RoleCard/RoleList/RoleLine2/RoleBullet2',
        textPath: 'OverviewSummaryModules/RoleCard/RoleList/RoleLine2/RoleText2',
    },
] as const;

const TRAIT_LINE_PATHS = [
    {
        rowPath: 'OverviewSummaryModules/TraitCard/TraitList/TraitLine1',
        bulletPath: 'OverviewSummaryModules/TraitCard/TraitList/TraitLine1/TraitBullet1',
        textPath: 'OverviewSummaryModules/TraitCard/TraitList/TraitLine1/TraitText1',
    },
    {
        rowPath: 'OverviewSummaryModules/TraitCard/TraitList/TraitLine2',
        bulletPath: 'OverviewSummaryModules/TraitCard/TraitList/TraitLine2/TraitBullet2',
        textPath: 'OverviewSummaryModules/TraitCard/TraitList/TraitLine2/TraitText2',
    },
] as const;

export class GeneralDetailOverviewChild extends ChildPanelBase {
    override dataSource = 'overview';
    private readonly _contentBinder = new UIContentBinder();
    private _contentContractRef: ContentContractRef = OVERVIEW_CONTENT_CONTRACT_REF;
    private _contentSchema: ContentContractSchema | null = null;
    private _crestLoadSeq = 0;

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    async onMount(_spec: Record<string, unknown>): Promise<void> {
        const contractRef = this.customProps.contentContractRef as ContentContractRef | undefined;
        this._contentContractRef = contractRef ?? OVERVIEW_CONTENT_CONTRACT_REF;
        this._contentSchema = await this._contentBinder.preloadSchema(this._contentContractRef);
        if (!this._contentSchema) {
            throw new Error(`[OverviewChild] 無法載入 content contract schema: ${this._contentContractRef.schemaId}`);
        }
        UCUFLogger.info(LogCategory.LIFECYCLE, '[OverviewChild] onMount', { host: this.hostNode.name });
        if (this._lastData) {
            this.onDataUpdate(this._lastData);
        }
    }

    onDataUpdate(data: unknown): void {
        const s = data as GeneralDetailOverviewContentState;
        this._lastData = s;
        UCUFLogger.info(LogCategory.LIFECYCLE, '[OverviewChild] onDataUpdate received', { keys: Object.keys(s || {}) });
        if (!this._contentSchema) {
            UCUFLogger.warn(LogCategory.LIFECYCLE, '[OverviewChild] content schema 尚未就緒，延後套用');
            return;
        }
        this._contentBinder.bindWithSchema(
            this.binder,
            this._contentContractRef,
            this._contentSchema,
            s as Record<string, unknown>,
            {
                suppressUnresolvedWarnings: true,
                transformBindPath: (bindPath, fieldKey) => resolveOverviewBindPathForTarget(fieldKey, bindPath, 'unified'),
            },
        );
        this._applyHtmlParitySummary(s);
        applyOverviewAwakeningProgress(this.hostNode, s.awakeningProgress);
        applyOverviewVisualPass(this.hostNode, s.rarityTier, this.skinResolver);
        applyOverviewCrestState(this.hostNode, s.crestState);
        void this._syncOverviewCrestFace(s.crestFaceResource);
        UCUFLogger.info(LogCategory.LIFECYCLE, '[OverviewChild] onDataUpdate applied', { name: s.headerName, rarity: s.rarityLabel });
    }

    validateDataFormat(data: unknown): string | null {
        if (!data || typeof data !== 'object') return 'data must be GeneralDetailOverviewContentState';
        const state = data as Partial<GeneralDetailOverviewContentState>;
        if (typeof state.headerName !== 'string') return 'overview.headerName must be a string';
        if (typeof state.rarityLabel !== 'string') return 'overview.rarityLabel must be a string';
        if (typeof state.rarityTier !== 'string') return 'overview.rarityTier must be a string';
        return null;
    }

    private _applyHtmlParitySummary(state: GeneralDetailOverviewContentState): void {
        for (const item of CORE_STAT_ITEMS) {
            const stat = state.dualLayerStats[item.key];
            const talentValue = stat?.talent?.base ?? stat?.talent?.current ?? null;
            this._setLabelTextAndColor(item.keyPath, item.label, CORE_STAT_KEY_COLORS[item.key]);
            this._setLabelTextAndColor(item.valuePath, this._formatNumber(talentValue), CORE_STAT_VALUE_COLOR);
        }

        this._applyBulletList(
            this._splitSummaryLines(state.roleValue, '定位未定'),
            ROLE_LINE_PATHS,
            ROLE_BULLET_COLOR,
        );

        this._applyBulletList(
            this._splitSummaryLines(state.traitValue, '氣質描述待補'),
            TRAIT_LINE_PATHS,
            TRAIT_BULLET_COLOR,
        );
    }

    private _applyBulletList(
        lines: string[],
        paths: typeof ROLE_LINE_PATHS,
        bulletColor: Color,
    ): void {
        for (let index = 0; index < paths.length; index += 1) {
            const item = paths[index];
            const line = lines[index] ?? '';
            const active = line.trim().length > 0;

            this._setNodeActive(item.rowPath, active);
            if (!active) {
                continue;
            }

            this._setLabelTextAndColor(item.bulletPath, '•', bulletColor);
            this._setLabelTextAndColor(item.textPath, line, LIST_TEXT_COLOR);
        }
    }

    private _setLabelTextAndColor(path: string, text: string, color: Color): void {
        const label = this.binder.getLabelByPath(path);
        if (!label) {
            return;
        }

        label.string = text;
        label.color = color.clone();
    }

    private _setNodeActive(path: string, active: boolean): void {
        const node = this.binder.getNodeByPath(path);
        if (!node) {
            return;
        }

        node.active = active;
    }

    private _splitSummaryLines(value: string | undefined, fallback: string): string[] {
        const lines = (value ?? '')
            .split(/\n+/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        if (lines.length === 0) {
            return [fallback];
        }

        return lines.slice(0, 2);
    }

    private _formatNumber(value: number | null | undefined): string {
        if (value === null || value === undefined) {
            return '--';
        }

        return `${value}`;
    }

    private async _syncOverviewCrestFace(resourcePath: string | undefined): Promise<void> {
        const loadSeq = ++this._crestLoadSeq;
        const normalizedPath = resourcePath?.trim();

        if (!normalizedPath) {
            applyOverviewEmptyCrestFace(this.hostNode);
            return;
        }

        const frame = await services().resource.loadSpriteFrame(normalizedPath, { preferTextureFallback: true }).catch(() => null);
        if (loadSeq !== this._crestLoadSeq) {
            return;
        }

        if (frame) {
            applyOverviewLoadedCrestFace(this.hostNode, frame);
            return;
        }

        applyOverviewFallbackCrestFace(this.hostNode);
    }
}