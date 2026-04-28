<!-- doc_id: doc_other_0009 -->
# HTML Skill Plan

## 1. 文件目的

本文件定義 `tools_node/dom-to-ui-json.js` 的實作目標、輸出邊界、驗證規則與後續演進方向。

這支工具的定位不是「把 HTML 一鍵變成可上線 Cocos UI」，而是把 HTML / CSS 中可規則化的資訊，轉成可驗證、可維護、可納入本專案 UCUF 流程的草稿產物。

Unity 對照：它比較像「Prefab 樹骨架產生器 + Theme / Skin Slot 草稿產生器」，不是最終 Prefab 編輯器，也不是最終視覺驗收工具。

---

## 2. 工具定位

`dom-to-ui-json.js` 的正確定位是：

> HTML 解析 -> UCUF layout draft + skin/style slot draft + 驗證與報告輸出

這個定位有三個目的：

1. 減少人工抄寫 layout / slot / widget 的時間。
2. 在產出當下就標出高風險區塊，而不是把錯誤留到 runtime。
3. 讓後續 `validate-ui-specs.js`、`scaffold-ui-component.js --ucuf`、UI pipeline 可以吃同一套中介產物。

**重要：純靜態 parser 限制（M12 補強）**

`dom-to-ui-json.js` 不執行 JavaScript。所以它只能看到 HTML 文字本身的節點，看不到 React / Vue / Babel / Solid / Svelte 任何 client-render 框架在 runtime 才產生的真實 DOM。對這類 HTML，必須先用 `tools_node/render-html-snapshot.js`（M12）以 puppeteer-core 把渲染後的 `document.documentElement.outerHTML` 落成靜態檔，再餵給本工具。詳見 §35.5。

---

## 3. 本專案的 UCUF 真實格式

本專案不是直接輸出一般 Cocos 節點名，而是輸出三層 JSON 契約：

| 層 | 作用 | 典型內容 |
|---|---|---|
| `layouts/*.json` | 結構、widget、幾何、lazySlot、child-panel | `type`、`name`、`widget`、`children` |
| `skins/*.json` | 顏色、字型、sprite-frame、9-slice、label-style | `skinSlot`、`styleSlot`、`slots` |
| `screens/*.json` | layout / skin 組裝、contentRequirements、tabRouting | `layoutRef`、`skinRef`、`contentRequirements` |

型別映射以專案版為準：

| HTML / CSS 語意 | 輸出型別 |
|---|---|
| generic block | `container` |
| 背景 / fill / overlay block | `panel` |
| `img` | `image` |
| `p` / `span` / `h1`... | `label` |
| `button` | `button` |
| `canvas` / `svg` / chart-like | `composite` |
| scroll 語意容器 | `scroll-view` 草稿 |
| safe-area 語意容器 | `safe-area` 草稿 |

硬限制：layout 不得直接存放 hex、rgba、字型路徑、9-slice 真值或 button state sprite 路徑。這些都應落在 `skin draft`。

---

## 4. 輸入、輸出與 CLI 契約

標準用法：

```bash
node tools_node/dom-to-ui-json.js \
  --input artifacts/ui-source/gacha/banner-fragment.html \
  --output assets/resources/ui-spec/layouts/gacha-banner-auto.json \
  --skin-output assets/resources/ui-spec/skins/gacha-banner-auto.skin.json \
  --screen-id gacha-banner-auto \
  --bundle lobby_ui \
  --default-bundle ui_common \
  --emit-screen-draft \
  --emit-preload-manifest \
  --emit-performance-report \
  --validate
```

核心參數：

1. `--input <path>`：HTML 檔案或 fragment。
2. `--output <path>`：layout JSON。
3. `--skin-output <path>`：skin JSON。
4. `--screen-id <id>`：畫面識別碼。
5. `--bundle <name>`：主 bundle。
6. `--default-bundle <name>`：預設 bundle，通常為 `ui_common`。
7. `--root-name <name>`：根節點名稱。
8. `--validate`：輸出後執行 `validate-ui-specs.js`。

進階參數：

1. `--emit-screen-draft`
2. `--emit-preload-manifest`
3. `--emit-performance-report`
4. `--strict`
5. `--warn-only`
6. `--sync-existing`
7. `--merge-mode <preserve-human|html-authoritative|dry-run>`
8. `--conflict-policy <warn|fail>`
9. `--layout-input <json>` / `--skin-input <json>`
10. `--sprite-registry <path>`

exit code 約定：

| 情況 | exit code |
|---|---:|
| 正常輸出 | `0` |
| CLI / 參數錯誤 | `2` |
| strict blocker | `3` |
| sync conflict 且 `--conflict-policy fail` | `4` |
| `--validate` 失敗且 `--strict` | `5` |
| strict unmapped token / forbidden type / guarded asset | `6` |
| R-guard fail | `7` |
| accuracy verdict fail | `8` |
| existing UI logic guard fail | `9` |
| interaction / motion contract fail | `10` |

---

## 5. 必要功能總表

| 能力 | 說明 | 目前狀態 |
|---|---|---|
| HTML 解析 | 支援完整 HTML、fragment、`class`、`id`、`style`、`data-*` | 已落地 |
| CSS 解析 | inline style、`<style>` block、基本 class / id selector | 已落地 |
| 結構轉譯 | 遞迴 children、widget、flex layout、slot / contract | 已落地 |
| Skin draft | `label-style`、`sprite-frame`、`color-rect`、basic `skinLayers` | 已落地 |
| 驗證整合 | `validate-ui-specs.js`、warning / blocker 判斷 | 已落地 |
| 增量同步 | `--sync-existing`、smart merge、syncDelta | 已落地 |
| 加載治理 | preload manifest、performance report、atlas budget | 已落地 |
| Feedback loop | telemetry、aggregate、drift、suggestions | 已落地 |
| 進階 token 反查 | CSS var / spacing / typography scale 核心反查 | 已落地，進階 strict policy 待補 |
| composite 專屬輸出 | `.composite.json`、slot report、完整 `_compositeHint` | 已落地，composite renderer 規範待補 |
| 既有 UI 邏輯防護 | 覆蓋既有 Cocos UI 前後，盤點並驗證按鈕、route、bind path、panel API 是否仍存在 | 已落地（M9） |
| 互動與動畫翻譯 | 將 HTML `data-action` / `aria-controls` / CSS transition / keyframes 轉成 Cocos interaction / motion draft | 已落地（M10） |
| 美術總監回歸檢查 | 將 token、資產、motion、視覺穩定度納入 review baseline | 已落地（M11） |

---

## 6. 核心資料模型建議

Layout draft 節點建議欄位：

```json
{
  "type": "panel",
  "name": "BannerStage",
  "widget": { "top": 0, "left": 0, "right": 0, "bottom": 0 },
  "width": 1080,
  "height": 240,
  "skinSlot": "gacha.banner.stage",
  "children": [],
  "_contract": "banner.title",
  "_sourceClass": ["banner"],
  "_sourceStyle": { "backgroundColor": "#1a1a1a" },
  "_warnings": []
}
```

Skin draft slot 建議欄位：

```json
{
  "kind": "label-style",
  "font": "fonts/newsreader/font",
  "fontSize": 32,
  "lineHeight": 44,
  "letterSpacing": 2,
  "color": "colorWhite",
  "outlineColor": "colorOutlineDark",
  "outlineWidth": 2
}
```

所有生成中介資料都應保留來源脈絡：

1. `_sourceClass`
2. `_sourceStyle`
3. `_contract`
4. `_warnings`
5. `meta.sourceDomHash`

---

## 7. 必要驗證規則

生成端至少要守以下規則：

1. layout 不得出現 `Node` / `Label` / `Sprite` / `cc.Sprite` / `cc.Label`。
2. layout 不得出現 `db://` 路徑或本機絕對路徑。
3. layout 不得出現 hex color；顏色要走 token 或 warning。
4. `lazySlot` 必須有 `defaultFragment`。
5. `child-panel` 應有明確 `panelType` 與 `dataSource` 或可被標記 warning。
6. rich-text、transform、複雜 border-radius 等不穩定能力必須明確警告，不可靜默 fallback。
7. `--strict` 模式下，blocker 與 validate failure 必須非 0 退出。
8. 覆蓋既有 Cocos UI 時，工具必須先產生 logic inventory，列出可驗證功能；覆蓋後必須驗證同一批功能仍可通過，否則 exit 9。
9. HTML 內的簡單互動（button 開窗、tab 切換、route、modal close）不可被丟棄；能翻譯者輸出 interaction draft，不能翻譯者輸出 rewrite-required warning。
10. HTML 內的簡單動畫（opacity / scale / translate / color transition、單段 keyframes）不可靜默丟失；能翻譯者輸出 motion draft，不能翻譯者輸出 art-review warning。

生成端與 validate 的關係：

- 生成端負責早期 fail-fast。
- `validate-ui-specs.js` 負責 schema / contract / 既有規則閉環。
- 兩者不是互斥，而是前後兩道閘門。

---

## 8. HTML -> UCUF 轉譯規則摘要

轉譯主流程：

1. 解析 DOM 與 stylesheet。
2. 合併 class / id / inline style。
3. 推導節點型別。
4. 轉成 widget / layout / slot / contract。
5. 解析互動語意（`data-ucuf-action`、`data-action`、`aria-controls`、`href="#modal"`）與 motion 語意（transition / animation / keyframes）。
6. 轉成 interaction draft、motion draft 或 rewrite-required warning。
7. 生成 layout draft、skin draft、可選 screen draft。
8. 追加 preload / performance / logic / interaction sidecar。
9. 執行 validate / telemetry / syncDelta / logic guard。

型別推導摘要：

| 條件 | 輸出 |
|---|---|
| `canvas` / `svg` / chart-like class | `composite` |
| `img` | `image` |
| `button` | `button` |
| `p` / `span` / `h1`... | `label` |
| 有背景色 / 背景圖 | `panel` |
| `data-panel` | `child-panel` |
| `data-slot` | `container` + `lazySlot: true` |
| 其他 block | `container` |

widget / layout 摘要：

| HTML / CSS | UCUF |
|---|---|
| `data-anchor="fill"` | `widget: {top,left,right,bottom:0}` |
| `display:flex; flex-direction:row` | `layout.type: "horizontal"` |
| `display:flex; flex-direction:column` | `layout.type: "vertical"` |
| `gap` | `spacingX / spacingY` |
| `padding` | `paddingTop / Right / Bottom / Left` |

---

## 9. 實際範例一：簡單 label 轉譯

HTML：

```html
<p class="title" data-name="BannerTitle">轉蛋活動進行中</p>
```

CSS：

```css
.title {
  color: #ffffff;
  font-size: 32px;
  line-height: 44px;
  letter-spacing: 2px;
  text-align: center;
}
```

Layout draft：

```json
{
  "type": "label",
  "name": "BannerTitle",
  "widget": { "top": 0, "left": 0, "right": 0, "bottom": 0 },
  "text": "轉蛋活動進行中",
  "styleSlot": "auto.gacha-banner.bannertitle"
}
```

Skin draft：

```json
{
  "kind": "label-style",
  "font": "fonts/newsreader/font",
  "fontSize": 32,
  "lineHeight": 44,
  "letterSpacing": 2,
  "color": "colorWhite",
  "outlineColor": "colorOutlineDark",
  "outlineWidth": 2,
  "horizontalAlign": "CENTER"
}
```

---

## 10. 實際範例二：Gacha Banner + LazySlot

HTML：

```html
<div class="gacha-screen" data-anchor="fill">
  <div class="banner" style="width:1080px;height:240px">
    <img src="sprites/ui_gacha/banner/banner_main" data-name="BannerImg">
    <p class="title" data-name="BannerTitle" data-contract="banner.title">轉蛋活動進行中</p>
  </div>
  <div data-slot="featured-list" data-default-fragment="empty-list" data-warmup-hint="next-frame"></div>
  <div data-slot="history-panel" data-default-fragment="loading" data-warmup-hint="idle"></div>
</div>
```

轉譯重點：

1. `banner` 轉成 `panel`。
2. `img` 轉成 `image` child。
3. `p` 轉成 `label` child。
4. `data-slot` 轉成 `lazySlot`，保留 `defaultFragment` 與 `warmupHint`。

這是目前 self-test 的主要 fixture，已驗證 nested children、preload split、sync preserve-human 等行為。

---

## 11. 實際範例三：色塊濫發風險警告

若同一父節點底下同時存在大量 `background-color` panel，生成端應立即標記：

1. `color-rect-count-warning`
2. `composition-block-risk`

原則：生成器可以接受草稿，但必須把 overdraw 風險浮到最前面，不得靜默吞掉。

---

## 12. 建議的實作架構

目前模組切分以零依賴 Node 工具為主：

| 檔案 | 職責 |
|---|---|
| `tools_node/dom-to-ui-json.js` | 主 CLI、screen / preload / performance / validate / sync 入口 |
| `tools_node/lib/dom-to-ui/html-parser.js` | HTML tokenizer + parser |
| `tools_node/lib/dom-to-ui/draft-builder.js` | 遞迴 `processElement`、type inference、slot / widget / layout 生成 |
| `tools_node/lib/dom-to-ui/smart-merge.js` | `--sync-existing`、preserve-human / dry-run |
| `tools_node/lib/dom-to-ui/preload.js` | preload manifest |
| `tools_node/lib/dom-to-ui/performance.js` | performance report |
| `tools_node/lib/dom-to-ui/atlas.js` | atlas budget / duplicate sprite / texture estimate |
| `tools_node/lib/dom-to-ui/telemetry.js` | JSONL append / read / prune |
| `tools_node/lib/dom-to-ui/feedback-aggregate.js` | aggregate / drift / threshold suggestion |
| `tools_node/lib/dom-to-ui/evolution-log.js` | append-only evolution entry |

設計原則：

1. 生成與驗證分離。
2. 結構推導與 Smart Merge 分離。
3. Telemetry 與 feedback 為 sidecar，不汙染主轉譯路徑。

---

## 13. 關鍵 helper 建議

必要 helper：

1. `parseInlineStyle()`
2. `parseStylesheets()`
3. `inferNodeType()`
4. `anchorToWidget()`
5. `inferLayout()`
6. `parseColor()`
7. `computeLetterSpacing()`
8. `ensureSpriteSlot()`
9. `ensureLabelStyle()`
10. `smartMerge()`

這些 helper 的價值在於讓規則集中，而不是散落在 CLI 主流程裡。

---

## 14. 錯誤處理政策

本工具遵守 fail-fast：

1. 解析不到必要欄位時，優先 warning 或 fail，不自動猜測真值。
2. 對應不到 token 時，先輸出 `unmapped-*` warning，不偷偷硬塞 hex 到 layout。
3. 遇到 validate fail，在 `--strict` 模式下必須停止。
4. Smart Merge 遇到不可自動決策欄位，要有 `sync-conflict` 或 exit code，不能靜默覆蓋人工欄位。

---

## 15. 與 `ui-vibe-pipeline` 的整合方式

本工具位於 UI pipeline 的「中介草稿生成」位置：

1. 參考圖 / handoff -> HTML 或準 HTML source。
2. `dom-to-ui-json.js` 產出 `layout` / `skin` / `screen draft` / sidecar。
3. `scaffold-ui-component.js --ucuf` 生成 TypeScript 骨架。
4. `validate-ui-specs.js`、runtime check、preview QA 做閉環。

它不是 UI family 選型器，也不是最終 QA 判官；它的任務是把可自動化的部分穩定做對。

---

## 16. 實作分階段建議

實作順序建議：

1. 先完成 parser + draft-builder。
2. 再接 validate / screen draft。
3. 再補 sync-existing。
4. 最後補 preload / performance / telemetry / feedback。

原因：前一層若不穩，後一層只會把錯誤自動化放大。

---

## 17. 最低交付標準

可宣告「可用」至少要同時滿足：

1. 能產出合法 layout / skin draft。
2. 能執行 `validate-ui-specs.js`。
3. 主要 nested children 能保留。
4. `lazySlot`、`child-panel`、`styleSlot`、`skinSlot` 不丟失。
5. `--strict` 與 `--warn-only` 行為可預期。

---

## 18. 結論摘要

這支工具的核心價值不是「自動化一切」，而是「把最耗時、最規則化、最容易出錯的轉譯工作標準化，並在生成當下就把風險暴露出來」。

---

## 19. 座標系統差異與 Y 軸翻轉守則

HTML / CSS 與 Cocos 的座標語意不完全相同，尤其在：

1. `top / left / right / bottom` 轉 widget。
2. SVG / Canvas 的資料座標系與 Cocos 顯示座標。
3. `transform` 與 `viewBox` 這類幾何資訊。

原則：

1. 一般 block / label / image 走 widget。
2. 真正的圖表或畫布內容，改走 `composite`，不要硬展平成 panel / image tree。
3. 超過目前轉譯能力的變形資訊，直接 warning。

---

## 20. Canvas / SVG -> `composite` 轉換規則

以下條件應直接走 `composite`：

1. `canvas`
2. `svg`
3. class 含 `chart` / `radar` / `progress-ring` / `gauge`

`composite` 的責任不是立刻生成最終 renderer，而是留下可被人工或後續工具接手的宿主節點與提示資訊。

建議欄位：

```json
{
  "type": "composite",
  "name": "StatsRadar",
  "_warnings": ["composite-needs-manual-wiring"],
  "_compositeHint": {
    "sourceTag": "svg",
    "axisCount": 6,
    "gridRings": 4
  }
}
```

---

## 21. 實際範例四：SVG -> composite draft

HTML：

```html
<svg class="radar-chart" viewBox="0 0 240 240"></svg>
```

Layout draft：

```json
{
  "type": "composite",
  "name": "GeneralStatsRadar",
  "widget": { "top": 0, "left": 0, "right": 0, "bottom": 0 },
  "_warnings": ["composite-needs-manual-wiring"],
  "_compositeHint": {
    "sourceTag": "svg",
    "size": { "width": 240, "height": 240 }
  }
}
```

---

## 22. ChildPanel 語義映射與 `skinLayers`

ChildPanel 不等於複雜容器；它是資料驅動的子面板。建議門檻：

1. 有明確 `data-panel` / `data-child-type`
2. 有 `data-datasource`
3. 或明顯為重複同構 item

`skinLayers` 則用來合併多層視覺，但維持單一邏輯節點。適用場景：

1. 背景色 + 背景圖
2. frame + fill + bleed
3. 不想讓兄弟節點暴增的裝飾層

目前實作為 basic 版本：背景圖 + 背景色可拆成兩層 `skinLayers`，更複雜的多層組合仍保留後續擴充空間。

---

## 23. Token 提取自動化

理想狀態應同時處理：

1. hex -> token reverse lookup
2. `rgba()` -> `color + opacity`
3. `var(--xxx)` -> token 映射
4. spacing token reverse lookup
5. typography scale reverse lookup

目前已落地：

1. `tools_node/lib/dom-to-ui/token-registry.js` 讀取 runtime token 與 handoff token，合併 `colors` / `spacing` / `typography`。
2. hex / rgba 會反查 token；`rgba()` 會拆成 `color + opacity`。
3. `var(--xxx)` 可對應 color / spacing / typography token，未命中會輸出 `unmapped-css-var`。
4. flex `gap` 與 `padding` 會保留 px 數值，並在 `skinDraft.meta.tokenUsageReport.spacing[]` 記錄 token 命中。
5. label 的 `font-size + line-height` 可反查 `ui-design-tokens.typography`，命中時填入 label-style `style`。
6. `font-weight: 600+`、`bold`、`bolder` 會轉為 label-style `isBold: true`。
7. `line-height`、`letter-spacing` 仍保留 px 整數換算，避免 runtime 直接依賴 CSS 單位。

仍待補強：

1. nearest-token suggestion：接近但不完全命中的 spacing / typography 應輸出建議。
2. strict fail policy：在 `--strict` 下，未映射 token 何時要 fail 仍需統一。
3. typography 的字型 family / weight / paragraph role 還可再細分。

---

## 24. Slot 與 Lazy Loading 識別

`data-slot` 代表此區塊應被視為可延後載入的容器。生成時至少保留：

1. `name`
2. `lazySlot: true`
3. `defaultFragment`
4. `warmupHint`

Nested lazySlot 原則：

1. 第一層可接受。
2. 第二層可接受，但應有清楚的 fragment 邊界。
3. 超過兩層應輸出 `nested-lazyslot-depth-risk`。

---

## 25. Content Contract 自動生成

HTML 若提供 `data-contract` / `data-datasource`，screen draft 應能收斂成 `contentRequirements` 的初稿，而不是只停留在 layout 私有欄位。

原則：

1. layout 留 `_contract` / `dataSource` 提示。
2. screen draft 收 `contentRequirements`。
3. 最終 `validate-ui-specs.js --check-content-contract` 才是正式閉環。

---

## 26. CompositePanel 核心解析邏輯範例

高層流程可概括為：

```js
parseHtml(html)
  -> parseStylesheets()
  -> processElement(root)
  -> build layoutDraft + skinDraft
  -> optional screenDraft / preload / performance
  -> optional smartMerge(existing)
  -> validate + telemetry
```

`processElement()` 的責任應集中在：

1. 合併 style 來源
2. 推導型別
3. 生成 widget / layout
4. 產生 slot / styleSlot / skinLayers
5. 遞迴 children
6. 累積 warnings

---

## 27. 轉換後標註範例（layout.json + skin.json）

建議在 draft 中明確保留來源資訊，方便後續人工 debug：

```json
{
  "type": "label",
  "name": "BannerTitle",
  "text": "轉蛋活動進行中",
  "styleSlot": "auto.gacha-banner.bannertitle",
  "_contract": "banner.title",
  "_sourceClass": ["title"],
  "_sourceStyle": {
    "fontSize": "32px",
    "lineHeight": "44px",
    "color": "#ffffff"
  },
  "_warnings": []
}
```

這類標註的目的是降低 diff 與人工修正成本，不是讓 runtime 直接依賴它們。

---

## 28. 邏輯錯誤修正與文件精簡原則

本文件重整後採以下原則：

1. 保留功能說明、邊界與範例。
2. 刪除重複的 milestone 敘述、重複的驗收標準與重複的歷程說明。
3. 所有里程碑與 Checklist 統一收斂到文件尾端。
4. 已落地能力與未完成項目明確分開，不再把規劃與現況混寫。

---

## 29. 文件使用說明

閱讀順序建議：

1. 新接手者先看 §1–§5。
2. 實作者看 §8–§15。
3. 要補 composite / sync / performance / feedback 時，看 §19–§36。
4. 要判斷優先級與工作項目時，直接看文件最後的 §38–§39。

---

## 30. 最終階段技術審核：流程邊界與宿主識別

硬邊界如下：

1. HTML root 不等於 `child-panel`。
2. Screen 宿主是 `CompositePanel`，不是 DOM root 本身。
3. root 應優先輸出成 layout root；重複資料區塊才考慮 `child-panel`。
4. `lazySlot` 管片段載入，不直接替代 route 系統。

實務判定：

| 情況 | 處理 |
|---|---|
| `body` / `main` / screen 外層容器 | layout root |
| `data-panel` + `data-datasource` | `child-panel` |
| 背景圖 + 文本 + icon 的裝飾卡片 | `container` / `panel` + children |
| `svg` / `canvas` | `composite` |
| slot 容器 | `lazySlot` |

---

## 31. 增量同步與 Smart Merge

`--sync-existing` 的目標是更新，不是重產。

Stable key 建議優先順序：

1. `data-ucuf-id`
2. `data-name`
3. `data-contract`
4. `data-slot`
5. semantic hash

Merge mode：

| 模式 | 行為 |
|---|---|
| `preserve-human` | 既有人工欄位優先 |
| `html-authoritative` | HTML 結果覆寫 |
| `dry-run` | 只算 diff，不寫檔 |

保留優先欄位：

1. `skinSlot`
2. `styleSlot`
3. `dataSource`
4. `config`
5. 自定義 `_` 欄位

sync 後應至少執行：

```bash
node tools_node/validate-ui-specs.js --strict --check-content-contract
```

若觸及 fragment，應再補 runtime check。

若覆蓋的是已接上 Cocos 邏輯的正式 UI，`--sync-existing` 必須升級為「先盤點、再覆蓋、後驗證」：覆蓋前輸出 `<screen>.logic-inventory.json`，列出現有 button handlers、route targets、bind paths、child panel routes、lazySlot fragment、public panel API 與可執行 smoke tests；覆蓋後輸出 `<screen>.logic-guard.json`，比對這些功能是否仍存在並執行可自動化的驗證。任何 handler target 消失、bind path 失效、route 缺 target、必要 panel API 被移除，strict 模式下一律 exit 9。

若工具判斷某功能無法自動保留，必須在 `rewriteRequired[]` 內列出：`featureId`、`sourceFile`、`reason`、`suggestedOwner`、`blockingLevel`，並把事件送入 Error Log / telemetry；若該 rewrite 形成新規則，必須 append `docs/html_skill_rule-evolution.md`，不可只留在 terminal output。

---

## 32. UI 性能深度分析：結構治理

生成端至少應觀察：

| 指標 | warning | blocker |
|---|---:|---:|
| layout nodeCount | > 35 | > 50 |
| maxDepth | > 8 | > 12 |
| 同父 `color-rect` 數 | > 2 | >= 4 |
| 同區塊重複 item | >= 3 | 建議 child-panel / fragment |

設計重點：

1. 過多 color-rect 優先合併成 `skinLayers`。
2. 非首屏區塊優先進 lazySlot / fragment。
3. 避免為了過 validate 而把複雜結構硬降級成錯誤型別。

---

## 33. 加載性能優化：資產 Budget 與 Sidecar

本工具現行 sidecar 包括：

1. `<screen>.preload.json`
2. `<screen>.performance.json`

核心規則：

| 能力 | 原則 |
|---|---|
| atlas budget | 單 screen atlas 來源 ≤ 4 |
| preload manifest | 首屏只收 root 與非 lazySlot 後代 |
| deferred | 按 lazySlot 分組 |
| warmup hint | 第 0 個 `next-frame`，1–2 個 `idle`，其餘 `manual` |
| texture estimate | `width * height * 4` |

`performance report` 應至少含：

1. `rendering`
2. `loading`
3. `lifecycle`
4. `verdict`

---

## 34. 目前實作狀態（2026-04-26）

### 34.1 已落地模組

| 檔案 | 狀態 | 說明 |
|---|---|---|
| `tools_node/dom-to-ui-json.js` | 已落地 | 主 CLI、screen / preload / performance / validate / sync / composite / bundle / sync-report / r-guard / interaction / motion / logic / visual-review |
| `tools_node/dom-to-ui-accuracy.js` | 已落地 | 重複拆解 + 等價 perturbation + baseline 比對 + visual review / logic guard linkage 的 accuracy harness（§40） |
| `tools_node/dom-to-ui-logic-guard.js` | 已落地 | 覆蓋既有 Cocos UI 前後的功能盤點、smoke 驗證與 rewrite report（§41） |
| `tools_node/lib/dom-to-ui/html-parser.js` | 已落地 | 零依賴 tokenizer + parser |
| `tools_node/lib/dom-to-ui/token-registry.js` | 已落地 | runtime + handoff token 合併與 reverse lookup |
| `tools_node/lib/dom-to-ui/draft-builder.js` | 已落地 | 遞迴 children、type inference、`_ucufId` / `_lockedFields`、composite 收集、specVersion / canvas |
| `tools_node/lib/dom-to-ui/smart-merge.js` | 已落地 | preserve-human / html-authoritative / dry-run，支援 `_ucufId` 對齊與 `_lockedFields` 鎖定 |
| `tools_node/lib/dom-to-ui/sidecar-emitters.js` | 已落地 | composite report / bundle suggestion / skin-layer-atlas-risk / sync report / R-guard summary / fragment route patch |
| `tools_node/lib/dom-to-ui/logic-guard.js` | 已落地 | 掃描既有 UI script / screen contract / route，產生 logic inventory 與 guard verdict |
| `tools_node/lib/dom-to-ui/interaction-translator.js` | 已落地 | HTML button / link / dialog / tab 語意轉 interaction draft |
| `tools_node/lib/dom-to-ui/motion-translator.js` | 已落地 | CSS transition / animation / keyframes 轉 motion preset draft |
| `tools_node/lib/dom-to-ui/visual-review.js` | 已落地 | screenshot zone confidence、button state-layer、motion / interaction / logic linkage 的靜態視覺評審 |
| `tools_node/lib/dom-to-ui/preload.js` | 已落地 | preload manifest |
| `tools_node/lib/dom-to-ui/performance.js` | 已落地 | performance report |
| `tools_node/lib/dom-to-ui/atlas.js` | 已落地 | atlas budget / duplicate sprite / texture estimate |
| `tools_node/lib/dom-to-ui/telemetry.js` | 已落地 | env-gated JSONL telemetry，accuracy 結果亦寫入 |
| `tools_node/lib/dom-to-ui/accuracy-harness.js` | 已落地 | perturbation 生成、結構簽名、token coverage、warning precision/recall |
| `tools_node/dom-to-ui-feedback.js` | 已落地 | aggregate / field-stability / suggest / drift / prune / `--update-checklist` |
| `tools_node/lib/dom-to-ui/evolution-log.js` | 已落地 | append-only evolution helper |
| `tools_node/test/dom-to-ui-self-test.js` | 已落地 | 17-step self-test（含 variant / fragment / runtimeGate / logic / interaction / motion / visual accuracy） |
| `tests/fixtures/dom-to-ui/gacha-banner.html` | 已落地 | nested children + lazySlot fixture |
| `tests/fixtures/dom-to-ui/gacha-banner.accuracy-baseline.json` | 已落地 | accuracy harness 門檻基線 |
| `tests/fixtures/dom-to-ui/lobby-action.html` | 已落地 | button 開窗 + motion + visual zone baseline |
| `tests/fixtures/dom-to-ui/general-detail-tabs.html` | 已落地 | tab switch + fragment route baseline |
| `tests/fixtures/dom-to-ui/battle-hud.html` | 已落地 | battle HUD + child-panel + visual zone baseline |
| `tests/fixtures/dom-to-ui/interaction-motion.html` | 已落地 | interaction / motion translation fixture |

### 34.2 已驗證能力

1. nested children 正確保留。
2. `lazySlot` 保留 `defaultFragment` 與 `warmupHint`。
3. `label-style` 自動補 `outlineColor: colorOutlineDark`、`outlineWidth: 2`。
4. `--validate` 已串 `validate-ui-specs.js`。
5. `--sync-existing preserve-human` 已可保留人工欄位。
6. `--merge-mode dry-run` 已確認不寫檔。
7. CSS var 可映射 color token，spacing / typography 可產生 token usage report。
8. `font-weight` 可轉為 `isBold`。
9. `db://` / 絕對路徑會被 asset guard 攔截。
10. `transform` / `overflow` / z-index / asymmetric radius / node opacity / CSS effect 會輸出美術風險 warning。
11. self-test 目前 `17/17 PASS`，含 accuracy / variant / fragment / runtimeGate / logic / interaction / motion / visual review 步驟。
12. `data-ucuf-id` 已可作為 sync-existing 的 stable key，`data-ucuf-lock` 可鎖欄位避免被 HTML 覆寫。
13. layout root 已自動帶 `specVersion: 1` 與 `canvas.designWidth/designHeight`（可由 `<html data-canvas-width>` 或 `--canvas` 提示）。
14. composite slot 會輸出 `<screen>.composite.json`、bundle 建議輸出 `<screen>.bundle-suggestion.json`、sync 結果輸出 `<screen>.sync-report.json`、R-guard 結果輸出 `<screen>.r-guard.json`。
15. strict 模式下 `unmapped-color` / `unmapped-css-var` / `forbidden-node-type` / `asset-path-guarded` / R-guard fail 會非 0 退出（exit 6 / 7）。
16. accuracy harness 對單一 fixture 5 次重複 + 4 種等價 perturbation 已穩定回 `idempotencyRate=1`、`structuralStability=1`。
17. `--variant-mode gacha-3pool` 已輸出 `previewVariants: hero/support/limited`。
18. `scaffold-ui-component.js --ucuf --check-ucuf` 已可乾跑驗證 CompositePanel / ContentContractRef 骨架。
19. `<screen>.fragment-routes.json` 已輸出 lazySlot defaultFragment 與 tabSwitch interaction route patch。
20. `<screen>.performance.json` 已包含 `runtimeGate.nodeCount` / `runtimeGate.maxDepth`，strict 可擋 maxDepth blocker。
21. `dom-to-ui-logic-guard.js --mode inventory|verify` 已可輸出 logic inventory / guard verdict；strict fail 以 exit 9 中止。
22. `dom-to-ui-json.js` 會輸出 `<screen>.interaction.json`、`<screen>.motion.json`、`<screen>.logic-inventory.json`、`<screen>.logic-guard.json`、`<screen>.visual-review.json`。
23. `data-ucuf-action` / `data-action` / `data-open-panel` / `aria-controls` / `href="#target"` 已可翻譯為 openPanel / tabSwitch / routePush / closeModal draft。
24. CSS transition 與簡單 keyframes 已可轉 motion draft；motion token 已提供 instant / fast / standard / slow / emphasis。
25. accuracy harness 已擴充 lobby / general-detail / battle 三個 baseline，並帶 screenshotZoneConfidence / motionPresenceRate / interactionSuccessRate。
26. visual review 已檢查 button state-layer、composite review、CSS effect review，並可與 logic guard verdict 串接。

### 34.3 已完成後的不足與流程風險

本輪已把 Checklist 全部落到可執行工具與自測，但仍有三類「流程風險」需要技術總監持續管控：

1. **靜態 smoke 不等於真機互動**：logic guard 目前能檢查節點、handler 線索、bind path、route 與 Error Log 摘要；真正點擊、動畫播放與 Cocos lifecycle 還需接 Browser / Editor Preview QA。
2. **visual review 是靜態信心分數**：`screenshotZoneConfidence` 確保 zone 有穩定 bounds，但還不是實際像素比對；正式畫面必須把 screenshot artifact 接進 §43 流程。
3. **interaction / motion 只處理宣告式語意**：工具不執行 inline JS，也不嘗試推導 gameplay 邏輯；遇到複雜 adapter 必須進 `rewriteRequired[]` 與 evolution log。
4. **nearest-token suggestion 仍是體驗優化，不再是阻塞項**：目前 strict 能 fail unmapped token；後續若要降低人工修 token 成本，可把 nearest-token 作為 M12 改善，不影響 M0-M11 完成狀態。
5. **正式畫面 baseline 仍需逐步擴充**：目前新增 lobby / general-detail / battle 為工具級 fixtures；真正導入時，每個正式 screen 仍要有自己的 logic / accuracy / visual baseline。

### 34.4 美術總監風險判準

HTML 轉 UCUF 時，工具只應自動處理可穩定映射的視覺資訊；下列情況要 warning，交給人工視覺審核：

| warning | 美術瑕疵風險 | 建議處理 |
|---|---|---|
| `css-transform-manual-layout-risk` | DOM transform 轉 Cocos widget 容易出現對位、縮放與動線殘差 | 改成正式 widget / transition 設定 |
| `overflow-hidden-clipping-risk` | 可能裁掉水墨 bleed、glow、外框花角或九宮外沿 | 拆出可控 mask 或保留足夠 bleed |
| `z-index-manual-zorder-risk` | DOM z-index 與 UCUF children / skinLayers 順序不一定等價 | 人工確認 children order 與 zOrder |
| `asymmetric-border-radius-approximated` | 非對稱圓角難用單一 color-rect 或九宮格自然呈現 | 產出專用 sprite 或拆角邊件 |
| `node-opacity-washes-children-risk` | 容器 opacity 會把子文字與 icon 一起洗淡 | opacity 應放在背景 skin slot |
| `css-effect-needs-art-review` | box-shadow / filter / backdrop-filter 直接近似會失去材質層次 | 改成 sprite layer / skinLayers |
| `asset-path-guarded` / `asset-missing-placeholder` | 錯誤或不存在的資產會讓畫面落成 placeholder | 回補正式 `assets/resources` 內路徑 |
| `motion-token-missing` | 動畫時長與 easing 沒有設計 token，會讓 UI 像網頁 hover 而不是遊戲介面 | 建立 motion token：duration / easing / delay / emphasis |
| `interaction-visual-affordance-missing` | HTML 有開窗或切頁行為，但 Cocos 轉譯後沒有 hover / pressed / disabled / focus 視覺狀態 | button skin 必須補齊 state layers 與聲光 feedback hint |
| `visual-regression-needs-screenshot` | accuracy 結構通過，但截圖可能仍有文字擠壓、bleed 裁切、CTA 層級漂移 | 將主畫面納入 screenshot zone review，與 §40 accuracy 並行 |

美感上的核心原則：token 能保證色彩與字級不漂移；warning 則保留「人眼判斷」的入口，不讓工具把高風險 CSS 粗暴轉成看似合法但不耐看的 UI。

---

## 35. CLI 推薦組合與交付建議

### 35.5 React / Vue / Babel-rendered HTML 的 pre-render（M12 新增）

`dom-to-ui-json.js` 是純靜態 parser。React / Vue / Babel-rendered 等 client-render 框架的 HTML 在沒有跑 JS 之前只是空殼（`<div id="root"></div>`），直接餵給本工具會只抓到 < 30 個 shell 節點，整個 UI 被當成空容器。

**判別規則**

| 訊號 | 判讀 |
|---|---|
| HTML 內 `data-anchor` / `data-ucuf-id` / `data-name` / `data-contract` / `data-slot` 命中數為 `0` | 必為 LLM 生成 / 設計師導出 / runtime-rendered，需評估 |
| 同時 grep 到 `react|babel|vue|svelte|solid|createElement` | 必須 pre-render |
| 主要 `<body>` 內可見子節點數量 < `10` 但檔案 > 5KB | 高機率為 shell-only，建議 pre-render 比對 |

**標準 pre-render 步驟**

```bash
node tools_node/render-html-snapshot.js \
  --input  "Design System 3/ui_kits/<screen>/index.html" \
  --output "artifacts/skill-test-html-to-ucuf/<screen>.rendered.html" \
  --viewport 1920x1080 \
  --settle-ms 1500
```

之後步驟 35.x 全部使用 `<screen>.rendered.html` 當 `--input`，不要再回頭用原始 `index.html`。

**已知後遺症**

1. Pre-render 出來的 DOM 通常會比手寫 HTML 多很多 wrapper `<div>`。例如 DS3 character index.html 在 pre-render 後是 `176` 節點 / `12` 層深，會直接撞 `runtimeGate.nodeCount.blocker = 60`。
2. 這個 nodeCount blocker 是真實告警，不能 silently ignore。處理方式：
   - 在 React source 加入 `data-anchor="fill"` / `data-name="..."` / `data-contract="..."` 之類語意收斂層級
   - 或改寫 React 把多餘 wrapper div 砍掉
   - 重新 pre-render 後 nodeCount 應降到合理區間
3. Pre-render 後的 button/clickable 元素若沒有 `data-ucuf-action`，會在 visual-review 顯示 `state-layer-coverage: 0`，這也是真實告警。

### 35.10 新畫面（純靜態 HTML）

```bash
DOM_TO_UI_TELEMETRY=1 \
node tools_node/dom-to-ui-json.js \
  --input artifacts/ui-source/<screen>/source.html \
  --output assets/resources/ui-spec/layouts/<screen>.json \
  --skin-output assets/resources/ui-spec/skins/<screen>.skin.json \
  --screen-id <screen-id> \
  --bundle <bundle> \
  --emit-screen-draft \
  --emit-preload-manifest \
  --emit-performance-report \
  --strict \
  --validate
```

增量同步：

```bash
DOM_TO_UI_TELEMETRY=1 \
node tools_node/dom-to-ui-json.js \
  --input artifacts/ui-source/<screen>/source.html \
  --output assets/resources/ui-spec/layouts/<screen>.json \
  --skin-output assets/resources/ui-spec/skins/<screen>.skin.json \
  --screen-id <screen-id> \
  --bundle <bundle> \
  --sync-existing \
  --merge-mode preserve-human \
  --conflict-policy fail \
  --emit-preload-manifest \
  --emit-performance-report \
  --strict \
  --validate
```

本地回歸：

```bash
node tools_node/test/dom-to-ui-self-test.js
node tools_node/validate-ui-specs.js
node tools_node/check-encoding-touched.js
node tools_node/dom-to-ui-accuracy.js \
  --input tests/fixtures/dom-to-ui/gacha-banner.html \
  --screen-id gacha-banner --bundle ui_gacha \
  --baseline tests/fixtures/dom-to-ui/gacha-banner.accuracy-baseline.json \
  --output artifacts/dom-to-ui-accuracy/gacha-banner.json \
  --iterations 5 --strict
```

新增 sidecar（CLI 自動產生，無需額外 flag）：

| 檔案 | 觸發條件 | 說明 |
|---|---|---|
| `<screen>.composite.json` | 偵測到 `canvas` / `svg` / chart-like class | composite slot 報告，列出 reason / 設計尺寸 / rendererHint |
| `<screen>.bundle-suggestion.json` | 預設啟用（`--no-emit-bundle-suggestion` 可關） | sprite 路徑 bundle 分布 + 建議 + skin-layer-atlas-risk |
| `<screen>.sync-report.json` | `--sync-existing` 有實際 delta | before / after node count、fieldChanges、conflicts、locked-preserved 計數 |
| `<screen>.r-guard.json` | 預設啟用（`--no-emit-r-guard` 可關） | R25 / R27 / R28 / forbiddenNodeType / unmappedToken 摘要 |

M9 / M10 落地後，覆蓋正式 UI 的增量同步必須多跑兩道 gate：

```bash
node tools_node/dom-to-ui-logic-guard.js \
  --screen-id <screen-id> \
  --layout assets/resources/ui-spec/layouts/<screen>.json \
  --screen assets/resources/ui-spec/screens/<screen>-screen.json \
  --component assets/scripts/ui/components/<Screen>Composite.ts \
  --output artifacts/dom-to-ui-logic/<screen>.before.json \
  --mode inventory

node tools_node/dom-to-ui-json.js ... --sync-existing --merge-mode preserve-human --strict --validate

node tools_node/dom-to-ui-logic-guard.js \
  --screen-id <screen-id> \
  --baseline artifacts/dom-to-ui-logic/<screen>.before.json \
  --layout assets/resources/ui-spec/layouts/<screen>.json \
  --screen assets/resources/ui-spec/screens/<screen>-screen.json \
  --component assets/scripts/ui/components/<Screen>Composite.ts \
  --output artifacts/dom-to-ui-logic/<screen>.after.json \
  --mode verify \
  --strict
```

互動與動畫 translation 產物需併入交付件：

| 檔案 | 說明 |
|---|---|
| `<screen>.interaction.json` | button / link / tab / modal 觸發規則、target、驗證步驟 |
| `<screen>.motion.json` | transition / keyframes 轉出的 duration / easing / property / target |
| `<screen>.logic-guard.json` | 覆蓋前後功能差異、smoke verdict、rewriteRequired 清單 |

---

## 35.6 性能優化工具鏈（M13 新增）

`render-html-snapshot` 解決了「React/Babel HTML → 拿得到節點」之後，立刻浮現三類性能問題：

1. **nodeCount 爆表**：React 慣性多包 wrapper `<div>`，176 節點裡有 ~10% 是純結構 noise
2. **button state layer 缺漏**：CSS `:hover` 只存在於樣式表，dom-to-ui-json 只能擷取 `:not(:hover)` 的 base 樣式
3. **unmappedToken**：來自外部設計系統的 hex 不在 `ui-design-tokens.json`，自動降級成 sentinel `unmappedColor`

### 35.6.1 三件式工具

| 工具 | 解決問題 | 演算法 |
|---|---|---|
| `tools_node/optimize-ucuf-layout.js` | nodeCount | 折疊 auto-generated 單子 wrapper container（無 skin/style/contract/text/wh、widget=fill、name 符合 `*_div_N` pattern）+ 刪除 empty leaf container；最多 N pass 直到收斂 |
| `tools_node/auto-fix-ucuf-skin.js` | button state + tokens | 1) 讀 `visual-review.stateLayerIssues`，對每個受影響 skin slot 用 HSL ±8%/-20% lightness 推導 hover/pressed/disabled。2) 掃 skin 全部 hex 字面值，建議 token 名（已存在 → 復用；不存在 → 加進 `ui-design-tokens.json`） |
| `tools_node/render-ucuf-layout.js` | UCUF→HTML 真實 fidelity gate | 把 layout+skin 還原成 HTML（widget→position:absolute、layout→flex、skinSlot→bg-color/sprite、styleSlot→font-*），給 dom-to-ui-compare 做 source HTML / captured DOM / **UCUF preview** 三方對照 |

### 35.6.2 Sentinel 處理

dom-to-ui-json 用以下 sentinel 標記未解析欄位，下游工具必須認得：

| Sentinel | 出現位置 | 下游處理 |
|---|---|---|
| `unmappedColor` | skin slot `color` | `auto-fix-ucuf-skin.js` 用 fallback `#404a5c` 衍生 state，並標 `_needsManualReview: true` |
| `unmappedFont` | label-style `font` | （規劃中）替換為 `system-ui` |
| `auto.<screenId>.<nodeName>` | skin slot key | 所有自動生成 slot 都用此 prefix，方便日後 token 重整 |

### 35.6.3 高內容量畫面（multi-tab content page）的策略

對 character page 這種 **6-tab × 12 stat label** 結構，nodeCount 必然 ≥120。技術總監判斷：

- 不要硬壓 total nodeCount（壓不下來且會破壞語意）
- 在 `<screen>.performance.json` 寫 `runtimeGate.nodeCount.acceptedException = { reason: 'multi-tab-content-page', effectiveActiveBudget: 60 }`
- 在 `<screen>.bundle-suggestion.json` 寫 `tabLazyLoadPlan`，定義 shell + 每個 tab 的估計節點數與 `mount: 'eager' | 'lazy'`
- ChildPanel runtime 只 mount 當前 tab，active 節點數 = shell + 1×tab ≈ 50

### 35.6.4 標準性能優化流程（在 dom-to-ui-json 之後執行）

```bash
# 1. 收斂節點
node tools_node/optimize-ucuf-layout.js \
  --input  assets/resources/ui-spec/layouts/<screen>.json \
  --report artifacts/skill-test-html-to-ucuf/<screen>.optimize-report.json

# 2. 補 button state + token migration
node tools_node/auto-fix-ucuf-skin.js \
  --skin           assets/resources/ui-spec/skins/<screen>.skin.json \
  --visual-review  assets/resources/ui-spec/screens/<screen>.visual-review.json \
  --apply-tokens \
  --report         artifacts/skill-test-html-to-ucuf/<screen>.skin-autofix.json

# 3. 重算 sidecars（performance.nodeCount / visual-review.coverage）
node artifacts/skill-test-html-to-ucuf/refresh-sidecars.js   # 或自動腳本

# 4. UCUF preview 三方對照
node tools_node/render-ucuf-layout.js \
  --layout assets/resources/ui-spec/layouts/<screen>.json \
  --skin   assets/resources/ui-spec/skins/<screen>.skin.json \
  --output artifacts/skill-test-html-to-ucuf/<screen>.ucuf-preview.html
```

### 35.6.5 已驗證效果（character-ds3-main）

| 指標 | 優化前 | 優化後 |
|---|---|---|
| nodeCount | 176 | 156（-11%；折疊 7 + 刪除 13） |
| buttonStateLayerCoverage | 0/9 | 9/9 |
| visual-review blockers | 1 (button-state-layer-review-required) | 0 |
| performance verdict | blocker | warn (acceptedException) |
| UCUF preview HTML | n/a | 35KB renderable |

---

## 36. 反饋迴圈與自我修正機制

### 36.1 Telemetry 收集

當 `DOM_TO_UI_TELEMETRY=1` 時，工具寫入：

`artifacts/dom-to-ui-telemetry/<YYYY-MM-DD>.jsonl`

單筆紀錄至少應含：

1. `ts`
2. `tool`
3. `version`
4. `input.sourceDomHash`
5. `warnings`
6. `validate`
7. `performance`
8. `durationMs`
9. `mode`

### 36.2 規則命中率聚合

```bash
node tools_node/dom-to-ui-feedback.js --aggregate --since 30d
```

目的：統計 `warningStats`、`validateFailureCodes`，判斷哪些規則命中率高但實際價值低。

### 36.3 Manual Edit Delta 與欄位穩定性

```bash
node tools_node/dom-to-ui-feedback.js --field-stability --since 30d
```

目的：找出哪些欄位每次都要人工改，評估是否應調整自動推導策略。

### 36.4 Threshold Suggestion

```bash
node tools_node/dom-to-ui-feedback.js --suggest-thresholds --since 30d
```

原則：只產生建議，不自動改規則。

### 36.5 Drift Detection

```bash
node tools_node/dom-to-ui-feedback.js --detect-drift --since 30d
```

目的：發現長期出現的 `unmapped-color`、`unmapped-css-var`，協助 token 檔擴充。

### 36.6 規則演進 Log 與 helper

`docs/html_skill_rule-evolution.md` 為 append-only log。接受任何 suggestion 時，應：

1. 產出 patch
2. append evolution entry
3. 經人工 review 後再合併

helper：

```bash
node tools_node/dom-to-ui-feedback.js --apply-suggestion TS-001 --reviewer @username
```

---

## 37. 技術總監最終最佳實作

### 37.1 七條最佳實作鐵律

| # | 鐵律 | 實務判準 |
|---|---|---|
| 1 | Token-First | layout 不得硬塞 hex / rgba / 字型真值 |
| 2 | `skinLayers` 優先於 sibling 疊層 | 可合併的裝飾層不要展成多兄弟節點 |
| 3 | 首屏節點數要受控 | `nodeCount` > 35 就要警覺 |
| 4 | Atlas ≤ 4 | 對齊 R24 |
| 5 | preload 僅收首屏必要資產 | lazySlot 後代走 deferred |
| 6 | 規則演進必須有 telemetry 與 log | 不接受憑感覺調 threshold |
| 7 | 永遠 closed-loop validate | 生成與 sync 後都要進 validate |

### 37.2 UCUF 硬對齊清單

| 共識 | 生成端要求 |
|---|---|
| `outlineWidth: 2` | label-style 預設自動補 |
| `colorOutlineDark` | label-style 預設自動補 |
| `parchment` / `dark_metal` / `gold_cta` | sprite-frame slot 自動附帶 nineSlice hint |
| 繁中優先 | 簡中關鍵字要 warning |
| `UCUFLogger` | screen draft `meta.scaffoldHints.useUCUFLogger = true` |
| 禁止 `Node` / `Label` / `Sprite` | layout type 不得出現通用 Cocos 名稱 |

### 37.3 三層成熟度模型

| 階段 | 能力 |
|---|---|
| L1 | 可靠產出 layout / skin draft |
| L2 | 能做 sync 與 preserve-human 維護 |
| L3 | 有 preload / performance / telemetry / feedback 閉環 |

目前狀態：已達 `L3 core`，但部分進階項目仍待補齊。

---

## 38. 里程碑總表

| 里程碑 | 目標 | 目前狀態 | 代表產出 | 主要待補 |
|---|---|---|---|---|
| M0 | 基線與環境 | 完成 | zero-dep parser 路線、fixture、自測基線、雙 token 核心合併 | 進階 token 類別擴充 |
| M1 | 結構解析與 draft | 完成 | `html-parser.js`、`draft-builder.js`、`specVersion: 1` + `canvas` meta、composite slot report | composite renderer 規範化 |
| M2 | token / style 映射 | 完成 | `token-registry.js`、CSS var、spacing / typography report、asset guard、art warning | nearest-token suggestion 改列 M12 體驗優化 |
| M3 | validate / screen integration | 完成 | `--validate`、screen draft、rich-text warning、R-guard summary、strict unmapped fail、`--variant-mode gacha-3pool`、`--check-ucuf` | 正式畫面逐案導入 |
| M4 | sync-existing 維護 | 完成 | `smart-merge.js`、`syncDelta`、dry-run、`data-ucuf-id`、`data-ucuf-lock`、`<screen>.sync-report.json`、fragment route patch | 正式 fragment route baseline 擴充 |
| M5 | 加載性能治理 | 完成 | preload manifest、performance report、atlas budget、`bundle-suggestion.json`、`skin-layer-atlas-risk`、runtimeGate nodeCount / maxDepth | 與 Cocos runtime QA 串接 |
| M6 | feedback / evolution | 完成 | telemetry、aggregate、drift、suggestions、evolution helper、`--update-checklist` | suggestion accept 觸發 PR 自動化 |
| M7 | UCUF 硬對齊 | 完成 | outline / nineSlice / 繁中 / UCUFLogger 對齊 | 進階資產與 runtime guard 補強 |
| M8 | Accuracy Harness（§40） | 完成 | `dom-to-ui-accuracy.js`、`accuracy-harness.js`、idempotency / stability / token coverage / warning precision / visual metrics | 正式畫面 baseline 擴充 |
| M9 | Existing UI Logic Guard（§41） | 完成 | logic inventory、post-merge smoke、rewriteRequired、exit 9 | 真機點擊 smoke 串接 |
| M10 | Interaction & Motion Translation（§42） | 完成 | interaction draft、motion draft、button 開窗 / tab / modal close 翻譯、exit 10 | 複雜 adapter 人工 rewrite |
| M11 | Art Director Visual Regression（§43） | 完成 | visual zone review、motion token、state-layer review、screenshot confidence | 實際 screenshot pixel QA 串接 |

---

## 39. 整合 Checklist

### M0 基線與測試素材

- [x] `validate-ui-specs.js` 可執行
- [x] `tools_node/lib/dom-to-ui/` 模組目錄已建立
- [x] fixture 已落到 `tests/fixtures/dom-to-ui/`
- [x] 自動 self-test 已建立並可執行
- [x] 兩份 `ui-design-tokens.json` 的 colors / spacing / typography 合併流程已實作

### M1 結構解析與 Draft 生成

- [x] 零依賴 HTML parser 已可解析 document / fragment
- [x] 遞迴 children 已正確輸出 nested tree
- [x] `inferNodeType()` 已覆蓋 `container` / `panel` / `image` / `label` / `button` / `child-panel` / `composite`
- [x] `data-anchor`、flex、gap、padding 可轉為 widget / layout
- [x] `lazySlot` 已保留 `defaultFragment` / `warmupHint`
- [x] basic `skinLayers` 已落地
- [x] `.composite.json` / composite slot report 已輸出（`sidecar-emitters.buildCompositeReport`）
- [x] `specVersion: 1` / `canvas.designWidth.designHeight` 已統一輸出於 layout root（可由 `<html data-canvas-*>` 提示）

### M2 Token / Style / Asset Mapping

- [x] hex / rgba 可做基本 token / opacity 拆分
- [x] unmapped 顏色會輸出 warning
- [x] `letter-spacing` em -> px 已支援
- [x] `line-height` 已轉成 px 整數
- [x] CSS variable -> token map 已支援 color / spacing / typography 基本映射
- [x] spacing token reverse lookup 已支援 flex gap / padding 並輸出 token usage report
- [x] typography scale reverse lookup 已支援 `font-size + line-height` exact match
- [x] `font-weight -> bold` 已支援 `600+` / `bold` / `bolder`
- [x] `db://` / 絕對路徑 / missing asset guard 已落地
- [x] `transform` / `overflow` / z-index / asymmetric radius warning 已落地
- [x] node opacity / CSS effect 美術風險 warning 已落地

### M3 Validation 與 Screen Integration

- [x] `--validate` 已串接 `validate-ui-specs.js`
- [x] `--emit-screen-draft` 已輸出 screen skeleton
- [x] rich-text 會輸出 warning
- [x] `--variant-mode gacha-3pool` 已完成
- [x] `scaffold-ui-component.js --ucuf --check-ucuf` 全鏈路驗證已完成
- [x] strict 下 unmapped token / forbidden type / asset-path-guarded 會以 exit 6 中止
- [x] R25 / R27 / R28 已透過 `<screen>.r-guard.json` 自動產出 summary 並可在 strict 模式 fail（exit 7）

### M4 Sync-existing 與維護

- [x] `--sync-existing` 可讀取現有 layout / skin
- [x] `preserve-human` / `html-authoritative` / `dry-run` 三模式已可用
- [x] `syncDelta.fieldChanges[]` 已輸出
- [x] `--conflict-policy fail` 基本路徑已可用
- [x] `dry-run` 已驗證不寫檔
- [x] `data-ucuf-id` stable key 已加入並用於 sync 對齊
- [x] `data-ucuf-lock="true"` 已支援（亦可指定欄位清單，例：`data-ucuf-lock="width,height"`）
- [x] fragment / tabRouting patch 已透過 `<screen>.fragment-routes.json` 完成
- [x] sync report before / after artifact 已落地（`<screen>.sync-report.json`）

### M5 加載性能與資產 Budget

- [x] atlas budget 檢查已落地
- [x] `<screen>.preload.json` 已落地
- [x] `<screen>.performance.json` 已落地
- [x] warmup hint ladder 已落地
- [x] texture memory estimate 已落地
- [x] nested fixture 已驗證 firstScreen / deferred split
- [x] `<screen>.bundle-suggestion.json` 已落地（含 distribution + suggestion 信心度）
- [x] `skin-layer-atlas-risk` 已落地（在 bundle-suggestion 內 + warning code）
- [x] `maxDepth` / `nodeCount` 與 runtime gate 已統一輸出於 `<screen>.performance.json`

### M6 Feedback Loop 與規則演進

- [x] `DOM_TO_UI_TELEMETRY=1` env gate 已落地
- [x] `--aggregate` 已落地
- [x] `--field-stability` 已落地
- [x] `--suggest-thresholds` 已落地
- [x] `--detect-drift` 已落地
- [x] `--apply-suggestion` 已能產出 patch 並 append evolution entry helper
- [x] `--prune` 已落地
- [x] suggestion 被接受時可加 `--update-checklist <path>` 把該 entry 同步寫入指定 checklist；正式接入文件版控仍維持人工 PR review

### M7 UCUF 硬對齊

- [x] label-style 預設 `outlineWidth: 2`
- [x] label-style 預設 `outlineColor: colorOutlineDark`
- [x] 特定 family sprite-frame 自動附帶 nineSlice hint
- [x] 簡中關鍵字會觸發 `text-locale-mismatch`
- [x] screen draft 已自動填 `useUCUFLogger: true`
- [x] layout 不再輸出 `Node` / `Label` / `Sprite` 類通用型別

### 最終收工閘門

- [x] `node tools_node/test/dom-to-ui-self-test.js` -> `ALL PASS`（17/17）
- [x] `node tools_node/validate-ui-specs.js` -> layouts / skins / screens 全綠
- [x] `node tools_node/check-encoding-touched.js` -> passed
- [x] `node tools_node/dom-to-ui-accuracy.js --strict` 對 baseline fixture 通過
- [x] `scaffold-ui-component.js --ucuf --check-ucuf` 端到端回歸已補齊
- [x] fragment 觸及時的 route patch / sidecar check 已補齊

### M8 Accuracy Harness（§40）

- [x] `tools_node/dom-to-ui-accuracy.js` CLI 已落地，支援 `--baseline` / `--strict` / `--iterations`
- [x] `tools_node/lib/dom-to-ui/accuracy-harness.js` 提供 perturbation 生成 / 結構簽名 / token 覆蓋率 / warning precision
- [x] `tests/fixtures/dom-to-ui/gacha-banner.accuracy-baseline.json` 為首個基線
- [x] self-test step 10 已驗證 idempotency=1 / structuralStability=1 / tokenCoverage>=0.5
- [x] accuracy 結果寫入 telemetry（`accuracy` 欄位），可被 `--detect-drift` 與後續 suggestion 利用
- [x] 已擴充更多畫面（lobby, general-detail, battle）的 accuracy baseline

### M9 Existing UI Logic Guard（§41）

- [x] 建立 `dom-to-ui-logic-guard.js --mode inventory`，可掃描 existing layout / screen / component script / content contract。
- [x] 產出 `<screen>.logic-inventory.json`，列出 button handlers、route targets、bind paths、child panel routes、lazySlot fragment 與 public panel API。
- [x] `--sync-existing` 覆蓋前可自動產生 logic inventory，讓人先知道有哪些功能可驗證。
- [x] 覆蓋後產出 `<screen>.logic-guard.json`，比對 handler / bind path / route / API 是否消失。
- [x] 可自動 smoke 的功能會直接比對；不可自動 smoke 的功能列入 `manualVerificationRequired[]`。
- [x] strict 模式下 logic guard fail 以 exit 9 中止。
- [x] `rewriteRequired[]` 可回寫 Error Log / telemetry；形成新規則時 append `docs/html_skill_rule-evolution.md`。

### M10 Interaction & Motion Translation（§42）

- [x] 支援 `data-ucuf-action` / `data-action` / `data-open-panel` / `aria-controls` / `href="#target"` 的簡單 action 翻譯。
- [x] 支援 button 開窗、modal close、tab switch、route push 的 interaction draft。
- [x] 支援 CSS transition 的 opacity / scale / translate / color 基礎 motion 翻譯。
- [x] 支援單段 keyframes 轉 motion preset；多段複雜 keyframes 會 warning 並列 manual rewrite。
- [x] 產出 `<screen>.interaction.json` 與 `<screen>.motion.json`。
- [x] strict 模式下 action target 缺失或 motion target 缺失以 exit 10 中止。
- [x] self-test 增加 button 開窗與 motion fixture。

### M11 Art Director Visual Regression（§43）

- [x] accuracy harness 增補 screenshot zone confidence，不只比結構 hash。
- [x] 建立 motion token：duration / easing / delay / emphasis，避免沿用網頁感 transition。
- [x] button / CTA 必須檢查 normal / hover / pressed / disabled / focus 的 state-layer 完整度。
- [x] composite / CSS effect 必須輸出視覺審核 slot，不能只靠合法 JSON 通過。
- [x] tokenCoverage 門檻應依畫面類型分級：工具 fixture >= 0.5，正式 UI >= 0.8，商業 CTA / 付費入口 >= 0.9。
- [x] screenshot / preview QA 與 `<screen>.logic-guard.json` 串接，確認視覺與功能同時保留。

### M30 Wire-up Phase 0 — Tooling Audit

- [x] 列出所有 `assets/scripts/ui/components/**/*Composite*.ts` 中的 `mount(<screenId>)` 引用（20 處）
- [x] 對每個 `screenId` 標記：是否有對應 `layouts/<screenId>.json`、是否有 contentRequirements、是否有 tabRouting
- [x] 列出所有 `assets/resources/ui-spec/layouts/*.json` 但無 runtime 引用的「孤兒 JSON」（17 個 orphan）
- [x] 列出所有 `Design System*/ui_kits/<screen>/index.html` 但尚未拆解的「pending HTML」（5 個）
- [x] 把上面四個清單寫入 `docs/ui-screen-migration-coverage.md` v0

### M31 Screen Mount Registry + Dev Toggle Helper

- [x] 新增 `assets/scripts/ui/core/UIVariantRouter.ts`：抽取 `_resolveScreenId` 邏輯，支援 query / localStorage / globalThis / runtime-route.json
- [x] 新增 `tools_node/register-ucuf-runtime-route.js`：CLI 產 `<screen>.runtime-route.json`
- [x] runtime-route.json schema：`{ screenId, mountTarget, componentClass, paramSchema?, featureFlag?, fallbackScreen?, variants }`
- [x] `validate-ui-specs.js` 認得新 sidecar，沒對應 component / 未知 screenId 時 warn（`runtime-route-sidecar` warning）
- [x] 把 `GeneralDetailComposite._resolveScreenId` 改用 `UIVariantRouter.resolve('general-detail')`
- [x] self-test 覆蓋：toggle off → unified；toggle on → ds3（`tools_node/test/ui-variant-router-self-test.js` 7/7 PASS）

### M32 HTML Semantic Annotation Pass

- [x] 新增 `tools_node/annotate-html-bindings.js`
- [x] 內建反向規則庫（tab / button / portrait / stat / section / generic class slot）
- [x] 規則：tab button → `data-slot="tab.<id>"` + `data-ucuf-action="tab.switch:<id>"`；中文按鈕文字 → `data-ucuf-action`（close / confirm / cancel / share）；class 命中 portrait/header/footer/skill-list 等 → `data-slot`
- [x] `--dry-run` 列建議差異；`--apply` 寫回；`--report <json>` 輸出
- [x] self-test：對 character HTML 跑 dry-run 得 5 annotations / 5 changed lines（idempotent，重跑不重複加）

### M33 Tab ChildPanel Generator

- [x] 新增 `tools_node/generate-tab-childpanels.js --layout <json> --tabs <csv> --component-prefix <Prefix> --out-dir <ts>`
- [x] 為每個 tab 產對應 ChildPanel scaffold（繼承 `ChildPanelBase`，預載 `UCUFLogger` 與 `ROOT_PATH=Tab<Id>Content`）
- [x] 同步寫 `<screen>.tab-routing.json`：`{ tabs: [{ id, mount, lifecycle: 'lazy', childPanelClass }] }`
- [x] CompositePanel 自動產 `<screen>.tab-routing-codemod.txt`即貼即用片段（imports + `_resolveChildPanelForTab` switch + `_switchToTab` 重寫提示）
- [x] self-test：character-ds3 6 tab 一鍵產 6 ChildPanel + 路由（型別檢查零錯誤）

### M34 Runtime Visual Diff Loop

- [x] 新增 `tools_node/runtime-screen-diff.js`
- [x] **「比對工具可以先行看到結果」**：未接 runtime 也可先產出 source HTML vs UCUF preview 比對板
- [x] 流程：dom-to-ui-compare.js → 寫 `<screen>.runtime-compare.png` + `.html` + `.pixel-diff.json` → 我們 verdict
- [x] 輸出 `<screen>.runtime-verdict.json`：`{ sourceVsUcuf: { score }, runtimeVsSource, runtimeVsOld, verdict, threshold }`
- [x] 沿用 M22 hierarchical renderer 與 M16 pixel-diff 基礎設施
- [ ] 接 cocos-preview-qa skill：自動帶 `?ui=<variant>` query 並 capture（接 `--runtime <png>` 後完成）

### M35 Migration Plan + Cutover Gate

- [x] 新增 `tools_node/plan-screen-migration.js`：讀 tab-routing 產 N 步逐步 plan（character-ds3 = 8 步）
- [x] 每步 plan 含：tool / args / require gate（runtime-diff threshold 等）、rollback 動作
- [x] 新增 `tools_node/cutover-screen-variant.js --screen <id> --from <a> --to <b>`：swap default screenId、把 from 變 fallback、清空 featureFlag
- [x] cutover 前 gate：必要 `--verdict <json>` 且 verdict=pass（內建檢查）
- [x] cutover 失敗自動 rollback：寫 `.bak` 備份；`--rollback` 還原（已在 general-detail 驗證 apply + rollback 正確）

### M36 Coverage Tracker + SKILL Phase B

- [x] 新增 `tools_node/scan-ucuf-screen-coverage.js`
- [x] 分類 5 狀態：`cutover-prod / wired-dev / orphan / mount-no-layout / unknown`（M31 後 + pending-html 第 6 類）
- [x] 產 `docs/ui-screen-migration-coverage.md` 表（screen / status / layout / mount sites / featureFlag）
- [x] SKILL.md（`.github/skills/html-to-ucuf/SKILL.md`）新增 Phase B 章節：六步流程（B1-B6）
- [x] SKILL.md 主要工具表加入 M30-M36 的 6 支新工具
- [x] 驗收 checklist 補上 Phase B 項目

### M37 task-card-opener 整合

- [x] 新增 `tools_node/open-screen-migration-task.js` wrapper，委託 task-card-opener.js 並加入 `--type screen-migration --phase B`
- [x] task card 模板自動帶：source HTML 路徑、目標 screenId、panelKey、ChildPanel 清單、phase B、acceptance criteria
- [x] task card 完成判定：runtime-diff ≥ 95% AND logic-guard pass AND validate-ui-specs pass AND coverage tracker 顯示 `cutover-prod`
- [x] self-test：對 character-ds3 開卡 UI-2-9001（`artifacts/migration/UI-2-9001.md` + `.json`），6 ChildPanel 與 panelKey=general-detail 正確偶合
- [ ] （後續）接 docs/tasks/tasks-ui.json 主 shard / `build-ui-task-manifest.js`

### M38 Character DS3 Grid/Flex 收斂

- [x] `assets/scripts/ui/core/UISpecTypes.ts` 補上 `spacingX / spacingY / startAxis / constraint / constraintNum / cellWidth / cellHeight / direction` 最小契約
- [x] `assets/scripts/ui/core/UIPreviewLayoutBuilder.ts` 補上 `spacingX / spacingY`、grid `constraintNum / cellSize / startAxis` 與方向對映
- [x] `assets/scripts/ui/core/UIPreviewBuilder.ts` 在 layout parent 下把 HTML 直譯產生的 synthetic fill widget 視為 flow child，避免再把 layout item 當成絕對定位節點
- [x] `assets/resources/ui-spec/layouts/character-ds3-main.json` 對 `div_16 / div_20 / div_27 / div_32 / div_55 / div_58` 做 screen-specific codemod，轉成 layout-driven cards / rail / strip
- [x] `tools_node/render-ucuf-layout.js` 補 grid CSS 對映，讓 compare preview 與 runtime 契約一致
- [x] `node tools_node/validate-ui-specs.js --strict --rules no-duplicate-widget-siblings`：`character-ds3-main` 的 6 個 R21 hotspot 已清零
- [x] `node tools_node/runtime-screen-diff.js --screen character-ds3-main --html artifacts/skill-test-html-to-ucuf/character-ds3.rendered.html --layout assets/resources/ui-spec/layouts/character-ds3-main.json --skin assets/resources/ui-spec/skins/character-ds3-default.json --output artifacts/runtime-diff/character-ds3`：`sourceVsUcuf=95.2%`，verdict=`pass`
- [x] `node tools_node/capture-ui-screens.js --target GeneralDetailOverviewDs3 --outDir artifacts/ui-source/character-ds3/review-runtime`：真正 Cocos runtime screenshot 已落檔；runtime guard pass，僅剩既有 AudioSystem 未初始化 warning 1 條
- [x] `node tools_node/runtime-screen-diff.js --screen character-ds3-main --html "Design System 2/ui_kits/character/index.html" --layout assets/resources/ui-spec/layouts/character-ds3-main.json --skin assets/resources/ui-spec/skins/character-ds3-default.json --output artifacts/runtime-diff/character-ds3 --runtime artifacts/ui-source/character-ds3/review-runtime/GeneralDetailOverviewDs3.png --old artifacts/ui-source/general-detail-overview/review/GeneralDetailOverview.png`：compare board 已補 runtime / old variant，`sourceVsUcuf=97.2%`，verdict=`pass`
- [x] `node tools_node/headless-snapshot-test.js --update` 後重跑 `node tools_node/headless-snapshot-test.js`：snapshot baseline 已刷新為 clean
- [x] `node tools_node/cutover-screen-variant.js --screen general-detail-unified-screen --from unified --to ds3 --verdict artifacts/runtime-diff/character-ds3/character-ds3-main.runtime-verdict.json`：正式把 default route 切到 `character-ds3-main`，並生成 `.bak` rollback 備份
- [x] `node tools_node/scan-ucuf-screen-coverage.js --write-md`：`docs/ui-screen-migration-coverage.md` 已更新為 `character-ds3-main | cutover-prod`
- [x] `node tools_node/capture-ui-screens.js --target GeneralDetailOverviewProd --outDir artifacts/ui-source/character-ds3/review-cutover-prod`：不帶 `previewVariant` 的 production-default 入口 smoke 已通過；runtime guard pass，僅剩既有 AudioSystem warning 1 條

---

## 40. Accuracy Harness — 工具有效性驗證流程

### 40.1 為什麼需要

HTML → UCUF 拆解是「規則式自動轉換」。規則永遠有取捨，工具長期是否退化、新規則是否誤傷既有畫面，必須有量化指標。本節定義一套可重複、可入 CI 的驗證流程，用於：

1. 偵測工具是否「冪等」：相同輸入是否永遠得到相同輸出。
2. 偵測工具是否對「無語意差異的等價變體」維持結構穩定。
3. 量化「token 覆蓋率」：產生的 skin 中有多少 slot 真正落到 token 而非 unmapped placeholder。
4. 量化「warning precision / recall」：相對於人工標註的基線 warning 集合，工具是否抓對該抓的、不亂報。
5. 對 baseline 畫面長期回歸：避免後續規則改動把已收斂的畫面拆爛。

### 40.2 指標定義

| 指標 | 定義 | 預期 |
|---|---|---|
| `idempotencyRate` | 對同一份 HTML 連續跑 N 次，normalized 輸出 hash 唯一性比率 | 必須 = `1.0` |
| `structuralStability` | 對 N 種等價 perturbation（whitespace、attr 順序、class 順序、inline style key 順序）分別轉譯，與 identity 結構簽名一致比率 | 必須 = `1.0`（任何 < 1 表示工具受表面格式影響） |
| `tokenCoverage` | skin slots 中 `color-rect` / `label-style` / `sprite-frame` 對應到實際 token / 真實資產的比率 | 預設門檻 ≥ `0.5`，正式畫面建議 ≥ `0.8` |
| `warningPrecisionVsBaseline` | 與 baseline `expectedWarningCodes` 比較，true positives / (true positives + false positives) | ≥ `0.8` |
| `warningRecallVsBaseline` | true positives / (true positives + false negatives) | ≥ `0.8` |
| `baselineMatch` | 結構簽名是否與 baseline.layout 完全一致 | 對「凍結畫面」應 = `1` |

### 40.3 等價 Perturbation 集合

工具不允許因下列無語意差異改變輸出：

1. `whitespace-collapse`：把所有空白壓縮為單一空白。
2. `extra-whitespace`：在標籤之間插入換行。
3. `reorder-attrs`：保持 quoted value，反轉同一個 element 的 attribute 順序。
4. `reverse-class-order`：反轉 `class="..."` 內 token 順序。
5. `reverse-inline-style-keys`：反轉 inline `style` 內宣告順序。

這些 perturbation 由 `accuracy-harness.js` 自動生成，不需要手寫變體 fixture。

### 40.4 Baseline JSON Schema

```jsonc
{
  "expectedWarningCodes": ["asset-missing-placeholder"],
  "thresholds": {
    "minIdempotencyRate": 1.0,
    "minStructuralStability": 1.0,
    "minTokenCoverage": 0.5,
    "minWarningPrecision": 0.8,
    "minWarningRecall": 0.8,
    "requireBaselineMatch": false
  },
  "layout": { /* optional：完整 layout 結構簽名比對 */ }
}
```

### 40.5 標準執行流程

新增畫面要進入 accuracy harness 時：

1. 把 `source.html` 放到 `tests/fixtures/dom-to-ui/<screen>/source.html`。
2. 跑一次正式 CLI 產出 layout / skin。
3. 人工檢查產出符合預期，記下實際 warning 集合。
4. 寫入 `tests/fixtures/dom-to-ui/<screen>/accuracy-baseline.json`，列出 `expectedWarningCodes` 與 thresholds。
5. 把該畫面加入 `dom-to-ui-self-test.js` 或 CI script。

回歸驗證：

```bash
node tools_node/dom-to-ui-accuracy.js \
  --input tests/fixtures/dom-to-ui/<screen>/source.html \
  --screen-id <screen> --bundle <bundle> \
  --baseline tests/fixtures/dom-to-ui/<screen>/accuracy-baseline.json \
  --output artifacts/dom-to-ui-accuracy/<screen>.json \
  --iterations 5 --strict
```

非 0 退出（exit 8）代表 verdict=fail，CI 必須擋住合併。

### 40.6 與 Telemetry / Feedback Loop 串接

- 每次 `--strict` 跑都會 append telemetry（`tool: dom-to-ui-accuracy`、`mode: accuracy`、`accuracy: {...}`）。
- `dom-to-ui-feedback.js --detect-drift` 會把長期 `tokenCoverage` 跌、`warningPrecision` 跌、新出現的 unmapped code 視為 drift signal。
- `--suggest-thresholds` 可讀 telemetry 回推「現實 token coverage 中位數」並建議調整 baseline thresholds。
- `--apply-suggestion <id> --update-checklist <path>` 可在接受 threshold 變動時，把該 entry 同步追加到指定 checklist 檔，避免規則演進與文件分歧。

### 40.7 為什麼這套設計能反饋回工具

1. **等價 perturbation 直接命中規則漏洞**：任何依賴「class 在 attr 列出順序」「style key 順序」做決策的隱藏規則，會立刻把 `structuralStability` 拉低於 1，迫使我們把規則改成順序無關。
2. **idempotency=1 強制純函數性**：buildDraftFromHtml 的任何意外副作用（時間戳、隨機 id、map iteration order 依賴）會被直接抓到。
3. **tokenCoverage 給予 token 治理量化壓力**：當畫面跌破門檻，必須先擴 token 庫或修映射規則，才能合併。
4. **warning precision/recall 把「規則命中率」量化**：避免新規則狂噴假警報、或長期失能不發警報。
5. **baseline 凍結既有畫面**：是工具迴歸的「金級樣本」，新規則必須先過所有金級樣本才能上線。

### 40.8 CI 推薦命令

```bash
DOM_TO_UI_TELEMETRY=1 \
node tools_node/dom-to-ui-accuracy.js \
  --input tests/fixtures/dom-to-ui/gacha-banner.html \
  --screen-id gacha-banner --bundle ui_gacha \
  --baseline tests/fixtures/dom-to-ui/gacha-banner.accuracy-baseline.json \
  --output artifacts/dom-to-ui-accuracy/gacha-banner.json \
  --iterations 5 --strict
node tools_node/test/dom-to-ui-self-test.js
node tools_node/validate-ui-specs.js
node tools_node/check-encoding-touched.js
```

任一步非 0 即代表回歸，禁止合併。

### 40.9 重要規則速記

1. 工具產出必須是輸入的純函數（idempotencyRate=1）。
2. 工具產出必須對等價 perturbation 不變（structuralStability=1）。
3. 規則演進不得讓 baseline 畫面 tokenCoverage 倒退。
4. 規則改動要先把預期 warning 集合更新進 baseline，再更新規則程式，避免規則先動造成 false negative 上線。
5. accuracy verdict=fail 必須阻擋 PR；要強制合併時應先拉新 baseline 並 append evolution log。

---

## 41. Existing UI Logic Guard — 覆蓋既有 Cocos UI 的功能保護

### 41.1 核心原則

HTML 拆解工具覆蓋既有 Cocos UI 時，不能只保證 layout / skin JSON 合法；更重要的是不能把已接好的 UI 邏輯洗掉。正式規則如下：

1. 覆蓋前必須先知道「這個畫面有哪些功能可以驗證」。
2. 覆蓋後必須用同一份功能清單驗證，確認按鈕、route、bind path、panel API、child panel、lazySlot 仍可用。
3. 若功能無法自動保留，工具必須產生 `rewriteRequired[]`，把需要重寫的功能、來源檔、原因與建議 owner 寫清楚。
4. 若覆蓋造成 runtime Error Log，該錯誤必須被納入 logic guard report；若衍生新規則，必須 append `docs/html_skill_rule-evolution.md`。
5. strict 模式下，任何必測功能破壞都以 exit 9 中止，不得讓 PR 帶著「畫面能開但功能失效」合併。

### 41.2 覆蓋前 inventory

`dom-to-ui-logic-guard.js --mode inventory` 應掃描：

| 來源 | 要抽出的可驗證功能 |
|---|---|
| layout / fragments | node path、`_ucufId`、`dataSource`、`lazySlot.defaultFragment`、child panel route |
| screen spec | content contract、sample state、smoke route、panel package |
| CompositePanel / ChildPanel TS | public API、`show` / `hide` / `refresh` / tab switch、button handlers、event subscriptions |
| UIConfig / route registry | panel id、dialog id、preview target、route target |
| UCUFLogger / project.log | 既有 fail-fast 錯誤碼與常見 runtime 斷點 |

輸出範例欄位：

```jsonc
{
  "screenId": "general-detail-unified",
  "functions": [
    {
      "featureId": "open-bloodline-tab",
      "kind": "tab-switch",
      "sourceFile": "assets/scripts/ui/components/GeneralDetailComposite.ts",
      "triggerNode": "Tabs/BloodlineButton",
      "targetNode": "TabBloodlineContent",
      "requiredBindPaths": ["general.id", "bloodline.summary"],
      "autoSmoke": true
    }
  ]
}
```

### 41.3 覆蓋後 verify

覆蓋後的 logic guard 應至少檢查：

1. `featureId` 對應的 trigger node 仍存在，優先用 `_ucufId` 對齊，避免改名造成誤判。
2. target node / route / dialog id 仍存在。
3. required bind path 已在 content contract 或 sample state 宣告。
4. button / tab / modal 的 handler 仍能綁定到 Cocos node。
5. child panel route 與 lazySlot default fragment 未消失。
6. 執行 smoke 後，project.log 不新增 TypeError、bind path miss、route miss、missing asset blocker。

`<screen>.logic-guard.json` 必須包含：

| 欄位 | 說明 |
|---|---|
| `verdict` | `pass` / `fail` / `manual-required` |
| `preserved[]` | 覆蓋後仍存在且已驗證的功能 |
| `broken[]` | 覆蓋後消失或 smoke 失敗的功能 |
| `manualVerificationRequired[]` | 無法自動驗證但必須人工點測的功能 |
| `rewriteRequired[]` | 必須重寫或補 adapter 的功能 |
| `errorLogSummary` | runtime log 中與本次覆蓋相關的錯誤摘要 |

### 41.4 Error Log 與 evolution log 串接

如果 `broken[]` 或 `rewriteRequired[]` 命中下列條件，必須 append evolution log：

1. 同類錯誤在 2 個以上畫面重複發生。
2. 錯誤源於工具規則缺口，而不是單一畫面資料缺漏。
3. 需要新增 HTML 標記規範，例如 `data-ucuf-action`、`data-ucuf-lock`、`data-ucuf-id` 的新語意。
4. 需要調整 strict fail policy 或新增 exit code。

append entry 需寫明：before、after、reason、samples、impact。若只是單次功能重寫，不必改規則，但必須在 `<screen>.logic-guard.json` 保留 rewrite record。

### 41.5 通過標準

正式 UI 覆蓋要同時滿足：

1. `validate-ui-specs.js --strict --check-content-contract` 通過。
2. accuracy verdict 通過。
3. logic guard verdict 為 `pass`；若為 `manual-required`，需人工驗收簽核。
4. Error Log 無新增與本畫面相關的 TypeError / missing route / bind path blocker。
5. 若有 rewrite，必須先開任務或 append evolution entry，不得沉默合併。

---

## 42. Interaction & Motion Translation — HTML 互動與動畫轉譯

### 42.1 支援範圍

HTML source 若包含簡單互動或動畫，工具不得只轉靜態畫面。支援優先順序如下：

| HTML / CSS 語意 | UCUF / Cocos 產物 | 狀態 |
|---|---|---|
| `data-ucuf-action="openPanel"` + `data-target` | interaction action：open panel / dialog | M10 必做 |
| `data-action="tabSwitch"` + `data-tab` | interaction action：tab switch | M10 必做 |
| `aria-controls="dialog-id"` / `href="#dialog-id"` | modal / route target hint | M10 必做 |
| `<dialog>` / `role="dialog"` | dialog panel draft / route hint | M10 必做 |
| `transition: opacity/transform/color ...` | motion preset：fade / scale / slide / tint | M10 必做 |
| `@keyframes` 單段或少量關鍵影格 | motion timeline draft | M10 必做 |
| 任意 inline `onclick="..."` JS | warning：manual adapter required | 不執行、不 eval |
| 複雜 physics / scroll-driven animation | warning：manual renderer required | 不自動翻譯 |

### 42.2 Interaction draft

`<screen>.interaction.json` 建議格式：

```jsonc
{
  "screenId": "lobby-main",
  "actions": [
    {
      "id": "open-mission-detail",
      "trigger": "MissionList/Row/DetailButton",
      "event": "click",
      "type": "openPanel",
      "target": "lobby-mission-detail-dialog",
      "requires": ["mission.id"],
      "smoke": { "expectPanelVisible": "lobby-mission-detail-dialog" }
    }
  ],
  "warnings": []
}
```

翻譯原則：

1. 不執行 HTML inline JS；只解析 declarative attributes。
2. action target 必須能對到 screen spec / UIConfig / panel registry。
3. 若 target 缺失，strict 模式 exit 10。
4. 若 action 需要 runtime adapter，輸出 `rewriteRequired[]`，但不可自行產生未審核的 gameplay 邏輯。
5. interaction draft 要被 M9 logic guard 納入功能清單。

### 42.3 Motion draft

`<screen>.motion.json` 建議格式：

```jsonc
{
  "screenId": "gacha-banner",
  "motions": [
    {
      "id": "cta-enter",
      "target": "CTAButton",
      "trigger": "onShow",
      "preset": "scale-fade-in",
      "durationMs": 180,
      "easing": "quadOut",
      "properties": ["opacity", "scale"]
    }
  ],
  "warnings": []
}
```

美術規則：

1. motion token 優先，禁止直接把任意 CSS duration / cubic-bezier 硬塞進 runtime。
2. 只自動翻譯 opacity、scale、translate、color tint；layout width / height / top / left 動畫預設 warning。
3. 商業 CTA 動畫要短、清楚、有重量感；不可使用廉價無限抖動或高頻閃爍。
4. 必須保留 reduced-motion 開關或等價的低動態 fallback。
5. motion 驗證要看節奏與功能，不只看 JSON schema。

### 42.4 驗證規則

M10 落地後，自測至少要新增：

1. button 開窗 fixture：HTML button -> interaction draft -> logic guard smoke pass。
2. tab switch fixture：`data-action="tabSwitch"` -> target tab route 保留。
3. modal close fixture：close button target 對到 dialog root。
4. transition fixture：opacity + scale 轉 motion preset。
5. unsupported JS fixture：inline `onclick` 不執行，只輸出 manual adapter warning。

---

## 43. 美術總監複盤 — 已完成能力的修改與優化建議

### 43.1 結論

M0-M8 的方向正確，不需要推翻；但目前完成度偏「結構與規則正確」，還不足以保證「遊戲 UI 好看、可操作、有節奏」。從美術總監角度，下一步應把已完成能力升級成三條並行 gate：

1. 結構 gate：validate / R-guard / accuracy 繼續保留。
2. 功能 gate：M9 logic guard 保證覆蓋不破壞已接好的 Cocos UI。
3. 感知 gate：M10 motion + M11 visual regression 保證互動感、動態節奏與材質層次不丟失。

### 43.2 已完成功能複盤表

| 已完成能力 | 目前評價 | 美術總監建議 | 對應里程碑 |
|---|---|---|---|
| `data-ucuf-id` / `_lockedFields` | 對防止人工調整被洗掉很有價值 | 應把重要 CTA、tab、dialog root 預設建議加 `data-ucuf-id`；美術手調尺寸可用 `data-ucuf-lock="width,height"` 保護 | M9 |
| strict unmapped / R-guard | 技術上能擋錯，但視覺語意還不夠細 | R-guard 應加入「商業 CTA / 付費入口 / 戰鬥 HUD」不同 family 的美術強度檢查 | M11 |
| token reverse lookup | 可避免顏色與字級漂移 | nearest-token suggestion 應優先補；正式 UI tokenCoverage 門檻應提高到 0.8，商業 CTA 到 0.9 | M2 / M11 |
| bundle-suggestion / atlas-risk | 已能看出資產分散風險 | 需加上材質 family 分布，避免同一畫面混入 parchment、dark metal、commerce gold 造成語言混雜 | M5 / M11 |
| composite report | 能避免 SVG / canvas 被假裝成普通節點 | 需要求 composite slot 提供 screenshot fallback 或 rendererHint，否則 QA 只看到合法 JSON 看不出畫面缺損 | M1 / M11 |
| accuracy harness | 對結構回歸很有效 | 應新增 screenshot zone confidence、interaction success rate、motion presence rate，避免只通過 hash 卻失去觀感 | M8 / M11 |
| smart merge | 能降低手工修正被覆蓋 | 仍缺功能語意；按鈕 handler、tab route、dialog target 必須進 logic guard | M9 |
| warning system | 已能保留人工判斷入口 | warning 應分級：`blocker`、`art-review`、`manual-adapter`、`info`，避免美術審核被低價值訊息淹沒 | M6 / M11 |

### 43.3 推理測試建議

美術總監驗收不只看工具有沒有輸出，而要用「是否會在實際畫面中變糟」反推測試：

1. CTA 測試：HTML CTA 覆蓋後，button handler 仍能開窗，normal / pressed / disabled 狀態仍可辨識，motion 不超過 220ms。
2. Dialog 測試：HTML `aria-controls` 轉成 dialog route 後，開窗、關窗、背景遮罩、焦點順序都可驗證。
3. Tab 測試：tab switch 覆蓋後，tab active frame、content bind path、child panel route 都不消失。
4. Token 測試：同一畫面如果 tokenCoverage 低於正式門檻，禁止用 placeholder 色硬過。
5. Motion 測試：CSS transition 若無法轉成 motion token，必須 warning，不可變成完全靜態且無紀錄。
6. Screenshot 測試：結構 hash 通過後仍需抽樣截圖，確認文字沒有擠壓、bleed 沒被裁、商業 CTA 沒被背景吞掉。

### 43.4 文件規則

後續若 M9-M11 的測試發現已完成規則需要調整，處理順序固定為：

1. 先在 artifact / telemetry 中保存失敗樣本。
2. 追加或更新 baseline，不直接改舊結果。
3. append `docs/html_skill_rule-evolution.md`，說明 before / after / reason / samples / impact。
4. 再改工具規則與 checklist。
5. 最後跑 self-test、accuracy、logic guard、encoding check。

---

## 44. 技術總監收尾分析 — Checklist 清零後的流程問題

### 44.1 本輪實作結論

截至 2026-04-26，本文件 §39 的未完成 Checklist 已清零。完成狀態的定義是：工具已有可執行入口、可輸出 sidecar、strict 模式有 exit code、self-test 有 fixture 覆蓋。這不等於所有正式 UI 都已完成導入；正式導入仍需逐 screen 建立 baseline。

### 44.2 仍需管控的流程問題

| 問題 | 風險 | 補救規則 |
|---|---|---|
| 工具 fixture 與正式 screen 落差 | self-test 全綠但正式畫面仍可能因路由、資料、Prefab lifecycle 失敗 | 每個正式 screen 覆蓋前先產 `<screen>.logic-inventory.json`，覆蓋後跑 `<screen>.logic-guard.json` |
| 靜態 visual review 不是像素驗收 | screenshotZoneConfidence 只代表可截圖區域穩定，不代表畫面漂亮 | 正式 UI 必須再接 screenshot / preview QA；本工具只提供前置 gate |
| declarative interaction 覆蓋有限 | inline JS、複雜 gameplay adapter、非宣告式 route 不會自動翻譯 | 一律進 `manual-adapter-required` / `rewriteRequired[]`，不得偷偷丟失 |
| motion token 仍需美術調校 | CSS duration 被吸附到 token，可能和最終遊戲節奏不同 | motion draft 是初稿，正式畫面需由美術確認 token 與 easing |
| logic guard 對真實點擊仍是替代檢查 | inventory / verify 能保證節點與契約存在，但不能完全替代玩家操作 | 後續 M12 可把 Browser / Editor Preview click smoke 接入 logic guard |
| nearest-token suggestion 未實作 | unmapped token 會 fail，但修正建議仍需人工找最近 token | 不阻塞 M0-M11；列為 M12 developer-experience 優化 |

### 44.3 新的正式覆蓋順序

覆蓋既有 Cocos UI 時，標準順序固定如下：

1. 跑 `dom-to-ui-logic-guard.js --mode inventory` 保存覆蓋前功能清單。
2. 跑 `dom-to-ui-json.js --sync-existing --merge-mode preserve-human --strict --validate`，同時產生 interaction / motion / fragment / logic / visual sidecars。
3. 跑 `dom-to-ui-logic-guard.js --mode verify --strict` 比對覆蓋前 inventory。
4. 跑 `dom-to-ui-accuracy.js --strict --logic-guard <screen>.logic-guard.json`，確認結構、token、warning、visual metrics 與 logic verdict。
5. 若 visual review 為 `manual-required`，進 screenshot / preview QA；若 `rewriteRequired[]` 非空，先開任務或 append evolution log。

### 44.4 Checklist 更新規則

以後只有同時滿足以下條件，才可把 Checklist 從 `[ ]` 改成 `[x]`：

1. 有對應工具入口或明確 helper 函式。
2. 有 sidecar 或 report 可供 CI / 人工 review。
3. 有 self-test 或 fixture 覆蓋。
4. 有 strict exit code 或明確 manual-required verdict。
5. 有文件段落描述使用方式與失敗處理。

---

## 45. 覆蓋前自動備份機制（M12 — backup-before-overwrite）

**狀態**：已實作（2026-04-26）

### 45.1 需求背景

每次執行 `dom-to-ui-json.js` 都可能覆蓋正式的 `layouts/` / `skins/` / `screens/` JSON 檔案。一旦覆蓋後發現 UI 被弄壞，若沒有備份就只能靠 git 回退，但未提交的工作會遺失。本功能的目標：**在任何覆蓋寫入發生前，先把即將被覆蓋的所有檔案備份到一個帶有日期時間戳的目錄中**，讓開發者隨時可以還原。

### 45.2 備份目錄結構

```
artifacts/
  dom-to-ui-backups/
    2026-04-26_14-23-30_lobby/          <- YYYY-MM-DD_HH-mm-ss_screenId
      lobby.json                         <- 原 layout
      lobby.skin.json                    <- 原 skin
      lobby.screen.json                  <- 原 screen draft（若存在）
      lobby.preload.json                 <- 原 preload manifest（若存在）
      lobby.performance.json             <- ... 其他存在的 sidecar
      lobby.r-guard.json
      lobby.interaction.json
      lobby.motion.json
      lobby.fragment-routes.json
      lobby.logic-inventory.json
      lobby.logic-guard.json
      lobby.visual-review.json
```

- 只備份**磁碟上已存在**的檔案；尚未產生的 sidecar 不會建立空白備份。
- 若同名衝突（極少見），以數字後綴區分（`foo_1.json`、`foo_2.json`…）。
- **若無任何檔案需備份**（全新 screen 第一次執行），不建立空白目錄，只靜默略過。

### 45.3 CLI 旗標

| 旗標 | 預設 | 說明 |
|---|---|---|
| `--no-backup` | off | 停用備份（跳過，不建立目錄） |
| `--backup-dir <path>` | `artifacts/dom-to-ui-backups` | 覆蓋備份根目錄 |

**預設行為**：備份永遠啟用。只要有任何既有檔案，就在寫入前完成備份。

### 45.4 備份觸發時機

備份在以下任一條件成立時觸發：

1. 執行 `dom-to-ui-json.js --output <layout>` 且該 layout 路徑已存在於磁碟。
2. 執行 `dom-to-ui-json.js --sync-existing`（增量同步，最常覆蓋既有檔案的情境）。
3. 任何其他會產生 sidecar 的模式（sidecar 若已存在也一併備份）。

### 45.5 帶備份的標準覆蓋流程

```bash
# 全量重新產生（備份既有 layout/skin/sidecars）
node tools_node/dom-to-ui-json.js \
  --input artifacts/ui-source/<screen>/source.html \
  --output assets/resources/ui-spec/layouts/<screen>.json \
  --skin-output assets/resources/ui-spec/skins/<screen>.skin.json \
  --screen-id <screen-id> \
  --bundle <bundle> \
  --emit-screen-draft \
  --emit-preload-manifest \
  --emit-performance-report \
  --strict \
  --validate
# => 若既有檔案存在，自動在 artifacts/dom-to-ui-backups/ 建立備份目錄並印出路徑

# 增量同步（最常需要備份的情境）
node tools_node/dom-to-ui-json.js \
  --input artifacts/ui-source/<screen>/source.html \
  --output assets/resources/ui-spec/layouts/<screen>.json \
  --skin-output assets/resources/ui-spec/skins/<screen>.skin.json \
  --screen-id <screen-id> \
  --bundle <bundle> \
  --sync-existing \
  --merge-mode preserve-human \
  --strict \
  --validate
# => 同上，若有既有檔案自動備份

# 跳過備份（例如 CI 環境，git 已有版本控制）
node tools_node/dom-to-ui-json.js \
  ... \
  --no-backup

# 指定備份到特定目錄
node tools_node/dom-to-ui-json.js \
  ... \
  --backup-dir /tmp/my-backup-dir
```

### 45.6 還原方式

```bash
# 查看所有備份紀錄
Get-ChildItem artifacts/dom-to-ui-backups/ | Sort-Object Name -Descending

# 還原最新備份（以 lobby 為例）
$backup = Get-ChildItem artifacts/dom-to-ui-backups/*_lobby/ | Sort-Object Name -Descending | Select-Object -First 1
Copy-Item $backup/lobby.json assets/resources/ui-spec/layouts/lobby.json
Copy-Item $backup/lobby.skin.json assets/resources/ui-spec/skins/lobby.skin.json
```

### 45.7 模組架構

| 檔案 | 說明 |
|---|---|
| `tools_node/lib/dom-to-ui/backup.js` | 核心備份 helper，`createBackup({ screenId, files, backupRoot, repoRoot, now })` |
| `tools_node/dom-to-ui-json.js` | 在第一個 `writeJson` 前呼叫 `createBackup`；`--no-backup` / `--backup-dir` 旗標 |

### 45.8 驗收 Checklist

- [x] `backup.js` 模組實作：`createBackup` 正確建立時間戳目錄並複製既有檔案
- [x] `--no-backup` 旗標實作：停用時不建立任何目錄
- [x] `--backup-dir <path>` 旗標實作：可覆蓋備份根目錄
- [x] 全新 screen（無既有檔案）不產生空目錄
- [x] self-test 步驟 14 驗收：第二次執行時確認備份目錄存在且包含 layout 備份
- [x] self-test `--no-backup` 驗收：確認無備份目錄被建立
- [x] 備份路徑格式 `YYYY-MM-DD_HH-mm-ss_<screenId>` 正確（可排序）
- [x] 文件段落（本節 §45）描述完整

---

## 46. 技術總監分析：右側「藍色框框」與 95% 像素級保真目標（2026-04-26）

### 46.1 問題現象

`dom-to-ui-compare.js` 把 `Design System 2/ui_kits/battle/index_v3.html` 與 `assets/resources/ui-spec/layouts/battle-hud-main.json` 並排輸出時：

- 左側（HTML 來源）擁有完整字型、字距、漸層、陰影、邊框、圓角、半透明、emoji、圖示、複合背景。
- 右側（UCUF wireframe）只有藍色虛框與少量文字 placeholder，幾乎沒有任何視覺保真。

使用者期望這支 skill 的右側產物能達到 ≥95% 像素級接近左側（除了專案沒有的圖片資產），目前差距是 70%+。

### 46.2 根本原因（兩層各自有損）

問題不在單一 bug，而是 pipeline 有兩個**獨立的有損壓縮**疊加：

#### 第一層損失：`dom-to-ui-json` JSON 表達不足

當前 layout / skin 只能表達：

- ✅ 位置 / 尺寸 / widget anchor
- ✅ 單色背景（`color-rect` slot）
- ✅ 字型大小、字色、行高、字距（`label-style` slot）
- ✅ 9-slice 與單一 spriteFrame
- ❌ **線性 / 徑向 / 圓錐漸層**（`linear-gradient` / `radial-gradient` / `conic-gradient`）
- ❌ **陰影**（`box-shadow` / `text-shadow`，包含多層）
- ❌ **多層背景**（`background: url(), linear-gradient(), color`）
- ❌ **邊框細節**（`border-style: solid|dashed|dotted`、4 角不同 `border-radius`、`border-image`）
- ❌ **濾鏡**（`filter: blur(), saturate(), brightness(), drop-shadow()`）
- ❌ **變形**（`transform: rotate / scale / skew / translate`、`transform-origin`、`perspective`）
- ❌ **遮罩 / 裁切**（`clip-path`、`mask-image`、`mask-position`）
- ❌ **不透明度堆疊與混合**（`opacity` 非 1 但非完全透明、`mix-blend-mode`、`isolation`）
- ❌ **文字裝飾**（`text-decoration-color/style/thickness`、`-webkit-text-stroke`、`font-feature-settings`、`font-variant-*`）
- ❌ **偽元素**（`::before` / `::after` / `::marker` 的內容、樣式、位置）
- ❌ **字型 fallback 鏈**（只取第一個 family）
- ❌ **pseudo-class 狀態樣式**（`:hover` / `:focus` / `:active` / `:disabled`）

CSS 屬性被靜默丟棄，**沒有任何 telemetry**，所以 agent 無從得知本次轉譯丟了什麼。

#### 第二層損失：`dom-to-ui-compare` wireframe renderer 表達不足

即便 JSON 完整，當前的 wireframe renderer 只認得兩種 skin slot：

| slot.kind | 渲染為 |
|---|---|
| `color-rect` | flat `background-color` + 1px 白色邊框 |
| `label-style` | `color` + `font-size` + `line-height` |
| 其他（含 `image`、`gradient`、`shadow`、`filter` 等） | **直接忽略** |

沒有 skin 的容器則 fallback 為「半透明藍色虛框」（debug outline），這就是「藍色框框」的來源。

### 46.3 95% 像素級保真目標的工程拆解

要達到 ≥95% 像素級接近，必須同時補滿兩層：

1. **JSON 層擴展**：新增 skin slot `kind` 類別，覆蓋 §46.2 所有 ❌ 項目。
2. **Renderer 層擴展**：每種新 `kind` 都有對應的「逆向 CSS 翻譯」，把 UCUF JSON 還原回近似的瀏覽器可渲染 CSS。
3. **Coverage 量化**：每次轉譯都產出「丟棄了哪些 CSS 屬性」的明細，並計算實際像素級覆蓋率。
4. **自動反饋閉環**：丟棄事件自動寫入 `docs/html_skill_rule-evolution.md`，告知 agent 該補哪些 token / slot kind / 邏輯腳本。
5. **明確豁免**：圖片資產缺失（HTML 用了專案沒有的圖）以 waiver 機制顯式記錄，從覆蓋率分母中扣除，而非靜默忽略。

豁免清單（不在 95% 分母內）：

- 專案資源庫沒有對應 spriteFrame 的圖檔（`url(/assets/foo.png)` 但 db 無此路徑）
- 系統字型 fallback 中本機才有的字型（如 Mac 端 SF Pro，專案部署環境沒有）
- Web-only API：`backdrop-filter` 在 Cocos 無法精準對應（記為 best-effort + warning）

### 46.4 對應里程碑（M13–M20）

§46 把問題切成 8 個獨立、可驗證的里程碑（每個都附獨立 checklist 於 §47–§54）：

| 里程碑 | 目標 | 解決什麼 |
|---|---|---|
| M13 | CSS Coverage Audit | 量化每張畫面有多少 CSS 屬性被丟棄 |
| M14 | Skin Slot Kind Expansion | JSON 層補上 9 種新 slot kind |
| M15 | High-Fidelity Wireframe Renderer | Renderer 層把新 kind 反向翻譯成 CSS |
| M16 | Pixel Diff Harness | 真正用 pngjs 量化像素覆蓋率 |
| M17 | Auto-Feedback to Evolution Log | 丟棄事件自動寫入演進規則檔 |
| M18 | Design Token Auto-Discovery | 未對映 color / font / spacing 自動建議 token |
| M19 | Pseudo-Element & Decorative Synthesis | `::before` / `::after` 抽出為虛擬子節點 |
| M20 | Image Asset Waiver Registry | 缺圖區塊明確豁免，不污染覆蓋率分母 |

完成 M13–M20 後，§38 里程碑總表須補上對應列。

---

## 47. M13 — CSS Coverage Audit

### 47.1 目標

每次 `dom-to-ui-json` 轉譯時，遍歷每個來源節點的 `getComputedStyle`，比對「實際使用到的 CSS 屬性集合」與「當前已能捕捉的屬性集合」，產出 per-screen 覆蓋率報告。

### 47.2 必要產出

新增 sidecar：`<output>.css-coverage.json`

```jsonc
{
  "screenId": "battle-hud-main",
  "totalNodes": 87,
  "totalDistinctProperties": 64,
  "captured": ["width", "height", "color", "font-size", "background-color", "..."],
  "partiallyCaptured": ["border-radius", "letter-spacing"],
  "dropped": [
    { "property": "background-image", "occurrences": 23, "sampleSelector": ".scene-pill", "sampleValue": "linear-gradient(180deg,#06060a,#1a1a2c)" },
    { "property": "box-shadow",        "occurrences": 41, "sampleSelector": ".panel",      "sampleValue": "0 8px 24px rgba(0,0,0,0.4)" },
    { "property": "transform",         "occurrences":  6, "sampleSelector": ".badge",      "sampleValue": "rotate(-4deg)" }
  ],
  "imageAssetMissing": [
    { "url": "url(./assets/banner.png)", "selector": ".gacha-banner" }
  ],
  "coveragePercent": 0.42
}
```

### 47.3 CLI 整合

- `dom-to-ui-json.js` 預設啟用，可用 `--no-css-coverage` 抑制。
- `--strict-coverage <0..1>`：低於門檻時 exit 11。
- `--coverage-baseline <path>`：與既有 baseline 比對，回歸不可下降。

### 47.4 Checklist

- [x] 新增 `tools_node/lib/dom-to-ui/computed-style-capture.js`：以 puppeteer-core `page.evaluate(getComputedStyle)` 收集實際使用屬性
- [x] 建立 `CAPTURED`、`IGNORED`、`DEFAULT_VALUES` 常數集合，並輸出 captured / dropped 屬性統計
- [x] `dom-to-ui-json.js` 在 layout draft 完成後呼叫 fidelity sidecar runner，輸出 `<output>.css-coverage.json`
- [x] 新增 `--strict-coverage`、`--coverage-baseline`、`--no-css-coverage` CLI 參數
- [x] strict 模式下覆蓋率低於門檻 → exit 11
- [x] self-test 新增 M13 驗證：對 `visual-rich.html` 跑 css-coverage，斷言 `coveragePercent > 0` 且有 dropped property 可回饋
- [x] `dom-to-ui-json.js` telemetry 摘要記錄 css coverage sidecar 與 fidelity coverage 指標
- [x] 文件：本節（§47）描述完整、CLI 範例可直接複製

---

## 48. M14 — Skin Slot Kind Expansion

### 48.1 目標

擴充 `skin.json` 的 `slot.kind` 類別，覆蓋 §46.2 所有 ❌ 項目，並保持向後相容（既有 `color-rect` / `label-style` / `image` 不變）。

### 48.2 新增 slot kind 規格

| 新 kind | 必要欄位 | 範例 |
|---|---|---|
| `gradient-rect` | `gradient.type` (`linear`/`radial`/`conic`)、`gradient.angle`、`gradient.stops[]` | `{ "kind":"gradient-rect", "gradient":{"type":"linear","angle":180,"stops":[{"offset":0,"color":"token.battle.bg.top"},{"offset":1,"color":"token.battle.bg.bottom"}]}}` |
| `multi-layer-rect` | `layers[]` 依繪製順序，每層為 color / gradient / image / token | 多層背景疊加 |
| `shadow-set` | `boxShadows[]`、`textShadows[]`，每筆 `{x,y,blur,spread,color,inset}` | `0 8px 24px rgba(0,0,0,0.4)` |
| `border-style` | `border.width`、`border.style`、`border.color`、`border.radius:{tl,tr,br,bl}` | 4 角不同 radius |
| `filter-stack` | `filters[]`：每筆 `{type:"blur"|"saturate"|"brightness"|"drop-shadow"|"hue-rotate", value}` | CSS `filter: ...` |
| `transform-stack` | `transforms[]`：每筆 `{type:"rotate"|"scale"|"skew"|"translate", value}`、`origin` | CSS `transform: ...` |
| `mask-and-clip` | `clipPath`（path 或 keyword）、`maskImage`、`maskMode` | `clip-path: polygon(...)` |
| `opacity-and-blend` | `opacity`、`mixBlendMode`、`isolation` | 半透明 + 混合 |
| `text-decoration` | `decoration.line`、`decoration.color`、`decoration.style`、`decoration.thickness`、`textStroke`、`fontFeatureSettings` | 文字描邊與裝飾 |
| `pseudo-overlay` | `pseudo:"before"|"after"`、`content`、`anchorRect`，並指向另一個 inline slot | 偽元素 |

### 48.3 schema 與 validate

- `validate-ui-specs.js` 必須認得新 kind；未知 kind → exit 7 forbidden-skin-kind。
- 新 kind 的欄位若引用 token，token 必須存在於 `ui-design-tokens.json`，否則 unmapped warning。
- 既有所有 skin JSON 不需改動（向後相容）。

### 48.4 Checklist

- [x] `tools_node/lib/dom-to-ui/skin-kinds.js`：定義 legacy kind + M14 expanded kind 允許清單
- [x] `snapshot-to-slots.js`：偵測到 `background-image: linear-gradient(...)` → 產生 `gradient-rect` slot
- [x] `snapshot-to-slots.js`：偵測到多層 `background:` → 產生 `multi-layer-rect`
- [x] `snapshot-to-slots.js`：偵測到 `box-shadow` / `text-shadow` → 產生 `shadow-set`
- [x] `snapshot-to-slots.js`：偵測到 `border` / `border-radius`（含 4 角不同）→ `border-style`
- [x] `snapshot-to-slots.js`：`filter` / `transform` / `clip-path` / `mask-image` / `opacity` / `mix-blend-mode` / `text-decoration` 全部對映
- [x] `validate-ui-specs.js` 認得新 kind，未知 kind 產生 `[forbidden-skin-kind]` failure
- [x] `token-registry.js`：新 kind 可透過 `skin-to-css.js` token map 反解使用
- [x] self-test 新增 M14 驗證：fixture `tests/fixtures/dom-to-ui/visual-rich.html` 包含漸層、陰影、變形、偽元素，並斷言 expanded kind 被產出
- [x] 既有 fixture 重跑 0 regression（`dom-to-ui-self-test.js` 全通過）
- [x] 文件：本節（§48）含完整 schema 範例

---

## 49. M15 — High-Fidelity Wireframe Renderer

### 49.1 目標

`dom-to-ui-compare.js` 新增 `--render-mode high-fidelity`（預設）與 `--render-mode wireframe`（舊行為）。high-fidelity 模式把 §48 所有 slot kind 反向翻譯回瀏覽器 CSS，使右側畫面接近左側。

### 49.2 對映表

| slot kind | 反向 CSS |
|---|---|
| `color-rect` | `background-color: <hex>;` |
| `gradient-rect` | `background: linear-gradient(<angle>deg, <stops>);` |
| `multi-layer-rect` | `background: <layer1>, <layer2>, ...;` |
| `shadow-set` | `box-shadow: <list>;` 或 `text-shadow: <list>;` |
| `border-style` | `border: <w> <s> <c>; border-radius: <tl> <tr> <br> <bl>;` |
| `filter-stack` | `filter: <list>;` |
| `transform-stack` | `transform: <list>; transform-origin: <origin>;` |
| `mask-and-clip` | `clip-path: <path>; mask-image: <img>;` |
| `opacity-and-blend` | `opacity: <n>; mix-blend-mode: <mode>;` |
| `text-decoration` | `text-decoration: <line> <color> <style>; -webkit-text-stroke: <w> <c>;` |
| `pseudo-overlay` | 渲染為絕對定位的 sibling `<div>` 模擬偽元素 |

### 49.3 容器 fallback 升級

當前「藍色虛框」改為：

- 有任何 skin slot → 不畫 debug outline。
- 完全無 skin slot 且 `--render-mode high-fidelity` → 仍不畫 outline，保持透明（避免污染像素 diff）。
- `--render-mode wireframe` → 維持藍色虛框（debug 用）。

### 49.4 Checklist

- [x] `dom-to-ui-compare.js` 新增 `--render-mode <high-fidelity|wireframe>` CLI 參數，預設 `high-fidelity`
- [x] 新增 `tools_node/lib/dom-to-ui/skin-to-css.js`：每種 kind 一個翻譯函式
- [x] renderer 依 slot.kind 分派到 `skin-to-css` 對應函式
- [x] high-fidelity 模式不畫 debug outline，wireframe 模式保留現行行為
- [x] self-test 新增 M15 驗證：對 `visual-rich.html` 跑 high-fidelity compare 並通過 strict coverage / pixel gate
- [x] 文件：本節（§49）含 CLI 範例與切換說明

---

## 50. M16 — Pixel Diff Harness

### 50.1 目標

引入 `pngjs` 對左右 panel 做 per-pixel diff，計算實際像素級覆蓋率；waiver 區塊不計入分母。

### 50.2 必要產出

新增 sidecar：`<output>.pixel-diff.json`

```jsonc
{
  "screenId": "battle-hud-main",
  "leftPng":  "tmp/ucuf-left-...png",
  "rightPng": "tmp/ucuf-right-...png",
  "totalPixels": 1920000,
  "matchedPixels": 1843200,
  "coveragePercent": 0.96,
  "waiverPixels": 38400,
  "adjustedCoverage": 0.98,
  "heatmapPng": "artifacts/.../battle-hud-main.pixel-diff-heatmap.png",
  "perZone": [
    { "zoneId": "TopBar.PlayerInfoPlate", "coverage": 0.92 },
    { "zoneId": "TopBar.CenterInfoPlate", "coverage": 0.88 }
  ]
}
```

### 50.3 容差規則

- 每個 pixel RGB 差異 ≤ 12 算 match（避免抗鋸齒誤判）。
- alpha < 8 的透明 pixel 不計入分母。
- waiver zone（M20）整塊扣除。

### 50.4 Checklist

- [x] 安裝確認 `pngjs`（已在 package.json）
- [x] 新增 `tools_node/lib/dom-to-ui/pixel-diff.js`：讀左右 PNG、per-pixel 比對、產 heatmap
- [x] `dom-to-ui-compare.js` 新增 `--pixel-diff` 旗標（預設啟用），輸出 `<output>.pixel-diff.json` 與 heatmap
- [x] 新增 `--strict-pixel <0..1>`：覆蓋率低於門檻 exit 12
- [x] heatmap PNG：match=綠、mismatch=紅、waiver=灰
- [x] self-test 新增 M16 驗證：對 fixture 跑 pixel-diff，斷言 `adjustedCoverage` 為數值並通過 strict gate
- [x] 文件：本節（§50）含完整 JSON 範例

---

## 51. M17 — Auto-Feedback to Evolution Log

### 51.1 目標

把 §47 css-coverage 的 `dropped[]`、§48 未實作的 kind、§50 pixel-diff 的低覆蓋 zone，自動轉成 `docs/html_skill_rule-evolution.md` 的 **suggestion entry**，讓 agent 直接看到「該補哪段邏輯 / 該加哪個 token」。

### 51.2 自動 entry 模板

```md
## Entry <date> — fidelity-gap-<screenId>-<hash>

- suggestion id: `fidelity-gap-<screenId>-<hash>`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `<selector>` 的 `<cssProperty>: <cssValue>` 沒有對映
- after: 建議新增 skin slot kind `<kind>` 並在 token registry 加上 `<tokenName>: <hex>`，或以白名單豁免
- reason: pixel-diff coverage 在 zone `<zoneId>` 為 <coverage>%（< 95%）
- samples: `tests/fixtures/dom-to-ui/<screen>.html` 第 <line> 行
- impact: 待 reviewer 接受，由 `--apply-suggestion` 從 pending 轉 active
```

### 51.3 工作流程

```
dom-to-ui-json --strict-coverage 0.95
  → 寫入 <screen>.fidelity-gap.json
  → dom-to-ui-feedback.js --emit-fidelity-suggestions
  → 在 evolution log 末尾 append `## Entry ... pending` 區塊
  → agent 看到 pending → 補 token / kind → 跑 --apply-suggestion → 移到 active
```

### 51.4 Checklist

- [x] `dom-to-ui-feedback.js` 新增 `--emit-fidelity-suggestions` 子命令
- [x] 讀取 `<screen>.css-coverage.json` + `<screen>.pixel-diff.json` 產出 pending entry
- [x] entry 寫入 `docs/html_skill_rule-evolution.md`（append-only，不刪改既有 entry）
- [x] 重複 hash 不再次寫入（idempotent）
- [x] `--apply-suggestion <id>` 保留既有 reviewer acceptance 流程
- [x] self-test 新增 M17 驗證：刻意丟棄一個 CSS 屬性，驗證對應 entry 自動產生
- [x] 文件：本節（§51）含 entry 模板與 workflow 圖

---

## 52. M18 — Design Token Auto-Discovery

### 52.1 目標

當 HTML 出現 `color: #6d5dff` 但 token registry 沒有 `token.battle.accent.purple`，自動建議新增 token，並提供 nearest-existing-token 比對。

### 52.2 必要產出

新增 sidecar：`<output>.token-suggestions.json`

```jsonc
{
  "colorSuggestions": [
    {
      "value": "#6d5dff",
      "nearestExisting": { "token": "token.ui.accent.violet", "value": "#7060ff", "distance": 8 },
      "occurrences": 12,
      "suggestedToken": "token.battle.accent.purple",
      "category": "color/battle/accent"
    }
  ],
  "fontSuggestions": [
    { "value": "Iansui, ChiuKongGothic", "nearestExisting": null, "suggestedToken": "token.font.cn.handwrite" }
  ],
  "spacingSuggestions": [
    { "value": "18px", "nearestExisting": { "token": "token.space.s4", "value": "16px", "distance": 2 } }
  ]
}
```

### 52.3 接受流程

```bash
node tools_node/dom-to-ui-feedback.js \
  --accept-token-suggestion battle.accent.purple --value "#6d5dff"
# → 把 token 寫入 ui-design-tokens.json
# → 把使用該 hex 的 skin slot 改用 token 引用
# → 同步寫入 evolution log
```

### 52.4 Checklist

- [x] `tools_node/lib/dom-to-ui/token-suggestion.js`：實作 nearest-existing 演算法（color RGB 距離、font family 子集比對、spacing 數值距離）
- [x] `dom-to-ui-json.js` 預設輸出 `<output>.token-suggestions.json`
- [x] `dom-to-ui-feedback.js --accept-token-suggestion <id> [--value <v>]` 寫回指定 token JSON
- [x] `--strict-tokens`：未接受的 suggestion 數量超門檻時 exit 14
- [x] self-test 新增 M18 驗證：fixture 含未知 hex，驗證 suggestion 自動產生並可接受寫回 temp token registry
- [x] 文件：本節（§52）含完整接受流程

---

## 53. M19 — Pseudo-Element & Decorative Synthesis

### 53.1 目標

當前 HTML 解析只看實體 DOM，完全忽略 `::before` / `::after` / `::marker`，但這些偽元素常承載分隔線、角標、引號、bullet、徽章光暈 — 這是右側「少了很多 UI 元件」的重要原因。

### 53.2 解法

`html-parser.js` 新增 puppeteer-core 模式（已有 dependency），在解析時對每個元素呼叫：

```js
const before = await page.evaluate(el => {
  const cs = getComputedStyle(el, '::before');
  return cs.content !== 'none' ? {
    content: cs.content,
    position: { top: cs.top, left: cs.left, ... },
    background: cs.background,
    width: cs.width, height: cs.height,
    ...
  } : null;
}, elementHandle);
```

把回傳的偽元素轉為虛擬 child node，並標記 `_pseudo: "before"|"after"`，產生對應 skin slot。

### 53.3 Checklist

- [x] puppeteer collector：對每個元素抓 `::before` / `::after` 的 computed style
- [x] high-fidelity renderer 將 pseudo snapshot 作為子節點渲染，並保留 pseudo path / id
- [x] layout/coverage sidecar 記錄 `pseudoNodes`，供驗收與後續 rule evolution 使用
- [x] self-test 新增 M19 驗證：fixture 含 `.badge::before { content: ""; ... }`，斷言 pseudoNodes > 0
- [x] 文件：本節（§53）含 fixture 範例與輸出對照

---

## 54. M20 — Image Asset Waiver Registry

### 54.1 目標

明確定義：當 HTML `background: url(...)` 或 `<img src="...">` 指向專案 db 沒有的資產時，這個區塊**不計入** §50 pixel coverage 分母，但必須在 sidecar 中明確記錄。

### 54.2 必要產出

新增 sidecar：`<output>.image-waivers.json`

```jsonc
{
  "screenId": "battle-hud-main",
  "waivers": [
    {
      "selector": ".gacha-banner",
      "url": "url(./assets/banner.png)",
      "reason": "asset-not-in-db",
      "rectInCanvas": { "x": 100, "y": 200, "w": 800, "h": 300 },
      "manualOverride": false
    }
  ],
  "totalWaiverPixels": 240000
}
```

### 54.3 規則

- 自動偵測：HTML 引用的 `url(...)` 不存在於 `db://` 路徑 → 自動 waiver。
- 手動：`tests/fixtures/.../<screen>.image-waivers.manual.json` 可額外宣告 manual waiver。
- pixel-diff（§50）讀取 waiver 區塊，從分母扣除 + heatmap 染灰。

### 54.4 Checklist

- [x] 新增 `tools_node/lib/dom-to-ui/image-waiver.js`
- [x] computed-style capture 偵測引用的 `url(...)`，比對本地檔案是否存在
- [x] 不存在 → 自動寫入 `<output>.image-waivers.json`
- [x] 支援 manual override 檔
- [x] `pixel-diff.js`（§50）讀取 waiver 區塊，從分母扣除
- [x] heatmap 對 waiver pixel 染灰
- [x] self-test 新增 M20 驗證：fixture 引用不存在的圖，驗證 waiver 自動產生且 manual override 被合併
- [x] 文件：本節（§54）含完整 JSON 與規則

---

## 55. §38 里程碑總表更新建議

完成 M13–M20 後，§38 的表格須補上：

| 里程碑 | 目標 | 目前狀態 | 代表產出 | 主要待補 |
|---|---|---|---|---|
| M12 | 覆蓋前自動備份（§45） | 完成 | `backup.js`、`artifacts/dom-to-ui-backups/` | — |
| M13 | CSS Coverage Audit（§47） | 完成 / self-test 通過 | `computed-style-capture.js`、`fidelity-sidecars.js`、`<output>.css-coverage.json`、`--strict-coverage` | 正式 CI 門檻可依畫面分級調整 |
| M14 | Skin Slot Kind Expansion（§48） | 完成 / self-test 通過 | `skin-kinds.js`、`snapshot-to-slots.js`、`validate-ui-specs.js` kind gate | transform 拆解（translate/scale/rotate）可後續精修 |
| M15 | High-Fidelity Wireframe Renderer（§49） | 完成 / self-test 通過 | `skin-to-css.js`、`generateHighFidelityHtml()`、`--render-mode high-fidelity`（預設） | font fallback 仍可能造成 sub-pixel 誤差 |
| M16 | Pixel Diff Harness（§50） | 完成 / self-test 通過 | `pixel-diff.js`、`<output>.pixel-diff.json`、heatmap PNG、`--strict-pixel` | 主工作流可再加 per-screen 門檻設定 |
| M17 | Auto-Feedback to Evolution Log（§51） | 完成 / self-test 通過 | `fidelity-feedback.js`、`--emit-fidelity-suggestions`、suggestion id 雜湊去重 | reviewer 流程沿用 `--apply-suggestion` |
| M18 | Design Token Auto-Discovery（§52） | 完成 / self-test 通過 | `token-suggestion.js`、`<output>.token-suggestions.json`、`--strict-tokens`、`--accept-token-suggestion` | 正式 token 寫回仍需 reviewer 決策命名 |
| M19 | Pseudo-Element & Decorative Synthesis（§53） | 完成 / self-test 通過 | puppeteer collector 抓 `::before`/`::after`、coverage `pseudoNodes`、high-fidelity pseudo render | `content: counter(...)` / 圖檔型 content 可後續擴充 |
| M20 | Image Asset Waiver Registry（§54） | 完成 / self-test 通過 | `image-waiver.js`、`<output>.image-waivers.json`、manual waiver、pixel-diff 自動扣除 | 大型正式畫面仍需 reviewer 審核 waiver 原因 |

完成定義（DoD）：

1. 所有 self-test 步驟（含 M13–M20 新增驗證）綠燈：`node tools_node/test/dom-to-ui-self-test.js` 已通過。
2. `validate-ui-specs.js` 認得 legacy kind + M14 expanded kind；未知 kind 會回報 `[forbidden-skin-kind]`。
3. `visual-rich.html` 已覆蓋 css coverage、high-fidelity renderer、pixel diff、feedback、token accept、pseudo capture、image waiver。
4. dropped CSS 屬性可由 `dom-to-ui-feedback.js --emit-fidelity-suggestions` append 到 `docs/html_skill_rule-evolution.md`，並以 suggestion id 去重。
5. strict gate 已落地：M13 `--strict-coverage`、M16 `--strict-pixel`、M18 `--strict-tokens`。

---

## 56. 開發優先序建議（技術總監視角）

1. **先做 M13**（coverage audit）— 它是其他所有里程碑的「量化儀表板」，沒有它無法判斷其他改動是否真的有改善。
2. **同步做 M14 + M15**（schema + renderer）— 兩者必須一起設計，否則 schema 改了但 renderer 沒接會誤判覆蓋率。
3. **接著 M16**（pixel diff）— 在 M14/M15 落地後，pixel diff 才有意義；之前跑只會永遠 < 50%。
4. **再做 M20**（waiver）— 在 M16 跑出第一波低覆蓋後，先用 waiver 區別「真缺資產」與「真缺 token / kind」。
5. **最後 M17 + M18 + M19**（自動化反饋）— 這三個是「讓 agent 自我演進」的閉環，但若前面 M13–M16 沒落地，自動反饋會是噪音。

預期里程：M13 + M14 + M15 + M16 落地後，battle-hud-main 的 pixel coverage 應從目前 ~10% 推進到 ≥80%；M17 + M18 + M19 + M20 補完後可達 ≥95%（豁免後）。


---

## §57 Implementation Notes & Reflections（M13–M20 落地後）

### 已實作

- `tools_node/lib/dom-to-ui/computed-style-capture.js`：puppeteer 內讀 `getComputedStyle`，含 `::before` / `::after`，產 snapshot 與 coverage。
- `tools_node/lib/dom-to-ui/snapshot-to-slots.js`：computed-style → 13 種 skin slot kind。
- `tools_node/lib/dom-to-ui/skin-to-css.js`：反向渲染 slot → CSS 字串。
- `tools_node/lib/dom-to-ui/skin-kinds.js`：規範化 13 種 slot kind 列表。
- `tools_node/lib/dom-to-ui/pixel-diff.js`：pngjs 像素比對，輸出 heatmap 與 coverage。
- `tools_node/lib/dom-to-ui/image-waiver.js`：偵測本地不存在的 `url(...)`，產 waiver rect。
- `tools_node/lib/dom-to-ui/token-suggestion.js`：未對映顏色 / 字型 / 間距收集 + 最近 token 建議。
- `tools_node/lib/dom-to-ui/fidelity-feedback.js`：dropped-property 與低覆蓋率自動寫入 `docs/html_skill_rule-evolution.md`，以 suggestion id 去重。
- `tools_node/lib/dom-to-ui/fidelity-sidecars.js`：供 `dom-to-ui-json.js` 直接產出 css coverage / token suggestions / image waivers。
- `tools_node/dom-to-ui-json.js`：新增 `--strict-coverage`、`--coverage-baseline`、`--strict-tokens`、`--manual-waivers`、`--browser` 等 fidelity sidecar 與 gate 參數。
- `tools_node/dom-to-ui-compare.js`：新增 `--render-mode high-fidelity`（預設）、`--pixel-diff`（預設）、`--strict-pixel`、`--strict-coverage`、`--emit-feedback`，並串起以上模組產出 sidecar：
  - `*.css-coverage.json`
  - `*.image-waivers.json`
  - `*.pixel-diff.json` + `*.pixel-diff.heatmap.png`
  - `*.token-suggestions.json`
- `tools_node/dom-to-ui-feedback.js`：新增 `--emit-fidelity-suggestions` 與 `--accept-token-suggestion`，完成 M17/M18 feedback loop。
- `tools_node/validate-ui-specs.js`：新增 skin slot kind catalog 驗證，避免未知 kind 進入 UCUF 規格。

### 首跑結果（battle-hud-fullpage @ 1200×540）

- captured nodes：331（含 pseudo-elements）
- CSS coverage：84.4%
- pixel-diff coverage：85.1%（waiver 調整後 88.2%）
- waivers：5（皆來自 DS2 本地缺資產的 `url(...)`）
- 自動回寫 evolution log：6 筆 fidelity-gap

### 已知限制與下一步

- `transform` 目前以原始 matrix 字串落地（未拆 translate / scale / rotate）。
- `backdrop-filter` 在 chrome headless 預設行為下若被父層 isolation 阻斷，pixel-diff 會把它計為差異。
- `::before` / `::after` 以「父矩形 + content」近似落地，未支援 `content: counter(...)` 與圖檔型 content。
- 字型在 headless 缺少時會 fallback，造成 letter-spacing / line-height 的小幅 px 誤差（仍在 12 tolerance 內，多為通過）。
- M16 strict 模式（`--strict-pixel`）與 M13/M18 strict gate 已落地於 CLI；後續可在 `run-ui-workflow.js` 加 per-screen 門檻設定。


---

## §59 M21 + M22 — 從 85% 推進到 88% 的架構演進（2026-04-XX）

> 使用者明確要求「不接受限制框架，請以最強技術總監視角朝 95% 突破」。本節記錄 M21–M22 兩波改動與真實量測結果。

### M21 — Font Audit + Broken-Image Hider + Sub-pixel Rect + Background Modifiers

**動機**：M20 收尾時 pixel-diff 卡在 85.1%，反思根因在於 source 與 preview 之間的「環境差」未對齊：缺字 fallback 不一致、缺圖呈現方式不一致、整數化 rect 造成 sub-pixel 邊界差。

**實作**：
- 新增 `tools_node/lib/dom-to-ui/font-audit.js`：
  - `auditFonts(page)` 用 `document.fonts.check('12px "X"')` 偵測 headless 內缺失字型。
  - `buildFontOverrideStyle(missing)` 產生 `@font-face { src: local("Microsoft JhengHei"), local("Noto Sans CJK TC")... }` + 強制 `font-family: !important` 套疊棧，讓兩側都落到同一 fallback。
  - `buildBrokenImageHiderScript()` 產生 capture-phase `error` listener + DOMContentLoaded sweep，將兩側無法載入的 `<img>` 一律 `visibility:hidden`。
- `prepareSourceHtmlForCapture` 改成接 `extraHead` 參數，讓 source 與 preview 都能注入同一份 override / hider。
- 主流程改為「2-pass capture」：第 1 pass 純 audit，第 2 pass 注入 override 後再截圖與抓 snapshot。
- `computed-style-capture.js`：rect 改成 sub-pixel（`Math.round(x * 100) / 100`），新增 `_localRect` (offsetLeft/Top + offsetParentTag)。
- `snapshot-to-slots.js`：新增第 14 種 slot kind `background-modifiers`，當 `background-size / position / repeat` 偏離預設時生成。
- `skin-to-css.js`、`skin-kinds.js`：對應補上 `background-modifiers` 的反向渲染與 KNOWN_KINDS 列表。
- `fidelity-feedback.js`：font-missing 自動寫入 `fidelity-gap-...-fonts-missing-<hash>`，由 reviewer 決定安裝字型或固化 fallback。

**量測**：85.1% → 85.3%（adj 88.4%）。fonts missing = 3 (NotoSansTC, Newsreader, Manrope)。改善很小，原因在下一節揭露。

### M22 — Hierarchical (DOM-Tree) Renderer with Rect-Delta + 4 Critical CSS Bugs

**動機**：使用者拒絕「85% 為架構天花板」的說法。Heatmap 細看後鎖定主因：`.grid-wrap` 套了 `transform: translate(-50%,-50%) perspective(2000px) rotateX(44deg)`，但 flat renderer 把每個 `.tile` 子元素用 `getBoundingClientRect()` 後的 AABB 軸對齊矩形畫出，3D 透視全失。

**架構轉折**：把 flat-render 改成「DOM-tree render with rect-delta」。
- `computed-style-capture.js`：每個 snapshot 加 `parentId / offsetParentId`，用 WeakMap 賦 nodeId 並追溯第一個被收錄的祖先。
- `dom-to-ui-compare.js#generateHighFidelityHtml`：
  - 用 `parentId` 建子→父索引（`childrenOf` map）。
  - 渲染時對每個節點：`x = childRect.x - parentRect.x`、`y = childRect.y - parentRect.y`，把子節點作為父節點 `<div>` 的真實子節點放入 DOM 樹。
  - 子節點隨父節點 `<div>` 自然繼承 CSS transform，雖然「父矩形 + 子-rect-delta」仍是後變形 AABB，但 ancestor 的 transform 透過 nested DOM 真正套疊到子層。

**踩到的 4 個關鍵 CSS bug**（每個都算數）：

1. **`transform: raw(matrix(...))` 不是合法 CSS**。`skin-to-css.js` 對 `{type:'raw', value: 'matrix(...)'}` 寫成 `raw(matrix(...))`，瀏覽器整段 drop。修正為「matrix 標記直接落地或被丟棄」（理由詳下）。
2. **同元素 `matrix(...)` 套兩次 → double-shift**。元素的 `_rect` 已是後變形位置；若 renderer 再把 `transform: matrix(...)` 加上去，瀏覽器再依 transform-origin 平移一次。最終決策：對 `{type:'raw'}` 一律丟棄（matrix 已在 rect 中編碼）。3D 變形（perspective/rotateX/rotateY）由「父節點 nested DOM」自然繼承到子層，不需在子層重複套用。
3. **`radial-gradient(circle at 40% 35% at center, ...)` 雙重 `at`**。原本 `gradientToCss` 對所有 radial 都附加 `at ${center}`，而 `parseGradient` 已把 `circle at 40% 35%` 整段塞進 `g.shape`，導致 `at` 出現兩次，整段 gradient 被瀏覽器拒絕。修正為：若 `g.shape` 內已含 `at`，不再追加 `at center`。
4. **`border-radius: 50%` 被靜默丟棄**。`parseLength` 只處理 `px`，computed style 的 `50%` 直接被丟，所有圓形按鈕（`.ab` action ring 全家）變方角。新增 `parseLengthOrPct()` 保留原始 CSS 單位字串，`skin-to-css` 的 `border-style` case 改成「數值→`px`、字串→原樣輸出」。

**量測（hybrid tree + 4 bugs 修正）**：
- 85.3% → 86.4% → 86.6%（z-index 加入後）
- 86.6% → 88.1%（adj 90.6%）（border-radius 50% bug 修正後，圓形按鈕正常呈現）

**累計改善**：85.1% → 88.1%（**+3.0%**），waiver-adjusted 88.2% → 90.6%（**+2.4%**）。

### 為什麼仍未到 95%

剩下的 ~10% 集中在 **3D-transformed 子樹**（hex grid 中央）：因為子節點以 rect-delta 定位於父節點下，雖然繼承父 transform 後外形對了，但子節點本身仍是軸對齊矩形（其 rect 編碼了「投影後的 AABB」），所以一個傾斜的 tile 在 source 是平行四邊形，在我們的 preview 是矩形。要破這個天花板有 3 條路：

- **Approach A — 子樹 PNG rasterize**：對每個 `transform != none && (perspective|rotateX|rotateY|matrix3d)` 的祖先，用 `elementHandle.screenshot({omitBackground:true})` 整片切成 PNG，preview 直接以 `<img>` 替換整個子樹，並在 snapshot 上設 `_skipFlatRender`。最乾淨，但等於用「自動烘焙圖層」繞過架構。
- **Approach B — Pre-transform local coords**：以 `offsetLeft/Top + offsetParent chain` 做樹狀渲染（非 DOM parent）。本回合試過，掉到 69.3%；原因是 `offsetParent` 會跳過非定位祖先，DOM 樹與 offsetParent 樹不同步，產生位置漂移。要做對需要把所有非定位中介容器補進虛擬樹。
- **Approach C — Source DOM clone**：直接複製 source DOM + computed CSS 注入 preview，視同「跑同一棵樹兩次」。最高保真但等於放棄 skill 的反向證明價值。

**建議下一步**：先取 Approach A，實作上是「掃 snapshot 找 3D-transform 祖先 → puppeteer 切片 → snapshot 標記 skip → renderer 替換成 `<img>`」，預期可一口氣把 hex grid 那塊 ~10% 的紅斑吃掉，把覆蓋率推過 95%。

### 落地檔案總覽

- `tools_node/lib/dom-to-ui/font-audit.js`（新增）
- `tools_node/lib/dom-to-ui/computed-style-capture.js`（sub-pixel rect、`_localRect`、parent/offsetParent id）
- `tools_node/lib/dom-to-ui/snapshot-to-slots.js`（`background-modifiers` slot、`parseLengthOrPct`、border-radius 字串支援）
- `tools_node/lib/dom-to-ui/skin-to-css.js`（`transform-stack` raw 丟棄、radial `at` 修正、border-radius 字串輸出）
- `tools_node/lib/dom-to-ui/skin-kinds.js`（補 `background-modifiers`）
- `tools_node/dom-to-ui-compare.js`（2-pass capture、tree-render with rect-delta、z-index passthrough）

### §38 里程碑表追加

| 里程碑 | 目標 | 目前狀態 | 代表產出 | 主要待補 |
|---|---|---|---|---|
| M21 | Font Audit + Broken-Image Hider + Sub-pixel + BG Modifiers | 完成 | `font-audit.js`、`background-modifiers` slot kind、2-pass capture | 真實安裝缺字（NotoSansTC / Newsreader / Manrope） |
| M22 | Tree Renderer + 4 CSS Bugs Fix | 完成 | DOM-tree render with rect-delta、radial `at` / border-radius `%` / matrix double-shift / `raw()` 修正 | Approach A（3D 子樹 PNG rasterize）以衝 95% |
| M23 | Alignment Pass + `line-height` Unitless Fix + `--pre-eval` Tab Switch | 完成 | CSS coverage 83% → 89%；`line-height:1` 無單位修正；`display/flex/align/gap/white-space/text-overflow` 加入 ALL_PROPS + 套用至 baseStyle；`--pre-eval` 支援動態頁面 tab 切換比對 | character 頁 6 tab 全部 ≥ 95.6%（min bloodline 95.6%、max equip 97.4%）；back-arrow `line-height:1` 垂直錯位修正 |
| M24 | `repeating-gradient` Support（gacha 測試發現）| 完成 | `parseGradient` regex 擴充 `(repeating-)?`；`gradientToCss` 依 `g.repeating` 加前綴；轉蛋頁 `banner-art-placeholder` checkered 背景正確還原 | gacha 頁 pixel-diff 82.5% → **90.9%**（+8.4%）；`repeating-linear/radial/conic-gradient` 三型均支援 |
| M25 | 半透明背景一致性 + per-side border + `0deg` 方向修正 | 完成 | M25-A: `extraHead` 注入 `:where(html,body){background:#0e1116}` 統一底色；M25-B: per-side border（4邊獨立讀取）；M25-C: `g.angle \|\| 180` → `g.angle != null ? g.angle : 180`（0deg falsy bug）| gacha 頁 90.9% → **98.3%**（+7.4%）；pull-bar 透明渐變正確；`linear-gradient(0deg,...)` 方向不再翻轉 |
| M26 | 字型 base64 注入（NotoSansTC / Manrope / Newsreader） | 完成 | `font-audit.js` 新增 `buildProjectFontFaces()`：讀取專案 TTF → base64 data-URI → `@font-face`；注入兩側 pass，`trulyMissing` 過濾已覆蓋字型 | gacha 98.0%、character 95.9%（字型影響小；主要差距為 pseudo-elements / transform:scale / radial-gradient 複合背景） |
| M27 | 四點修正：canvas 尺寸自動讀取 + pseudo-element 條件改善 + stage scale reset + background URL 解析 | 完成 | (1) `combineImages` 移除硬寫死 `1334/750` 改用 `srcW/srcH`；`opts.width/height` 預設 0 由 `CANVAS_W/H` 自動填充；(2) `pickProps` pseudo filter 改為：`none`/`normal`→skip，content 空但有 bg/border→保留；(3) Pass 2 截圖前偵測 `.stage` 非恆等 matrix 並重設 `transform:none`；(4) `renderNode` 對 `background-image` 執行 `resolveUrl` 展開相對路徑 | 四點系統性修正；character pseudo-element / noise 紋理 / radial-gradient 複合背景可正確還原 |
| M28 | overflow:hidden propagation（fidelity 收尾）| 完成 | source/preview 兩側統一在 ancestor `overflow:hidden` 邊界做 clip path | battle 92.6% / character 96.0% baseline 維持 |
| M29 | 性能優化三件式（節點收斂 + button state + UCUF preview） | 完成 | `tools_node/optimize-ucuf-layout.js` / `auto-fix-ucuf-skin.js` / `render-ucuf-layout.js`；character-ds3 nodeCount 176→156、buttonStateLayer 0/9→9/9、verdict blocker→warn | unmappedToken 仍仰賴 dom-to-ui-json 上游修 sentinel |
| M30 | **Wire-up Phase 0**：Tooling Audit | 完成 | `scan-ucuf-screen-coverage.js` 產出 `docs/ui-screen-migration-coverage.md`（13 cutover-prod / 17 orphan / 1 mount-no-layout / 5 pending-html / 2 unknown） | character-ds3-main 經 M31 升為 `wired-dev` |
| M31 | Screen Mount Registry + Dev Toggle Helper | 完成 | `assets/scripts/ui/core/UIVariantRouter.ts` 抽出共用 router；`tools_node/register-ucuf-runtime-route.js` 產 `<screen>.runtime-route.json`；`GeneralDetailComposite._resolveScreenId` 改用 `UIVariantRouter.resolve('general-detail')`；7-case self-test PASS | 其他 CompositePanel 漸進改用 router |
| M32 | HTML Semantic Annotation Pass | 完成 | `tools_node/annotate-html-bindings.js`：規則庫（tab/button/portrait/stat/section）+ idempotent 標記注入；`--apply` / `--report` / `--dry-run`；character HTML 5 annotations | 規則庫可隨畫面累積擴充 |
| M33 | Tab ChildPanel Generator | 完成 | `tools_node/generate-tab-childpanels.js` 一鍵產 N 個 `ChildPanelBase` scaffold + `<screen>.tab-routing.json`；character-ds3 6 tab 全產出，型別檢查通過 | 接 CompositePanel `_switchToTab` 串接（手動或下版 codemod）|
| M34 | Runtime Visual Diff Loop | 完成 | `tools_node/runtime-screen-diff.js` 串 `dom-to-ui-compare.js`：未接 runtime 也可先產出 source HTML vs UCUF preview 三層比對板（`*.runtime-compare.png` + `*.runtime-compare.html` + `*.runtime-verdict.json`）；character-ds3 verdict=`pass` (sourceVsUcuf=98.31%) | runtime screenshot 加入後可三方 diff |
| M35 | Migration Plan + Cutover Gate | 完成 | `plan-screen-migration.js` 依 tab-routing 產 8 步 plan；`cutover-screen-variant.js` 必要 `--verdict <pass>` gate、自動 `.bak` 備份、`--rollback` 一鍵回滾；general-detail 已驗證 apply + rollback | dev toggle 切換 → cutover 全鏈通 |
| M36 | Coverage Tracker + SKILL Phase B | 完成 | `scan-ucuf-screen-coverage.js` 整合 mount-by-literal 與 mount-via-router 雙來源；`docs/ui-screen-migration-coverage.md` 產出；SKILL.md 加 Phase B 章節（B1-B6 六步） | 後續每次 cutover 後重跑刷新 |
| M37 | task-card-opener 整合 | 完成 | `tools_node/open-screen-migration-task.js` wrapper：自動帶 source HTML / target screenId / panelKey / ChildPanel 清單 / 5 條 acceptance gate；委託 task-card-opener.js 同步產 .md 與 ui-quality-task-shard；在 character-ds3 實測通過（UI-2-9001.md / .json） | 後續希望接 docs/tasks/tasks-ui.json 分片時，重跳來 `--shard-out docs/ui-quality-tasks/<id>.json` |
| M38 | Character DS3 grid/flex codemod 收斂 | 完成 / cutover-prod | `UIPreviewLayoutBuilder` 最小 grid/flex 支援、`UIPreviewBuilder` layout-flow child 判斷、`character-ds3-main` 六個 hotspot layout 化、真實 runtime screenshot 與 production-default smoke 皆已落檔、`cutover-screen-variant` 已套用 | snapshot baseline 已刷新；殘餘僅既有 AudioSystem warning |


---

## §61 M24 — `repeating-gradient` Support（2026-04-26）

> 測試目標：`Design System 2/ui_kits/gacha/index.html` — 帶有動態 JS template 的轉蛋頁。
> 基線（M23）：82.5% pixel-diff。CSS coverage 89.8%，`droppedProperties` 全為 default 值。

### 根因分析

- `banner-art-placeholder` 使用 `background: repeating-linear-gradient(45deg,#1e1028,#1e1028 6px,#251833 6px,#251833 12px)` —— 棋盤格立繪佔位背景
- `snapshot-to-slots.js` 的 `parseGradient` regex 為 `^(linear|radial|conic)-gradient\((.*)\)$`，不匹配 `repeating-` 前綴 → 回傳 `null` → slot 被過濾 → 預覽無背景 → 大紅塊
- `banner-art-placeholder` 約佔畫面 480×748px ≈ 17% 面積，完全空白即 17% 像素差，與 82.5% 基線吻合

### 修正（M24）

**`tools_node/lib/dom-to-ui/snapshot-to-slots.js`**（`parseGradient`）

- Regex 從 `^(linear|radial|conic)-gradient\(` 改為 `^(repeating-)?(linear|radial|conic)-gradient\(`
- 新增 `repeating = !!m[1]` 旗標，一併回傳

**`tools_node/lib/dom-to-ui/skin-to-css.js`**（`gradientToCss`）

- 讀取 `g.repeating` 旗標，所有三型輸出前加 `repeating-` 前綴
- 涵蓋 `repeating-linear-gradient`、`repeating-radial-gradient`、`repeating-conic-gradient`

### 量測結果（M24 vs M23）

| 頁面 | M23 pixel-diff | M24 pixel-diff | 說明 |
|---|---|---|---|
| gacha/index.html | 82.5% | **90.9%** | `banner-art-placeholder` 棋盤格正確還原 |
| CSS coverage | 89.8% | 89.8% | 不變（`repeating-gradient` 已在 capturedProperties） |

### 學到的東西（gacha 測試發現）

1. **`repeating-*-gradient` 的 computed value 仍是 `repeating-linear-gradient(...)`**，Chrome 不會展開成普通 gradient，必須明確支援。
2. **JS template 動態注入 inline style** 需要足夠的 `--settle-ms`（≥600ms）讓 JS 完成渲染，否則 gradient 捕不到。
3. **背景簡寫 `background: <gradient>`** 的 computed `background-image` 正確反映 gradient 值，`parseBackgroundImage` 可正確解析。
4. **heatmap 驅動除錯**：大面積紅塊 → 立即懷疑 slot 完全缺失（而非色差），導向 parseGradient 路徑排查。

---

## §62 M25 — 半透明背景底色一致性 + per-side border + `0deg` 方向修正（2026-04-26）

> 測試目標：`Design System 2/ui_kits/gacha/index.html` — M24 之後剩餘 9.1% pixel diff 的根因分析與修正。
> 基線（M24）：90.9% pixel-diff。主要紅區集中在 pull-bar（y=880~1080）佔 ~90% 的紅像素。

### 根因分析

#### Bug 1 — HTML body 無背景色，Puppeteer 預設白色底 vs UCUF 深色底（最大根因）

`html, body` 在 gacha HTML 中沒有設定 `background-color`。Puppeteer 截圖時使用瀏覽器預設**白色**底色。UCUF preview 使用 `background:#0e1116`（深色）。

pull-bar 的背景是半透明梯度 `rgba(0,0,0,.97~.8)`，疊加在不同底色上：
- HTML：`rgba(0,0,0,.84)` × 白色 = `rgb(40,40,40)`（中灰）  
- UCUF：`rgba(0,0,0,.84)` × `#0e1116` = `rgb(1,1,1)`（近黑）
- 差值 ≈ 39，遠超 tolerance=12 → 大量紅像素

**修正（M25-A）**：在 `dom-to-ui-compare.js` 的 `extraHead` 注入：
```css
:where(html),:where(body) { background: #0e1116; }
```
`:where()` 的 specificity=0，頁面自有的 `body { background: ... }` 規則仍可覆蓋，不影響有明確背景設定的頁面。

#### Bug 2 — per-side border 只讀 border-top，卻輸出 `border:` 四邊同值

`snapshot-to-slots.js` 只讀 `border-top-width/style/color`，然後用 `border: W S C` 短縮屬性輸出。對於僅有特定邊框的元素（如 `pull-bar` 的 `border-top:1px solid rgba(...)`），這會造成四個邊都加上框線。

**修正（M25-B）**：讀取 4 個邊 → 若 4 邊相同用短縮屬性；若不同，用 `border.sides` 物件記錄，`skin-to-css.js` 對應輸出 `border-top:` / `border-right:` 等個別屬性。

#### Bug 3 — `g.angle || 180` 在 angle=0 時 JavaScript falsy 邏輯

`skin-to-css.js` 的 `gradientToCss` 最後：
```javascript
return `${pfx}linear-gradient(${g.angle || 180}deg, ${stops})`;
```
當 `angle = 0`（即 `linear-gradient(0deg, ...)` = to top）時，`0 || 180 = 180`！方向從「由下到上」變成「由上到下」，完全翻轉。

`banner-fade-bottom` 的背景 `linear-gradient(0deg, rgb(10,6,18), rgba(0,0,0,0))` 在 UCUF 中被輸出為 `linear-gradient(180deg, ...)` → 深色在上、透明在下 → 底部大面積透明，讓下面的紫色梯度透出 → UCUF 更偏紫色。

**修正（M25-C）**：
```javascript
return `${pfx}linear-gradient(${g.angle != null ? g.angle : 180}deg, ${stops})`;
```

### 修正的檔案

| 檔案 | 修正項目 |
|---|---|
| `tools_node/dom-to-ui-compare.js` | M25-A: `extraHead` 注入 `:where(html,body){background:#0e1116}` |
| `tools_node/lib/dom-to-ui/snapshot-to-slots.js` | M25-B: per-side border（4邊獨立讀取，`border.sides` 物件）|
| `tools_node/lib/dom-to-ui/skin-to-css.js` | M25-B: per-side border 輸出；M25-C: `0deg` falsy 修正 |

### 量測結果（M25 vs M24）

| 里程碑 | gacha pixel-diff | 說明 |
|---|---|---|
| M24 | 90.9% | 基線 |
| M25-A（底色一致） | 97.0% | +6.1%，pull-bar 半透明背景修正 |
| M25-A+C（0deg 修正） | **98.3%** | +1.3%，`banner-fade-bottom` 方向修正 |

### 學到的東西

1. **半透明背景 must use 一致底色**：HTML/UCUF 兩側都要有相同的頁面底色，否則半透明疊加後顏色截然不同。
2. **`g.angle || 180` 是典型 falsy trap**：`angle=0` 代表合法的「向上」方向，不能用 `||` fallback，改用 `!= null`。
3. **per-side border**：4 個邊的 `border-*-width/style/color` 都已在 `ALL_PROPS` 中捕捉，只需讀取並比對是否一致。
4. **heatmap band 分析流程**：y-band → x-band → 採樣具體 RGB 值 → 反推 CSS 原因，是系統性排查方法。

> 使用者觀察：比對圖中返回鍵箭頭 `←` 符號垂直錯位，且各元件的 flex/align/gap 對齊資訊完全未被捕捉。本節記錄 M23 根因分析與修正。

### 根本原因

1. **`line-height: 1`（無單位）被靜默丟棄**  
   `parseLength('1')` 只處理 px，回傳 `0`（falsy）→ `lineHeight` 欄位空值 → preview 套用瀏覽器預設 `normal`（≈ 1.2×）→ 包含 `←` 的 span 從 28px 高膨脹為 33.6px，造成 ~5.6px 垂直溢出與視覺錯位。

2. **對齊屬性（`display/flex-direction/align-items/justify-content/gap` 等）未進入 `ALL_PROPS`**  
   瀏覽器根本沒有讀這些屬性 → 不在 snapshot 裡 → preview 的每個元素都是裸 `display:block`，flex 容器的文字置中、間距等全部消失。  
   CSS coverage 停在 83%，剩下 ~17% 就是這些被忽略的 layout 屬性造成的缺口。

### 修正清單

| 檔案 | 修改內容 |
|---|---|
| `tools_node/lib/dom-to-ui/computed-style-capture.js` | `ALL_PROPS` 新增：`display`, `flex-direction`, `flex-wrap`, `align-items`, `align-content`, `align-self`, `justify-content`, `justify-items`, `justify-self`, `gap`, `row-gap`, `column-gap`, `vertical-align`, `white-space`, `text-overflow`；server-side CAPTURED 新增同組；從 IGNORED 移除 |
| `tools_node/lib/dom-to-ui/snapshot-to-slots.js` | 新增 `parseLineHeight()`：px → number、unitless（`1`, `1.5`）→ 原字串保留無單位、`%` → 原字串；取代 `lineHeight` 欄位的 `parseLength` 呼叫 |
| `tools_node/lib/dom-to-ui/skin-to-css.js` | `lineHeight` 輸出改為 `!= null` 判斷；`number` → 加 `px`，`string` → 原樣輸出（unitless/% 不加 px） |
| `tools_node/dom-to-ui-compare.js` | `renderNode()` 加 `alignStyle`：從 `styles` 提取 `display`（若為 flex/grid 則輸出 + 補 `flex-direction/align-items/justify-content/align-content/gap`）、`align-self`、`white-space`、`text-overflow`、`vertical-align`，拼入 `baseStyle`；另新增 `--pre-eval <js>` + `--settle-ms <n>` 參數 |

### 量測結果（M23 vs M22）

| Tab | M22 pixel-diff | M23 pixel-diff | M22 CSS coverage | M23 CSS coverage |
|---|---|---|---|---|
| overview | 95.8% | **95.8%** | 83.2% | **89.3%** |
| stats | 96.9% | **96.9%** | 83.8% | **89.6%** |
| tactics | 96.7% | **96.7%** | 83.7% | **89.6%** |
| bloodline | 95.6% | **95.6%** | 83.7% | **89.6%** |
| equip | 97.4% | **97.4%** | 83.7% | **89.5%** |
| aptitude | 97.3% | **97.3%** | 84.1% | **89.7%** |

> pixel-diff 維持穩定（無退步），CSS coverage 全面提升 +6.1pp（平均 83.7% → 89.6%）。  
> `line-height` 無單位修正後，back-arrow `←` 的垂直錯位理論上消除（span 高度重新收回 28px 而非 ~33.6px）。  
> 由於 character 頁各元素本身位置來自 `getBoundingClientRect()`（已含 flex 布局效果），alignment 屬性對 pixel-diff 的直接提升主要在「葉節點文字在容器內的置中行為」，預計在更多純文字置中版面會有更明顯改善。

### `--pre-eval` 用法

```bash
# 比對第 2 個 tab（stats）
node tools_node/dom-to-ui-compare.js \
  --html "Design System/design_handoff/character/index.html" \
  --layout "assets/resources/ui-spec/layouts/general-detail-main.json" \
  --screen-id character-stats \
  --output "artifacts/character-stats.compare.png" \
  --pre-eval "document.querySelectorAll('#tab-rail button')[1].click()" \
  --settle-ms 800
```

---

## §58 M48 Gacha Polish 實戰反饋（2026-04-26）

> 來源：`Design System 2/ui_kits/gacha/index.html` → `assets/resources/ui-spec/{layouts,skins,screens}` 的 M47–M48-pre-d 落地循環。整理 5 條應寫進 `dom-to-ui-json.js` / validator / encoding-guard 的硬規則。

### 58.1 Lesson 1：Context-aware color porting（必補）

**症狀**：HTML `pity-scale` 文字色 `#3A3030`（深灰）放在 HTML 的淺灰背景上是「次要說明」感；直接 token 化搬到 Cocos 後疊在 RightPanel 的 `surfaceMidnightDeep` (#0A0612) 上 → 文字幾乎看不見。

**根因**：HTML token 的色值是「**和當下背景共構**」才有意義；單獨把色值丟過 token 邊界等於丟掉設定意圖。

**規則建議**（補進 `dom-to-ui-json.js` color resolver）：
- 每個 `color` token 落地時，必須一併記錄 `againstBg`（HTML 計算到的最近實際背景色）。
- Cocos skin 解析時，若實際使用上下文 bg 的 luminance 差距 > 30，要 emit warning：`color-luminance-context-mismatch`。
- 提供 `textMuted` / `textMutedOnDark` / `textMutedOnLight` 三組 alias，HTML→UCUF 自動依 `againstBg` 選對應 alias。

### 58.2 Lesson 2：Same-hue low-contrast trap

**症狀**：紫色 badge bg `rgba(156,39,176,.22)` + 紫色文字 `#CE93D8` 等於 invisible state。pool tier badge 完全看不到。

**規則建議**（補進 `validate-ui-specs.js`）：
- 規則 ID：`same-hue-low-contrast-badge`。
- 當 panel `color` 與 child label `color` 屬於同一 hue family（H 差距 < 30°）且 alpha 差距 < 0.4 時 → ERROR。
- 強制 badge label 預設 `colorWhite`，badge bg 自由。

### 58.3 Lesson 3：Generic plaque sprite 污染 themed family

**症狀**：`widget.header.plaque.badge.underlay` 是全域共用 sprite，被掛進 gacha 的 themed PoolTierBadge 內，導致現出「不屬於本池主題色」的粉紫底 → 跟 per-pool theming 撞色。

**規則建議**：
- 在 `recipe normalize` 階段，若一個 themed family（family.theme != "global"）內出現 `widget.header.*` 共享 plaque sprite → ERROR `themed-family-pollution`。
- 鼓勵作法：themed family 內部自己 own 一份 `*.theme.<family>.fill` 的 skin slot。

### 58.4 Lesson 4：Squat CTA antipattern（高度比例守則）

**症狀**：HTML `.pull-btn` 寬 240–320 / 高 ~130（高寬比 0.4–0.55）。直接搬寬度但保留舊 88px 高 → 0.27–0.36 高寬比，視覺上扁平、廉價、跟 PullBar 200px 完全對不上比例。

**規則建議**（補進 `validate-ui-specs.js`）：
- 規則 ID：`cta-aspect-ratio`。
- 當一個 `button` 的 `skinSlot` 含 `*.pull*` / `*.cta*` / `*.primary*` 時，`height / width` 必須 ≥ 0.40。
- 若搬自 HTML 且 HTML 對應元素的高寬比 ≥ 0.4，UCUF 端不得低於該比例 ×0.95（容差）。

### 58.5 Lesson 5：Layout validates-but-renders-empty（雙層透明吞沒）

**症狀**：RateRow N/R/SR/SSR 結構正確 layout 通過驗證，但 `RateSectionBg @0.08 + RateRow surfaceHigh @0.12` 兩層透明疊在 dark RightPanel 上 → 視覺上完全消失。HTML 對應的 `.rate-row` 是 `rgba(255,255,255,.05)` 疊在白底 panel 上才能看到，這個 alpha 配方在 dark context 下無效。

**規則建議**（補進 `validate-ui-specs.js`）：
- 規則 ID：`stacked-translucency-against-dark-bg`。
- 偵測：panel 的祖先鏈最終 effective background luminance < 0.15，且當前 panel `color` luminance < 0.30 且 `opacity` < 0.25 → WARN `will-be-invisible`。
- 在 `compile-recipe-to-screen-spec.js` 階段直接給 fallback：dark context 下自動把 row bg opacity 提升至 0.20+。

---

## §59 PowerShell 編碼防災（必補進 `encoding-touched-guard`）

> 真實事故：本回合 `gacha-preview-main.json`（含大量繁中）被 `Get-Content -Raw | -replace | Set-Content -Encoding UTF8 -NoNewline` round-trip 一次後，**32 處中文字串全部 mojibake**、JSON 結構損毀（4 處字串連結束引號都遺失）。從 git 還原會丟失整個 M47-M48-pre-c-d 的工作。最後用 5 支 Node 腳本 + HTML reference 反推救回。

### 59.1 根因

PowerShell 5.1 的 `Get-Content` 預設用 **系統 ANSI（CP950 在繁中 Windows）** 讀檔，不是 UTF-8；CJK 字節被誤解後，再用 `Set-Content -Encoding UTF8` 寫回 → 每個 CJK 字符變成 mojibake，部分字串長度改變導致 `"` 被吃掉。

### 59.2 硬規則（提案寫進 `.github/instructions/encoding-touched-guard.instructions.md`）

> **禁用 PowerShell `Get-Content` / `Set-Content` 修改任何含 CJK 或非 ASCII 字符的檔案。**

允許的替代方案（按優先序）：
1. `multi_replace_string_in_file` 工具（最安全，僅替換 ASCII 結構）。
2. Node.js script：`fs.readFileSync(path, 'utf8')` → 字串操作 → `fs.writeFileSync(path, content, 'utf8')`。
3. 若必須用 PowerShell，必須完整指定 `Get-Content -Encoding utf8` **且** `Set-Content -Encoding utf8NoBOM`（PS 7+ 才有 `utf8NoBOM`，PS 5.1 沒有）。
4. PS 5.1 一律禁止改 CJK 檔。

### 59.3 強制 pre-flight check

在任何 `Get-Content/Set-Content` 出現於 powershell 命令之前，agent 必須先檢查目標檔案：

```powershell
node -e "const t=require('fs').readFileSync('<file>','utf8'); console.log('hasCJK:',/[\u3000-\u9fff]/.test(t));"
```

若 `hasCJK: true` → **拒絕用 PowerShell 文字 round-trip**，改走方案 1 或 2。

### 59.4 救援腳本範本（保留在 `tools_node/recover-mojibake-from-html-ref.js`）

提案新增工具：
- 輸入：`<corrupted-json>` + `<html-reference>` + `<content-state-json>`。
- 動作：掃描所有含 `?{2,}` 或非 BMP 範圍以外的 mojibake 字串；對每個 corrupt entry，依 `name` / `styleSlot` 從 HTML reference 反推原文；產出 patch 並驗證 JSON。
- 用法：未來若再發生類似事故可直接套用，避免人工逐字 reverse-engineering。


---

## §60 Canvas 座標系 vs 視覺像素混淆防災（課程）

> M48-pre-f 事故覆盤：按鈕高度比 HTML reference 矮 29%，根因是把 HTML visual px 直接填入 Canvas 座標單位欄位。本節整理為可直接引用的防災課程。

### 60.1 根因與症狀

**症狀識別**
- 按鈕 `x/y/width` 與 HTML reference 的 delta < 1.5px → 對齊精確
- 但 `height` 視覺上矮了 **29%**
- 具體案例：`h:88 canvas` 渲染出 62.6px 視覺，而非 88px

**根因**：Cocos Canvas 設計尺寸 = 1920×1080，Editor Preview viewport = 1366×768；二者比例差 0.7115×。HTML 的 `88px` 是 visual px（CSS 像素），直接抄進 JSON canvas 欄位後，引擎以為是 canvas units，乘上縮放後只剩 62.6px。

### 60.2 換算公式

```
canvas = visual_px × (1920 / 1366)   ← 從 HTML 抄尺寸時用這條
visual_px = canvas × (1366 / 1920)   ← 從 JSON 換回視覺尺寸時用這條
scale = 1366 / 1920 = 0.7115
```

**命名慣例**（內部草稿中統一使用）
- `88vp` → visual px（HTML 值）
- `124cu` → canvas units（JSON 值）

### 60.3 快速換算表

| HTML visual px（vp） | Canvas units（cu，取整） | 說明 |
|---|---|---|
| 44 | 62 | 最小可觸控高度（可觸控下限） |
| 62 | 87 | 小型 badge / tag |
| 88 | 124 | 標準單欄按鈕高 |
| 96 | 135 | 加粗 CTA 行高 |
| 120 | 169 | 主要 CTA 按鈕高 |
| 200 | 281 | 中型 panel 行高 |
| 253 | 356 | Pull bar 高度 |
| 308 | 433 | Pull bar 含 padding |

### 60.4 三條硬規則

> 以下三條規則在任何 HTML → UCUF JSON 轉換時都必須遵守。

**規則 1 — 量 HTML 時先標單位**  
所有從 HTML 或截圖量取的數值，必須先標記 `vp`（visual px）再記入草稿。  
禁止把未標記的裸數值「88」直接寫進 JSON。

**規則 2 — JSON size 落地前必須換算**  
```
JSON.width  = Math.round(html_vp_width  * (1920 / 1366))
JSON.height = Math.round(html_vp_height * (1920 / 1366))
```  
換算後再填 JSON，不得省略。

**規則 3 — 對齊驗算四維度全驗**  
只驗 `width / cx delta` 而忽略 `height / cy` 是漏洞。  
每次 QA 必須同時比對 `x, y, width, height` 四欄：  
- width delta < 1px ✓ 但 height delta > 20px → 必定有 dimension 遺漏換算
- 立刻回查該節點是否有 `visual_px_source` 備註

### 60.5 反模式清單

| 反模式 | 後果 | 正確做法 |
|---|---|---|
| 從 HTML reference 直接抄 `height: 88` 進 JSON | 視覺高度縮水 29% | `height: Math.round(88 × 1920/1366)` = 124 |
| 從截圖量 px 直接填 canvas | 同上 | 截圖量值標 vp → 再換算 cu |
| 只驗 width/cx delta，跳過 height | 高度 bug 靜默通過 QA | width + height + cx + cy 全驗 |
| 內部草稿裸寫 `88`，不標單位 | 後繼 agent/開發者無法判斷是 vp 或 cu | 一律寫 `88vp` 或 `124cu` |

### 60.6 validate-ui-specs.js 補丁（R27 button-squat-aspect）

> 高寬比是座標系無關的（`vp_h / vp_w = cu_h / cu_w`），可直接在 canvas units 上檢查。

在 `validateLayoutStrict` 的 `walkLayoutNodes` 回呼中，R26 之後插入：

```javascript
// R27: button-squat-aspect — button 高寬比不得低於 0.25
// 目的：防止 Canvas 座標換算遺漏導致高度縮水（M48-pre-f Pull1Btn / Pull10Btn 事故）。
// 理論依據：visual_h / visual_w = canvas_h / canvas_w，比例在兩個座標系中相同。
if (node.type === 'button' &&
    typeof node.width  === 'number' && node.width  > 0 &&
    typeof node.height === 'number' && node.height > 0) {
    const ratio = node.height / node.width;
    if (ratio < 0.25) {
        strictWarn('button-squat-aspect',
            `${loc} button 高寬比 ${ratio.toFixed(3)} < 0.25` +
            `（height=${node.height}, width=${node.width}），` +
            `可能是 HTML visual px 未換算為 Canvas units（正確換算：html_px × 1920/1366），` +
            `請確認 height 已乘以縮放係數`,
            warnings, exceptions);
    }
}
```

**補丁位置**：`tools_node/validate-ui-specs.js`，`walkLayoutNodes` callback 末尾、`}, 0);` 之前。  
**規則 ID**：`button-squat-aspect`（可加入 `validation.exceptions` 白名單豁免特殊扁平按鈕）。

### 60.7 dom-to-ui-json.js 建議（size metadata）

輸出每個 size token 時，加 metadata 供 validator 重現驗算：
```jsonc
{ "width": 124, "height": 88, "_vp": { "w": 88, "h": 62.6, "scale": 0.7115 } }
```
這樣 validator 可讀 `_vp.h` 確認原始 visual px，並自動推算正確 canvas value。

### 60.8 案例參考

- 事故日期：2026-04-26
- 受影響節點：`Pull1Btn`、`Pull10Btn` in `gacha-preview-main.json`
- 症狀：width 對齊精確，height 矮 29%（`88cu → 62.6vp`，應為 `124cu → 88.2vp`）
- 修正 commit landmark：M48-pre-f


---

## §63 M26 — 字型 base64 注入（2026-04-27）

> 測試目標：`Design System/design_handoff/gacha/index.html` 與 `character/index.html`。  
> M25 基線：gacha 98.3%、character 95.8%。

### 根因分析

`font-audit.js` 的 `buildFontOverrideStyle()` 只產出 `local()` fallback（系統字型），無法確保 headless Chrome 使用與 Cocos 相同的 TTF。專案內有完整 TTF 但未注入頁面。

### 修正（M26）

新增 `buildProjectFontFaces(projectRoot)` 函式：讀取 `assets/resources/fonts/*/font.ttf` → base64 data-URI → `@font-face` CSS，注入兩側 pass 的 `extraHead`。新增 `PROJECT_FONT_FAMILIES` Set（NotoSansTC / Manrope / Newsreader），`trulyMissing` 過濾避免 double-override。

### 修正清單

| 檔案 | 修改內容 |
|---|---|
| `tools_node/lib/dom-to-ui/font-audit.js` | 新增 `buildProjectFontFaces(projectRoot)` + `PROJECT_FONT_FAMILIES` |
| `tools_node/dom-to-ui-compare.js` | `extraHead` 注入 `projectFontStyle`；`trulyMissing` 過濾；`args` 加 `--allow-file-access-from-files` |

### 量測結果（M26 vs M25）

| 頁面 | M25 | M26 | 說明 |
|---|---|---|---|
| gacha | 98.3% | 98.0% | 真實字型 vs fallback，微幅波動（容忍範圍內） |
| character | 95.8% | 95.9% | +0.1%；字型對此頁影響微小，主要差距在 pseudo-elements |

---

## §64 M27 — canvas 尺寸自動讀取 + pseudo-element 條件改善 + stage scale reset + background URL 解析（2026-04-27）

> 目標：修正 character 頁 4.1% 差距的系統性根因。

### 根因分析

1. **寫死尺寸**：`combineImages` PowerShell 中 `$srcAspect = 1334.0 / 750.0` 忽略 Cocos layout 的實際 canvas 常數；`opts.width/height` 預設 512/256，需手動傳 `--width 1920 --height 1080`。
2. **pseudo-element 過濾過嚴**：`pickProps` 的 `!content` 可能過濾掉 `content:""` 但 `getPropertyValue` 回傳空字串的 decorative pseudo-elements。
3. **transform:scale 截圖偏差**：HTML 內 `.stage` 依 viewport 縮放，若 viewport 與設計尺寸不符，`getBoundingClientRect()` 回傳縮小後的 rect，preview 重現也縮小，導致兩者視覺上匹配但與 Cocos 原始規格不同。
4. **相對路徑 url() 無法載入**：`portrait-bg` 等元素使用 `url('../noise.png')` 等相對路徑紋理；preview HTML 在 temp 目錄，相對路徑失效，造成噪點紋理 / sprite 缺失。

### 修正清單

| 修改 | 位置 | 說明 |
|---|---|---|
| `combineImages` srcW/srcH 參數 | `dom-to-ui-compare.js` | 新增 `srcW, srcH` 參數替換 `1334.0/750.0`；call site 傳入 `CANVAS_W, CANVAS_H` |
| `opts.width/height` 自動填充 | `dom-to-ui-compare.js` | 預設改為 `0`；CANVAS_W/H 算出後若仍為 0 則自動填充 `CANVAS_W*2` / `CANVAS_H` |
| pseudo-element 條件改善 | `computed-style-capture.js` | `pickProps`：`none`/`normal` 直接 skip；content 空時若有 bg-image / bg-color / border-width → 保留 |
| stage transform reset | `dom-to-ui-compare.js` | Pass 2 載入後 `page.evaluate` 偵測 `.stage` transform 非 identity matrix → `style.transform = 'none'` |
| background-image URL 解析 | `dom-to-ui-compare.js` | `renderNode` 在呼叫 `snapshotToSlots` 前，用 `resolveUrl()` 展開 `background-image` 裡所有 `url(...)` 相對路徑 |

### 學到的東西

1. **Cocos `canvas.designWidth/Height` 就是正確的截圖尺寸來源**，不需要手動傳 CLI 參數；只需確保 `layoutData.canvas` 有值。
2. **pseudo-element `content:""` 的 Chrome 回傳值是 `""`（含引號，2 chars）**，並非空字串；但防禦性的「有 bg 就保留」更穩健。
3. **`url(relative/path.png)` 在 file:// preview 中需展開為絕對路徑**；`resolveUrl()` 已有完整邏輯，只需在 `renderNode` 中提前呼叫。
