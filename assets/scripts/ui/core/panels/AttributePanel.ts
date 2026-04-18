// @spec-source → 見 docs/cross-reference-index.md  (UCUF M2)
/**
 * AttributePanel
 *
 * UCUF M2 — 第一個具體 ChildPanel，渲染 Array<{label, value}> 鍵值屬性列表。
 *
 * 資料格式（dataSource='attributes'）：
 *   ```json
 *   [
 *     { "label": "攻擊力", "value": "350" },
 *     { "label": "防禦力", "value": "200" },
 *     ...
 *   ]
 *   ```
 *
 * 視覺行為：
 *   - 以 hostNode 下的子節點為行容器（按順序對應資料陣列）
 *   - 每行預期有兩個 cc.Label 子節點：[0]=label文字, [1]=value文字
 *   - 若資料行數 > 容器子節點數，超出的資料行不顯示（防溢出）
 *   - 若資料行數 < 容器子節點數，多餘的容器行設為 active=false
 *
 * Unity 對照：ScrollRect 內的動態 ContentTemplate rows。
 */
import type { Node } from 'cc';
import type { Label } from 'cc';
import { ChildPanelBase } from '../ChildPanelBase';
import type { UISkinResolver } from '../UISkinResolver';
import type { UITemplateBinder } from '../UITemplateBinder';

/** 單筆屬性條目 */
export interface AttributeEntry {
    label: string;
    value: string;
}

export class AttributePanel extends ChildPanelBase {

    /** applyContentState 的 key */
    override dataSource = 'attributes';

    /** 最近一次渲染的資料（供 validateDataFormat 後快取） */
    override _lastData: AttributeEntry[] = [];

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    // ─── ChildPanelBase 實作 ───────────────────────────────────────────────

    async onMount(_spec: Record<string, unknown>): Promise<void> {
        // fragment 已由 CompositePanel._buildNode 建到 hostNode 下，
        // 初始掛載時若已有資料則立刻渲染
        if (this._lastData.length > 0) {
            this._render(this._lastData);
        }
    }

    onDataUpdate(data: unknown): void {
        const err = this.validateDataFormat(data);
        if (err) {
            console.warn(`[AttributePanel] 資料格式錯誤：${err}`);
            return;
        }
        this._lastData = data as AttributeEntry[];
        this._render(this._lastData);
    }

    validateDataFormat(data: unknown): string | null {
        if (!Array.isArray(data)) return '期望 Array 但收到非陣列';
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            if (typeof item !== 'object' || item === null) {
                return `index ${i}：期望 object，但收到 ${typeof item}`;
            }
            if (typeof (item as any).label !== 'string') {
                return `index ${i}：欄位 "label" 必須為 string`;
            }
            if (typeof (item as any).value !== 'string') {
                return `index ${i}：欄位 "value" 必須為 string`;
            }
        }
        return null;
    }

    // ─── 內部渲染 ─────────────────────────────────────────────────────────

    private _render(entries: AttributeEntry[]): void {
        const rows = this.hostNode.children;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (i >= entries.length) {
                row.active = false;
                continue;
            }
            row.active = true;
            const { label, value } = entries[i];
            const labelNodes = row.children;
            // 約定：行容器第 0 個子節點為 label Label，第 1 個為 value Label
            this._setLabelText(labelNodes[0], label);
            this._setLabelText(labelNodes[1], value);
        }
    }

    /**
     * 安全地設定 cc.Label 文字（利用 import type 避免 cc 執行時依賴）。
     * 透過動態 getComponent 呼叫，與 cc runtime 保持鬆耦合。
     */
    private _setLabelText(node: Node | undefined, text: string): void {
        if (!node) return;
        // 使用字串形式 getComponent 避免直接 import Label class（H-04 設計原則）
        const lbl = (node as any).getComponent('cc.Label') as Label | null
                 ?? (node as any).getComponent('Label') as Label | null;
        if (lbl) {
            lbl.string = text;
        }
    }
}
