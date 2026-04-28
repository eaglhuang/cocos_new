// @spec-source → 見 docs/cross-reference-index.md  (UCUF M12)
/**
 * GeneralListComposite — 武將列表面板（CompositePanel 版）
 *
 * UCUF M12 — 將 GeneralListPanel（UIPreviewBuilder）遷移至 CompositePanel 架構。
 *
 * 遷移重點：
 *   - buildScreen(layout, skin, i18n, tokens) → mount('general-list-screen')
 *   - onReady(binder)                          → _onAfterBuildReady(binder)
 *   - 公開 API 完全與原 GeneralListPanel 相同（向後相容）
 *
 * Unity 對照：GeneralRosterPanel，排序可重複點擊欄頭切換升降冪
 */
import { _decorator, Node, Label, Button, UITransform, Layout } from 'cc';
import type { GeneralConfig } from '../../core/models/GeneralUnit';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { UCUFLogger, LogCategory } from '../core/UCUFLogger';

const { ccclass } = _decorator;

// 欄位排序 key（對應 header col name → GeneralConfig 欄位）
type SortKey = 'name' | 'gender' | 'age' | 'str' | 'int' | 'lea' | 'pol' | 'cha' | 'luk' | 'troop' | 'faction';
type GeneralFilterMode = 'all' | 'player' | 'enemy';

// 兵種等級順序，供排序比較
const APTITUDE_ORDER: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

// 每個 header col name → 對應 SortKey
const COL_SORT_MAP: Record<string, SortKey> = {
    ColName:    'name',
    ColGender:  'gender',
    ColAge:     'age',
    ColStr:     'str',
    ColInt:     'int',
    ColLea:     'lea',
    ColPol:     'pol',
    ColCha:     'cha',
    ColLuk:     'luk',
    ColTroop:   'troop',
    ColFaction: 'faction',
};

const HEADER_TO_ROW_MAP: Record<string, string> = {
    ColName: 'Name',
    ColGender: 'Gender',
    ColAge: 'Age',
    ColStr: 'Str',
    ColInt: 'Int',
    ColLea: 'Lea',
    ColPol: 'Pol',
    ColCha: 'Cha',
    ColLuk: 'Luk',
    ColTroop: 'Troop',
    ColFaction: 'Faction',
};

// 欄頭顯示文字
const DEFAULT_HEADER_LABELS: Record<SortKey, string> = {
    name:    '武將姓名',
    gender:  '性別',
    age:     '年齡',
    str:     '武力',
    int:     '智力',
    lea:     '統率',
    pol:     '政治',
    cha:     '魅力',
    luk:     '運氣',
    troop:   '最強兵種',
    faction: '陣營',
};

const LIST_ROOT_NAME = 'GeneralListRoot';
const LIST_PANEL_REL_PATH = 'MainContainer/ListPanel';
const LIST_REL_PATH = `${LIST_PANEL_REL_PATH}/DataList`;
const HEADER_ROW_REL_PATH = `${LIST_PANEL_REL_PATH}/ColumnHeaderRow`;
const CONTENT_REL_PATH = `${LIST_REL_PATH}/view/Content`;

@ccclass('GeneralListComposite')
export class GeneralListComposite extends CompositePanel {

    public static readonly GENERAL_FILTER_ALL = 'all';
    public static readonly GENERAL_FILTER_PLAYER = 'player';
    public static readonly GENERAL_FILTER_ENEMY = 'enemy';

    /** 選中武將時的回呼，外部（如場景/父面板）設定 */
    public onSelectGeneral: ((config: GeneralConfig) => void) | null = null;
    public onRequestClose: (() => void) | null = null;

    private _isMounted   = false;
    private _binder:    UITemplateBinder | null = null;
    private _allGenerals: GeneralConfig[] = [];
    private _filterMode: GeneralFilterMode = 'all';
    private _sortKey: SortKey | null = null;
    private _sortAsc     = false;
    private _headerBaseLabels: Partial<Record<SortKey, string>> = {};
    private readonly _renderedRowsByGeneralId = new Map<string, Node>();

    // ── 生命週期 ─────────────────────────────────────────────

    protected onDestroy(): void {
        this.unmount();
        this._isMounted = false;
        this._binder = null;
    }

    // ── 公開 API ─────────────────────────────────────────────

    /**
     * 顯示武將列表。
     * 初次呼叫時掛載畫面；後續呼叫僅刷新列表。
     */
    public async show(generals: GeneralConfig[], filterMode: GeneralFilterMode = 'all'): Promise<void> {
        this.node.active = true;
        this._allGenerals = generals;
        this._filterMode = filterMode;

        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralListComposite] show start', {
            generalCount: generals.length,
            filterMode,
            isMounted: this._isMounted,
            nodeActive: this.node.active,
        });

        if (!this._isMounted) {
            this._clearLegacySceneChildren();
            await this.mount('general-list-screen');
            this._isMounted = true;
            UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralListComposite] mount completed', {
                childCount: this.node.children.length,
            });
        }

        await this._repopulate();
        this.playEnterTransition(this.node);
        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralListComposite] show complete', {
            rowCount: this._allGenerals.length,
            sortKey: this._sortKey,
            sortAsc: this._sortAsc,
        });
    }

    public hide(): void {
        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralListComposite] hide', {
            nodeActive: this.node.active,
        });
        this.playExitTransition(this.node, undefined, () => {
            this.node.active = false;
        });
    }

    public requestClose(): void {
        if (this.onRequestClose) {
            this.onRequestClose();
            return;
        }
        this.hide();
    }

    public selectGeneralById(generalId: string): boolean {
        const normalizedId = generalId.trim();
        if (!normalizedId) {
            return false;
        }

        const row = this._renderedRowsByGeneralId.get(normalizedId);
        if (!row) {
            UCUFLogger.warn(LogCategory.LIFECYCLE, '[GeneralListComposite] selectGeneralById missing rendered row', {
                generalId: normalizedId,
            });
            return false;
        }

        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralListComposite] selectGeneralById emit row click', {
            generalId: normalizedId,
            rowName: row.name,
        });
        row.emit(Button.EventType.CLICK);
        return true;
    }

    public hasRenderedGeneralById(generalId: string): boolean {
        const normalizedId = generalId.trim();
        return !!normalizedId && this._renderedRowsByGeneralId.has(normalizedId);
    }

    // ── CompositePanel 鉤子 ───────────────────────────────────

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._binder = binder;
        binder.getButton('BtnBack')?.node.on(Button.EventType.CLICK, this.requestClose, this);
        this._bindSortHandlers();
    }

    // ── 私有邏輯 ─────────────────────────────────────────────

    /** 清空並重新填入列表 */
    private async _repopulate(): Promise<void> {
        const sorted = this._sortedList();
        this._renderedRowsByGeneralId.clear();
        const content = this.node.getChildByPath(this._mainPath(CONTENT_REL_PATH));
        if (content) {
            for (const child of [...content.children]) {
                child.removeFromParent();
                child.destroy();
            }
        }
        UCUFLogger.info(LogCategory.DATA, '[GeneralListComposite] repopulate', {
            rowCount: sorted.length,
            listPath: this._mainPath(LIST_REL_PATH),
            sortKey: this._sortKey,
            sortAsc: this._sortAsc,
            filterMode: this._filterMode,
        });
        await this.populateList(this._mainPath(LIST_REL_PATH), sorted, (g: GeneralConfig, row: Node) => {
            const set = (name: string, val: string | number) => {
                const lbl = this._getRowLabel(row, name);
                if (lbl) lbl.string = String(val);
            };
            set('Name',    g.name ?? '—');
            set('Gender',  this._genderZh(g.gender));
            set('Age',     g.age   ?? '—');
            set('Str',     g.str   ?? 0);
            set('Int',     g.int   ?? 0);
            set('Lea',     g.lea   ?? 0);
            set('Pol',     g.pol   ?? 0);
            set('Cha',     g.cha   ?? 0);
            set('Luk',     g.luk   ?? 0);
            set('Troop',   this._bestTroop(g));
            set('Faction', g.faction ?? '—');
            this._renderedRowsByGeneralId.set(g.id, row);

            const button = row.getComponent(Button) ?? row.addComponent(Button);
            button.transition = Button.Transition.NONE;
            button.node.off(Button.EventType.CLICK);
            button.node.on(Button.EventType.CLICK, () => {
                UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralListComposite] row clicked', {
                    generalId: g.id,
                    generalName: g.name,
                    rowName: row.name,
                });
                this.onSelectGeneral?.(g);
            }, this);
        });
        this._syncContentWidth();
        this._updateHeaderLabels();
        this._syncHeaderColumnWidths();
    }

    /** 綁定欄頭排序按鈕 */
    private _bindSortHandlers(): void {
        const headerRow = this.node.getChildByPath(this._mainPath(HEADER_ROW_REL_PATH));
        if (!headerRow) return;

        for (const colNode of headerRow.children) {
            const sortKey = COL_SORT_MAP[colNode.name];
            if (!sortKey) continue;
            const label = colNode.getComponent(Label);
            const baseLabel = label?.string?.replace(/[▲▼]$/, '')?.trim();
            if (baseLabel) {
                this._headerBaseLabels[sortKey] = baseLabel;
            }
            const button = colNode.getComponent(Button) ?? colNode.addComponent(Button);
            button.transition = Button.Transition.NONE;
            button.node.off(Button.EventType.CLICK);
            button.node.on(Button.EventType.CLICK, () => {
                if (this._sortKey === sortKey) {
                    this._sortAsc = !this._sortAsc;
                } else {
                    this._sortKey = sortKey;
                    this._sortAsc = false;
                }
                void this._repopulate();
            }, this);
        }
    }

    /** 清除場景中遺留的舊版 GeneralList 子節點，避免與新 screen 疊在一起。 */
    private _clearLegacySceneChildren(): void {
        for (const child of [...this.node.children]) {
            child.destroy();
        }
    }

    private _syncContentWidth(): void {
        const listNode = this.node.getChildByPath(this._mainPath(LIST_REL_PATH));
        const contentNode = this.node.getChildByPath(this._mainPath(CONTENT_REL_PATH));
        const listTransform = listNode?.getComponent(UITransform);
        const contentTransform = contentNode?.getComponent(UITransform);
        if (!listTransform || !contentTransform) {
            return;
        }
        if (Math.abs(contentTransform.width - listTransform.width) < 0.5) {
            return;
        }
        contentTransform.setContentSize(listTransform.width, contentTransform.height);
        contentNode.getComponent(Layout)?.updateLayout(true);
    }

    /** 更新欄頭文字顯示當前排序方向 */
    private _updateHeaderLabels(): void {
        const headerRow = this.node.getChildByPath(this._mainPath(HEADER_ROW_REL_PATH));
        if (!headerRow) return;

        for (const colNode of headerRow.children) {
            const sortKey = COL_SORT_MAP[colNode.name];
            if (!sortKey) continue;
            const lbl  = colNode.getComponent(Label);
            if (!lbl)  continue;
            const base = this._headerBaseLabels[sortKey] ?? DEFAULT_HEADER_LABELS[sortKey];
            if (this._sortKey === sortKey) {
                lbl.string = `${base}${this._sortAsc ? '▲' : '▼'}`;
            } else {
                lbl.string = base;
            }
        }
    }

    private _syncHeaderColumnWidths(): void {
        const headerRow = this.node.getChildByPath(this._mainPath(HEADER_ROW_REL_PATH));
        const contentNode = this.node.getChildByPath(this._mainPath(CONTENT_REL_PATH));
        const firstRow = contentNode?.children?.[0] ?? null;
        if (!headerRow || !firstRow) return;

        let applied = false;
        for (const headerNode of headerRow.children) {
            const rowNodeName = HEADER_TO_ROW_MAP[headerNode.name];
            if (!rowNodeName) continue;
            const rowNode = firstRow.getChildByName(rowNodeName);
            const headerTransform = headerNode.getComponent(UITransform);
            const rowTransform = rowNode?.getComponent(UITransform);
            if (!headerTransform || !rowTransform || rowTransform.width <= 0) continue;
            if (Math.abs(headerTransform.width - rowTransform.width) < 0.5) continue;
            headerTransform.setContentSize(rowTransform.width, headerTransform.height);
            applied = true;
        }

        if (applied) {
            headerRow.getComponent(Layout)?.updateLayout(true);
        }
    }

    // ── 排序 ─────────────────────────────────────────────────

    private _sortedList(): GeneralConfig[] {
        const list = this._allGenerals.filter((general) => {
            switch (this._filterMode) {
                case 'player':
                    return general.faction === 'player';
                case 'enemy':
                    return general.faction === 'enemy';
                case 'all':
                default:
                    return true;
            }
        });
        if (!this._sortKey) return list;
        const key = this._sortKey;
        const asc = this._sortAsc;

        list.sort((a, b) => {
            let va: unknown;
            let vb: unknown;

            if (key === 'troop') {
                const rankOf = (g: GeneralConfig) => {
                    const grades = Object.values(g.troopAptitude ?? {});
                    return grades.length > 0
                        ? Math.max(...grades.map(gr => APTITUDE_ORDER[gr as string] ?? 0))
                        : 0;
                };
                va = rankOf(a); vb = rankOf(b);
            } else {
                va = (a as unknown as Record<string, unknown>)[key];
                vb = (b as unknown as Record<string, unknown>)[key];
            }

            if (typeof va === 'number' && typeof vb === 'number') {
                return asc ? va - vb : vb - va;
            }
            const sa = String(va ?? '');
            const sb = String(vb ?? '');
            return asc ? sa.localeCompare(sb, 'zh-TW') : sb.localeCompare(sa, 'zh-TW');
        });

        return list;
    }

    // ── 工具 ─────────────────────────────────────────────────

    private _getRowLabel(row: Node, nodeName: string): Label | null {
        return row.getChildByName(nodeName)?.getComponent(Label) ?? null;
    }

    private _resolveMainRoot(): Node | null {
        return this.node.getChildByPath(`__safeArea/${LIST_ROOT_NAME}`)
            ?? this.node.getChildByName(LIST_ROOT_NAME);
    }

    private _mainPath(path: string): string {
        const rootPath = this._resolveMainRoot()?.parent?.name === '__safeArea'
            ? `__safeArea/${LIST_ROOT_NAME}`
            : LIST_ROOT_NAME;
        return `${rootPath}/${path}`;
    }

    private _genderZh(gender: string | undefined): string {
        if (gender === '男' || gender === 'male')   return '男';
        if (gender === '女' || gender === 'female') return '女';
        return '—';
    }

    private _bestTroop(g: GeneralConfig): string {
        const apt = g.troopAptitude;
        if (!apt) return '—';
        const TROOP_ZH: Record<string, string> = {
            CAVALRY:  '騎兵', INFANTRY: '步兵', ARCHER:   '弓兵',
            SIEGE:    '攻城', NAVY:     '水軍', CHARIOT:  '戰車',
            ENGINEER: '工兵',
        };
        let bestKey = '';
        let bestRank = -1;
        for (const [tKey, grade] of Object.entries(apt)) {
            const rank = APTITUDE_ORDER[grade as string] ?? 0;
            if (rank > bestRank) { bestRank = rank; bestKey = tKey; }
        }
        if (!bestKey) return '—';
        const zh    = TROOP_ZH[bestKey] ?? bestKey;
        const grade = apt[bestKey];
        return `${zh} ${grade}`;
    }
}
