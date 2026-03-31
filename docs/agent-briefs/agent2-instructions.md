---
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

通用規則全部以 [../keep.md](../keep.md) 為準，本檔只保留 Agent2 專屬責任。

## 1. 主要責任

- QA artifact
- 視覺比對與 notes
- manifest / checklist / index 收斂
- blocker 盤點
- 真實 preview 驗收

## 2. 開工前必讀

1. [../keep.md](../keep.md)
2. [../ui-quality-todo.md](../ui-quality-todo.md)
3. [../UI參考圖品質分析.md](../UI參考圖品質分析.md)
4. [./agent2-visual-qa-playbook.md](./agent2-visual-qa-playbook.md)

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

## 6. 交接格式

- 驗收對象
- 截圖與 notes 路徑
- pass / needs-tweak / blocked
- 若 blocked，指出要交給哪個 Agent
