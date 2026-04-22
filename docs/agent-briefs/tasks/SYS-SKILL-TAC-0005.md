---
doc_id: doc_task_0161
id: SYS-SKILL-TAC-0005
priority: P2
phase: M1-E
created: 2026-04-15
created_by_agent: GitHubCopilot
owner: Agent1
status: open
type: tactic-module
related_cards:
  - SYS-SKILL-CORE-0001
  - SYS-SKILL-TAC-0003
  - SYS-SKILL-TAC-0004
depends:
  - SYS-SKILL-CORE-0001
runtime_scope:
  - TSUMMON
  - GlobalStage
  - SceneGambitAdapter
smoke_route: "BattleScene -> 場景戰法 / 關卡注入 -> 障礙生成 / 全場狀態 / AI 響應 / 清場"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/戰法系統.md (doc_spec_0038)
  - docs/遊戲規格文件/系統規格書/Data Schema文件（本機端與Server端）.md (doc_tech_0013)
notes: "供場景戰法與關卡腳本共用，不得讓 stage injection 在 battle runtime 外再長一份平行棋盤邏輯。2026-04-16 已完成：SceneGambitAdapter/BattleHUD badge/pulse VFX/BattleEntryParams 橋接全部到位；Editor 視覺 QA、VFX 資源補全（assets/fx/tactics/）與 AI 場景響應驗收為剩餘主要工作。"
---

# [SYS-SKILL-TAC-0005] 戰法場景注入與障礙模組包

## 背景

`水淹七軍 / 森林埋伏 / 落石封路` 代表的是關卡層與場景層對戰場的直接干預，不只是一般技能。這一包要把 `SceneGambitAdapter`、全場狀態、障礙生成、AI 響應鎖成正式流程，否則 stage design 與 battle runtime 很快會分裂成兩套棋盤規則。

## 覆蓋戰法

> 狀態標記：[x] 已落地骨架 / [-] 視覺/資源待補 / [ ] 未開始

- [-] `水淹七軍` (TTILE+TPUSH+TDEBUFF, 場景 G-4) — 骨架已接，Editor 視覺 QA 待驗
- [-] `森林埋伏` (TSTEALTH+TBUFF+TCOND, 場景 G-4) — 骨架已接，視覺 QA 待驗
- [-] `落石封路` (TSUMMON+TTILE, 場景 G-4) — 骨架已接，視覺 QA 待驗
- [-] `火計佈陣` (TTILE+TDIR+TCOND, 初始庫 G-5) — 場景注入路徑共用，VFX 資源補全

## 2026-04-16 已完成骨架

- [x] `SceneGambitAdapter` 將關卡資料轉成 `BattleSkillRequest`
- [x] battle log / toast / `BattleHUD.StatusLabel` 持續狀態層已接通
- [x] preview-only battleTactic 注入打通
- [x] `BattleScene → BoardRenderer` 全場 pulse VFX
- [x] `BattleHUD` 場景戰法 badge 顯示
- [x] `LobbyScene` 已透過 `BattleEntryParams` 把場景戰法送進 `BattleScene`
- [x] `capture-ui-screens --target BattleScene` 已成功輸出 BattleScene.png (capture diagnostics: 0 failures)

## 剩餘工作（視覺 QA + 資源）

- [ ] `水淹七軍 / 森林埋伏 / 落石封路` 的 Editor 實戰畫面視覺驗收
- [ ] 三個場景戰法的 VFX 特效資源補全（`assets/fx/tactics/` 目錄）
- [ ] 場景 HUD 摘要與 `BattleHUD.StatusLabel` 的文案最終對齊
- [ ] AI 在場景狀態下的 choke point / 危險格判斷驗收

## 實作清單

- [ ] **新增 / 修改** `SceneGambitAdapter`
  - 將關卡 / 場景資料轉成 `BattleSkillRequest`
- [ ] **新增 / 修改** `ObstacleSpawnResolver`
  - 落石、封路、臨時阻擋物
  - 生成與清除規則
- [ ] **新增 / 修改** stage-level state
  - 全場水域 / 隱匿 / 減速
  - 與天氣、地形相容性

## 驗收條件

### Unit Test 驗收

- [ ] 新增場景注入測試，至少覆蓋關卡載入時注入、戰鬥中觸發、回合結束清除三種情境。
- [ ] 障礙生成測試需驗證不可生成在非法格、不可覆蓋權威占用格。
- [ ] 全場狀態測試需驗證與天氣 / 地形疊加時的優先序。

### A. 畫面表演驗收標準

- [ ] 場景戰法觸發時，玩家能明確分辨這是關卡事件還是武將個體戰法。
- [ ] 障礙生成、地表變化、全場光影或 overlay 必須與實際生效區域一致。
- [ ] 清場時不得殘留幽靈障礙或看得到卻不生效的殘影。

### B. 數值公式驗收標準

- [ ] 全場減速、DOT、視野 / 隱匿修正必須走同一份 stage state，不得在 AI、UI、傷害結算各自重算。
- [ ] 障礙物的耐久、阻擋、消失條件需 deterministic。
- [ ] 場景戰法與一般戰法疊加時，優先序與可否共存需明確。

### C. 整合演出流程驗收標準

- [ ] 關卡載入、場景注入、單位 AI 重新評估、玩家回饋、回合結束清理要完整串通。
- [ ] BattleScene HUD 必須能顯示場景狀態摘要與變化原因。
- [ ] replay 重播場景注入事件時，生成格位與清除時機必須完全一致。

## 結案檢查清單

- [ ] Stage injection 沒有建立 battle runtime 之外的第二套棋盤真相。
- [ ] 場景戰法可由關卡資料或觸發器復用。
- [ ] AI 與 UI 共讀同一份 stage state。
