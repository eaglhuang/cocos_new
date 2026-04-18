---
doc_id: doc_task_0164
id: SYS-SKILL-ULT-0003
priority: P0
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
  - UTEAMHEAL
smoke_route: "BattleScene -> UltimateBtn -> 團隊回復奧義 -> 補血 / 淨化 / 精力回補同步"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/奧義系統.md (doc_spec_0030)
  - docs/主戰場UI規格書.md (doc_ui_0001)
notes: "覆蓋趙雲2、曹操4、劉備1/3 等群補、淨化、精力回補家族。"
---

# [SYS-SKILL-ULT-0003] 奧義團隊回復家族

## 背景

團隊回復家族會直接決定拖回合、救援與翻盤能力，也是戰場節奏的安全閥。這一包要把群補、淨化、精力回補與瀕死救援放在同一套 resolver 下管理。

## 實作清單

- [ ] **新增 / 修改** `TeamRecoverResolver`
  - 群體補血
  - 淨化負面狀態
  - 精力 / SP 回補
- [ ] **補齊** 瀕死優先權與救援順序。
- [ ] **補齊** BattleHUD 補血與淨化顯示。

## 驗收條件

### Unit Test 驗收

- [ ] 驗證群補、淨化、SP 回補三種分支。
- [ ] 驗證瀕死單位優先處理與回復上限。
- [ ] 驗證淨化不會誤刪正面狀態。

### A. 畫面表演驗收標準

- [ ] 被救回的單位需要有明確的回復與解除負面回饋。
- [ ] 群體補血不可讓玩家誤讀成全隊都滿血。
- [ ] 淨化成功需能看見 debuff icon 消失。

### B. 數值公式驗收標準

- [ ] 補血係數、SP 回補、淨化數量都需固定可推導。
- [ ] 淨化順序與可淨化類型必須白名單化。
- [ ] 群補不得繞過 max HP / max SP 上限。

### C. 整合演出流程驗收標準

- [ ] UltimateBtn 施放、群補跳字、圖示移除、後續行動恢復都要完整串通。
- [ ] 瀕死救援後的單位可立即被後續系統正確讀到新血量與狀態。
- [ ] AI 在我方血線危急時需能優先選用此 family。

## 結案檢查清單

- [ ] 補血、淨化、SP 回補都進同一個 family resolver。
- [ ] 瀕死救援沒有角色硬編碼。
- [ ] UI / battle log / replay 對補血結果一致。
