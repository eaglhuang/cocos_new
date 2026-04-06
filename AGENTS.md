# 3KLife Agent Overrides

本檔補充專案內的高優先級 Agent 行為規則。

## `(best)` 嚴格模式

只要使用者訊息以 `(best)` 開頭，Agent 必須視為進入「最佳上下文節流模式」。

### 強制行為

1. 先讀 `docs/keep.md`。
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

## Skill 指名

若使用者直接提到 `$context-budget-guard` 或 `$best-mode`，Agent 必須優先套用對應 skill。
