// @spec-source → 見 docs/cross-reference-index.md  (UCUF M3)
/**
 * RadarChartPanel
 *
 * UCUF M3 — 六角雷達圖 ChildPanel，以 dualLayer 顯示武將「資質」與「實力」。
 *
 * 資料格式（dataSource = 'dualLayerStats'）：
 *   ```json
 *   {
 *     "axes":   ["統率", "武力", "智力", "政治", "魅力", "幸運"],
 *     "layers": [
 *       { "values": [0.8, 0.9, 0.7, 0.6, 0.75, 0.65], "label": "實力" },
 *       { "values": [1.0, 1.0, 0.8, 0.7, 0.9, 0.8],   "label": "資質" }
 *     ]
 *   }
 *   ```
 *   - layers[0] = 當前實力（inner polygon，深色較不透明）
 *   - layers[1] = 資質上限（outer polygon，淺色半透明）
 *   - values 每個元素為 0~1 的歸一化值
 *
 * 驗證規則：
 *   - axes.length === 6
 *   - 每個 layer.values.length === 6
 *   - 每個 value 在 0~1 範圍（允許 0 和 1 邊界值）
 *
 * H-04：不直接 import cc.Graphics；一律委託 _services.renderer.drawRadarChart()
 *
 * Unity 對照：ProceduralMesh 六角形 Fill + 多層 MeshRenderer
 */
import type { Node } from 'cc';
import { ChildPanelBase } from '../ChildPanelBase';
import type { UISkinResolver } from '../UISkinResolver';
import type { UITemplateBinder } from '../UITemplateBinder';
import type { RadarChartConfig, RadarLayer } from '../interfaces/ICompositeRenderer';

/** 單一 layer 的原始資料格式 */
export interface RadarLayerData {
    values: number[];
    label?: string;
    color?: string;
    opacity?: number;
}

/** RadarChartPanel 期望的資料格式 */
export interface DualLayerStatsData {
    axes:   string[];
    layers: RadarLayerData[];
}

export class RadarChartPanel extends ChildPanelBase {

    /** applyContentState 的 key */
    override dataSource = 'dualLayerStats';

    private _chartNode: Node | null = null;
    override _lastData: DualLayerStatsData | null = null;
    private _size = 120;

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    // ─── ChildPanelBase 實作 ───────────────────────────────────────────────

    async onMount(spec: Record<string, unknown>): Promise<void> {
        this._size = (spec['radarSize'] as number | undefined) ?? 120;
        if (this._lastData) {
            await this._draw(this._lastData);
        }
    }

    onDataUpdate(data: unknown): void {
        const err = this.validateDataFormat(data);
        if (err) {
            console.warn(`[RadarChartPanel] 資料格式錯誤：${err}`);
            return;
        }
        this._lastData = data as DualLayerStatsData;
        void this._draw(this._lastData);
    }

    validateDataFormat(data: unknown): string | null {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return '期望 { axes: string[], layers: RadarLayerData[] } 物件';
        }
        const d = data as Record<string, unknown>;
        if (!Array.isArray(d['axes'])) return '"axes" 必須為陣列';
        if ((d['axes'] as unknown[]).length !== 6) return `"axes" 長度必須為 6，收到 ${(d['axes'] as unknown[]).length}`;
        if (!Array.isArray(d['layers'])) return '"layers" 必須為陣列';
        const layers = d['layers'] as RadarLayerData[];
        for (let li = 0; li < layers.length; li++) {
            const layer = layers[li];
            if (!Array.isArray(layer.values)) {
                return `layers[${li}].values 必須為陣列`;
            }
            if (layer.values.length !== 6) {
                return `layers[${li}].values 長度必須為 6，收到 ${layer.values.length}`;
            }
            for (let vi = 0; vi < layer.values.length; vi++) {
                const v = layer.values[vi];
                if (typeof v !== 'number' || v < 0 || v > 1) {
                    return `layers[${li}].values[${vi}] 必須為 0~1 的數字，收到 ${v}`;
                }
            }
        }
        return null;
    }

    // ─── 內部繪圖 ─────────────────────────────────────────────────────────

    private async _draw(data: DualLayerStatsData): Promise<void> {
        if (!this._services.renderer) {
            console.warn('[RadarChartPanel] _services.renderer 未注入');
            return;
        }

        const config: RadarChartConfig = {
            axes:   data.axes,
            layers: data.layers as RadarLayer[],
            size:   this._size,
        };

        if (this._chartNode) {
            // 已有圖表：直接更新，不重建節點
            this._services.renderer.updateRadarChart(this._chartNode, config);
        } else {
            this._chartNode = (await this._services.renderer.drawRadarChart(
                this.hostNode,
                config,
            )) as Node;
        }
    }
}
