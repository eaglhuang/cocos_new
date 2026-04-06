# Keep Consensus — Core（P0 · §0–§2c）

> 這是 `keep.md` 的「Core（P0 · §0–§2c）」分片。完整索引見 `docs/keep.md`。

# Keep Consensus

## P0. Agent Context Budget（2026-04-06）

- 這件事列為目前第一最高優先級：任何會讓 Agent 對話上下文暴增的流程，都要先收斂再繼續。
- 真正高風險來源不是一般程式碼，而是整份 `keep.md` / `ui-quality-todo.json`、QA compare board、screenshot、AI 原圖、binary diff、以及同一輪重複貼入相同背景。
- 強制規則：Agent handoff 改用「摘要卡」，只傳任務目標、1~3 個必要檔案、3 點已知結論、3 點未決策項目、1 條驗證方式；禁止把整份 manifest、長篇 notes、成批圖片直接塞進對話。
- 圖片節流：單次對話最多 2 張圖；只允許 1 張主圖 + 1 張對照圖，其餘只保留路徑、尺寸、用途與 QA 結論。
- 文件節流：`keep.md` 只留最高層共識與 P0 警戒；長分析搬去 `docs/agent-context-budget.md`，在 keep 只留索引。
- 警戒線：單檔文字估算超過 `6000 tokens` 禁止整份讀入；單輪估算超過 `18000 tokens` 必須提出警告；超過 `30000 tokens` 視為 `hard-stop`，必須先縮成摘要卡。
- 工具：handoff 前先跑 `node tools_node/check-context-budget.js --changed --emit-keep-note`；若出現 `warn` 或 `hard-stop`，要先警告，再把原因寫回 keep。
- 爆量事件紀錄格式：日期、估算 token 量級、疑似原因、已採取的縮減策略、是否列為 P0。不要把整份分析全文再寫回 keep，避免二次膨脹。
- 詳細規範文件：`docs/agent-context-budget.md`
- 2026-04-06 現況掃描：`node tools_node/check-context-budget.js --scan-default --emit-keep-note` 估算約 `791656 tokens`，`--changed` 估算約 `429502 tokens`，兩者皆為 `hard-stop`。疑似主因：compare board / screenshot / QA 圖片被納入、`keep.md` / `ui-quality-todo.json` / 大型 docs 被整份讀入、changed files 含大量 binary 與大型資料檔。這件事維持 P0，直到 handoff 全面改成摘要卡與路徑索引為止。

## 0. UI 任務 Shard 入口（2026-04-05）

- `docs/ui-quality-tasks/*.json` 是 UI 任務機器可讀資料的可編輯 shard 來源。
- `docs/ui-quality-todo.json` 改為 aggregate manifest，由 `node tools_node/build-ui-task-manifest.js` 生成。
- `docs/agent-briefs/tasks_index.md` 也由同一支生成器重建，不再建議手工維護。
- 新任務的建議順序：
  1. 建立任務卡 Markdown
  2. 新增或更新對應 shard
  3. 執行 `node tools_node/build-ui-task-manifest.js`
  4. 執行 encoding touched check
- 過渡期允許舊任務仍保留在 `docs/ui-quality-todo.json`；新任務優先走 shard，不要求一次搬完整份歷史資料。

更新日期: `2026-04-06`

本文件是目前專案的最高共識摘要。每次新會話開始時，先讀本檔，再開始任何分析、改碼、測試或文件工作。

---

## 1. 專案基準

- 專案: `3KLife`
- 引擎: `Cocos Creator 3.8.8`
- 工作流: `IDE-first`
- 語言: `TypeScript (ES2015)`
- 主要平台: `Web / Android / iOS`
- 階段: `資料管理中心 (DC Phase) 基礎建設完成 / UI 量產期`

Unity 對照:
- `Cocos Creator Editor` 對應 Unity Editor
- `assets/resources` 對應 Resources / Addressables 可載入資料根

---

## 2. Pre-flight

1. 每次處理任何請求前，先讀 `docs/keep.md`。
2. 回覆與推理一律使用繁體中文與台灣慣用術語。
3. 若有新技術決策，必須補回 `docs/keep.md`。
4. 新會話開始時，先摘要 keep 目前重點。
5. 規格異動優先回寫正式母規格，不把補遺當成長期單一真相來源。
6. 補遺只允許作為短期工作底稿、compare note 或跨功能整理；若不是全新功能規格，結案前必須併回正式規格書。
7. 只要正式規格書有新增、刪改或重定位，必須同步更新 `docs/cross-reference-index.md`。
8. 若內容同時影響系統規格與 UI 呈現，至少要同步更新主要系統規格書、`docs/UI 規格書.md` 與交叉索引。

---

## 2b. Agent 工具安全規則（2026-04-06）

### ❌ 禁止呼叫 `get_changed_files`

本專案包含大量 PNG / binary QA artifact，`get_changed_files` 會把所有 unstaged/staged diff（含 PNG binary 內容）一次塞入 context，必定觸發 **413 Request Entity Too Large** 並導致 Agent 凍結當機。

**絕對不要呼叫 `get_changed_files`，無論任何情況。**

替代方式：
- 查目前 git 狀態：用 `run_in_terminal` 跑 `git status --short`（只回傳路徑，不含 diff）
- 查特定文字檔的 diff：用 `run_in_terminal` 跑 `git diff -- <filepath>`（限定 `.ts` / `.json` / `.md`，不要用萬用路徑）
- 查最新 commit 資訊：用 `run_in_terminal` 跑 `git log -1 --stat`

### ⚠️ 其他工具使用注意

- `grep_search` 不要用萬用路徑 `**` 搜尋 `artifacts/` 目錄（大量 PNG 會拖慢搜尋，且結果無用）
- `file_search` 查 png artifact 路徑時加 `maxResults: 10`，不要讓結果暴增

---
