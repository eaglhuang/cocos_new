// @spec-source → DC-3-0004 | 資料中心架構規格書.md §2.3
import { _decorator, Component, Label, Node } from 'cc';
import { BloodlineGraph } from '../../core/services/BloodlineGraph';

const { ccclass, property } = _decorator;

/**
 * BloodlineTreePanel — 祖先樹 UI 元件
 *
 * 從 PersonRegistry (BloodlineGraph) 讀取祖先資料渲染樹狀 UI，
 * 取代直接讀取 Ancestors_JSON 嵌套結構的舊做法。
 *
 * Unity 對照：類似一個自定義 UIDocument 綁定器，
 * 以扁平的 Dictionary<uid, PersonRecord> 查表取代嵌套 ScriptableObject 樹。
 *
 * Prefab 接線：
 *   gen1Container → 曾祖父母容器（8 個子節點命名 G1_0..G1_7，各含 Txt Label）
 *   gen2Container → 祖父母容器  （4 個子節點命名 G2_0..G2_3，各含 Txt Label）
 *   gen3Container → 父母容器    （2 個子節點命名 G3_0..G3_1，各含 Txt Label）
 */
@ccclass('BloodlineTreePanel')
export class BloodlineTreePanel extends Component {
    /** 曾祖父母容器（depth 3，8 個祖先槽） */
    @property(Node)
    gen1Container: Node | null = null;

    /** 祖父母容器（depth 2，4 個祖先槽） */
    @property(Node)
    gen2Container: Node | null = null;

    /** 父母容器（depth 1，2 個祖先槽） */
    @property(Node)
    gen3Container: Node | null = null;

    /**
     * 根據武將 uid 載入並渲染 3 代祖先樹。
     *
     * 呼叫 BloodlineGraph.getAncestorChain() 取得祖先 uid 陣列（BFS 廣度優先），
     * 再以 getPerson() 從 PersonRegistry 查表取得各祖先顯示資料。
     * 不再直接讀取 Ancestors_JSON 嵌套結構。
     */
    async loadForGeneral(uid: string): Promise<void> {
        const graph = BloodlineGraph.getInstance();
        if (!graph.isLoaded) {
            await graph.loadRegistry();
        }

        // getAncestorChain BFS 排列：index 0-1 = 父母、2-5 = 祖父母、6-13 = 曾祖父母
        const ancestors = graph.getAncestorChain(uid, 3);

        this._fillContainer(this.gen3Container, 'G3', 2, ancestors.slice(0, 2), graph);
        this._fillContainer(this.gen2Container, 'G2', 4, ancestors.slice(2, 6), graph);
        this._fillContainer(this.gen1Container, 'G1', 8, ancestors.slice(6, 14), graph);
    }

    /** 清除所有祖先樹標籤（切換武將時呼叫） */
    clear(): void {
        this._fillContainer(this.gen3Container, 'G3', 2, [], BloodlineGraph.getInstance());
        this._fillContainer(this.gen2Container, 'G2', 4, [], BloodlineGraph.getInstance());
        this._fillContainer(this.gen1Container, 'G1', 8, [], BloodlineGraph.getInstance());
    }

    // ---- private ----

    private _fillContainer(
        container: Node | null,
        prefix: string,
        count: number,
        uids: string[],
        graph: BloodlineGraph
    ): void {
        if (!container) return;
        for (let i = 0; i < count; i++) {
            const uid = uids[i];
            const person = uid ? graph.getPerson(uid) : null;
            const txtNode = container.getChildByPath(`${prefix}_${i}/Txt`);
            if (!txtNode) continue;
            const label = txtNode.getComponent(Label);
            if (!label) continue;
            label.string = person ? this._formatAncestorLabel(person) : '—';
        }
    }

    private _formatAncestorLabel(person: { name: string; faction: string; gene_refs: string[]; is_virtual: boolean }): string {
        const factionLine = person.is_virtual ? '虛擬祖先' : this._formatFaction(person.faction);
        const geneCount = Array.isArray(person.gene_refs) ? person.gene_refs.length : 0;
        return `${person.name}\n${factionLine}\n因子 ${geneCount}`;
    }

    private _formatFaction(faction: string): string {
        switch (faction) {
            case 'player': return '玩家';
            case 'enemy': return '敵方';
            case 'wei': return '魏';
            case 'shu': return '蜀';
            case 'wu': return '吳';
            case 'neutral': return '中立';
            default: return faction || '未知';
        }
    }
}
