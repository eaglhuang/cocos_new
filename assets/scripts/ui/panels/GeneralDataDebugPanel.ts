// @spec-source → DC-7-0002 | 資料中心架構規格書.md §5 M7
import { _decorator, Button, Component, EditBox, instantiate, JsonAsset, Label, Node, resources, ScrollView } from 'cc';
import { DEV } from 'cc/env';
import { DataCatalog, GeneralIndexEntry } from '../../core/storage/DataCatalog';
import { matchesGeneralQuery } from '../../core/storage/GeneralSearch';

const { ccclass, property } = _decorator;

/**
 * GeneralDataDebugPanel — 遊戲執行期武將資料偵錯面板
 *
 * 僅在 DEV 模式下載入與顯示。
 * 支援 uid / 名稱搜尋 DSL，即時查詢 DataCatalog 索引並顯示欄位清單。
 *
 * Unity 對照：類似 Unity Editor IMGUIWindow 在 Playmode 掛 GUI，
 * 以 EditBox DSL 取代 Unity 的 Inspector field 直入。
 *
 * 使用方式（Prefab 接線）：
 *   searchInput  → 搜尋輸入框 EditBox
 *   resultScroll → 搜尋結果 ScrollView
 *   resultList   → ScrollView Content Node（含 Layout）
 *   statusLabel  → 狀態文字 Label（搜尋結果筆數提示）
 *
 * 採用 `import { DEV } from 'cc/env'` build-time guard，發布包中 DEV=false
 * 觸發 dead-code elimination，此元件在 Release build 完全不載入。
 */
@ccclass('GeneralDataDebugPanel')
export class GeneralDataDebugPanel extends Component {
    /** 搜尋輸入框 */
    @property(EditBox)
    searchInput: EditBox | null = null;

    /** 結果 ScrollView */
    @property(ScrollView)
    resultScroll: ScrollView | null = null;

    /** ScrollView Content 節點（用於動態增刪子節點） */
    @property(Node)
    resultList: Node | null = null;

    /** 狀態文字（顯示搜尋結果筆數） */
    @property(Label)
    statusLabel: Label | null = null;

    /** 單筆結果 Label 模板節點（Prefab 內提供，使用時複製） */
    @property(Node)
    resultItemTemplate: Node | null = null;

    @property(Label)
    selectedUidLabel: Label | null = null;

    @property(EditBox)
    nameInput: EditBox | null = null;

    @property(EditBox)
    strInput: EditBox | null = null;

    @property(EditBox)
    intInput: EditBox | null = null;

    @property(EditBox)
    leaInput: EditBox | null = null;

    @property(EditBox)
    polInput: EditBox | null = null;

    @property(EditBox)
    chaInput: EditBox | null = null;

    @property(EditBox)
    lukInput: EditBox | null = null;

    @property(EditBox)
    epInput: EditBox | null = null;

    @property(Label)
    factionValueLabel: Label | null = null;

    @property(Label)
    rarityValueLabel: Label | null = null;

    @property(Label)
    categoryValueLabel: Label | null = null;

    @property(Label)
    roleValueLabel: Label | null = null;

    @property(Button)
    factionButton: Button | null = null;

    @property(Button)
    rarityButton: Button | null = null;

    @property(Button)
    categoryButton: Button | null = null;

    @property(Button)
    roleButton: Button | null = null;

    @property(Button)
    applyButton: Button | null = null;

    @property(Button)
    resetButton: Button | null = null;

    /** 最後一次查詢結果快取 */
    private _lastResults: GeneralIndexEntry[] = [];
    private _records = new Map<string, RuntimeGeneralRecord>();
    private _selectedUid: string | null = null;

    private static readonly FACTIONS = ['wei', 'shu', 'wu', 'enemy', 'neutral', 'player', 'other'];
    private static readonly RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'];
    private static readonly CATEGORIES = ['civilian', 'general', 'famed', 'mythical', 'titled'];
    private static readonly ROLES = ['Combat', 'Support', 'Hybrid', 'Commander'];

    onLoad(): void {
        if (!DEV) {
            this.node.active = false;
            this.node.destroy();
            return;
        }
    }

    start(): void {
        if (!DEV) return;
        this._bindFormActions();
        void this._loadRuntimeData();
        // 綁定搜尋輸入框 change 事件
        if (this.searchInput) {
            this.searchInput.node.on(EditBox.EventType.TEXT_CHANGED, this._onSearchChanged, this);
        }
    }

    onDestroy(): void {
        if (this.searchInput) {
            this.searchInput.node.off(EditBox.EventType.TEXT_CHANGED, this._onSearchChanged, this);
        }
    }

    /**
     * 搜尋武將並更新結果列表。
     * 支援 DSL:
     *   "guan-yu"          → 精確 uid 搜尋
     *   "faction:shu"      → 勢力篩選
     *   "tier:SSR"         → 稀有度篩選
     *   "guan"             → 名稱模糊搜尋
     */
    async search(query: string): Promise<void> {
        if (!DEV) return;

        const catalog = DataCatalog.getInstance();
        if (!catalog.isLoaded) await catalog.load();
        if (this._records.size === 0) await this._loadRuntimeData();

        const q = query.trim();
        const results = this._records.size > 0
            ? Array.from(this._records.values())
                .filter(entry => matchesGeneralQuery(entry, q))
                .map(entry => this._toIndexEntry(entry))
            : catalog.getAllEntries()
                .filter(entry => matchesGeneralQuery({ ...entry, id: entry.uid }, q));

        this._lastResults = results;
        this._renderResults(results);
    }

    // ---- private ----

    private _onSearchChanged(editBox: EditBox): void {
        void this.search(editBox.string);
    }

    private _bindFormActions(): void {
        this.factionButton?.node.on(Button.EventType.CLICK, () => this.cycleFaction(), this);
        this.rarityButton?.node.on(Button.EventType.CLICK, () => this.cycleRarity(), this);
        this.categoryButton?.node.on(Button.EventType.CLICK, () => this.cycleCategory(), this);
        this.roleButton?.node.on(Button.EventType.CLICK, () => this.cycleRole(), this);
        this.applyButton?.node.on(Button.EventType.CLICK, () => this.applySelectedChanges(), this);
        this.resetButton?.node.on(Button.EventType.CLICK, () => this.resetSelectedGeneral(), this);
    }

    private async _loadRuntimeData(): Promise<void> {
        const data = await this._loadMasterBase();
        this._records.clear();
        const catalog = DataCatalog.getInstance();
        for (const record of data) {
            this._records.set(record.id, record);
            catalog.upsertEntry(this._toIndexEntry(record));
        }
        await this.search(this.searchInput?.string ?? '');
    }

    private _loadMasterBase(): Promise<RuntimeGeneralRecord[]> {
        return new Promise<RuntimeGeneralRecord[]>((resolve) => {
            resources.load('data/master/generals-base', JsonAsset, (error, asset) => {
                if (error || !asset) {
                    console.warn('[GeneralDataDebugPanel] 載入 generals-base 失敗', error);
                    resolve([]);
                    return;
                }

                const json = asset.json as { data?: RuntimeGeneralRecord[] } | RuntimeGeneralRecord[];
                if (Array.isArray(json)) {
                    resolve(json as RuntimeGeneralRecord[]);
                } else {
                    resolve((json as { data?: RuntimeGeneralRecord[] }).data ?? []);
                }
            });
        });
    }

    private _renderResults(entries: GeneralIndexEntry[]): void {
        if (!this.resultList) return;

        // 清除舊結果
        const children = [...this.resultList.children];
        for (const child of children) {
            if (child !== this.resultItemTemplate) {
                child.destroy();
            }
        }

        // 更新狀態文字
        if (this.statusLabel) {
            this.statusLabel.string = `找到 ${entries.length} 筆`;
        }

        // 最多顯示 100 筆避免 DOM 過重
        const display = entries.slice(0, 100);
        for (const entry of display) {
            const item = this._makeResultItem(entry);
            if (item) this.resultList.addChild(item);
        }
    }

    private _makeResultItem(entry: GeneralIndexEntry): Node | null {
        if (!this.resultItemTemplate) {
            // 無模板：建立簡單 Label 節點
            const node = new Node(`result_${entry.uid}`);
            const label = node.addComponent(Label);
            label.string = this._formatEntry(entry);
            return node;
        }

        const item = instantiate(this.resultItemTemplate);
        item.name = `result_${entry.uid}`;
        item.active = true;
        const label = item.getComponent(Label) ?? item.getComponentInChildren(Label);
        if (label) {
            label.string = this._formatEntry(entry);
        }
        const button = item.getComponent(Button) ?? item.addComponent(Button);
        button.node.off(Button.EventType.CLICK);
        button.node.on(Button.EventType.CLICK, () => this.selectGeneral(entry.uid), this);
        return item;
    }

    private _formatEntry(entry: GeneralIndexEntry): string {
        return `[${entry.rarityTier}] ${entry.name}  uid:${entry.uid}  faction:${entry.faction}  layer:${entry.layerKey}`;
    }

    private _toIndexEntry(record: RuntimeGeneralRecord): GeneralIndexEntry {
        return {
            uid: record.id,
            name: record.name,
            faction: record.faction,
            rarityTier: (record.rarityTier ?? 'common') as GeneralIndexEntry['rarityTier'],
            layerKey: record.layerKey ?? 'L1',
            role: record.role,
            characterCategory: record.characterCategory,
            str: record.str,
            int: record.int,
            lea: record.lea,
            pol: record.pol,
            cha: record.cha,
            luk: record.luk,
            ep: record.ep,
            gender: record.gender,
        };
    }

    selectGeneral(uid: string): void {
        const record = this._records.get(uid);
        if (!record) return;
        this._selectedUid = uid;
        if (this.selectedUidLabel) this.selectedUidLabel.string = `${record.id}｜${record.name}`;
        if (this.nameInput) this.nameInput.string = record.name ?? '';
        if (this.strInput) this.strInput.string = String(record.str ?? '');
        if (this.intInput) this.intInput.string = String(record.int ?? '');
        if (this.leaInput) this.leaInput.string = String(record.lea ?? '');
        if (this.polInput) this.polInput.string = String(record.pol ?? '');
        if (this.chaInput) this.chaInput.string = String(record.cha ?? '');
        if (this.lukInput) this.lukInput.string = String(record.luk ?? '');
        if (this.epInput) this.epInput.string = String(record.ep ?? '');
        if (this.factionValueLabel) this.factionValueLabel.string = record.faction ?? '';
        if (this.rarityValueLabel) this.rarityValueLabel.string = record.rarityTier ?? '';
        if (this.categoryValueLabel) this.categoryValueLabel.string = record.characterCategory ?? '';
        if (this.roleValueLabel) this.roleValueLabel.string = record.role ?? '';
    }

    resetSelectedGeneral(): void {
        if (!this._selectedUid) return;
        this.selectGeneral(this._selectedUid);
    }

    applySelectedChanges(): void {
        if (!this._selectedUid) return;
        const record = this._records.get(this._selectedUid);
        if (!record) return;

        record.name = this.nameInput?.string.trim() || record.name;
        record.str = this._parseNumber(this.strInput?.string, record.str);
        record.int = this._parseNumber(this.intInput?.string, record.int);
        record.lea = this._parseNumber(this.leaInput?.string, record.lea);
        record.pol = this._parseNumber(this.polInput?.string, record.pol);
        record.cha = this._parseNumber(this.chaInput?.string, record.cha);
        record.luk = this._parseNumber(this.lukInput?.string, record.luk);
        record.ep = this._parseNumber(this.epInput?.string, record.ep);
        record.faction = this.factionValueLabel?.string || record.faction;
        record.rarityTier = this.rarityValueLabel?.string || record.rarityTier;
        record.characterCategory = this.categoryValueLabel?.string || record.characterCategory;
        record.role = this.roleValueLabel?.string || record.role;

        const catalog = DataCatalog.getInstance();
        catalog.updateEntry(this._selectedUid, this._toIndexEntry(record));
        if (this.statusLabel) {
            this.statusLabel.string = `已套用 ${record.id} 的即時修改（僅 runtime 記憶體）`;
        }
        void this.search(this.searchInput?.string ?? '');
        this.selectGeneral(this._selectedUid);
    }

    cycleFaction(): void {
        this._cycleLabel(this.factionValueLabel, GeneralDataDebugPanel.FACTIONS);
    }

    cycleRarity(): void {
        this._cycleLabel(this.rarityValueLabel, GeneralDataDebugPanel.RARITIES);
    }

    cycleCategory(): void {
        this._cycleLabel(this.categoryValueLabel, GeneralDataDebugPanel.CATEGORIES);
    }

    cycleRole(): void {
        this._cycleLabel(this.roleValueLabel, GeneralDataDebugPanel.ROLES);
    }

    private _cycleLabel(label: Label | null, values: string[]): void {
        if (!label || values.length === 0) return;
        const currentIndex = Math.max(0, values.indexOf(label.string));
        const nextIndex = (currentIndex + 1) % values.length;
        label.string = values[nextIndex];
    }

    private _parseNumber(raw: string | undefined, fallback: number | undefined): number | undefined {
        if (raw === undefined) return fallback;
        const value = Number(raw);
        return Number.isFinite(value) ? value : fallback;
    }
}

interface RuntimeGeneralRecord extends Record<string, unknown> {
    id: string;
    name: string;
    faction: string;
    rarityTier?: string;
    characterCategory?: string;
    role?: string;
    gender?: string;
    layerKey?: string;
    str?: number;
    int?: number;
    lea?: number;
    pol?: number;
    cha?: number;
    luk?: number;
    ep?: number;
}
