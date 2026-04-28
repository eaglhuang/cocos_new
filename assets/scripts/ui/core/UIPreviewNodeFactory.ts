// @spec-source → 見 docs/cross-reference-index.md
/**
 * UIPreviewNodeFactory
 *
 * 負責各 UILayoutNodeSpec 類型的元件建構與 Layout 設定：
 *   - setupLayout：掛載 Layout 元件並設定排列方向、間距、padding
 *   - buildPanel：套用背景 skin；無 skin 時使用 SolidBackground fallback
 *   - buildLabel：建立 Label（含 Background 子節點 + skin + i18n + 樣式）
 *   - buildButton：建立 Button（含背景 + 可選 Label 子節點）
 *   - buildScrollList：建立 ScrollView + Content + 可選 VerticalLayout
 *   - buildImage：建立 Sprite 圖片節點
 *
 * 不持有場景狀態，所有依賴由外部注入。
 * UIPreviewBuilder 作為 orchestrator，呼叫此 factory 建立各類元件。
 *
 * Unity 對照：相當於 UI 元件工廠（UIFactory / UIComponentBuilder helper class）
 */
import { Node, Label, Sprite, UITransform, Widget, Layout, ScrollView, ScrollBar, Color, Button, Mask } from 'cc';
import { SolidBackground } from '../components/SolidBackground';
import { UISkinResolver } from './UISkinResolver';
import { UIPreviewStyleBuilder } from './UIPreviewStyleBuilder';
import type { UILayoutNodeSpec } from './UISpecTypes';
import { UIPreviewDiagnostics } from './UIPreviewDiagnostics';
import { UIPreviewLayoutBuilder } from './UIPreviewLayoutBuilder';

export class UIPreviewNodeFactory {

    /** 由 UIPreviewBuilder 在每次 buildScreen 前同步更新 */
    i18nStrings: Record<string, string> = {};

    constructor(
        private readonly skinResolver: UISkinResolver,
        private readonly styleBuilder: UIPreviewStyleBuilder,
        private readonly layoutBuilder: UIPreviewLayoutBuilder,
    ) {}

    // ─── 元件類型建構 ─────────────────────────────────────────────────────────

    /**
     * 建構面板：優先套用 skin；若 skin 不存在則使用 SolidBackground fallback。
     * Unity 對照：Image 元件 + 純色半透明背景 fallback
     */
    async buildPanel(node: Node, spec: UILayoutNodeSpec): Promise<void> {
        if (spec.skinSlot && await this.styleBuilder.applyBackgroundSkin(node, spec.skinSlot)) {
            return;
        }
        // 讀取 skin slot 的 _fallback 顏色（資源尚未匯入時，顯示可識別的佔位色）
        const slot = spec.skinSlot ? this.skinResolver.getSlot(spec.skinSlot) : null;
        const fallbackHex: string   = (slot as any)?._fallback ?? '#1E2328';
        const fallbackAlpha: number = (slot as any)?._fallbackOpacity ?? 200;
        const bg = node.addComponent(SolidBackground);
        const c  = this.skinResolver.resolveColor(fallbackHex);
        bg.color = new Color(c.r, c.g, c.b, fallbackAlpha);
    }

    /**
     * 建構 Label 文字節點。
     *
     * 因 Label（UIRenderer）不能與 Sprite / SolidBackground 共存於同一節點，
     * 當有 skinSlot 時，額外建立 Background 子節點承載 UIRenderer，Label 放父節點。
     * （不能靠 slot.kind 判斷，因 SolidBackground.onLoad() 會主動建立 Sprite）
     *
     * Unity 對照：TextMeshPro + 分層 Image（background）的標準層次結構
     */
    async buildLabel(node: Node, spec: UILayoutNodeSpec): Promise<void> {
        if (spec.skinSlot) {
            const bgNode = new Node('Background');
            bgNode.layer = node.layer;
            node.addChild(bgNode);
            const nodeT = node.getComponent(UITransform);
            const bgT   = bgNode.addComponent(UITransform);
            if (nodeT) bgT.setContentSize(nodeT.width, nodeT.height);
            const bgW = bgNode.addComponent(Widget);
            bgW.isAlignTop = bgW.isAlignBottom = bgW.isAlignLeft = bgW.isAlignRight = true;
            bgW.top = bgW.bottom = bgW.left = bgW.right = 0;
            try {
                await this.styleBuilder.applyBackgroundSkin(bgNode, spec.skinSlot);
            } catch (e) {
                UIPreviewDiagnostics.labelSkinApplyError(spec.name, spec.skinSlot, e as Error);
            }
        }

        const label = node.addComponent(Label);

        // 文字優先順序：textKey > text > bind > 空字串
        if (spec.textKey) {
            label.string = this.i18nStrings[spec.textKey] ?? spec.textKey;
        } else if ((spec as any).text !== undefined) {
            label.string = (spec as any).text as string;
        } else if (spec.bind) {
            // DATA-1-0001: bind path 顯示為 {xxx.yyy} 佔位文字，方便 Preview 辨識資料來源
            // Unity 對照：Inspector 顯示 ViewModel 欄位名稱作為預覽提示
            label.string = `{${spec.bind}}`;
        } else {
            // [UI-2-0023] fallback to empty string to avoid showing node name as UI text.
            // Business logic (onBuildComplete) must explicitly bind this label.
            UIPreviewDiagnostics.labelFallbackWarning(spec.name);
            label.string = '';
        }

        if (spec.styleSlot) {
            const style = this.skinResolver.getLabelStyle(spec.styleSlot);
            if (style) {
                this.styleBuilder.applyLabelStyle(label, style);
                // applyLabelStyle 已保證 overflow ≥ SHRINK，不再硬蓋
            } else {
                // styleSlot 找不到時，仍保障 SHRINK
                label.overflow = Label.Overflow.SHRINK;
            }
        } else {
            // 無 styleSlot 的 label，一律 SHRINK 防溢出
            // Unity 對照：TextMeshPro AutoSize 預設行為
            label.overflow = Label.Overflow.SHRINK;
        }
    }

    /**
     * 建構按鈕。
     * Unity 對照：Button + Image（background）+ Text（label）的標準層次結構
     */
    async buildButton(node: Node, spec: UILayoutNodeSpec): Promise<void> {
        const button = node.getComponent(Button) || node.addComponent(Button);
        button.target = node;

        const applied = spec.skinSlot
            ? await this.styleBuilder.applyButtonSkin(node, spec.skinSlot, button)
            : false;

        if (!applied) {
            await this.buildPanel(node, spec);
        }

        // 若有文字，建立子 Label 節點
        if (spec.textKey || spec.bind || (spec as any).text !== undefined) {
            const labelNode = new Node('Label');
            labelNode.layer  = node.layer;
            labelNode.parent = node;
            const lt      = labelNode.addComponent(UITransform);
            const parentT = node.getComponent(UITransform);
            if (parentT) lt.setContentSize(parentT.width, parentT.height);
            // 不傳 skinSlot：避免子 Label 節點重複掛背景 skin（Sprite 與 Label UIRenderer 互斥）
            await this.buildLabel(labelNode, { ...spec, skinSlot: undefined });
        }
    }

    /**
     * 建構捲動列表（ScrollView + Content + 可選 VerticalLayout）。
     *
     * 層次：DataList(Sprite背景 + ScrollView) → view(Mask) → Content(Layout)
     * 不能把 Mask 加在 DataList 節點上：buildPanel 已先掛 Sprite（UIRenderer）derivate，
     * cc.Graphics（Mask 內部使用）與 cc.Sprite 同節點會衝突。
     * Unity 對照：ScrollRect + viewport(Mask) + Content RectTransform + VerticalLayoutGroup
     */
    async buildScrollList(
        node: Node,
        spec: UILayoutNodeSpec,
        width: number,
        height: number,
    ): Promise<void> {
        // 背景 skin 掛在 DataList 節點本身
        await this.buildPanel(node, spec);

        const sv      = node.addComponent(ScrollView);
        sv.horizontal = false;
        sv.vertical   = true;

        // viewport 子節點：放 Mask（避免與 DataList 上的 Sprite 衝突）
        // Unity 對照：ScrollRect.viewport RectTransform with Mask component
        const viewPort        = new Node('view');
        viewPort.layer        = node.layer;
        viewPort.parent       = node;
        const viewPortT       = viewPort.addComponent(UITransform);
        viewPortT.setContentSize(width, height);
        viewPortT.setAnchorPoint(0.5, 1);
        const viewW           = viewPort.addComponent(Widget);
        viewW.isAlignTop      = viewW.isAlignBottom = viewW.isAlignLeft = viewW.isAlignRight = true;
        viewW.top             = viewW.bottom = viewW.left = viewW.right = 0;
        const mask            = viewPort.addComponent(Mask);
        mask.type             = Mask.Type.GRAPHICS_RECT;

        // Content 容器在 viewport 下（Unity 對照：ScrollRect.content RectTransform）
        const content  = new Node('Content');
        content.layer  = viewPort.layer;
        content.parent = viewPort;
        const contentT = content.addComponent(UITransform);
        contentT.setContentSize(width, height);
        contentT.setAnchorPoint(0.5, 1);  // 對齊頂部，往下擴展

        if (spec.layout) {
            this.layoutBuilder.setupLayout(content, spec);
            const layout = content.getComponent(Layout)!;
            layout.resizeMode = Layout.ResizeMode.CONTAINER;
        }

        sv.content = content;

        if (spec.scrollbar) {
            const barWidth = spec.scrollbar.width ?? 12;
            const barRight = spec.scrollbar.right ?? 4;
            const barTop = spec.scrollbar.top ?? 8;
            const barBottom = spec.scrollbar.bottom ?? 8;

            const barNode = new Node('VerticalScrollBar');
            barNode.layer = node.layer;
            barNode.parent = node;

            const barTransform = barNode.addComponent(UITransform);
            barTransform.setContentSize(barWidth, Math.max(0, height - barTop - barBottom));
            barTransform.setAnchorPoint(1, 1);

            const barWidget = barNode.addComponent(Widget);
            barWidget.isAlignTop = true;
            barWidget.isAlignBottom = true;
            barWidget.isAlignRight = true;
            barWidget.isAlignLeft = false;
            barWidget.top = barTop;
            barWidget.bottom = barBottom;
            barWidget.right = barRight;
            barWidget.left = 0;

            const trackSlot = spec.scrollbar.trackSkinSlot ?? 'general.scrollbar.track';
            const thumbSlot = spec.scrollbar.thumbSkinSlot ?? 'general.scrollbar.thumb';
            await this.buildPanel(barNode, { ...spec, skinSlot: trackSlot });

            const handleNode = new Node('Handle');
            handleNode.layer = node.layer;
            handleNode.parent = barNode;
            const handleTransform = handleNode.addComponent(UITransform);
            handleTransform.setContentSize(Math.max(4, barWidth - 4), 48);
            handleTransform.setAnchorPoint(0.5, 1);
            await this.buildPanel(handleNode, { ...spec, skinSlot: thumbSlot });

            const scrollBar = barNode.addComponent(ScrollBar);
            scrollBar.direction = ScrollBar.Direction.VERTICAL;
            scrollBar.enableAutoHide = spec.scrollbar.autoHide ?? true;
            scrollBar.autoHideTime = spec.scrollbar.autoHideTime ?? 1.2;
            const handleSprite = handleNode.getComponent(Sprite);
            if (handleSprite) {
                scrollBar.handle = handleSprite;
            }
            sv.verticalScrollBar = scrollBar;
            scrollBar.setScrollView(sv);
            scrollBar.show();
        }

        // 儲存 itemTemplate，供 onBuildComplete 動態生成列項時取用
        (node as any)._itemTemplate = spec.itemTemplate;
    }

    /**
     * 建構圖片節點。
     * 若 spriteFrame 尚未匯入（開發期常見），讀取 skin slot 的 _fallback 顏色作為佔位背景，
     * 確保節點在截圖與 Editor Preview 中永遠可見。
     *
     * Unity 對照：Image（Source Image 直接指向 Sprite）+ Inspector 預設色塊
     */
    async buildImage(node: Node, spec: UILayoutNodeSpec): Promise<void> {
        if (!spec.skinSlot) {
            const sprite = node.getComponent(Sprite) || node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            if (spec.interactable) {
                const button = node.getComponent(Button) || node.addComponent(Button);
                button.target = node;
                button.interactable = true;
            }
            return;
        }

        const slot  = this.skinResolver.getSlot(spec.skinSlot);
        const resolveOpacity = (rawOpacity: unknown): number | null => {
            if (typeof rawOpacity !== 'number' || Number.isNaN(rawOpacity)) {
                return null;
            }
            const opacityValue = rawOpacity <= 1 ? Math.round(rawOpacity * 255) : Math.round(rawOpacity);
            return Math.max(0, Math.min(255, opacityValue));
        };

        if (slot && (slot.kind === 'color-rect' || (slot as any).kind === 'color')) {
            await this.styleBuilder.applyBackgroundSkin(node, spec.skinSlot);
            if (spec.interactable) {
                const button = node.getComponent(Button) || node.addComponent(Button);
                button.target = node;
                button.interactable = true;
            }
            return;
        }

        const frame = await this.skinResolver.getSpriteFrame(spec.skinSlot);

        if (!frame) {
            // sprite 資源尚未匯入 → 用 _fallback 顏色做可見佔位，避免節點完全透明
            const fallbackHex: string = (slot as any)?._fallback ?? '#2A2A2A';
            const fallbackOpacity: number = (slot as any)?._fallbackOpacity ?? 180;
            const bg = node.addComponent(SolidBackground);
            bg.color = this.skinResolver.resolveColor(fallbackHex);
            bg.color = new Color(bg.color.r, bg.color.g, bg.color.b, fallbackOpacity);
            // 若有 interactable 設定仍要掛 Button
            if (spec.interactable) {
                const button = node.getComponent(Button) || node.addComponent(Button);
                button.target = node;
                button.interactable = true;
            }
            return;
        }

        const sprite       = node.addComponent(Sprite);
        sprite.sizeMode    = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        const alpha = resolveOpacity((slot as any)?.opacity ?? (slot as any)?.alpha);
        if (alpha !== null) {
            sprite.color = new Color(sprite.color.r, sprite.color.g, sprite.color.b, alpha);
        }
        if (slot?.kind === 'sprite-frame') {
            this.styleBuilder.applySpriteSkin(sprite, slot.spriteType, slot.border);
        }

        // 讓 image 節點也能作為可點擊控制項使用，供 portrait / icon button 類規格共用。
        if (spec.interactable) {
            const button = node.getComponent(Button) || node.addComponent(Button);
            button.target = node;
            button.interactable = true;
        }
    }
}
