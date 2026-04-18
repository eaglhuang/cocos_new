// @spec-source → 見 docs/cross-reference-index.md  (UCUF M3)
/**
 * GridPanel
 *
 * UCUF M3 — 格狀排列 ChildPanel，渲染 Array<Record<string, unknown>> 的格子資料。
 *
 * 視覺行為：
 *   - 呼叫 _services.renderer.drawGrid() 在 hostNode 下建立格狀容器
 *   - Grid 欄數來自 spec.gridColumns（預設 4）
 *   - 每筆資料建立一個 cell Node 加入 Grid 容器（cell 內容由業務子類覆寫 _fillCell）
 *
 * H-04：不 import cc.Label / cc.Sprite；Node 為場景圖基礎類，允許直接引用。
 *
 * Unity 對照：GridLayoutGroup + 動態 Instantiate cell prefab
 */
import type { Node } from 'cc';
import { ChildPanelBase } from '../ChildPanelBase';
import type { UISkinResolver } from '../UISkinResolver';
import type { UITemplateBinder } from '../UITemplateBinder';
import type { GridConfig } from '../interfaces/ICompositeRenderer';

export class GridPanel extends ChildPanelBase {

    override dataSource: string;

    protected _columns       = 4;
    protected _cellFragRef   = '';
    protected _gridContainer: Node | null = null;
    override _lastData:       Record<string, unknown>[] = [];

    constructor(
        hostNode: Node,
        skinResolver: UISkinResolver,
        binder: UITemplateBinder,
        dataSource = 'grid',
    ) {
        super(hostNode, skinResolver, binder);
        this.dataSource = dataSource;
    }

    async onMount(spec: Record<string, unknown>): Promise<void> {
        this._columns     = (spec['gridColumns'] as number | undefined) ?? 4;
        this._cellFragRef = (spec['cellFragmentRef'] as string | undefined) ?? '';

        if (!this._services.renderer) {
            console.warn('[GridPanel] _services.renderer 未注入，無法建立格狀容器');
            return;
        }

        const config: GridConfig = { columns: this._columns };
        this._gridContainer = (await this._services.renderer.drawGrid(
            this.hostNode,
            config,
        )) as Node;

        if (this._lastData.length > 0) {
            this._render(this._lastData);
        }
    }

    onDataUpdate(data: unknown): void {
        const err = this.validateDataFormat(data);
        if (err) {
            console.warn(`[GridPanel] 資料格式錯誤：${err}`);
            return;
        }
        this._lastData = data as Record<string, unknown>[];
        this._render(this._lastData);
    }

    validateDataFormat(data: unknown): string | null {
        if (!Array.isArray(data)) return '期望 Array 但收到非陣列';
        for (let index = 0; index < data.length; index++) {
            const item = data[index];
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                return `第 ${index} 筆資料必須為 object`;
            }
        }
        return null;
    }

    protected _render(items: Record<string, unknown>[]): void {
        if (!this._gridContainer) return;
        const container = this._gridContainer as Node & {
            removeAllChildren?: () => void;
            destroyAllChildren?: () => void;
        };
        if (typeof container.removeAllChildren === 'function') {
            container.removeAllChildren();
        } else if (typeof container.destroyAllChildren === 'function') {
            container.destroyAllChildren();
        }
        for (let i = 0; i < items.length; i++) {
            const cell = this._createCellNode(`Cell_${i}`);
            (this._gridContainer as any).addChild(cell);
            this._fillCell(cell, items[i], i);
        }
    }

    /**
     * 在 Cocos runtime 建立 cc.Node；在單元測試（無 cc module）回退 mock node。
     */
    private _createCellNode(name: string): Node {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const cc = require('cc');
            return new cc.Node(name) as Node;
        } catch {
            return {
                name,
                children: [],
                addChild: () => {},
                removeAllChildren: () => {},
            } as unknown as Node;
        }
    }

    /**
     * 填充單一 cell 資料（可被子類覆寫以加入業務邏輯）。
     */
    protected _fillCell(_cell: Node, _data: Record<string, unknown>, _index: number): void {
        // 子類可覆寫
    }
}
