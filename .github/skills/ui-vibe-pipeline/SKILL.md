---
name: ui-vibe-pipeline
description: 'Use for Cocos UI, JSON layout, skin manifest, atlas planning, 9-slice validation, Auto Atlas policy, preview generation, vibe coding workflow, and mass-producing UI screens with consistent structure.'
argument-hint: 'Describe the target screen, visual style, and whether you need layout spec, skin manifest, preview workflow, or validation.'
---

<!-- 此檔案為 .agents/skills/ui-vibe-pipeline/SKILL.md 的鏡像副本，供 GitHub Copilot 技能載入使用 -->
<!-- 主版本位於 c:\Users\User\3KLife\.agents\skills\ui-vibe-pipeline\SKILL.md -->

<!-- 載入主版本的指引：
     當此 skill 被觸發時，請讀取
     .agents/skills/ui-vibe-pipeline/SKILL.md
     以取得完整的 UI 生產 SOP。-->

# UI Vibe Pipeline（鏡像索引）

此技能適用於下列情境：
- 建立新的 Cocos UI 畫面（需要三層 JSON 契約）
- 從截圖或規格文字轉換為 layout + skin JSON
- 檢查 atlas 分組與九宮格正確性
- 產生預覽並驗證 UI 排版
- 批量生產多個 UI 畫面

## 快速規格提醒

| 項目 | 值 |
|---|---|
| 設計基準解析度 | 1920 × 1080（橫向） |
| canvas 格式 | `"canvas": {"fitWidth": true, "fitHeight": true, "safeArea": true, "designWidth": 1920, "designHeight": 1080}` |
| 最小觸控熱區 | 44 × 44 px |
| 視覺主題 | 水墨 + 鋼鐵：深底 `#0F0F0F`，金色 `#D4AF37` / `#FFE088` |
| 基類 | `UIPreviewBuilder`（所有 UI Panel 必須繼承） |
| bundle | `lobby_ui` / `battle_ui` / `ui_common` |

## 完整 SOP

請讀取主技能檔案以取得完整步驟：  
`.agents/skills/ui-vibe-pipeline/SKILL.md`
