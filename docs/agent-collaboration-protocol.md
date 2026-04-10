# 多 Agent 協作協議

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
  ├─ 讀 keep.summary.md
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
node tools_node/task-lock.js lock   <task-id> <agent-name>
node tools_node/task-lock.js unlock <task-id> <agent-name>
node tools_node/task-lock.js check  <task-id>
node tools_node/task-lock.js list
```

### 規則
- 鎖定先到先贏；同一 task 同時只允許一個 Agent 鎖定
- 鎖定者才能解鎖
- 修改 task JSON 前必須先 lock
- 鎖定檔存放 `.task-locks/`（gitignored）

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

## 5. Conflict Resolution

| 衝突類型 | 處理方式 |
|----------|----------|
| 同一檔案 | 先 lock 者優先；後到者等待或改 scope |
| Task 衝突 | 拆 subtask → 各自 lock |
| 規格矛盾 | 回寫 `docs/正式規格矛盾審查.md` → 人類仲裁 |

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
