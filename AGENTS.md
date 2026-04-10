# 3KLife Agent Overrides

本檔補充專案內的高優先級 Agent 行為規則。

## 全域縮圖讀取規則

這條規則不再限定 `(best)` 模式，而是所有對話都一律生效。

1. 任何 `view_image` 前，先確認圖片寬度。
2. 採用「thumbnail-first progressive zoom」：先試 `125px`；如果 `125px` 已足夠辨識，就不准放大。
3. 若 `125px` 不足以完成當前判讀，才允許放大一倍，依序走 `125px -> 250px -> 500px`；每次都要在前一級明確不足時才能升級。
4. Browser screenshot / Editor screenshot / compare board / PrintWindow / 全畫面 capture，一律先裁主區域，再套用同一套 `125 -> 250 -> 500` 規則；禁止直接跳大圖。
4. 若需要縮圖，先跑：
   ```bash
   node tools_node/prepare-view-image.js --input <path>
   ```
5. `prepare-view-image.js` 的預設寬度現在就是 `125px`；若看不清，才重跑 `--maxWidth 250`，再不夠才 `--maxWidth 500`。
6. 若不想手記 `125 / 250 / 500`，優先改用：
   ```bash
   node tools_node/prepare-view-image-progressive.js --input <path> --level thumb
   ```
   看不清時再改 `--level inspect`、`--level detail`；若要從上一張 preview 繼續升級，需搭配 `--next --source <original-path>`。
7. 單次回合最多 `1` 張主圖 + `1` 張對照圖。
8. 只有在使用者明確表示「放開縮圖原則 / 允許讀原圖」時，才可查看 `>500px` 原圖。
9. 截圖工具流應優先直接產出可讀的小圖；若工具先產大圖，必須立刻接 `prepare-view-image.js` 或 progressive wrapper，不得把原始大圖直接送進 `view_image`。

## `(best)` 嚴格模式

只要使用者訊息以 `(best)` 開頭，Agent 必須視為進入「最佳上下文節流模式」。

### 強制行為

1. 先讀 `docs/keep.summary.md`（需修改共識時才讀 `docs/keep.md` 全文）。
2. 立刻套用 `.agents/skills/best-mode/SKILL.md` 的路由規則。
3. 在讀取大型檔案、compare board、QA 圖片、長篇 notes、`docs/ui-quality-todo.json`、`docs/keep.md` 之前，先跑：
   ```bash
   node tools_node/check-context-budget.js --changed --emit-keep-note
   ```
4. 若任務含大型 `.md` / `.json` 變更，先跑：
   ```bash
   node tools_node/summarize-structured-diff.js --git <file>
   ```
5. handoff 與中繼摘要一律優先使用：
   ```bash
   node tools_node/generate-context-summary.js --task <task-id> --goal "<goal>" --files <file...>
   ```
6. final answer 前一律補：
   ```bash
   node tools_node/report-turn-usage.js --changed --emit-final-line
   ```

### Wrapper 優先

- UI 任務優先走：
  ```bash
  node tools_node/run-ui-workflow.js --workflow <workflow-id> ...
  ```
- 非 UI，但有圖片、compare board、大型文件或重 diff 的任務，優先走：
  ```bash
  node tools_node/run-guarded-workflow.js --workflow <name> ...
  ```
- 收工前優先走：
  ```bash
  node tools_node/finalize-agent-turn.js --workflow <workflow-id> ...
  ```

### 額外限制

- 禁止直接把整份 `keep.md`、`ui-quality-todo.json`、大型 notes、compare board、批次 screenshot 塞進對話。
- 圖片一次最多 `1` 張主圖 + `1` 張對照圖。
- 若 `check-context-budget.js` 回傳 `warn` 或 `hard-stop`，必須先縮摘要，再繼續工作。
- 若已使用 wrapper，wrapper 的 block 結果優先，不能繞過。
- 若要替換 `assets/resources/sprites/ui_families/general_detail/v3_final/*` 的 alias，必須先讀 `docs/ui/general-detail-v3-final-alias-policy.md`，只能照白名單或 provisional-allow 執行；黑名單替換一律先開 task，再跑新的 `formal-pass-rX`。
- 若要處理框體資產，必須先判斷它是不是 `non-9-slice ornate frame`：凡是四角完整花角 + 四邊連續 ornament 的整框，禁止直接九宮拉伸；只能固定尺寸、拆角邊件，或改畫 stretch-safe 中段版本。

## Skill 指名

若使用者直接提到 `$context-budget-guard` 或 `$best-mode`，Agent 必須優先套用對應 skill。
