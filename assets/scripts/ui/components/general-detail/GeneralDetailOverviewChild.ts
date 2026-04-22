/**
 * GeneralDetailOverviewChild
 *
 * UCUF M4 ChildPanel — 總覽 Tab（Overview）。
 * 對應 fragment: gd-tab-overview.json
 * dataSource: 'overview'
 */
import type { Node } from 'cc';
import { ChildPanelBase } from '../../core/ChildPanelBase';
import { UIContentBinder } from '../../core/UIContentBinder';
import type { ContentContractSchema } from '../../core/UIContentBinder';
import type { UISkinResolver } from '../../core/UISkinResolver';
import type { ContentContractRef } from '../../core/UISpecTypes';
import type { UITemplateBinder } from '../../core/UITemplateBinder';
import type { GeneralDetailOverviewContentState } from '../GeneralDetailOverviewMapper';
import { UCUFLogger, LogCategory } from '../../core/UCUFLogger';
import { OVERVIEW_CONTENT_CONTRACT_REF, resolveOverviewBindPathForTarget } from './GeneralDetailOverviewBindPathPolicy';
import { applyOverviewAwakeningProgress, applyOverviewVisualPass } from './GeneralDetailOverviewVisuals';

export class GeneralDetailOverviewChild extends ChildPanelBase {
    override dataSource = 'overview';
    private readonly _contentBinder = new UIContentBinder();
    private _contentContractRef: ContentContractRef = OVERVIEW_CONTENT_CONTRACT_REF;
    private _contentSchema: ContentContractSchema | null = null;

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
        applyOverviewAwakeningProgress(this.hostNode, s.awakeningProgress);
        applyOverviewVisualPass(this.hostNode, s.rarityTier);
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
}