<!-- doc_id: doc_index_0013 -->
# tasks/

`docs/ui-quality-todo.json` 的拆分分片，依 ID 前綴分組。

任務卡本體 ID / 卡號格式請依 [名詞定義文件](C:\Users\User\3KLife\docs\遊戲規格文件\系統規格書\名詞定義文件.md (doc_spec_0008)) (doc_spec_0008)；本文件只定義 shard 分組與 aggregate 重建流程，不另寫卡號規則。

| 分片 | ID 前綴 | 說明 |
|------|---------|------|
| tasks-ui.json | UI-* | UI 設計/品質任務（~100 件）|
| tasks-prog.json | PROG-* | 程式任務（~16 件）|
| tasks-dc.json | DC-* | Data Center Phase 任務（~35 件）|
| tasks-data.json | DATA-* | 資料契約任務（~1 件）|

所有新任務一律先走 `task-card-opener` skill，先判斷對應分片、是否需要 Markdown 任務卡，以及是否要同步 UI shard / 協作卡；任務卡 ID 命名仍以名詞定義文件為準，不得直接手工開平行格式。

新增任務請直接編輯對應分片，再跑 `node tools_node/build-ui-task-manifest.js` 重建 aggregate。