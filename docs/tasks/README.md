# tasks/

`docs/ui-quality-todo.json` 的拆分分片，依 ID 前綴分組。

| 分片 | ID 前綴 | 說明 |
|------|---------|------|
| tasks-ui.json | UI-* | UI 設計/品質任務（~100 件）|
| tasks-prog.json | PROG-* | 程式任務（~16 件）|
| tasks-dc.json | DC-* | Data Center Phase 任務（~35 件）|
| tasks-data.json | DATA-* | 資料契約任務（~1 件）|

新增任務請直接編輯對應分片，再跑 `node tools_node/build-ui-task-manifest.js` 重建 aggregate。