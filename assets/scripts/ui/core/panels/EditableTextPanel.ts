// @spec-source → 見 docs/cross-reference-index.md  (UCUF M7)
/**
 * EditableTextPanel
 *
 * UCUF M7 — 可編輯文字 ChildPanel，支援切換唯讀與可編輯兩種狀態（規劃書 §6.6）。
 *
 * 資料格式（dataSource = 'editableText'）：
 *   ```json
 *   {
 *     "text":     "顯示或編輯的文字內容",
 *     "editable": true
 *   }
 *   ```
 *
 * 驗證規則：
 *   - 必須為非 null Object（非陣列）
 *   - text：string（不可省略）
 *   - editable：boolean（不可省略）
 *
 * 渲染行為（H-04：不直接 import cc 元件，透過 binder 委託操作）：
 *   - 呼叫 binder.setLabelText('TextLabel', text) 更新文字
 *   - 將 hostNode 的第一個子節點 active 設定對應 editable 狀態
 *     （EditBox 節點慣例為 active=false 時呈現唯讀 Label，active=true 呈現 EditBox）
 *   - 若 binder 不支援 setLabelText，靜默略過（Node.js 測試環境相容）
 *
 * Unity 對照：TMP_InputField.readOnly 切換 + TMP_Text 唯讀顯示。
 */
import type { Node } from 'cc';
import { ChildPanelBase } from '../ChildPanelBase';
import type { UISkinResolver } from '../UISkinResolver';
import type { UITemplateBinder } from '../UITemplateBinder';

/** EditableTextPanel 資料格式 */
export interface EditableTextData {
    text:     string;
    editable: boolean;
}

export class EditableTextPanel extends ChildPanelBase {

    /** applyContentState 的 key */
    override dataSource = 'editableText';

    /** 最近一次有效更新的資料 */
    override _lastData: EditableTextData | null = null;

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    // ─── ChildPanelBase 實作 ───────────────────────────────────────────────

    async onMount(_spec: Record<string, unknown>): Promise<void> {
        if (this._lastData !== null) {
            this._apply(this._lastData);
        }
    }

    onDataUpdate(data: unknown): void {
        const err = this.validateDataFormat(data);
        if (err) {
            console.warn(`[EditableTextPanel] 資料格式錯誤：${err}`);
            return;
        }
        this._lastData = data as EditableTextData;
        this._apply(this._lastData);
    }

    validateDataFormat(data: unknown): string | null {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return '期望 { text: string, editable: boolean } 物件';
        }
        const d = data as Record<string, unknown>;
        if (typeof d['text'] !== 'string') {
            return '欄位 "text" 必須為 string';
        }
        if (typeof d['editable'] !== 'boolean') {
            return '欄位 "editable" 必須為 boolean';
        }
        return null;
    }

    // ─── 內部渲染 ─────────────────────────────────────────────────────────

    private _apply(data: EditableTextData): void {
        // 透過 binder 設定 Label 文字（若 binder 支援 setLabelText）
        const b = this.binder as unknown as Record<string, unknown>;
        if (typeof b['setLabelText'] === 'function') {
            (b['setLabelText'] as (key: string, text: string) => void)('TextLabel', data.text);
        }

        // 將 hostNode 第一個子節點的 active 對應 editable 狀態
        // （EditBox 節點 active=true => 可編輯；active=false => 唯讀 Label 顯示）
        const children = this.hostNode.children as Array<{ active: boolean }>;
        if (children.length > 0) {
            children[0].active = data.editable;
        }
    }
}
