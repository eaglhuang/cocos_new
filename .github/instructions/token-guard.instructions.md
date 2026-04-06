---
applyTo: "**"
---

# Token 節流規則

## 警戒線

- 單檔文字估算 >6000 tokens → 禁止整份讀入，先用搜尋或摘要
- 單輪估算 >18000 tokens → 必須提出警告
- 單輪估算 >30000 tokens → hard-stop，先縮成摘要卡再繼續

## 禁止行為

- ❌ 呼叫 `get_changed_files`（本專案含大量 PNG binary，必定觸發 413 當機）
- ❌ 整份讀入 `docs/keep.md`、`docs/ui-quality-todo.json`、大型 notes
- ❌ 一次帶入 >2 張圖片（限 1 主圖 + 1 對照圖）
- ❌ `grep_search` 用萬用路徑搜 `artifacts/` 目錄
- ❌ `file_search` 查 PNG artifact 不加 `maxResults: 10`

## 替代做法

- git 狀態 → `git status --short`
- 特定文字檔 diff → `git diff -- <file>`（限 .ts/.json/.md）
- keep.md → 先讀 `docs/keep.summary.md`，需修改共識時才讀全文
- ui-quality-todo → 讀對應 shard `docs/ui-quality-tasks/*.json`

## Handoff 摘要卡格式

只傳：任務目標、1~3 個必要檔案、3 點已知結論、3 點未決策、1 條驗證方式。
