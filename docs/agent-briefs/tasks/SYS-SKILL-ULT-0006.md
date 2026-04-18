---
doc_id: doc_task_0167
id: SYS-SKILL-ULT-0006
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
  - UAREA
smoke_route: "BattleScene -> UltimateBtn -> 範圍爆發奧義 -> 多目標傷害 / 連鎖 / 戰報同步"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/奧義系統.md (doc_spec_0030)
  - docs/主戰場UI規格書.md (doc_ui_0001)
notes: "覆蓋趙雲5、諸葛亮3/5、關羽1、周瑜3/5、張飛3、曹植1。"
---

# [SYS-SKILL-ULT-0006] 奧義範圍爆發家族

## 背景

範圍爆發是戰場清線與群體壓制的高潮點，常同時帶有多目標、形狀選區與連鎖段數。這一包要把扇形、直線、全屏、連鎖爆發收進同一個 family resolver。

## 實作清單

- [ ] **新增 / 修改** `AreaBurstResolver`
  - 扇形 / 直線 / 全屏 / 連鎖傷害
- [ ] **補齊** 多目標 hit order、falloff、chain count。
- [ ] **補齊** UI 目標預覽與命中摘要。

## 驗收條件

### Unit Test 驗收

- [ ] 驗證扇形、直線、全屏、連鎖四種範圍模式。
- [ ] 驗證 chain bounce 上限與不可重複命中規則。
- [ ] 驗證多目標衰減與命中順序。

### A. 畫面表演驗收標準

- [ ] 命中範圍與 VFX 視覺覆蓋區必須一致。
- [ ] 連鎖跳躍要能讓玩家看懂跳的順序。
- [ ] 多目標同時受擊時，浮字不得重疊到無法判讀。

### B. 數值公式驗收標準

- [ ] 多目標衰減、chain bounce、全屏倍率需固定且可推導。
- [ ] 同一目標在同次奧義中不得被非法重複計算。
- [ ] 範圍爆發與 tile / buff / debuff 的交互順序需明確。

### C. 整合演出流程驗收標準

- [ ] 選區預覽、施放、逐段命中、戰報寫入、死亡清理要完整跑通。
- [ ] 命中多個敵將後，BattleHUD 血條與 battle log 必須同步更新。
- [ ] AI 需以期望總傷害與擊殺數作為使用判準。

## 結案檢查清單

- [ ] `UAREA` 無角色專屬特例流程。
- [ ] 多目標與連鎖邏輯已收斂成共用 resolver。
- [ ] 代表槽位都可落在同一個家族上。
