---
doc_id: doc_agentskill_0031

name: ui-vibe-pipeline
description: 'UI 自動化生產總控 SKILL — 從 UI 示意圖、參考圖、Figma snapshot 或既有頁面經驗啟動，串接 proof draft、family-map、MCQ、normalized recipe、task shard、ui-spec 與 CompositePanel / ChildPanel scaffold、靜態驗證、Browser QA 自動調整，直到交付人類驗收。USE FOR: 想把一張新 UI 從「給圖」一路推進到可驗證的 screen package 與 QA 閉環。DO NOT USE FOR: 單純修一個 runtime bug、單一 prefab 微調、純美術資產委託。'
argument-hint: '提供 proofSource、screenId 或 proof.json 路徑，說明目標風格、參考頁面、是否要自動產 family-map / MCQ / normalized recipe / task shard / scaffold / Browser QA。'
---

<!-- 此檔案為 .agents/skills/ui-vibe-pipeline/SKILL.md (doc_agentskill_0008) 的鏡像副本，供 GitHub Copilot 技能載入使用 -->
<!-- 主版本位於 c:\Users\User\3KLife\.agents\skills\ui-vibe-pipeline\SKILL.md -->

<!-- 載入主版本的指引：
     當此 skill 被觸發時，請讀取
     .agents/skills/ui-vibe-pipeline/SKILL.md (doc_agentskill_0008)
     以取得完整的 UI 生產 SOP。-->

# UI Vibe Pipeline（鏡像索引）

此技能適用於下列情境：
- 給一張 UI 示意圖，想直接啟動整條 UI 自動化生產流程
- 想串接 `ui-reference-decompose -> UCUF 藍圖收斂 -> task-card-opener -> task card / 文件 -> scaffold -> 驗證 -> Browser QA -> 人類驗收`
- 想讓 skill 本身當總控入口，而不是只做單一 JSON / skin / preview 子步驟
- 任務卡 ID / 卡號 / 系統代碼命名以 `docs/遊戲規格文件/系統規格書/名詞定義文件.md (doc_spec_0008)` 為準

## 快速規格提醒

| 項目 | 值 |
|---|---|
| 設計基準解析度 | 1920 × 1080（橫向） |
| canvas 格式 | `"canvas": {"fitWidth": true, "fitHeight": true, "safeArea": true, "designWidth": 1920, "designHeight": 1080}` |
| 最小觸控熱區 | 44 × 44 px |
| 視覺主題 | 水墨 + 鋼鐵：深底 `#0F0F0F`，金色 `#D4AF37` / `#FFE088` |
| screen host | `CompositePanel`（頁級宿主） |
| slot content | `ChildPanelBase` 子類（slot 內容區） |
| workflow entry | `node tools_node/run-ui-vibe-workflow.js --proof-source <image> --screen-id <screen-id>` |
| bundle | `lobby_ui` / `battle_ui` / `ui_common` |

## 完整 SOP

請讀取主技能檔案以取得完整步驟：  
`.agents/skills/ui-vibe-pipeline/SKILL.md` (doc_agentskill_0008)

其中任務卡 / task shard 的產出必須委派 `task-card-opener` skill，並維持 `node tools_node/build-ui-task-manifest.js` 的既有 aggregate 重建規則。
任務卡 ID / 卡號 / 系統代碼命名亦同樣遵守名詞定義文件。

## UCUFLogger 提醒

`assets/scripts/` 內**禁用裸 `console.log`**，統一使用 `UCUFLogger`（`assets/scripts/ui/core/UCUFLogger.ts`）。新增 debug 功能前先確認目標 `LogCategory` 存在或補 enum；不得自建平行 log 模組。
