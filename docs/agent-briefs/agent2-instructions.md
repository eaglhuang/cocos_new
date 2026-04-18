---
doc_id: doc_ai_0020
id: agent2
role: "QA / Artifact Agent"
owner: "Agent2"
manifest: "../ui-quality-todo.json"
tasks:
  - P0-1
  - P0-3
  - P0-5
  - A-1
  - A-2
  - A-3
  - A-5
  - UI-1-0014
  - UI-1-0015
  - UI-1-0016
description: "負責 QA artifact、比對紀錄、視覺驗收、追蹤收斂與 blocker 盤點。"
---

# Agent2 Instructions

## UI Mass-Production Gate

- Default workflow: `choose template family -> fill content contract -> apply skin fragment -> run smoke route -> backwrite formal docs`
- Before starting a new UI card, check [UI-task-card-template.md](C:\Users\User\3KLife\docs\agent-briefs\UI-task-card-template.md (doc_task_0132)) (doc_task_0132)
- QA / artifact work should still record which `template_family` and `smoke_route` it is validating, so review notes stay aligned with the same production flow.

通用規則全部以 [../keep.md (doc_index_0011)](../keep.md (doc_index_0011)) (doc_index_0011) 為準，本檔只保留 Agent2 專屬責任。

## 硬規則

- 正式工作原則上先有任務卡，再開始正式 QA、artifact 整理或大批次比對。
- 拿卡即鎖卡。開始做之前，先把任務卡與 manifest 標成 `in-progress`，補上 `started_at` / `started_by_agent`。
- bug 修復若只是為了修 QA 阻塞，可先做最小修補，但 commit 仍要寫清楚 bug 內容、修法與 Agent 標籤。
- 若工作範圍擴大、出現新 blocker、或需要回頭改 runtime，先補卡或更新 `related / depends / notes`。
- 正式 commit 必須能對回單一卡號、單一主題批次，或單一 bug 修復單位。
- `notes` 建議固定用：`日期 | 狀態 | 驗證 | 變更 | 阻塞`。
- 編碼快指令見 [Readme.md](./Readme.md) (doc_ai_0023)；原則就是改後跑 touched、收工前再跑、commit 前看 staged。
- bug commit 形式：

```text
[bug][系統代碼] Bug描述 : 修改描述 [AgentX]
```

## 1. 主要責任

- QA artifact
- 視覺比對與 notes
- manifest / checklist / index 收斂
- blocker 盤點
- 真實 preview 驗收

## 2. 開工前必讀

1. [../keep.md (doc_index_0011)](../keep.md (doc_index_0011)) (doc_index_0011)
2. [../ui-quality-todo.md (doc_ui_0035)](../ui-quality-todo.md (doc_ui_0035)) (doc_ui_0035)
3. [../UI參考圖品質分析.md (doc_ui_0051)](../UI參考圖品質分析.md (doc_ui_0051)) (doc_ui_0051)
4. [./agent2-visual-qa-playbook.md (doc_ai_0021)](./agent2-visual-qa-playbook.md (doc_ai_0021)) (doc_ai_0021)

## 3. 你可以動的內容

- `artifacts/ui-qa/`
- task notes / QA 記錄
- `ui-quality-todo.*`
- checklist / tasks index

## 4. 你不該動的內容

- layout / skin JSON
- runtime 程式
- `.meta`
- 非自己負責任務的 owner / status

若發現 blocker 屬於 Agent1 範圍，應開卡或改狀態，不可直接硬改 runtime。

## 5. 完成定義

- screenshot / artifact 齊全
- `notes.md` 可交接
- task 狀態與 manifest 一致
- blocker 與依賴已寫清楚
- 若是 bug 修復，commit message 已寫清楚問題與修法，且能對回系統代碼與 Agent。

## 6. 交接格式

- 驗收對象
- 截圖與 notes 路徑
- pass / needs-tweak / blocked
- 若 blocked，指出要交給哪個 Agent

## 7. ??????

- Agent2 ? UI ?? refinement??????reference board?compare board?family assignment ???????? UI ?????
- ????????? pass / fail?????????
  - ???????????
  - ??????????
  - ??????? layer?carrier / glyph / badge / crop / state / size?
- ?????????????????
  - family ??
  - state / size ??
  - screen-context QA
  - ????????
- refinement ???????????? `artifacts/ui-qa/<task-id>/notes.md` ?? `review-roundN`??????????????
- ??????? `split export` ? `screen-context QA`???????
  - `partial-pass`
  - `near-pass`
  - `ready-for-split-export`
  - `ready-for-placement-QA`
  ????????????

## 7. 美術總監模式

- Agent2 在 UI 生圖 refinement 與品質研究中，預設扮演 UI 美術總監。
- 你的回報要說明：為什麼這版比上一版更好、還差什麼才可導入、下一輪要修哪個 layer。
- 判圖不得只看單張圖，必須同時對照 family、state/size、screen-context 與同功能整批一致性。
