<!-- doc_id: doc_ui_0042 -->
# GeneralDetailOverview 畫面重構計畫

> 建立日期：2026-04-12
> 狀態：實作中
> 關聯規格：`docs/UI 規格補遺_2026-04-02_日常人物頁v3.md (doc_ui_0028)` (doc_ui_0028)、`docs/UI 規格補遺_2026-04-02_血脈命鏡v3.md (doc_ui_0029)` (doc_ui_0029)

---

## 一、核心問題：兩套完整 Layout 同時存在，互相疊加

整個畫面的混亂根源是一個**架構設計錯誤**——同一個 `GeneralDetailPanel` 裡同時存在**兩套獨立的全畫面 Layout**：

| Layout | 檔案 | 用途 |
|---|---|---|
| **Classic Layout** | `general-detail-main.json` (~515 行) | 傳統分頁版本（Tab 切 6 頁）|
| **V3 Overview Layout** | `general-detail-bloodline-v3-main.json` (~402 行) | 血脈總覽版本（全景式）|

`GeneralDetailPanel.show()` 先用 `buildScreen()` 把整個 Classic Layout 的節點樹全部建出來（BackgroundFull、PortraitImage、TopLeftInfo、BottomLeftInfo、RightContentAreaFill、RightContentArea + 6 個 Tab 頁面 + FooterPanel 三層），然後 `_ensureOverviewShell()` 再創建一個 `GeneralDetailOverviewShellHost` 節點，掛上 `GeneralDetailOverviewShell` 元件，再用 `buildScreen()` 把 V3 Layout 的節點樹**又全部建一次**。

切到「總覽」Tab 時，`_setOverviewMode(true)` 試圖隱藏 Classic 節點、顯示 V3 節點。

---

## 二、具體導致「框疊在一起」的 5 個原因

### 🔴 問題 1：Classic Layout 使用「層疊式框體」設計模式

```json
// general-detail-main.json EXCERPT
{
  "name": "RightContentAreaFill",    // ← 底層填色
  "widget": { "top": 174, "bottom": 56, "right": 152 },
  "width": "38%",
  "skinSlot": "detail.content.fill"
},
{
  "name": "RightContentArea",         // ← 同位置的內容容器
  "widget": { "top": 174, "bottom": 56, "right": 152 },
  "width": "38%"
}
```

同一個「右側內容區」被拆成 **RightContentAreaFill** (底色) + **RightContentArea** (內容) 兩個節點，完全重疊在同一位置。Footer 更是疊了**四層**：

```
FooterPanelFill    ← 底色層
FooterPanelBleed   ← 出血層
FooterPanelFrame   ← 邊框層
FooterPanel        ← 真正的按鈕容器
```

這四個節點**完全同尺寸、同位置**，全部用 `widget: { left: 24, right: 24, bottom: 24 }`，每個都有自己的 skinSlot 對應不同的圖片。

### 🔴 問題 2：Classic 的 6 個 Tab 頁面永遠全部預建

```
RightContentArea.children:
  TabBasics      (12 個欄位)
  TabStats       (7 個欄位)
  TabBloodline   (3 大 card + 族譜 + 基因 + 覺醒)
  TabSkills      (5 個 card)
  TabAptitude    (4 個 card)
  TabExtended    (6 個欄位)
  FooterPanelFill / FooterPanelBleed / FooterPanelFrame / FooterPanel
```

所有 6 個分頁的節點都被 `buildScreen()` 一次性全部創建，切 Tab 只是切 `active` 開關。全部使用相同的 widget 定位 `{ top: 28, bottom: 112, left: 28, right: 28 }`，代表 6 個 Tab 頁全部疊在同一個矩形。

### 🔴 問題 3：V3 Layout 也有自己的多層疊加

- `InfoCardChrome` → `InfoCardFill`（一個容器只為了放一張底色圖）
- `HeaderUnderlay` 包含 `HeaderUnderlayFill` + `HeaderCapLeft` + `HeaderCapRight` + `HeaderOrnamentLeft` + `HeaderOrnamentRight`（5 層疊加）
- `BloodlineCrestCarrier` 包含 `BloodlineSealInset` + `BloodlineSealInsetFrame` + `BloodlineCrestGlow` + `BloodlineCrestFill` + `BloodlineCrestInnerRing` + `BloodlineCrest` + `BloodlineCrestFrame` + `BloodlineCrestFace`（**8 層疊加**，全在同一個位置）

### 🔴 問題 4：`_setOverviewMode` 的隱藏清單不完整

```typescript
// GeneralDetailPanel.ts EXCERPT
const classicNodes = [
    'BackgroundFull',
    'PortraitImage',
    'TopLeftInfo',
    'BottomLeftInfo',
    'RightContentAreaFill',
    'RightContentAreaBleed',    // ← 這個節點在 layout JSON 中不存在！
    'RightContentAreaFrame',    // ← 這個也不存在！
    'RightContentArea',
];
```

程式碼試圖隱藏 `RightContentAreaBleed` 和 `RightContentAreaFrame`，但 `general-detail-main.json` 只定義了 `RightContentAreaFill` 和 `RightContentArea`，根本沒有 Bleed/Frame 版本。同時，`ClickBlocker`、`TopCloseBtn`、`RightTabBar` 和整個 Footer 四層都沒有被隱藏——這些 Classic 節點在 Overview 模式下仍然可見。

### 🔴 問題 5：TabBar 在兩套 Layout 之間被動態搬移

```typescript
// _syncOverviewTabBarHost
const targetParent = enabled ? host : root;
if (tabBar.parent !== targetParent) {
    tabBar.parent = targetParent;
}
```

TabBar 被動態在兩個 parent 之間搬來搬去，但 Classic 的 TabBar 結構和 V3 的預期結構並不相同，會導致定位和層級混亂。

---

## 三、節點樹全覽

```
┌──────────────────────────────────────────────────────────┐
│              GeneralDetailPanel (根節點)                   │
│                                                           │
│  buildScreen(classic-layout)                              │
│  ├── BackgroundFull          ← 全畫面背景                  │
│  ├── TopCloseBtn             ← 右上關閉                    │
│  ├── ClickBlocker            ← 全畫面遮罩                  │
│  ├── PortraitImage           ← 全畫面立繪                  │
│  ├── TopLeftInfo (帶背景框)   ← 左上資訊框                  │
│  ├── BottomLeftInfo (帶背景框) ← 左下摘要框                 │
│  ├── RightTabBar (6 顆按鈕)  ← 右側 Tab 列                │
│  ├── RightContentAreaFill    ← 右側底色框                   │
│  ├── RightContentArea        ← 右側 6 個 Tab 頁 (全部疊加) │
│  │   ├── TabBasics                                        │
│  │   ├── TabStats                                         │
│  │   ├── TabBloodline                                     │
│  │   ├── TabSkills                                        │
│  │   ├── TabAptitude                                      │
│  │   ├── TabExtended                                      │
│  │   ├── FooterPanelFill                                  │
│  │   ├── FooterPanelBleed                                 │
│  │   ├── FooterPanelFrame                                 │
│  │   └── FooterPanel                                      │
│  │                                                         │
│  └── GeneralDetailOverviewShellHost ← 動態創建              │
│      └── buildScreen(v3-layout)     ← 再建一整棵節點樹      │
│          ├── BackgroundScene                               │
│          ├── StageLeftShade                                │
│          ├── PortraitCarrier (+ 立繪)                       │
│          ├── OverviewStateChrome (左上識別帶)                │
│          ├── InfoCardChrome → InfoCardFill                  │
│          ├── InfoContent                                    │
│          │   ├── HeaderUnderlay (5 層疊加)                  │
│          │   ├── HeaderRow                                  │
│          │   ├── OverviewSummaryModules (3 卡片)            │
│          │   └── BloodlineOverviewModules                   │
│          │       └── BloodlineCrestCarrier (8 層疊加)       │
│          └── (TabBar 被動態搬進來)                          │
└──────────────────────────────────────────────────────────┘
```

**最終結果：一個畫面裡同時存在 ~80+ 個節點，大量節點位於完全相同的座標，只靠 `active` flag 控制顯示/隱藏，而隱藏邏輯有遺漏。**

---

## 四、完整優化建議

### 建議 1：廢除「雙 Layout 共存」，改為「單 Screen 單 Layout」原則

**方案**：

```
GeneralDetailPanel (容器，不持有 Layout)
├── show() → 根據 activeTab 決定載入哪個 screen
│   ├── tab === 'Overview' → loadScreen('general-detail-bloodline-v3-screen')
│   └── tab === 其他       → loadScreen('general-detail-screen')
└── 切 Tab 時：destroyBuiltChildren() → 重新 buildScreen()
```

或更好的做法：**把 Classic 分頁頁面也遷移到 V3 Layout 的子區域**，徹底廢棄 Classic Layout。

### 建議 2：消除「多節點疊加模擬框體」，改用 compound skinLayers

在 `UIPreviewNodeFactory.buildPanel()` 支援 **compound skin**：

```json
{
  "type": "panel",
  "name": "FooterPanel",
  "widget": { "left": 24, "right": 24, "bottom": 24 },
  "height": 72,
  "skinSlot": "detail.footer",
  "skinLayers": ["fill", "bleed", "frame"],
  "children": [...]
}
```

讓 `buildPanel` 自動在節點內部創建多層背景子節點，而非在 Layout 裡手動定義 3~4 個同位置的兄弟節點。**一個邏輯面板 = 一個 Layout 節點**。

### 建議 3：Tab 頁面改為 Lazy Load（Fragment `$ref`）

目前 6 個 Tab 的節點全部在 `buildScreen` 時一次性創建。

**方案**：
- Layout 只定義 `TabContentSlot`（一個空容器）
- 切 Tab 時：`destroySlotChildren()` → 從對應 Fragment Layout 動態載入該 Tab 的節點
- 任何一刻節點樹中只存在一個 Tab 的內容，而非六份全部堆疊

專案已有 `$ref` fragment 機制（V3 Layout 中已使用），技術上完全可行。

### 建議 4：Crest 視覺層級用 composite-image 取代手動疊加

BloodlineCrestCarrier 內 8 個 image 全部用 `widget: { hCenter, vCenter }` 疊在同一中心點。

**方案**：定義 **`composite-image`** 類型：

```json
{
  "type": "composite-image",
  "name": "BloodlineCrest",
  "widget": { "hCenter": true, "vCenter": 4 },
  "width": 176,
  "height": 176,
  "layers": [
    { "skinSlot": "gdv3.bloodline.seal.inset",  "size": [164, 164] },
    { "skinSlot": "gdv3.bloodline.seal.frame",  "size": [174, 174] },
    { "skinSlot": "gdv3.bloodline.crest.glow",  "size": [172, 172] },
    { "skinSlot": "gdv3.bloodline.crest.fill",  "size": [150, 150] },
    { "skinSlot": "gdv3.bloodline.crest.inner", "size": [160, 160] },
    { "skinSlot": "gdv3.bloodline.crest",       "size": [134, 134] },
    { "skinSlot": "gdv3.bloodline.crest.frame", "size": [176, 176] },
    { "skinSlot": "gdv3.bloodline.crest.face",  "size": [122, 122] }
  ]
}
```

Layout JSON 中 **1 個節點** 取代 8 個。

### 建議 5：建立 Layout 節點數量 lint 規則

新增驗證規則（整合到 `validate-ui-specs.js`）：

1. **同一 parent 下不允許超過 2 個節點有完全相同的 widget**（偵測手動疊加）
2. **單一 Layout 總節點數不超過 50 個**（目前 Classic ~70 個，V3 ~60 個）
3. **禁止 Layout 中出現 `*Fill` / `*Bleed` / `*Frame` 同名模式**（強制改用 compound skin）

### 建議 6：管理原則

| 原則 | 規則 |
|---|---|
| **1 Screen = 1 Layout** | 禁止一個 Panel 組件持有/建構兩個完整 Layout |
| **1 邏輯區塊 = 1 節點** | 一個視覺上的「面板」在 Layout 中只能是 1 個節點，多層視覺用 compound skinLayers |
| **Tab 內容延遲載入** | 只有當前激活的 Tab 才建立節點，其他 Tab 用 Fragment `$ref` 延遲載入 |
| **Composite 元件標準化** | 多層疊加的徽章/勳章/命紋等特殊元件，用 composite-image type 標準化 |
| **節點數上限** | 單一 Layout 節點數 ≤ 50，超過需要拆分成 Fragment |

---

## 五、嚴重度總表

| 問題 | 嚴重度 | 影響 |
|---|---|---|
| 兩套 Layout 同時 buildScreen | 🔴 Critical | 節點總數翻倍，定位互相干擾 |
| Fill/Bleed/Frame 手動疊加模式 | 🔴 Critical | 每個面板 3~4 個同位置節點，「框疊框」 |
| 6 個 Tab 頁全部預建且同位置 | 🟡 Major | 節點數膨脹，切換邏輯容易遺漏 |
| `_setOverviewMode` 隱藏清單不完整 | 🟡 Major | 部分 Classic 節點在 Overview 模式仍可見 |
| Crest 8 層疊加 | 🟠 Minor | 單一視覺元件佔用過多節點 |

---

## 六、優先修復順序

### Phase 1：短期緊急修補（立即）

- [x] 修正 `_setOverviewMode` 隱藏清單，補齊遺漏的 Classic 節點（加入 `ClickBlocker`）
- [x] 移除不存在的 `RightContentAreaBleed`/`RightContentAreaFrame` 引用
- [x] 清除 `_ensureOverviewShell` 中不存在的 `RightTabBarFill` 引用
- [x] 統一 TabBar widget if/else 重複分支
- [x] Overview shell 初始 `active = false`，build 完成後才顯示

### Phase 2：引入 compound skinLayers（中期）

- [ ] 在 `UIPreviewNodeFactory.buildPanel()` 新增 `skinLayers` 支援
- [ ] 把 Footer 四層合併為單一 `FooterPanel` + `skinLayers`
- [ ] 把 RightContentAreaFill + RightContentArea 合併
- [ ] 把 V3 的 HeaderUnderlay 五層合併

### Phase 3：Tab Lazy Load（中期）

- [ ] 把 6 個 Tab 的節點拆成獨立 Fragment Layout
- [ ] Layout 只保留 `TabContentSlot`
- [ ] 切 Tab 時動態載入/卸載 Fragment

### Phase 4：composite-image type（中期）

- [ ] 在 factory 新增 `composite-image` 節點型別
- [ ] 把 BloodlineCrestCarrier 8 層改用 composite-image

### Phase 5：Layout lint 規則（中期）

- [x] `validate-ui-specs.js` R21: no-duplicate-widget-siblings（同位置疊加偵測）
- [x] `validate-ui-specs.js` R22: no-fill-bleed-frame-triplet（Fill/Bleed/Frame 三件套警告）
- [x] `validate-ui-specs.js` R23: max-layout-node-count（單一 Layout 節點數上限 50）

### Phase 6：廢棄 Classic Layout（長期）

- [ ] 把 Classic 分頁內容遷移到 V3 Layout 的 Fragment
- [ ] 刪除 `general-detail-main.json`
- [ ] 移除 `GeneralDetailPanel` 中所有雙 Layout 切換邏輯

---

## 七、關聯檔案

| 檔案 | 用途 |
|---|---|
| `assets/resources/ui-spec/layouts/general-detail-main.json` | Classic Layout |
| `assets/resources/ui-spec/layouts/general-detail-bloodline-v3-main.json` | V3 Overview Layout |
| `assets/scripts/ui/components/GeneralDetailPanel.ts` | Panel 組件（雙 Layout 切換邏輯所在）|
| `assets/scripts/ui/components/GeneralDetailOverviewShell.ts` | V3 Overview Shell 組件 |
| `tools_node/validate-ui-specs.js` | UI Spec 驗證工具（lint 擴充目標）|
| `assets/scripts/ui/UIPreviewNodeFactory.ts` | 節點工廠（skinLayers / composite-image 擴充目標）|
