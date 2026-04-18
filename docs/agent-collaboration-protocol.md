<!-- doc_id: doc_ai_0024 -->
﻿# 多 Agent 協作協議

> 更新日期: 2026-04-10
> 適用範圍: 所有在本專案工作的 AI Agent

## 1. 目的

確保多個 Agent 同時或接力工作時，不會：
- 同時修改同一檔案導致衝突
- 遺漏上一位 Agent 的修改或決策
- 產出不符合專案共識的結果
- 無節制地消耗 context token

## 2. 三道防線架構

```
防線 1: Pre-flight Gate（開工前）
  ├─ 讀 keep.summary.md (doc_index_0012)
  ├─ check-context-budget.js --changed
  ├─ task-lock.js lock <task-id> <agent-name>
  └─ 確認 skill 順序

防線 2: In-flight Guard（工作中）
  ├─ 修改 fragment → build-fragment-usage-map.js --query
  ├─ 修改 layout → regression check
  ├─ 修改 skin → validate-ui-specs.js --strict
  ├─ 修改 task JSON → 必須已 lock
  └─ token 超 18k → summarize / 超 30k → hard-stop

防線 3: Post-flight Checkpoint（收工前）
  ├─ check-encoding-touched.js
  ├─ validate-ui-specs.js --strict --check-content-contract
  ├─ regression check（if layout/fragment changed）
  ├─ task-lock.js unlock
  └─ report-turn-usage.js --changed
```

## 3. Task Locking Protocol

### 工具
```bash
node tools_node/task-lock.js lock   <task-id> <agent-name> --files <file...>
node tools_node/task-lock.js unlock <task-id> <agent-name>
node tools_node/task-lock.js check  <task-id>
node tools_node/task-lock.js list
```

### 規則
- 鎖定先到先贏；同一 task 同時只允許一個 Agent 鎖定
- 鎖定者才能解鎖
- 修改 task JSON 前必須先 lock
- 鎖定檔存放 `.task-locks/`（gitignored）
- `lock --files <file...>` 應記錄本輪預計修改檔案，供 `finalize-agent-turn --task-scope` 與 handoff 對齊
- `task-lock.js` 會自動建立 `.task-locks/`，並在缺少時補 `.gitignore` 的 `.task-locks/` 排除項

### 建議最小工作流

```bash
# 開工前：先鎖任務與檔案範圍
node tools_node/task-lock.js lock <task-id> <agent-id> --files <file...>

# 收工前：用 task 檔案集跑 finalize，而不是整個 dirty worktree
node tools_node/finalize-agent-turn.js --workflow ucuf --task <task-id> --task-scope --json

# 收工後：解鎖
node tools_node/task-lock.js unlock <task-id> <agent-id>
```

用途：
- 降低多 Agent 同時修改高風險檔案的碰撞機率
- 讓 context budget / turn usage 依 task 檔案集計算，而不是被整個工作樹污染
- 讓 handoff 的 changedFiles 與 task scope 一致

## 4. Handoff Contract

Agent 結束回合時，handoff 摘要必須涵蓋：

| 欄位 | 說明 |
|------|------|
| `agentId` | 本回合 Agent 識別 |
| `taskId` | 操作的 task ID |
| `phase` | pre-flight / in-flight / post-flight |
| `changedFiles` | 修改了哪些檔案（相對路徑列表）|
| `decisions` | 做了什麼技術決策 |
| `blockers` | 遇到什麼阻礙（空陣列 = 無阻礙）|
| `nextAction` | 建議下一步 |

下一個 Agent 接手時：
1. `task-lock.js check` 確認無衝突
2. 讀上一份 handoff 摘要
3. 驗證 changedFiles 與 `git status --short` 一致

### 當前決策（2026-04-13）

- **暫不**由 `finalize-agent-turn.js` 強制驗證 handoff 檔格式。
- 正式 handoff 落點統一為 `docs/agent-briefs/tasks/*.md` 既有任務卡或對應 brief。
- Agent 收工時仍必須在回覆中提供：`changedFiles / decisions / blockers / nextAction` 四要素；若 task card 已存在，優先直接回寫該卡的 notes / status。
- 等 task card 模板與 workflow 完全穩定後，再評估是否補 `--check-handoff` 自動驗證，而不是現在先把臨時格式鎖死。

### Mini-handoff 產生策略

- **暫不**自動產生新的 mini-handoff 檔。
- 原因：本 repo 已有 `docs/agent-briefs/tasks/*.md` 與任務卡體系，若再由工具自動吐另一份摘要，容易造成雙重真相來源。
- 現階段規則：
  - 有既有 task card：直接回寫該卡
  - 沒既有 task card：在工作回覆中給出結構化 handoff，必要時再人工建立正式 brief

## 5. Conflict Resolution

| 衝突類型 | 處理方式 |
|----------|----------|
| 同一檔案 | 先 lock 者優先；後到者等待或改 scope |
| Task 衝突 | 拆 subtask → 各自 lock |
| 規格矛盾 | 回寫 `docs/遊戲規格文件/正式規格矛盾審查.md (doc_spec_0001)` (doc_spec_0001) → 人類仲裁 |

## 6. 互監督機制

每個 Agent 可以且應該：
- 檢查前一位 Agent 的 changedFiles 是否與 git diff 一致
- 執行 `validate-ui-specs.js --strict` 確認前一位沒引入新 error
- 若發現前一位 Agent 留下的問題，記錄到 handoff 中，不直接覆蓋

## 7. 工具一覽

| 工具 | 用途 | 時機 |
|------|------|------|
| `task-lock.js` | 任務鎖定 | Pre-flight / Post-flight |
| `check-context-budget.js` | Token 預算檢查 | Pre-flight |
| `build-fragment-usage-map.js` | Fragment 影響範圍 | In-flight（改 fragment 前）|
| `validate-widget-registry.js` | Widget 登記驗證 | Post-flight（改 widget 後）|
| `validate-ui-specs.js` | 規格驗證 | Post-flight |
| `check-encoding-touched.js` | 編碼完整性 | Post-flight |
| `report-turn-usage.js` | Token 用量報告 | Post-flight |

## 8. Git Hook 啟用

本專案的 pre-commit hook 由 `.githooks/pre-commit` 提供，預設內容至少包含：
- staged encoding integrity 檢查
- staged `assets/resources/ui-spec/*.json` 變更時自動跑 `validate-ui-specs.js`

啟用方式：

```bash
npm run install:hooks
git config --get core.hooksPath
```

預期結果：
- `npm run install:hooks` 會把 git `core.hooksPath` 設成 `.githooks`
- `git config --get core.hooksPath` 應回傳 `.githooks`

若這一步沒做，`.githooks/pre-commit` 即使存在，也不會真的被 Git 執行。
