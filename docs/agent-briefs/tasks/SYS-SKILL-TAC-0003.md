---
doc_id: doc_task_0159
id: SYS-SKILL-TAC-0003
priority: P1
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
  - TMOVE
  - TPUSH
  - TTILE
smoke_route: "BattleScene -> 位移 / 推擠 / 地格狀態戰法施放 -> 單位位置 / tile overlay / 後續傷害同步"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/戰法系統.md (doc_spec_0038)
  - docs/主戰場UI規格書.md (doc_ui_0001)
notes: "位移、推擠、地格狀態是 battle board 的核心差異化能力，必須先把 path、blocker、tile ownership 鎖死。"
---

# [SYS-SKILL-TAC-0003] 戰法位移與棋盤控制模組包

## 背景

棋盤戰鬥跟純數值 RPG 的差別，在於位置本身就是資源。`騎射合一 / 精銳突擊 / 七進七出 / 長坂雄咆 / 火神狩獵 / 八陣圖 / 空城計 / 火計佈陣` 都依賴位移、推擠與 tile state，如果這層沒有先穩定，後面的地形、場景與奧義表演會全部漂移。

## 覆蓋戰法

- `騎射合一`
- `精銳突擊`
- `七進七出`
- `長坂雄咆`
- `火神狩獵`
- `八陣圖`
- `空城計`
- `火計佈陣`

## 實作清單

- [ ] **新增 / 修改** `MovementResolver`
  - 移動距離
  - 穿透 / 衝刺
  - 終點校正
- [ ] **新增 / 修改** `ForcedMoveResolver`
  - 推擠
  - 拉扯
  - 碰撞阻擋
- [ ] **新增 / 修改** `TileStateResolver`
  - 火焰 / 水域 / 陣型 / 陷阱 overlay
  - 持續回合
  - 進入 tile 觸發

## 驗收條件

### Unit Test 驗收

- [ ] 新增 path 與推擠測試，至少覆蓋直線衝刺、被阻擋推擠、穿透後停點三種情境。
- [ ] Tile state 測試需驗證建立、刷新、覆蓋、到期清除與 enter-tile trigger。
- [ ] 測試需驗證同一格不可同時存在互斥的權威狀態。

### A. 畫面表演驗收標準

- [ ] 移動路徑、終點、被推擠方向要能被玩家一眼看懂。
- [ ] Tile overlay 必須與實際生效範圍完全對齊，不能只好看不好判讀。
- [ ] 推擠或衝刺結束後，單位站位與受擊 VFX 不得分離。

### B. 數值公式驗收標準

- [ ] 位移距離、推擠步數、tile tick 傷害必須固定且可推導。
- [ ] 衝刺追加傷害需只根據正式定義的位移條件觸發，不得吃到動畫時間差。
- [ ] 同格衝突、阻擋、地格 ownership 判定需 deterministic，不得因更新順序改變結果。

### C. 整合演出流程驗收標準

- [ ] 從選格、顯示預覽、播放位移、落點結算、tile 觸發、回合狀態更新要一氣呵成。
- [ ] 進入受火焰 / 水域影響的 tile 後，下一個 tick 必須符合預期。
- [ ] AI 對 choke point、危險 tile、可推落點的判斷需讀同一份 board state。

## 結案檢查清單

- [ ] 沒有任何位移戰法直接繞過棋盤座標系統。
- [ ] tile ownership 與 enter-tile trigger 已落在共用 resolver。
- [ ] BattleHUD / 戰報對位置改變都有對應輸出。
