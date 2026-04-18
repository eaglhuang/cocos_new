<!-- doc_id: doc_ai_0023 -->
# Agent 協作手冊

## UI 任務 Shard 新規則

- `docs/ui-quality-tasks/*.json` 是可編輯 shard 來源。
- `docs/ui-quality-todo.json` 與 [tasks_index.md](C:\Users\User\3KLife\docs\agent-briefs\tasks_index.md (doc_task_0002)) (doc_task_0002) 由 `node tools_node/build-ui-task-manifest.js` 生成。
- 開新 UI 任務時，除了任務卡 Markdown，也要同步補 shard，再重建 aggregate manifest 與索引。
- 過渡期舊任務仍可能只存在於 `docs/ui-quality-todo.json`；新任務優先走 shard。

目的
- 定義 Agent 任務卡、分工、交接與 commit 的最小必守規則。
- 共通硬規則以 [keep.md](C:\Users\User\3KLife\docs\keep.md (doc_index_0011)) (doc_index_0011) 為準，本檔只保留 `agent-briefs/` 專屬流程。
- 任務卡 ID / 卡號 / 系統代碼命名，一律以 [名詞定義文件](C:\Users\User\3KLife\docs\遊戲規格文件\系統規格書\名詞定義文件.md (doc_spec_0008)) (doc_spec_0008) 為唯一來源。

## 硬規則

- 正式工作原則上先有任務卡，再開始實作、重構、批次文件整理或正式 QA。
- 所有新的 Markdown 任務卡，一律先走 `task-card-opener` skill，再落實到實際檔案；不得再手工發展平行開單格式，也不得偏離名詞定義文件的 ID / 卡號格式。
- 拿卡即鎖卡。開始做之前，先把任務卡與 manifest 標成 `in-progress`，補上 `started_at` / `started_by_agent`，再進入實作。
- bug 修復可視情況不先開卡，但仍要保留可追蹤性，commit 必須寫清楚 bug 內容、修法與 Agent 標籤。
- 例外只限很小的錯字、一次性查詢、或使用者明確要求的超小修改。
- 任務範圍若擴大、出現新 blocker、或衍生新工作，必須先補開新卡或更新原卡 `related / depends / notes`，不可默默混在同一張卡內。
- 正式 commit 必須能對回「單一卡號」或「單一主題批次」，避免救援時無法快速定位。
- bug commit 可以不綁任務卡，但仍必須是單一 bug 單位，不能把多個 bug 混成一包。
- `notes` 建議固定用：`日期 | 狀態 | 驗證 | 變更 | 阻塞`。
- commit message 格式固定為：

```text
[bug|feat|chore] 任務卡號 功能描述 [AgentX]
```

- bug commit 的實際格式：

```text
[bug][系統代碼] Bug描述 : 修改描述 [AgentX]
```

- 編碼快指令：改完高風險文字檔先跑 `npm run check:encoding:touched -- --files <file...>`；收工前再跑一次；要看 staged 就用 `npm run check:encoding:staged`。

- 若某批變更沒有任務卡，原則上不應形成正式功能 commit。

## 目錄與檔案

- `agent1-instructions.md` (doc_ai_0019)、`agent2-instructions.md` (doc_ai_0020)
  - 各 Agent 的角色、責任與目前任務摘要。
- `tasks/`
  - 每張任務卡一個 Markdown 檔。
- [tasks_index.md](C:\Users\User\3KLife\docs\agent-briefs\tasks_index.md (doc_task_0002)) (doc_task_0002)
  - 任務索引。
- [CheckList.md](C:\Users\User\3KLife\docs\agent-briefs\CheckList.md (doc_ai_0022)) (doc_ai_0022)
  - 任務總表與依賴摘要。
- [ui-quality-todo.json](C:\Users\User\3KLife\docs\ui-quality-todo.json)
  - UI 任務狀態 single source of truth。

## 起手式

1. 先讀 [keep.md](C:\Users\User\3KLife\docs\keep.md (doc_index_0011)) (doc_index_0011)。
2. 讀自己的 `agentX-instructions.md`。
3. 查 [ui-quality-todo.json](C:\Users\User\3KLife\docs\ui-quality-todo.json) 與 [CheckList.md](C:\Users\User\3KLife\docs\agent-briefs\CheckList.md (doc_ai_0022)) (doc_ai_0022)，確認目前卡片狀態、依賴與 owner。
4. 若要做的是新範圍，先開卡再開始。
5. 若決定開始做，先鎖卡：`status=in-progress`、補 `started_at` / `started_by_agent`、更新 `notes`。
6. 若只是 bug 修復，可先做最小修補，但 commit 仍要遵守 bug 格式並記錄方法。

## 開新任務卡流程

1. 先走 `task-card-opener` skill，決定主資料面與是否需要 Markdown 卡，並以名詞定義文件決定任務卡 ID / 子系統編號。
2. 若流程判定要建立 Markdown 卡，再在 `docs/agent-briefs/tasks/` 新增任務卡。
3. 指派唯一 ID、owner、priority、status、related、depends。
4. 在卡片寫清楚：開單原因、完整描述、驗證方式、是否需要測試。
5. 同步更新對應 shard / manifest；若屬於 UI task shard，更新後執行 `node tools_node/build-ui-task-manifest.js`。
6. 同步更新 [tasks_index.md](C:\Users\User\3KLife\docs\agent-briefs\tasks_index.md (doc_task_0002)) (doc_task_0002) 與 [CheckList.md](C:\Users\User\3KLife\docs\agent-briefs\CheckList.md (doc_ai_0022)) (doc_ai_0022)。
7. 一旦開始做，立刻鎖卡：任務卡與 manifest 都更新為 `in-progress`，並記錄 `started_at` / `started_by_agent`。
8. 後續正式 commit 應引用這張卡，或明確標示單一主題批次。
9. bug 修復若沒有新卡，也必須在 commit message 寫清楚系統代碼、問題、修法與 Agent 標籤。

## 鎖卡流程

1. 確認這張卡目前沒有被其他 Agent 鎖定。
2. 任務卡 frontmatter 更新：
   - `status: in-progress`
   - `started_at: <RFC3339>`
   - `started_by_agent: AgentX`
3. manifest 對應 task 同步更新相同欄位。
4. `notes` 立即寫第一筆：
   - `YYYY-MM-DD | 狀態: in-progress | 驗證: pending | 變更: AgentX 開始處理 <summary> | 阻塞: none`
5. 若中途停下：
   - 繼續做：維持鎖定
   - 被 blocker 卡住：保留 `in-progress` 或改 `blocked`，但必須在 `notes` 寫清楚
   - 要交接：在 `notes` 寫交接對象與原因，再由下一位 Agent 接手更新

## 分工原則

- Agent1
  - runtime、preview host、UI contract、tooling、重構。
- Agent2
  - QA、artifact、比對 notes、阻塞盤點、追蹤收斂。
- 若工作跨越責任邊界，先補卡或更新依賴，再交接。

## Commit 主題分批建議

- `infra / repo hygiene`
  - 編碼、ignore、hook、非功能性倉儲整理。
- `tooling`
  - `tools/`、`tools_node/`、capture、generator。
- `runtime / contract`
  - `assets/scripts/ui/`、`assets/resources/ui-spec/`。
- `docs / tracking`
  - 任務卡、manifest、playbook、keep。
- `qa artifact`
  - `artifacts/ui-qa/` 的正式驗收證據。
- `bug / hotfix`
  - 單一 bug 修補，不混多個問題，message 需寫明系統代碼、問題與修法。

Unity 對照：這很像把變更分成 editor tooling、runtime prefab/腳本、設計文件與 QA 證據四種提交，不把所有東西塞進同一個 commit。
