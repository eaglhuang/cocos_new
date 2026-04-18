/**
 * GeneralDetailStatsChild
 *
 * UCUF M4 ChildPanel — 屬性 Tab（Stats）。
 * 對應 fragment: gd-tab-stats.json
 * dataSource: 'config'
 */
import { Label } from 'cc';
import type { Node } from 'cc';
import { ChildPanelBase } from '../../core/ChildPanelBase';
import type { UISkinResolver } from '../../core/UISkinResolver';
import type { UITemplateBinder } from '../../core/UITemplateBinder';
import type { GeneralConfig } from '../../../core/models/GeneralUnit';
import { formatStatValue, buildRoleSummary, resolveStat } from './GeneralDetailFormatters';
import { UCUFLogger, LogCategory } from '../../core/UCUFLogger';

export class GeneralDetailStatsChild extends ChildPanelBase {
    override dataSource = 'config';
    private static readonly ROOT_PATH = 'TabStatsContent';

    private _lStr!:  Label;
    private _lInt!:  Label;
    private _lLea!:  Label;
    private _lPol!:  Label;
    private _lCha!:  Label;
    private _lLuk!:  Label;
    private _lRole!: Label;

    _lastData: GeneralConfig | null = null;

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    async onMount(_spec: Record<string, unknown>): Promise<void> {
        const h = this.hostNode;
        this._lStr  = this._label(h, 'StrValue');
        this._lInt  = this._label(h, 'IntValue');
        this._lLea  = this._label(h, 'LeaValue');
        this._lPol  = this._label(h, 'PolValue');
        this._lCha  = this._label(h, 'ChaValue');
        this._lLuk  = this._label(h, 'LukValue');
        this._lRole = this._label(h, 'StatsRoleValue');
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    onDataUpdate(data: unknown): void {
        this._lastData = data as GeneralConfig;
        const cfg = this._lastData;
        const str = resolveStat(cfg, 'str');
        const int = resolveStat(cfg, 'int');
        const lea = resolveStat(cfg, 'lea');
        const pol = resolveStat(cfg, 'pol');
        const cha = resolveStat(cfg, 'cha');
        const luk = resolveStat(cfg, 'luk');

        this._set(this._lStr,  `${this.t('ui.general.stats.str')}${formatStatValue(str)}`);
        this._set(this._lInt,  `${this.t('ui.general.stats.int')}${formatStatValue(int)}`);
        this._set(this._lLea,  `${this.t('ui.general.stats.lea')}${formatStatValue(lea)}`);
        this._set(this._lPol,  `${this.t('ui.general.stats.pol')}${formatStatValue(pol)}`);
        this._set(this._lCha,  `${this.t('ui.general.stats.cha')}${formatStatValue(cha)}`);
        this._set(this._lLuk,  `${this.t('ui.general.stats.luk')}${formatStatValue(luk)}`);
        this._set(this._lRole, `${this.t('ui.general.stats.role_summary')}${buildRoleSummary(str, int, lea)}`);
    }

    protected override _refreshLabels(): void {
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    validateDataFormat(data: unknown): string | null {
        if (!data || typeof data !== 'object') return 'data must be a GeneralConfig object';
        return null;
    }

    private _label(root: Node, name: string): Label {
        const fullPath = `${GeneralDetailStatsChild.ROOT_PATH}/${name}`;
        const label = root.getChildByPath(fullPath)?.getComponent(Label);
        if (!label) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[StatsChild] 必要 Label 缺失 ${fullPath}`);
            throw new Error(`[StatsChild] 必要 Label 缺失 ${fullPath}`);
        }
        return label;
    }

    private _set(label: Label | null, text: string): void {
        if (label) label.string = text;
    }
}
