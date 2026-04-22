---
doc_id: doc_task_0170
id: SYS-SKILL-TAC-0006
priority: P1
phase: M4-M5
created: 2026-04-20
created_by_agent: Claude
owner: Agent1
status: open
type: tactic-module
related_cards:
  - SYS-SKILL-TAC-0001
  - SYS-SKILL-TAC-0002
  - SYS-SKILL-TAC-0003
  - SYS-SKILL-TAC-0004
  - SYS-SKILL-TAC-0005
depends:
  - SYS-SKILL-TAC-0001
  - SYS-SKILL-TAC-0002
  - SYS-SKILL-TAC-0003
  - SYS-SKILL-TAC-0004
runtime_scope:
  - G5-M4-EditorQA
  - G5-M5-RegressionQA
  - G6-3-SprintPlanning
smoke_route: "BattleScene Editor Preview → 8 條天賦戰法逐條自動觸發 → AI cadence 驗收 → smoke capture all tactics"
verification_commands:
  - npm run check:ts-syntax
  - npm test
  - curl.exe http://localhost:7456/asset-db/refresh
  - npm run check:encoding:touched
docs_backwritten:
  - docs/遊戲規格文件/系統規格書/戰法系統.md (doc_spec_0038) G-5-0-0 里程碑表
  - docs/遊戲規格文件/系統規格書/戰法系統.md (doc_spec_0038) G-6-3 Sprint 排入計畫
notes: "此卡負責 M4/M5 里程碑驗收交棒，以及把未進入首批可玩包的虎符/血統/教官戰法 family 依 G-6-3 排入後續 Sprint。對應 G-5-0-1 最後一項未勾 checklist 項目。"
---

# [SYS-SKILL-TAC-0006] 戰法量產驗收 Sprint 規劃（M4/M5 + G-6-3 後續排程）

## 背景

TAC-0001 ~ TAC-0005 已涵蓋所有 32 類戰法的模組包設計，但 G-5 里程碑 M4（Editor 實戰驗收）與 M5（量產回歸 QA）仍為「進行中」，且 G-5-0-1 最後一個未勾項「將未進入首批可玩包的戰法 family 依 G-6-3 持續排入後續 Sprint」缺乏明確執行卡。

本卡作為驗收交棒卡：
1. 追蹤 M4/M5 完成度
2. 為 G-1 虎符 12 條未開始戰法、G-2/G-3 進行中戰法建立 Sprint 排入決策清單
3. 成為後續新虎符/血統/教官戰法 family 的排程基準

## M4：Editor 內實戰驗收

> **驗收目標**：8 條天賦戰法都能由小兵在 Cocos Editor Preview 中自行觸發一次，並有正確的 VFX、傷害飄字與命中圈。

- [ ] `zhao-yun-pierce` (騎軍衝鋒) — 直線貫穿 + 傷害正確
- [ ] `sun-quan-tide` (長槍列陣) — 環帶 adjacent 觸發正確
- [ ] `guan-yu-slash` (箭雨齊發) — 扇形命中範圍正確
- [ ] `zhou-yu-inferno` (火計佈陣) — 目標格點燃正確
- [ ] `liu-bei-rally` (軍心鼓舞) — 全軍 Buff 掛載正確
- [ ] `zhang-fei-roar` (震軍怒喝) — 全敵暈眩控制正確
- [ ] `tactic-river-ambush` (水路伏擊) — 進格陷阱觸發正確
- [ ] `tactic-dragon-pierce` (龍魂突刺) — 直線衝刺命中正確

### M4 驗收門檻

- [ ] 8 條戰法均無需玩家點格，由 AI 自動完成選目標與施放。
- [ ] 每條戰法命中圈、VFX、傷害飄字與狀態提示在 Editor Preview 截圖可辨識。
- [ ] AI cadence 驗收：連續 3 回合自動施放不出現「完全不施放」或「每回合必放」兩種極端。

## M5：量產與回歸 Smoke QA

> **驗收目標**：battle skill smoke 從目前 47 pass 提升到覆蓋全部已落地戰法，並維持回歸零 regression。

### 現況

- smoke pass 數量：47（截至 2026-04-15）
- 已覆蓋：5 種來源 Adapter（SeedTactic / Bloodline / Mentor / SceneGambit / TigerTally）+ 初始庫 8 條 tacticSlots 完整鏈路

### 待補項目

- [ ] 為 TAC-0003 新落地位移/推擠戰法補 smoke
- [ ] 為 TAC-0004 新落地 TLINK/TCOUNTER/TRESET 戰法補 smoke
- [ ] 為 G-4 場景戰法 Editor capture 補 smoke
- [ ] 為 G-1 虎符戰法（現有 2 條已落地）補完整路徑 regression
- [ ] 確保 `manualTargeting: false` 的 auto-aim policy 在全量戰法中回歸通過

## G-6-3：後續 Sprint 排入計畫

依 `G-6-3` 優先序與模組包，為尚未進入首批可玩包的戰法 family 確認排程。

### Sprint 排程建議清單

#### 優先排入（連接現有骨架，工作量小）

| 戰法 | 來源 | 主模組 | 對應任務卡 | 建議 Sprint |
|---|---|---|---|---|
| 騎射合一 | 虎符 G-1 | TMOVE+TDIR+TCOND | TAC-0003 | Sprint N+1 |
| 精銳突擊 | 虎符 G-1 | TLINE+TMOVE | TAC-0001+TAC-0003 | Sprint N+1 |
| 毒箭 | 虎符 G-1 | TDEBUFF DOT | TAC-0002 | Sprint N+1 |
| 趙家槍法 | 血統 G-3 | TLINE 三段遞增 | TAC-0001 | Sprint N+1 |
| 單騎破陣 | 教官 G-2 | TBUFF+TCOND | TAC-0002 | Sprint N+1 |
| 醫療 | 教官 G-2 | THEAL | TAC-0002 | Sprint N+1 |
| 鼓舞 | 教官 G-2 | TBUFF | TAC-0002 | Sprint N+1 |
| 緩速 | 教官 G-2 | TDEBUFF | TAC-0002 | Sprint N+1 |

#### 次優先排入（需要棋盤/反應系統基礎穩定）

| 戰法 | 來源 | 主模組 | 對應任務卡 | 建議 Sprint |
|---|---|---|---|---|
| 長坂雄咆 | 虎符 G-1 | TFAN+TPUSH+TDEBUFF | TAC-0001+TAC-0003 | Sprint N+2 |
| 無雙亂舞 | 虎符 G-1 | TFAN+TPUSH | TAC-0001+TAC-0003 | Sprint N+2 |
| 火計連環 | 虎符 G-1 | TTILE+TLINK+TCOND | TAC-0003+TAC-0004 | Sprint N+2 |
| 火神狩獵 | 虎符 G-1 | TPUSH+TTILE | TAC-0003 | Sprint N+2 |
| 八陣圖 | 教官 G-2 | TTILE+TBUFF | TAC-0002+TAC-0003 | Sprint N+2 |
| 空城計 | 教官 G-2 | TPUSH+TCOND | TAC-0003+TAC-0004 | Sprint N+2 |

#### 後排入（條件最複雜，需 P2 reaction 系統完整）

| 戰法 | 來源 | 主模組 | 對應任務卡 | 建議 Sprint |
|---|---|---|---|---|
| 七進七出 | 虎符 G-1 | TMOVE+TSTEALTH | TAC-0003+TAC-0004 | Sprint N+3 |
| 威震華夏 | 虎符 G-1 | TDIR+TRESET+TCOND | TAC-0001+TAC-0004 | Sprint N+3 |
| 幼麒天算 | 虎符 G-1 | TCOUNTER+TDIR+TDEBUFF | TAC-0002+TAC-0004 | Sprint N+3 |
| 連環計 | 虎符 G-1 | TLINK+TDIR | TAC-0001+TAC-0004 | Sprint N+3 |
| 結姻連射 | 虎符 G-1 | TDIR+TCOND | TAC-0001+TAC-0004 | Sprint N+3 |

## 驗收條件

### A. M4 驗收標準

- [ ] 8 條天賦戰法在 Editor Preview 中各觸發至少一次，截圖留存於 `artifacts/ui-source/battle-scene/review/`。
- [ ] AI cadence 在連續 5 回合 preview 中施放頻率符合設計意圖（不全放不全不放）。

### B. M5 驗收標準

- [ ] battle skill smoke pass 數從 47 提升，覆蓋所有已落地戰法。
- [ ] `manualTargeting: false` regression suite 零 failure。
- [ ] `generate-general-tactics.js` 確認 231+/235 武將帶有至少 1 條天賦戰法。

### C. G-6-3 Sprint 排入標準

- [ ] 本卡完成後，「優先排入」8 條戰法已有對應的子任務或 notes 更新回寫到 TAC-0001/0002/0003 卡。
- [ ] 後續新虎符戰法必須掛回 TAC-0001~TAC-0005 既有 family，不可新開 family 卡。

## DoD 結案檢查清單

- [ ] G-5-0-1 最後一項「將未進入首批可玩包的戰法 family 依 G-6-3 持續排入後續 Sprint」已有明確排程。
- [ ] G-5 M4 8 條戰法 Editor 驗收截圖已存入 artifacts。
- [ ] G-5 M5 smoke pass 數已更新並回寫到 `docs/遊戲規格文件/系統規格書/戰法系統.md` G-5-0-0 里程碑表。
- [ ] Sprint 排程建議已被 owner 確認並回寫到 G-9 / G-10 表格。
