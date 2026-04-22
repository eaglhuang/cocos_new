---
doc_id: doc_task_0160
id: SYS-SKILL-TAC-0004
priority: P1
phase: M1-E
created: 2026-04-15
created_by_agent: GitHubCopilot
owner: Agent1
status: open
type: tactic-module
related_cards:
  - SYS-SKILL-CORE-0001
  - SYS-SKILL-TAC-0003
depends:
  - SYS-SKILL-CORE-0001
runtime_scope:
  - TLINK
  - TCOUNTER
  - TRESET
  - TCOND
  - TSTEALTH
smoke_route: "BattleScene -> 反應技 / 連結技 / 條件技觸發 -> 觸發提示 / 後續傷害 / 行動重置同步"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/戰法系統.md (doc_spec_0038)
  - docs/主戰場UI規格書.md (doc_ui_0001)
notes: "把 condition / reaction / link 收斂到統一觸發管線，避免每招各自偷偷改 turn state。2026-04-16 已完成：TLINK/TCOUNTER/TRESET 第一版 runtime 已落地；TSTEALTH（AmbushAttack）已實作前 2 回合隱匿規則；G-1 虎符完整版（火計連環、幼麒天算、連環計、結姻連射、威震華夏、七進七出）規格完整對位與 Editor/smoke 驗收待補。"
---

# [SYS-SKILL-TAC-0004] 戰法反應連鎖條件模組包

## 背景

`火計連環 / 幼麒天算 / 連環計 / 結姻連射 / 水路伏擊 / 威震華夏` 不是單純按下去就結算，而是依賴條件成立、連結轉傷、反擊時點或再行動。這些如果沒有共用觸發管線，最容易變成日後最難收的 special case 黑洞。

## 覆蓋戰法

> 狀態標記：[x] 已落地 / [-] 進行中 / [ ] 未開始

- [ ] `火計連環` (TLINK+TCOND, 虎符 G-1) — TLINK 條件觸發段，火格擴散連鎖
- [ ] `幼麒天算` (TCOUNTER+TCOND, 虎符 G-1) — 近戰反擊完整版（+TDEBUFF 弱化）
- [ ] `連環計` (TLINK+TDIR, 虎符 G-1) — 持續 damage-link 完整版
- [ ] `結姻連射` (TDIR+TCOND, 虎符 G-1) — 鄰格條件協同觸發
- [ ] `威震華夏` (TDIR+TRESET+TCOND, 虎符 G-1) — 首擊加倍+擊殺再行動完整版
- [ ] `七進七出` (TSTEALTH 段, 虎符 G-1) — Ghost_Move 穿透 + 反擊歸零
- [-] `水路伏擊` (TTILE+TDIR+TCOND, 初始庫 G-5) — TSTEALTH 段進行中
- [x] `森林埋伏` 的隱匿 / 條件觸發段 (TSTEALTH, 場景 G-4)

## 2026-04-16 已完成第一版

- [x] `TLINK` 第一版：主目標 → 相鄰敵軍 damage-link 已可建立
- [x] `TCOUNTER` 第一版：友軍近戰反擊 stance 掛載、受擊存活後自動反擊並附加 `Weak`
- [x] `TRESET` 第一版：友軍首擊加倍 stance、擊殺後追加同回合攻擊
- [x] `TSTEALTH` (AmbushAttack)：前 2 回合 stealthOpenTurns 影響 battle resolve，敵軍忽略隱匿單位

## 實作清單

- [ ] **新增 / 修改** `ConditionalTriggerResolver`
  - 進格觸發
  - 受擊觸發
  - 斬殺 / 再行動觸發
- [ ] **新增 / 修改** `LinkShareResolver`
  - 雙目標共享傷害
  - 連鎖 DOT
  - 解除連結
- [ ] **新增 / 修改** `CounterReactionResolver`
  - 反擊
  - 看破
  - 再行動 / 行動重置 gating

## 驗收條件

### Unit Test 驗收

- [ ] 新增條件觸發測試，至少覆蓋命中後觸發、進格觸發、擊殺後觸發三種 timing。
- [ ] Link 測試需驗證共享比例、解除條件與多次結算不重複計入。
- [ ] 行動重置測試需驗證每回合最多觸發次數與不可遞迴觸發自身。

### A. 畫面表演驗收標準

- [ ] 反應技觸發時，玩家能清楚看到是「被動觸發」而不是主動施放。
- [ ] 連結目標需有明確標記，不可只在 battle log 才知道有綁定。
- [ ] 再行動成功與失敗都要有清楚回饋，不能讓玩家誤判回合結束。

### B. 數值公式驗收標準

- [ ] 共享傷害比例、反擊倍率、再行動觸發機率要固定且可重現。
- [ ] 條件判定只能讀正式 state，不得偷偷讀動畫或 UI 暫存值。
- [ ] 任何 reactive chain 都要保證 deterministic，避免同一戰報重播出不同結果。

### C. 整合演出流程驗收標準

- [ ] 敵方行動觸發陷阱 / 反擊 / 連結轉傷後，回合控制權與戰報順序必須正確。
- [ ] 被動觸發技能不得打斷主動技能的清理與收尾。
- [ ] replay 重播時需能重現相同 trigger 順序與相同結果。

## 結案檢查清單

- [ ] 條件 / 反應 / 連鎖已走同一條 trigger pipeline。
- [ ] 再行動與回合結束判定沒有互相踩 state。
- [ ] Battle log 能完整說明觸發原因與結果。
