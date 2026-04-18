---
doc_id: doc_task_0166
id: SYS-SKILL-ULT-0005
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
  - USINGLE
smoke_route: "BattleScene -> UltimateBtn -> 敵將定點傷害奧義 -> 鎖定 / 斬殺 / 戰報同步"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/奧義系統.md (doc_spec_0030)
  - docs/主戰場UI規格書.md (doc_ui_0001)
notes: "覆蓋趙雲3、關羽2、呂布1/2/5、孫權1、司馬懿1 等單體重創與斬殺家族。"
---

# [SYS-SKILL-ULT-0005] 奧義敵將定點傷害家族

## 背景

單體重創與斬殺是名將對位的核心戲劇點，也是玩家最能感知「這招很兇」的家族。本卡把鎖定、重創、斬殺線、標記壓制收斂成單一家族。

## 實作清單

- [ ] **新增 / 修改** `SingleExecuteResolver`
  - 單體高傷
  - 斬殺門檻
  - 標記 / 壓制狀態
- [ ] **補齊** 目標優先權與 target lock UI。
- [ ] **補齊** 斬殺成功 / 失敗分支戰報。

## 驗收條件

### Unit Test 驗收

- [ ] 驗證一般高傷、斬殺成功、斬殺失敗三種情境。
- [ ] 驗證 target lock 與換目標條件。
- [ ] 驗證標記效果與後續追傷是否正確觸發。

### A. 畫面表演驗收標準

- [ ] 目標鎖定與斬殺成功要有明確視覺差異。
- [ ] 重創但未擊殺時，玩家仍能清楚知道剩餘血量與標記狀態。
- [ ] 不得發生看起來打中 A、實際扣到 B 的錯位。

### B. 數值公式驗收標準

- [ ] 斬殺線、重創倍率、標記追傷要固定且可推導。
- [ ] 斬殺門檻不能受動畫延遲或浮點誤差影響。
- [ ] 單體高傷與防禦 / 抗性 / 減傷互動需明確。

### C. 整合演出流程驗收標準

- [ ] 從選敵、鎖定、施放、傷害結算、死亡或殘血分支，到戰報收尾都要跑通。
- [ ] 被鎖定目標死亡後，後續追傷不可誤打到不存在單位。
- [ ] AI 需能根據斬殺線與敵將威脅值選用此 family。

## 結案檢查清單

- [ ] `USINGLE` 只保留一套單體壓制 resolver。
- [ ] 斬殺與重創都能用 family 參數描述。
- [ ] Battle log / HUD / replay 對目標結果一致。
