# Agent 協作流程與檔案約定

目的
- 提供一份清晰、可複製的多 Agent 協作流程與檔案約定，放置於 `docs/agent-briefs/`，方便未來新增 Agent（Agent3/Agent4）時快速上手並避免衝突。

核心原則
- 人機雙向可讀：每個人可讀的 `*.md` brief（含 YAML frontmatter），搭配一個機器友善的 manifest（`docs/ui-quality-todo.json` 或 `.yml`）作為 single source of truth。
- 明確責任邊界：每個 Agent 的 `owner`、`tasks` 與 `description` 必須在 frontmatter 中聲明。
- 小步提交、不可直接改動 runtime metadata：Agent 不得直接改 `.meta`、UUID、或進行 git 操作（由人工建立 PR）。
- 可重覆檢查：所有搬遷／輸出必需提供 SHA256 與檔案大小做驗證。

必備檔案與命名規則
- `docs/agent-briefs/agent1-instructions.md`、`agent2-instructions.md`……（每個 Agent 一個檔案）。
- 機器友善任務檔：`docs/ui-quality-todo.json`（或 `*.yml`），包含所有 task 物件與狀態。
- artifact 來源資料夾慣例：`artifacts/...`；runtime 目標：`assets/resources/sprites/...`。

YAML Frontmatter 範本（每個 `agentX-instructions.md` 頂部）
```
---
id: agentX
role: "簡短角色描述"
owner: "AgentX"
manifest: "../ui-quality-todo.json"
tasks:
  - P0-1
  - A-2
description: "一句話說明此 Agent 的負責範圍與限制"
---
```

機器友善 Manifest（JSON 範例 schema）
```
{
  "tasks": [
    {
      "id": "P0-1",
      "owner": "Agent2",
      "type": "sprite-move",
      "source": "artifacts/ui-layered-frames/family-previews/nav_ink/",
      "target": "assets/resources/sprites/ui_families/common/nav_ink/",
      "files": ["btn_primary_normal.png","btn_primary_pressed.png","btn_primary_disabled.png"],
      "acceptance": ["sha256_match","size>0"],
      "depends": [],
      "status": "not-started",
      "notes": ""
    }
  ]
}
```

上線前啟動檢查清單（每個 Agent）
1. 讀：`docs/keep.md`、`docs/UI參考圖品質分析.md`、`docs/ui-quality-todo.md`。
2. 確認 manifest 中有該 Agent 的 task 並檢查 `depends` 與 `status`。
3. 確認來源 artifact 存在（`artifacts/...`），若缺檔立即回報並標註 manifest 為 `blocked`。

標準工作流程（範例：新增按鈕 family）
1. Asset Producer（或 AgentX）產生預覽到 `artifacts/`，並在 manifest 新增 task（status=`in-progress`）。
2. Agent2（視覺資產）搬遷檔案到 runtime path（不做 git），計算並記錄每檔 SHA256、size，更新 manifest notes，status=`done`。
3. Agent1（接線/架構）在收到 Agent2 完成通知後，更新 skin/layout JSON 的引用（在本地修改），驗證 JSON schema 與 9-slice，將變更摘要放入 notes，status=`done`。
4. QA/Human：檢視 manifest 與 notes，執行視覺驗收（截圖、對照表），若 OK 則由人類建立 PR 並合併。

新增 Agent 的流程
1. 在 `docs/agent-briefs/` 新增 `agentN-instructions.md`，遵循 frontmatter 範本。
2. 在 `docs/ui-quality-todo.json` 新增對應 task 並把 `owner` 指向 `AgentN`。
3. 更新 `cross-reference-index.md` 或 `docs/keep.md`（如需要）以記錄新 Agent。

錯誤處理與升級路徑
- 若任務被阻塞：在 manifest 把 `status` 設為 `blocked`，在 `notes` 記錄原因與建議處置（例如：缺檔、檔名 mismatch、雜湊不同），並把 owner 設為 `human` 或標註聯絡人。
- 禁止自動建立或修改 `.meta`、UUID；如需產生合法 `.meta`，先在 manifest 中標註並等待人工核准。

任務擴增與自動開新卡規則

- 觸發條件：Agent 在執行任務時若發現下列任一情況，可開立新任務卡：
  - 發現超出原任務範圍的必要工作（例如需額外搬遷/轉檔/產生資源）
  - 無法在原預估時間內完成且將阻塞後續任務
  - 發現新的依賴或阻塞（例如缺少工具、檔名不符、雜湊不一致）
  - 需要人類判斷或介入的例外情況（例如產生合法 `.meta`、設計風格判斷）

- 開新卡流程：
  1. 建立任務卡草案：在 `docs/agent-briefs/tasks/` 新增 Markdown 卡片，遵循任務卡 frontmatter schema（包含 `id`、`priority`、`created`、`created_by_agent`、`owner`、`status`、`related_cards`、`notes` 等欄位）。
  2. 產生唯一 ID：依據 `docs/系統規格書/名詞定義文件.md` 的系統代號與子系統編號產生（例如 `UI-1-0005`）。
  3. 指派 owner：依工作類型套用預設映射表；若無明確對應，設為 `owner: human` 並在 `notes` 建議合適 owner。
     - 視覺 / 素材搬遷 → `Agent2`
     - Skin/Layout JSON / 接線 → `Agent1`
     - 工具 / 腳本 / 自動化 → `SYS` 或 `human`
     - 視覺 QA / 設計判斷 → `human`（或 `Designer`）
  4. 定義優先級：若新任務會阻塞現行任務或 release，標為 `P0`；若影響使用者流程但非 release-blocking，標 `P1`；視覺或次要優化標 `P2/P3`。在卡內 `開單原因` 明確說明選擇依據。
  5. 更新 manifest：在 `docs/ui-quality-todo.json` 新增對應 item（`status: not-started`），並在原任務的 `related` 或 `notes` 中加入新卡 ID；如為原任務之依賴，請把 `depends` 加上原任務 ID。
  6. 更新索引：將新卡加入 `docs/agent-briefs/CheckList.md` 與 `tasks_index.md`。
  7. 啟動回報：建立完卡片後，原 Agent 必須立刻在 checkpoint 中回報（更新 manifest 的 `notes` 與 `status`）；若卡標 `owner: human`，則標註聯絡人並等待人工分派。

- 欄位要求（每個新卡至少包含）：
  - `priority`、`id`、`created`（RFC3339 時間）、`created_by_agent`、`owner`、`status`、`開單原因`、`完整描述`、`來源依據文件索引`、`如何驗證`、`Unit Test 建議`（或明確標記“不需要”）、`related_cards`、`estimated_effort`（可選，hours）。

- 自動化限制與保護措施：
  - Agent 不可把新卡設定為要求修改受保護 metadata（如 `.meta`、UUID）之 owner；若新卡需要人為介入（例如產生合法 `.meta` 或建立 PR），Agent 應把 `status` 設為 `blocked` 並在 `notes` 標註所需人工步驟。
  - 若 Agent 無法確定適合 owner，預設先標 `owner: human` 並在 `notes` 建議 owner 候選與理由。

- 範例 frontmatter（新卡）
```
---
id: UI-1-0005
priority: P0
created: 2026-03-31T12:34:00Z
created_by_agent: Agent2
owner: Agent2
status: not-started
related_cards:
  - UI-2-0003
notes: "發現某些來源檔名與預期不符，需重命名或 mapping。建議 owner: Agent2 或 human 視 mapping 需求而定。"
---
```

- 稽核與追蹤：
  - 所有 Agent 開立的新卡皆需有 `created_by_agent` 與 timestamp；人類 reviewer 在合併或關閉卡片時需保留此稽核紀錄。

接受準則（Acceptance）
- 所有搬遷檔案必須：檔名精確、檔案大小 > 0、來源與目標 SHA256 一致。
- Agent 的 notes 必包含：每個檔案 `<path> | <SHA256> | <size bytes>` 與簡短 summary。

實作與自動化小提示
- 建議在 `tools/` 放置小腳本（PowerShell / Node）做檢查與 hash 計算，腳本輸出可直接貼回 manifest 的 `notes` 欄。
- 任何自動化腳本只寫入 `artifacts/` 或本地工作區，**不**做 git 提交。

維護與變更紀錄
- 若流程或 schema 有變更，請同時更新本檔與 `docs/keep.md`，並在檔案底部加入變更紀錄（日期 + 變更摘要 + 作者）。

---
最後：此 Readme 為團隊協作的操作手冊，請在每次流程調整時同步維護，確保 Agent 與人工的責任邊界清晰並可自動化驗證。
