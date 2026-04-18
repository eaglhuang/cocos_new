// @spec-source → 見 docs/cross-reference-index.md  (UCUF M3)
/**
 * CocosCompositeRenderer
 *
 * UCUF M3 — ICompositeRenderer 的 Cocos Creator 3.x 具體實作。
 * 此檔案是 Cocos runtime API（cc.Graphics / cc.Layout / cc.Sprite 等）
 * 進入 UCUF 框架的唯一入口，符合 H-04 規則。
 *
 * 實作細節：
 *   drawRadarChart  → cc.Graphics 繪製六角形格線 + 各層多邊形 fill
 *   drawGrid        → cc.Layout（type=GRID）容器；子節點由 GridPanel 填充
 *   drawProgressBar → bg Sprite（自訂色）+ fg Sprite（FILLED 模式）+ Label
 *
 * Unity 對照：UIProceduralRenderer（LineRenderer / Image.fillAmount 組合）
 */
import {
    Node, UITransform, Graphics, Layout, Color, Sprite, UIOpacity,
    SpriteFrame, Label, HorizontalTextAlignment, VerticalTextAlignment,
} from 'cc';
import type { NodeHandle } from '../../core/interfaces/INodeFactory';
import type {
    ICompositeRenderer,
    RadarChartConfig,
    GridConfig,
    ProgressBarConfig,
} from '../../core/interfaces/ICompositeRenderer';
import { SolidBackground } from '../../components/SolidBackground';

// ─── 內部工具 ─────────────────────────────────────────────────────────────────

/** 從 hex（#RRGGBB 或 #RRGGBBAA）解析 cc.Color */
function hexToColor(hex: string, defaultAlpha = 255): Color {
    const raw = hex.replace('#', '');
    const r   = parseInt(raw.slice(0, 2), 16);
    const g   = parseInt(raw.slice(2, 4), 16);
    const b   = parseInt(raw.slice(4, 6), 16);
    const a   = raw.length >= 8 ? parseInt(raw.slice(6, 8), 16) : defaultAlpha;
    return new Color(r, g, b, a);
}

/** 確保 Node 具有 UITransform（若已有則直接回傳） */
function ensureUITransform(node: Node, w: number, h: number): UITransform {
    let ut = node.getComponent(UITransform);
    if (!ut) ut = node.addComponent(UITransform);
    ut.setContentSize(w, h);
    return ut;
}

// ─── 主類別 ──────────────────────────────────────────────────────────────────

export class CocosCompositeRenderer implements ICompositeRenderer {

    // ── RadarChart ─────────────────────────────────────────────────────────

    async drawRadarChart(parent: NodeHandle, config: RadarChartConfig): Promise<NodeHandle> {
        const parentNode = parent as Node;
        const size       = config.size ?? 120;
        const canvasSize = size * 2 + 60; // 留邊給 label

        const container = new Node('RadarChart');
        ensureUITransform(container, canvasSize, canvasSize);
        parentNode.addChild(container);

        const gfxNode = new Node('RadarGfx');
        ensureUITransform(gfxNode, canvasSize, canvasSize);
        container.addChild(gfxNode);

        const gfx = gfxNode.addComponent(Graphics);
        this._drawRadarInternal(gfx, config, size);

        return container;
    }

    updateRadarChart(chartNode: NodeHandle, config: RadarChartConfig): void {
        const container = chartNode as Node;
        const gfxNode   = container.getChildByName('RadarGfx');
        if (!gfxNode) return;
        const gfx = gfxNode.getComponent(Graphics);
        if (!gfx) return;
        gfx.clear();
        const size = config.size ?? 120;
        this._drawRadarInternal(gfx, config, size);
    }

    /**
     * 內部繪圖：先畫背景格線，再畫各 layer 的填充多邊形。
     */
    private _drawRadarInternal(gfx: Graphics, config: RadarChartConfig, size: number): void {
        const { axes, layers } = config;
        const n       = axes.length;
        const gridClr = hexToColor(config.gridColor ?? '#FFFFFF33');

        // 1. 背景格線（3 圈）
        gfx.lineWidth = 1;
        gfx.strokeColor = gridClr;
        for (let ring = 1; ring <= 3; ring++) {
            const r = (size / 3) * ring;
            gfx.moveTo(...this._radialPoint(0, r, n));
            for (let i = 1; i <= n; i++) {
                gfx.lineTo(...this._radialPoint(i, r, n));
            }
            gfx.stroke();
        }

        // 2. 軸線（從圓心到頂點）
        for (let i = 0; i < n; i++) {
            const [x, y] = this._radialPoint(i, size, n);
            gfx.moveTo(0, 0);
            gfx.lineTo(x, y);
        }
        gfx.stroke();

        // 3. 各 layer 填充（倒序畫，讓 index=0 在最上層）
        for (let li = layers.length - 1; li >= 0; li--) {
            const layer   = layers[li];
            const fillClr = hexToColor(layer.color ?? (li === 0 ? '#4488FF' : '#FFAA22'));
            const alpha   = Math.round((layer.opacity ?? 0.4) * 255);
            fillClr.a     = alpha;

            gfx.fillColor = fillClr;
            const [x0, y0] = this._radialPoint(0, layer.values[0] * size, n);
            gfx.moveTo(x0, y0);
            for (let i = 1; i < n; i++) {
                const [x, y] = this._radialPoint(i, layer.values[i] * size, n);
                gfx.lineTo(x, y);
            }
            gfx.close();
            gfx.fill();
        }
    }

    /**
     * 計算第 i 個頂點坐標（從正上方（-90°）開始，順時針）。
     * Cocos 2D：Y 軸朝上，因此 sin 取負值到正確朝向。
     */
    private _radialPoint(i: number, r: number, n: number): [number, number] {
        const angle = (2 * Math.PI * i / n) - Math.PI / 2;
        return [r * Math.cos(angle), r * Math.sin(angle)];
    }

    // ── Grid ────────────────────────────────────────────────────────────────

    async drawGrid(parent: NodeHandle, config: GridConfig): Promise<NodeHandle> {
        const parentNode = parent as Node;
        const container  = new Node('GridContainer');
        const ut         = container.addComponent(UITransform);
        ut.setContentSize(0, 0); // Content size 由 Layout 自動計算

        const layout      = container.addComponent(Layout);
        layout.type       = Layout.Type.GRID;
        layout.constraint = Layout.Constraint.FIXED_COL;
        layout.constraintNum = config.columns;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;

        if (config.gap) {
            layout.spacingX = config.gap.x;
            layout.spacingY = config.gap.y;
        }
        if (config.cellSize) {
            layout.cellSize.width  = config.cellSize.w;
            layout.cellSize.height = config.cellSize.h;
        }

        parentNode.addChild(container);
        return container;
    }

    // ── ProgressBar ────────────────────────────────────────────────────────

    async drawProgressBar(parent: NodeHandle, config: ProgressBarConfig): Promise<NodeHandle> {
        const parentNode = parent as Node;
        const barW = 240;
        const barH = 24;
        const rowH = 36;

        const container = new Node('ProgressBar');
        ensureUITransform(container, barW + 80, rowH);
        parentNode.addChild(container);

        // Label
        const labelNode = new Node('PBLabel');
        ensureUITransform(labelNode, 70, rowH);
        labelNode.setPosition(-barW / 2 - 35 + 70 / 2, 0, 0);
        const lbl       = labelNode.addComponent(Label);
        lbl.string      = config.label;
        lbl.fontSize    = 18;
        lbl.horizontalAlign = HorizontalTextAlignment.RIGHT;
        lbl.verticalAlign   = VerticalTextAlignment.CENTER;
        container.addChild(labelNode);

        // BG bar
        const bgNode = new Node('PBBg');
        ensureUITransform(bgNode, barW, barH);
        bgNode.setPosition(35, 0, 0);
        const bgBg   = bgNode.addComponent(SolidBackground);
        const bgClr  = hexToColor(config.bgColor ?? '#22222266');
        bgBg.color   = bgClr;
        container.addChild(bgNode);

        // FG bar（固定在 bg 左側，寬度按比例）
        const ratio  = config.max > 0 ? Math.min(1, config.current / config.max) : 0;
        const fgW    = Math.max(0, barW * ratio);
        const fgNode = new Node('PBFg');
        ensureUITransform(fgNode, fgW, barH);
        // 左對齊：fgNode 的 pivot 預設 0.5，因此 posX = -barW/2 + fgW/2 + bgNode.posX
        fgNode.setPosition(35 - barW / 2 + fgW / 2, 0, 0);
        const fgBg  = fgNode.addComponent(SolidBackground);
        const fgClr = hexToColor(config.barColor ?? '#55AAFF');
        fgBg.color  = fgClr;
        container.addChild(fgNode);

        // 將 current / max 存在 customData 供 updateProgressBar 快速讀取
        (container as any).__pbBarW = barW;
        (container as any).__pbBgX  = 35;

        return container;
    }

    updateProgressBar(barNode: NodeHandle, current: number, max: number): void {
        const container = barNode as Node;
        const fgNode    = container.getChildByName('PBFg');
        if (!fgNode) return;
        const barW  = (container as any).__pbBarW ?? 240;
        const bgX   = (container as any).__pbBgX  ?? 35;
        const ratio = max > 0 ? Math.min(1, current / max) : 0;
        const fgW   = Math.max(0, barW * ratio);
        const ut    = fgNode.getComponent(UITransform);
        if (ut) ut.setContentSize(fgW, ut.height);
        fgNode.setPosition(bgX - barW / 2 + fgW / 2, 0, 0);
    }
}
