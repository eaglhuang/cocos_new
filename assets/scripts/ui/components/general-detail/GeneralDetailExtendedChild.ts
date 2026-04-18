/**
 * GeneralDetailExtendedChild
 *
 * UCUF M4 ChildPanel — 延伸 Tab（Extended）。
 * 對應 fragment: gd-tab-extended.json
 * dataSource: 'config'
 */
import { Label } from 'cc';
import type { Node } from 'cc';
import { ChildPanelBase } from '../../core/ChildPanelBase';
import type { UISkinResolver } from '../../core/UISkinResolver';
import type { UITemplateBinder } from '../../core/UITemplateBinder';
import type { GeneralConfig } from '../../../core/models/GeneralUnit';
import { mask, formatList } from './GeneralDetailFormatters';
import { UCUFLogger, LogCategory } from '../../core/UCUFLogger';

export class GeneralDetailExtendedChild extends ChildPanelBase {
    override dataSource = 'config';
    private static readonly ROOT_PATH = 'TabExtendedContent';

    private _lHp!: Label;
    private _lSp!: Label;
    private _lAtk!: Label;
    private _lFlags!: Label;
    private _lNotes!: Label;
    private _lDev!: Label;
    _lastData: GeneralConfig | null = null;

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    async onMount(_spec: Record<string, unknown>): Promise<void> {
        const h = this.hostNode;
        this._lHp = this._label(h, 'CurrentHpValue');
        this._lSp = this._label(h, 'CurrentSpValue');
        this._lAtk = this._label(h, 'AttackBonusValue');
        this._lFlags = this._label(h, 'HiddenFlagsValue');
        this._lNotes = this._label(h, 'NotesValue');
        this._lDev = this._label(h, 'DevNoteValue');
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    onDataUpdate(data: unknown): void {
        this._lastData = data as GeneralConfig;
        const cfg = this._lastData;
        const hp = cfg.currentHp ?? cfg.hp ?? 0;
        const hpMax = cfg.hp ?? hp;
        const sp = cfg.currentSp ?? cfg.initialSp ?? 0;
        const spMax = cfg.maxSp ?? 0;

        this._set(this._lHp,    `${this.t('ui.general.extended.hp')}${hp}/${hpMax}`);
        this._set(this._lSp,    `${this.t('ui.general.extended.sp')}${sp}/${spMax}`);
        this._set(this._lAtk,   `${this.t('ui.general.extended.atk')}+${Math.floor((cfg.attackBonus ?? 0) * 100)}%`);
        this._set(this._lFlags, `${this.t('ui.general.extended.hidden_flags')}\n${formatList(cfg.hiddenFlags, this.t('ui.general.extended.hidden_flags_list'))}`);
        this._set(this._lNotes, `${this.t('ui.general.extended.notes')}${mask(cfg.notes, this.t('ui.general.extended.notes_empty'))}`);
        this._set(this._lDev,   `${this.t('ui.general.extended.dev_note')}${mask(cfg.devNote, this.t('ui.general.extended.dev_note_default'))}`);
    }

    protected override _refreshLabels(): void {
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    validateDataFormat(data: unknown): string | null {
        if (!data || typeof data !== 'object') return 'data must be a GeneralConfig object';
        const cfg = data as Partial<GeneralConfig>;
        if (typeof cfg.id !== 'string') return 'config.id must be a string';
        return null;
    }

    private _label(root: Node, path: string): Label {
        const fullPath = `${GeneralDetailExtendedChild.ROOT_PATH}/${path}`;
        const label = root.getChildByPath(fullPath)?.getComponent(Label);
        if (!label) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[ExtendedChild] 必要 Label 缺失 ${fullPath}`);
            throw new Error(`[ExtendedChild] 必要 Label 缺失 ${fullPath}`);
        }
        return label;
    }

    private _set(label: Label | null, text: string): void {
        if (label) label.string = text;
    }
}