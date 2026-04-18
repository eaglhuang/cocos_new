// @spec-source → 見 docs/cross-reference-index.md
/**
 * UISpecTypes — UI 三層資料契約的 TypeScript 型別定義
 *
 * 三層架構：
 *   1. Layout Spec  — 結構、版位、Widget、Layout 規則
 *   2. Skin Manifest — SpriteFrame、九宮格、字型、顏色、狀態圖
 *   3. Screen Spec   — 組裝單一畫面（layout + skin + bundle + 驗證）
 *
 * Unity 對照：
 *   - Layout Spec  ≈ Prefab 結構描述 + Layout 規則
 *   - Skin Manifest ≈ Theme ScriptableObject + Sprite Atlas Mapping
 *   - Screen Spec   ≈ 畫面裝配設定
 *
 * 設計基準：1920×1024（16:9 橫屏），搭配 Widget 自適應
 */

// ═══════════════════════════════════════════════════════════════
// 1. Layout Spec 型別
// ═══════════════════════════════════════════════════════════════

/** Canvas 設定 */
export interface CanvasDef {
    fitWidth: boolean;
    fitHeight: boolean;
    /** 是否啟用安全區域 (SafeArea) */
    safeArea?: boolean;
    /** 設計基準寬度（預設 1920） */
    designWidth?: number;
    /** 設計基準高度（預設 1024） */
    designHeight?: number;
    /**
     * R29: 單邊 Widget 錨點的寬螢幕安全模式。
     * 設為 true 時，CompositePanel.mount() 會在 buildScreen 後：
     * 1. 將宿主節點 UITransform 鎖定為 designWidth × designHeight
     * 2. 重新執行 Widget 計算
     * 3. 將所有子 Widget 設為 AlignMode.ONCE（不再 ALWAYS 重算）
     * 避免 FIXED_HEIGHT 策略下 Canvas 比設計寬導致 left=0 / right=X 把節點推到螢幕外。
     */
    safeAreaConstrained?: boolean;
}

/** Widget 自適應定義 */
export interface WidgetDef {
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
    /** 水平置中。true = 偏移 0；number = 帶偏移（正值向右） */
    hCenter?: boolean | number;
    /** 垂直置中。true = 偏移 0；number = 帶偏移（正值向上） */
    vCenter?: boolean | number;
}

/** Layout 佈局定義 */
export interface LayoutDef {
    type: 'horizontal' | 'vertical' | 'grid';
    spacing?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    /**
     * 子節點尺寸策略（Cocos Layout.ResizeMode）：
     *   - 'none'：Layout 僅排位，不調整子節點尺寸（預設）
     *   - 'container'：容器自動調整大小以容納所有子節點
     *   - 'children'：子節點自動調整大小以填滿容器
     * Unity 對照：ContentSizeFitter / LayoutGroup.childForceExpand
     */
    resizeMode?: 'none' | 'container' | 'children';
}

/** 過渡動畫定義（保留參數，UIPreviewBuilder 提供預設值） */
export interface TransitionDef {
    /** 進場動畫類型 */
    enter?: 'fadeIn' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown' | 'scaleIn' | 'none';
    /** 退場動畫類型 */
    exit?: 'fadeOut' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown' | 'scaleOut' | 'none';
    /** 動畫時長（秒），預設 0.2 */
    duration?: number;
    /** 動畫緩動函數，預設 'easeInOut' */
    easing?: string;
}

// ═══════════════════════════════════════════════════════════════
// 1a. UCUF Skin Layer 型別（M1 Foundation）
// ═══════════════════════════════════════════════════════════════

/**
 * SkinLayerDef — 節點級皮膚圖層定義（UCUF M1）。
 *
 * 允許任意節點疊加多層 skin sprite（例如底圖 + 紋理 + 裝飾邊框），
 * 取代 UIPreviewShadowManager 的散落式 shadow/noise 處理。
 * 圖層依 zOrder 由低到高堆疊。
 *
 * Unity 對照：SortingLayer 內的多層 SpriteRenderer
 */
export interface SkinLayerDef {
    /** 圖層唯一 ID（同一節點內不可重複） */
    layerId: string;
    /** 引用 skin manifest 的 slot id */
    slotId: string;
    /** 堆疊順序（越小越底層） */
    zOrder: number;
    /** true = 此圖層自動展開填滿父節點尺寸（預設 true） */
    expand?: boolean;
    /** 混合模式 */
    blendMode?: 'alpha' | 'overlay' | 'multiply';
    /** 圖層不透明度 0~1 */
    opacity?: number;
}

/**
 * CompositeImageLayerDef — composite-image 節點的圖層定義（UCUF M1）。
 *
 * composite-image 是一個純視覺節點，由多張 sprite 按 zOrder 堆疊組成。
 * 適用於 Footer、BloodlineCrest 等原本需要多節點疊加的場景。
 *
 * Unity 對照：具有多個 SpriteRenderer 子物件的空容器
 */
export interface CompositeImageLayerDef {
    /** 引用 skin manifest 的 sprite slot id */
    spriteSlotId: string;
    /** 堆疊順序（越小越底層） */
    zOrder: number;
    /** 圖層不透明度 0~1（預設 1） */
    opacity?: number;
    /** 色調 hex（可選，疊加在 sprite 上方） */
    tint?: string;
}

/** 節點型別聯合 */
export type UINodeType =
    | 'container'       // 純容器（無視覺）
    | 'panel'           // 面板（有背景）
    | 'label'           // 文字標籤
    | 'button'          // 按鈕
    | 'button-group'    // 按鈕群組
    | 'scroll-list'     // 可捲動列表
    | 'scroll-view'     // scroll-list 舊別名（向後相容 battle-log-main 等既有 JSON）
    | 'image'           // 靜態圖片
    | 'resource-counter' // 資源計數器（圖示+數字）
    | 'spacer'          // 佔位空間
    | 'composite-image'; // UCUF 複合圖層（多 sprite 堆疊）

/** 按鈕群組項目定義 */
export interface ButtonGroupItem {
    id: string;
    skinSlot: string;
    textKey?: string;
    onClick?: string;
}

/** 單一節點定義（遞迴結構） */
export interface UILayoutNodeSpec {
    /** 節點類型 */
    type: UINodeType;
    /** 節點名稱（Cocos Node.name） */
    name: string;

    // ── 尺寸 ──
    /** 寬度：固定像素(number) 或 百分比(string, 如 "30%") */
    width?: number | string;
    /** 高度：固定像素(number) 或 百分比(string) */
    height?: number | string;

    // ── 定位 ──
    /** Widget 自適應（保留在 JSON，UIPreviewBuilder 提供預設值） */
    widget?: WidgetDef;
    /** 佈局（作為容器時） */
    layout?: LayoutDef;

    // ── 皮膚插槽 ──
    /** 背景/圖片的 skin slot 名稱 */
    skinSlot?: string;
    /** 文字樣式的 skin slot 名稱 */
    styleSlot?: string;
    /** 圖示的 skin slot 名稱 */
    iconSlot?: string;

    // ── 內容 ──
    /** 直接文字（不走 i18n，用於固定標籤如「戰鬥日誌」） */
    text?: string;
    /** i18n 文字鍵值 */
    textKey?: string;
    /** 資料綁定欄位名（列表項目） */
    bind?: string;
    /** 按鈕點擊回呼方法名 */
    onClick?: string;
    /** 節點初始 active 狀態（預設 true；false = 隱藏，由 TS 控制顯示）*/
    active?: boolean;
    /** 節點識別 ID（文件用途；不被 UIPreviewBuilder 解析） */
    id?: string;
    /** 按鈕/圖片是否可互動（Button.interactable） */
    interactable?: boolean;

    // ── 動畫 ──
    /** 過渡動畫（保留在 JSON，UIPreviewBuilder 提供預設） */
    transition?: TransitionDef;

    // ── UCUF 圖層 ──
    /** 皮膚圖層堆疊（UCUF M1）：疊加多層 skin sprite 於此節點 */
    skinLayers?: SkinLayerDef[];
    /** composite-image 的圖層定義（type='composite-image' 時使用） */
    compositeImageLayers?: CompositeImageLayerDef[];

    // ── UCUF CompositePanel（M2）──
    /**
     * 延遲載入插槽（UCUF M2）。
     * buildScreen 遇到 lazySlot=true 時建立空容器，不展開 children / $ref。
     * 需與 CompositePanel.switchSlot() 配合使用。
     */
    lazySlot?: boolean;
    /**
     * lazySlot 的預設 fragment（UCUF M2）。
     * mount() 後自動呼叫 switchSlot(slotId, defaultFragment)。
     * 格式：'fragments/layouts/tab-basics'
     */
    defaultFragment?: string;
    /**
     * 此 lazySlot 預期掛載的 ChildPanel 類型（UCUF M2）。
     * 用於 CompositePanel 自動實例化對應的 ChildPanelBase 子類。
     */
    childType?: string;

    // ── UCUF ChildPanel 家族（M3）──
    /**
     * Grid 格子欄數（GridPanel 使用）。
     * 搭配 layout.type='grid' 使用；未設定時 GridPanel 回退為 1。
     */
    gridColumns?: number;
    /**
     * Grid cell 的 fragment ref（GridPanel 使用）。
     * 格式同 defaultFragment：'fragments/layouts/item-cell'
     */
    cellFragmentRef?: string;
    /**
     * ScrollList item 的 fragment ref（ScrollListPanel + IScrollVirtualizer 使用）。
     * 格式：'fragments/layouts/list-item-row'
     */
    itemFragmentRef?: string;
    /**
     * ScrollList 每個 item 的固定高度（像素）。
     * IScrollVirtualizer 用於計算 Content 總高度與 pool 大小。
     */
    itemHeight?: number;
    /**
     * ScrollList 可視區域外的緩衝 item 數（預設 2）。
     * pool size = visibleCount + bufferCount × 2
     */
    bufferCount?: number;

    // ── 子節點 ──
    /** 子節點 */
    children?: UILayoutNodeSpec[];
    /** 引用佈局碎片（可選）。
     *  格式: "fragments/layouts/item-cell"
     *  載入時會以此碎片內容替換當前節點或作為其基礎。
     */
    $ref?: string;
    /** 列表項目模板（type=scroll-list 時使用） */
    itemTemplate?: UILayoutNodeSpec;
    /** 按鈕群組項目（type=button-group 時使用） */
    items?: ButtonGroupItem[];
}

/** 完整的 Layout Spec */
export interface UILayoutSpec {
    id: string;
    version: number;
    /** 規格引擎版本（M9），用於 specVersion forward-compat guard */
    specVersion?: number;
    canvas: CanvasDef;
    root: UILayoutNodeSpec;
}

// ═══════════════════════════════════════════════════════════════
// 2. Skin Manifest 型別
// ═══════════════════════════════════════════════════════════════

/** Sprite 圖塊 slot */
export interface SkinSpriteSlot {
    kind: 'sprite-frame';
    /** Bundle 內的 SpriteFrame 路徑 */
    path: string;
    /** 圖片模式 */
    spriteType: 'simple' | 'sliced' | 'tiled';
    /** 九宮格邊距 [上, 右, 下, 左]（像素，必須為整數） */
    border?: [number, number, number, number];
    /** 邊緣溢血像素（合圖安全邊距） */
    bleed?: number;
    /** 是否允許加入 Auto Atlas */
    allowAutoAtlas?: boolean;
    /** 額外裝飾層透明度，可用 0~1 或 0~255 表示 */
    opacity?: number;
    /**
     * 額外裝飾層混合模式。
     * 目前 UIPreviewBuilder 安全支援 alpha 疊圖；overlay 先以 alpha 近似，
     * multiply 預留給後續材質/著色器升級。
     */
    blendMode?: 'alpha' | 'overlay' | 'multiply';
}

/** 按鈕皮膚 slot（含狀態圖） */
export interface SkinButtonSlot {
    kind: 'button-skin';
    normal: string;
    pressed?: string;
    hover?: string;
    disabled?: string;
    selected?: string;
    spriteType: 'simple' | 'sliced';
    /** 九宮格邊距（所有狀態圖必須一致） */
    border?: [number, number, number, number];
    allowAutoAtlas?: boolean;
}

/** 文字樣式 slot */
export interface SkinLabelSlot {
    kind: 'label-style';
    /** 可選：引用 ui-design-tokens.typography 內的預設樣式 */
    style?: string;
    /** 字型資源路徑（Bundle 內，如 'fonts/notosans_tc/font'） */
    font?: string;
    fontSize?: number;
    lineHeight?: number;
    /** 文字顏色（hex） */
    color: string;
    /** 是否粗體 */
    isBold?: boolean;
    /** 水平對齊 */
    horizontalAlign?: 'LEFT' | 'CENTER' | 'RIGHT';
    /** 垂直對齊 */
    verticalAlign?: 'TOP' | 'CENTER' | 'BOTTOM';
    /** 溢出處理 */
    overflow?: 'NONE' | 'CLAMP' | 'SHRINK' | 'RESIZE_HEIGHT';
    /** 描邊顏色 */
    outlineColor?: string;
    /** 描邊寬度 */
    outlineWidth?: number;
}

/** 純色區塊 slot */
export interface SkinColorRectSlot {
    kind: 'color-rect';
    color: string;
}

/** Skin Slot 聯合型別 */
export type SkinSlot = SkinSpriteSlot | SkinButtonSlot | SkinLabelSlot | SkinColorRectSlot;

/** 皮膚碎片 (Skin Fragment)
 *  可被多個 Skin Manifest 引用，用於標準化 item-cell 或 parchment 樣式。
 */
export interface UISkinFragment {
    id: string;
    /** 片段內的 slot 鍵值對映 */
    slots: Record<string, SkinSlot>;
}

/** 完整的 Skin Manifest */
export interface UISkinManifest {
    id: string;
    version: number;
    /** 所屬 Bundle 名稱 */
    bundle: string;
    /** Auto Atlas 分組策略名稱 */
    atlasPolicy: string;
    /** 所有 slot 的鍵值對映 */
    slots: Record<string, SkinSlot>;
    /** 引用碎片（可選）。載入時會自動併入 slots。
     *  格式: [fragmentId1, fragmentId2]
     */
    $fragments?: string[];
    /**
     * 此 manifest 所屬的框體 recipe 引用（Phase G 新增）。
     * skin 層宣告後，screen 可在 recipeRef.slotOverrides 進一步覆寫。
     * Unity 對照：Material 指派給一組 Renderer
     */
    recipeRef?: RecipeRef;
    /**
     * Layered theme stack 設定（UI-2-0085 預留）。
     * 未設定時走現有 flat merge。
     * base → family → stateOverrides → screen 四層優先序。
     */
    themeStack?: {
        /** 全域 base skin id */
        base?: string;
        /** family-level skin id（e.g. "skin-family-dark-metal"） */
        family?: string;
        /** state override skin id 清單（由低到高優先權） */
        stateOverrides?: string[];
    };
}

// ═══════════════════════════════════════════════════════════════
// 3. Screen Spec 型別
// ═══════════════════════════════════════════════════════════════

/** Tab 路由條目（UCUF M2）。由 CompositePanel.switchSlot() 使用 */
export type TabRoute = { slotId: string; fragment: string; transition?: TransitionDef };

/** 設備驗證配置 */
export interface ValidationDef {
    /** 要驗證的設備比例 */
    devices?: string[];
    /** 是否允許缺少 skin（退回白模） */
    allowMissingSkin?: boolean;
}

/**
 * Content Contract 引用定義
 *
 * 宣告此 Screen Spec 所屬 template family 對應的內容契約。
 * 讓 AI Agent 能驗證生成的 screen config 是否符合 family 需求。
 *
 * Unity 對照：相當於 Prefab 的必填 SerializedField 清單宣告。
 */
export interface ContentContractRef {
    /** 對應 assets/resources/ui-spec/contracts/{schemaId}.schema.json */
    schemaId: string;
    /** 所屬 template family id（kebab-case） */
    familyId: string;
    /** 最少必填欄位清單；validate-ui-specs --check-content-contract 會驗此清單 */
    requiredFields: string[];
}

/** 完整的 Screen Spec */
export interface UIScreenSpec {
    id: string;
    version: number;
    /** UI 識別碼（對應 UIManager 的 UIID） */
    uiId: string;
    /** UI 層級 */
    layer: string;
    /** 所屬 Bundle */
    bundle: string;
    /** 引用的 Layout Spec ID */
    layout: string;
    /** 引用的 Skin Manifest ID */
    skin: string;
    /** 預覽場景路徑（可選） */
    previewScene?: string;
    /** Prefab 輸出路徑（可選） */
    prefabOutput?: string;
    /** 驗證規則 */
    validation?: ValidationDef;
    /**
     * Content Contract 引用（Phase F 新增）
     * 宣告此畫面對應的內容契約，供 UIContentBinder 與驗證工具使用。
     * 若 family 已有 schema，此欄位為必填。
     */
    contentRequirements?: ContentContractRef;
    /**
     * 此畫面引用的框體 recipe（Phase G 新增，UI-2-0084）。
     * screen 層擁有最高優先，可覆寫 skin manifest 的 recipeRef.slotOverrides。
     * Unity 對照：Renderer 上 Material 的 per-instance override。
     */
    recipeRef?: RecipeRef;
    /**
     * Tab 路由表（UCUF M2）。
     * key = Tab 識別碼（如 'Basics'）；value = 對應的 lazySlot + fragment。
     * 切換 Tab 時由 CompositePanel 查詢此表呼叫 switchSlot()。
     *
     * 範例：
     * ```json
     * {
     *   "Basics":    { "slotId": "TabContentSlot", "fragment": "fragments/layouts/tab-basics" },
     *   "Stats":     { "slotId": "TabContentSlot", "fragment": "fragments/layouts/tab-stats" }
     * }
     * ```
     */
    tabRouting?: Record<string, TabRoute>;
    /** 規格引擎版本（M9），用於 specVersion forward-compat guard */
    specVersion?: number;
}

// ═══════════════════════════════════════════════════════════════
// 4. 工具函數
// ═══════════════════════════════════════════════════════════════

/** 預設 Canvas 設定 */
export const DEFAULT_CANVAS: CanvasDef = {
    fitWidth: true,
    fitHeight: true,
    safeArea: true,
    designWidth: 1920,
    designHeight: 1024,
};

/**
 * 當前規格引擎版本（M9）。
 * UISpecLoader 載入 JSON 若 specVersion > 此值時，發出 warn 並執行 graceful degradation。
 */
export const CURRENT_SPEC_VERSION = 1;

/** 預設過渡動畫 */
export const DEFAULT_TRANSITION: Required<TransitionDef> = {
    enter: 'fadeIn',
    exit: 'fadeOut',
    duration: 0.2,
    easing: 'easeInOut',
};

/**
 * 解析百分比或像素值為實際像素
 * @param value 寬度/高度值（數字=像素、字串=百分比如 "30%"）
 * @param parentSize 父容器的對應維度像素值
 * @returns 實際像素值
 */
export function resolveSize(value: number | string | undefined, parentSize: number): number {
    if (value === undefined) return parentSize;
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.endsWith('%')) {
        const pct = parseFloat(value) / 100;
        return Math.floor(parentSize * pct);
    }
    return parentSize;
}

// ═══════════════════════════════════════════════════════════════
// 5. Template 型別（UI Template + Composable Widget 架構）
// ═══════════════════════════════════════════════════════════════

/**
 * Widget Fragment 組件定義
 *
 * 最小可重用的 UI 視覺組件（如：關閉鈕、按鈕組、血量條）。
 * 存放於 assets/resources/ui-spec/fragments/widgets/{widgetId}.json
 *
 * Unity 對照：可重用的 Prefab 碎片
 */
export interface UIWidgetFragmentSpec {
    /** Widget 唯一 ID */
    id: string;
    /** 描述 */
    description?: string;
    /** Widget 分類 */
    category?: 'control' | 'display' | 'container' | 'feedback';
    /** 參數定義 — 可在 Template compose 時覆蓋 */
    params?: Record<string, UITemplateParamDef>;
    /** Widget 的佈局結構（與 UILayoutNodeSpec 相同格式） */
    layout: UILayoutNodeSpec;
    /** 預設 skin slots（可選，合併至 Template 的 skin） */
    defaultSkinSlots?: Record<string, SkinSlot>;
}

/** Template 參數定義 */
export interface UITemplateParamDef {
    type: 'string' | 'number' | 'boolean' | 'i18n-key' | 'button-group' | 'enum';
    required?: boolean;
    default?: string | number | boolean;
    /** enum type 時的可選值 */
    variants?: string[];
}

/** Template compose 項目：引用一個 Widget 並傳入參數 */
export interface UITemplateComposeItem {
    /** 引用的 Widget ID */
    widget: string;
    /** 傳入的參數值（可引用 Template param 如 "${title}"） */
    params?: Record<string, string | number | boolean>;
    /** 條件顯示（引用 Template param，值為 falsy 時不渲染此 widget） */
    condition?: string;
    /** 子 Widget 組合（遞迴結構，用於容器類 Widget） */
    children?: UITemplateComposeItem[];
}

/**
 * UI Template 定義
 *
 * 定義一個可重用的畫面骨架，由多個 Widget 組合而成。
 * 開發者選擇 Template + 傳入參數，即可產生完整的 Layout JSON。
 *
 * 存放於 assets/resources/ui-spec/templates/{templateId}.json
 *
 * Unity 對照：Prefab Variant 的結構定義
 */
export interface UITemplateSpec {
    /** Template 唯一 ID */
    id: string;
    version: number;
    /** 描述 */
    description?: string;
    /** 分類 */
    category?: 'popup' | 'hud' | 'sidebar' | 'page' | 'toast';
    /** 參數 Schema */
    params?: Record<string, UITemplateParamDef>;
    /** 骨架：引用 Widget Fragments 組合 */
    compose: UITemplateComposeItem[];
    /** 預設 canvas 設定（可選，預設使用 DEFAULT_CANVAS） */
    canvas?: CanvasDef;
    /** 預設 skin ID（可選） */
    defaultSkin?: string;
}

// ═══════════════════════════════════════════════════════════════
// 6. Phase G — Recipe 型別（UI-2-0084 / UI-2-0089）
//
// FrameRecipe / MaterialRecipe 是高品質 UI 的視覺語法契約層。
// ArtRecipe 是 AI 生成資產的治理追蹤記錄（UI-2-0089）。
//
// 對應 JSON Schema: assets/resources/ui-spec/recipes/frame-recipe.schema.json
//                   assets/resources/ui-spec/recipes/material-recipe.schema.json
// ArtRecipe 檔案路徑:  artifacts/ui-source/ai-recipes/<id>.art-recipe.json
//
// Unity 對照：
//   FrameRecipe    ≈ Shader / Material 的視覺語意標籤（非 runtime shader，而是設計契約）
//   MaterialRecipe ≈ Material asset 的貼圖與混合參數描述
//   ArtRecipe      ≈ Asset Importer 的 metadata + 來源追蹤（Source Control + GUID lineage）
// ═══════════════════════════════════════════════════════════════

/**
 * ArtRecipe — AI 生成 UI 資產的治理追蹤記錄（UI-2-0089）。
 *
 * 每張 AI 生成或 AI 輔助生成的資產都必須對應一份 ArtRecipe。
 * 目的：確保可維護性、風格可追溯、審核狀態清晰、衍生版本成鏈。
 *
 * 存放位置：artifacts/ui-source/ai-recipes/<id>.art-recipe.json
 *
 * Unity 對照：
 *   類比 Unity 的 AssetImporter + Meta file + 手工 changelog，
 *   但把「prompt / seed / post-process」資訊結構化。
 *
 * 可 AI 生成的資產類型（approvalStatus 可為 approved）：
 *   - decorative-frame: 裝飾框體（玉、金、羊皮紙）
 *   - background: 背景底圖（戰場、大廳）
 *   - ornament: 紋樣、描邊花紋
 *   - badge: 品質/稀有度徽章
 *   - crest-medallion: 命紋徽章環框
 *   - story-strip-art: 故事條插圖
 *
 * 禁止直接 AI 上線（需後製或人工審核）：
 *   - character-portrait: 武將立繪（必須人工繪製或嚴格 style transfer）
 *   - unit-icon: 單位頭像（要求一致風格，AI 個差異大）
 *   - game-mechanic-icon: 遊戲機制圖示（清晰度/讀性優先，AI 難以穩定輸出）
 */
export interface ArtRecipe {
    /** 唯一識別碼，格式：{family}-r{revision}，例如 crest-medallion-final-r1 */
    id: string;
    version: number;
    /** 所屬 family，對應 MaterialRecipe 或 skin fragment 的 family 名稱 */
    family: string;
    /** 目標畫面 scene/screen id */
    screenId?: string;
    /** 目標皮膚 slot，對應 skin manifest 的 slot key */
    targetSlot?: string;
    /** 輸出的正式資產路徑（bundle 相對路徑或 db:// 路徑） */
    outputAssetPath: string;
    /** 生成工具/方式：'DALL-E 3' | 'Stable Diffusion' | 'Midjourney' | 'Agent1 final art production' 等 */
    tool: string;
    /** 美術方向參考文件路徑 */
    assetDirectionRef?: string;
    /** 正向提示詞（AI 生成時必填） */
    prompt: string;
    /** 負面提示詞 */
    negativePrompt?: string;
    /** 生成 seed（可重現性用，未記錄時為 null） */
    seed?: number | null;
    /** 後製步驟說明陣列（切片/調色/人工修飾等） */
    postProcess?: string[];
    /** 審核狀態 */
    approvalStatus: 'pending' | 'approved' | 'rejected';
    /** 審核者 */
    approvedBy?: string | null;
    /** 審核時間（ISO 8601） */
    approvedAt?: string | null;
    /** 所基於的父版 ArtRecipe id（衍生版本用） */
    basedOn?: string | null;
    /** 衍生 ArtRecipe id 清單（或衍生資產路徑），形成版本鍊 */
    lineage?: string[];
    notes?: string;
}

/**
 * 七大框體家族標識。
 * - dark-metal: 深色金屬，主戰場/主容器
 * - parchment: 羊皮紙，文字/說明性容器
 * - gold-cta: 金色確認按鈕
 * - destructive: 破壞性操作按鈕
 * - tab: 頁籤選擇器
 * - semi-transparent-overlay: 半透明遮罩層
 * - item-cell: 物品格/卡片單元
 */
export type FrameFamily =
    | 'dark-metal'
    | 'parchment'
    | 'gold-cta'
    | 'destructive'
    | 'tab'
    | 'semi-transparent-overlay'
    | 'item-cell';

/**
 * 單一視覺層定義（frame / bleed / fill / ornament 共用）。
 * slot 引用 skin manifest 中的 slot id；path 直接指定貼圖路徑（優先於 slot）。
 */
export interface FrameLayer {
    /** 引用 skin manifest 中的 slot id */
    slot?: string;
    /** 直接指定貼圖路徑，優先於 slot（bundle 相對路徑） */
    path?: string;
    spriteType?: 'simple' | 'sliced' | 'tiled';
    /** 九宮格邊距 [top, right, bottom, left]（像素） */
    border?: [number, number, number, number];
    /** 向外溢血像素 */
    bleed?: number;
    /** 不透明度 0~1 */
    opacity?: number;
    blendMode?: 'alpha' | 'overlay' | 'multiply';
    /** true = 此層缺席不算 QA 失敗 */
    optional?: boolean;
}

/**
 * 陰影層設定。
 * 支援兩種模式：
 *   1. 指定 slot — 使用陰影貼圖（更精準，美術可控）
 *   2. 指定 offset/blur/spread/color — 語意式陰影（供 validator 檢查與 compare board 標記）
 */
export interface ShadowConfig {
    /** 陰影貼圖 slot id（若使用圖片陰影） */
    slot?: string;
    offsetX?: number;
    offsetY?: number;
    /** 模糊半徑（像素） */
    blur?: number;
    /** 擴張半徑（像素） */
    spread?: number;
    /** 陰影顏色，hex 或 token key */
    color?: string;
    opacity?: number;
}

/**
 * 狀態覆寫項目。
 * 在特定互動狀態（hover / pressed / disabled / selected）下替換某一層的 slot 或 opacity。
 */
export interface StateVariantOverride {
    /** 要覆寫的層名稱 */
    layer: 'frame' | 'bleed' | 'fill' | 'ornament';
    /** 替換的 skin slot id */
    slot: string;
    opacity?: number;
}

/**
 * FrameRecipe — 高品質 UI 框體視覺語法契約。
 *
 * 定義 frame / bleed / shadow / fill / ornament 五層疊層結構，
 * 使 skin / screen 可宣告式引用框體家族，讓 validator 檢查語意一致性，
 * 讓 Agent 可自動推理並回寫設計決策。
 *
 * 檔案位置：assets/resources/ui-spec/recipes/families/{family}.recipe.json
 *
 * Unity 對照：比 Material asset 更高層的「視覺風格契約」，
 *   相當於把 URP Shader + 一組 Material Properties 合成一個具名的設計語意單元。
 */
export interface FrameRecipe {
    /** kebab-case 唯一識別，e.g. "dark-metal-v1" */
    id: string;
    /** 版本號，遞增 */
    version: number;
    /** 所屬框體家族 */
    family: FrameFamily;
    description?: string;
    /** 主框體層（必填） */
    frame: FrameLayer;
    /** 溢血層：框邊向外柔化的羽化貼圖 */
    bleed?: FrameLayer;
    /** 陰影層 */
    shadow?: ShadowConfig;
    /** 底色填充層（frame 下方） */
    fill?: FrameLayer;
    /** 角落/邊緣裝飾層（frame 上方） */
    ornament?: FrameLayer;
    /**
     * 每個互動狀態的局部覆寫。
     * key = 'normal' | 'hover' | 'pressed' | 'disabled' | 'selected'
     */
    stateVariants?: Record<string, StateVariantOverride[]>;
    /** 圓角像素（0 = 直角） */
    cornerRadius?: number;
    /** 邊框粗細（像素） */
    borderWeight?: number;
    /** bleed 擴張像素（0 = 無溢血） */
    bleedIntensity?: number;
    /** 關聯的 MaterialRecipe id（可選） */
    materialId?: string;
}

/**
 * MaterialRecipe — UI 材質/紋理風格契約。
 *
 * 描述底層貼圖、紙紋雜訊、金屬感、透明度與混合模式，
 * 供 FrameRecipe 引用，也可被 skin/screen 直接引用。
 *
 * 檔案位置：assets/resources/ui-spec/recipes/materials/{id}.material.json
 *
 * Unity 對照：Material asset（TextureSlot + 混合參數）的資料描述層。
 */
export interface MaterialRecipe {
    id: string;
    version: number;
    description?: string;
    /** 底層貼圖路徑（bundle 相對路徑） */
    baseTexturePath?: string;
    /** 底色，hex 或 token key，疊在 baseTexture 上方 */
    baseColor?: string;
    /** 紙紋/雜訊強度 0~1 */
    grainIntensity?: number;
    /** 雜訊/紙紋貼圖路徑 */
    grainTexturePath?: string;
    opacity?: number;
    blendMode?: 'alpha' | 'overlay' | 'multiply';
    /** 金屬感強度 0~1，0 = 無金屬感 */
    metallicIntensity?: number;
    /** true = 由 AI 生成，需有 artRecipeRef 追溯（UI-2-0089） */
    aiGenerated?: boolean;
    /** 關聯的 ArtRecipe id（UI-2-0089 使用） */
    artRecipeRef?: string;
}

/**
 * RecipeRef — skin manifest 或 screen spec 引用 recipe 的方式。
 * 讓單一畫面可宣告「我用 dark-metal 框體」而不需重複定義五層 slot。
 *
 * Unity 對照：Prefab 上的 [RequireComponent] 或 StyleSheet reference。
 */
export interface RecipeRef {
    /** 引用的 FrameRecipe id */
    frameRecipeId: string;
    /**
     * 局部 slot 覆寫（screen-level 最高優先）。
     * key = slot id, value = 覆寫的 FrameLayer 屬性（partial）
     */
    slotOverrides?: Record<string, Partial<FrameLayer>>;
}
