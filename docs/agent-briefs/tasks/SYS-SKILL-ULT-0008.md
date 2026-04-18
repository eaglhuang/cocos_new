---
doc_id: doc_task_0169
id: SYS-SKILL-ULT-0008
priority: P2
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
  - USPECIAL
smoke_route: "BattleScene -> UltimateBtn -> 特殊規則奧義 -> 復活 / 重置 / 場勢切換 / 死亡觸發同步"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/奧義系統.md (doc_spec_0030)
  - docs/遊戲規格文件/系統規格書/Data Schema文件（本機端與Server端）.md (doc_tech_0013)
notes: "覆蓋諸葛亮2、曹操2、關羽3、呂布4、劉備4、孫權3/5、司馬懿4、郭嘉4、曹植4、貂蟬2/4。"
---

# [SYS-SKILL-ULT-0008] 奧義特殊規則家族

## 背景

特殊規則家族包含復活、重置行動、增益轉移、死亡觸發與場勢切換，是最容易產生例外分支的高風險區。這一包一定要集中管理，不能讓每個名將各自偷偷改 turn state 或 battle state。

## 實作清單

- [ ] **新增 / 修改** `SpecialRuleResolver`
  - 復活
  - 行動重置
  - 增益轉移
  - 死亡觸發
  - 場勢切換
- [ ] **補齊** 特殊規則的白名單與互斥規則。
- [ ] **補齊** battle log / replay 事件節點。

## 驗收條件

### Unit Test 驗收

- [ ] 驗證復活、行動重置、死亡觸發三種高風險分支。
- [ ] 驗證同一事件不可重複觸發特殊規則。
- [ ] 驗證場勢切換會同步更新 AI、UI、damage context。

### A. 畫面表演驗收標準

- [ ] 復活、場勢切換、重置行動要有明確且不會誤判的視覺提示。
- [ ] 特殊規則成功與失敗都要有回饋，不可只在 battle log 才知道。
- [ ] 場勢切換後的全場狀態必須立即可見。

### B. 數值公式驗收標準

- [ ] 復活血量、重置次數、增益轉移比例、死亡觸發條件需固定。
- [ ] 特殊規則不可繞過資源成本、冷卻或使用次數限制。
- [ ] 同一回合多個特殊規則同時成立時，執行優先序必須明確。

### C. 整合演出流程驗收標準

- [ ] 從奧義施放、特殊規則生效、battle state 重算、AI / UI 刷新、戰報寫入要完整串通。
- [ ] replay 需能忠實重現復活、場勢切換與死亡觸發結果。
- [ ] 特殊規則不得造成回合卡死、雙重結算或幽靈單位。

## 結案檢查清單

- [ ] `USPECIAL` 只保留一個 family resolver。
- [ ] 特殊規則有清楚白名單與互斥矩陣。
- [ ] Data Schema / Battle / UI 對特殊事件共用同一份結果。
