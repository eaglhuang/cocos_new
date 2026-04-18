---
doc_id: doc_task_0156
id: SYS-SKILL-CORE-0001
priority: P0
phase: M1-E
created: 2026-04-15
created_by_agent: GitHubCopilot
owner: Agent1
status: open
type: skill-runtime
related_cards:
  - SYS-SKILL-TAC-0001
  - SYS-SKILL-TAC-0002
  - SYS-SKILL-TAC-0003
  - SYS-SKILL-TAC-0004
  - SYS-SKILL-TAC-0005
  - SYS-SKILL-ULT-0001
depends: []
runtime_scope:
  - shared/skill-runtime.ts
  - assets/scripts/battle/views/BattleSceneLoader.ts
  - assets/scripts/ui/components/general-detail/GeneralDetailSkillsChild.ts
smoke_route: "GeneralDetail Skills -> BattleScene TacticsBtn / UltimateBtn 讀到同一組 tacticId / ultimateId / battleSkillId"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/戰法系統.md (doc_spec_0038)
  - docs/遊戲規格文件/系統規格書/奧義系統.md (doc_spec_0030)
  - docs/遊戲規格文件/系統規格書/Data Schema文件（本機端與Server端）.md (doc_tech_0013)
notes: "Battle / GeneralDetail 先共用 canonical definition type 與 map builder；後續 resolver、AI、save overlay 都必須延續同一份 shared contract。"
---

# [SYS-SKILL-CORE-0001] Shared Skill Runtime 讀模型統一

## 背景

BattleScene 與 GeneralDetail 已經讀同一份 `tactic-library.json` / `ultimate-definitions.json`，但先前各自維護本地 interface，會讓 battle wrapper、名稱、解鎖條件與 UI 摘要逐步分岐。本卡先把「讀模型」收斂到 `shared/skill-runtime.ts`，作為後續 32 類戰法與 65 條奧義共用的唯一 seed contract。

## 範圍

- 統一 `CanonicalTacticDefinition`、`CanonicalUltimateDefinition`、`JsonListEnvelope`、`buildIdMap()`。
- `BattleSceneLoader` 與 `GeneralDetailSkillsChild` 改用同一份 shared type。
- `tsconfig.json` 納入 `shared/**/*.ts`，讓 assets-side runtime 可直接引用 shared contract。
- 不在本卡實作 resolver、公式與演出；本卡只處理 read model seam。

## 實作清單

- [ ] **修改** `shared/skill-runtime.ts`
  - 補齊 canonical tactic / ultimate definition type。
  - 補齊共用 envelope 與 `buildIdMap()`。
- [ ] **修改** `assets/scripts/battle/views/BattleSceneLoader.ts`
  - 移除本地 tactic / ultimate definition interface。
  - 直接使用 shared type 與 map builder。
- [ ] **修改** `assets/scripts/ui/components/general-detail/GeneralDetailSkillsChild.ts`
  - 移除本地 tactic / ultimate definition interface。
  - 直接使用 shared type 與 map builder。
- [ ] **修改** `tsconfig.json`
  - 讓 `shared/**/*.ts` 進入 TypeScript include 範圍。
- [ ] **回寫** Battle / GeneralDetail / Data Schema 正式文件與後續 task card 依賴。

## 驗收條件

### Unit Test 驗收

- [ ] 新增一組 shared read-model 測試，至少驗證 `tactic-library.json` 與 `ultimate-definitions.json` 經 `buildIdMap()` 後可穩定用 `id` 取得定義。
- [ ] 測試需覆蓋 tactic 缺 `battleSkillId`、ultimate 缺 `description`、空 `data[]` 三種 fallback。
- [ ] 測試需驗證 Battle / GeneralDetail 兩個入口對同一筆 definition 取到相同 `displayName / name / battleSkillId`。

### A. 畫面表演驗收標準

- [ ] GeneralDetail Skills 頁與 BattleScene 按鈕文案不得出現同 ID 不同名稱。
- [ ] BattleScene 戰法摘要與 Ultimate popup 不得出現空白 label 或 `undefined`。
- [ ] 缺資料 fallback 時，畫面仍顯示 `tacticId / ultimateId` 而不是直接崩潰。

### B. 數值公式驗收標準

- [ ] 本卡不新增任何技能公式；驗收點是「不改變現有公式輸入值」。
- [ ] 相同 `battleSkillId` 在 Battle / GeneralDetail / save overlay 的讀值來源必須一致，不能再有 battle-only 平行欄位。
- [ ] `tacticSlots[] / ultimateSlots[]` 仍是 canonical seed，`Learned_Tactics / Ultimates` 只作 overlay，不可反客為主。

### C. 整合演出流程驗收標準

- [ ] 流程必須是 `generals.json -> tactic/ultimate master -> shared read model -> Battle/UI`。
- [ ] GeneralDetail 點技能預覽、BattleScene 顯示戰法摘要、Ultimate popup 建立技能列表三條路徑都要跑通。
- [ ] `npm run check:ts-syntax`、`npm test`、Cocos asset refresh、encoding check 必須全過。

## 結案檢查清單

- [ ] 不再新增新的 battle-only 或 ui-only tactic/ultimate definition interface。
- [ ] 相關正式文件已回寫 shared read model seam。
- [ ] 後續 tactic / ultimate family 任務卡都以本卡為前置依賴。
