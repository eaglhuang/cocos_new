// @spec-source → 見 docs/cross-reference-index.md
/**
 * UIPreviewBuilder
 *
 * 根據 UILayoutSpec（JSON）與 UISkinManifest 動態建構 Cocos 節點樹的主控器。
 * 本身只負責 orchestration，細節職責委派給三個協作模組：
 *   - UIPreviewNodeFactory    → 各類型元件建構（panel / label / button / scroll / image）
 *   - UIPreviewStyleBuilder   → 背景/按鈕 skin、Label 樣式、Widget 對齊
 *   - UIPreviewShadowManager  → shadow / noise 層附加與每幀位置同步
 *
 * Unity 對照：Prefab Variant Builder + EditorWindow 動態生成 UI 的組合
 */
import { _decorator, Component, Label, Node, Sprite, UITransform,
         UIOpacity, Color, tween, Font, Widget, Layout } from 'cc';
import { UISkinResolver, ResolvedButtonSkin } from './UISkinResolver';
import { services } from '../../core/managers/ServiceLoader';
import { resolveSize, DEFAULT_TRANSITION } from './UISpecTypes';
import type { UILayoutNodeSpec, UILayoutSpec, UISkinManifest, TransitionDef,
               SkinLayerDef, CompositeImageLayerDef } from './UISpecTypes';
import { UIPreviewDiagnostics } from './UIPreviewDiagnostics';
import { UIPreviewStyleBuilder, ButtonVisualState } from './UIPreviewStyleBuilder';
// TODO: UIPreviewShadowManager 已移至 _pending-delete/，待所有面板遷移至 CompositePanel 後可一併刪除
import { UIPreviewShadowManager } from './_pending-delete/UIPreviewShadowManager';
import { UIPreviewNodeFactory } from './UIPreviewNodeFactory';
import { UIPreviewLayoutBuilder } from './UIPreviewLayoutBuilder';
import { UITemplateBinder } from './UITemplateBinder';
import { UCUFLogger, LogCategory } from './UCUFLogger';

const { ccclass } = _decorator;

@ccclass('UIPreviewBuilder')
export class UIPreviewBuilder extends Component {

    /** Skin 解析器：將 slot id 解析為 SpriteFrame / Color / LabelStyle */
    protected skinResolver: UISkinResolver = new UISkinResolver();

    /** i18n 字串對照表（key → 顯示文字） */
    protected i18nStrings: Record<string, string> = {};

    /** Design Tokens（顏色、elevation 等設計變數） */
    protected tokens: any = {};

    // 字型預載快取，buildScreen 前預載，applyLabelStyle 時直接取用
    private _fontCache = new Map<string, Font | null>();

    // 協作模組（Unity 對照：各 Manager / Helper component）
    private readonly layoutBuilder = new UIPreviewLayoutBuilder();
    private readonly styleBuilder  = new UIPreviewStyleBuilder(this.skinResolver, this._fontCache);
    private readonly nodeFactory   = new UIPreviewNodeFactory(this.skinResolver, this.styleBuilder, this.layoutBuilder);
    private readonly shadowManager = new UIPreviewShadowManager(
        this.skinResolver, this.styleBuilder, this.layoutBuilder, () => this.node,
    );

    // ─── 公開 API ─────────────────────────────────────────────────────────────

    /**
     * 建構整個 UI 畫面（主入口）。
     * @param layout  Layout Spec（描述節點結構與尺寸）
     * @param skin    Skin Manifest；傳 null 時使用 SolidBackground fallback
     * @param i18n    i18n 字串對照表；傳 null 時顯示 key 作為 placeholder
     * @param tokens  Design Tokens（顏色與 elevation 等變數）
     */
    public async buildScreen(
        layout: UILayoutSpec,
        skin: UISkinManifest | null,
        i18n?: Record<string, string>,
        tokens?: any,
    ): Promise<Node> {
        // ⚠️ 防禦：layout 或 layout.root 為 null 時提前拋出有意義的錯誤
        // 這可讓 BattleHUD catch 區段印出詳細來源，而不是神秘的 "reading 'root'"
        if (!layout) {
            const err = new Error('[UIPreviewBuilder] buildScreen 收到 null layout，請確認 UISpecLoader 是否成功載入 JSON');
            console.error(err.message);
            throw err;
        }
        if (!layout.root) {
            const err = new Error(`[UIPreviewBuilder] buildScreen layout "${layout.id ?? '?'}" 缺少 root 欄位`);
            console.error(err.message, layout);
            throw err;
        }
        console.log(`[UIPreviewBuilder] buildScreen 開始 layout="${layout.id ?? '?'}" skin="${skin?.id ?? 'null'}" node="${this.node?.name ?? 'null'}"`);

        this.shadowManager.clearDetachedShadows();

        if (skin) {
            this.skinResolver.setManifest(skin, tokens);
            await this._preloadFonts(skin);
            // G3: 並行預載所有 sprite slot，避免 buildScreen 內逐一等待（160ms → 30ms）
            // Unity 對照：Resources.LoadAll<Sprite>() 批載
            await this.skinResolver.preloadSlots(Object.keys(skin.slots));
        }
        if (i18n)   { this.i18nStrings = i18n; }
        if (tokens) { this.tokens = tokens; this.shadowManager.tokens = tokens; }

        // 每次 buildScreen 前同步 i18nStrings 給 nodeFactory
        this.nodeFactory.i18nStrings = this.i18nStrings;

        const designWidth  = layout.canvas.designWidth  ?? 1920;
        const designHeight = layout.canvas.designHeight ?? 1080;
        const _tBuildScreen = UCUFLogger.perfBegin('UIPreviewBuilder.buildScreen');

        let rootNode: Node;
        try {
            rootNode = await this._buildNode(layout.root, this.node, designWidth, designHeight);
        } catch (e) {
            UIPreviewDiagnostics.buildScreenError(layout.id ?? '?', e as Error);
            throw e;
        }

        // ─── Post-build Widget realignment pass ──────────────────────────────
        // 整棵節點樹建完後，統一重算所有 Widget 的對齊位置。
        //
        // 原因：_buildNode 遞迴時，Widget.updateAlignment() 是在各節點建立瞬間呼叫的，
        // 但此時父節點的 Layout 分組（VerticalLayout / HorizontalLayout 等）尚未執行，
        // 父節點的實際世界座標尚未穩定。整棵樹建完後再重算，才能拿到正確的父尺寸與位置。
        //
        // Unity 對照：Canvas.ForceUpdateCanvases() — 強制更新所有 RectTransform
        // ─────────────────────────────────────────────────────────────────────
        this._postBuildPass(rootNode);
        UCUFLogger.perfEnd('UIPreviewBuilder.buildScreen', _tBuildScreen);

        // 通用佔位符清除：所有 UIPreviewBuilder 子類在 onBuildComplete 鉤子前
        // 清除任何 {xxx} 格式的 bind 暫存佔位文字（包含 {dynamic}、{name}、{title} …）。
        // Unity 對照：初始化前的 Text.text = "" 預設清空
        try {
            const _BIND_RE = /^\{[^}]+\}$/;
            const clearDynamic = (n: Node) => {
                const lbl = n.getComponent(Label);
                if (lbl && _BIND_RE.test(lbl.string)) lbl.string = '';
                for (const c of n.children) clearDynamic(c);
            };
            clearDynamic(rootNode);
        } catch (_e) { /* silent: 不阻擋後續綁定流程 */ }

        this.onBuildComplete(rootNode);

        // Template 自動綁定機制：掃描節點樹中帶 id 的節點，建立映射後呼叫 onReady
        const binder = new UITemplateBinder();
        binder.bind(rootNode, layout.root);
        this.onReady(binder);

        UIPreviewDiagnostics.buildScreenSuccess(layout.id ?? '?', rootNode.children.length);
        return rootNode;
    }

    protected lateUpdate(): void {
        this.shadowManager.syncDetachedShadows();
    }

    /**
     * 供子類覆寫的鉤子，在 buildScreen 完成後執行。
     * 典型用途：綁定資料、啟動動畫。
     * Unity 對照：Start() 或 Awake() 中的初始化邏輯
     *
     * @deprecated 新畫面請改用 onReady(binder)，可直接透過 binder 查找節點
     */
    protected onBuildComplete(_rootNode: Node): void { /* 子類覆寫 */ }

    /**
     * Template 時代的新鉤子：buildScreen 完成 + 自動綁定完成後呼叫。
     * 子類只需覆寫此方法，透過 binder 直接取用節點，不再需要手寫 BFS。
     *
     * Unity 對照：MonoBehaviour.Start() 搭配已自動連結好的 SerializeField
     */
    protected onReady(_binder: UITemplateBinder): void { /* 子類覆寫 */ }

    /**
     * 手動切換按鈕視覺狀態（補充 Cocos Button 原生不支援 selected 態）。
     * Unity 對照：Selectable.spriteState + Toggle.isOn 判斷視覺狀態
     */
    protected setButtonVisualState(node: Node, state: ButtonVisualState): boolean {
        const sprite   = node.getComponent(Sprite);
        const stateMap = (node as any)._buttonSkinStateMap as Record<ButtonVisualState, ResolvedButtonSkin['normal']> | undefined;
        if (!sprite || !stateMap) return false;
        const frame = stateMap[state] ?? stateMap.normal;
        if (!frame) return false;
        sprite.spriteFrame = frame;
        return true;
    }

    /** 解析 Design Token 顏色（tokenKey 可為 token 路徑或 Hex 字串） */
    public resolveColor(tokenKey: string): Color {
        return this.skinResolver.resolveColor(tokenKey);
    }

    // ─── 動畫 ─────────────────────────────────────────────────────────────────

    /**
     * 播放進場動畫（淡入）。
     * Unity 對照：Animator.SetTrigger("Show") 或 DOFade(1, duration)
     */
    public playEnterTransition(node: Node, transition?: TransitionDef): void {
        const t = { ...DEFAULT_TRANSITION, ...transition };
        if (t.enter === 'none') return;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity).to(t.duration, { opacity: 255 }).start();
    }

    /**
     * 播放退場動畫（淡出），完成後執行回調。
     * Unity 對照：Animator.SetTrigger("Hide") + OnAnimationComplete callback
     */
    public playExitTransition(node: Node, transition?: TransitionDef, onComplete?: () => void): void {
        const t = { ...DEFAULT_TRANSITION, ...transition };
        if (t.exit === 'none') { onComplete?.(); return; }
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        tween(opacity).to(t.duration, { opacity: 0 }).call(() => onComplete?.()).start();
    }

    // ─── 工具方法 ─────────────────────────────────────────────────────────────

    /** 取得 i18n 文字，找不到 key 時直接回傳 key 作為 fallback */
    protected t(key: string): string {
        return this.i18nStrings[key] ?? key;
    }

    /**
     * 動態填充 scroll-list 資料列。
     * @param listPath  列表節點路徑（例如 "Panel/ScrollList"）
     * @param data      資料陣列
     * @param bindFn    綁定函式，將資料寫入 row 節點（Label 等）
     */
    protected async populateList<T>(
        listPath: string,
        data: T[],
        bindFn: (item: T, row: Node) => void,
    ): Promise<void> {
        const listNode = this.node.getChildByPath(listPath);
        if (!listNode) {
            UIPreviewDiagnostics.populateListNodeNotFound(listPath, this.node.children.map(c => c.name));
            return;
        }
        const template = (listNode as any)._itemTemplate as UILayoutNodeSpec | undefined;
        if (!template) {
            UIPreviewDiagnostics.populateListTemplateNotFound(listPath, listNode.children.map(c => c.name));
            return;
        }
        // Content 可能在 view/Content（新架構）或直接在 listNode/Content（舊架構）
        const content = listNode.getChildByPath('view/Content') ?? listNode.getChildByName('Content');
        if (!content) {
            UIPreviewDiagnostics.populateListContentNotFound(listPath, listNode.children.map(c => c.name));
            return;
        }

        UIPreviewDiagnostics.populateListStart(listPath, data.length);
        const contentT = content.getComponent(UITransform);
        // Row 子欄位的百分比間距應相對於 Row 內容區（扣掉 Row 自身的 paddingLeft/paddingRight）。
        // Content.width 在 Layout.CONTAINER 且尚未建立子節點時，可能只剩 paddingLeft + paddingRight。
        // viewPort（view）本身是 Widget(all=0) 撐滿 DataList，post-Widget 後尺寸會更可靠。
        const viewNode = listNode.getChildByName('view');
        const viewT    = viewNode?.getComponent(UITransform);
        const listT    = listNode.getComponent(UITransform);
        const availableW = (viewT?.width ?? 0) > 0 ? viewT!.width
                         : (listT?.width ?? 0) > 0 ? listT!.width
                         : 800;
        const parentW  = Math.max(availableW, 100);
        const parentH  = template.height  ?? 50;

        for (let i = 0; i < data.length; i++) {
            try {
                const row = await this._buildNode(template, content, parentW, parentH as number);
                bindFn(data[i], row);
            } catch (e) {
                UIPreviewDiagnostics.populateListRowError(i, e as Error);
            }
        }
        UIPreviewDiagnostics.populateListComplete(content.children.length);
    }

    // ─── 節點建構核心 ─────────────────────────────────────────────────────────

    protected async _buildNode(
        spec: UILayoutNodeSpec,
        parent: Node,
        parentWidth: number,
        parentHeight: number,
    ): Promise<Node> {
        const node   = new Node(spec.name);
        node.layer   = parent.layer;  // 繼承 UI_2D layer，確保 2D 攝影機下可見
        node.parent  = parent;

        const flowChildInLayout = this._isLayoutFlowChild(spec, parent);
        const widgetDef = flowChildInLayout ? undefined : spec.widget;
        const parentLayout = parent.getComponent(Layout);
        const parentLayoutType = parentLayout?.type;

        if (spec.active === false) node.active = false;

        // UITransform（Unity 對照：RectTransform）
        const transform = node.addComponent(UITransform);
        const w = this._resolveNodeSize(spec.width, parentWidth, flowChildInLayout, spec, 'width', parentLayoutType, parentWidth);
        const h = this._resolveNodeSize(spec.height, parentHeight, flowChildInLayout, spec, 'height', parentLayoutType, w || parentWidth);
        transform.setContentSize(w, h);

        // Widget 對齊（Unity 對照：RectTransform anchor / stretch）
        if (widgetDef) this.layoutBuilder.applyWidget(node, widgetDef, parentWidth, parentHeight);

        // Layout（Unity 對照：LayoutGroup 系列元件）
        const isScrollListRoot = spec.type === 'scroll-list' || spec.type === 'scroll-view';
        if (!isScrollListRoot) {
            this.layoutBuilder.setupLayout(node, spec);
        }

        // 依類型建立元件（委派給 UIPreviewNodeFactory）
        switch (spec.type) {
            case 'container':
                if (spec.skinSlot) await this.styleBuilder.applyBackgroundSkin(node, spec.skinSlot);
                break;
            case 'panel':           await this.nodeFactory.buildPanel(node, spec);        break;
            case 'label':           await this.nodeFactory.buildLabel(node, spec);        break;
            case 'button':          await this.nodeFactory.buildButton(node, spec);       break;
            case 'scroll-list':
            case 'scroll-view': {
                let scrollW = w;
                let scrollH = h;
                if (widgetDef) {
                    if (widgetDef.left !== undefined && widgetDef.right !== undefined) {
                        scrollW = Math.max(
                            parentWidth
                            - resolveSize(widgetDef.left, parentWidth)
                            - resolveSize(widgetDef.right, parentWidth),
                            0,
                        );
                    }
                    if (widgetDef.top !== undefined && widgetDef.bottom !== undefined) {
                        scrollH = Math.max(
                            parentHeight
                            - resolveSize(widgetDef.top, parentHeight)
                            - resolveSize(widgetDef.bottom, parentHeight),
                            0,
                        );
                    }
                }
                await this.nodeFactory.buildScrollList(node, spec, scrollW, scrollH);
                break;
            }
            case 'image':           await this.nodeFactory.buildImage(node, spec);        break;
            case 'resource-counter': await this.nodeFactory.buildLabel(node, spec);       break;
            case 'spacer': break;  // 空白佔位，無需掛載元件
            case 'composite-image': await this._buildCompositeImage(node, spec); break;
        }

        // 附加 skinLayers（UCUF 圖層疊合）
        if (spec.skinLayers && spec.skinLayers.length > 0) {
            await this._applySkinLayers(node, spec.skinLayers);
        }

        this._applySpecOpacity(node, spec.opacity);

        // lazySlot：延遲載入插槽 — 建立空容器後停止遞迴（由 CompositePanel._onLazySlotCreated 接管）
        if (spec.lazySlot === true) {
            this._onLazySlotCreated(spec, node, w, h);
            return node;
        }

        // 附加 shadow / noise 層（委派給 UIPreviewShadowManager）
        await this.shadowManager.attachShadowLayer(node, spec, parent, w, h);
        await this.shadowManager.attachNoiseLayer(node, spec, parent, w, h);

        // 遞迴建立子節點（Widget 對齊後的實際尺寸作為 parentWidth/Height，確保百分比子節點正確計算）
        if (spec.children) {
            const nodeT      = node.getComponent(UITransform);
            let effectiveW = nodeT && nodeT.width  > 0 ? nodeT.width  : w;
            let effectiveH = nodeT && nodeT.height > 0 ? nodeT.height : h;
            if (widgetDef) {
                if (widgetDef.left !== undefined && widgetDef.right !== undefined) {
                    effectiveW = Math.max(
                        parentWidth
                        - resolveSize(widgetDef.left, parentWidth)
                        - resolveSize(widgetDef.right, parentWidth),
                        0,
                    );
                }
                if (widgetDef.top !== undefined && widgetDef.bottom !== undefined) {
                    effectiveH = Math.max(
                        parentHeight
                        - resolveSize(widgetDef.top, parentHeight)
                        - resolveSize(widgetDef.bottom, parentHeight),
                        0,
                    );
                }
            }
            const layoutDef = spec.layout;
            if (layoutDef) {
                effectiveW = Math.max(
                    effectiveW - (layoutDef.paddingLeft ?? 0) - (layoutDef.paddingRight ?? 0),
                    0,
                );
                effectiveH = Math.max(
                    effectiveH - (layoutDef.paddingTop ?? 0) - (layoutDef.paddingBottom ?? 0),
                    0,
                );
            }
            const childWidthAllocations = this._allocateHorizontalFlowWidths(spec, effectiveW);
            for (const child of spec.children) {
                await this._buildNode(child, node, childWidthAllocations.get(child) ?? effectiveW, effectiveH);
            }
            this._resizeFlowNodeToContent(node, spec, flowChildInLayout);
        }

        return node;
    }

    // ─── 私有工具 ─────────────────────────────────────────────────────────────

    /**
     * lazySlot 鉤子（UCUF M2）。
     * 基類為空實作；CompositePanel 覆寫此方法以記錄插槽 entry。
     * Unity 對照：Component.OnEnable() 虛函式鉤子模式。
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected _onLazySlotCreated(_spec: UILayoutNodeSpec, _node: Node, _w: number, _h: number): void { /* no-op */ }

    private _allocateHorizontalFlowWidths(parentSpec: UILayoutNodeSpec, availableWidth: number): Map<UILayoutNodeSpec, number> {
        const allocations = new Map<UILayoutNodeSpec, number>();
        if (!parentSpec.children || parentSpec.layout?.type !== 'horizontal' || availableWidth <= 0) {
            return allocations;
        }

        const flowChildren = parentSpec.children.filter(child =>
            !child.widget || this._isSyntheticFillWidget(child.widget)
        );
        if (flowChildren.length === 0) return allocations;

        const spacing = parentSpec.layout.spacingX ?? parentSpec.layout.spacing ?? 0;
        const totalSpacing = Math.max(0, flowChildren.length - 1) * spacing;
        let fixedWidth = 0;
        const flexibleChildren: UILayoutNodeSpec[] = [];
        for (const child of flowChildren) {
            if (child.width !== undefined) {
                fixedWidth += resolveSize(child.width, availableWidth);
            } else {
                flexibleChildren.push(child);
            }
        }
        if (flexibleChildren.length === 0) return allocations;

        const flexibleWidth = Math.max(1, (availableWidth - fixedWidth - totalSpacing) / flexibleChildren.length);
        for (const child of flexibleChildren) {
            allocations.set(child, flexibleWidth);
        }
        return allocations;
    }

    private _isLayoutFlowChild(spec: UILayoutNodeSpec, parent: Node): boolean {
        const parentLayout = parent.getComponent(Layout);
        if (!parentLayout || parentLayout.type === Layout.Type.NONE) {
            return false;
        }
        if (!spec.widget) {
            return true;
        }
        return this._isSyntheticFillWidget(spec.widget);
    }

    private _isSyntheticFillWidget(widgetDef: UILayoutNodeSpec['widget'] | undefined): boolean {
        if (!widgetDef || typeof widgetDef !== 'object' || Array.isArray(widgetDef)) {
            return false;
        }

        const normalized = {
            top: widgetDef.top,
            left: widgetDef.left,
            right: widgetDef.right,
            bottom: widgetDef.bottom,
            hCenter: (widgetDef as any).hCenter,
            vCenter: (widgetDef as any).vCenter,
        };

        return normalized.top === 0
            && normalized.left === 0
            && normalized.right === 0
            && normalized.bottom === 0
            && normalized.hCenter === undefined
            && normalized.vCenter === undefined;
    }

    private _resolveNodeSize(
        rawValue: number | string | undefined,
        parentSize: number,
        flowChildInLayout: boolean,
        spec?: UILayoutNodeSpec,
        axis?: 'width' | 'height',
        parentLayoutType?: number,
        availableWidth?: number,
    ): number {
        if (rawValue !== undefined) {
            return resolveSize(rawValue, parentSize);
        }
        if (flowChildInLayout && spec && parentLayoutType === Layout.Type.VERTICAL && axis === 'width') {
            return Math.max(1, parentSize);
        }
        if (flowChildInLayout && spec && parentLayoutType === Layout.Type.HORIZONTAL && axis === 'width') {
            return Math.max(1, parentSize);
        }
        if (flowChildInLayout && spec && axis) {
            return this._estimateFlowNodeSize(spec, axis, availableWidth);
        }
        return flowChildInLayout ? 0 : parentSize;
    }

    private _estimateFlowNodeSize(spec: UILayoutNodeSpec, axis: 'width' | 'height', availableWidth?: number): number {
        if (spec.type !== 'label' && spec.type !== 'resource-counter') {
            return 0;
        }

        const style = spec.styleSlot ? this.skinResolver.getLabelStyle(spec.styleSlot) : null;
        const fontSize = style?.fontSize ?? 16;
        const lineHeight = style?.lineHeight ?? Math.ceil(fontSize * 1.4);
        const text = this._resolveSpecText(spec);
        const slot = spec.styleSlot ? this.skinResolver.getSlot(spec.styleSlot) : null;
        const letterSpacing = typeof (slot as any)?.letterSpacing === 'number'
            ? (slot as any).letterSpacing
            : 0;
        const chars = Array.from(text || ' ');
        const textWidth = chars.reduce((sum, char) => {
            const isWideChar = char.charCodeAt(0) > 255;
            return sum + (isWideChar ? fontSize : fontSize * 0.62);
        }, 0);
        const spacingWidth = Math.max(0, chars.length - 1) * letterSpacing;
        const estimatedWidth = Math.max(1, Math.ceil(textWidth + spacingWidth + 2));

        if (axis === 'height') {
            const wrapWidth = Math.max(0, availableWidth ?? 0);
            if (wrapWidth > 0 && estimatedWidth > wrapWidth) {
                const lines = Math.max(1, Math.ceil(estimatedWidth / wrapWidth));
                return Math.max(1, Math.ceil(lines * lineHeight));
            }
            return Math.max(1, lineHeight);
        }

        return estimatedWidth;
    }

    private _resolveSpecText(spec: UILayoutNodeSpec): string {
        if (spec.textKey) {
            return this.i18nStrings[spec.textKey] ?? spec.textKey;
        }
        if ((spec as any).text !== undefined) {
            return String((spec as any).text);
        }
        if (spec.bind) {
            return `{${spec.bind}}`;
        }
        return '';
    }

    private _resizeFlowNodeToContent(node: Node, spec: UILayoutNodeSpec, flowChildInLayout: boolean): void {
        if (!flowChildInLayout || (spec.width !== undefined && spec.height !== undefined)) {
            return;
        }

        const transform = node.getComponent(UITransform);
        if (!transform) return;

        const activeChildren = node.children.filter(child =>
            child.active &&
            child.getComponent(UITransform) &&
            !child.name.startsWith('skinLayer_')
        );
        if (activeChildren.length === 0) return;

        const layout = node.getComponent(Layout);
        let contentWidth = 0;
        let contentHeight = 0;

        if (layout && layout.type === Layout.Type.GRID) {
            const itemCount = activeChildren.length;
            const fixedCols = layout.constraint === Layout.Constraint.FIXED_COL && layout.constraintNum > 0;
            const fixedRows = layout.constraint === Layout.Constraint.FIXED_ROW && layout.constraintNum > 0;
            const columns = fixedCols
                ? layout.constraintNum
                : fixedRows
                    ? Math.max(1, Math.ceil(itemCount / layout.constraintNum))
                    : Math.max(1, itemCount);
            const rows = fixedRows
                ? layout.constraintNum
                : Math.max(1, Math.ceil(itemCount / columns));

            contentWidth = columns * layout.cellSize.width
                + Math.max(0, columns - 1) * layout.spacingX
                + layout.paddingLeft
                + layout.paddingRight;
            contentHeight = rows * layout.cellSize.height
                + Math.max(0, rows - 1) * layout.spacingY
                + layout.paddingTop
                + layout.paddingBottom;
        } else if (layout && layout.type !== Layout.Type.NONE) {
            const isVertical = layout.type === Layout.Type.VERTICAL;
            const spacing = isVertical ? layout.spacingY : layout.spacingX;
            const spacingTotal = Math.max(0, activeChildren.length - 1) * spacing;
            for (const child of activeChildren) {
                const childTransform = child.getComponent(UITransform)!;
                if (isVertical) {
                    contentWidth = Math.max(contentWidth, childTransform.width);
                    contentHeight += childTransform.height;
                } else {
                    contentWidth += childTransform.width;
                    contentHeight = Math.max(contentHeight, childTransform.height);
                }
            }
            if (isVertical) {
                contentHeight += spacingTotal + layout.paddingTop + layout.paddingBottom;
                contentWidth += layout.paddingLeft + layout.paddingRight;
            } else {
                contentWidth += spacingTotal + layout.paddingLeft + layout.paddingRight;
                contentHeight += layout.paddingTop + layout.paddingBottom;
            }
        } else {
            for (const child of activeChildren) {
                const childTransform = child.getComponent(UITransform)!;
                contentWidth = Math.max(contentWidth, childTransform.width);
                contentHeight = Math.max(contentHeight, childTransform.height);
            }
        }

        const nextWidth = spec.width === undefined ? Math.max(1, Math.ceil(Math.max(contentWidth, transform.width))) : transform.width;
        const nextHeight = spec.height === undefined ? Math.max(1, Math.ceil(Math.max(contentHeight, transform.height))) : transform.height;
        transform.setContentSize(nextWidth, nextHeight);
    }

    private _applySpecOpacity(node: Node, rawOpacity: number | undefined): void {
        if (typeof rawOpacity !== 'number' || Number.isNaN(rawOpacity)) {
            return;
        }

        const resolvedOpacity = rawOpacity <= 1 ? Math.round(rawOpacity * 255) : Math.round(rawOpacity);
        const clampedOpacity = Math.max(0, Math.min(255, resolvedOpacity));
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        opacity.opacity = clampedOpacity;
    }

    /**
     * composite-image 節點：將 compositeImageLayers 依 zOrder 排序後，
     * 逐層建立子 Sprite 節點疊合。
     * Unity 對照：多層 RawImage 手動疊合的 Composite Image 元件。
     */
    private async _buildCompositeImage(node: Node, spec: UILayoutNodeSpec): Promise<void> {
        const layers = spec.compositeImageLayers;
        if (!layers || layers.length === 0) return;

        const sorted = [...layers].sort((a, b) => a.zOrder - b.zOrder);
        const ut = node.getComponent(UITransform)!;

        for (const layer of sorted) {
            const frame = await this.skinResolver.getSpriteFrame(layer.spriteSlotId);
            if (!frame) continue;

            const child = new Node(`composite_${layer.spriteSlotId}`);
            node.addChild(child);

            const childT = child.addComponent(UITransform);
            childT.width  = ut.width;
            childT.height = ut.height;

            const sprite       = child.addComponent(Sprite);
            sprite.sizeMode    = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = frame;

            if (layer.opacity !== undefined && layer.opacity < 1) {
                const op = child.addComponent(UIOpacity);
                op.opacity = Math.round(layer.opacity * 255);
            }
            if (layer.tint) {
                sprite.color = this.skinResolver.resolveColor(layer.tint);
            }
        }
    }

    /**
     * UCUF skinLayers：在任意節點上疊加額外圖層（texture / pattern / overlay）。
     * 各層依 zOrder 排序後建立為子 Sprite 節點。
     * Unity 對照：CanvasRenderer 的 additionalMaterial stack。
     */
    private async _applySkinLayers(node: Node, skinLayers: SkinLayerDef[]): Promise<void> {
        if (skinLayers.length > 12) {
            console.warn(`[UIPreviewBuilder] skinLayers count (${skinLayers.length}) exceeds recommended max 12`);
        }

        const sorted = [...skinLayers].sort((a, b) => this._resolveSkinLayerZOrder(a) - this._resolveSkinLayerZOrder(b));
        const ut = node.getComponent(UITransform);
        const parentWidth = ut ? ut.width : 0;
        const parentHeight = ut ? ut.height : 0;

        for (const layer of sorted) {
            const child = new Node(`skinLayer_${layer.layerId}`);
            node.addChild(child);

            const childT = child.addComponent(UITransform);
            const hasExplicitGeometry = layer.width !== undefined || layer.height !== undefined;
            if (hasExplicitGeometry) {
                childT.width = layer.width ?? parentWidth;
                childT.height = layer.height ?? parentHeight;
            } else if (layer.expand !== false && ut) {
                childT.width = ut.width;
                childT.height = ut.height;
            } else {
                const frame = await this.skinResolver.getSpriteFrame(layer.slotId);
                childT.width = frame ? frame.width : parentWidth;
                childT.height = frame ? frame.height : parentHeight;
            }

            if (layer.widget) {
                this.layoutBuilder.applyWidget(child, layer.widget, parentWidth, parentHeight);
            } else if (layer.expand !== false) {
                this.layoutBuilder.applyWidget(child, { top: 0, left: 0, right: 0, bottom: 0 }, parentWidth, parentHeight);
            }

            const applied = await this.styleBuilder.applyBackgroundSkin(child, layer.slotId);
            if (!applied) {
                child.destroy();
                continue;
            }

            if (layer.opacity !== undefined && layer.opacity < 1) {
                const op = child.addComponent(UIOpacity);
                op.opacity = Math.round(layer.opacity * 255);
            }
        }
    }

    private _resolveSkinLayerZOrder(layer: SkinLayerDef): number {
        const legacyOrder = (layer as SkinLayerDef & { order?: number }).order;
        if (typeof layer.zOrder === 'number' && !Number.isNaN(layer.zOrder)) return layer.zOrder;
        if (typeof legacyOrder === 'number' && !Number.isNaN(legacyOrder)) return legacyOrder;
        return 0;
    }

    /**
     * Post-build 收斂階段（M8 效能優化）。
     * 整棵樹建完後依序執行：
     *   1. realign → layout（初步穩定 Widget + LayoutGroup）
     *   2. realign（以穩定後父尺寸再對齊）
     *   3. enforceContainerBounds（溢出保護）
     *   4. layout → realign（bounds 修正後再收斂）
     *
     * 統一以 perfBegin/perfEnd 包裹供 UCUFLogger 監控。
     * Unity 對照：Canvas.ForceUpdateCanvases() + LayoutRebuilder 組合
     */
    protected _postBuildPass(root: Node): void {
        const t = UCUFLogger.perfBegin('UIPreviewBuilder._postBuildPass');
        this._realignAllWidgets(root);
        this._updateAllLayouts(root);
        this._realignAllWidgets(root);
        this._enforceContainerBounds(root);
        this._updateAllLayouts(root);
        this._realignAllWidgets(root);
        UCUFLogger.perfEnd('UIPreviewBuilder._postBuildPass', t);
    }

    /**
     * Post-build Widget realignment pass：遞迴遍歷整棵節點樹，
     * 對每個掛有 Widget 元件的節點呼叫 updateAlignment()。
     *
     * 必須在 _buildNode 完成（整棵樹建立後）才呼叫，確保：
     *   1. 所有父節點的 UITransform 已設定正確尺寸
     *   2. Layout 分組（VerticalLayout 等）已有完整子節點可計算
     *   3. Widget 的 top/bottom/left/right/hCenter/vCenter 計算以正確尺寸為基準
     *
     * Unity 對照：Canvas.ForceUpdateCanvases()
     */
    private _realignAllWidgets(node: Node): void {
        const widget = node.getComponent(Widget);
        if (widget) {
            widget.alignMode = Widget.AlignMode.ALWAYS;
            widget.updateAlignment();
        }
        for (const child of node.children) {
            this._realignAllWidgets(child);
        }
    }

    /**
     * Post-build Layout pass：子節點全數建立完成後，補跑 LayoutGroup 重新排版。
     * Unity 對照：Instantiate 完整個 hierarchy 後，呼叫 LayoutRebuilder.ForceRebuildLayoutImmediate。
     */
    private _updateAllLayouts(node: Node): void {
        for (const child of node.children) {
            this._updateAllLayouts(child);
        }

        const layout = node.getComponent(Layout);
        if (layout) {
            layout.updateLayout(true);
        }
    }

    /**
     * 預載 skin 裡所有 label-style slot 使用的字型到 _fontCache。
     * Unity 對照：Resources.Load<Font>() 預載字型
     */
    private async _preloadFonts(skin: UISkinManifest): Promise<void> {
        const paths = new Set<string>();
        for (const slot of Object.values(skin.slots)) {
            if (slot.kind === 'label-style' && (slot as any).font) {
                paths.add((slot as any).font as string);
            }
        }
        await Promise.all([...paths].map(async (path) => {
            if (this._fontCache.has(path)) return;
            try {
                const font = await services().resource.loadFont(path);
                this._fontCache.set(path, font);
            } catch {
                UIPreviewDiagnostics.fontLoadWarning(path);
                this._fontCache.set(path, null);
            }
        }));
    }

    // ─── 容器溢出自動修正 ─────────────────────────────────────────────────────

    /**
     * Post-build 容器溢出保護 pass（bottom-up 遞迴）。
     *
     * 對每個使用 vertical / horizontal Layout 的容器：
     *   1. 計算可用空間 = 容器尺寸 − padding
     *   2. 計算子節點總需求 = Σ childSize + (n−1) × spacing
     *   3. 若需求 > 可用空間 → 按比例縮減子節點尺寸使其剛好填滿
     *   4. 同時確保被縮減的 label 子節點保持 overflow ≥ SHRINK
     *
     * 只縮不擴，不影響原本不溢出的容器。
     *
     * Unity 對照：ContentSizeFitter 配合 LayoutGroup.childForceExpand 的邊界保護邏輯
     */
    private _enforceContainerBounds(node: Node): void {
        // bottom-up：先處理子節點，再處理本節點
        for (const child of node.children) {
            this._enforceContainerBounds(child);
        }

        const layout = node.getComponent(Layout);
        if (!layout || layout.type === Layout.Type.NONE || layout.type === Layout.Type.GRID) return;

        const containerT = node.getComponent(UITransform);
        if (!containerT) return;

        const isVertical = layout.type === Layout.Type.VERTICAL;
        const containerSize = isVertical ? containerT.height : containerT.width;
        const padStart = isVertical ? layout.paddingTop : layout.paddingLeft;
        const padEnd   = isVertical ? layout.paddingBottom : layout.paddingRight;
        const spacing  = isVertical ? layout.spacingY : layout.spacingX;

        // skinLayer_ 前置詞的子節點是 decorative overlay（expand:true），不參與 Layout 計算
        const activeChildren = node.children.filter(c =>
            c.active &&
            c.getComponent(UITransform) &&
            !c.name.startsWith('skinLayer_')
        );
        if (activeChildren.length === 0) return;

        const totalSpacing = Math.max(0, activeChildren.length - 1) * spacing;
        const available = containerSize - padStart - padEnd - totalSpacing;

        let totalChildSize = 0;
        for (const child of activeChildren) {
            const ct = child.getComponent(UITransform)!;
            totalChildSize += isVertical ? ct.height : ct.width;
        }

        if (totalChildSize <= available || totalChildSize <= 0) return;

        // 溢出偵測 → 按比例縮減
        const scale = available / totalChildSize;
        console.warn(
            `[UIPreviewBuilder] 容器 "${node.name}" 子節點溢出` +
            `（需 ${Math.round(totalChildSize)}px，可用 ${Math.round(available)}px）→ 自動縮減 ×${scale.toFixed(3)}`
        );

        for (const child of activeChildren) {
            const ct = child.getComponent(UITransform)!;
            if (isVertical) {
                ct.setContentSize(ct.width, Math.floor(ct.height * scale));
            } else {
                ct.setContentSize(Math.floor(ct.width * scale), ct.height);
            }
            // 確保被縮減的 label 保持 SHRINK overflow
            const lbl = child.getComponent(Label);
            if (lbl && lbl.overflow === Label.Overflow.NONE) {
                lbl.overflow = Label.Overflow.SHRINK;
            }
        }
    }
}
