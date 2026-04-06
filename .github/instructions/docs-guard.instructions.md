---
applyTo: "docs/**"
---

# Docs 目錄讀取規則

## 預設路徑：先讀摘要

- `docs/keep.md` → **先讀 `docs/keep.summary.md`**，只有需要修改共識時才讀全文
- `docs/ui-quality-todo.json` → **先讀對應 shard** `docs/ui-quality-tasks/*.json`，不整份讀入 aggregate manifest

## 大檔防護

- 任何 docs/ 下的檔案估算 >6000 tokens 時，先用 `grep_search` 定位需要的段落，不要整份讀入
- `docs/cross-reference-index.md` 只在需要更新交叉索引時才讀取

## 規格異動規則

- 規格異動優先回寫正式母規格，補遺只作為短期工作底稿
- 正式規格書有新增、刪改或重定位時，必須同步更新 `docs/cross-reference-index.md`
