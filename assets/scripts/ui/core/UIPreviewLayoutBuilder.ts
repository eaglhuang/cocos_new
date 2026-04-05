import { Node, Layout, Widget, UITransform } from 'cc';
import type { UILayoutNodeSpec } from './UISpecTypes';

/**
 * UIPreviewLayoutBuilder
 * 
 * 負責節點的佈局與對齊元件設定：
 *   - applyWidget: 設定 Widget 對齊 (Unity: RectTransform anchors)
 *   - setupLayout: 設定 Layout 分組 (Unity: LayoutGroup)
 */
export class UIPreviewLayoutBuilder {

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
    public applyWidget(node: Node, widgetDef?: UILayoutNodeSpec['widget']): void {
        if (!widgetDef) return;
        const widget = node.getComponent(Widget) || node.addComponent(Widget);
        if (widgetDef.top    !== undefined) { widget.isAlignTop    = true; widget.top    = widgetDef.top;    }
        if (widgetDef.bottom !== undefined) { widget.isAlignBottom = true; widget.bottom = widgetDef.bottom; }
        if (widgetDef.left   !== undefined) { widget.isAlignLeft   = true; widget.left   = widgetDef.left;   }
        if (widgetDef.right  !== undefined) { widget.isAlignRight  = true; widget.right  = widgetDef.right;  }

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

        // 強制更新一次以確保佈局正確
        widget.updateAlignment();
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

        layout.spacingX      = spec.layout.spacing      ?? 0;
        layout.spacingY      = spec.layout.spacing      ?? 0;
        layout.paddingLeft   = spec.layout.paddingLeft   ?? 0;
        layout.paddingRight  = spec.layout.paddingRight  ?? 0;
        layout.paddingTop    = spec.layout.paddingTop    ?? 0;
        layout.paddingBottom = spec.layout.paddingBottom ?? 0;
        
        // 預設不自動調整容器大小，除非是 scroll-list content
        layout.resizeMode    = Layout.ResizeMode.NONE;
    }
}
