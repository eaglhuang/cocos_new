/**
 * GeneralDetailBloodlineChild
 *
 * UCUF M4 ChildPanel — 血脈 Tab（Bloodline）。
 * 對應 fragment: gd-tab-bloodline.json
 * dataSource: 'config'
 *
 * AncestorTree 的動態渲染委託給已存在的 BloodlineTreePanel；
 * 此 ChildPanel 負責附掛元件並轉送 generalId。
 */
import { Label } from 'cc';
import type { Node } from 'cc';
import { ChildPanelBase } from '../../core/ChildPanelBase';
import type { UISkinResolver } from '../../core/UISkinResolver';
import type { UITemplateBinder } from '../../core/UITemplateBinder';
import type { GeneralConfig } from '../../../core/models/GeneralUnit';
import { mask, formatGene } from './GeneralDetailFormatters';
import { BloodlineTreePanel } from '../../panels/BloodlineTreePanel';
import { UCUFLogger, LogCategory } from '../../core/UCUFLogger';

export class GeneralDetailBloodlineChild extends ChildPanelBase {
    override dataSource = 'config';
    private static readonly ROOT_PATH = 'TabBloodlineContent';

    private _lEpRating!:  Label;
    private _lBloodline!: Label;
    private _lParents!:   Label;
    private _lAncestors!: Label;
    private _lGenes:      Label[] = [];
    private _lAwakening!: Label;
    private _treePanel: BloodlineTreePanel | null = null;
    _lastData: GeneralConfig | null = null;

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    async onMount(_spec: Record<string, unknown>): Promise<void> {
        const h = this.hostNode;

        this._lEpRating  = this._label(h, 'BloodlineSummaryCard/EpRatingValue');
        this._lBloodline = this._label(h, 'BloodlineSummaryCard/BloodlineValue');
        this._lParents   = this._label(h, 'BloodlineSummaryCard/ParentsValue');
        this._lAncestors = this._label(h, 'BloodlineSummaryCard/AncestorsValue');
        this._lAwakening = this._label(h, 'AwakeningCard/AwakeningValue');

        for (let i = 1; i <= 5; i++) {
            this._lGenes.push(this._label(h, `GeneListCard/Gene${i}Value`));
        }

        // 掛載 BloodlineTreePanel 到 AncestorTree 根節點
        const treeRoot = this._requireNode(h, 'AncestorTree');
        let panel = treeRoot.getComponent(BloodlineTreePanel);
        if (!panel) panel = treeRoot.addComponent(BloodlineTreePanel);
        panel.gen1Container = treeRoot.getChildByPath('Gen1Container');
        panel.gen2Container = treeRoot.getChildByPath('Gen2Container');
        panel.gen3Container = treeRoot.getChildByPath('Gen3Container');
        this._treePanel = panel;
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    onDataUpdate(data: unknown): void {
        this._lastData = data as GeneralConfig;
        const cfg = this._lastData;

        this._set(this._lEpRating,
            `${this.t('ui.general.bloodline.ep_rating')}${cfg.ep !== undefined ? `${cfg.ep}${cfg.epRating ? ` · ${cfg.epRating}` : ''}` : this.t('ui.general.bloodline.ep_locked')}`
        );
        this._set(this._lBloodline, `${this.t('ui.general.bloodline.id')}${mask(cfg.bloodlineId)}`);
        this._set(this._lParents,   `${this.t('ui.general.bloodline.parents')}${mask(cfg.parentsSummary, this.t('ui.general.bloodline.parents_collapsed'))}`);
        this._set(this._lAncestors, `${this.t('ui.general.bloodline.ancestors')}${mask(cfg.ancestorsSummary, this.t('ui.general.bloodline.ancestors_hint'))}`);

        for (let i = 0; i < 5; i++) {
            this._set(this._lGenes[i], formatGene(i + 1, cfg.genes?.[i]));
        }

        this._set(this._lAwakening, `${this.t('ui.general.bloodline.awakening')}${mask(cfg.awakeningTitle, this.t('ui.general.bloodline.awakening_locked'))}`);

        // AncestorTree 動態載入
        if (this._treePanel) {
            void this._treePanel.loadForGeneral(cfg.id).catch(() => {
                this._populateLegacyTree(cfg);
            });
        }
    }

    protected override _refreshLabels(): void {
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    validateDataFormat(data: unknown): string | null {
        if (!data || typeof data !== 'object') return 'data must be a GeneralConfig object';
        return null;
    }

    // ─── Legacy 祖先樹回退 ────────────────────────────────────────────────────

    private _populateLegacyTree(cfg: GeneralConfig): void {
        const tree = (cfg as any).ancestorTree;
        if (!tree) return;
        const base = this.hostNode.getChildByPath(`${GeneralDetailBloodlineChild.ROOT_PATH}/AncestorTree`);
        if (!base) return;

        for (let i = 0; i < 8; i++) {
            const n = tree.gen1?.[i];
            this._setPath(base, `Gen1Container/G1_${i}/Txt`, n ? `${n.name}\n(${n.gene?.displayName ?? '?'})` : '—');
        }
        for (let i = 0; i < 4; i++) {
            const n = tree.gen2?.[i];
            this._setPath(base, `Gen2Container/G2_${i}/Txt`, n ? `${n.name}\n(${n.gene?.displayName ?? '?'})` : '—');
        }
        for (let i = 0; i < 2; i++) {
            const n = tree.gen3?.[i];
            this._setPath(base, `Gen3Container/G3_${i}/Txt`, n ? `${n.name}\n(${n.gene?.displayName ?? '?'})` : '—');
        }
    }

    private _setPath(base: Node, path: string, text: string): void {
        const lbl = base.getChildByPath(path)?.getComponent(Label);
        if (lbl) lbl.string = text;
    }

    private _label(root: Node, path: string): Label {
        const fullPath = `${GeneralDetailBloodlineChild.ROOT_PATH}/${path}`;
        const label = root.getChildByPath(fullPath)?.getComponent(Label);
        if (!label) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[BloodlineChild] 必要 Label 缺失 ${fullPath}`);
            throw new Error(`[BloodlineChild] 必要 Label 缺失 ${fullPath}`);
        }
        return label;
    }

    private _requireNode(root: Node, path: string): Node {
        const fullPath = `${GeneralDetailBloodlineChild.ROOT_PATH}/${path}`;
        const node = root.getChildByPath(fullPath);
        if (!node) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[BloodlineChild] 缺少必要節點 ${fullPath}`);
            throw new Error(`[BloodlineChild] 缺少必要節點 ${fullPath}`);
        }
        return node;
    }

    private _set(label: Label | null, text: string): void {
        if (label) label.string = text;
    }
}
