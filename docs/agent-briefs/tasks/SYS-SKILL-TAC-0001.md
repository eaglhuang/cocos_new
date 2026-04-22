---
doc_id: doc_task_0157
id: SYS-SKILL-TAC-0001
priority: P0
phase: M1-E
created: 2026-04-15
created_by_agent: GitHubCopilot
owner: Agent1
status: open
type: tactic-module
related_cards:
  - SYS-SKILL-CORE-0001
  - SYS-SKILL-TAC-0002
depends:
  - SYS-SKILL-CORE-0001
runtime_scope:
  - TDIR
  - TLINE
  - TFAN
smoke_route: "BattleScene -> TacticsBtn -> 單體 / 直線 / 扇形戰法施放 -> 傷害數字 / 戰報 / HP 同步"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/戰法系統.md (doc_spec_0038)
  - docs/主戰場UI規格書.md (doc_ui_0001)
notes: "覆蓋單體、直線、扇形投射傷害；以單一 target resolver 支援多種選區，不為每招各寫一個戰鬥流程。2026-04-20 更新：無視防禦/百步穿楊/箭雨齊發/龍魂突刺已落地並通過 smoke；趙家槍法進行中；其餘 G-1 虎符戰法 TDIR/TLINE/TFAN 段待實作。"
---

# [SYS-SKILL-TAC-0001] 戰法傷害投射模組包

## 背景

32 類戰法裡，最先需要穩定的是單體、直線、扇形三種最常見的打擊形狀。只要這一包穩住，`無視防禦 / 百步穿楊 / 趙家槍法 / 箭雨齊發 / 龍魂突刺` 等大量戰法都能先進入可玩狀態，後續只需換參數與 targetMode。

## 覆蓋戰法

> 狀態標記：[x] 已落地 / [-] 進行中 / [ ] 未開始

- [x] `無視防禦` (TDIR, 虎符)
- [x] `百步穿楊` (TDIR, 虎符)
- [-] `趙家槍法` (TLINE, 血統 G-3) — 三段遞增、演出驗收待補
- [ ] `精銳突擊` (TLINE 段, 虎符 G-1) — 衝鋒傷害倍率
- [ ] `長坂雄咆` (TFAN 段, 虎符 G-1) — 3×3 AOE 結算
- [ ] `無雙亂舞` (TFAN 段, 虎符 G-1) — 周身 8 格 AOE
- [ ] `威震華夏` (TDIR 段, 虎符 G-1) — 首擊加倍計算
- [ ] `連環計` (TDIR 觸發端, 虎符 G-1) — 主體傷害結算
- [ ] `結姻連射` (TDIR, 虎符 G-1) — 追加普攻
- [ ] `火神狩獵` (TDIR 段, 虎符 G-1) — 單目標擊退後傷害
- [x] `箭雨齊發` (TFAN, 初始庫 G-5)
- [x] `龍魂突刺` (TLINE 段, 初始庫 G-5)
- [x] `毒箭` 的直接命中段 (TDIR, 虎符 G-1)

## 實作清單

- [ ] **新增 / 修改** 傷害 resolver
  - 單體指向傷害
  - 直線穿透傷害
  - 扇形 / 面狀投射傷害
- [ ] **補齊** target selection 規則
  - `EnemySingle`
  - `Line`
  - `Fan`
- [ ] **補齊** 命中結果輸出
  - 傷害數字
  - battle log key
  - 多目標命中順序
- [ ] **補齊** 對應戰法參數表
  - `coefficient`
  - `ignoreDefense`
  - `maxTargets`
  - `falloffRule`

## 驗收條件

### Unit Test 驗收

- [ ] 新增傷害投射測試，至少覆蓋單體、直線、扇形三種 targetMode。
- [ ] 直線測試需驗證多目標順序與穿透停止規則。
- [ ] 扇形測試需驗證角度邊界上的單位是否正確納入。
- [ ] `ignoreDefense`、`falloffRule`、`maxTargets` 必須有明確 assertion。

### A. 畫面表演驗收標準

- [ ] 單體、直線、扇形三種施放都要有正確 target highlight。
- [ ] 命中數與跳出的傷害數字個數必須一致。
- [ ] 多段命中不得出現目標先扣血、後播演出的時間倒置。

### B. 數值公式驗收標準

- [ ] 單體傷害公式需能穩定套用主屬性、係數、減傷與暴擊。
- [ ] `ignoreDefense` 只能影響防禦減免段，不可略過抗性或免疫判定。
- [ ] 直線 / 扇形的多目標傷害衰減規則必須固定，不可依目標掃描順序漂移。

### C. 整合演出流程驗收標準

- [ ] 從點選戰法、選目標、播放演出、扣血、戰報寫入，到 turn state 收尾必須完整跑通。
- [ ] GeneralDetail 對應戰法文案與 BattleScene 戰法摘要需一致。
- [ ] 未命中、被格擋、目標死亡中斷三種分支要能正常收尾。

## 結案檢查清單

- [ ] 傷害投射邏輯不可散落在各戰法專用 `switch`。
- [ ] 每個覆蓋戰法都只靠參數與 targetMode 組裝，不新增特例流程。
- [ ] Battle log key 與 UI 顯示名稱已完成對接。
