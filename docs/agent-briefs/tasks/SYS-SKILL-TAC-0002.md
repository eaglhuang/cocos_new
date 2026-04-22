---
doc_id: doc_task_0158
id: SYS-SKILL-TAC-0002
priority: P0
phase: M1-E
created: 2026-04-15
created_by_agent: GitHubCopilot
owner: Agent1
status: open
type: tactic-module
related_cards:
  - SYS-SKILL-CORE-0001
  - SYS-SKILL-TAC-0001
depends:
  - SYS-SKILL-CORE-0001
runtime_scope:
  - TBUFF
  - THEAL
  - TDEBUFF
smoke_route: "BattleScene -> 我方 Buff / Heal / Debuff 戰法施放 -> 狀態圖示 / 數值變化 / 戰報同步"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/戰法系統.md (doc_spec_0038)
  - docs/主戰場UI規格書.md (doc_ui_0001)
notes: "先把可疊加的 buff / heal / debuff 規則釘死，避免後續戰法與奧義共用狀態系統時出現乘區分裂。2026-04-20 更新：長槍列陣/軍心鼓舞已落地；G-2 六招規格對位進行中，毒箭 DOT 段與幼麒天算 debuff 段為主要未開始項目。"
---

# [SYS-SKILL-TAC-0002] 戰法增益治療減益模組包

## 背景

`單騎破陣 / 醫療 / 鼓舞 / 緩速 / 長槍列陣 / 軍心鼓舞` 會直接決定戰場可玩性與隊伍節奏，也是奧義家族共用狀態系統的前置。本卡要先定義 buff、heal、debuff 的疊加、覆蓋、持續與顯示規則。

## 覆蓋戰法

> 狀態標記：[x] 已落地 / [-] 進行中 / [ ] 未開始

- [-] `單騎破陣` (TBUFF+TCOND, 教官 G-2) — 規格對位、UI 文案待驗收
- [-] `醫療` (THEAL, 教官 G-2) — 規格對位待驗收
- [-] `鼓舞` (TBUFF, 教官 G-2) — 規格對位待驗收
- [-] `緩速` (TDEBUFF, 教官 G-2) — 規格對位待驗收
- [-] `八陣圖` (TBUFF 段, 教官 G-2) — TBUFF 部分，TTILE 部分歸 TAC-0003
- [ ] `毒箭` 持續傷害 / 減益段 (TDEBUFF DOT, 虎符 G-1)
- [ ] `幼麒天算` (TDEBUFF 段, 虎符 G-1) — 反擊後附加 Weak debuff
- [x] `長槍列陣` (TBUFF+TCOND, 初始庫 G-5)
- [x] `軍心鼓舞` (TBUFF, 初始庫 G-5)

## 實作清單

- [ ] **新增 / 修改** `BuffDebuffResolver`
  - 加攻 / 加防 / 加速
  - 緩速 / 易傷 / DOT
  - 同名狀態刷新與覆蓋規則
- [ ] **新增 / 修改** `HealResolver`
  - 單體補血
  - 溢補上限
  - 補血戰報
- [ ] **補齊** 狀態顯示
  - icon / turn counter
  - 來源說明
  - 灰化原因與不可施放提示

## 驗收條件

### Unit Test 驗收

- [ ] 新增 buff / heal / debuff 測試，至少覆蓋新增、刷新、覆蓋、到期移除四種情境。
- [ ] Heal 測試需驗證最大生命上限、溢補處理與瀕死救援邊界。
- [ ] DOT / slow 測試需驗證每回合 tick 次序與持續回合數。

### A. 畫面表演驗收標準

- [ ] Buff、debuff、heal 都要有獨立可辨識的浮字或圖示變化。
- [ ] 狀態 icon 與剩餘回合數必須在 BattleHUD 可讀。
- [ ] 補血與持續傷害不得共用同色浮字造成誤判。

### B. 數值公式驗收標準

- [ ] Buff 乘區與加算區需固定，不得因施放順序不同得出不同結果。
- [ ] Heal 不能超過目標上限，DOT 不得被治療公式誤用。
- [ ] 同名狀態的刷新 / 覆蓋規則必須明確，不能同時存在兩份權威值。

### C. 整合演出流程驗收標準

- [ ] 從施放、圖示掛上、回合推進、tick 結算、到期移除必須完整可重現。
- [ ] BattleScene 與 GeneralDetail 對狀態類型的文字描述需一致。
- [ ] AI 判斷 Buff / Heal / Debuff 的施放條件時，不能誤把已存在的高優先狀態重複覆蓋。

## 結案檢查清單

- [ ] 狀態系統可被 tactic 與 ultimate 共用。
- [ ] Buff / Heal / Debuff 沒有硬寫角色特例。
- [ ] UI、戰報、結算三條輸出管線使用同一份狀態結果。
