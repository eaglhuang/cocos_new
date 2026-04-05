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
}

/** Widget 自適應定義 */
export interface WidgetDef {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
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
    | 'spacer';         // 佔位空間

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
}

// ═══════════════════════════════════════════════════════════════
// 3. Screen Spec 型別
// ═══════════════════════════════════════════════════════════════

/** 設備驗證配置 */
export interface ValidationDef {
    /** 要驗證的設備比例 */
    devices?: string[];
    /** 是否允許缺少 skin（退回白模） */
    allowMissingSkin?: boolean;
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
