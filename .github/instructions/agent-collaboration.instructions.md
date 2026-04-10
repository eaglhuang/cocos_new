---
applyTo: "**"
---

# Agent Collaboration Protocol

## 三道防線

### 防線 1: Pre-flight Gate（開工前）

1. 讀 `docs/keep.summary.md`
2. 執行 `node tools_node/check-context-budget.js --changed`（若可用）
3. 若要修改 task JSON → 先執行 `node tools_node/task-lock.js lock <task-id> <agent-name>`
4. 確認要修改的檔案列表，記錄在 session memory

### 防線 2: In-flight Guard（工作中）

- 修改 fragment → 先跑 `node tools_node/build-fragment-usage-map.js --query <ref>` 確認影響範圍
- 修改 layout → 先跑對應的 regression check（若存在）
- 修改 skin → 先跑 `node tools_node/validate-ui-specs.js --strict`
- 修改 task JSON → 必須已 lock 才准改
- token 超 18k → 強制 summarize；超 30k → hard-stop

### 防線 3: Post-flight Checkpoint（收工前）

1. `node tools_node/check-encoding-touched.js <changed-files...>`
2. `node tools_node/validate-ui-specs.js --strict --check-content-contract`
3. 若改了 layout/fragment → 執行對應 regression check
4. `node tools_node/task-lock.js unlock <task-id> <agent-name>`（若有鎖定）
5. `node tools_node/report-turn-usage.js --changed --emit-final-line`（若可用）

## Task Locking 規則

- **鎖定先到先贏**：同一 task 同時只允許一個 Agent 鎖定
- **鎖定者才能解鎖**：unlock 必須由 lock 時同一 agent-name 執行
- **查詢不需鎖定**：`task-lock.js check` 和 `task-lock.js list` 可隨時執行
- **忘記解鎖**：`finalize-agent-turn.js` 會自動嘗試 unlock

## Handoff 規則

- 結束回合時，handoff 摘要必須包含：
  - 修改了哪些檔案
  - 做了什麼決策
  - 是否有 blocker
  - 下一步建議
- 下一個 Agent 入場時：
  - 先 `task-lock.js check <task-id>` 確認無衝突
  - 讀上一份 handoff 摘要
  - 驗證前一位 Agent 宣稱的修改與實際 diff 一致

## Conflict Resolution

- 同一檔案衝突：先 lock 者優先；後到者等待或改 scope
- Task 衝突：拆 subtask → 各自 lock 子 task
- 規格矛盾：回寫 `docs/正式規格矛盾審查.md` → 人類仲裁
