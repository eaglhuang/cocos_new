/**
 * GeneralDetailBasicsChild
 *
 * UCUF M4 ChildPanel — 基本資料 Tab（基本/Basics）。
 * 對應 fragment: gd-tab-basics.json
 * dataSource: 'config'
 */
import { Label } from 'cc';
import type { Node } from 'cc';
import { ChildPanelBase } from '../../core/ChildPanelBase';
import type { UISkinResolver } from '../../core/UISkinResolver';
import type { UITemplateBinder } from '../../core/UITemplateBinder';
import type { GeneralConfig } from '../../../core/models/GeneralUnit';
import { mask, formatFaction, formatRole, formatStatus } from './GeneralDetailFormatters';
import { UCUFLogger, LogCategory } from '../../core/UCUFLogger';

export class GeneralDetailBasicsChild extends ChildPanelBase {
    override dataSource = 'config';
    private static readonly ROOT_PATH = 'TabBasicsContent';

    // ─── 快取 Label 引用 ──────────────────────────────────────────────────────
    private _lUid!:      Label;
    private _lName!:     Label;
    private _lTitle!:    Label;
    private _lTemplate!: Label;
    private _lFaction!:  Label;
    private _lGender!:   Label;
    private _lAge!:      Label;
    private _lRole!:     Label;
    private _lStatus!:   Label;
    private _lLifespan!: Label;
    private _lVitality!: Label;
    private _lSource!:   Label;

    _lastData: GeneralConfig | null = null;

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    async onMount(_spec: Record<string, unknown>): Promise<void> {
        const h = this.hostNode;
        this._lUid      = this._label(h, 'UidValue');
        this._lName     = this._label(h, 'NameValue');
        this._lTitle    = this._label(h, 'TitleValue');
        this._lTemplate = this._label(h, 'TemplateValue');
        this._lFaction  = this._label(h, 'FactionValue');
        this._lGender   = this._label(h, 'GenderValue');
        this._lAge      = this._label(h, 'AgeValue');
        this._lRole     = this._label(h, 'RoleValue');
        this._lStatus   = this._label(h, 'StatusValue');
        this._lLifespan = this._label(h, 'LifespanValue');
        this._lVitality = this._label(h, 'VitalityValue');
        this._lSource   = this._label(h, 'SourceValue');
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    onDataUpdate(data: unknown): void {
        this._lastData = data as GeneralConfig;
        const cfg = this._lastData;
        this._set(this._lUid,      `${this.t('ui.general.basics.uid')}${cfg.id}`);
        this._set(this._lName,     `${this.t('ui.general.basics.name')}${cfg.name}`);
        this._set(this._lTitle,    `${this.t('ui.general.basics.title')}${mask(cfg.title, this.t('ui.general.basics.title_locked'))}`);
        this._set(this._lTemplate, `${this.t('ui.general.basics.template')}${mask(cfg.templateId)}`);
        this._set(this._lFaction,  `${this.t('ui.general.basics.faction')}${formatFaction(cfg.faction)}`);
        this._set(this._lGender,   `${this.t('ui.general.basics.gender')}${mask(cfg.gender)}`);
        this._set(this._lAge,
            `${this.t('ui.general.basics.age')}${cfg.age !== undefined
                ? `${cfg.age} ${this.t('ui.general.basics.age_unit')}`
                : this.t('ui.general.basics.unlocked')}`
        );
        this._set(this._lRole,     `${this.t('ui.general.basics.role')}${formatRole(cfg.role)}`);
        this._set(this._lStatus,   `${this.t('ui.general.basics.status')}${formatStatus(cfg.status)}`);
        this._set(this._lLifespan, `${this.t('ui.general.basics.lifespan')}${this.t('ui.general.basics.lifespan_locked')}`);
        this._set(this._lVitality,
            `${this.t('ui.general.basics.vitality')}${cfg.vitality !== undefined && cfg.maxVitality !== undefined
                ? `${cfg.vitality}/${cfg.maxVitality}`
                : this.t('ui.general.basics.unlocked')}`
        );
        this._set(this._lSource, `${this.t('ui.general.basics.source')}${mask(cfg.source, this.t('ui.general.basics.source_unlisted'))}`);
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

    // ─── 工具 ────────────────────────────────────────────────────────────────

    private _label(root: Node, name: string): Label {
        const fullPath = `${GeneralDetailBasicsChild.ROOT_PATH}/${name}`;
        const node = root.getChildByPath(fullPath);
        if (!node) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[BasicsChild] 缺少必要節點 ${fullPath}`);
            throw new Error(`[BasicsChild] 缺少必要節點 ${fullPath}`);
        }
        const lbl = node.getComponent(Label);
        if (!lbl) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[BasicsChild] 節點 ${fullPath} 缺少 Label 元件`);
            throw new Error(`[BasicsChild] 節點 ${fullPath} 缺少 Label 元件`);
        }
        return lbl;
    }

    private _set(label: Label | null, text: string): void {
        if (label) label.string = text;
    }
}
