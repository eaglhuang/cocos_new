---
doc_id: doc_agentskill_0006
name: context-budget-guard
description: Agent context budget guard and artifact compression workflow. USE FOR: image-heavy QA, compare board review, screenshot batches, large keep/todo/task manifests, long notes handoff, and md/json diff summarization. Trigger this before reading or forwarding heavy artifacts when token growth is a risk.
---

# Context Budget Guard

這個 skill 的目標只有一件事：把重上下文工作改成「先掃描、再摘要、最後只傳必要片段」，避免 agent 因為圖片、compare board、長篇 `md/json` 或大量 touched files 直接把對話撐爆。

## 什麼時候一定要用

- UI QA 需要看多張 `png`、`compare-board`、`screenshot`
- handoff 會碰到 `docs/keep.md (doc_index_0011)` (doc_index_0011)、`docs/ui-quality-todo.json`、大型 notes、task manifest
- 需要比較大型 `.md` 或 `.json` 變更
- 你懷疑某一輪對話量會突然暴增

## 預設流程

### 1. 先跑預警，不要先讀整包

如果任務已經有 wrapper 入口，優先直接走 wrapper：

```bash
node tools_node/run-ui-workflow.js --workflow <workflow-id> ...
node tools_node/run-guarded-workflow.js --workflow <name> ...
```

wrapper 會在內部先做 budget 檢查與 block 判定。

如果你是手動處理，才直接跑底層工具：

```bash
node tools_node/check-context-budget.js --changed --emit-keep-note
```

如果是特定資料夾或特定 artifact：

```bash
node tools_node/check-context-budget.js --files <file...>
node tools_node/check-context-budget.js --dirs artifacts/ui-qa docs
```

判讀方式：

- `ok`: 可以繼續，但仍優先走摘要卡
- `warn`: 禁止把大型檔案整份貼進對話
- `hard-stop`: 只能傳摘要卡、路徑、結論，不能傳整包內容

### 2. 產生最小 handoff 卡

```bash
node tools_node/generate-context-summary.js --task <task-id> --goal "<goal>" --files <file...>
```

handoff 一律壓成這 6 欄：

- `task`
- `goal`
- `read`
- `known`
- `need`
- `avoid`

不要把完整 `keep.md` (doc_index_0011)、`ui-quality-todo.json`、長 notes、整批 QA 圖片直接帶進下一輪。

### 3. md/json diff 一律先做結構化摘要

比較工作樹與 `HEAD`：

```bash
node tools_node/summarize-structured-diff.js --git docs/keep.md
node tools_node/summarize-structured-diff.js --git docs/ui-quality-tasks/
```

比較兩個檔案版本：

```bash
node tools_node/summarize-structured-diff.js --base old.md --head new.md
node tools_node/summarize-structured-diff.js --base old.json --head new.json
```

摘要原則：

- `Markdown`: 只報 heading 增減、變更區塊行號、增刪行數
- `JSON object`: 只報 top-level key 的 `added / removed / changed`
- `JSON array`: 優先用 `id` 比對，沒有 `id` 才退回 index 摘要

如果摘要已經足夠，禁止再把整份 diff 送進對話。

### 4. 圖片與 QA artifact 規則

- 一次最多 `1` 張主圖 + `1` 張對照圖
- 其他圖片只保留路徑、用途、尺寸級別、結論
- `compare-board`、`contact-sheet`、批次 screenshot 預設視為高風險，不要整批帶進上下文
- 圖片討論以「路徑 + 結論 + 採樣圖」為主，不做像素級口述 diff

建議描述格式：

```text
artifact: artifacts/ui-source/shop-main/review/v2-compare-board.png
role: compare board
decision: QA selection only; do not inline into handoff
pick: one hero image + one comparison crop at most
```

### 5. 觸發 keep 警報

只要 `check-context-budget.js` 出現 `warn` 或 `hard-stop`：

- 在 `keep.md` (doc_index_0011) 記一筆原因摘要
- 列成第一優先級風險
- 寫出可能來源，例如：
  - `compare board / screenshot / QA image batch`
  - `keep.md / ui-quality-todo.json / long notes full inline`
  - `binary artifact mixed into changed files`

### 6. 收工前回報本輪 token 量級

在 final answer 前補一行估算值。若已走 wrapper，優先使用 finalizer：

```bash
node tools_node/finalize-agent-turn.js --workflow <workflow-id> --changed
```

若你只需要單行估算，再直接用：

```bash
node tools_node/report-turn-usage.js --files <touched files> --emit-final-line
```

如果你一時抓不到 touched files，至少跑：

```bash
node tools_node/report-turn-usage.js --changed --emit-final-line
```

只回報三級：

- `少`
- `中`
- `大`

這是依目前讀寫檔案與 artifact 的估算值，不是模型 API 的精準計費數字；但它足夠拿來做日常警戒與 keep 追蹤。

### 7. 這個 skill 不做什麼

- 不負責視覺判斷本身
- 不負責產生圖片內容
- 不負責替代正常 QA

它只負責把 context 壓小，讓 agent 能穩定做事。

## 推薦搭配

- 如果使用者以 `(best)` 開頭，先進 `.agents/skills/best-mode/SKILL.md` (doc_agentskill_0001)
- 圖片 QA：先用這個 skill，再進 `cocos-preview-qa` 或 `cocos-screenshot`
- UI pipeline：先用這個 skill，再進 `ui-vibe-pipeline`
- 任何會改文字檔的工作：最後再跑 `encoding-touched-guard`
