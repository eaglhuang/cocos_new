<!-- doc_id: doc_index_0014 -->
# UI Quality Task Shards

這裡是 `UI` 任務機器可讀資料的可編輯來源。

## 原則

- `docs/ui-quality-tasks/*.json` 是可編輯的小 shard。
- `docs/ui-quality-todo.json` 是由 shard 合併後生成的 aggregate manifest。
- `docs/agent-briefs/tasks_index.md (doc_task_0002)` (doc_task_0002) 是由 aggregate manifest 再生成的人類可讀索引。
- shard 內的任務 `id` / 卡號格式仍以 [名詞定義文件](C:\Users\User\3KLife\docs\遊戲規格文件\系統規格書\名詞定義文件.md (doc_spec_0008)) (doc_spec_0008) 為準；本文件只規範 UI shard 的結構與生成流程。

## 為什麼要拆

- 降低單一大 JSON 的 merge 衝突風險
- 避免多 Agent 同時編輯 `docs/ui-quality-todo.json`
- 讓新任務可以先以小檔增量加入，再由工具重建總表

## shard 格式

```json
{
  "kind": "ui-quality-task-shard",
  "version": 1,
  "tasks": [
    {
      "id": "UI-2-0092",
      "priority": "P1",
      "phase": "G",
      "owner": "Agent1",
      "status": "open",
      "type": "asset-generation"
    }
  ]
}
```

## 生成

```bash
node tools_node/build-ui-task-manifest.js
```

生成後會同步更新：

1. `docs/ui-quality-todo.json`
2. `docs/agent-briefs/tasks_index.md (doc_task_0002)` (doc_task_0002)

## 過渡期規則

- 舊資料目前仍保留在 `docs/ui-quality-todo.json`。
- 新任務優先寫入 shard，再用生成器併回 aggregate。
- 後續可再逐批把舊任務搬到 shard，不需要一次全部重做。
