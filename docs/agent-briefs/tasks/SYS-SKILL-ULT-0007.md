---
doc_id: doc_task_0168
id: SYS-SKILL-ULT-0007
priority: P1
phase: M1-E
created: 2026-04-15
created_by_agent: GitHubCopilot
owner: Agent1
status: open
type: ultimate-family
related_cards:
  - SYS-SKILL-CORE-0001
depends:
  - SYS-SKILL-CORE-0001
runtime_scope:
  - UCONTROL
smoke_route: "BattleScene -> UltimateBtn -> 強控 / 奪取奧義 -> 敵方行動受控 / 戰報同步"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/奧義系統.md (doc_spec_0030)
  - docs/主戰場UI規格書.md (doc_ui_0001)
notes: "覆蓋諸葛亮1、曹操3/5、周瑜2、張飛1、郭嘉1、貂蟬1 等魅惑、倒戈、沉默與偷行動條。"
---

# [SYS-SKILL-ULT-0007] 奧義強控與奪取家族

## 背景

強控與奪取家族最容易破壞回合秩序，也是最需要 deterministic 的 family。倒戈、魅惑、沉默、偷行動條如果沒有共用規則，戰報、AI、replay 很快就會失真。

## 實作清單

- [ ] **新增 / 修改** `ControlOverrideResolver`
  - 魅惑 / 倒戈 / 沉默 / 行動條奪取 / 看破
- [ ] **補齊** 控制免疫與優先序。
- [ ] **補齊** BattleHUD 控制狀態與不可行動提示。

## 驗收條件

### Unit Test 驗收

- [ ] 驗證魅惑、沉默、偷行動條至少三種控制型態。
- [ ] 驗證免控、抗性、被淨化後的回復流程。
- [ ] 驗證控制狀態不會讓回合指標卡死。

### A. 畫面表演驗收標準

- [ ] 被控單位需要有明確的 icon 與狀態說明。
- [ ] 偷行動條或奪取控制權時，玩家能看懂回合條發生什麼事。
- [ ] 被魅惑 / 倒戈的行動目標要有足夠前置提示。

### B. 數值公式驗收標準

- [ ] 命中率、抗性、控制持續與行動條變化需固定。
- [ ] 控制不可直接繞過免疫或 Boss 例外白名單。
- [ ] 多個控制同時作用時，優先序與可共存關係要明確。

### C. 整合演出流程驗收標準

- [ ] 奧義施放、命中判定、控制掛上、下回合行動受限、解除控制要完整串通。
- [ ] Battle log 與回合條顯示必須反映真實控制狀態。
- [ ] AI 需能辨識高價值敵將並在關鍵回合使用此 family。

## 結案檢查清單

- [ ] 所有強控 / 奪取都走同一條回合控制管線。
- [ ] replay 對控制狀態可完全重現。
- [ ] 代表槽位都能用同一 family 參數化描述。
