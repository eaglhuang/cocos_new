# UI Factory Ops Guide

## 核心結論

延伸入口：

- `docs/UI-factory-agent-entry.md` (doc_ui_0032)：其他 Agent 的必讀順序與路由入口。
- `docs/UI-reference-source-workflow.md (doc_ui_0036)` (doc_ui_0036)：canonical reference 來源、AI prompt 協作與 reference 探索流程。
- `docs/ui/UI-factory-baseline-and-gates.md (doc_ui_0047)` (doc_ui_0047)：統一 UI 基準、平台範圍、量產 gate 與完成定義。
- `artifacts/ui-source/factory-progress-scorecard.json`：當前量產工程進度與尚未完成 gate。

這條量產線真正可複用的主幹，不是 AI 拆解圖，也不是單次生成成功的素材，而是：

1. `UItemplate` 負責大骨架。
2. `widget` 負責可重複組裝的小模組。
3. `content contract` 負責資料欄位與綁定。
4. `skin fragment` 負責視覺皮膚。
5. AI 只負責補局部缺件，不負責整頁真相。

對這個專案而言，組裝主幹已存在於：

- `assets/scripts/ui/core/UITemplateResolver.ts`
- `assets/scripts/ui/core/UITemplateBinder.ts`
- `assets/scripts/ui/core/UISkinResolver.ts`
- `tools_node/scaffold-ui-spec-family.js`
- `tools_node/scaffold-ui-component.js`

所以未來流程的正確方向，不是「讓 AI 畫更多整頁」，而是「讓更多畫面回到既有 `UItemplate + widget`，AI 只補 template 沒有的局部視覺件」。

## 角色分工

### 0. Reference Source Strategist

- 負責什麼：先判斷 canonical reference 來自使用者、AI 探索，還是混合模式。
- 主要工具：正式規格、`docs/UI-reference-source-workflow.md (doc_ui_0036)` (doc_ui_0036)、`artifacts/ui-source/ai-recipes/reference-prompt-card-template.md`、`dalle3-image-gen` skill。
- 輸出：reference prompt card、`canonicalReferences`、`reference/prompts/*`、`reference/generated/*`。
- 為什麼會變快：先對齊視覺語言與禁用語言，避免後面 proof / family routing 都建立在錯 reference 上。
- 前提條件：screen 目標、平台限制、family 禁忌、使用者是否已有現成 reference 必須先講清楚。

### 1. Intake Compiler

- 負責什麼：讀參考圖、既有 runtime、規格，判定這張畫面是 Tier A / B / C。
- 主要工具：`tools_node/intake-ui-screen.js`、`capture-ui-screens.js`、正式規格與 task brief。
- 輸出：`manifests/intake.json`
- 為什麼會變快：先分類，避免所有 screen 都誤走最重流程。
- 前提條件：有 canonical reference、既有 runtime capture、screenId 與 template family 候選。

### 2. Proof Compiler

- 負責什麼：把參考圖拆成 `visualZones / contentSlots / spacingRecipe / componentIntents`。
- 主要工具：`ui-reference-decompose` skill。
- 輸出：`proof/<screen-id>.proof.json`
- 為什麼會變快：把抽象審美問題轉成結構問題，後面才能編譯。
- 前提條件：參考圖或拆解圖已縮成可讀 preview，且 screen 已判定 Tier。

### 3. Family Router

- 負責什麼：把每個 zone 對回 `UItemplate + widget + skin fragment`，決定哪些可 reuse，哪些才需要新資產。
- 主要工具：`tools_node/compile-proof-to-family-map.js`、`UITemplateResolver.ts`、`UISpecTypes.ts`、既有 widget/template 庫。
- 輸出：`proof/<screen-id>.family-map.json`
- 為什麼會變快：直接把 70% 到 80% 可重用區塊排除出 AI 生圖範圍。
- 前提條件：proof 已拆好 zone，且 family/widget 命名規則一致。

### 4. Asset Task Compiler

- 負責什麼：只把 `generate-partial-asset` 類型 zone 編譯成單件任務，不讓人手工一條條寫 prompt。
- 主要工具：`tools_node/compile-family-map-to-asset-tasks.js`
- 輸出：`manifests/asset-task-manifest.json`、`tasks/*.json`、`prompts/*.txt`
- 為什麼會變快：把大任務切成小任務，失敗只重跑局部件。
- 前提條件：family-map 已明確標出 `generationNeed` 與 `assetTargets`。

如果 zone 屬於 icon system，正確做法不是把 icon 當雜項 image，而是：

1. 先在 proof 裡把它標成 `family: icon`
2. family router 把它映射成 `icon-suite / icon-badge-suite / icon-currency-suite`
3. Asset Task Compiler 以同 family suite 為基準編譯任務
4. 盡量 batch 生成同一套 icon，而不是零碎逐顆生圖

### 5. Image Generation Agent

- 負責什麼：只生局部視覺件，例如 `header-cap-left`、`crest-face`、`portrait-wash`。
- 主要工具：`.github/skills/nano-banana-gen/scripts/generate-banana.js`
- 輸出：`generated/<task-id>/raw/*`
- 為什麼會變快：只賭單件，不賭整頁；失敗成本下降。
- 前提條件：任務已明確定義 `slot / fitRules / negatives / output spec`。

### 6. Asset Post-Process Agent

- 負責什麼：把模型原始輸出整理成真正可掛 runtime 的素材。
- 主要工具：`trim-png-by-background.js`、`postprocess-ui-asset.js`、alias policy、slot occupancy 規則。
- 輸出：`generated/<task-id>/processed/*`
- 為什麼會變快：把模型的不穩定形狀拉回 template slot 可接受範圍。
- 前提條件：slot 尺寸、可侵入區、對稱要求已明確。

這個環節現在不該只做 trim。正式做法應至少包含：

1. trim / fit 到指定 canvas
2. 對可判定背景殘留做 safe de-fringe / outer-ring cleanup
3. 檢查輸出尺寸是否符合 slot spec
4. 檢查最外圈與外圈 2px 是否殘留髒 alpha
5. sliced 資產時檢查 border 是否為整數且不超出尺寸

建議命令：

```bash
node tools_node/postprocess-ui-asset.js --input <raw.png> --output <processed.png> --canvas-width <w> --canvas-height <h> --sprite-type sliced --border 20,20,20,20 --fit-padding 12 --report <report.json> --strict
```

若手上已有 `tasks/<task-id>.json`，標準跑法改為：

```bash
node tools_node/run-ui-asset-postprocess.js --task <task.json> --input <raw.png> --strict
```

它會自動把：

1. raw 檔複製到 `generated/<task-id>/raw/`
2. processed PNG 輸出到 `generated/<task-id>/processed/`
3. post-process report 輸出到 `generated/<task-id>/reports/`

若手上是整批 `generate-partial-asset` 任務，直接改走：

```bash
node tools_node/run-ui-asset-task-batch.js --family-map <family-map.json> --input-dir <raw-dir> --strict
```

或：

```bash
node tools_node/run-ui-asset-task-batch.js --manifest <asset-task-manifest.json> --input-dir <raw-dir> --strict
```

這會把 compile 與逐 task post-process 串在同一條命令上，最後額外寫出 `generated/postprocess-batch-report.json`。

### 7. Assembly Agent

- 負責什麼：把 `UItemplate + widget + skin fragment + content contract` 真正組成 screen。
- 主要工具：`scaffold-ui-spec-family.js`、`scaffold-ui-component.js`、`UITemplateBinder.ts`、`UISkinResolver.ts`
- 輸出：`layout / skin / screen / component` 或更新後的 runtime screen。
- 為什麼會變快：組裝不是手拼 node，而是以 template 與 widget 展開。
- 前提條件：結構與內容契約不能被 AI 資產反向污染。

### 8. QC Router

- 負責什麼：把資產驗證與 runtime 驗證排成固定關卡，快速標記 pass / fail / fallback。
- 主要工具：`validate-ui-specs.js`、`capture-ui-screens.js`、`check-encoding-touched.js`
- 輸出：`review/generated-review.json`、`review/runtime-verdict.json`
- 為什麼會變快：錯誤在前面被攔住，不用等整頁做完才回頭重修。
- 前提條件：每個 zone 都要有對應的 pass/fail 規則，而不是只看整頁主觀感覺。

## 環節對照表

| 環節 | 誰負責 | 主要工具 | 主要輸出 | 變快原理 | 前提條件 |
|---|---|---|---|---|---|
| 參考圖來源 | Reference Source Strategist | `UI-reference-source-workflow.md` (doc_ui_0036)、prompt card template、DALL-E 3 workflow | canonical reference / prompt card / reference assets | 先固定參考真相，避免後面整串都建在錯誤視覺假設上 | 必須先知道使用者是否已有參考圖 |
| Intake | Intake Compiler | `intake-ui-screen.js`、`capture-ui-screens.js` | `intake.json` | 先分流畫面重量，避免一開始就走最重流程 | 有 reference 與 runtime capture |
| Proof | Proof Compiler | `ui-reference-decompose` | `proof.json` | 先固定語意區塊，後面才能編譯 | zone 能被穩定命名 |
| Family Routing | Family Router | `compile-proof-to-family-map.js`、template/widget 庫 | `family-map.json` | 大部分區塊直接 reuse，不再重畫 | family 與 widget 命名穩定 |
| Task Compile | Asset Task Compiler | `compile-family-map-to-asset-tasks.js` | task JSON + prompt TXT | 把 AI 任務切小，避免整頁重骰 | family-map 已有 `generationNeed` |
| 生圖 | Image Generation Agent | `generate-banana.js` | raw assets | 只重跑單一 slot，不動整頁 | task 定義完整 |
| 後處理 | Asset Post-Process Agent | `trim-png-by-background.js` 等 | processed assets | 把模型噪音壓回 slot 規格 | slot 規格存在 |
| 組裝 | Assembly Agent | `scaffold-ui-spec-family.js`、`UITemplateResolver.ts` | 可跑 runtime 的 screen | 結構固定、只換參數與皮膚 | template/widget 可承接 |
| 驗收 | QC Router | `validate-ui-specs.js`、`capture-ui-screens.js` | verdict JSON | 早擋錯、少返工 | 固定 QC 規則 |

## 為什麼下一個畫面還能用

下一張畫面可複用，不是因為它「看起來有點像」，而是因為它仍然沿用同一組結構資產：

1. 同一個 `UItemplate` family。
2. 同一組 `widget` 類型與 compose 規則。
3. 同樣的 `content contract` 命名方式。
4. 同類型的 `skin fragment` 與 recipe。
5. 只有少量局部視覺件需要 AI 補件。

換句話說，可複用性來自 template 與 widget 的結構穩定，而不是來自 AI 圖片本身。

## 什麼情況下這條流程不會變快

以下任一條成立，流程就會退化回手工慢收：

1. 每張 screen 都被誤判成 Tier C。
2. AI 開始接整頁 layout 任務。
3. `UItemplate + widget` 沒被當成唯一組裝主幹。
4. family-map 還是人手臨場硬寫，沒有規則化。
5. 驗收沒有固定 fail reason，只能靠主觀肉眼爭論。

## 建議落地順序

1. 先用 `GeneralDetailOverview` 補齊 `intake.json`、`family-map.json`、`asset-task-manifest.json`。
2. 用 `compile-family-map-to-asset-tasks.js` 把 `headerPlaque` 與 `crestMedallion` 先編譯成局部任務。
3. 驗證第二張 `detail-split` 畫面時，只允許 reuse + partial asset，不要重新打破 template。
4. 只有當第二張畫面也證明變快，這條流程才算升級成 factory default。