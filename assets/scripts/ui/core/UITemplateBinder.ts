/**
 * UITemplateBinder — 自動節點綁定器
 *
 * 在 buildScreen 完成後，自動掃描節點樹中帶有 id 欄位的節點，
 * 建立 id → Node / Label / Sprite 映射。子類不再需要手寫 BFS 逐一查找。
 *
 * Unity 對照：
 *   - SerializeField 自動連結 Inspector 上拖拽的元件
 *   - 或 GetComponentInChildren<T>() 的批次版
 */
import { Label, Node, ProgressBar, Sprite, Button, ScrollView } from 'cc';
import type { UILayoutNodeSpec } from './UISpecTypes';

export class UITemplateBinder {

    private _nodeMap = new Map<string, Node>();
    private _labelMap = new Map<string, Label>();
    private _spriteMap = new Map<string, Sprite>();
    private _nodePathMap = new Map<string, Node>();
    private _labelPathMap = new Map<string, Label>();
    private _spritePathMap = new Map<string, Sprite>();

    /** 綁定已建構完成的節點樹 */
    bind(rootNode: Node, layoutSpec?: UILayoutNodeSpec): void {
        this._nodeMap.clear();
        this._labelMap.clear();
        this._spriteMap.clear();
        this._nodePathMap.clear();
        this._labelPathMap.clear();
        this._spritePathMap.clear();

        // 方式一：從 layout spec 的 id 欄位收集節點名稱，再從 node tree 中對應
        if (layoutSpec) {
            const idNames = new Map<string, string>();
            this._collectIds(layoutSpec, idNames);
            this._matchNodes(rootNode, idNames);
            this._indexPaths(rootNode, layoutSpec, '');
        }

        // 方式二：補掃整棵 node tree，把有 Label / Sprite 的節點按 Node.name 加入
        // （向後相容：原本沒有 id 的佈局，仍可透過 node name 綁定）
        this._walkTree(rootNode);
    }

    // ── 查詢 API ────────────────────────────────────────────────

    /** 取得綁定的 Node（優先查 id，fallback 查 name） */
    getNode(id: string): Node | null {
        return this._nodeMap.get(id) ?? null;
    }

    /** 以 layout 相對路徑取得綁定的 Node（不含 root name） */
    getNodeByPath(path: string): Node | null {
        return this._nodePathMap.get(path) ?? null;
    }

    /** 取得綁定的 Label */
    getLabel(id: string): Label | null {
        return this._labelMap.get(id) ?? null;
    }

    /** 以 layout 相對路徑取得綁定的 Label（不含 root name） */
    getLabelByPath(path: string): Label | null {
        return this._labelPathMap.get(path) ?? null;
    }

    /** 取得綁定的 Sprite */
    getSprite(id: string): Sprite | null {
        return this._spriteMap.get(id) ?? null;
    }

    /** 以 layout 相對路徑取得綁定的 Sprite（不含 root name） */
    getSpriteByPath(path: string): Sprite | null {
        return this._spritePathMap.get(path) ?? null;
    }

    /** 取得綁定的 Button */
    getButton(id: string): Button | null {
        const node = this._nodeMap.get(id);
        return node?.getComponent(Button) ?? null;
    }

    /** 取得綁定的 ProgressBar */
    getProgressBar(id: string): ProgressBar | null {
        const node = this._nodeMap.get(id);
        return node?.getComponent(ProgressBar) ?? null;
    }

    /** 取得綁定的 ScrollView */
    getScrollView(id: string): ScrollView | null {
        const node = this._nodeMap.get(id);
        return node?.getComponent(ScrollView) ?? null;
    }

    /** 批次設定 Label 文字 */
    setTexts(data: Record<string, string>): void {
        for (const [id, text] of Object.entries(data)) {
            const label = this._labelMap.get(id);
            if (label) {
                label.string = text;
            }
        }
    }

    /** 批次以 layout 相對路徑設定 Label 文字 */
    setTextsByPath(data: Record<string, string>): void {
        for (const [path, text] of Object.entries(data)) {
            const label = this._labelPathMap.get(path);
            if (label) {
                label.string = text;
            }
        }
    }

    /** 批次設定 Node active 狀態 */
    setActives(data: Record<string, boolean>): void {
        for (const [id, active] of Object.entries(data)) {
            const node = this._nodeMap.get(id);
            if (node) {
                node.active = active;
            }
        }
    }

    /** 取得所有已綁定的 ID 列表（除錯用） */
    get boundIds(): string[] {
        return Array.from(this._nodeMap.keys());
    }

    // ── 內部方法 ────────────────────────────────────────────────

    /** 從 layout spec 遞迴收集 id → name 對照 */
    private _collectIds(node: UILayoutNodeSpec, out: Map<string, string>): void {
        if (node.id) {
            out.set(node.id, node.name);
        }
        if (node.children) {
            for (const child of node.children) {
                this._collectIds(child, out);
            }
        }
        if (node.itemTemplate) {
            this._collectIds(node.itemTemplate, out);
        }
    }

    /** 從 node tree 中根據 name 找到對應的 Node，存入 id → Node 映射 */
    private _matchNodes(rootNode: Node, idNames: Map<string, string>): void {
        // Build name → Node[] index for faster lookup
        const nameIndex = new Map<string, Node[]>();
        const indexWalk = (n: Node) => {
            const list = nameIndex.get(n.name) ?? [];
            list.push(n);
            nameIndex.set(n.name, list);
            for (const c of n.children) indexWalk(c);
        };
        indexWalk(rootNode);

        for (const [id, name] of idNames) {
            const nodes = nameIndex.get(name);
            if (nodes && nodes.length > 0) {
                if (nodes.length > 1) {
                    console.warn(`[UITemplateBinder] 節點名稱 "${name}" (id="${id}") 有 ${nodes.length} 個重複，取第一個。` +
                        `若出現綁定錯位，請確認 layout JSON 中的節點名稱唯一性。`);
                }
                const node = nodes[0];
                this._nodeMap.set(id, node);
                const label = node.getComponent(Label);
                if (label) this._labelMap.set(id, label);
                const sprite = node.getComponent(Sprite);
                if (sprite) this._spriteMap.set(id, sprite);
            }
        }
    }

    /** 遍歷整棵 node tree，補充未被 id 涵蓋的 name 綁定 */
    private _walkTree(node: Node): void {
        const name = node.name;
        // 不覆蓋已由 id 建立的映射
        if (!this._nodeMap.has(name)) {
            this._nodeMap.set(name, node);
            const label = node.getComponent(Label);
            if (label) this._labelMap.set(name, label);
            const sprite = node.getComponent(Sprite);
            if (sprite) this._spriteMap.set(name, sprite);
        }
        for (const child of node.children) {
            this._walkTree(child);
        }
    }

    /** 根據 layout spec 建立相對路徑 → Node/Label/Sprite 映射（不含 root name） */
    private _indexPaths(node: Node, spec: UILayoutNodeSpec, parentPath: string): void {
        const currentPath = parentPath ? `${parentPath}/${spec.name}` : '';

        if (currentPath) {
            this._storePathBinding(currentPath, node);
        }

        if (!spec.children || spec.children.length === 0) {
            return;
        }

        const childBuckets = new Map<string, Node[]>();
        for (const childNode of node.children) {
            const list = childBuckets.get(childNode.name) ?? [];
            list.push(childNode);
            childBuckets.set(childNode.name, list);
        }

        for (const childSpec of spec.children) {
            if (!childSpec?.name || childSpec.name.trim().length === 0) {
                continue;
            }
            const bucket = childBuckets.get(childSpec.name);
            if (!bucket || bucket.length === 0) {
                console.warn(`[UITemplateBinder] 路徑索引失敗：找不到節點 "${childSpec.name}"，parentPath="${parentPath || '<root>'}"`);
                continue;
            }
            const childNode = bucket.shift()!;
            this._indexPaths(childNode, childSpec, currentPath);
        }
    }

    private _storePathBinding(path: string, node: Node): void {
        if (this._nodePathMap.has(path)) {
            return;
        }
        this._nodePathMap.set(path, node);

        const label = node.getComponent(Label);
        if (label) {
            this._labelPathMap.set(path, label);
        }

        const sprite = node.getComponent(Sprite);
        if (sprite) {
            this._spritePathMap.set(path, sprite);
        }
    }
}
