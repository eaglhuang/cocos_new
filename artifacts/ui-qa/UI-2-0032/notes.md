# Visual QA Notes: UI-2-0032 Icon v2

## 基本資料

- 任務：`UI-2-0032`
- 基線：`UI-2-0032/baseline-compare-board.png`
- 比對來源：`docs/UI品質參考圖/`
- 狀態：🟡 IN PROGRESS

## 目前判斷

這張卡不是重新發明 icon 語言，而是把 `UI-2-0028` 的可量產基線，往參考圖那種更成熟的正式 UI 質感推進一階。

## v2 重點

1. carrier 不要太像乾淨圓章，優先往厚邊、舊幣感或較有重量的徽章語言靠攏。
2. 主 glyph 要更粗、更集中，避免 32x32 時交叉槍柄變成細線雜訊。
3. 減少過亮的藍 / 紅，增加舊金、灰藍、暗紅與做舊噪點。
4. 補齊邊緣磨耗、內陰影與微弱不均勻感，讓它更接近參考圖的手工感。
5. v2 成品要能直接放回 `artifacts/ui-qa/UI-2-0032/` 做下一輪對照。

## 下一步

- Agent2 已完成 `agent1-generation-brief.md`，可直接交給 Agent1 生圖。
- Agent1 先產出至少 3 個 v2 方向（`v2a/v2b/v2c`）。
- 每個方向至少回收 `128 / 64 / 32` 三尺寸預覽。
- 若仍有明顯差距，再把 carrier 與 glyph 再拆成單獨 refinement 子卡。

## 更新
- 2026-04-06 | 任務轉為 QA 選型；以 BattleScene 真場景 / compare board 檢視 v2a/v2b/v2c。

