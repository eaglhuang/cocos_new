<!-- doc_id: doc_ui_0052 -->
# Universal Composite UI Framework (UCUF) — 規劃書

> ⚠️ **已拆分**：本文件已拆分為以下三份文件，後續維護以拆分後版本為準：
> - [UCUF技術文件.md](UCUF技術文件.md) (doc_tech_0017) — 框架原理、架構設計與子系統
> - [UCUF規範文件.md](UCUF規範文件.md) (doc_ui_0026) — 協作規則、禁止事項與標準流程
> - [UCUF里程碑文件.md](UCUF里程碑文件.md) (doc_ui_0025) — 可執行里程碑計畫與驗收規則

> 版本：v1.3 | 日期：2026-04-12 | 狀態：Draft（已拆分）

## 目錄

1. [動機與現狀問題](#1-動機與現狀問題)
2. [核心架構設計](#2-核心架構設計)
3. [Composite Panel 容器](#3-composite-panel-容器)
4. [Child Panel 體系](#4-child-panel-體系)
5. [Skin Layer Stack — 消除物理性節點疊加](#5-skin-layer-stack--消除物理性節點疊加)
6. [UIManager 統一管理與層級規則](#6-uimanager-統一管理與層級規則)
7. [跨引擎遷移性設計](#7-跨引擎遷移性設計)
8. [GeneralDetailOverview 遷移路徑](#8-generaldetailoverview-遷移路徑)
9. [Layout JSON Spec v2 規範](#9-layout-json-spec-v2-規範)
10. [驗證工具與 Lint 規則](#10-驗證工具與-lint-規則)
11. [舊代碼淘汰策略](#11-舊代碼淘汰策略)
12. [美術資源總註冊表](#12-美術資源總註冊表)
13. [全域除錯日誌系統](#13-全域除錯日誌系統)
14. [架構自我診斷與校驗](#14-架構自我診斷與校驗)
15. [自動化測試框架](#15-自動化測試框架)
16. [記憶體管理與資源卸載機制](#16-記憶體管理與資源卸載機制)
17. [全動態資料綁定與衝突偵測](#17-全動態資料綁定與衝突偵測)
18. [多國語系統籌管理](#18-多國語系統籌管理)
19. [效能深度優化](#19-效能深度優化)
20. [補充建議：架構治理與長期演進](#20-補充建議架構治理與長期演進)
21. [新 UI 開發標準化流程](#21-新-ui-開發標準化流程)
22. [Agent 規則自動遵循機制](#22-agent-規則自動遵循機制)
23. [多 Agent 並行開發衝突防範](#23-多-agent-並行開發衝突防範)
24. [動態規則注入與回饋閉環](#24-動態規則注入與回饋閉環)
25. [實施里程碑](#25-實施里程碑)

---

## 1. 動機與現狀問題

### 1.1 節點過度堆疊

目前的 Layout JSON 使用「多個同位置兄弟節點」模擬多層視覺效果：

```
FooterPanelFill   ← widget: { left:24, right:24, bottom:24 }, skinSlot: detail.footer.fill
FooterPanelBleed  ← widget: { left:24, right:24, bottom:24 }, skinSlot: detail.footer.bleed
FooterPanelFrame  ← widget: { left:24, right:24, bottom:24 }, skinSlot: detail.footer.frame
FooterPanel       ← widget: { left:24, right:24, bottom:24 }, 實際按鈕容器
```

一個邏輯面板佔了 4 個節點。BloodlineCrestCarrier 更是 8 層疊加。

### 1.2 雙 Layout 共存

`GeneralDetailPanel` 同時 `buildScreen` 兩套完整 Layout（Classic + V3 Overview），
切 Tab 時用 `active` 開關切換，但隱藏清單不完整，導致殘留節點互相干擾。

### 1.3 所有 Tab 預建

6 個 Tab 頁面全部在 `buildScreen` 時一次性創建，使用完全相同的 widget 定位疊在同一位置。

### 1.4 缺少標準化的 Child Panel 型態

目前所有面板都是 `panel` + `label` 的手動組合，沒有語義化的 Attribute / Grid / Chart 等高階元件。

---

## 2. 核心架構設計

### 2.1 架構圖

```
┌─────────────────────────────────────────────────────────┐
│                     UIManager (既有)                      │
│    register / open / close / setupLayers                 │
│    LayerType: Game | UI | PopUp | Dialog | System        │
├─────────────────────────────────────────────────────────┤
│                 CompositePanel (新增)                      │
│    接收 Screen JSON → 解析 Layout → 管理 ChildPanel 生命週期│
│    skinLayerStack / fragment lazy-load / tab routing      │
├─────────────────────────────────────────────────────────┤
│              ChildPanelBase (新增抽象基類)                  │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐ │
│  │Attribute │  Grid    │ScrollList│  Radar   │ Editable │ │
│  │ Panel    │  Panel   │ Panel   │HexChart  │TextPanel │ │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘ │
├─────────────────────────────────────────────────────────┤
│          Platform Abstraction Layer (既有+擴充)            │
│    INodeFactory / IStyleApplicator / ILayoutResolver      │
│    + ICompositeRenderer (新增)                            │
├─────────────────────────────────────────────────────────┤
│   Cocos Impl          │        Unity Impl (stub)         │
│   CocosNodeFactory    │        UnityNodeFactory           │
│   CocosCompositeRdr   │        UnityCompositeRdr          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 設計原則

| 原則 | 說明 |
|------|------|
| **1 邏輯面板 = 1 Layout 節點** | 禁止用多個同位置兄弟節點模擬視覺層級 |
| **1 Screen = 1 Layout** | 禁止一個 Panel 同時持有兩套完整 Layout |
| **Tab 延遲載入** | 只有當前激活的 Tab 才建立節點樹 |
| **外觀與邏輯分離** | Skin Layer Stack 處理所有視覺層，業務邏輯零 Cocos API |
| **組件標準化** | 常見 UI 模式以 ChildPanel 子類封裝，JSON 中只需一行宣告 |
| **引擎可替換** | 核心邏輯依賴 Interface，平台實作隔離於 `platform/` 目錄 |

---

## 3. Composite Panel 容器

### 3.1 定義

`CompositePanel` 是 UCUF 的頂層容器元件，取代現有的 `UIPreviewBuilder` 子類
（如 `GeneralDetailPanel`、`GeneralDetailOverviewShell`）成為畫面的唯一持有者。

```typescript
// 虛擬碼 — 不依賴 Cocos API
abstract class CompositePanel {
    // ── 核心職責 ──
    protected screenSpec: UIScreenSpec;
    protected activeLayout: UILayoutSpec;
    protected skinManifest: UISkinManifest;
    protected childPanels: Map<string, ChildPanelBase>;   // slot-id → 子面板

    // ── 生命週期 ──
    async mount(screenId: string): Promise<void>;         // 載入 Screen → Layout → Skin
    async switchSlot(slotId: string, fragmentId: string);  // Tab 延遲載入
    unmount(): void;                                       // 銷毀所有子面板

    // ── 資料驅動 ──
    applyContentState(state: Record<string, unknown>): void; // 資料綁定

### 3.2 與既有 UIPreviewBuilder 的關係

`CompositePanel` **繼承** `UIPreviewBuilder` 而非取代它。
`buildScreen()` 仍然是底層構建引擎，但 `CompositePanel` 在其上方加入：

1. **Skin Layer Stack 解析**（§5）— 在 `_buildNode` 層級攔截 `skinLayers` 屬性
2. **Fragment 延遲載入**（§3.3）— 不在 `buildScreen` 時遞迴所有 children
3. **ChildPanel 自動掛載**（§4）— 依 `childType` 自動實例化對應 ChildPanel 子類

### 3.3 Fragment 延遲載入機制

**現狀**：`buildScreen()` → `_buildNode()` 遞迴展開所有 `children`，包含 `$ref` fragment。

**改進**：新增 `lazySlot` 屬性，標記需要延遲載入的區域。

```json
{
  "type": "container",
  "name": "TabContentSlot",
  "widget": { "top": 28, "bottom": 112, "left": 28, "right": 28 },
  "lazySlot": true,
  "defaultFragment": "fragments/layouts/tab-basics"
}
```

`buildScreen()` 遇到 `lazySlot: true` 時：
- 建立空容器節點（帶正確的 UITransform + Widget）
- **不展開** children / `$ref`
- 記錄到 `CompositePanel._lazySlots` Map 中

`switchSlot(slotId, fragmentId)` 被呼叫時才載入並建構節點。

### 3.4 Tab 路由表

取代現有的 `_activateTab()` 硬編碼切換邏輯：

```json
{
  "tabRouting": {
    "Basics":    { "slotId": "TabContentSlot", "fragment": "fragments/layouts/gdv3-overview" },
    "Stats":     { "slotId": "TabContentSlot", "fragment": "fragments/layouts/tab-stats" },
    "Bloodline": { "slotId": "TabContentSlot", "fragment": "fragments/layouts/tab-bloodline" },
    "Skills":    { "slotId": "TabContentSlot", "fragment": "fragments/layouts/tab-skills" },
    "Aptitude":  { "slotId": "TabContentSlot", "fragment": "fragments/layouts/tab-aptitude" },
    "Extended":  { "slotId": "TabContentSlot", "fragment": "fragments/layouts/tab-extended" }
  }
}
```

切 Tab 時：
1. `destroySlotChildren(slotId)` — 銷毀當前 Tab 的子節點
2. `switchSlot(slotId, newFragmentId)` — 載入新 Fragment 並 `buildNode`
3. `applyContentState(currentData)` — 重新綁定資料

---

## 4. Child Panel 體系

### 4.1 ChildPanelBase 抽象基類

```typescript
abstract class ChildPanelBase {
    // ── 由 CompositePanel 注入 ──
    protected hostNode: NodeHandle;        // 平台無關的節點句柄
    protected skinResolver: UISkinResolver;
    protected binder: UITemplateBinder;

    // ── 生命週期鉤子 ──
    abstract onMount(spec: ChildPanelSpec): Promise<void>;    // 首次建構
    abstract onDataUpdate(data: Record<string, unknown>): void; // 資料更新
    onUnmount(): void { /* 預設: no-op, 子類可覆寫做清理 */ }

    // ── 擴充屬性 ──
    protected customProps: Record<string, unknown> = {};
    setCustomProp(key: string, value: unknown): void {
        this.customProps[key] = value;
        this.onCustomPropChanged(key, value);
    }
    protected onCustomPropChanged(_key: string, _value: unknown): void { /* 子類覆寫 */ }
}
```

### 4.2 Attribute Panel（屬性條目陳列）

用途：武將基本資訊、六維數值等 key-value 列表。

```json
{
  "type": "child-panel",
  "childType": "attribute",
  "name": "BasicInfoPanel",
  "widget": { "top": 28, "bottom": 0, "left": 28, "right": 28 },
  "config": {
    "columns": 1,
    "rowHeight": 32,
    "rowSpacing": 8,
    "labelStyleSlot": "detail.label.meta",
    "valueStyleSlot": "detail.label.value",
    "rowSkinSlot": "detail.field.bg"
  },
  "dataSource": "basicAttributes"
}
```

runtime 資料格式：
```typescript
interface AttributeRow {
    label: string;    // "武力"
    value: string;    // "97"
    icon?: string;    // 可選圖示 skinSlot
    accent?: string;  // 可選強調色 token
}
// dataSource → AttributeRow[]
```

**關鍵改進**：原本的 `TabBasics` 需要在 Layout JSON 中手動定義 12 個 Label 節點。
現在只需一個 `child-panel` 節點 + runtime 資料陣列，節點數從 12 降為 1。

### 4.3 Grid Panel（網格佈局）

用途：技能圖標矩陣、裝備格、道具背包。

```json
{
  "type": "child-panel",
  "childType": "grid",
  "name": "SkillGrid",
  "config": {
    "columns": 4,
    "cellSize": [96, 96],
    "cellSpacing": [12, 12],
    "cellSkinSlot": "detail.section.bg",
    "cellTemplate": "fragments/widgets/skill-cell"
  },
  "dataSource": "skillList"
}
```

`GridPanel` 動態根據 `dataSource` 陣列長度建立格子，每格使用 `cellTemplate` fragment 渲染。

### 4.4 Scroll List Panel（虛擬列表）

用途：戰鬥紀錄、武將列表等大量資料捲動。

```json
{
  "type": "child-panel",
  "childType": "scroll-list",
  "name": "BattleLogList",
  "config": {
    "direction": "vertical",
    "itemHeight": 64,
    "bufferCount": 3,
    "itemTemplate": "fragments/widgets/battle-log-item",
    "emptyHint": "ui.battlelog.empty"
  },
  "dataSource": "battleLogs"
}
```

**虛擬列表核心**：只建構可視區域 + buffer 數量的節點（如可視 8 個 + buffer 3 個 = 11 個），
捲動時回收離開視窗的節點並重新綁定資料，而非建構全部 100+ 項。

### 4.5 Radar / Hex Chart Panel（六角數值圖表）

用途：武將六維能力圖（武/智/統/政/魅/運）。

```json
{
  "type": "child-panel",
  "childType": "radar-chart",
  "name": "StatsRadar",
  "config": {
    "axes": ["str", "int", "lea", "pol", "cha", "luk"],
    "axisLabelStyleSlot": "gdv3.label.dossierSection",
    "maxValue": 100,
    "fillColor": "accentGold",
    "fillAlpha": 0.3,
    "strokeColor": "accentGold",
    "strokeWidth": 2,
    "gridLevels": 4,
    "gridColor": "textMuted",
    "gridAlpha": 0.15
  },
  "dataSource": "coreStats"
}
```

**實作方式**：使用 Cocos `Graphics` 元件（Unity 對照：`LineRenderer` / Custom Mesh UI）
動態繪製正六邊形網格與填充區域。不需要預製多個 Image 節點。

### 4.6 Editable Text Panel（可編輯內文框）

用途：武將備註欄、自訂名稱。

```json
{
  "type": "child-panel",
  "childType": "editable-text",
  "name": "GeneralNotes",
  "config": {
    "maxLength": 200,
    "multiline": true,
    "placeholder": "ui.general.notes.placeholder",
    "inputStyleSlot": "detail.label.value",
    "backgroundSkinSlot": "detail.field.bg",
    "saveTarget": "generalConfig.notes"
  },
  "dataSource": "notesText"
}
```

**回寫邏輯**：`EditableTextPanel` 監聽 `EditBox.textChanged` 事件，
透過 `CompositePanel.emitDataChange(saveTarget, newValue)` 回傳到業務層。
業務層決定是否寫入 `GeneralConfig` 並觸發儲存。

### 4.7 ChildPanel 登記表

類似 `UIConfig` 的資料驅動設計，ChildPanel 型態集中登記：

```typescript
const ChildPanelRegistry: Record<string, typeof ChildPanelBase> = {
    'attribute':     AttributePanel,
    'grid':          GridPanel,
    'scroll-list':   ScrollListPanel,
    'radar-chart':   RadarChartPanel,
    'editable-text': EditableTextPanel,
    // 未來擴充：
    // 'progress-bar':  ProgressBarPanel,
    // 'timeline':      TimelinePanel,
    // 'tree':          TreeViewPanel,
};
```

---

## 5. Skin Layer Stack — 消除物理性節點疊加

### 5.1 問題回顧

目前一個「帶框體的面板」在 Layout JSON 中佔 3~4 個節點：

```
FooterPanelFill   → skinSlot: detail.footer.fill   (底色)
FooterPanelBleed  → skinSlot: detail.footer.bleed  (出血擴散)
FooterPanelFrame  → skinSlot: detail.footer.frame  (邊框)
FooterPanel       → 實際按鈕容器 (內容)
```

### 5.2 解決方案：`skinLayers` 屬性

在 Layout JSON 的 `panel` / `container` 節點新增 `skinLayers` 陣列：

```json
{
  "type": "panel",
  "name": "FooterPanel",
  "widget": { "left": 24, "right": 24, "bottom": 24 },
  "height": 72,
  "skinLayers": [
    { "slot": "detail.footer.fill",  "zOrder": 0 },
    { "slot": "detail.footer.bleed", "zOrder": 1, "expand": 4 },
    { "slot": "detail.footer.frame", "zOrder": 2, "expand": 2 }
  ],
  "layout": { "type": "horizontal", "spacing": 10 },
  "children": [
    { "type": "button", "name": "BtnFavorite", ... },
    { "type": "button", "name": "BtnLock", ... }
  ]
}
```

### 5.3 skinLayers 建構流程

`UIPreviewBuilder._buildNode()` 偵測到 `skinLayers` 時：

```
1. 建立主節點（FooterPanel）— UITransform + Widget
2. 對 skinLayers 陣列中的每一項：
   a. 建立子節點 `__skin_layer_{zOrder}`（例：__skin_layer_0）
   b. 設定 Widget: top=0, bottom=0, left=0, right=0（撐滿父節點）
   c. 若有 expand，則 Widget 的 top/bottom/left/right 設為 -expand（向外擴）
   d. 套用 skinSlot 的 Sprite / SolidBackground
   e. 設定 siblingIndex = zOrder
3. 建立內容子節點（children），siblingIndex 在所有 skin layer 之上
```

**結果**：Layout JSON 中 1 個節點 = runtime 的 1 個邏輯面板。
多層視覺是「節點內部的渲染層」，不再佔據外部節點樹的位置。

### 5.4 Composite Image（多圖組合體）

針對 BloodlineCrest 的 8 層疊加場景，新增 `composite-image` 類型：

```json
{
  "type": "composite-image",
  "name": "BloodlineCrest",
  "widget": { "hCenter": true, "vCenter": 4 },
  "width": 176,
  "height": 176,
  "layers": [
    { "slot": "gdv3.bloodline.seal.inset",  "size": [164, 164], "zOrder": 0 },
    { "slot": "gdv3.bloodline.seal.frame",  "size": [174, 174], "zOrder": 1 },
    { "slot": "gdv3.bloodline.crest.glow",  "size": [172, 172], "zOrder": 2 },
    { "slot": "gdv3.bloodline.crest.fill",  "size": [150, 150], "zOrder": 3 },
    { "slot": "gdv3.bloodline.crest.inner", "size": [160, 160], "zOrder": 4 },
    { "slot": "gdv3.bloodline.crest",       "size": [134, 134], "zOrder": 5 },
    { "slot": "gdv3.bloodline.crest.frame", "size": [176, 176], "zOrder": 6 },
    { "slot": "gdv3.bloodline.crest.face",  "size": [122, 122], "zOrder": 7 }
  ]
}
```

`buildCompositeImage()` 在單一父節點內建立 8 個子圖層節點，
全部以 `hCenter` + `vCenter` 置中。Layout JSON 只需 1 個宣告。

### 5.5 skinLayers 與 shadow / noise 的統一

現有的 `UIPreviewShadowManager` 已經在做「附加 shadow/noise 子節點」的事。
新設計中：
- `shadow` → `skinLayers` 中一個 `zOrder: -1` 的項目
- `noise` → `skinLayers` 中一個 `zOrder: 999, blendMode: "overlay"` 的項目

統一管道，不再需要獨立的 ShadowManager。

---

## 6. UIManager 統一管理與層級規則

### 6.1 現有 UIManager 評估

目前的 `UIManager` 已具備完整的分層管理：

| 層級 | 行為 | 狀態 |
|------|------|------|
| Game | 自由 show/hide | ✅ 已實作 |
| UI | 替換式（同時一個） | ✅ 已實作 |
| PopUp | 堆疊式 | ✅ 已實作 |
| Dialog | 佇列式 | ✅ 已實作 |
| System | 最高優先 | ✅ 已實作 |
| Notify | Toast / Loading | ✅ 已實作 |

**結論**：UIManager 的分層邏輯不需要重寫。需要增強的是**與 CompositePanel 的整合**。

### 6.2 整合方案

#### 6.2.1 CompositePanel 自動註冊

```typescript
// CompositePanel.mount() 內部
async mount(screenId: string): Promise<void> {
    const { screen, layout, skin } = await this._specLoader.loadFullScreen(screenId);
    this.screenSpec = screen;

    // 自動向 UIManager 註冊
    const uiId = screen.uiId as UIID;
    services().ui.register(uiId, this.asUILayer());
}
```

#### 6.2.2 Z-Order 管理規則

CompositePanel 內部的 ChildPanel 依固定規則排序：

```
z-order 0~99     : Background layers (skinLayers)
z-order 100~899  : Content (ChildPanels, 依 Layout JSON 順序)
z-order 900~999  : Overlay layers (TabBar, CloseButton, toast)
```

ChildPanel 的 siblingIndex 由 `CompositePanel` 統一管理，ChildPanel 本身不允許
自行修改 siblingIndex。

#### 6.2.3 統一 API

```typescript
interface ICompositePanel {
    // ── 畫面管理 ──
    mount(screenId: string): Promise<void>;
    unmount(): void;

    // ── Tab / Slot ──
    switchSlot(slotId: string, fragmentId: string): Promise<void>;
    getActiveSlotFragment(slotId: string): string | null;

    // ── 資料流 ──
    applyContentState(state: Record<string, unknown>): void;
    onDataChange: Signal<{ target: string; value: unknown }>;

    // ── ChildPanel ──
    getChildPanel<T extends ChildPanelBase>(slotId: string): T | null;
    getAllChildPanels(): Map<string, ChildPanelBase>;
}
```

---

## 7. 跨引擎遷移性設計

### 7.1 現有抽象層評估

專案已建立三個引擎無關介面：

| 介面 | 路徑 | 狀態 |
|------|------|------|
| `INodeFactory` | `ui/core/interfaces/INodeFactory.ts` | ✅ 已定義 + Cocos 實作 |
| `IStyleApplicator` | `ui/core/interfaces/IStyleApplicator.ts` | ✅ 已定義 |
| `ILayoutResolver` | `ui/core/interfaces/ILayoutResolver.ts` | ✅ 已定義 |
| Unity stub | `ui/platform/unity/UnityNodeFactory.ts` | ⚠️ 全部 throw |

### 7.2 需要新增的介面

#### ICompositeRenderer

```typescript
/**
 * 負責 CompositePanel 特有的渲染操作。
 * 標準 INodeFactory 不涵蓋的功能：skinLayers、composite-image、radar-chart。
 */
interface ICompositeRenderer {
    /** 在節點內部建立多層 skin 背景 */
    buildSkinLayers(parent: NodeHandle, layers: SkinLayerDef[]): Promise<void>;

    /** 建立多圖組合體（如命紋徽章） */
    buildCompositeImage(parent: NodeHandle, layers: CompositeImageLayerDef[]): Promise<void>;

    /** 建立 Graphics-based 的雷達圖 */
    buildRadarChart(parent: NodeHandle, config: RadarChartConfig): NodeHandle;

    /** 建立可編輯文字框 */
    buildEditBox(parent: NodeHandle, config: EditBoxConfig): NodeHandle;
}
```

#### IScrollVirtualizer

```typescript
/**
 * 虛擬列表的引擎無關介面。
 */
interface IScrollVirtualizer {
    /** 設定資料來源與項目模板 */
    initialize(config: VirtualScrollConfig): void;

    /** 更新資料（差異更新，非全量重建） */
    updateData(items: unknown[]): void;

    /** 滾動到指定索引 */
    scrollToIndex(index: number, animate?: boolean): void;

    /** 取得當前可視範圍內的項目索引 */
    getVisibleRange(): { start: number; end: number };
}
```

### 7.3 依賴隔離規則

```
┌─────────────────────────────────────────────────┐
│         Business Logic Layer (純 TS)             │
│   CompositePanel / ChildPanelBase / Mapper       │
│   ↓ 只依賴 interfaces                            │
├─────────────────────────────────────────────────┤
│         Interface Layer (純型別)                  │
│   INodeFactory / IStyleApplicator / ILayoutResolver│
│   ICompositeRenderer / IScrollVirtualizer         │
├─────────────────────────────────────────────────┤
│  platform/cocos/           │  platform/unity/     │
│  CocosNodeFactory          │  UnityNodeFactory     │
│  CocosCompositeRenderer    │  UnityCompositeRdr    │
│  CocosScrollVirtualizer    │  UnityScrollVirtualzr │
│  ↓ 可直接使用 cc API       │  ↓ 可直接使用 Unity API│
└─────────────────────────────────────────────────┘
```

**遷移至 Unity 時需要做的事**：
1. 實作 `UnityNodeFactory`（`RectTransform` + `Image` + `TMP_Text`）
2. 實作 `UnityCompositeRenderer`（多層 Image、`UILineRenderer`）
3. 實作 `UnityScrollVirtualizer`（`ScrollRect` + 物件池）
4. **不需要修改** `CompositePanel`、`ChildPanelBase`、所有 Mapper、所有 JSON Spec

### 7.4 禁止直接依賴清單

以下 import 只允許出現在 `platform/cocos/` 目錄中：

```typescript
// ❌ 禁止在 CompositePanel / ChildPanelBase 中出現
import { Node, Sprite, Label, UITransform, Widget, Layout, ScrollView } from 'cc';

// ✅ 替代方案
import type { NodeHandle } from '../core/interfaces/INodeFactory';
```

---

## 8. GeneralDetailOverview 遷移路徑

### 8.1 目標：從 2 個 Panel + 2 個 Layout → 1 個 CompositePanel + 1 個 Layout

#### 現狀

```
GeneralDetailPanel (UIPreviewBuilder)
├── buildScreen(general-detail-main)     ← Classic Layout (515 行)
├── _ensureOverviewShell()
│   └── GeneralDetailOverviewShell (UIPreviewBuilder)
│       └── buildScreen(general-detail-bloodline-v3-main)  ← V3 Layout (402 行)
└── _setOverviewMode() 切換 active
```

#### 目標

```
GeneralDetailComposite (CompositePanel)
├── mount('general-detail-unified-screen')
│   └── buildScreen(general-detail-unified-main)  ← 統一 Layout (~200 行)
│       ├── BackgroundScene (image)
│       ├── PortraitCarrier ($ref fragment)
│       ├── OverviewStateChrome (container)
│       ├── InfoCardChrome (panel + skinLayers)
│       ├── TabContentSlot (lazySlot)
│       ├── TabBar (container)
│       └── TopCloseBtn (button)
└── tabRouting 動態切換 TabContentSlot 的 fragment
```

### 8.2 遷移步驟

#### Phase A：建立統一 Layout JSON

1. 合併 Classic 和 V3 的共用結構（背景、立繪、TabBar、關閉鈕）
2. 把 V3 Overview 的內容區（HeaderRow + SummaryModules + BloodlineModules）
   拆成獨立 Fragment：`fragments/layouts/tab-overview.json`
3. 把 Classic 的 6 個 Tab 頁面各拆成獨立 Fragment：
   - `fragments/layouts/tab-basics.json`
   - `fragments/layouts/tab-stats.json`
   - `fragments/layouts/tab-bloodline.json`
   - `fragments/layouts/tab-skills.json`
   - `fragments/layouts/tab-aptitude.json`
   - `fragments/layouts/tab-extended.json`
4. Footer 從 4 節點疊加改為 1 節點 + `skinLayers`

#### Phase B：建立 GeneralDetailComposite

1. 繼承 `CompositePanel`
2. 把 `GeneralDetailOverviewMapper` 的映射邏輯保留
3. 把 `GeneralDetailOverviewShell` 的 `_applyContentState()` 遷移為
   `applyContentState()` 的實作
4. 刪除 `_setOverviewMode()`、`_ensureOverviewShell()` 等切換邏輯

#### Phase C：遷移 GeneralConfig 映射

現有的 `buildGeneralDetailOverviewContentState()` 函式保持不變，
但回傳的 `GeneralDetailOverviewContentState` 結構直接餵給
`CompositePanel.applyContentState()`。

```typescript
// 遷移前
const state = buildGeneralDetailOverviewContentState(config);
this._overviewShell.showContentState(state);

// 遷移後
const state = buildGeneralDetailOverviewContentState(config);
this.applyContentState(state);
```

#### Phase D：驗證與切換

1. 用 `cocos-preview-qa` 截圖對比遷移前後畫面
2. 確認所有 Tab 切換正常
3. 確認節點數量下降（目標：80+ → ≤35）
4. 刪除 `GeneralDetailPanel.ts` 和 `GeneralDetailOverviewShell.ts`

### 8.3 遷移風險控制

| 風險 | 緩解措施 |
|------|----------|
| 視覺差異 | 遷移前截取 6 張 Tab 的 reference screenshot |
| Skin 遺失 | 用 `validate-skin-contracts.js` 驗證所有 skinSlot 都有對應 |
| 資料綁定斷線 | 用 `UIContentBinder.validate()` 驗證 content state 完整性 |
| 效能回退 | Fragment lazy-load 反而應該改善（減少首次 buildScreen 節點數） |

---

## 9. Layout JSON Spec v2 規範

### 9.1 新增節點類型

| 類型 | 說明 | 對應 |
|------|------|------|
| `child-panel` | UCUF 的 ChildPanel 容器 | 新增 |
| `composite-image` | 多圖組合體 | 新增，取代手動 8 層疊加 |

### 9.2 新增屬性

| 屬性 | 適用類型 | 說明 |
|------|----------|------|
| `skinLayers` | panel, container | 多層 Skin 背景定義陣列 |
| `lazySlot` | container | 標記為延遲載入插槽 |
| `defaultFragment` | container (lazySlot) | 預設載入的 Fragment |
| `childType` | child-panel | ChildPanel 子類型 |
| `config` | child-panel | ChildPanel 建構配置 |
| `dataSource` | child-panel | 資料綁定來源 ID |
| `layers` | composite-image | 多圖層定義陣列 |

### 9.3 向後相容性

- 所有新增屬性為**可選**（optional）
- 不帶 `skinLayers` 的 `panel` 行為與現在完全相同
- 不帶 `lazySlot` 的 `container` 行為與現在完全相同
- 既有的 `panel` + `image` + `label` + `button` + `scroll-list` 全部保留

### 9.4 節點數量 Lint 規則

新增規則整合到 `validate-ui-specs.js`：

| 規則 | 說明 | 嚴重度 |
|------|------|--------|
| R19 | 同一 parent 下不允許 ≥3 個節點有完全相同的 widget | error |
| R20 | 偵測 `*Fill` / `*Bleed` / `*Frame` 同名模式，建議改用 `skinLayers` | warning |
| R21 | 單一 Layout 總節點數 ≤ 50（不含 lazySlot 內容） | warning |
| R22 | `composite-image` 的 layers 數量 ≤ 12 | warning |

---

## 10. 驗證工具與 Lint 規則

### 10.1 靜態驗證

```bash
# 現有工具擴充
node tools_node/validate-ui-specs.js --rules R19,R20,R21,R22

# 新增 ChildPanel config 驗證
node tools_node/validate-child-panel-configs.js
```

### 10.2 Runtime 診斷

```typescript
// UIPreviewDiagnostics 擴充
class UIPreviewDiagnostics {
    // 既有
    static buildScreenError(id: string, err: Error): void;
    static buildScreenSuccess(id: string, childCount: number): void;

    // 新增
    static compositePanelMounted(screenId: string, childPanelCount: number): void;
    static lazySlotLoaded(slotId: string, fragmentId: string, nodeCount: number): void;
    static skinLayersApplied(nodeName: string, layerCount: number): void;
    static nodeCountWarning(layoutId: string, count: number, threshold: number): void;
}
```

### 10.3 遷移進度追蹤

新增欄位到 `factory-progress-scorecard.json`：

```json
{
  "ucufMigration": {
    "totalScreens": 12,
    "migratedScreens": 0,
    "eliminatedNodes": 0,
    "targetNodeReduction": "60%"
  }
}
```

---

## 11. 舊代碼淘汰策略

### 11.1 Deprecated Zone（待刪除緩衝區）

遷移期間，舊代碼不立即刪除，而是移入指定的緩衝目錄：

```
assets/scripts/ui/_deprecated/
├── GeneralDetailPanel.ts          ← 標記 @deprecated v1.1
├── GeneralDetailOverviewShell.ts  ← 標記 @deprecated v1.1
└── README.md                      ← 說明每個檔案的淘汰原因與替代方案
```

### 11.2 標記規範

所有待淘汰的 class / function 必須加上 JSDoc 標記：

```typescript
/**
 * @deprecated v1.1 — 由 GeneralDetailComposite 取代。
 * 預計在 M5 milestone 完成後移除。
 * @see CompositePanel
 * @removal-target M5
 */
export class GeneralDetailPanel extends UIPreviewBuilder { ... }
```

### 11.3 遷移階段與清理時機

| 階段 | 動作 | 舊代碼狀態 |
|------|------|------------|
| Phase A (M4) | 建立新 CompositePanel + Layout | 舊代碼移入 `_deprecated/`，保留 import alias 相容 |
| Phase B (M4) | 新畫面通過截圖對比驗證 | 舊代碼標記 `@deprecated`，console.warn 提醒 |
| Phase C (M5) | 所有畫面遷移完成 | 全域搜尋 `_deprecated/` import，確認為零 |
| Phase D (M5) | **全域清理** | 刪除 `_deprecated/` 目錄、清理 UIConfig 中的舊 UIID |

### 11.4 自動化掃描工具

```bash
# 掃描專案中是否仍有對 _deprecated/ 的引用
node tools_node/scan-deprecated-refs.js
# 輸出：
#   ✅ 0 references to _deprecated/ — 可安全刪除
#   ❌ 3 files still import from _deprecated/:
#      - assets/scripts/ui/components/LobbyScreen.ts:14
```

### 11.5 舊 Layout JSON 處置

舊的 Layout JSON（如 `general-detail-main.json`）在 Phase A 移入：

```
assets/resources/ui-spec/_deprecated/
├── layouts/general-detail-main.json
└── README.md
```

`validate-ui-specs.js` 新增 R23 規則：**`_deprecated/` 內的 spec 不應被任何 screen 引用**。

---

## 12. 美術資源總註冊表

### 12.1 設計目標

建立一份機器可讀的「美術素材綁定清單」（Asset Registry），精準追蹤每個
`CompositePanel` 實際使用的資源路徑，支援：

1. **打包工具**：自動分析 bundle 依賴，剔除未使用素材
2. **CI 驗證**：偵測「已宣告但缺檔」或「存在但未被任何 panel 引用」的孤兒資源
3. **記憶體預算**：預估單一畫面的資源佔用量

### 12.2 註冊表結構

```typescript
interface AssetRegistryEntry {
    /** 資源路徑（相對 resources/） */
    path: string;
    /** 資源類型 */
    type: 'SpriteFrame' | 'Font' | 'JsonAsset' | 'Texture2D' | 'SpriteAtlas';
    /** 來源：靜態（Layout/Skin JSON 聲明）或動態（runtime dataSource 載入） */
    source: 'static' | 'dynamic';
    /** 引用此資源的 Screen ID 列表 */
    referencedBy: string[];
    /** 所屬 bundle（預設 'resources'） */
    bundle: string;
}
```

### 12.3 靜態資源收集

在 `CompositePanel.mount()` 完成後，自動掃描已解析的 Layout + Skin 產出靜態清單：

```typescript
// CompositePanel 內部
private _collectStaticAssets(): AssetRegistryEntry[] {
    const entries: AssetRegistryEntry[] = [];
    // 1. 掃描所有 skinSlot → 解析 UISkinResolver 的 spriteFrame 路徑
    for (const [slotId, slotDef] of this.skinManifest.entries()) {
        if (slotDef.spriteFrame) {
            entries.push({
                path: slotDef.spriteFrame,
                type: 'SpriteFrame',
                source: 'static',
                referencedBy: [this.screenSpec.id],
                bundle: slotDef.bundle ?? 'resources',
            });
        }
    }
    // 2. 掃描所有 fragment $ref → 註冊 JSON 路徑
    // 3. 掃描所有 i18n → 註冊語系 JSON 路徑
    return entries;
}
```

### 12.4 動態資源登記

`ChildPanelBase` 提供 `registerDynamicAsset()` 方法，由子類在 `onDataUpdate()` 載入
新資源時呼叫：

```typescript
// 例：GridPanel 的 cellTemplate 中動態載入武將頭像
protected async onDataUpdate(data: Record<string, unknown>): Promise<void> {
    const portraitPath = data['portraitPath'] as string;
    this.registerDynamicAsset(portraitPath, 'SpriteFrame');
    // ... 載入並顯示
}
```

### 12.5 CLI 工具整合

```bash
# 從所有 screen JSON 收集靜態資源清單
node tools_node/collect-asset-registry.js --output artifacts/asset-registry.json

# 與 resources/ 實際檔案交叉比對
node tools_node/audit-asset-usage.js --registry artifacts/asset-registry.json
# 輸出：
#   孤兒資源（存在但未引用）: 12 files, 2.3 MB
#   缺失資源（已引用但缺檔）: 0 files ✅
#   動態資源（需 runtime 才能確認）: 8 paths
```

---

## 13. 全域除錯日誌系統

### 13.1 現狀評估

目前 `UIPreviewDiagnostics` 提供集中化的日誌輸出，但存在以下不足：

- **無層級開關**：所有 `console.log` 在 production build 仍會輸出
- **無分類標籤**：無法只看 Fragment 載入或只看資料綁定的日誌
- **散落的直接 console 呼叫**：部分元件（如 `BattleLogPanel`）仍直接使用 `console.log`

### 13.2 UCUFLogger 設計

```typescript
/** 日誌層級 */
enum LogLevel { NONE = 0, ERROR = 1, WARN = 2, INFO = 3, DEBUG = 4, VERBOSE = 5 }

/** 日誌分類標籤 */
type LogCategory =
    | 'lifecycle'      // mount / unmount / show / hide
    | 'data-binding'   // applyContentState / onDataUpdate
    | 'fragment'       // lazySlot load / switch / destroy
    | 'skin'           // skinLayers build / skin resolve
    | 'asset'          // 資源載入 / 釋放 / 註冊
    | 'i18n'           // 語系切換 / 翻譯查詢
    | 'diagnostic'     // 自我診斷 / 規則違反
    | 'memory';        // 記憶體追蹤 / dispose

class UCUFLogger {
    private static _level: LogLevel = LogLevel.WARN;
    private static _enabledCategories = new Set<LogCategory>();
    private static _enableAll = false;

    /** 全域設定日誌層級（production 建議 ERROR，dev 建議 DEBUG） */
    static setLevel(level: LogLevel): void { this._level = level; }

    /** 開啟 / 關閉特定分類 */
    static enableCategory(cat: LogCategory, on = true): void {
        on ? this._enabledCategories.add(cat) : this._enabledCategories.delete(cat);
    }

    /** 開啟所有分類（除錯用） */
    static enableAll(on = true): void { this._enableAll = on; }

    static debug(cat: LogCategory, msg: string, ...args: unknown[]): void {
        if (this._level >= LogLevel.DEBUG && this._isCategoryOn(cat)) {
            console.log(`[UCUF:${cat}] ${msg}`, ...args);
        }
    }

    static info(cat: LogCategory, msg: string, ...args: unknown[]): void {
        if (this._level >= LogLevel.INFO && this._isCategoryOn(cat)) {
            console.log(`[UCUF:${cat}] ${msg}`, ...args);
        }
    }

    static warn(cat: LogCategory, msg: string, ...args: unknown[]): void {
        if (this._level >= LogLevel.WARN) {
            console.warn(`[UCUF:${cat}] ⚠️ ${msg}`, ...args);
        }
    }

    static error(cat: LogCategory, msg: string, ...args: unknown[]): void {
        if (this._level >= LogLevel.ERROR) {
            console.error(`[UCUF:${cat}] ❌ ${msg}`, ...args);
        }
    }

    private static _isCategoryOn(cat: LogCategory): boolean {
        return this._enableAll || this._enabledCategories.has(cat);
    }
}
```

### 13.3 關鍵路徑日誌覆蓋

| 路徑 | 分類 | 層級 | 訊息範例 |
|------|------|------|----------|
| `CompositePanel.mount()` | lifecycle | INFO | `mount("general-detail-unified-screen") — layout loaded, 7 slots` |
| `CompositePanel.switchSlot()` | fragment | DEBUG | `switchSlot("TabContentSlot", "tab-basics") — 12 nodes built` |
| `ChildPanelBase.onDataUpdate()` | data-binding | DEBUG | `AttributePanel "BasicInfo" — 8 rows updated` |
| `skinLayers` 建構 | skin | VERBOSE | `FooterPanel — 3 skin layers applied (fill/bleed/frame)` |
| 資料綁定路徑找不到 | data-binding | WARN | `bind path "stats.luck" not found in content state` |
| Fragment JSON 載入失敗 | fragment | ERROR | `fragment "tab-skills" load failed: 404` |

### 13.4 與既有 UIPreviewDiagnostics 的整合

`UIPreviewDiagnostics` 的所有方法內部改為委託 `UCUFLogger`：

```typescript
// 改前
static buildScreenSuccess(layoutId: string, count: number): void {
    console.log(`[UIPreviewBuilder] buildScreen 完成 ...`);
}

// 改後
static buildScreenSuccess(layoutId: string, count: number): void {
    UCUFLogger.info('lifecycle', `buildScreen 完成 (layout: ${layoutId}) root.children=${count}`);
}
```

### 13.5 Runtime 開關 API

```typescript
// 開發期間在 Browser Console 快速開關
(window as any).__ucuf_debug = () => {
    UCUFLogger.setLevel(LogLevel.VERBOSE);
    UCUFLogger.enableAll(true);
};
(window as any).__ucuf_quiet = () => {
    UCUFLogger.setLevel(LogLevel.ERROR);
    UCUFLogger.enableAll(false);
};
```

---

## 14. 架構自我診斷與校驗

### 14.1 設計目標

在 **runtime** 主動偵測 UI 配置違規，而非等到視覺出錯後人工排查。
所有違規都產出結構化的 Warning，包含**錯誤來源、違反規則、建議修正方案**。

### 14.2 RuntimeRuleChecker

```typescript
interface RuleViolation {
    ruleId: string;          // 如 'RT-01'
    severity: 'error' | 'warning' | 'info';
    source: string;          // 如 'FooterPanel' 或 'general-detail-unified-main.json'
    message: string;         // 人類可讀描述
    suggestion: string;      // 建議修正方案
}

class RuntimeRuleChecker {
    private violations: RuleViolation[] = [];

    /** 在 CompositePanel.mount() 完成後呼叫 */
    check(panel: CompositePanel): RuleViolation[] {
        this.violations = [];
        this._checkNodeDepth(panel);
        this._checkDuplicateBindings(panel);
        this._checkLayoutConflicts(panel);
        this._checkSkinLayerIntegrity(panel);
        this._checkOrphanSlots(panel);
        return this.violations;
    }
}
```

### 14.3 內建規則清單

| 規則 ID | 說明 | 嚴重度 | 偵測方式 |
|---------|------|--------|----------|
| RT-01 | 節點深度超過 8 層 | warning | 遞迴遍歷 children 計算最大深度 |
| RT-02 | 同一 dataSource 被多個 ChildPanel 綁定 | error | 掃描所有 ChildPanel 的 dataSource 欄位 |
| RT-03 | skinLayers 引用的 skinSlot 在 Skin JSON 中不存在 | error | 交叉比對 skinLayers[].slot vs. skinManifest |
| RT-04 | lazySlot 的 defaultFragment 載入失敗 | error | catch fragment load 的 reject |
| RT-05 | 同一 parent 下多個 children 使用完全相同的 widget | warning | 比對 siblings 的 widget 屬性 |
| RT-06 | composite-image layers 超過 12 層 | warning | 檢查 layers 陣列長度 |
| RT-07 | ChildPanel config 缺少必要欄位 | error | 依 childType 查表驗證必填欄位 |
| RT-08 | Tab 路由表引用不存在的 fragment | error | 嘗試 loadLayout 並 catch error |
| RT-09 | content state 中的欄位與 dataSource 不匹配 | warning | 比對 applyContentState 的 key set |
| RT-10 | 同一畫面中 skinSlot ID 重複但指向不同資源 | error | 掃描 skinManifest 的 slot → path 映射 |

### 14.4 輸出格式

```
[UCUF:diagnostic] ⚠️ RT-05 violation in "FooterPanel"
  ├─ 來源: general-detail-unified-main.json, line ~42
  ├─ 說明: 2 siblings share identical widget { left:24, right:24, bottom:24 }
  └─ 建議: 使用 skinLayers 將視覺層合併為單一節點，或調整 widget 使其不重疊

[UCUF:diagnostic] ❌ RT-03 violation in "InfoCardChrome"
  ├─ 來源: skinLayers[1].slot = "gdv3.card.bleed"
  ├─ 說明: skinSlot "gdv3.card.bleed" 在 skin "general-detail-v3-default" 中不存在
  └─ 建議: 在 general-detail-v3-default.json 中新增該 slot 定義，或修正 skinLayers 中的 slot 名稱
```

### 14.5 觸發時機

| 時機 | 執行規則 | 條件 |
|------|----------|------|
| `CompositePanel.mount()` 完成後 | 全部 RT-01~RT-10 | 僅 `DEBUG_MODE` 開啟時 |
| `switchSlot()` 完成後 | RT-01, RT-04 | 僅 `DEBUG_MODE` 開啟時 |
| `applyContentState()` 完成後 | RT-02, RT-09 | 僅 `DEBUG_MODE` 開啟時 |
| `validate-ui-specs.js` CLI | 靜態版 RT-03, RT-05~RT-08 | 永遠執行 |

---

## 15. 自動化測試框架

### 15.1 測試分層策略

```
┌────────────────────────────────────────────────┐
│  Layer 3: Integration Tests (E2E)              │
│  ─ 完整 Screen mount → data bind → 截圖比對    │
│  ─ 執行頻率：每次 PR / 手動觸發                 │
├────────────────────────────────────────────────┤
│  Layer 2: Component Tests                      │
│  ─ 單一 ChildPanel 的 mount + dataUpdate       │
│  ─ 驗證節點數、bind 正確性、skinSlot 對應       │
│  ─ 執行頻率：每次 commit                        │
├────────────────────────────────────────────────┤
│  Layer 1: Unit Tests (Pure Logic)              │
│  ─ UCUFLogger / RuntimeRuleChecker / AssetReg  │
│  ─ skinLayers 解析 / composite-image 建構       │
│  ─ DataBindingValidator / I18nInjector          │
│  ─ 執行頻率：每次修改 + CI                      │
└────────────────────────────────────────────────┘
```

### 15.2 Layer 1: 純邏輯單元測試

不依賴 Cocos runtime，使用 **mock NodeHandle** 執行：

```typescript
// tests/ucuf/skinLayers.test.ts
describe('skinLayers 解析', () => {
    it('應建立正確數量的 skin layer 子節點', () => {
        const mockFactory = new MockNodeFactory();
        const spec: SkinLayerDef[] = [
            { slot: 'fill', zOrder: 0 },
            { slot: 'bleed', zOrder: 1, expand: 4 },
            { slot: 'frame', zOrder: 2 },
        ];
        const result = buildSkinLayers(mockFactory, spec);
        expect(result.children.length).toBe(3);
        expect(result.children[1].widget.top).toBe(-4); // expand 向外擴
    });

    it('不應允許重複的 zOrder', () => {
        const spec: SkinLayerDef[] = [
            { slot: 'a', zOrder: 0 },
            { slot: 'b', zOrder: 0 },
        ];
        expect(() => buildSkinLayers(new MockNodeFactory(), spec)).toThrow(/duplicate zOrder/);
    });
});
```

### 15.3 Layer 2: 元件測試

使用 Cocos test runner（`cocos-test-helper`）或專案內的 `UIScreenPreviewHost`：

```typescript
// tests/ucuf/AttributePanel.component.test.ts
describe('AttributePanel', () => {
    let panel: AttributePanel;

    beforeEach(async () => {
        panel = new AttributePanel();
        await panel.onMount({
            childType: 'attribute',
            config: { columns: 1, rowHeight: 32, rowSpacing: 8 },
        });
    });

    it('應根據資料長度建立對應數量的行', () => {
        panel.onDataUpdate({
            basicAttributes: [
                { label: '武力', value: '97' },
                { label: '智力', value: '85' },
            ],
        });
        expect(panel.rowCount).toBe(2);
    });

    it('空資料應顯示空狀態', () => {
        panel.onDataUpdate({ basicAttributes: [] });
        expect(panel.rowCount).toBe(0);
    });
});
```

### 15.4 Layer 3: 整合測試（截圖回歸）

```bash
# 對所有已遷移的 UCUF 畫面執行截圖回歸
node tools_node/ucuf-screenshot-regression.js --screens general-detail-unified --baseline artifacts/ucuf-baseline/
# 輸出：
#   general-detail-unified/tab-basics:    PASS (diff: 0.02%)
#   general-detail-unified/tab-stats:     PASS (diff: 0.00%)
#   general-detail-unified/tab-bloodline: FAIL (diff: 4.7%) ← 需人工審核
```

### 15.5 Pass-All Gate

新增 CI gate 規則：任何修改涉及以下路徑時，必須通過全數 UCUF 測試：

```yaml
# .github/workflows/ucuf-tests.yml (概念)
trigger_paths:
  - 'assets/scripts/ui/core/**'
  - 'assets/scripts/ui/core/panels/**'
  - 'assets/resources/ui-spec/**'
jobs:
  ucuf-unit:
    run: node tools_node/run-ucuf-tests.js --layer 1
  ucuf-component:
    run: node tools_node/run-ucuf-tests.js --layer 2
  ucuf-regression:
    run: node tools_node/run-ucuf-tests.js --layer 3
```

---

## 16. 記憶體管理與資源卸載機制

### 16.1 現有基礎評估

專案已具備完整的記憶體管理骨架：

| 元件 | 路徑 | 功能 |
|------|------|------|
| `MemoryManager` | `core/systems/MemoryManager.ts` | refCount 追蹤 + LRU 軟釋放 + scope 批次釋放 |
| `ResourceManager` | `core/systems/ResourceManager.ts` | addRef/decRef + releaseByTag + clearCache |
| `SceneManager` | `core/managers/SceneManager.ts` | 場景切換中繼（LoadingScene） |

**結論**：不需要重建記憶體管理，而是讓 `CompositePanel` 正確串接已有的機制。

### 16.2 CompositePanel.dispose() 完整釋放

```typescript
abstract class CompositePanel {
    /** 追蹤本 Panel 所有動態載入的資源路徑 */
    private _loadedAssetPaths = new Set<string>();

    /** 完整釋放：銷毀節點 + 釋放資源 + 清理引用 */
    dispose(): void {
        // 1. 銷毀所有 ChildPanel
        for (const [slotId, child] of this.childPanels) {
            child.onUnmount();
            UCUFLogger.debug('memory', `ChildPanel "${slotId}" unmounted`);
        }
        this.childPanels.clear();

        // 2. 釋放所有動態載入的資源
        const rm = services().resource;
        for (const path of this._loadedAssetPaths) {
            rm.releaseAsset(path);
        }
        this._loadedAssetPaths.clear();

        // 3. 釋放 Screen / Layout / Skin 的 JSON 快取（透過 tag）
        rm.releaseByTag(`screen:${this.screenSpec.id}`);

        // 4. 銷毀節點樹
        this.unmount();

        UCUFLogger.info('memory', `CompositePanel "${this.screenSpec.id}" disposed — ${this._loadedAssetPaths.size} assets released`);
    }
}
```

### 16.3 資源載入追蹤器

每次 `CompositePanel` 或其 `ChildPanel` 載入資源時，自動註冊到追蹤器：

```typescript
// CompositePanel 內部
protected async loadAssetTracked<T>(
    path: string,
    loader: (path: string) => Promise<T>
): Promise<T> {
    this._loadedAssetPaths.add(path);
    // 同步通報 MemoryManager（使用 screen scope）
    services().memory.notifyLoaded(path, 'resources', 'auto', `screen:${this.screenSpec.id}`);
    return loader(path);
}
```

### 16.4 UIManager 場景切換強制卸載

在 `UIManager` 中新增場景切換時的強制卸載機制：

```typescript
// UIManager 擴充
public onSceneWillChange(targetScene: string): void {
    // 關閉所有 UI 層級的面板
    for (const [uiId, entry] of this.registry) {
        if (entry.isOpen) this.close(uiId);
    }

    // 對所有已註冊的 CompositePanel 呼叫 dispose()
    for (const [uiId, entry] of this.registry) {
        const composite = entry.layer as unknown as CompositePanel;
        if (composite?.dispose) {
            composite.dispose();
        }
    }

    // 觸發 MemoryManager 的 scope 批次釋放
    services().memory.releaseByScope(`scene:${targetScene}`);
}
```

### 16.5 低記憶體壓力釋放

利用 `MemoryManager` 既有的 `warningThreshold`：

```typescript
// MemoryManager.onThresholdExceeded 掛載回調
services().memory.onThresholdExceeded = (recordCount: number) => {
    UCUFLogger.warn('memory', `資源記錄數 ${recordCount} 超過警戒線`);

    // 1. 釋放所有非活躍 CompositePanel 的快取資源
    for (const [uiId, entry] of services().ui.getRegistry()) {
        if (!entry.isOpen) {
            const composite = entry.layer as unknown as CompositePanel;
            composite?.dispose?.();
        }
    }

    // 2. 觸發 LRU buffer 清理
    services().memory.evictLruBuffer(/* keepCount */ 10);
};
```

---

## 17. 全動態資料綁定與衝突偵測

### 17.1 設計原則：內容 100% 資料驅動

UCUF 所有可見文字、數值、圖片、列表內容**嚴禁寫死（hardcoded）**。
唯一的資料來源是 `applyContentState(state)` 傳入的 content state 物件。

```
禁止:
  label.string = '武力';           // ❌ 寫死中文
  label.string = '97';             // ❌ 寫死數值
  sprite.spriteFrame = hardcoded;  // ❌ 寫死圖片

正確:
  // content state 提供所有資料
  applyContentState({
      basicAttributes: [
          { label: i18n.t('ui.stat.str'), value: String(config.str) }
      ]
  });
```

### 17.2 DataBindingValidator

在 `applyContentState()` 時自動驗證資料完整性：

```typescript
class DataBindingValidator {
    /**
     * 驗證 content state 與 Layout spec 的 dataSource 宣告是否匹配。
     * @returns 不匹配的項目列表
     */
    static validate(
        contentState: Record<string, unknown>,
        childPanels: Map<string, ChildPanelBase>
    ): BindingMismatch[] {
        const mismatches: BindingMismatch[] = [];

        for (const [slotId, panel] of childPanels) {
            const ds = panel.dataSource;
            if (!ds) continue;

            // 檢查 1：dataSource 在 content state 中是否存在
            if (!(ds in contentState)) {
                mismatches.push({
                    type: 'missing-source',
                    slotId,
                    dataSource: ds,
                    message: `ChildPanel "${slotId}" 宣告 dataSource="${ds}"，但 content state 中不存在此欄位`,
                    suggestion: `在 Mapper 的 buildContentState() 中補上 "${ds}" 欄位`,
                });
            }

            // 檢查 2：資料格式是否符合 ChildPanel 預期
            const data = contentState[ds];
            if (data !== undefined) {
                const formatError = panel.validateDataFormat(data);
                if (formatError) {
                    mismatches.push({
                        type: 'format-mismatch',
                        slotId,
                        dataSource: ds,
                        message: formatError,
                        suggestion: `確認 Mapper 回傳的 "${ds}" 符合 ${panel.constructor.name} 的資料格式`,
                    });
                }
            }
        }

        // 檢查 3：content state 有多餘的 key 沒有被任何 ChildPanel 使用
        const usedKeys = new Set([...childPanels.values()].map(p => p.dataSource).filter(Boolean));
        for (const key of Object.keys(contentState)) {
            if (!usedKeys.has(key) && key !== '_meta') {
                mismatches.push({
                    type: 'unused-key',
                    slotId: '',
                    dataSource: key,
                    message: `content state 中的 "${key}" 未被任何 ChildPanel 使用`,
                    suggestion: `若此欄位已不需要，從 Mapper 中移除以減少資料傳輸`,
                });
            }
        }

        return mismatches;
    }
}
```

### 17.3 資料重新填充（Refill）

`CompositePanel` 支援隨時以新資料重新填充畫面：

```typescript
// 切換武將時，直接用新資料重新填充
const newState = buildGeneralDetailOverviewContentState(newGeneralConfig);
compositePanel.applyContentState(newState);
// ↑ 內部自動：
//   1. DataBindingValidator.validate()
//   2. 對每個 ChildPanel 呼叫 onDataUpdate(newData)
//   3. ChildPanel 內部做差異更新（非全量重建）
```

### 17.4 綁定衝突偵測

防止同一 `dataSource` 被多個 ChildPanel 綁定造成的更新衝突：

```typescript
// CompositePanel.mount() 內部
private _detectBindingConflicts(): void {
    const dsMap = new Map<string, string[]>();
    for (const [slotId, panel] of this.childPanels) {
        const ds = panel.dataSource;
        if (!ds) continue;
        const list = dsMap.get(ds) ?? [];
        list.push(slotId);
        dsMap.set(ds, list);
    }

    for (const [ds, slots] of dsMap) {
        if (slots.length > 1) {
            UCUFLogger.warn('data-binding',
                `dataSource "${ds}" 被多個 ChildPanel 綁定: [${slots.join(', ')}]。` +
                `若這是刻意的共享資料，請在 spec 中標記 "shared": true`
            );
        }
    }
}
```

### 17.5 ChildPanelBase.validateDataFormat()

每個 ChildPanel 子類必須實作資料格式驗證：

```typescript
// AttributePanel
validateDataFormat(data: unknown): string | null {
    if (!Array.isArray(data)) return `預期 Array，收到 ${typeof data}`;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (typeof row !== 'object' || !('label' in row) || !('value' in row)) {
            return `第 ${i} 列缺少必要欄位 "label" 或 "value"`;
        }
    }
    return null; // 格式正確
}

// RadarChartPanel
validateDataFormat(data: unknown): string | null {
    if (typeof data !== 'object' || data === null) return `預期 Object，收到 ${typeof data}`;
    const axes = this.config.axes as string[];
    for (const axis of axes) {
        if (!(axis in (data as Record<string, unknown>))) {
            return `缺少軸向資料 "${axis}"`;
        }
    }
    return null;
}
```

---

## 18. 多國語系統籌管理

### 18.1 現有 I18nSystem 評估

專案已有完整的 `I18nSystem`（`core/systems/I18nSystem.ts`）：

| 功能 | 狀態 |
|------|------|
| `setLocale(locale)` — 語系切換 + 字型懶載入 | ✅ 已實作 |
| `t(key, ...args)` — 字串翻譯 + 佔位符 | ✅ 已實作 |
| `getFont(role)` — 語系字型取得 | ✅ 已實作 |
| `onLocaleChanged` — 語系切換事件 | ✅ 已實作 |
| 字型 addRef/decRef 防 GC | ✅ 已實作 |

**結論**：I18nSystem 核心不需要重建，但 `CompositePanel` 需要**統籌注入**機制。

### 18.2 CompositePanel 語系注入方案

```typescript
abstract class CompositePanel {
    /** 統一管理語系：mount 時自動注入，語系切換時自動重載 */
    private _currentLocale: string = '';
    private _localeChangeUnsub: (() => void) | null = null;

    async mount(screenId: string): Promise<void> {
        // ... 載入 screen/layout/skin ...

        // 自動注入當前語系
        this._currentLocale = services().i18n.currentLocale;
        const i18nStrings = await services().specLoader.loadI18n(this._currentLocale);
        this._injectI18n(i18nStrings);

        // 監聽語系切換事件 — 自動重新注入
        this._localeChangeUnsub = services().i18n.onLocaleChanged(async (newLocale) => {
            this._currentLocale = newLocale;
            const newStrings = await services().specLoader.loadI18n(newLocale);
            this._injectI18n(newStrings);
            // 通知所有 ChildPanel 重新渲染文字
            for (const [, child] of this.childPanels) {
                child.onLocaleChanged(newStrings);
            }
            UCUFLogger.info('i18n', `語系切換至 "${newLocale}"，所有 ChildPanel 已重新注入`);
        });
    }

    dispose(): void {
        this._localeChangeUnsub?.();
        // ... 其他清理 ...
    }
}
```

### 18.3 ChildPanelBase 語系支援

```typescript
abstract class ChildPanelBase {
    /** 當前語系字串快取 */
    protected i18nStrings: Record<string, string> = {};

    /** 由 CompositePanel 呼叫，注入語系字串 */
    onLocaleChanged(strings: Record<string, string>): void {
        this.i18nStrings = strings;
        this._refreshLabels();
    }

    /** 翻譯 helper — 與 I18nSystem.t() 行為一致 */
    protected t(key: string, ...args: string[]): string {
        let str = this.i18nStrings[key] ?? key;
        args.forEach((arg, i) => { str = str.replace(`{${i}}`, arg); });
        return str;
    }

    /** 子類覆寫：重新渲染所有文字標籤 */
    protected abstract _refreshLabels(): void;
}
```

### 18.4 統籌管理 + 局部覆寫模式

大部分 ChildPanel 自動使用系統語系（`services().i18n.currentLocale`），
但特殊場景允許**局部覆寫**：

```json
// Layout JSON 中的局部覆寫
{
  "type": "child-panel",
  "childType": "attribute",
  "name": "DiplomacyInfo",
  "config": {
    "localeOverride": "zh-CN",
    "columns": 1
  },
  "dataSource": "diplomacyAttributes"
}
```

```typescript
// ChildPanelBase 處理覆寫
async onMount(spec: ChildPanelSpec): Promise<void> {
    const overrideLocale = spec.config?.localeOverride;
    if (overrideLocale) {
        // 使用指定語系而非系統語系
        this.i18nStrings = await services().specLoader.loadI18n(overrideLocale);
        UCUFLogger.info('i18n', `"${spec.name}" 使用局部覆寫語系: ${overrideLocale}`);
    }
    // ... 繼續建構 ...
}
```

### 18.5 文字渲染效能優化

大量 Label 同時更新語系時的效能策略：

| 策略 | 說明 |
|------|------|
| **批次更新** | `onLocaleChanged` 收集所有需更新的 Label，用 `scheduleOnce` 在下一幀統一更新 |
| **差異更新** | 比對新舊語系字串，只更新實際有變化的 Label（zh-TW → zh-CN 大部分不變） |
| **字型預載** | 語系切換前先 `preloadFont(newLocale)`，避免切換瞬間出現系統字型 fallback |
| **可視區域優先** | ScrollListPanel 的虛擬列表只更新可視範圍內的項目 |

```typescript
// 批次 + 差異更新示範
protected _refreshLabels(): void {
    const updates: Array<{ label: ILabel; newText: string }> = [];
    for (const [key, labelRef] of this._boundLabels) {
        const newText = this.t(key);
        if (labelRef.string !== newText) {
            updates.push({ label: labelRef, newText });
        }
    }
    if (updates.length === 0) return;

    // 下一幀批次套用
    this.scheduleOnce(() => {
        for (const { label, newText } of updates) {
            label.string = newText;
        }
        UCUFLogger.debug('i18n', `批次更新 ${updates.length} 個 Label`);
    }, 0);
}
```

### 18.6 I18n 驗證工具

```bash
# 驗證所有 Layout JSON 中使用的 textKey 在所有語系中都有對應翻譯
node tools_node/validate-i18n-coverage.js --locales zh-TW,zh-CN,en,ja
# 輸出：
#   zh-TW: 142/142 keys covered ✅
#   zh-CN: 138/142 keys covered ⚠️ (missing: ui.gene.unlock, ui.bloodline.awaken, ...)
#   en:    130/142 keys covered ⚠️
#   ja:    125/142 keys covered ⚠️
```

---

## 19. 效能深度優化

> 本章節為 v1.2 新增，針對 `_buildNode` 管線與 runtime 效能的深度分析與改進方案。

### 19.1 現有效能瓶頸分析

#### 瓶頸 A：`_buildNode` 的逐節點串列 await

`_buildNode` 遞迴建構子節點時，每個 child 都是 `await` 串列執行：

```typescript
// 現狀 — 所有 children 串列 await
for (const child of spec.children) {
    await this._buildNode(child, node, effectiveW, effectiveH);
}
```

每個節點的 `buildPanel` / `buildImage` 內部都包含 `await skinResolver.getSpriteFrame()`
（走 `resources.load` 非同步載入），這導致一棵 80 個節點的樹，
會產出 ~80 次串列 async IO。即使每次只花 1~2ms，總計也要 80~160ms。

#### 瓶頸 B：建構後的三次全樹遍歷

`buildScreen` 完成 `_buildNode` 後，還做了三次完整遍歷：

| 遍歷 | 位置 | 目的 |
|------|------|------|
| `clearDynamic()` | line 136-141 | 清除 `{xxx}` 佔位符 |
| `_postBuildAlignWidgets()` | line 352+ | Widget 重新計算 |
| `UITemplateBinder.bind()` | line 147-148 | 掃描 id 建立映射 |

3 次 DFS 在 80 節點的樹上各花 1~3ms，合計 3~9ms。

#### 瓶頸 C：UI 節點從不回收，永遠 `new Node()`

`PoolSystem` 存在且運作良好，但**只用於 VFX**（特效 Prefab、飄字）。
UI 節點從不進入物件池——每次 Tab 切換或重新 buildScreen 時，
舊節點 `removeAllChildren()` + `destroy()`，新節點全部 `new Node()`。

#### 瓶頸 D：`JSON.parse(JSON.stringify())` 深拷貝

`UITemplateResolver._resolveComposeItem()` 每次展開 Widget Fragment 時做一次
`JSON.parse(JSON.stringify(widget.layout))` 深拷貝。對於包含 30+ 個節點的
Widget，每次深拷貝約 0.5~2ms。

#### 瓶頸 E：`Widget.updateAlignment()` 雙重呼叫

`applyWidget()` 在每個節點建構時就呼叫 `widget.updateAlignment()`，
但建構完成後 `_postBuildAlignWidgets()` 又對整棵樹重做一次。
等於每個有 Widget 的節點（通常佔 90% 以上）被 updateAlignment 兩次。

### 19.2 改進方案

#### 方案 A：Sprite 批次預載入（影響最大）

在 `_buildNode` 遞迴之前，先掃描整棵 spec tree 收集所有 skinSlot，
一次性發起所有 `getSpriteFrame` 的非同步載入：

```typescript
async buildScreen(layout: UILayoutSpec, skin: UISkinManifest | null, ...): Promise<Node> {
    // Phase 1：收集所有 skinSlot → 一次性預載入
    const allSlots = this._collectAllSkinSlots(layout.root);
    await this.skinResolver.preloadSlots(allSlots);  // 並行 Promise.all

    // Phase 2：_buildNode 內部的 getSpriteFrame 全部命中快取，變為同步
    const rootNode = await this._buildNode(layout.root, ...);
    ...
}

// UISkinResolver 新增
async preloadSlots(slots: string[]): Promise<void> {
    const unique = [...new Set(slots)];
    await Promise.all(unique.map(slot => this.getSpriteFrame(slot)));
    // 全部載入完畢後，後續 getSpriteFrame 直接走 cache
}
```

**預估效果**：80 次串列 IO → 1 次並行批次，buildScreen 時間從 ~160ms 降至 ~30ms。

#### 方案 B：合併三次遍歷為一次

```typescript
// 將 clearDynamic + bind + postAlign 合併為一次遍歷
private _postBuildPass(node: Node, spec: UILayoutNodeSpec, binder: UITemplateBinder): void {
    // 1. 清除佔位符
    const lbl = node.getComponent(Label);
    if (lbl && /^\{[^}]+\}$/.test(lbl.string)) lbl.string = '';

    // 2. 登記 binder 映射
    if (spec.id) binder.registerNode(spec.id, node);

    // 3. Widget 對齊
    const widget = node.getComponent(Widget);
    if (widget) widget.updateAlignment();

    // 4. 遞迴子節點
    const children = spec.children ?? [];
    for (let i = 0; i < children.length; i++) {
        this._postBuildPass(node.children[i], children[i], binder);
    }
}
```

**預估效果**：3 次遍歷 → 1 次，節省 ~2~6ms。

#### 方案 C：UI 節點物件池

為 `CompositePanel` 的 `lazySlot` 引入節點回收機制：

```typescript
class UINodePool {
    /** 按 fragment ID 分組的閒置節點池 */
    private pools = new Map<string, Node[]>();
    private maxPerFragment = 3;

    /** Tab 切出時：將該 slot 的子樹回收（而非 destroy） */
    recycle(fragmentId: string, rootNode: Node): void {
        rootNode.removeFromParent();
        rootNode.active = false;
        const pool = this.pools.get(fragmentId) ?? [];
        if (pool.length < this.maxPerFragment) {
            pool.push(rootNode);
            this.pools.set(fragmentId, pool);
        } else {
            rootNode.destroyAllChildren();
            rootNode.destroy();
        }
    }

    /** Tab 切入時：優先從池中取出（跳過 buildScreen） */
    acquire(fragmentId: string): Node | null {
        const pool = this.pools.get(fragmentId);
        if (!pool || pool.length === 0) return null;
        const node = pool.pop()!;
        node.active = true;
        return node;
    }
}
```

用法整合到 `switchSlot()`：
```typescript
async switchSlot(slotId: string, fragmentId: string): Promise<void> {
    // 回收舊 fragment
    const oldChild = this._lazySlots.get(slotId)?.currentChild;
    if (oldChild) this._nodePool.recycle(this._lazySlots.get(slotId)!.currentFragmentId, oldChild);

    // 優先從池取出
    const cached = this._nodePool.acquire(fragmentId);
    if (cached) {
        cached.parent = this._lazySlots.get(slotId)!.containerNode;
        this.applyContentState(this._latestState);  // 重新綁定最新資料
        return;
    }

    // 池空時才走 buildScreen
    await this._buildFragment(slotId, fragmentId);
}
```

**預估效果**：Tab 來回切換從 ~30ms（rebuild） → ~1ms（pool reattach + data rebind）。

#### 方案 D：結構化深拷貝取代 JSON.stringify

```typescript
// 替代 JSON.parse(JSON.stringify(...))
function cloneLayoutSpec(spec: UILayoutNodeSpec): UILayoutNodeSpec {
    const clone: UILayoutNodeSpec = { ...spec };
    if (spec.widget) clone.widget = { ...spec.widget };
    if (spec.layout) clone.layout = { ...spec.layout };
    if (spec.skinLayers) clone.skinLayers = spec.skinLayers.map(l => ({ ...l }));
    if (spec.children) clone.children = spec.children.map(c => cloneLayoutSpec(c));
    return clone;
}
```

**預估效果**：深拷貝從 ~1ms 降至 ~0.1ms（避免序列化/反序列化）。

#### 方案 E：延遲 Widget 計算

`applyWidget()` 中移除 `updateAlignment()` 呼叫，只在 `_postBuildPass` 統一執行：

```typescript
applyWidget(node, widgetDef, parentWidth, parentHeight): void {
    // ... 設定 widget 屬性 ...
    // ❌ widget.updateAlignment();  // 移除：等 post-build 統一處理
}
```

**預估效果**：每個有 Widget 的節點省 1 次 layout 計算，總計省 ~3ms。

### 19.3 Draw Call 優化

#### 19.3.1 skinLayers 的自動合批問題

新增 `skinLayers` 後，一個面板會有 3~4 個 Sprite 子節點。
Cocos 2D 的 auto-batch 在**同 atlas + 相鄰兄弟**的條件下才生效。

**建議**：
- 同一個面板的所有 skinLayers 使用**同一張 Auto Atlas**，確保合批
- `composite-image` 的 8 個 layer 同理，全部打包到同一張 Atlas
- 在 `validate-ui-specs.js` 新增 R24 規則：skinLayers 的所有 slot 必須屬於同一 Atlas

#### 19.3.2 渲染順序優化

```typescript
// 在 _postBuildPass 中，將相同 Atlas 的節點調整為相鄰 siblingIndex
// 以最大化 auto-batch 效果
private _optimizeRenderOrder(parent: Node): void {
    const children = [...parent.children];
    children.sort((a, b) => {
        const aAtlas = a.getComponent(Sprite)?.spriteFrame?.texture?.name ?? '';
        const bAtlas = b.getComponent(Sprite)?.spriteFrame?.texture?.name ?? '';
        return aAtlas.localeCompare(bAtlas);
    });
    children.forEach((c, i) => c.setSiblingIndex(i));
}
```

> ⚠️ 此優化只適用於 z-order 無關的平級節點（如 skinLayers 的背景層之間）。
> 對有明確疊加順序的節點（如 composite-image）不可重排。

### 19.4 效能度量與 Budget

#### 19.4.1 buildScreen 效能 Budget

| 指標 | Budget | 當前估算 | 目標 |
|------|--------|----------|------|
| buildScreen 總時間 | ≤ 50ms | ~160ms | 方案 A+B+E → ~25ms |
| 首次 switchSlot 時間 | ≤ 30ms | ~80ms（新建） | 方案 A → ~15ms |
| 重複 switchSlot 時間 | ≤ 5ms | ~80ms（重建） | 方案 C → ~1ms |
| 節點總數（GDO 畫面） | ≤ 35 | ~80 | skinLayers + lazy → ~30 |
| Draw Call（GDO 畫面） | ≤ 15 | ~40 | Atlas 合批 → ~12 |

#### 19.4.2 Runtime 效能監控

在 `UCUFLogger` 新增 `performance` 分類：

```typescript
// CompositePanel.mount() 內部
const t0 = performance.now();
await this.buildScreen(layout, skin, i18n, tokens);
const buildMs = performance.now() - t0;
UCUFLogger.info('performance', `buildScreen "${screenId}" — ${buildMs.toFixed(1)}ms, ${nodeCount} nodes`);

if (buildMs > 50) {
    UCUFLogger.warn('performance', `buildScreen 超過 50ms budget: ${buildMs.toFixed(1)}ms`);
}
```

---

## 20. 補充建議：架構治理與長期演進

### 20.1 記憶體管理補充：`onAssetEvicted` 的實際接線

現有 `MemoryManager.onAssetEvicted` hook 在文件中描述了接線方式，
但實際程式碼中 `ResourceManager` **沒有 `forceRelease` 方法**。
目前 `releaseAsset()` 只做 `decRef()` + 刪除快取 entry，
不會呼叫 Cocos 的 `assetManager.releaseAsset()`。

**建議**：在 `ResourceManager` 新增真正的硬釋放方法：

```typescript
// ResourceManager 新增
public forceRelease(key: string, bundle: string): void {
    this.releaseAsset(key);
    // 真正呼叫 Cocos 的底層釋放
    const bundleObj = assetManager.getBundle(bundle) ?? resources;
    const asset = bundleObj?.get(key);
    if (asset) {
        assetManager.releaseAsset(asset);
    }
}
```

並在 `ServiceLoader.initialize()` 接線：

```typescript
this.memory.onAssetEvicted = (key, bundle) => {
    this.resource.forceRelease(key, bundle);
};
```

### 20.2 記憶體管理補充：ResourceManager 快取無上限

目前 `ResourceManager` 的五個 Map 快取全部無上限：

```typescript
private jsonCache = new Map<string, JsonAsset>();         // 無限增長
private prefabCache = new Map<string, Prefab>();           // 無限增長
private spriteFrameCache = new Map<string, SpriteFrame[]>(); // 無限增長
private singleSpriteFrameCache = new Map<string, SpriteFrame>(); // 無限增長
private fontCache = new Map<string, Font>();                // 無限增長
```

`MemoryManager` 有 LRU buffer（上限 50），但這只管帳目——
`ResourceManager` 的 Map 中 **被 LRU 逐出的資源仍然留在快取裡**，
因為 `notifyReleased` 只是記帳，不會觸發 `ResourceManager.releaseAsset()`。

**建議**：讓 `MemoryManager.onAssetEvicted` 回調真正清理 `ResourceManager` 的 Map。
這是讓整條記憶體管線真正閉環的關鍵接線。

### 20.3 CompositePanel 的 scope 自動管理

每個 `CompositePanel` 應自動為自己的資源建立一個 scope：

```typescript
// CompositePanel 內部
private get _memoryScope(): string {
    return `ucuf:${this.screenSpec.id}`;
}

protected async loadAssetTracked<T>(path: string, loader: (p: string) => Promise<T>): Promise<T> {
    this._loadedAssetPaths.add(path);
    services().memory.notifyLoaded(path, 'resources', 'auto', this._memoryScope);
    return loader(path);
}

dispose(): void {
    // 一鍵釋放整個 panel 的所有資源
    services().memory.releaseByScope(this._memoryScope);
    // ...
}
```

這比逐條 `releaseAsset` 更安全，也與 `MemoryManager` 的 scope 機制完美整合。

### 20.4 Fragment JSON 快取層

目前每次 `switchSlot()` 都會重新 `resources.load` Fragment JSON。
應在 `UISpecLoader` 加入 Fragment 快取：

```typescript
// UISpecLoader 新增
private _fragmentCache = new Map<string, UILayoutSpec>();

async loadFragment(fragmentId: string): Promise<UILayoutSpec> {
    const cached = this._fragmentCache.get(fragmentId);
    if (cached) return cached;
    const layout = await this._loadLayout(fragmentId);
    this._fragmentCache.set(fragmentId, layout);
    return layout;
}

clearFragmentCache(): void {
    this._fragmentCache.clear();
}
```

### 20.5 ChildPanel 的 diff-update 而非全量重建

目前計畫中 `ChildPanelBase.onDataUpdate()` 是由子類自行決定更新策略。
應在 Base 層面提供**淺比對 + 差異更新**的標準化框架：

```typescript
abstract class ChildPanelBase {
    private _prevData: Record<string, unknown> | null = null;

    /** 由 CompositePanel 呼叫 */
    _internalDataUpdate(data: Record<string, unknown>): void {
        const changes = this._diffData(this._prevData, data);
        if (changes.length === 0) return; // 資料沒變，跳過
        this._prevData = { ...data };
        this.onDataUpdate(data, changes);
    }

    /** 子類覆寫：只處理有變化的欄位 */
    abstract onDataUpdate(data: Record<string, unknown>, changedKeys: string[]): void;

    private _diffData(
        prev: Record<string, unknown> | null,
        next: Record<string, unknown>
    ): string[] {
        if (!prev) return Object.keys(next);
        const changed: string[] = [];
        for (const key of Object.keys(next)) {
            if (prev[key] !== next[key]) changed.push(key);
        }
        return changed;
    }
}
```

**效果**：切換武將時，如果某些 Tab 的資料欄位沒有變化（如同陣營武將的
aptitude 結構相同），可以完全跳過渲染更新。

### 20.6 Event / 回調解耦建議

目前 `CompositePanel` 直接持有 `childPanels` Map 並逐個呼叫方法。
當 ChildPanel 數量增加或嵌套加深時，這種直接依賴會變得難以維護。

**建議**：引入輕量事件匯流排（可直接復用既有的 `EventSystem`）：

```typescript
// CompositePanel 廣播資料更新
this.emit('content-state-changed', newState);

// 每個 ChildPanel 在 onMount 時訂閱
this.host.on('content-state-changed', (state) => {
    const myData = state[this.dataSource];
    if (myData) this._internalDataUpdate(myData);
});
```

好處：新增 ChildPanel 類型時不需要修改 `CompositePanel` 的分發邏輯。

### 20.7 動畫與過渡效果標準化

計畫中沒有涉及 Tab 切換動畫和 Panel 開關過渡。目前 `UIManager` 有 `transition` 支援
（`DEFAULT_TRANSITION` 定義了 `fadeIn` / `fadeOut`），但 `CompositePanel` 的 `switchSlot` 是瞬切。

**建議**：在 `switchSlot` 中加入可配置的過渡效果：

```json
// Screen JSON 中定義
{
  "tabRouting": {
    "Basics": {
      "slotId": "TabContentSlot",
      "fragment": "fragments/layouts/tab-basics",
      "transition": { "type": "crossFade", "duration": 0.15 }
    }
  }
}
```

### 20.8 熱更新安全性

UI spec JSON 作為純資料，天然支援熱更新（Cocos 的 Hot Update）。
但需要確保：

1. **版本相容性**：spec JSON 加入 `specVersion` 欄位，`CompositePanel.mount()` 時驗證
2. **降級處理**：若 spec version > 引擎支援的最高版本，顯示降級 UI 而非 crash
3. **Fragment 獨立熱更**：每個 Fragment 可以獨立打成 subpackage，支援按需下載

---

## 21. 新 UI 開發標準化流程

### 21.1 Spec-First 開發原則

所有新 UI 畫面的開發**必須以 JSON Spec 為起點**，禁止先寫 TypeScript 再補 Spec。

```
正確順序：
  Screen JSON → Layout JSON → Skin JSON → Content Contract Schema
  → scaffold-ui-component.js 生成 Panel 骨架
  → 開發者/Agent 在骨架上填充業務邏輯

禁止順序：
  ❌ 直接寫 Panel.ts → 手動建節點 → 事後補 JSON
```

### 21.2 scaffold-ui-component.js v2 升級

現有的 `scaffold-ui-component.js` 已支援從 Screen Spec 生成 Panel 骨架，
但產出的程式碼繼承 `UIPreviewBuilder`。UCUF 升級後需要：

#### 21.2.1 新增 `--ucuf` 模式

```bash
# 產出繼承 CompositePanel 的骨架（UCUF 模式）
node tools_node/scaffold-ui-component.js --screen my-screen --ucuf

# 舊模式（向後相容）
node tools_node/scaffold-ui-component.js --screen my-screen --family detail-split
```

`--ucuf` 模式自動產出：

```
assets/scripts/ui/components/MyScreenPanel.ts        ← 繼承 CompositePanel
assets/resources/ui-spec/layouts/my-screen-main.json  ← 帶 lazySlot 的 Layout 骨架
assets/resources/ui-spec/screens/my-screen-screen.json ← 帶 tabRouting 的 Screen 骨架
assets/resources/ui-spec/contracts/my-screen-content.schema.json ← Content Contract 骨架
```

#### 21.2.2 目錄結構強制規範

每個 UCUF 畫面遵循統一的目錄佈局：

```
assets/resources/ui-spec/
├── layouts/
│   └── my-screen-main.json         ← 主 Layout
├── fragments/layouts/
│   ├── my-screen-tab-a.json        ← Tab Fragment A
│   └── my-screen-tab-b.json        ← Tab Fragment B
├── skins/
│   └── my-screen-default.json      ← 預設 Skin
├── screens/
│   └── my-screen-screen.json       ← Screen 組裝單元
└── contracts/
    └── my-screen-content.schema.json ← Content Contract

assets/scripts/ui/components/
└── MyScreenPanel.ts                 ← Panel 實作（繼承 CompositePanel）
```

#### 21.2.3 骨架模板生成的 CompositePanel

```typescript
// tools_node/templates/composite-panel.template.ts（新增）
import { _decorator } from 'cc';
import { CompositePanel } from '../core/CompositePanel';
import type { UITemplateBinder } from '../core/UITemplateBinder';

const { ccclass } = _decorator;

@ccclass('{{PanelClassName}}')
export class {{PanelClassName}} extends CompositePanel {

    private static readonly SCREEN_ID = '{{screenId}}';

    async show(data?: Record<string, unknown>): Promise<void> {
        await this.mount({{PanelClassName}}.SCREEN_ID);
        if (data) this.applyContentState(data);
    }

    protected override buildContentState(rawData: unknown): Record<string, unknown> {
        // TODO: 實作 raw data → content state 映射
        return rawData as Record<string, unknown>;
    }
}
```

### 21.3 Content Contract 強制生成

`scaffold-ui-component.js --ucuf` 自動掃描 Layout JSON 中的所有 `child-panel` 節點，
提取 `dataSource` 欄位，自動生成 Content Contract 骨架：

```json
// 自動產出的 contracts/my-screen-content.schema.json
{
  "schemaId": "my-screen-content",
  "familyId": "composite",
  "version": 1,
  "description": "由 scaffold-ui-component.js 自動產生 — 請補充欄位描述",
  "fields": {
    "basicAttributes": {
      "type": "array",
      "required": true,
      "description": "TODO: 補充說明",
      "bindPath": "BasicInfoPanel"
    },
    "skillList": {
      "type": "array",
      "required": true,
      "description": "TODO: 補充說明",
      "bindPath": "SkillGrid"
    }
  },
  "requiredFields": ["basicAttributes", "skillList"]
}
```

### 21.4 外觀與邏輯分離的強制執行

#### 21.4.1 CI Lint 規則

`validate-ui-specs.js` 新增規則：

| 規則 | 說明 | 嚴重度 |
|------|------|--------|
| R25 | 新增的 Panel `.ts` 必須繼承 `CompositePanel`（掃描 `extends` 關鍵字） | error |
| R26 | Panel `.ts` 中禁止直接 `import { Sprite, Label } from 'cc'`（外觀操作應透過 ChildPanel） | warning |
| R27 | Layout JSON 中的 `child-panel` 必須有對應的 `dataSource`（確保資料驅動） | error |
| R28 | Screen JSON 必須有 `contentRequirements`（確保 Content Contract 存在） | warning |

#### 21.4.2 Pre-commit Hook

```bash
# .github/hooks/scripts/pre-commit-ucuf.js
# 在 git commit 時自動執行
node tools_node/validate-ui-specs.js --strict --check-content-contract --rules R25,R26,R27,R28
```

### 21.5 UCUF 任務卡撰寫規則

> 完整模板見 `docs/agent-briefs/UCUF-task-card-template.md (doc_task_0131)` (doc_task_0131)。
> 以下規則適用於所有人類與 Agent 開出的 UCUF 相關任務卡。

#### 21.5.1 任務卡結構：Frontmatter 五區塊 + 本文四 section

每張 UCUF 任務卡必須包含：

**Frontmatter（YAML）**

| 區塊 | 內容 | 不可空白欄位 |
|------|------|-------------|
| A — 基本資訊 | id, priority, phase, type, status | id, type, status |
| B — UCUF 架構約束 | screen_id, fragments_owned, content_contract_schema, data_sources_owned, child_panels, skin_layers_used, atlas_group | screen_id, content_contract_schema, data_sources_owned, child_panels（≥1 entry） |
| C — 驗證與品質門檻 | smoke_route, verification_commands, perf_budget, acceptance | smoke_route, verification_commands（≥1 含 validate-ui-specs.js） |
| D — 交付物與文件回寫 | deliverables, docs_backwritten, shard_file | deliverables |
| E — 執行紀錄 | started_at, started_by_agent, completed_at, notes | 開工前可空白，開工後必填 |

**Markdown 本文**

| section | 內容 | 撰寫規則 |
|---------|------|----------|
| 背景 | 為什麼需要這張卡 + 做完改善什麼 | 2~5 句話，引用 plan.md 章節號 |
| 實作清單 | checklist 條列程式碼變更 | 每條必須標明**檔案路徑**和**動作**（新增/修改/刪除/搬移） |
| 驗收條件 | boolean 通過條件 | 不可模糊（❌「畫面看起來正確」→ ✅「截圖 diff ≤ 2%」） |
| 結案檢查清單 | Agent 完成後逐條確認 | 固定 9 條，見模板 |

#### 21.5.2 十條撰寫規則

| 規則 | 說明 |
|------|------|
| **R-TC-01** | `type` 必須從分類表中選取（composite-panel / fragment-develop / child-panel-type / skin-layer-work / content-contract / mapper-logic / migration / performance / tooling / architecture） |
| **R-TC-02** | `parent_panel` 必須為 `CompositePanel`（禁止繼承 UIPreviewBuilder） |
| **R-TC-03** | `fragments_owned` 中的每個 Fragment 必須在 `deliverables` 中有對應條目 |
| **R-TC-04** | `data_sources_owned` 中的每個 dataSource 必須在 `child_panels` 中有對應 entry |
| **R-TC-05** | `verification_commands` 至少包含 `validate-ui-specs.js --strict --check-content-contract` |
| **R-TC-06** | `acceptance` 中的每個條件必須可量化（數值閾值 / 工具輸出 PASS/FAIL） |
| **R-TC-07** | `perf_budget` 的值不可超過 plan.md §19.4.1 的上限（build ≤50ms / slot ≤30ms / cached ≤5ms / nodes ≤35 / draws ≤15） |
| **R-TC-08** | 若 `type=architecture`，必須在開卡時鎖定 `UCUF-CORE-*` 獨佔鎖，並在 `notes` 中記錄鎖名 |
| **R-TC-09** | 實作清單中每個**新增**的 JSON spec 檔案，必須標明預期節點數上限 |
| **R-TC-10** | 結案檢查清單不可刪減模板中的 9 條，可新增但不可省略 |

#### 21.5.3 卡片驗證工具

```bash
# 驗證任務卡的 Frontmatter 完整性
node tools_node/validate-ucuf-task-card.js --card docs/agent-briefs/tasks/UCUF-XXXX.md
# 輸出：
#   ✅ Section A: 完整
#   ❌ Section B: data_sources_owned 為空 — 違反 R-TC-04
#   ✅ Section C: 完整
#   ⚠️ Section D: docs_backwritten 為空 — 建議補充
```

---

## 22. Agent 規則自動遵循機制

### 22.1 Agent 指令集架構

將 UCUF 的架構規範轉化為三層 Agent 可讀指令：

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Path-Specific Instructions（自動載入）          │
│  .github/instructions/ucuf-compliance.instructions.md   │
│  applyTo: "assets/scripts/ui/**,assets/resources/ui-spec/**" │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Workflow Definitions（Agent 主動執行）          │
│  .agents/workflows/ucuf-develop.md                      │
│  .agents/workflows/ucuf-verify.md                       │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Skill Definition（按需載入）                    │
│  .agents/skills/ui-vibe-pipeline/SKILL.md (doc_agentskill_0008)（已存在，需更新）│
└─────────────────────────────────────────────────────────┘
```

### 22.2 ucuf-compliance.instructions.md（新增）

```markdown
---
applyTo: "assets/scripts/ui/**,assets/resources/ui-spec/**"
---

# UCUF 架構合規指令

## 硬性規則（Agent 必須遵守）

1. **所有新 UI Panel 必須繼承 CompositePanel**，禁止直接繼承 UIPreviewBuilder。
2. **禁止在 Panel 中直接 import Cocos 渲染元件**（Sprite, Label, ScrollView 等）。
   若需渲染操作，必須透過 ChildPanel 子類或 INodeFactory 介面。
3. **Layout JSON 中禁止同一 parent 下 3+ 個同 widget 的兄弟節點**（RT-05 / R19）。
   使用 skinLayers 取代 Fill/Bleed/Frame 疊加模式。
4. **單一 Layout JSON 節點數上限 50 個**（R21）。超過須拆 Fragment。
5. **所有可見文字必須來自 content state**，禁止寫死中文或數值（§17 規範）。
6. **新增 ChildPanel 必須實作 validateDataFormat()**（§17.5 規範）。

## 效能 Budget（§19 規範）

| 指標 | Budget |
|------|--------|
| buildScreen 總時間 | ≤ 50ms |
| switchSlot（首次） | ≤ 30ms |
| switchSlot（重訪） | ≤ 5ms |
| 節點數（單一畫面） | ≤ 35 |
| Draw Call（單一畫面） | ≤ 15 |

## 提交前必跑指令

```bash
# 1. 靜態 spec 驗證
node tools_node/validate-ui-specs.js --strict --check-content-contract

# 2. Runtime 規則檢查（若有 preview 環境）
node tools_node/ucuf-runtime-check.js --screen <screen-id>

# 3. 編碼檢查
node tools_node/check-encoding-touched.js <changed-files...>
```
```

### 22.3 ucuf-develop.md workflow（新增）

```markdown
---
description: UCUF 標準化新 UI 開發流程 — 從 Spec 到驗證的完整管線
---

# UCUF 開發流程

## 使用時機
- 開發新的 UI 畫面時
- 將既有畫面遷移至 UCUF 架構時

## 步驟

### Phase 1: Spec 建立
1. 執行脚手架：
   ```bash
   node tools_node/scaffold-ui-component.js --screen <id> --ucuf --dry-run
   ```
2. 確認產出結構正確後正式執行（去掉 `--dry-run`）
3. 編輯 Content Contract Schema，補充欄位描述

### Phase 2: Layout & Fragment 撰寫
4. 在主 Layout JSON 中定義結構，使用 `lazySlot` 和 `skinLayers`
5. 將每個 Tab 的內容拆成獨立 Fragment
6. 在 Screen JSON 中定義 `tabRouting`

### Phase 3: 業務邏輯
7. 在 Panel.ts 的 `buildContentState()` 實作資料映射
8. 如需自訂 ChildPanel，繼承 ChildPanelBase 並註冊到 Registry

### Phase 4: 驗證
9. 靜態驗證：
   ```bash
   node tools_node/validate-ui-specs.js --strict --check-content-contract
   ```
10. Runtime 驗證（需 preview 環境）：
    ```bash
    node tools_node/ucuf-runtime-check.js --screen <id>
    ```
11. 截圖回歸（若有 baseline）：
    ```bash
    node tools_node/ucuf-screenshot-regression.js --screens <id>
    ```
```

### 22.4 門檻檢查（Gatekeeping）機制

#### 22.4.1 Agent Pre-Submit Gate

在 Agent 完成任務前，必須通過以下 gate 檢查：

```typescript
// 概念：整合到 finalize-agent-turn.js
interface UCUFGateResult {
    passed: boolean;
    gates: {
        specValidation: { passed: boolean; errors: string[] };
        runtimeRules:   { passed: boolean; violations: RuleViolation[] };
        contentContract:{ passed: boolean; mismatches: BindingMismatch[] };
        performanceBudget: { passed: boolean; overBudget: string[] };
    };
}
```

#### 22.4.2 finalize-agent-turn.js 整合

```bash
# 現有的 finalize-agent-turn.js 擴充 UCUF gate
node tools_node/finalize-agent-turn.js --workflow ucuf-develop

# 內部自動執行：
# 1. validate-ui-specs.js --strict --check-content-contract
# 2. ucuf-runtime-check.js --changed（只檢查有修改的 screen）
# 3. check-encoding-touched.js
# 4. 若任一 gate 失敗 → 輸出 FAIL + 具體修正建議 → Agent 必須修復後才能結束任務
```

#### 22.4.3 Gate 輸出格式

```
╔══════════════════════════════════════════════════╗
║          UCUF Pre-Submit Gate Report              ║
╠══════════════════════════════════════════════════╣
║ ✅ Spec Validation       : PASS (0 errors)       ║
║ ❌ Runtime Rules         : FAIL (2 violations)   ║
║    RT-05: FooterPanel — 同位置兄弟節點           ║
║    RT-07: SkillGrid — config 缺少 cellSize       ║
║ ✅ Content Contract      : PASS                  ║
║ ⚠️  Performance Budget   : WARN                  ║
║    buildScreen: 62ms (budget: 50ms)              ║
╠══════════════════════════════════════════════════╣
║ 結果: FAIL — 請修正 RT-05, RT-07 後重新提交       ║
╚══════════════════════════════════════════════════╝
```

---

## 23. 多 Agent 並行開發衝突防範

### 23.1 Fragment-Based 任務分片策略

UCUF 的「1 Screen + N Fragment」架構天然支援任務分片——
每個 Fragment 是獨立的 JSON 檔案，對應獨立的 ChildPanel 邏輯，
可以分配給不同的 Agent 同時開發。

#### 23.1.1 分片維度

```
任務分片（Sharding）維度：
┌────────────────────────────────────┬───────────────────────────────┐
│ 維度 A：Layout Fragment            │ 維度 B：業務邏輯               │
│ 修改 JSON spec 結構               │ 修改 TypeScript 映射 / 資料流  │
│ 鎖定範圍：單一 fragment JSON       │ 鎖定範圍：單一 Mapper/Panel ts │
├────────────────────────────────────┼───────────────────────────────┤
│ 維度 C：Skin / 視覺               │ 維度 D：Content Contract       │
│ 修改 skin JSON + 圖片資源         │ 修改 contract schema JSON      │
│ 鎖定範圍：skin JSON + sprites/    │ 鎖定範圍：contract schema JSON │
└────────────────────────────────────┴───────────────────────────────┘
```

#### 23.1.2 並行安全矩陣

| Agent A 工作 | Agent B 工作 | 衝突風險 | 防範方式 |
|-------------|-------------|----------|----------|
| tab-basics.json | tab-stats.json | ✅ 無衝突 | 不同 Fragment，自然隔離 |
| tab-basics.json | BasicInfoMapper.ts | ⚠️ 低風險 | Content Contract 為解耦點 |
| main-layout.json | tab-basics.json | ⚠️ 中風險 | `$ref` 引用可能受影響；Agent A 須通知 |
| main-layout.json | my-screen-default.json | ⚠️ 中風險 | skinSlot 名稱為契約；改名須同步 |
| BasicInfoMapper.ts | StatsMapper.ts | ✅ 無衝突 | 不同 ChildPanel，不同 dataSource |
| CompositePanel.ts | 任何 Fragment | 🔴 高風險 | 核心架構修改須獨佔鎖 |

### 23.2 Content Contract 作為解耦點

Content Contract 是 Fragment 開發者和業務邏輯開發者之間的**唯一契約邊界**：

```
Fragment 開發者（Agent A）         業務邏輯開發者（Agent B）
    │                                     │
    │  在 Layout JSON 中宣告               │  在 Mapper.ts 中產出
    │  dataSource: "basicAttributes"      │  basicAttributes: [...]
    │          │                           │         │
    │          └──────── Content Contract ──────────┘
    │                   (schema JSON)
    │
    │  Fragment 開發者只需確保：           │  Mapper 開發者只需確保：
    │  - dataSource 名稱與 contract 一致   │  - 回傳的資料格式符合 contract
    │  - ChildPanel config 完整            │  - 不遺漏 required fields
    │  → 不需要知道 Mapper 內部實作        │  → 不需要知道 Layout 結構
```

#### 23.2.1 Contract-First 開發流程

```
Step 1: 人類/Lead Agent 定義 Content Contract Schema
        → contracts/my-screen-content.schema.json
        → commit 到 main branch

Step 2: 分發任務
        → Agent A：依 contract 開發 Layout + Fragment（只關心結構 + dataSource）
        → Agent B：依 contract 開發 Mapper + 業務邏輯（只關心資料格式）

Step 3: 整合
        → 兩邊都通過 validate-ui-specs.js --check-content-contract
        → 自動驗證 contract 兩端是否對齊
```

### 23.3 檔案鎖定整合

利用既有的 `task-lock.js` 機制，擴充 UCUF 專屬的鎖定粒度：

```bash
# Agent 開工前鎖定 Fragment
node tools_node/task-lock.js lock UCUF-TAB-BASICS agent1

# 查詢鎖定狀態
node tools_node/task-lock.js list --prefix UCUF-
# 輸出：
#   UCUF-TAB-BASICS      : locked by agent1 since 2026-04-12T10:30:00
#   UCUF-TAB-STATS       : unlocked
#   UCUF-MAIN-LAYOUT     : locked by agent2 since 2026-04-12T10:32:00
#   UCUF-CORE-COMPOSITE  : unlocked (核心架構 — 需獨佔鎖)

# Agent 收工後解鎖
node tools_node/task-lock.js unlock UCUF-TAB-BASICS agent1
```

### 23.4 衝突偵測 CLI

```bash
# 新增工具：偵測兩個 Agent 的修改是否存在 UCUF 衝突
node tools_node/ucuf-conflict-detect.js --agent1-changes file1.json,file2.ts --agent2-changes file3.json,file4.ts
# 輸出：
#   ✅ 無 skinSlot 名稱衝突
#   ✅ 無 dataSource 名稱衝突
#   ⚠️ 兩者都修改了 main-layout.json 的 tabRouting — 需人工合併
```

---

## 24. 動態規則注入與回饋閉環

### 24.1 Rule Registry 設計

建立一套機器可讀的規則註冊表，允許 Agent 在發現新問題時**動態新增規則**，
並自動同步到診斷、日誌、測試三個層次。

```typescript
// assets/scripts/ui/core/UCUFRuleRegistry.ts
interface UCUFRule {
    /** 規則 ID，如 'RT-11' */
    id: string;
    /** 規則名稱 */
    name: string;
    /** 規則描述 */
    description: string;
    /** 嚴重度 */
    severity: 'error' | 'warning' | 'info';
    /** 適用範圍 */
    scope: 'static' | 'runtime' | 'both';
    /** 規則分類（對應 UCUFLogger 的 LogCategory） */
    category: LogCategory;
    /** 檢查函式（runtime 規則） */
    check?: (panel: CompositePanel) => RuleViolation[];
    /** 靜態檢查函式（供 validate-ui-specs.js 使用） */
    staticCheck?: (spec: UILayoutNodeSpec) => RuleViolation[];
    /** 建議的自動修正方案（可選） */
    autoFix?: string;
    /** 新增此規則的來源（Agent ID 或人類） */
    addedBy: string;
    /** 新增時間 */
    addedAt: string;
}

class UCUFRuleRegistry {
    private static _rules = new Map<string, UCUFRule>();
    private static _listeners: Array<(rule: UCUFRule) => void> = [];

    /** 註冊新規則 */
    static register(rule: UCUFRule): void {
        if (this._rules.has(rule.id)) {
            UCUFLogger.warn('diagnostic', `規則 ${rule.id} 已存在，將被覆蓋`);
        }
        this._rules.set(rule.id, rule);
        // 通知所有監聽者（自動同步到三個層次）
        for (const listener of this._listeners) {
            listener(rule);
        }
        UCUFLogger.info('diagnostic', `新規則已註冊: ${rule.id} — ${rule.name} [by ${rule.addedBy}]`);
    }

    /** 訂閱新規則事件 */
    static onRuleAdded(fn: (rule: UCUFRule) => void): void {
        this._listeners.push(fn);
    }

    /** 取得所有已註冊規則 */
    static getAllRules(): UCUFRule[] {
        return [...this._rules.values()];
    }

    /** 依 scope 過濾規則 */
    static getRulesByScope(scope: 'static' | 'runtime'): UCUFRule[] {
        return this.getAllRules().filter(r => r.scope === scope || r.scope === 'both');
    }
}
```

### 24.2 規則自動同步到三個層次

#### (A) 自我診斷自動擴充

`RuntimeRuleChecker` 在初始化時訂閱 `UCUFRuleRegistry.onRuleAdded`：

```typescript
class RuntimeRuleChecker {
    constructor() {
        // 自動加入動態新增的 runtime 規則
        UCUFRuleRegistry.onRuleAdded((rule) => {
            if (rule.check && (rule.scope === 'runtime' || rule.scope === 'both')) {
                this._dynamicChecks.push(rule);
                UCUFLogger.debug('diagnostic', `RuntimeRuleChecker 已加入動態規則: ${rule.id}`);
            }
        });
    }

    check(panel: CompositePanel): RuleViolation[] {
        const violations: RuleViolation[] = [];
        // 內建規則 RT-01 ~ RT-10
        violations.push(...this._checkBuiltinRules(panel));
        // 動態規則
        for (const rule of this._dynamicChecks) {
            violations.push(...rule.check!(panel));
        }
        return violations;
    }
}
```

#### (B) 日誌系統自動擴充

新規則的 `category` 自動作為 `UCUFLogger` 的分類標籤：

```typescript
// UCUFRuleRegistry.register() 內部
UCUFRuleRegistry.onRuleAdded((rule) => {
    // 自動啟用該 category 的 debug 日誌
    UCUFLogger.enableCategory(rule.category, true);
});
```

#### (C) 自動測試骨架生成

```bash
# Agent 註冊新規則後，自動生成測試骨架
node tools_node/ucuf-gen-rule-test.js --rule-id RT-11

# 產出：tests/ucuf/rules/RT-11.test.ts
# 內容：
#   describe('RT-11: <rule.name>', () => {
#       it('應偵測違規情況', () => { ... });
#       it('合規情況應通過', () => { ... });
#   });
```

### 24.3 Agent 動態新增規則的工作流

當 Agent 在開發過程中發現新的效能瓶頸或禁止模式：

```
Step 1: Agent 識別問題
        → 例：發現 composite-image 的 layers 中有重複的 skinSlot

Step 2: Agent 建立規則定義
        → 呼叫 UCUFRuleRegistry.register({
              id: 'RT-11',
              name: 'composite-image-duplicate-slot',
              description: 'composite-image 的 layers 中不允許重複的 skinSlot',
              severity: 'warning',
              scope: 'both',
              category: 'skin',
              check: (panel) => { ... },
              addedBy: 'agent1',
              addedAt: '2026-04-12T15:30:00',
          })

Step 3: 自動同步
        → RuntimeRuleChecker 立即具備偵測能力
        → UCUFLogger 啟用 'skin' category
        → ucuf-gen-rule-test.js 產出測試骨架

Step 4: Agent 將規則持久化
        → 寫入 assets/resources/ui-spec/ucuf-rules-registry.json
```

### 24.4 規則持久化格式

```json
// assets/resources/ui-spec/ucuf-rules-registry.json
{
  "version": 1,
  "rules": [
    {
      "id": "RT-11",
      "name": "composite-image-duplicate-slot",
      "description": "composite-image 的 layers 中不允許重複的 skinSlot",
      "severity": "warning",
      "scope": "both",
      "category": "skin",
      "checkModule": "rules/RT-11-check",
      "addedBy": "agent1",
      "addedAt": "2026-04-12T15:30:00"
    }
  ]
}
```

`RuntimeRuleChecker` 在初始化時讀取此 JSON，`import()` 動態載入 `checkModule`。

### 24.5 回饋閉環視覺化

```
Agent 發現問題
      │
      ▼
UCUFRuleRegistry.register()
      │
      ├──► (A) RuntimeRuleChecker 自動擴充 → 下次 mount() 時自動偵測
      │
      ├──► (B) UCUFLogger 啟用新 category → 相關日誌自動輸出
      │
      ├──► (C) ucuf-gen-rule-test.js → 測試骨架自動生成
      │
      └──► (D) ucuf-rules-registry.json → 持久化供所有 Agent 共用
              │
              ▼
      下一個 Agent 入場 → 自動載入所有動態規則
              │
              ▼
      finalize-agent-turn.js → Gate 檢查包含所有動態規則
```

### 24.6 規則生命週期管理

| 狀態 | 說明 | 轉換條件 |
|------|------|----------|
| `draft` | Agent 新增的規則，尚未經人類審核 | Agent 呼叫 `register()` |
| `active` | 人類審核通過，正式啟用 | 人類在 JSON 中標記 `"status": "active"` |
| `deprecated` | 規則已不適用 | 架構演進導致規則過時 |
| `removed` | 已從 registry 移除 | 人類手動刪除 |

Agent 新增的規則預設為 `draft` 狀態。`draft` 規則在 runtime 中以 `info`
而非 `warning` 或 `error` 級別觸發，避免誤攔阻開發流程。
人類審核後改為 `active` 才會以原始 severity 觸發。

---

## 25. 實施里程碑

### M1: Foundation（預估 3 天）

- [ ] 實作 `skinLayers` 屬性解析（修改 `UIPreviewBuilder._buildNode`）
- [ ] 實作 `composite-image` 節點類型
- [ ] 新增 R19~R23 lint 規則
- [ ] 單元測試：skinLayers 建構正確性

### M2: CompositePanel Core（預估 4 天）

- [ ] 實作 `CompositePanel` 抽象類
- [ ] 實作 `lazySlot` 延遲載入機制
- [ ] 實作 `tabRouting` Tab 路由表
- [ ] 實作 `ChildPanelBase` 抽象基類
- [ ] 實作 `AttributePanel`（最簡單的 ChildPanel，作為驗證）
- [ ] 整合 `UIManager` 自動註冊

### M3: ChildPanel 家族（預估 5 天）

- [ ] 實作 `GridPanel`
- [ ] 實作 `ScrollListPanel`（含虛擬列表）
- [ ] 實作 `RadarChartPanel`
- [ ] 實作 `EditableTextPanel`
- [ ] 實作 `ICompositeRenderer` 介面 + Cocos 實作
- [ ] 更新 Unity stub

### M4: GeneralDetailOverview 遷移（預估 4 天）

- [ ] Phase A：建立統一 Layout JSON + 7 個 Tab Fragment
- [ ] Phase B：建立 `GeneralDetailComposite`
- [ ] Phase C：遷移 `GeneralConfig` 映射邏輯
- [ ] Phase D：截圖對比驗證 + 舊代碼移入 `_deprecated/`
- [ ] 效能 benchmark（節點數、buildScreen 耗時）

### M5: 穩定性與可維護性基礎建設（預估 5 天）

- [ ] 實作 `UCUFLogger`（§13）— 分級分類日誌系統
- [ ] 實作 `RuntimeRuleChecker`（§14）— RT-01~RT-10 runtime 診斷
- [ ] 實作 `DataBindingValidator`（§17）— 資料綁定驗證 + 衝突偵測
- [ ] 實作 `CompositePanel.dispose()` + 資源追蹤器（§16）
- [ ] 整合 `UIManager.onSceneWillChange()` 強制卸載（§16.4）
- [ ] `UIPreviewDiagnostics` 全面遷移至 `UCUFLogger` 委託

### M6: 資源管理與測試框架（預估 4 天）

- [ ] 實作 `AssetRegistryEntry` 靜態收集 + 動態登記（§12）
- [ ] 實作 `collect-asset-registry.js` + `audit-asset-usage.js` CLI 工具（§12.5）
- [ ] 建立 Layer 1 單元測試框架 + 核心測試案例（§15.2）
- [ ] 建立 Layer 2 元件測試（AttributePanel + GridPanel）（§15.3）
- [ ] 建立 `ucuf-screenshot-regression.js` 截圖回歸工具（§15.4）

### M7: I18n 統籌 + 資料驅動強化（預估 3 天）

- [ ] `CompositePanel` 語系自動注入 + `onLocaleChanged` 監聽（§18.2）
- [ ] `ChildPanelBase.t()` helper + `_refreshLabels()` 批次更新（§18.3 + §18.5）
- [ ] 局部覆寫（`localeOverride`）機制（§18.4）
- [ ] `validate-i18n-coverage.js` CLI 工具（§18.6）
- [ ] `ChildPanelBase.validateDataFormat()` 子類全面實作（§17.5）

### M8: 效能深度優化（預估 4 天）

- [ ] 方案 A：`UISkinResolver.preloadSlots()` 批次預載入（§19.2 A）
- [ ] 方案 B：合併 `clearDynamic` + `bind` + `postAlign` 為單一 `_postBuildPass`（§19.2 B）
- [ ] 方案 C：`UINodePool` 節點回收機制 + `switchSlot` 整合（§19.2 C）
- [ ] 方案 D：`cloneLayoutSpec` 結構化深拷貝取代 `JSON.stringify`（§19.2 D）
- [ ] 方案 E：延遲 Widget 計算（§19.2 E）
- [ ] skinLayers Atlas 合批 R24 規則（§19.3.1）
- [ ] buildScreen 效能 budget 監控 + `UCUFLogger.performance` 分類（§19.4.2）
- [ ] `ResourceManager.forceRelease()` 接線 + 快取閉環（§20.1 + §20.2）

### M9: 架構治理完善（預估 3 天）

- [ ] `CompositePanel` scope 自動管理（§20.3）
- [ ] Fragment JSON 快取層（§20.4）
- [ ] `ChildPanelBase` diff-update 框架（§20.5）
- [ ] 事件匯流排解耦（§20.6）
- [ ] switchSlot 過渡動畫標準化（§20.7）
- [ ] spec JSON `specVersion` 相容性驗證（§20.8）

### M10: 標準化流程與 Scaffold v2（預估 3 天）

- [ ] `scaffold-ui-component.js` 新增 `--ucuf` 模式（§21.2）
- [ ] 新增 `composite-panel.template.ts` 模板（§21.2.3）
- [ ] Content Contract 自動生成（掃描 Layout 的 dataSource）（§21.3）
- [ ] `validate-ui-specs.js` 新增 R25~R28 lint 規則（§21.4.1）
- [ ] 新增 `ucuf-compliance.instructions.md`（§22.2）
- [ ] 新增 `ucuf-develop.md` workflow（§22.3）

### M11: Agent 治理與衝突防範（預估 3 天）

- [ ] 實作 `UCUFRuleRegistry`（§24.1）
- [ ] `RuntimeRuleChecker` 整合動態規則訂閱（§24.2 A）
- [ ] `ucuf-rules-registry.json` 持久化格式（§24.4）
- [ ] `ucuf-gen-rule-test.js` 自動測試骨架生成（§24.2 C）
- [ ] `ucuf-conflict-detect.js` 衝突偵測工具（§23.4）
- [ ] `finalize-agent-turn.js` 整合 UCUF Pre-Submit Gate（§22.4.2）

### M12: 全專案推廣 + 清理（預估持續進行）

- [ ] 將其他畫面（BattleHUD、GeneralList 等）逐步遷移至 CompositePanel
- [ ] 清理 `UIPreviewShadowManager`（統一到 skinLayers）
- [ ] 舊代碼全域清理 — `_deprecated/` 目錄掃描 + 刪除（§11.3 Phase D）
- [ ] 實作 `scan-deprecated-refs.js` 自動化掃描工具（§11.4）
- [ ] 產出 UCUF 開發者指南

---

## 附錄 A：節點數量對比（預估）

| 畫面區域 | 現狀節點數 | UCUF 節點數 | 減少 |
|----------|-----------|-------------|------|
| GeneralDetail Classic Layout | ~70 | 0 (廢除) | -70 |
| GeneralDetail V3 Overview | ~60 | ~30 | -30 |
| Footer (4→1) | 4 | 1 | -3 |
| BloodlineCrest (8→1) | 8 | 1 | -7 |
| Tab 頁 (6→1) | 6 同時存在 | 1 活躍 | -5 |
| **總計** | ~80+ | ~35 | **-56%** |

## 附錄 B：檔案變更清單（預估）

| 動作 | 檔案 |
|------|------|
| **新增** | `assets/scripts/ui/core/CompositePanel.ts` |
| **新增** | `assets/scripts/ui/core/ChildPanelBase.ts` |
| **新增** | `assets/scripts/ui/core/panels/AttributePanel.ts` |
| **新增** | `assets/scripts/ui/core/panels/GridPanel.ts` |
| **新增** | `assets/scripts/ui/core/panels/ScrollListPanel.ts` |
| **新增** | `assets/scripts/ui/core/panels/RadarChartPanel.ts` |
| **新增** | `assets/scripts/ui/core/panels/EditableTextPanel.ts` |
| **新增** | `assets/scripts/ui/core/interfaces/ICompositeRenderer.ts` |
| **新增** | `assets/scripts/ui/core/interfaces/IScrollVirtualizer.ts` |
| **新增** | `assets/scripts/ui/core/UCUFLogger.ts` |
| **新增** | `assets/scripts/ui/core/RuntimeRuleChecker.ts` |
| **新增** | `assets/scripts/ui/core/DataBindingValidator.ts` |
| **新增** | `assets/scripts/ui/platform/cocos/CocosCompositeRenderer.ts` |
| **新增** | `assets/resources/ui-spec/layouts/general-detail-unified-main.json` |
| **新增** | `assets/resources/ui-spec/screens/general-detail-unified-screen.json` |
| **新增** | `assets/resources/ui-spec/fragments/layouts/tab-{basics,stats,...}.json` (×7) |
| **新增** | `tools_node/collect-asset-registry.js` |
| **新增** | `tools_node/audit-asset-usage.js` |
| **新增** | `tools_node/scan-deprecated-refs.js` |
| **新增** | `tools_node/validate-i18n-coverage.js` |
| **新增** | `tools_node/ucuf-screenshot-regression.js` |
| **新增** | `tests/ucuf/skinLayers.test.ts` |
| **新增** | `tests/ucuf/AttributePanel.component.test.ts` |
| **新增** | `tests/ucuf/DataBindingValidator.test.ts` |
| **新增** | `tests/ucuf/rules/RT-11.test.ts`（範例：動態規則自動測試骨架） |
| **新增** | `assets/scripts/ui/core/UCUFRuleRegistry.ts` |
| **新增** | `assets/scripts/ui/core/UINodePool.ts` |
| **新增** | `assets/resources/ui-spec/ucuf-rules-registry.json` |
| **新增** | `assets/resources/ui-spec/contracts/` 目錄（Content Contract Schema） |
| **新增** | `.github/instructions/ucuf-compliance.instructions.md` |
| **新增** | `.agents/workflows/ucuf-develop.md` |
| **新增** | `.agents/workflows/ucuf-verify.md` |
| **新增** | `tools_node/templates/composite-panel.template.ts` |
| **新增** | `tools_node/ucuf-conflict-detect.js` |
| **新增** | `tools_node/ucuf-gen-rule-test.js` |
| **新增** | `tools_node/ucuf-runtime-check.js` |
| **新增** | `tools_node/validate-ucuf-task-card.js` |
| **新增** | `docs/agent-briefs/UCUF-task-card-template.md (doc_task_0131)` (doc_task_0131) |
| **修改** | `assets/scripts/ui/core/UIPreviewBuilder.ts` (skinLayers + composite-image + preload + postBuildPass) |
| **修改** | `assets/scripts/ui/core/UISkinResolver.ts` (preloadSlots 批次預載) |
| **修改** | `assets/scripts/ui/core/UITemplateResolver.ts` (cloneLayoutSpec 取代 JSON.stringify) |
| **修改** | `assets/scripts/ui/core/UIPreviewLayoutBuilder.ts` (移除 buildTime updateAlignment) |
| **修改** | `assets/scripts/ui/core/UIPreviewDiagnostics.ts` (委託 UCUFLogger) |
| **修改** | `assets/scripts/ui/core/UISpecTypes.ts` (新增型別) |
| **修改** | `assets/scripts/core/managers/UIManager.ts` (onSceneWillChange + dispose) |
| **修改** | `assets/scripts/core/systems/ResourceManager.ts` (forceRelease 硬釋放) |
| **修改** | `assets/scripts/core/managers/ServiceLoader.ts` (onAssetEvicted 接線) |
| **修改** | `tools_node/validate-ui-specs.js` (R19~R28) |
| **修改** | `tools_node/scaffold-ui-component.js` (新增 --ucuf 模式) |
| **修改** | `tools_node/finalize-agent-turn.js` (UCUF Pre-Submit Gate) |
| **搬移** | `assets/scripts/ui/components/GeneralDetailPanel.ts` → `_deprecated/` |
| **搬移** | `assets/scripts/ui/components/GeneralDetailOverviewShell.ts` → `_deprecated/` |
| **搬移** | `assets/resources/ui-spec/layouts/general-detail-main.json` → `_deprecated/` |
| **最終刪除** | M8 全域清理後刪除 `_deprecated/` 目錄 |

## 附錄 C：里程碑依賴關係

```
M1 (Foundation)
 └─► M2 (CompositePanel Core)
      ├─► M3 (ChildPanel 家族)
      │    └─► M4 (GeneralDetailOverview 遷移)
      │         ├─► M5 (穩定性基礎建設)
      │         │    └─► M6 (資源管理與測試)
      │         ├─► M7 (I18n + 資料驅動)
      │         ├─► M8 (效能深度優化) ← v1.2 新增
      │         │    └─► M9 (架構治理完善) ← v1.2 新增
      │         └─► M10 (標準化流程 + Scaffold v2) ← v1.3 新增
      │              └─► M11 (Agent 治理 + 衝突防範) ← v1.3 新增
      └──────────────────────────► M12 (全專案推廣 + 清理)
```

預估總工期：**M1~M11 約 41 天**（不含 M12 持續推廣）。

## 附錄 D：效能指標基準（v1.2 新增）

| 指標 | 當前估算 | UCUF 目標 | UCUF + 效能優化目標 |
|------|----------|-----------|---------------------|
| buildScreen 耗時 | ~160ms | ~50ms | ≤ 25ms |
| switchSlot（首次） | ~80ms | ~30ms | ≤ 15ms |
| switchSlot（重訪） | ~80ms | ~30ms | ≤ 1ms（pool hit） |
| 節點數（GDO 畫面） | ~80 | ~35 | ~30 |
| Draw Call（GDO 畫面） | ~40 | ~20 | ≤ 12 |
| 記憶體（GDO 畫面） | 未追蹤 | scope 追蹤 | scope 追蹤 + auto evict |
