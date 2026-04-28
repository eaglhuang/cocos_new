// @spec-source → 見 docs/cross-reference-index.md  (UCUF M3)
/**
 * ICompositeRenderer
 *
 * UCUF M3 — 引擎無關的複合視覺渲染介面。
 * 封裝 RadarChart（多邊形圖）、Grid（格狀佈局）、ProgressBar（進度條）
 * 等需要直接操作引擎 API 的渲染操作，讓 ChildPanel 子類遵守 H-04 規則
 * 而不直接 import cc.Graphics / cc.Layout 等 Cocos runtime 元件。
 *
 * 具體實作：
 *   - Cocos : CocosCompositeRenderer（platform/cocos/CocosCompositeRenderer.ts）
 *   - Unity : UnityCompositeRenderer stub（platform/unity/UnityNodeFactory.ts）
 *
 * Unity 對照：IProceduralUIRenderer / UIComponentBuilder 引擎無關抽象介面
 */
import type { NodeHandle } from './INodeFactory';

// ─── 資料結構 ─────────────────────────────────────────────────────────────────

/**
 * 雷達圖單層定義。
 * dualLayer 使用慣例：layers[0] = 實力（inner fill），layers[1] = 資質（outer fill）。
 */
export interface RadarLayer {
    /**
     * 各軸歸一化值（0~1，對應 0~100%）。
     * 陣列長度必須等於 RadarChartConfig.axes.length（M3 中固定為 6）。
     */
    values: number[];
    /** 填充顏色（hex，如 '#4488FF'）；未設定時使用 renderer 內建色板 */
    color?: string;
    /** 填充不透明度 0~1（預設 0.4） */
    opacity?: number;
    /** 圖例標籤（可選，供日後圖例 UI 直接參照） */
    label?: string;
}

/**
 * 雷達圖配置。
 * M3 固定為 6 軸（str / int / lea / pol / cha / luk）。
 * axes.length 必須等於每個 RadarLayer.values.length。
 */
export interface RadarChartConfig {
    /** 各軸標籤，M3 固定長度 6 */
    axes: string[];
    /** 圖層列表（1 層為單一資料；2 層為 dualLayer 資質 vs 實力） */
    layers: RadarLayer[];
    /** 六角形外接圓半徑（像素，預設 120） */
    size?: number;
    /** 背景格線顏色（hex + alpha，預設 '#FFFFFF33'） */
    gridColor?: string;
    /** 軸標籤字型大小（預設 18） */
    labelFontSize?: number;
    /** 軸標籤顏色（依 axes 順序，hex） */
    axisLabelColors?: string[];
    /** 軸標籤距離中心半徑（預設 size + 22） */
    axisLabelRadius?: number;
    /** 軸標籤 Y 偏移（預設 +5，對齊 HTML text baseline） */
    axisLabelOffsetY?: number;
    /** 是否繪製軸標籤（預設 true） */
    showAxisLabels?: boolean;
    /** 每圈格線數（預設 4，對齊 HTML） */
    gridRings?: number;
    /** 格線寬度（預設 0.7） */
    gridLineWidth?: number;
    /** 軸線寬度（預設 0.7） */
    axisLineWidth?: number;
    /** 雷達輪廓寬度（預設 2） */
    outlineWidth?: number;
    /** 頂點顏色（依 axes 順序，hex） */
    markerColors?: string[];
    /** 頂點半徑（預設 4） */
    markerRadius?: number;
}

/** 格狀佈局配置（GridPanel 使用） */
export interface GridConfig {
    /** 每行欄數（必填） */
    columns: number;
    /** 單格尺寸（可選；未設定時容器均分） */
    cellSize?: { w: number; h: number };
    /** 格間距（可選，preset 0） */
    gap?: { x: number; y: number };
}

/** 進度條配置（ProgressBarPanel 使用） */
export interface ProgressBarConfig {
    /** 顯示標籤文字（如 '統率' / '武力'） */
    label: string;
    /** 當前進度值（0 ~ max） */
    current: number;
    /** 最大值（資質上限） */
    max: number;
    /** 前景填充顏色（hex，預設 '#55AAFF'） */
    barColor?: string;
    /** 背景顏色（hex，預設 '#22222266'） */
    bgColor?: string;
}

// ─── 介面 ─────────────────────────────────────────────────────────────────────

export interface ICompositeRenderer {

    /**
     * 在 parent 下建立雷達圖節點。
     * Cocos 實作：建立 cc.Graphics 節點，繪製背景格線 + 各層多邊形。
     * @returns Graphics 容器節點（可傳入 updateRadarChart 更新而不重建）
     */
    drawRadarChart(parent: NodeHandle, config: RadarChartConfig): Promise<NodeHandle>;

    /**
     * 在 parent 下建立格狀容器節點。
     * Cocos 實作：建立帶 cc.Layout（type=GRID）的容器節點。
     * 子節點由 GridPanel 動態填入。
     * @returns Grid 容器節點
     */
    drawGrid(parent: NodeHandle, config: GridConfig): Promise<NodeHandle>;

    /**
     * 在 parent 下建立進度條節點組（bg bar + fg bar + label）。
     * @returns 外層容器節點（可傳入 updateProgressBar 更新發條而不重建）
     */
    drawProgressBar(parent: NodeHandle, config: ProgressBarConfig): Promise<NodeHandle>;

    /**
     * 更新已建立的雷達圖資料（不重建節點，只重繪 Graphics）。
     * @param chartNode  drawRadarChart 回傳的 NodeHandle
     * @param config     新配置（需與原始 axes.length 相容）
     */
    updateRadarChart(chartNode: NodeHandle, config: RadarChartConfig): void;

    /**
     * 更新已建立的進度條進度值（不重建節點，只調整 fg bar 寬度比例）。
     * @param barNode  drawProgressBar 回傳的 NodeHandle
     * @param current  新進度值（0 ~ max）
     * @param max      最大值
     */
    updateProgressBar(barNode: NodeHandle, current: number, max: number): void;
}
