# 交叉索引表 (Cross-Reference Index)

> **⚠️ 已拆分為 4 個分片，本檔為索引入口。**
> Token 節流目的：避免整份讀入超過 6000 tokens。請**按需**讀對應分片。

## 分片索引

| 分片 | 路徑 | 大小 |
|------|------|------|
| 規格書索引（Sec A） | `docs/cross-ref/cross-ref-specs.md` | 131 行 / ~9 KB |
| 代碼索引（Sec B） | `docs/cross-ref/cross-ref-code.md` | 349 行 / ~26 KB |
| UI 規格索引（Sec C） | `docs/cross-ref/cross-ref-ui-spec.md` | 59 行 / ~6 KB |
| 實作進度（Sec D） | `docs/cross-ref/cross-ref-進度.md` | 195 行 / ~14 KB |

## 使用說明

- 先讀 `docs/keep.summary.md`（必讀，33 行）
- 依工作內容選對應分片讀取
- 搜尋特定內容：`grep_search` 搜尋 `docs/cross-ref/` 目錄
- 修改分片後重建索引：
  ```
  node tools_node/shard-manager.js rebuild-index docs/cross-ref
  ```