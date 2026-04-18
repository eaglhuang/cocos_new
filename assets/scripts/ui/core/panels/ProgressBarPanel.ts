// @spec-source → 見 docs/cross-reference-index.md  (UCUF M3)
/**
 * ProgressBarPanel
 *
 * UCUF M3 — 進度條列表 ChildPanel，顯示武將六項屬性的培育進度（當前實力 vs 資質上限）。
 *
 * 資料格式（dataSource = 'progressBars'）：
 *   ```json
 *   [
 *     { "label": "統率", "current": 85, "max": 100 },
 *     { "label": "武力", "current": 90, "max": 100 },
 *     { "label": "智力", "current": 70, "max": 80 },
 *     { "label": "政治", "current": 55, "max": 75 },
 *     { "label": "魅力", "current": 75, "max": 90 },
 *     { "label": "幸運", "current": 65, "max": 80 }
 *   ]
 *   ```
 *
 * 視覺行為：
 *   - 每筆資料呼叫 _services.renderer.drawProgressBar() 建立一條進度條
 *   - 若節點已存在（非首次）則呼叫 updateProgressBar() 只更新進度，不重建節點
 *
 * 驗證規則：
 *   - Array，每項有 label(string)、current(number)、max(number)
 *   - current ≤ max（若違反則 console.warn 並 clamp，不拋錯誤）
 *
 * H-04：不直接 import cc 渲染元件；一律委託 _services.renderer
 *
 * Unity 對照：VerticalLayoutGroup 內的多個 Image.fillAmount 進度條
 */
import type { Node } from 'cc';
import { ChildPanelBase } from '../ChildPanelBase';
import type { UISkinResolver } from '../UISkinResolver';
import type { UITemplateBinder } from '../UITemplateBinder';
import type { ProgressBarConfig } from '../interfaces/ICompositeRenderer';

/** 單條進度條的原始資料格式 */
export interface ProgressBarEntry {
    label:   string;
    current: number;
    max:     number;
    barColor?: string;
    bgColor?:  string;
}

export class ProgressBarPanel extends ChildPanelBase {

    /** applyContentState 的 key */
    override dataSource = 'progressBars';

    /** key = index，value = 已建立的 bar 容器節點 */
    private readonly _barNodes = new Map<number, Node>();
    override _lastData: ProgressBarEntry[] = [];

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    // ─── ChildPanelBase 實作 ───────────────────────────────────────────────

    async onMount(_spec: Record<string, unknown>): Promise<void> {
        if (this._lastData.length > 0) {
            await this._render(this._lastData);
        }
    }

    onDataUpdate(data: unknown): void {
        const err = this.validateDataFormat(data);
        if (err) {
            console.warn(`[ProgressBarPanel] 資料格式錯誤：${err}`);
            return;
        }
        this._lastData = data as ProgressBarEntry[];
        void this._render(this._lastData);
    }

    validateDataFormat(data: unknown): string | null {
        if (!Array.isArray(data)) return '期望 Array 但收到非陣列';
        for (let i = 0; i < (data as unknown[]).length; i++) {
            const item = (data as unknown[])[i];
            if (typeof item !== 'object' || item === null) {
                return `index ${i}：期望 object，但收到 ${typeof item}`;
            }
            const e = item as Record<string, unknown>;
            if (typeof e['label'] !== 'string') {
                return `index ${i}：欄位 "label" 必須為 string`;
            }
            if (typeof e['current'] !== 'number') {
                return `index ${i}：欄位 "current" 必須為 number`;
            }
            if (typeof e['max'] !== 'number') {
                return `index ${i}：欄位 "max" 必須為 number`;
            }
            if ((e['current'] as number) > (e['max'] as number)) {
                console.warn(`[ProgressBarPanel] index ${i}：current(${e['current']}) > max(${e['max']})，將 clamp 為 max`);
            }
        }
        return null;
    }

    override onUnmount(): void {
        this._barNodes.clear();
    }

    // ─── 內部渲染 ─────────────────────────────────────────────────────────

    private async _render(entries: ProgressBarEntry[]): Promise<void> {
        if (!this._services.renderer) {
            console.warn('[ProgressBarPanel] _services.renderer 未注入');
            return;
        }

        // 併行建立缺失節點，降低 async 串行等待造成的可觀測延遲。
        await Promise.all(entries.map(async (entry, i) => {
            const clampedCurrent = Math.min(entry.current, entry.max);

            if (this._barNodes.has(i)) {
                this._services.renderer!.updateProgressBar(
                    this._barNodes.get(i)!,
                    clampedCurrent,
                    entry.max,
                );
                return;
            }

            const config: ProgressBarConfig = {
                label:    entry.label,
                current:  clampedCurrent,
                max:      entry.max,
                barColor: entry.barColor,
                bgColor:  entry.bgColor,
            };
            const barNode = (await this._services.renderer!.drawProgressBar(
                this.hostNode,
                config,
            )) as Node;
            this._barNodes.set(i, barNode);
        }));
    }
}
