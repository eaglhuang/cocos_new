---
doc_id: doc_agentskill_0024
name: ui-brief-generator
description: 'UI brief 生成 SKILL — 從 docs/keep.summary.md、正式規格書、task shard、cross-reference-index 與參考圖整理成可執行的 UI brief 或 task-ready brief。USE FOR: 新 UI 畫面開工前、既有畫面補 task shard 欄位、需要收斂 family / proof / normalized recipe / content_contract / smoke_route。DO NOT USE FOR: 直接修改 ui-spec JSON、直接做視覺 QA。'
argument-hint: '提供 screenId、taskId 或規格書路徑，並說明要輸出 design-brief、task shard 補欄，或兩者銜接。'
---

# UI Brief Generator

把分散在規格書、task shard、參考圖與現有 runtime 狀態的資訊，收斂成下一步可以直接執行的 UI brief。

Unity 對照：相當於先把需求、Prefab family、資料欄位與驗收路徑整理成一份技術美術可直接接手的 implementation brief，而不是邊做邊猜。

## 何時使用

- 新畫面還沒進入 `ui-reference-decompose` / `ui-family-architect` 前
- 舊畫面要補齊 `family / proof / normalized recipe / content_contract / smoke_route / docs_backwritten`
- 需要把多份正式規格收斂成單一任務入口

## 不要這樣用

- 不要把舊架構名詞帶回來，例如 `assets/resources/ui-layouts/` 或 `UIScaffold`
- 不要直接在這一步修改 `layout / skin / screen` JSON
- 不要把 AI 全畫面 mockup 當成正式參考圖真相來源

## 必讀來源

依序讀取：

1. `docs/keep.summary.md (doc_index_0012)` (doc_index_0012)
2. `docs/UI 規格書.md (doc_ui_0027)` (doc_ui_0027)
3. 目標系統的正式規格書，例如 `docs/武將人物介面規格書.md (doc_ui_0012)` (doc_ui_0012)
4. 對應 task shard `docs/ui-quality-tasks/<task-id>.json`（若已存在）
5. `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)
6. 參考圖、Figma proof mapping、既有 preview capture

## 輸出選擇

只選一種主要輸出，不要同時維護兩份真相：

- 早期探索或尚未開卡：輸出到 `artifacts/ui-source/<screen-id>/design-brief.md`
- 正式進卡與協作：回寫或建立 `docs/ui-quality-tasks/<task-id>.json`

## 必收斂欄位

不論輸出是哪一種，至少都要整理出：

- `screenId`
- `family`
- `proof`
- `normalized_recipe`
- `content_contract`
- `skin_fragments`
- `canonical references`
- `smoke_route`
- `docs_backwritten`
- `目前殘差 / blockers / 下一步`

## 產出規則

### 1. 先判定 family

優先使用既有 family：

- `detail-split`
- `dialog-card`
- `rail-list`
- `fullscreen-result`

若 70% 以上可由既有 family 承接，就不要把它寫成全新 family。

### 2. 收斂 content contract

把畫面差異收斂成欄位，而不是散落成敘述句。

優先對齊：

- `assets/resources/ui-spec/contracts/*.schema.json`
- `assets/resources/ui-spec/content/*.json`

### 3. 指定 smoke route

優先填可重現命令，例如：

```bash
node tools_node/capture-ui-screens.js --target GeneralDetailOverview --outDir artifacts/ui-source/general-detail-overview/review
```

### 4. 指定回寫文件

正式任務至少明確列出：

- `docs/keep.md (doc_index_0011)` (doc_index_0011) 是否需要更新
- `docs/UI 規格書.md (doc_ui_0027)` (doc_ui_0027)
- `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)

## 與其他 skills 的銜接

- 已有參考圖，要做結構化分解：`ui-reference-decompose`
- 已有 proof draft，要做 family / recipe 分派：`ui-family-architect`
- 已確認 family，要落 ui-spec / Panel：`ui-spec-scaffold`
- 已修改 runtime，要截圖驗證：`ui-runtime-verify`

## 完成標準

- brief 能讓下一位 Agent 不必重查 5 份文件才知道從哪裡開工
- 任務欄位完整，不再停留在「做得像參考圖一點」這種口語描述
- 內容只引用正式規格或已確認的 preview/capture 路徑
