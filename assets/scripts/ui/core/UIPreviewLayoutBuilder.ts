import { Node, Layout, Size, Widget } from 'cc';
import type { UILayoutNodeSpec } from './UISpecTypes';
import { resolveSize } from './UISpecTypes';

/**
 * UIPreviewLayoutBuilder
 * 
 * 負責節點的佈局與對齊元件設定：
 *   - applyWidget: 設定 Widget 對齊 (Unity: RectTransform anchors)
 *   - setupLayout: 設定 Layout 分組 (Unity: LayoutGroup)
 */
export class UIPreviewLayoutBuilder {

    private static readonly DEFAULT_GRID_CELL = 100;

    /**
     * 套用 Widget 對齊設定到節點。
     * Unity 對照：RectTransform anchor + stretch 設定
     *
     * 支援欄位：
     *   top / bottom / left / right   → Widget 對邊距留白
     *   hCenter: true                 → 水平置中（alignHorizontalCenter = 0）
     *   vCenter: true                 → 垂直置中（alignVerticalCenter = 0）
     *   hCenter: number               → 水平置中偏移（正值向右）
     *   vCenter: number               → 垂直置中偏移（正值向上）
     */
    public applyWidget(
        node: Node,
        widgetDef?: UILayoutNodeSpec['widget'],
        parentWidth = 0,
        parentHeight = 0,
    ): void {
        if (!widgetDef) return;
        const widget = node.getComponent(Widget) || node.addComponent(Widget);
        if (widgetDef.top    !== undefined) { widget.isAlignTop    = true; widget.top    = resolveSize(widgetDef.top, parentHeight); }
        if (widgetDef.bottom !== undefined) { widget.isAlignBottom = true; widget.bottom = resolveSize(widgetDef.bottom, parentHeight); }
        if (widgetDef.left   !== undefined) { widget.isAlignLeft   = true; widget.left   = resolveSize(widgetDef.left, parentWidth); }
        if (widgetDef.right  !== undefined) { widget.isAlignRight  = true; widget.right  = resolveSize(widgetDef.right, parentWidth); }

        // 水平置中：hCenter = true（偏移 0）或 hCenter = number（帶偏移）
        const hc = (widgetDef as any).hCenter;
        if (hc !== undefined) {
            widget.isAlignHorizontalCenter = true;
            widget.horizontalCenter = typeof hc === 'number' ? hc : 0;
        }

        // 垂直置中：vCenter = true（偏移 0）或 vCenter = number（帶偏移）
        const vc = (widgetDef as any).vCenter;
        if (vc !== undefined) {
            widget.isAlignVerticalCenter = true;
            widget.verticalCenter = typeof vc === 'number' ? vc : 0;
        }

        // 注意：此處不呼叫 updateAlignment()。
        // 整棵樹建完後由 UIPreviewBuilder._postBuildPass() 統一重算對齊，
        // 可避免建樹期間父容器尺寸尚未穩定時的冀示計算對齊寬魯。
        // Unity 對照：Canvas.ForceUpdateCanvases() 在整樹 Instantiate 完成後才呼叫。
    }

    /**
     * 掛載 Layout 元件並設定排列方向、間距與 padding。
     * Unity 對照：HorizontalLayoutGroup / VerticalLayoutGroup / GridLayoutGroup
     */
    public setupLayout(node: Node, spec: UILayoutNodeSpec): void {
        if (!spec.layout) return;
        const layout = node.getComponent(Layout) || node.addComponent(Layout);
        
        switch (spec.layout.type) {
            case 'horizontal': layout.type = Layout.Type.HORIZONTAL; break;
            case 'vertical':   layout.type = Layout.Type.VERTICAL;   break;
            case 'grid':       layout.type = Layout.Type.GRID;       break;
            default:           layout.type = Layout.Type.NONE;       break;
        }

        layout.spacingX      = spec.layout.spacingX     ?? spec.layout.spacing ?? 0;
        layout.spacingY      = spec.layout.spacingY     ?? spec.layout.spacing ?? 0;
        layout.paddingLeft   = spec.layout.paddingLeft   ?? 0;
        layout.paddingRight  = spec.layout.paddingRight  ?? 0;
        layout.paddingTop    = spec.layout.paddingTop    ?? 0;
        layout.paddingBottom = spec.layout.paddingBottom ?? 0;

        if (layout.type === Layout.Type.GRID) {
            const cellWidth = spec.layout.cellWidth ?? UIPreviewLayoutBuilder.DEFAULT_GRID_CELL;
            const cellHeight = spec.layout.cellHeight ?? UIPreviewLayoutBuilder.DEFAULT_GRID_CELL;
            layout.cellSize = new Size(cellWidth, cellHeight);

            switch (spec.layout.startAxis) {
                case 'vertical':
                    layout.startAxis = Layout.AxisDirection.VERTICAL;
                    break;
                default:
                    layout.startAxis = Layout.AxisDirection.HORIZONTAL;
                    break;
            }

            switch (spec.layout.constraint) {
                case 'fixed-row':
                    layout.constraint = Layout.Constraint.FIXED_ROW;
                    break;
                case 'fixed-col':
                    layout.constraint = Layout.Constraint.FIXED_COL;
                    break;
                default:
                    layout.constraint = Layout.Constraint.NONE;
                    break;
            }

            if (typeof spec.layout.constraintNum === 'number' && spec.layout.constraintNum > 0) {
                layout.constraintNum = spec.layout.constraintNum;
            }
        }

        if (layout.type === Layout.Type.HORIZONTAL) {
            layout.horizontalDirection = spec.layout.horizontalDirection === 'right-to-left'
                ? Layout.HorizontalDirection.RIGHT_TO_LEFT
                : Layout.HorizontalDirection.LEFT_TO_RIGHT;
        }

        if (layout.type === Layout.Type.VERTICAL) {
            layout.verticalDirection = spec.layout.verticalDirection === 'bottom-to-top'
                ? Layout.VerticalDirection.BOTTOM_TO_TOP
                : Layout.VerticalDirection.TOP_TO_BOTTOM;
        }
        
        // resizeMode：預設 NONE（僅排位），可由 spec 指定
        //   'container' → 容器自適應子節點總尺寸
        //   'children'  → 子節點自適應容器尺寸（均分）
        // Unity 對照：ContentSizeFitter / LayoutGroup.childForceExpand
        switch (spec.layout.resizeMode) {
            case 'container': layout.resizeMode = Layout.ResizeMode.CONTAINER; break;
            case 'children':  layout.resizeMode = Layout.ResizeMode.CHILDREN;  break;
            default:          layout.resizeMode = Layout.ResizeMode.NONE;      break;
        }
    }
}
