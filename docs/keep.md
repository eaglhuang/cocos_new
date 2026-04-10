# Keep Consensus

> **⚠️ 已拆分為 4 個分片，本檔為索引入口。**
> Token 節流目的：避免整份讀入超過 6000 tokens。請**按需**讀對應分片。

## 分片索引

| 分片 | 路徑 | 大小 |
|------|------|------|
| Core（P0 · §0–§2c） | `docs/keep-shards/keep-core.md` | 89 行 / ~4 KB |
| Workflow（§3–§6 · §13） | `docs/keep-shards/keep-workflow.md` | 149 行 / ~3 KB |
| UI Architecture（§7–§12 · §19–§23） | `docs/keep-shards/keep-ui-arch.md` | 607 行 / ~19 KB |
| Current Status（§14–§18 · §24 · MCP） | `docs/keep-shards/keep-status.md` | 178 行 / ~8 KB |

## 使用說明

- 先讀 `docs/keep.summary.md`（必讀，33 行）
- 依工作內容選對應分片讀取
- 搜尋特定內容：`grep_search` 搜尋 `docs/keep-shards/` 目錄
- 修改分片後重建索引：
  ```
  node tools_node/shard-manager.js rebuild-index docs/keep-shards
  ```