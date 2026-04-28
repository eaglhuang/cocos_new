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
        this._lUid      = this._label(h, 'IdentityRowOne/UidCard/UidValue');
        this._lName     = this._label(h, 'IdentityRowOne/NameCard/NameValue');
        this._lTitle    = this._label(h, 'IdentityRowTwo/TitleCard/TitleValue');
        this._lTemplate = this._label(h, 'IdentityRowTwo/TemplateCard/TemplateValue');
        this._lFaction  = this._label(h, 'IdentityRowThree/FactionCard/FactionValue');
        this._lGender   = this._label(h, 'IdentityRowThree/GenderCard/GenderValue');
        this._lAge      = this._label(h, 'StatusRowOne/AgeCard/AgeValue');
        this._lRole     = this._label(h, 'StatusRowOne/RoleCard/RoleValue');
        this._lStatus   = this._label(h, 'StatusRowTwo/StatusCard/StatusValue');
        this._lLifespan = this._label(h, 'StatusRowThree/LifespanCard/LifespanValue');
        this._lVitality = this._label(h, 'StatusRowTwo/VitalityCard/VitalityValue');
        this._lSource   = this._label(h, 'StatusRowThree/SourceCard/SourceValue');
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    onDataUpdate(data: unknown): void {
        this._lastData = data as GeneralConfig;
        const cfg = this._lastData;
        this._set(this._lUid, cfg.id);
        this._set(this._lName, cfg.name);
        this._set(this._lTitle, mask(cfg.title, this.t('ui.general.basics.title_locked')));
        this._set(this._lTemplate, mask(cfg.templateId));
        this._set(this._lFaction, formatFaction(cfg.faction));
        this._set(this._lGender, mask(cfg.gender));
        this._set(this._lAge,
            cfg.age !== undefined
                ? `${cfg.age} ${this.t('ui.general.basics.age_unit')}`
                : this.t('ui.general.basics.unlocked')
        );
        this._set(this._lRole, formatRole(cfg.role));
        this._set(this._lStatus, formatStatus(cfg.status));
        this._set(this._lLifespan, this.t('ui.general.basics.lifespan_locked'));
        this._set(this._lVitality,
            cfg.vitality !== undefined && cfg.maxVitality !== undefined
                ? `${cfg.vitality}/${cfg.maxVitality}`
                : this.t('ui.general.basics.unlocked')
        );
        this._set(this._lSource, mask(cfg.source, this.t('ui.general.basics.source_unlisted')));
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
