# UI 技術規格書 (UI Technical Specification)

> **文件目的**: 定義遊戲全域 UI 的底層程式架構、元件封裝原則與排版策略，確保介面開發具備「高量產力」、「跨平台自適應」、「邏輯分離」與「美術零阻力」等長期量產原則。
> **參考來源**: `keep.md`、`UI 規格書.md`、`主戰場UI規格書.md`、`美術素材規劃與使用說明.md`
> **資產基準**: 所有 UI 相關資產目錄、命名與 legacy 例外，統一以 `docs/美術素材規劃與使用說明.md` 為準。

---

## 1. 核心開發原則 (Core Principles)

為了支撐遊戲從原型邁向正式版本，以及後續大量系統的快速迭代，UI 技術架構需遵守以下四大原則：

1. **邏輯與視圖完全隔離 (UI-Logic Decoupling)**
   - UI 組件 (**View**) 絕對不包含遊戲核心機制（如扣血、計算機率）。
   - UI 僅透過暴露 `show(data)` 接收純資料，並透過 `onEvent` 回呼將玩家操作傳遞給控制器 (**Controller / Manager**)。
2. **美術設計零阻力 (Artist-Friendly Workflow)**
   - 程式邏輯不得綁死佈局座標（禁止 `x: 100, y: 50` 寫死排版）。
   - 程式採用「預製體插槽 (Prefab Injection)」模式，優先載入美術設計的 Prefab (附帶九宮格/Atlas)，若無則自動降級為代碼生成的「純色白模」。
3. **跨平台無縫適配 (Cross-Platform Responsive)**
   - 必須完美支援 Web, iOS, Android 各種長寬比（16:9, 19.5:9 等螢幕）。
   - 全面禁用絕對座標，強制依賴 `cc.Widget` 貼齊螢幕邊緣，並配合 `cc.SafeArea` 避開手機瀏海與系統條。
4. **預留第三方與長期擴展 (Extensible for Long-Term)**
   - 包含廣告 (Ads)、登入 (Login)、數據分析 (Analytics) 等按鈕或視窗，皆需定義抽象介面，方便未來接上原生 SDK 或 Web 平台 API。
   - 文字必須預留多語言 (i18n) 擴充空間。

### 1.1 UI 資產治理補充
- 版面契約維持 `ui-spec/layouts`、`skins`、`screens` 三層 JSON，不可回退成各畫面各自手調 Prefab 為唯一真實來源。
- 若 UI 需要新增實體圖塊、icon、底框、字型或 atlas 規則，必須先對齊 `docs/美術素材規劃與使用說明.md` 的正式路徑與命名規則。
- gameplay key 直載的小圖示可沿用 `assets/resources/icons/{gameplay_id}.png`；screen-specific 的 UI 美術圖塊則應遵守 skin manifest / SpriteFrame path 規則，不得混成隨意路徑。

---

## 2. 基礎渲染與白模機制 (Rendering & Mockup Mechanism)

這套架構吸取了開發初期的經驗，確保引擎的渲染穩定度：

- **唯一推薦的底板元件 - `cc.Sprite`**
  - **禁用限制**：避免僅使用 `cc.Graphics` 作為 UI 底板，以免在複雜深度或特殊相機下被 Clipping 或無效化。
  - **白模策略 (`SolidBackground.ts` 模式)**：原型開發期，腳本自動在記憶體動態建立 1x1 的白底 `SpriteFrame` 供 `Sprite` 上色。
  - **美術接軌**：當美術把製作好的 Atlas (圖集) 或 9-Sliced (九宮格) 貼圖拖入 Inspector 後，腳本將自動偵測到實體 `SpriteFrame` 並**退居幕後**（不覆蓋資源，僅做輔助或不再介入），確保美術心血完美呈現。

---

## 3. UI 系統管理器模組 (UIManager Architecture)

未來的 UI，一律透過單一的 `UIManager` 進行生命週期與資源管理。

### 3.1 深度與層級管理 (Z-Order & Layering)
UI 畫布 (Canvas) 底下將嚴格分出幾大層 (LayerNode)：
1. **SceneLayer (場景基底層)**：如大廳主背景、系統主畫面 (`LobbyScene` 等)。
2. **HUDLayer (戰鬥指示層)**：如主戰場的上方血條、左方虎符卡 (`Top HUD`, `Hero Info`)。
3. **PopupLayer (彈窗層)**：具備黑色半透明背景遮罩的視窗（如：詳情設定、購買確認彈窗）。
4. **ToastLayer (輕提示層)**：如「糧草不足」、「系統錯誤」等短暫出現的提示漂浮字。
5. **LoadingLayer (全域過場層)**：最高權限，換場或網路延遲時必定蓋住所有畫面。

### 3.2 視窗動態加載 (Dynamic Loading)
- 龐大的介面（如「圖鑑」、「商城」）不能在一開始全放入 Canvas。
- 透過 `UIManager.openPanel('ShopPanel')`：
  1. 至 `resources` 或特定 bundle 動態加載 Prefab。
  2. 實例化 (Instantiate) 並加入正確的層級。
  3. 初次載入後進入物件池 (Node Pool) 免除反覆 Instantiate 造成的掉幀。

---

## 4. 自適應排版策略 (Responsive Layout)

為了滿足多端發行，UI 撰寫強制遵循以下規範：

### 4.1 Widget 動態貼齊
- 參考 `主戰場UI規格書.md`：
   - **HUD** (如糧草與回合): 必須掛載 `Widget`，`isAlignTop = true`。
  - **核心操作區** (技能按鈕): 掛載 `Widget`，`isAlignBottom = true`, `isAlignRight = true`。
  - 這樣當玩家使用超長螢幕手機時，UI 會自動往兩側展開，不會卡在畫面中央遮擋 3D 棋盤。

### 4.2 Layout 動態列表
- 無面試的表格或選單（如「大廳武將列表」），**嚴禁手動寫 X/Y 偏移量**。
- 必須掛載 `cc.Layout` (VERTICAL / HORIZONTAL / GRID)，設定好 Spacing。
- 當資料量龐大（> 20 筆）時，必須升級為 `cc.ScrollView` + 虛擬列表技術 (Virtual List/Recycle List)，確保只渲染畫面上可見的 Node，以保證手機不發燒發燙。

---

## 5. 元件幾何行為分類 (Component Geometry Behavior)

> 完整矩陣與 Title 分類規則見 → **`docs/ui/component-sizing-contract.md`**（唯一尺寸真相來源）。
> 此節提供概念定義；實際標準尺寸請讀 sizing contract。

### 5.1 六類幾何行為

所有 UI 元件必須在 screen spec / task card 中明確標記以下六類之一：

| 代號 | 行為 | 說明 |
|------|------|------|
| **FX** | `fixed-scale` | 固定 W × H；只允許整體等比 scale，不可單軸拉伸 |
| **SS** | `stretch-safe-segmented` | 必須分件（cap＋band＋fill）才能安全左右拉伸 |
| **SR** | `sliced-rect` | 9-slice 矩形框；四角固定、四邊可拉 |
| **TR** | `tiled-repeat` | 紋理可重複貼磚 |
| **LC** | `layout-container` | 由 `cc.Layout` 驅動，隨子節點自動擴展 |
| **DI** | `data-image-fixed` | 尺寸固定槽，runtime 圖片 crop/fit 進此槽 |

**核心決策原則**：
- 元件是否有裝飾邊角且需要動態改寬？→ SS（分件），不可用整張圖拉伸
- 元件是否為純矩形可 9-slice？→ SR
- 元件是否固定出現於某畫面特定位置，文字長度有上限？→ FX
- **FX 元件必須有明確的 W × H 標準尺寸**，「依參考圖」不算完整規格
- 若 icon 結構為 `underlay + glyph`，主 glyph 的外圍矩陣預設佔底板有效承載區 **80%**，作為全域一致性基準；不得對每顆 icon 個別重定比例

### 5.2 Title 元件兩類分類強制規則

**Title（標題）元件是幾何行為最常被誤判的類別**，必須在 spec 建立時先判斷：

- **Type A — 畫面專屬固定標題**（幾何行為 `FX`）
  - 只在一個畫面 / 一個 zone 出現、文字長度有上限
  - **不可預設生成 left-cap / right-cap 資產**
  - 整體 scale 或純 label-style 即可

- **Type B — 通用可拉伸標題**（幾何行為 `SS`）
  - 跨畫面復用，或需依不同文字寬度延展
  - **必須**拆成三件：`{name}-cap-left` + `{name}-band-fill` + `{name}-cap-right`

### 5.3 與三層 JSON 契約的對應

幾何行為在三層 JSON 中的落點：
- `geometry` 欄位：在 `ui-spec/screens/*.json` 中每個 component 對應的 sizing entry
- `spriteType`：`simple`（FX/DI） / `sliced`（SR） / `tiled`（TR）
- cap/fill/band 路徑：在 `ui-spec/skins/*.json` 中的 `skinSlot` 映射

---

## 6. 整合現有 UI 規格 (Integration with Specs)

1. **視覺風格切換** (`UI 規格書.md` 提及 Win95、像素轉場)
   - 需透過 AssetBundle 機制將不同風格的美術圖集打包分開。
   - `UIManager` 需具備主題切換 (Theme Switcher) 的能力，套用不同的字型 (BMFont) 與底框 (SpriteFrame)。
2. **戰場與 HUD 不干擾** (`主戰場UI規格書.md`)
   - 3D 棋盤飄字 (Floating Text) 應從 3D 座標轉投影到 2D UI 攝影機座標。
   - 所有在 2D HUD 上的卡片 (虎符) 或點擊區域，必須開啟透穿檢測，防範因不可見底板誤擋了下層 3D 角色的點擊事件。
3. **Atlas 圖集減輕 DrawCall** (`美術素材規劃與使用說明.md`)
   - 每個系統面板獨立成一張 Atlas（或使用 AutoAtlas）。
   - 保證一個 Popup 畫面內的 DrawCall 控制在 3-5 次之內。

---

## 6. 面向未來的外掛與 SDK 支援 (Future APIs & SDKs)

當我們需要接 Web3、廣告或是社交登入時，UI 不應受到破壞：
- 畫面中的 "登入按鈕"、"分享按鈕" 統一掛載 `ExternalServiceButton` 組件。
- 點擊時，介面僅呼叫 `Services.SDK.login()`。
- 是否顯示該按鈕（例如某些平台無廣告功能），由載入時的平台常數 (`sys.platform`) 透過腳本將該按鈕的 `active` 關閉，並交由 `Layout` 自動遞補剩下的按鈕位置，做到**按鈕的伸縮自如**。 

---
`docs/UI技術規格書.md` 確定了目前專案健康且穩健的實作方向。接下來的任何 UI 工作，皆須依照此標準，從「實作純資料與排版的 Prefab」開始堆疊遊戲畫面。

---

## 7. Fragment 系統（Fragment System）

Fragment 系統是 UI 量產鏈的可重用積木層。所有跨畫面複用的結構（Widget / Layout 片段）都必須以 fragment 形式管理，而不是在每個 layout JSON 內手寫重複結構。

### 7.1 Fragment 目錄結構

```
assets/resources/ui-spec/fragments/
  widgets/          ← 可引用的 widget fragment JSON（12 個，見 widget-registry.json）
  layouts/          ← 可引用的 layout 結構片段
  skins/            ← 可重用的 skin 片段
  widget-registry.json  ← Widget 正式索引（id / category / type / description / slots / params）
```

### 7.2 $ref 引用語意

Layout JSON 中任何節點支援 `"$ref": "fragments/widgets/<widget>.json"` 引用：

```json
{ "$ref": "fragments/widgets/action-button.json", "id": "btnConfirm", "texts": { "label": "確認" } }
```

**合併規則**：`{ ...fragment, ...node }` — node 的屬性覆蓋 fragment 同名屬性；fragment 的 children 若未覆寫則原樣帶入。

**Immutable Keys**：`type` 欄位受保護，不可在 node 覆蓋 fragment 的 `type`。違規時：
- Runtime：`UISpecLoader` 發出 warn，防止結構破壞。
- 靜態：`validate-ui-specs.js` R18 规則攔截，報告 error。

### 7.3 Widget Registry 使用守則

- 新 layout 開工前必須先讀 `widget-registry.json`，優先使用既有 widget。
- 新增 widget 後必須同步更新 registry，並執行 `node tools_node/validate-widget-registry.js`。
- 12 個現有 widget 分 7 類：`action / container / header / display / content / overlay / feedback`。

### 7.4 Fragment 修改防護

修改任何 fragment 前必須遵守五步防護流程（詳見 `.github/instructions/fragment-guard.instructions.md`）：

1. 查使用地圖：`node tools_node/build-fragment-usage-map.js --query <ref>`
2. 確認影響範圍（受影響的 layout 清單）
3. 評估是否影響 immutable key（若會改 `type`，必須另建新 fragment）
4. 修改後重跑 `validate-ui-specs.js --strict`
5. 跑 snapshot regression：`headless-snapshot-test.js`

### 7.5 Engine Adapter 介面層

Fragment 與 layout 的渲染由引擎無關介面承接，具體實作在平台目錄：

| 介面 | 路徑 |
|------|------|
| `INodeFactory` | `assets/scripts/ui/core/interfaces/INodeFactory.ts` |
| `IStyleApplicator` | `assets/scripts/ui/core/interfaces/IStyleApplicator.ts` |
| `ILayoutResolver` | `assets/scripts/ui/core/interfaces/ILayoutResolver.ts` |
| Cocos 實作 | `assets/scripts/ui/platform/cocos/CocosNodeFactory.ts` |
| Unity stub | `assets/scripts/ui/platform/unity/UnityNodeFactory.ts` |

---

## 8. Testing 策略（Testing Strategy）

### 8.1 靜態驗證 — validate-ui-specs.js

執行 R1–R18 完整規則，涵蓋：

| 規則組 | 內容 |
|--------|------|
| R1–R5 | 必要欄位、type 枚舉、id 唯一性 |
| R6–R10 | $ref 解析完整性、skin slot 存在性 |
| R11–R15 | content contract 欄位對應、bind path 格式 |
| R16–R17 | design token 引用（禁止 hex 硬編碼）|
| R18 | immutable key override 偵測（$ref type 覆蓋防護）|

```bash
node tools_node/validate-ui-specs.js --strict
node tools_node/validate-ui-specs.js --check-content-contract
```

### 8.2 Snapshot Regression — headless-snapshot-test.js

對 113 個 UI spec 的 JSON 結構做 hash 快照，偵測非預期結構變動：

```bash
# 比對現況 vs baseline
node tools_node/headless-snapshot-test.js

# 確認改變屬於預期後更新 baseline
node tools_node/headless-snapshot-test.js --update
```

baseline 存於 `tools_node/.ui-spec-snapshot.json`，應 commit 進 git。

### 8.3 Layout Diff — layout-diff.js

```bash
# 比對兩個 layout 檔案
node tools_node/layout-diff.js <file-a> <file-b>

# 比對 git HEAD vs 工作目錄
node tools_node/layout-diff.js --git <file>
```

輸出人類可讀的節點增刪格式，用於 code review 輔助。

### 8.4 i18n 溢出檢查 — i18n-overflow-check.js

```bash
node tools_node/i18n-overflow-check.js
```

以 CJK 字元寬度估算各語系文字長度，輸出溢出風險摘要。i18n 目錄不存在時 graceful exit。

### 8.5 Testing 觸發點（Mandatory Gates）

| 情境 | 必跑工具 |
|------|---------|
| 修改任何 layout / skin / screen JSON | `validate-ui-specs.js --strict` |
| 修改 fragment | `build-fragment-usage-map.js --query <ref>` + `validate-ui-specs.js --strict` + `headless-snapshot-test.js` |
| 新增 / 刪除 widget fragment | `validate-widget-registry.js` |
| layout 大批次 refactor | `headless-snapshot-test.js` + `layout-diff.js --git <file>` |
| 新增 / 修改 i18n key | `i18n-overflow-check.js` |
| 收工前（post-flight） | `check-encoding-touched.js <changed-files>` + `validate-ui-specs.js --strict --check-content-contract` |
