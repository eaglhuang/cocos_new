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
import { _decorator, Component, Node, Sprite, UITransform,
         UIOpacity, Color, tween, Font } from 'cc';
import { UISkinResolver, ResolvedButtonSkin } from './UISkinResolver';
import { services } from '../../core/managers/ServiceLoader';
import { resolveSize, DEFAULT_TRANSITION } from './UISpecTypes';
import type { UILayoutNodeSpec, UILayoutSpec, UISkinManifest, TransitionDef } from './UISpecTypes';
import { UIPreviewDiagnostics } from './UIPreviewDiagnostics';
import { UIPreviewStyleBuilder, ButtonVisualState } from './UIPreviewStyleBuilder';
import { UIPreviewShadowManager } from './UIPreviewShadowManager';
import { UIPreviewNodeFactory } from './UIPreviewNodeFactory';

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
    private readonly styleBuilder  = new UIPreviewStyleBuilder(this.skinResolver, this._fontCache);
    private readonly nodeFactory   = new UIPreviewNodeFactory(this.skinResolver, this.styleBuilder);
    private readonly shadowManager = new UIPreviewShadowManager(
        this.skinResolver, this.styleBuilder, () => this.node,
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
        }
        if (i18n)   { this.i18nStrings = i18n; }
        if (tokens) { this.tokens = tokens; this.shadowManager.tokens = tokens; }

        // 每次 buildScreen 前同步 i18nStrings 給 nodeFactory
        this.nodeFactory.i18nStrings = this.i18nStrings;

        const designWidth  = layout.canvas.designWidth  ?? 1920;
        const designHeight = layout.canvas.designHeight ?? 1080;

        let rootNode: Node;
        try {
            rootNode = await this._buildNode(layout.root, this.node, designWidth, designHeight);
        } catch (e) {
            UIPreviewDiagnostics.buildScreenError(layout.id ?? '?', e as Error);
            throw e;
        }

        this.onBuildComplete(rootNode);
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
     */
    protected onBuildComplete(_rootNode: Node): void { /* 子類覆寫 */ }

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
        const content = listNode.getChildByName('Content');
        if (!content) {
            UIPreviewDiagnostics.populateListContentNotFound(listPath, listNode.children.map(c => c.name));
            return;
        }

        UIPreviewDiagnostics.populateListStart(listPath, data.length);
        const contentT = content.getComponent(UITransform);
        const parentW  = contentT?.width  ?? 800;
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

    private async _buildNode(
        spec: UILayoutNodeSpec,
        parent: Node,
        parentWidth: number,
        parentHeight: number,
    ): Promise<Node> {
        const node   = new Node(spec.name);
        node.layer   = parent.layer;  // 繼承 UI_2D layer，確保 2D 攝影機下可見
        node.parent  = parent;

        if (spec.active === false) node.active = false;

        // UITransform（Unity 對照：RectTransform）
        const transform = node.addComponent(UITransform);
        const w = resolveSize(spec.width,  parentWidth);
        const h = resolveSize(spec.height, parentHeight);
        transform.setContentSize(w, h);

        // Widget 對齊（Unity 對照：RectTransform anchor / stretch）
        if (spec.widget) this.styleBuilder.applyWidget(node, spec.widget);

        // Layout（Unity 對照：LayoutGroup 系列元件）
        this.nodeFactory.setupLayout(node, spec);

        // 依類型建立元件（委派給 UIPreviewNodeFactory）
        switch (spec.type) {
            case 'container':
                if (spec.skinSlot) await this.styleBuilder.applyBackgroundSkin(node, spec.skinSlot);
                break;
            case 'panel':           await this.nodeFactory.buildPanel(node, spec);        break;
            case 'label':           await this.nodeFactory.buildLabel(node, spec);        break;
            case 'button':          await this.nodeFactory.buildButton(node, spec);       break;
            case 'scroll-list':     await this.nodeFactory.buildScrollList(node, spec, w, h); break;
            case 'image':           await this.nodeFactory.buildImage(node, spec);        break;
            case 'resource-counter': await this.nodeFactory.buildLabel(node, spec);       break;
            case 'spacer': break;  // 空白佔位，無需掛載元件
        }

        // 附加 shadow / noise 層（委派給 UIPreviewShadowManager）
        await this.shadowManager.attachShadowLayer(node, spec, parent, w, h);
        await this.shadowManager.attachNoiseLayer(node, spec, parent, w, h);

        // 遞迴建立子節點
        if (spec.children) {
            for (const child of spec.children) {
                await this._buildNode(child, node, w, h);
            }
        }

        return node;
    }

    // ─── 私有工具 ─────────────────────────────────────────────────────────────

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
}