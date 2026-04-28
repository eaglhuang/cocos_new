---
doc_id: doc_agentskill_0036
name: html-to-ucuf
description: 'HTML -> UCUF (Cocos Creator UI) 轉換 SKILL — 以 source package（同一來源目錄內的 ui-design-tokens.json、colors_and_type.css、主要 HTML）為正式輸入，轉成符合 UCUF 規範的 layout/skin/screen JSON 與 Composite/Child Panel 骨架，最後以 HTML source screenshot vs Cocos Editor screenshot 的 runtimeVsSource.score >= 95% 作為通過條件。USE FOR: 從設計稿或前端 HTML 草稿落地 Cocos UI 規格、批次更新既有 UCUF JSON、需要建立 Cocos Editor 實畫面視覺閉環的情境。DO NOT USE FOR: 純 runtime 除錯（用 cocos-bug-triage）、純美術 QA（用 ui-preview-judge）、純資產切件（用 ui-asset-slice-pipeline）、未經 proof / family 收斂的純參考圖（用 ui-reference-decompose 先收斂）。'
argument-hint: '提供 source 目錄、main HTML 相對路徑、screenId、bundle，以及 Cocos Editor screenshot 或 editor target；舊 --input 單檔流程只作 debug / legacy。'
---

# HTML -> UCUF 轉換 SKILL

把同一來源目錄內的 `ui-design-tokens.json`、`colors_and_type.css`、主要 HTML 視為 source package，轉成本專案 Cocos Creator 3.8.8 使用的三層 UCUF JSON（`layouts/` / `skins/` / `screens/`）+ Composite/Child Panel TypeScript 骨架，並產生完整的安全網 sidecar。新版正式通過條件是 HTML source screenshot 與 Cocos Editor screenshot 的 `runtimeVsSource.score >= 0.95`。

Unity 對照：相當於把 React/UI Toolkit XML 一鍵轉成 ScriptableObject + UI Document + Controller 骨架，再用 Game View / Editor Preview 截圖與原始設計畫面做 95% 視覺 gate；只看 browser preview 不算最終驗收。

## 何時使用

- 已有 source package：同一來源目錄內含 `ui-design-tokens.json`、`colors_and_type.css`、主要 HTML
- 已有帶 UCUF 語意標記的 HTML / CSS 草稿（無論是手寫、設計師輸出、或 LLM 草擬）
- 需要把既有的 layout/skin JSON 用新的 HTML 重新對齊（增量同步，保留人手欄位）
- 需要在覆蓋既有 UCUF JSON 之前自動備份所有會被覆蓋的檔案
- 需要在落地時自動跑 strict gate（structure / token / interaction / motion / logic / visual）

## 不要這樣用

- HTML 完全沒有 `data-*` 語意標記時，先跑 `ui-reference-decompose` 把參考圖收斂成 proof draft
- 已有 normalized recipe 的場景，請走 `ui-spec-scaffold`（compile-recipe-to-screen-spec.js / compile-recipe-to-panel-scaffold.js）
- 純美術切片任務請用 `ui-asset-slice-pipeline`
- runtime UI 崩潰請先用 `cocos-bug-triage`

## 主要工具

- `node tools_node/run-ui-workflow.js --workflow html-to-ucuf` — **（統一入口）** recurring HTML 版本的首選入口；會先走 UI context guard，再自動分流到 `run-html-to-ucuf-workflow.js`，完成 pre-render、`*.ucuf-ready.html`、raw 轉譯、layout optimize、skin autofix、strict replay、compare / pixel diff 與 `*.workflow-summary.json`
- `node tools_node/run-html-to-ucuf-workflow.js` — **（底層 wrapper）** 當你需要直接除錯 workflow 細節時再單獨呼叫
- `node tools_node/render-html-snapshot.js` — **（M12 新增）** Puppeteer pre-render 助手；當 HTML 是 React / Vue / Babel / 任何需要 JS 執行才會產生節點的「shell-only」HTML 時，**必須**先用此工具把 runtime DOM 拍照成靜態 HTML，再交給 `dom-to-ui-json.js`
- `node tools_node/optimize-ucuf-layout.js` — **（M13 新增）** layout 節點收斂；自動折疊 auto-generated 單子 wrapper、刪除 empty leaf container，能在不破壞語意下把 nodeCount 降 10–15%
- `node tools_node/auto-fix-ucuf-skin.js` — **（M13 新增）** skin 自動修補；補 button hover/pressed/disabled state layers（HSL 演算法）+ 把 hard-coded hex 升級成 ui-design-tokens 鍵
- `node tools_node/render-ucuf-layout.js` — **（M13 新增）** UCUF JSON -> HTML 預覽；把 layout+skin 還原成可 diff 的 HTML，給 dom-to-ui-compare 做 fidelity 三方對照（source HTML / captured DOM / UCUF preview）
- `node tools_node/dom-to-ui-json.js` — 主 CLI，HTML -> layout/skin + 全部 sidecar（純靜態 HTML parser，不執行 JS）
- `node tools_node/dom-to-ui-logic-guard.js` — 覆蓋前後功能差異 gate（M9）
- `node tools_node/dom-to-ui-accuracy.js` — accuracy harness（idempotency / structuralStability / tokenCoverage / visual metrics）
- `node tools_node/scaffold-ui-component.js --ucuf --check-ucuf` — Composite/Child Panel TS 骨架
- `node tools_node/validate-ui-specs.js` — 三層 JSON 結構與 token 驗證
- `node tools_node/check-encoding-touched.js` — 修改後編碼檢查
- `node tools_node/test/dom-to-ui-self-test.js` — 全鏈路 self-test（18/18 PASS）

### Phase B 工具（M30-M37，已實作）

- `node tools_node/register-ucuf-runtime-route.js` — **（M31）** 產 `<screen>.runtime-route.json`（mountTarget / componentClass / featureFlag）
- `node tools_node/annotate-html-bindings.js` — **（M32）** 反向把 `data-contract` / `data-slot` / `data-ucuf-action` 補回 source HTML
- `node tools_node/generate-tab-childpanels.js` — **（M33）** multi-tab 自動產 N 個 ChildPanel + tab-routing.json + 即貼即用的 `<screen>.tab-routing-codemod.txt` 程式片段
- `node tools_node/runtime-screen-diff.js` — **（M34）** **未接 runtime 也可先比對** source HTML vs UCUF preview，輸出 runtime-verdict.json
- `node tools_node/plan-screen-migration.js` + `cutover-screen-variant.js` — **（M35）** 漸進切換 + cutover gate（必要 verdict=pass、自動 .bak / `--rollback`）
- `node tools_node/scan-ucuf-screen-coverage.js` — **（M36）** 掃 layouts vs mount 引用 + `*.runtime-route.json` 雙來源，產 `docs/ui-screen-migration-coverage.md`
- `node tools_node/open-screen-migration-task.js` — **（M37）** screen-migration 任務卡 wrapper（自動偵測 ChildPanel + runtime-route，套用標準 acceptance gate）
- `validate-ui-specs.js` 新增 `runtime-route-sidecar` warning（M31 收尾）：runtime-route 引用未知 screenId 或 componentClass 時警告

新版正式規格請見 `docs/html_skill_plan2.md`；舊版工具演進歷史請見 `docs/html_skill_plan.md (doc_other_0009)`。

## V2 Source Package 正式入口

啟動 v2 flow 前，先讀 `docs/html_skill_rule-evolution2.md` 中狀態為 `accepted` 的 entries：

- `auto-applicable`：只能先套到 sandbox / workflow output，不直接改正式資產；套用後必須重跑 source package validation、UCUF generation gate、HTML source vs Cocos Editor final gate。
- `reviewer-required`：只可列為報告與人工提示，不自動修改 layout / skin / screen / Panel。
- `candidate` / `rejected`：不得自動套用。

正式流程必須從 source package 開始，不再以單一 HTML 檔作為 skill 的公開入口。source package 必須在一開始驗證三件套：

- `ui-design-tokens.json`
- `colors_and_type.css`
- 主要 HTML（若目錄內有多個 HTML，必須提供 `--main-html <relativePath>`）

目標命令格式：

```bash
node tools_node/run-ui-workflow.js --workflow html-to-ucuf \
  --source-dir "Design System 3" \
  --main-html "ui_kits/character/index.html" \
  --screen-id character-ds3-main \
  --bundle lobby_ui \
  --editor-screenshot artifacts/screenshots/character-ds3-editor.png
```

注意：`--input <html>` 是 legacy / debug alias；如果沒有同時驗證 source token 與 `colors_and_type.css`，不得宣稱正式通過。`dom-to-ui-compare` / `runtime-screen-diff` 產出的 browser `sourceVsUcuf` 分數只作前置診斷，最後仍必須以 Cocos Editor screenshot 的 `runtimeVsSource.score >= 0.95` 通過。

### 過時或降級參數

| 參數 | 狀態 | 說明 |
|---|---|---|
| `--input <html>` | legacy / debug | 無法保證 token / CSS / HTML 同源 |
| `--tokens-runtime` / `--tokens-handoff` | internal | source package token 才是畫面 authority |
| `--content-contract` | optional | 已接 annotation；正式 flow 可用來補 content bind path |
| `--skip-annotate` / `--skip-optimize` / `--skip-editor-compare` | debug only | v2 source package flow 不可 skip Editor gate 後宣稱 pass |
| `--skip-compare` | diagnostic only | 只略過 browser UCUF compare；不得取代 HTML vs Cocos Editor final gate |
| `--warn-only` | debug only | 正式 flow 必須 fail-fast |

## HTML 語意標記速查

| `data-*` | 用途 |
|---|---|
| `data-anchor="fill" / "top-center" / ...` | UI Transform anchor |
| `data-name="MyNode"` | layout node name |
| `data-ucuf-id="my-id"` | UCUF stable id（locked field） |
| `data-contract="path.to.bind"` | content contract bind path |
| `data-slot="featured-list"` | LazySlot 區域 |
| `data-default-fragment="empty-list"` | LazySlot 預設 fragment |
| `data-warmup-hint="next-frame" / "idle"` | LazySlot warmup 策略 |
| `data-ucuf-action="openPanel" / "closeModal" / "tabSwitch" / "routePush"` | interaction 觸發 |
| `data-target="<panelOrTabId>"` | interaction target |
| `data-requires="some.field"` | interaction 前置驗證 |
| `data-skin="family.slot"` | 強制套用某 skin slot |
| `data-visual-zone="banner-area"` | visual review zone 標記 |

CSS 端：用 token-friendly 寫法（`color: var(--text-primary)` 或專案常用色 hex 值會被自動 token map），避免硬寫純粹自創色。

## 標準流程

### 0.5 recurring HTML 版本的首選做法：直接跑 wrapper

如果同一張設計稿會一直出新版本，不要每次手動重做 pre-render / annotate / dry-run / optimize / compare。直接跑：

```bash
node tools_node/run-ui-workflow.js --workflow html-to-ucuf \
  --source-dir "Design System 3/source" \
  --main-html index.html \
  --screen-id gacha-ds3 \
  --bundle ui_gacha \
  --editor-screenshot artifacts/screenshots/gacha-ds3-editor.png
```

統一入口會先做 context guard，之後 wrapper 會自動：

1. 判斷是否需要 pre-render
2. 產 `*.rendered.html`
3. 產 `*.ucuf-ready.html`
4. 跑 `dom-to-ui-json` raw pass
5. 跑 `optimize-ucuf-layout`
6. 跑 `auto-fix-ucuf-skin`
7. 用 optimized layout + fixed skin 做 strict replay
8. 跑 `dom-to-ui-compare` / pixel diff（diagnostic）
9. 跑 HTML source screenshot vs Cocos Editor screenshot final gate
10. 輸出 `*.workflow-summary.json`

輸出目錄預設為：

```text
artifacts/skill-test-html-to-ucuf/<screen-id>/
```

注意：wrapper 會盡量把新 HTML 自動補成「可測的 UCUF-ready 測試版」，但**不保證**每一版都能 strict replay 通過。若 summary 仍顯示 `node-count-blocker` 或其他 structural blocker，代表來源 HTML 結構熵仍過高，需要回到設計稿 / source HTML 收斂 wrapper 層級或拆 fragment。

### 0. （條件性）React / Vue / Babel-rendered HTML 必做：pre-render

`dom-to-ui-json.js` 是純靜態 parser，**不執行 JavaScript**。所以以下情況看到的會只是 shell（通常 < 30 nodes），實際 UI 全被當成空容器：

- `<script type="text/babel">` + `<div id="root">` 的 React/Babel 範例
- Vue / Svelte / Solid 等任何 client-render 框架
- 任何把主結構靠 `document.createElement` / `React.createElement` 動態插入的頁面

判別方法：grep `data-anchor|data-ucuf|data-name|data-contract|data-slot` 為 `0` 命中、又 grep 到 `react|babel|createElement` 時，**先 pre-render**：

```bash
node tools_node/render-html-snapshot.js \
  --input "<source.html>" \
  --output "artifacts/skill-test-html-to-ucuf/<screen>.rendered.html" \
  --viewport 1920x1080 --settle-ms 1500
```

之後步驟 2~8 一律用 `<screen>.rendered.html` 當 `--input`，而不是原始 `index.html`。

備註：pre-render 出來的 DOM 通常會比手寫 HTML 多很多 wrapper `<div>`，落地後 `nodeCount` 容易破 `runtimeGate.blocker`；這是真實的告警，不要忽略。建議在 React source 補 `data-anchor` / `data-name` / `data-contract` 收斂層級，再重新 pre-render。

### 1. 確認 HTML 輸入

- HTML 至少要有一個 `<body>` 內的根節點，含 `data-anchor="fill"`
- 所有可互動元素（button / 連結 / dialog 開關）至少有 `data-ucuf-action` + `data-target`
- 所有需要 bind 的文字 / 圖片至少有 `data-contract`

### 2. Dry-run（強烈建議）

不要直接覆蓋正式檔案，先 dry-run 觀察輸出：

```bash
node tools_node/dom-to-ui-json.js \
  --input <source.html> \
  --output /tmp/<screen>.layout.json \
  --skin-output /tmp/<screen>.skin.json \
  --screen-id <screen-id> \
  --bundle <bundle> \
  --emit-screen-draft \
  --emit-preload-manifest \
  --emit-performance-report \
  --strict
```

### 3. 全量產生（覆蓋前自動備份）

預設啟用備份。若既有檔案存在，工具會在第一個 `writeJson` 前把 layout / skin / 全部 sidecar 備份到：

```
artifacts/dom-to-ui-backups/<YYYY-MM-DD_HH-mm-ss>_<screenId>/
```

```bash
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

關掉備份（CI 環境）：附 `--no-backup`；自訂備份目錄：`--backup-dir <path>`。

### 4. 增量同步（保留人手欄位）

```bash
# Step A: 覆蓋前 logic inventory（M9）
node tools_node/dom-to-ui-logic-guard.js \
  --mode inventory \
  --screen-id <screen-id> \
  --layout assets/resources/ui-spec/layouts/<screen>.json \
  --screen assets/resources/ui-spec/screens/<screen>-screen.json \
  --component assets/scripts/ui/components/<Screen>Composite.ts \
  --output artifacts/dom-to-ui-logic/<screen>.before.json

# Step B: 增量同步（自動備份既有 + sidecar）
node tools_node/dom-to-ui-json.js \
  --input artifacts/ui-source/<screen>/source.html \
  --output assets/resources/ui-spec/layouts/<screen>.json \
  --skin-output assets/resources/ui-spec/skins/<screen>.skin.json \
  --screen-id <screen-id> \
  --bundle <bundle> \
  --sync-existing \
  --merge-mode preserve-human \
  --conflict-policy fail \
  --strict \
  --validate

# Step C: 覆蓋後 logic verify（strict）
node tools_node/dom-to-ui-logic-guard.js \
  --mode verify \
  --screen-id <screen-id> \
  --baseline artifacts/dom-to-ui-logic/<screen>.before.json \
  --layout assets/resources/ui-spec/layouts/<screen>.json \
  --screen assets/resources/ui-spec/screens/<screen>-screen.json \
  --component assets/scripts/ui/components/<Screen>Composite.ts \
  --output artifacts/dom-to-ui-logic/<screen>.after.json \
  --strict
```

### 5. Composite/Child Panel 骨架（如果需要）

```bash
node tools_node/scaffold-ui-component.js \
  --screen <screen-id> \
  --ucuf \
  --check-ucuf \
  --out assets/scripts/ui/components/
```

### 6. Accuracy 驗收（≥95% 相似度的關鍵）

```bash
node tools_node/dom-to-ui-accuracy.js \
  --input <source.html> \
  --screen-id <screen-id> \
  --bundle <bundle> \
  --baseline tests/fixtures/dom-to-ui/<screen>.accuracy-baseline.json \
  --output artifacts/dom-to-ui-accuracy/<screen>.json \
  --iterations 5 \
  --strict
```

判讀方式（≥95% 標準）：

- `idempotencyRate` 必須 = `1`（重跑必須產出完全相同的結果）
- `structuralStability` 必須 = `1`
- `tokenCoverage` 應 ≥ `0.95`（這是「是否使用 token define 而非寫死」的關鍵指標）
- `warning precision/recall` 需符合 baseline
- `verdict` = `pass`

### 7. 視覺比對圖（512×256 compare board）

產出一張左右對比圖：左側是 HTML 原始畫面，右側是 UCUF wireframe 預覽（帶 token 顏色）。

```bash
node tools_node/dom-to-ui-compare.js \
  --html  <source.html> \
  --layout <screen>.json \
  --skin   <screen>.skin.json \
  --screen-id <screen-id> \
  --output artifacts/skill-test-html-to-ucuf/<screen>.compare.png
```

- 需要 Chrome / Edge（自動偵測）
- 輸出為 `<screen>.compare.png`（512×256，左: HTML Source / 右: UCUF Preview）
- 供人工或 Agent 快速驗證大框架是否正確（顏色、層級、按鈕位置）
- 支援 `--width` / `--height` 自訂尺寸、`--browser <path>` 指定瀏覽器

### 8. 收尾驗證

```bash
node tools_node/validate-ui-specs.js
node tools_node/check-encoding-touched.js
```

## Phase B：Wire-to-Runtime（M30-M37）

Phase A 結束（layout/skin/screen JSON + sidecar 全綠）後，進 Phase B 把 JSON 接到真正的遊戲畫面。每張畫面從 Phase A 進入 Phase B 都靠 task-card-opener 的 `screen-migration` 模板開卡。

### B1. Mount Registry 登記

```bash
node tools_node/register-ucuf-runtime-route.js \
  --screen <screenId> \
  --mount <CompositePanel> \
  --feature-flag __UCUF_<NAME>_VARIANT
```

產 `<screen>.runtime-route.json`，登錄 mount target / componentClass / featureFlag。Composite 端改用 `UIVariantRouter.resolve('<screen>')` 取代硬寫 `mount(screenId)`。

### B2. HTML Semantic Annotation

```bash
node tools_node/annotate-html-bindings.js \
  --html Design\ System*/ui_kits/<screen>/index.html \
  --screen <screenId> \
  --apply
```

讀 `<screen>.contentRequirements` + 規則庫，把 `data-contract` / `data-slot` / `data-ucuf-action` 補回 source HTML。重跑 `dom-to-ui-json` 後 layout 才有 binding。

### B3. Tab ChildPanel 自動產生

```bash
node tools_node/generate-tab-childpanels.js \
  --layout assets/resources/ui-spec/layouts/<screen>.json \
  --tabs Overview,Stats,Skills,Bloodline,Story,Equipment
```

multi-tab 畫面自動產 N 個 ChildPanel TS scaffold + `<screen>.tab-routing.json`。

### B4. Runtime Visual Diff

```bash
node tools_node/runtime-screen-diff.js --screen <screenId>
```

dev toggle 切新版 → cocos-preview-qa skill 截圖 → 與 source HTML / 舊版三方 pixel-diff，輸出 `<screen>.runtime-verdict.json`。

### B5. Migration Plan + Cutover

```bash
node tools_node/plan-screen-migration.js --screen <screenId> > plan.json
node tools_node/cutover-screen-variant.js --screen <screenId> --from unified --to ds3
```

漸進切換 + cutover gate（runtime-diff ≥ 95%、logic-guard pass）。失敗自動 rollback。

### B6. Coverage Tracker

```bash
node tools_node/scan-ucuf-screen-coverage.js
```

掃 `layouts/*.json` 比對 `mount(...)` 引用，分類為 `orphan / pending-html / wired-dev / cutover-prod`，更新 `docs/ui-screen-migration-coverage.md`。

## Sidecar 檔案速查

| 副檔名 | 預設 | 用途 |
|---|---|---|
| `<screen>.layout.json` | always | UCUF layout |
| `<screen>.skin.json` | always | UCUF skin（token reference） |
| `<screen>.screen.json` | `--emit-screen-draft` | screen package |
| `<screen>.preload.json` | `--emit-preload-manifest` | preload manifest |
| `<screen>.performance.json` | `--emit-performance-report` | runtimeGate / nodeCount / maxDepth |
| `<screen>.composite.json` | auto | Canvas/SVG/chart 偵測 |
| `<screen>.bundle-suggestion.json` | auto | bundle 切分建議 |
| `<screen>.sync-report.json` | `--sync-existing` 後 | merge delta |
| `<screen>.r-guard.json` | auto | R25/R27/R28/forbiddenNodeType |
| `<screen>.interaction.json` | auto | M10 interaction draft |
| `<screen>.motion.json` | auto | M10 motion draft（CSS transition/keyframes） |
| `<screen>.fragment-routes.json` | auto | LazySlot fragment 路由 |
| `<screen>.logic-inventory.json` | auto | M9 既有功能清單 |
| `<screen>.logic-guard.json` | auto | M9 覆蓋前後 verdict |
| `<screen>.visual-review.json` | auto | M11 美術視覺回歸 metrics |

## 失敗 / Exit Code 速查

| Exit | 含義 | 處理 |
|---|---|---|
| `2` | CLI 參數錯 | 修正 CLI |
| `3` | performance blocker | 補節點數、貼圖記憶體 |
| `4` | sync conflict | 改 `--conflict-policy warn` 或人工解 |
| `5` | validate 失敗 | 看 `R25/R27/R28` codes |
| `6` | unmapped / forbidden token | 補 token map 或修 HTML |
| `7` | R-guard 失敗 | 看 `<screen>.r-guard.json` |
| `8` | accuracy 失敗 | 看 baseline diff |
| `9` | logic guard 失敗 | 比對 inventory before/after |
| `10` | interaction/motion blocker | 補 `data-target` / `data-ucuf-action` |

## 還原方式

若覆蓋後發現 UI 壞掉：

```powershell
# 找最新備份
$bak = Get-ChildItem artifacts/dom-to-ui-backups/*_<screenId>/ |
  Sort-Object Name -Descending | Select-Object -First 1
# 還原
Copy-Item $bak/<screen>.json assets/resources/ui-spec/layouts/<screen>.json
Copy-Item $bak/<screen>.skin.json assets/resources/ui-spec/skins/<screen>.skin.json
```

## 驗收 Checklist

### Phase A — Fidelity（HTML → JSON）

- [ ] 若 HTML 為 React/Vue/Babel-rendered：先跑 `render-html-snapshot.js` 並把 `--input` 換成 rendered 版本
- [ ] React/Vue 來源產出後跑 `optimize-ucuf-layout.js` 收斂節點（auto-folder + empty-leaf cleaner）
- [ ] `auto-fix-ucuf-skin.js` 補 button state layers + token migration（消除 visual-review.button-state-layer-review-required blocker）
- [ ] `render-ucuf-layout.js` 產出 UCUF preview HTML，與 source HTML / captured DOM 三方比對
- [ ] HTML 含必要 `data-*` 語意標記
- [ ] dry-run 沒有 R25/R27/R28 / unmapped-token / forbidden-node 警告
- [ ] 正式覆蓋時印出 `[dom-to-ui-json] backup created: ...` 一行
- [ ] `dom-to-ui-compare.js` 產出 `<screen>.compare.png`（人工確認左右大框架一致）
- [ ] `validate-ui-specs.js` 全綠
- [ ] `dom-to-ui-accuracy.js --strict` verdict=pass
- [ ] `tokenCoverage ≥ 0.95`（無寫死顏色 / 字級 / 間距）
- [ ] `<screen>.logic-guard.json` verdict ≠ `fail`
- [ ] `<screen>.visual-review.json` verdict ≠ `fail`
- [ ] `check-encoding-touched.js` 全綠
- [ ] 已 append 對應的 evolution log entry（若改動規則）

### Phase B — Wire-to-Runtime（M30-M37）

- [x] 跑 `scan-ucuf-screen-coverage.js --write-md` 確認 status：目標畫面是 `wired-dev`，舊版仍 `cutover-prod`
- [x] 用 `register-ucuf-runtime-route.js` 產 `<screen>.runtime-route.json` 並設 featureFlag
- [x] CompositePanel 改用 `UIVariantRouter.resolve(panelKey)` 取代硬寫 `mount(literal)`
- [ ] （可選）`annotate-html-bindings.js --apply` 補 `data-contract` / `data-slot` / `data-ucuf-action`
- [x] （多 tab 畫面）`generate-tab-childpanels.js` 產 N 個 ChildPanel scaffold + tab-routing.json + `<screen>.tab-routing-codemod.txt`
- [x] `runtime-screen-diff.js` 在「未接 runtime」前先看到 source vs UCUF 比對；verdict ≥ `warn`
- [ ] dev toggle 切到新版做手動目視確認後，runtime screenshot 補進 `--runtime`，verdict=`pass`
- [x] `plan-screen-migration.js` 產逐步 plan，逐步通過 logic-guard + runtime-diff
- [x] `cutover-screen-variant.js --verdict <verdict.json>` 通過 gate 後 apply；保留 `.bak` 直到下個 release
- [ ] cutover 後重跑 `scan-ucuf-screen-coverage.js`，目標畫面狀態變 `cutover-prod`

## 相關文件

- `docs/html_skill_plan.md (doc_other_0009)` — 完整規格（§1 ~ §45）
- `docs/html_skill_rule-evolution.md` — 規則演進 log
- `docs/UCUF技術文件.md` — UCUF JSON 規範
