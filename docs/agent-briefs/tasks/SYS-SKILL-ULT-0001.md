---
doc_id: doc_task_0162
id: SYS-SKILL-ULT-0001
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
  - UBURST
smoke_route: "BattleScene -> UltimateBtn -> 自身爆發奧義 -> 自身狀態提升 / 演出 / 戰報同步"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/奧義系統.md (doc_spec_0030)
  - docs/主戰場UI規格書.md (doc_ui_0001)
notes: "覆蓋趙雲1、關羽5、呂布3、張飛2/5、司馬懿2 等自身爆發奧義。"
---

# [SYS-SKILL-ULT-0001] 奧義自身爆發家族

## 背景

自身爆發是名將「打開決勝窗口」最直接的家族，會牽動攻擊、暴擊、免控、再行動與短時強化。如果這一包先穩住，很多招牌名將就能先進入有辨識度的 playable state。

## 範圍

- `UBURST` family
- 代表槽位：趙雲 1、關羽 5、呂布 3、張飛 2 / 5、司馬懿 2

## 實作清單

- [ ] **新增 / 修改** `SelfBurstResolver`
  - 攻擊 / 暴擊 / 免控 / 再行動窗口
- [ ] **補齊** 奧義 family 參數
  - 持續回合
  - 爆發倍率
  - 可否帶免控或再動
- [ ] **補齊** Battle / UI 顯示
  - 爆發狀態 icon
  - 期間提示與結束提示

## 驗收條件

### Unit Test 驗收

- [ ] 驗證爆發開始、持續、結束三段 state 轉換。
- [ ] 驗證再行動不能無限連鎖。
- [ ] 驗證免控只在定義期間生效。

### A. 畫面表演驗收標準

- [ ] 施放後角色身上要有清楚的爆發態視覺，不可只靠數字變大。
- [ ] 爆發生效中的普攻 / 技能演出必須與非爆發期有可辨識差異。
- [ ] 爆發結束時需有明確回退提示。

### B. 數值公式驗收標準

- [ ] 自身屬性倍率、暴擊提升、追加行動窗口都需可推導。
- [ ] 同類爆發不可無限制疊乘。
- [ ] 再行動的 gating 必須獨立於動畫時間，不可因表演快慢影響結果。

### C. 整合演出流程驗收標準

- [ ] UltimateBtn 施放、扣 SP、掛上狀態、後續攻擊放大、回合結束回收要完整串通。
- [ ] Battle log 與角色 HUD 對爆發中的名稱與圖示描述要一致。
- [ ] AI 需在斬殺線或危險值成立時優先考慮此 family。

## 結案檢查清單

- [ ] `UBURST` 成員都只靠參數差異，不新增角色特例流程。
- [ ] 再行動、免控、短時強化已納入正式狀態系統。
- [ ] BattleScene 與 GeneralDetail 對應文案一致。
