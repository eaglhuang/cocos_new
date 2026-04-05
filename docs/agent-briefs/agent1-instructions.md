---
id: agent1
role: "Runtime / UI Contract Agent"
owner: "Agent1"
manifest: "../ui-quality-todo.json"
tasks:
  - UI-2-0001
  - UI-2-0002
  - UI-2-0006
  - UI-2-0007
  - UI-2-0013
  - UI-2-0014
  - UI-2-0015
  - UI-2-0008
  - UI-2-0009
  - UI-2-0010
  - UI-2-0016
  - UI-2-0017
  - UI-2-0011
  - UI-2-0012
  - UI-2-0018
  - UI-2-0019
  - UI-2-0020
  - UI-2-0021
  - UI-2-0022
  - UI-2-0023
  - UI-2-0024
description: "負責 runtime、preview host、UI contract、layout/skin JSON、tooling 與重構。"
---

# Agent1 Instructions

## UI Mass-Production Gate

- Default workflow: `choose template family -> fill content contract -> apply skin fragment -> run smoke route -> backwrite formal docs`
- Before starting a new UI card, check [UI-task-card-template.md](C:\Users\User\3KLife\docs\agent-briefs\UI-task-card-template.md)
- Do not treat layout churn as the default path. If a card cannot name `template_family / content_contract / skin_fragments / smoke_route`, pause and fix the card first.

通用規則全部以 [../keep.md](../keep.md) 為準，本檔只保留 Agent1 專屬責任。

## 硬規則

- 正式工作原則上先有任務卡，再開始實作、重構、批次文件整理或正式 QA。
- 拿卡即鎖卡。開始做之前，先把任務卡與 manifest 標成 `in-progress`，補上 `started_at` / `started_by_agent`。
- bug 修復可視情況不先開卡，但仍要保留可追蹤性，commit 必須寫清楚 bug 內容、修法與 Agent 標籤。
- 若工作範圍擴大、出現新 blocker、或衍生新工作，先補開新卡或更新原卡 `related / depends / notes`。
- 正式 commit 必須能對回單一卡號、單一主題批次，或單一 bug 修復單位。
- `notes` 建議固定用：`日期 | 狀態 | 驗證 | 變更 | 阻塞`。
- 編碼快指令見 [Readme.md](./Readme.md)；原則就是改後跑 touched、收工前再跑、commit 前看 staged。
- bug commit 形式：

```text
[bug][系統代碼] Bug描述 : 修改描述 [AgentX]
```

## 1. 主要責任

- UI runtime
- preview host
- `screens / layouts / skins` 契約
- layout / skin JSON
- 驗收工具與自動化
- 高風險大檔重構

## 2. 開工前必讀

1. [../keep.md](../keep.md)
2. [../ui-quality-todo.md](../ui-quality-todo.md)
3. [../UI參考圖品質分析.md](../UI參考圖品質分析.md)

## 3. 你可以動的內容

- `assets/resources/ui-spec/`
- `assets/scripts/ui/`
- preview / capture tooling
- 任務卡、notes、追蹤文件

## 4. 你不該動的內容

- Agent2 正在處理的 QA artifact 主體
- `.meta`
- 非自己負責任務的 owner / status

## 5. 完成定義

以下條件同時成立才算完成：

- runtime 或 contract 行為正確
- 對應 task / notes / checklist / index 已同步
- 必要驗證已重跑
- blocker 已明確記錄
- 若是 bug 修復，commit message 已寫清楚問題與修法，且能對回系統代碼與 Agent。

## 6. 交接格式

- 說明改了什麼
- 說明驗證結果
- 說明是否解除 Agent2 blocker
