// @spec-source → 見 docs/cross-reference-index.md
/**
 * @deprecated
 * GeneralListPanel — 武將列表面板（已廢止，請使用 GeneralListComposite）
 *
 * 此類已被 GeneralListComposite.ts 取代。
 * 遷移完成時間: 2026-04-13 (Wave 1)
 * 預計刪除: 2026-05-13 (Wave 2 全部遷移後)
 */
import { _decorator, Node, Label, Button } from 'cc';
import type { GeneralConfig } from '../../core/models/GeneralUnit';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

// 欄位排序 key（對應 header col name → GeneralConfig 欄位）
type SortKey = 'name' | 'gender' | 'age' | 'str' | 'int' | 'lea' | 'pol' | 'cha' | 'luk' | 'troop' | 'faction';

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

@ccclass('GeneralListPanel')
export class GeneralListPanel extends UIPreviewBuilder {

    private get _specLoader() { return services().specLoader; }
    public onSelectGeneral: ((config: GeneralConfig) => void | Promise<void>) | null = null;

    private _isBuilt     = false;
    private _allGenerals: GeneralConfig[] = [];
    private _sortKey: SortKey | null = null;
    private _sortAsc     = true;

    private _getRowLabel(row: Node, nodeName: string): Label | null {
        return row.getChildByName(nodeName)?.getComponent(Label) ?? null;
    }

    /** 取得武將最強兵種及等級字串，例如 "騎兵 A" */
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
        for (const [key, grade] of Object.entries(apt)) {
            const rank = APTITUDE_ORDER[grade] ?? 0;
            if (rank > bestRank) { bestRank = rank; bestKey = key; }
        }
        if (!bestKey) return '—';
        const zh  = TROOP_ZH[bestKey] ?? bestKey;
        const grade = apt[bestKey];
        return `${zh} ${grade}`;
    }

    /** 依目前 _sortKey / _sortAsc 回傳排序後的列表副本 */
    private _sortedList(): GeneralConfig[] {
        const list = [...this._allGenerals];
        if (!this._sortKey) return list;
        const key = this._sortKey;
        const asc = this._sortAsc;
        list.sort((a, b) => {
            let va: any;
            let vb: any;
            if (key === 'troop') {
                const ra = APTITUDE_ORDER[Object.values(a.troopAptitude ?? {}).sort((x, y) => (APTITUDE_ORDER[y] ?? 0) - (APTITUDE_ORDER[x] ?? 0))[0]] ?? 0;
                const rb = APTITUDE_ORDER[Object.values(b.troopAptitude ?? {}).sort((x, y) => (APTITUDE_ORDER[y] ?? 0) - (APTITUDE_ORDER[x] ?? 0))[0]] ?? 0;
                va = ra; vb = rb;
            } else {
                va = (a as any)[key] ?? '';
                vb = (b as any)[key] ?? '';
            }
            if (typeof va === 'number' && typeof vb === 'number') {
                return asc ? va - vb : vb - va;
            }
            const sa = String(va);
            const sb = String(vb);
            return asc ? sa.localeCompare(sb) : sb.localeCompare(sa);
        });
        return list;
    }

    /** 清空 Content 並重新填入排序後資料 */
    private async _repopulate(): Promise<void> {
        const listPath = 'GeneralListRoot/MainContainer/DataList';
        const listNode = this.node.getChildByPath(listPath);
        if (!listNode) return;
        const content = listNode.getChildByPath('view/Content') ?? listNode.getChildByName('Content');
        if (content) content.removeAllChildren();

        await this.populateList(listPath, this._sortedList(), (item, row) => {
            const setLabel = (name: string, value: string) => {
                const lbl = this._getRowLabel(row, name);
                if (lbl) lbl.string = value;
            };

            setLabel('Name',   item.name);
            setLabel('Gender', item.gender ?? '—');
            setLabel('Age',    item.age != null ? String(item.age) : '—');
            setLabel('Str',    item.str  != null ? String(item.str)  : '—');
            setLabel('Int',    item.int  != null ? String(item.int)  : '—');
            setLabel('Lea',    item.lea  != null ? String(item.lea)  : '—');
            setLabel('Pol',    item.pol  != null ? String(item.pol)  : '—');
            setLabel('Cha',    item.cha  != null ? String(item.cha)  : '—');
            setLabel('Luk',    item.luk  != null ? String(item.luk)  : '—');
            setLabel('Troop',  this._bestTroop(item));

            const factionLabel = this._getRowLabel(row, 'Faction');
            if (factionLabel) {
                if (item.faction === 'player') {
                    factionLabel.string = '我方';
                    factionLabel.color  = this.resolveColor('textPositiveOnParchment');
                } else {
                    factionLabel.string = '敵方';
                    factionLabel.color  = this.resolveColor('textNegativeOnParchment');
                }
            }

            // 點擊整列 → 切換至詳情頁
            const btn = row.getComponent(Button) || row.addComponent(Button);
            btn.node.off(Button.EventType.CLICK);
            btn.node.on(Button.EventType.CLICK, () => {
                this.onSelectGeneral?.(item);
            }, this);
        });
    }

    /** 綁定 ColumnHeaderRow 每個 col 的點擊排序事件（buildScreen 完成後呼叫） */
    private _bindSortHandlers(): void {
        const headerRow = this.node.getChildByPath(
            'GeneralListRoot/MainContainer/HeaderBar/ColumnHeaderRow',
        );
        if (!headerRow) return;
        for (const colNode of headerRow.children) {
            const sortKey = COL_SORT_MAP[colNode.name];
            if (!sortKey) continue;
            const btn = colNode.getComponent(Button) || colNode.addComponent(Button);
            btn.node.off(Button.EventType.CLICK);
            btn.node.on(Button.EventType.CLICK, () => { void this._onSortClick(sortKey); }, this);
        }
    }

    /** Header 排序點擊的 async 邏輯，獨立成 method 以避免在非 async callback 中使用 await */
    private async _onSortClick(sortKey: SortKey): Promise<void> {
        if (this._sortKey === sortKey) {
            this._sortAsc = !this._sortAsc;
        } else {
            this._sortKey = sortKey;
            this._sortAsc = true;
        }
        this._updateHeaderIndicators();
        services().event.emit('SHOW_TOAST', { message: '【 排序中 】', duration: 60, blocking: true });
        await new Promise<void>(r => setTimeout(r, 16));
        await this._repopulate();
        services().event.emit('HIDE_TOAST');
    }

    /** 在當前排序欄 header text 後補上 ▲/▼ 指示符 */
    private _updateHeaderIndicators(): void {
        const headerRow = this.node.getChildByPath(
            'GeneralListRoot/MainContainer/HeaderBar/ColumnHeaderRow',
        );
        if (!headerRow) return;
        const LABELS: Record<SortKey, string> = {
            name: '名稱', gender: '性別', age: '年齡',
            str: '武力', int: '智力', lea: '統率',
            pol: '政治', cha: '魅力', luk: '運氣',
            troop: '最強兵種', faction: '陣營',
        };
        for (const colNode of headerRow.children) {
            const sortKey = COL_SORT_MAP[colNode.name];
            if (!sortKey) continue;
            const lbl = colNode.getComponent(Label);
            if (!lbl) continue;
            const base = LABELS[sortKey];
            if (this._sortKey === sortKey) {
                lbl.string = `${base}${this._sortAsc ? '▲' : '▼'}`;
            } else {
                lbl.string = base;
            }
        }
    }

    /** 由 buildScreen 完成後自動呼叫，負責靜態事件綁定 */
    protected onReady(binder: UITemplateBinder): void {
        binder.getButton('BtnBack')?.node.on(Button.EventType.CLICK, this.hide, this);
        this._bindSortHandlers();
    }

    public async show(generals: GeneralConfig[]): Promise<void> {
        this.node.active = true;
        this._allGenerals = generals;

        if (!this._isBuilt) {
            const layout = await this._specLoader.loadLayout('general-list-main');
            const skin   = await this._specLoader.loadSkin('general-list-default');
            const i18n   = await this._specLoader.loadI18n(services().i18n.currentLocale);
            const tokens = await this._specLoader.loadDesignTokens();
            try {
                await this.buildScreen(layout, skin, i18n, tokens);
            } catch (e) {
                console.error('[GeneralListPanel] buildScreen 拋出例外，list 將無法填入:', e);
                return;
            }
            this._isBuilt = true;
        }

        await this._repopulate();
        this.playEnterTransition(this.node);
    }

    public hide(): void {
        this.playExitTransition(this.node, undefined, () => {
            this.node.active = false;
        });
    }
}
