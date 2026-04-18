---
doc_id: doc_agentskill_0009
name: task-card-opener
description: '通用任務開單器 SKILL — 統一建立或回寫 Markdown task card、docs/tasks/tasks-*.json 分片、UI quality shard，並強制遵守 docs/agent-briefs/Readme.md (doc_ai_0023) 與 docs/遊戲規格文件/系統規格書/名詞定義文件.md (doc_spec_0008) 的硬規則。USE FOR: 開任務卡、開單、task card、task shard、tasks-ui.json、tasks-prog.json、tasks-dc.json、tasks-data.json、agent-briefs/tasks、docs/tasks/*_task.md、UI pipeline 開卡。DO NOT USE FOR: 純 runtime 除錯、單純修改既有功能碼但不需要新卡、只做極小 typo 修補。'
argument-hint: '提供 task 類別、目標系統、是否需要 Markdown 卡、對應 task id 前綴、owner/priority/status，以及是否屬於 UI 任務。'
---

# Task Card Opener

## 目的

把專案內不同來源的任務卡建立流程收斂成同一套開單系統，避免：

1. 有些卡只建 Markdown，沒同步 shard / manifest
2. 有些卡只加 JSON，沒有遵守多 Agent 協作欄位
3. UI pipeline、一般程式任務、Data Center 任務各自長出不同開卡習慣

本 skill 的唯一真相來源是：

1. `docs/agent-briefs/Readme.md (doc_ai_0023)` 的硬規則
2. `docs/tasks/README.md (doc_index_0013)` 的 shard 規則
3. `.github/instructions/agent-collaboration.instructions.md (doc_ai_0009)` 的 lock / unlock / post-flight 規則
4. `docs/遊戲規格文件/系統規格書/名詞定義文件.md (doc_spec_0008)` 的任務卡 ID / 卡號 / 系統代碼定義

## 強制規則

1. 正式工作原則上先有任務卡，再開始實作、重構、批次文件整理或正式 QA。
2. 先決定任務的主資料面，再落檔；不可先寫 Markdown 再回頭猜 shard，也不可只補 shard 不補協作欄位。
3. 只要會改 task JSON，就要先依協作規則處理 lock。
4. 任何新的 Markdown 任務卡，都要遵守 `doc_ai_0023` 的欄位與 notes 慣例。
5. UI 任務若有 shard/aggregate 流程，仍必須在更新後執行 `node tools_node/build-ui-task-manifest.js`；這條規格不可省略。

## CLI compiler

本 skill 對應的可執行工具是 `tools_node/task-card-opener.js`。它有兩種模式：

1. 直接模式：從參數產出 Markdown 任務卡與 JSON skeleton / aggregate
2. recipe 相容模式：若提供 `--recipe`，就直接委派給既有的 recipe compiler

常用範例：

```bash
node tools_node/task-card-opener.js --id BAT-1-0001 --title "BattleController 驗證補強" --owner Copilot --priority P1 --md-out docs/agent-briefs/tasks/BAT-1-0001.md --json-out docs/tasks/tasks-prog.json --write
node tools_node/task-card-opener.js --id UI-1-0001 --title "UI quality shard" --md-out docs/agent-briefs/tasks/UI-1-0001.md --json-out docs/ui-quality-tasks/UI-1-0001.json --json-kind ui-quality-task-shard --write
node tools_node/task-card-opener.js --recipe artifacts/ui-source/example/generated/example-screen.recipe.json --write --out artifacts/ui-source/example/generated/example-task-card.md --shard-out artifacts/ui-source/example/generated/example-task-shard.json
```

## 決策流程

### Step 0: Pre-flight

1. 讀 `docs/keep.summary.md (doc_index_0012)`。
2. 讀 `docs/agent-briefs/Readme.md (doc_ai_0023)`。
3. 若要改 task JSON，先依 `.github/instructions/agent-collaboration.instructions.md (doc_ai_0009)` 鎖卡。

### Step 1: 判斷任務落在哪個系統

任務卡 ID / 卡號 / 系統代碼一律先以名詞定義文件為準，再決定要落在哪個 shard 或 Markdown 卡。

使用下表決定主資料面：

| 情境 | 主資料面 | 補充輸出 |
|---|---|---|
| 一般程式/系統/Data Center/資料契約任務 | `docs/tasks/tasks-*.json` 對應分片 | 視需求補 human-readable Markdown |
| UI 品質 / UI 生產流程任務 | `docs/ui-quality-tasks/*.json` shard | 視流程補 `docs/tasks/*_task.md` 或 `docs/agent-briefs/tasks/*.md` |
| 多 Agent 明確分工 / handoff / 需要 frontmatter 任務卡 | `docs/agent-briefs/tasks/*.md` | 同步對應 shard / manifest |
| 使用者明確要求獨立 md 任務卡 | 對應 md 卡路徑 | 同步對應 shard / manifest，不可只建 md |

原則：

1. `docs/tasks/tasks-ui.json`、`tasks-prog.json`、`tasks-dc.json`、`tasks-data.json` 是分類分片真相。
2. `docs/agent-briefs/tasks/*.md` 是人類可讀協作卡，不是用來取代 shard。
3. 若同一任務同時需要 md 卡與 shard，兩邊都要建立，但欄位語意要一致。

### Step 2: 建卡前最低欄位

至少要先確定：

1. `id`
2. `title`
3. `owner`
4. `priority`
5. `status`
6. `description`
7. `acceptance`
8. `deliverables`
9. `related / depends`
10. `notes`

`notes` 建議格式固定為：

```text
YYYY-MM-DD | 狀態: open/in-progress/blocked/done | 驗證: pending/... | 變更: ... | 阻塞: ...
```

### Step 3: 建立或回寫資料

1. 如果主資料面是 `docs/tasks/tasks-*.json`，直接新增或更新對應分片條目。
2. 如果需要 Markdown 卡：
   - `docs/agent-briefs/tasks/*.md`：遵守 `doc_ai_0023` 的任務卡流程與鎖卡欄位
   - `docs/tasks/*_task.md`：作為人類可讀補充，但不得脫離 shard 真相
3. UI 任務若有 `docs/ui-quality-tasks/*.json` shard，也要同步更新。
4. UI shard 更新後，執行：

```bash
node tools_node/build-ui-task-manifest.js
```

### Step 4: 開工鎖卡

若這張卡要立刻被處理：

1. 設為 `in-progress`
2. 補 `started_at` / `started_by_agent`
3. notes 第一筆寫明誰開始做、改什麼、驗證是否 pending

### Step 5: 收工與交接

1. 若本輪只是開卡，不實作，也要留下目前狀態與下一步。
2. 若本輪同時實作，收工前補 `notes`、驗證結果與 blocker。
3. 若有 lock，照協作規則 unlock。

## 與其他 skill 的關係

### UI Vibe Pipeline

`ui-vibe-pipeline` 在產出 task card / task shard 時，應直接委派給本 skill，而不是再自建一套開卡規則。
實作層面可直接呼叫 `node tools_node/task-card-opener.js ...`。

### Doc Consolidation

若只是整併規格衝突，不直接開 task card，優先走 `doc-consolidation-flow`；只有需要把後續工作明確落成任務時，再切回本 skill。

## 驗證清單

每次開卡至少確認：

1. 主資料面選對了
2. 若有 Markdown 卡，已遵守 `doc_ai_0023`
3. 若有 task JSON，已依協作規則 lock / update / unlock
4. 若有 UI shard，已執行 `node tools_node/build-ui-task-manifest.js`
5. touched 文字檔已跑 encoding guard