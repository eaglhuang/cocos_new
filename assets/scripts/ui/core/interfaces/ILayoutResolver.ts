/**
 * ILayoutResolver
 *
 * 引擎無關的佈局計算介面。
 * 對應 UIPreviewLayoutBuilder 的功能面分層抽象。
 *
 * 設計原則：
 *   - 計算結果以純資料結構（Dimensions / WidgetConstraints）回傳
 *   - 不直接修改節點；呼叫端或平台實作負責將結果套用到引擎節點
 *   - 同步方法（佈局計算不需要非同步載入）
 *
 * Unity 對照：LayoutRebuilder / RectTransform.anchorMin-Max 計算層
 */
import type { UILayoutNodeSpec } from '../UISpecTypes';

/** 寬高（引擎無關的純資料結構） */
export interface Dimensions {
    width: number;
    height: number;
}

/** Widget/Anchor 對齊約束（引擎無關） */
export interface WidgetConstraints {
    isAlignTop?: boolean;
    top?: number;
    isAlignBottom?: boolean;
    bottom?: number;
    isAlignLeft?: boolean;
    left?: number;
    isAlignRight?: boolean;
    right?: number;
    isAlignHorizontalCenter?: boolean;
    horizontalCenter?: number;
    isAlignVerticalCenter?: boolean;
    verticalCenter?: number;
}

/** Layout 分組設定（引擎無關） */
export interface LayoutConfig {
    direction: 'horizontal' | 'vertical' | 'none';
    gap: number;
    paddingTop: number;
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
    autoResizeContainer: boolean;
}

export interface ILayoutResolver {
    /**
     * 從 spec.size（支援絕對 px / 百分比 / "auto"）解析最終像素尺寸。
     * Unity 對照：RectTransform.sizeDelta 計算
     */
    resolveSize(spec: UILayoutNodeSpec, parentDimensions: Dimensions): Dimensions;

    /**
     * 從 spec.widget 解析 Widget/Anchor 對齊約束。
     * Unity 對照：RectTransform.anchorMin / anchorMax / offsetMin / offsetMax
     */
    resolveWidget(widgetDef: UILayoutNodeSpec['widget'], parentDimensions: Dimensions): WidgetConstraints;

    /**
     * 從 spec.layout 解析 Layout 分組設定（方向、間距、padding）。
     * Unity 對照：HorizontalLayoutGroup / VerticalLayoutGroup 的設定
     */
    resolveLayout(spec: UILayoutNodeSpec, parentDimensions: Dimensions): LayoutConfig | null;
}
