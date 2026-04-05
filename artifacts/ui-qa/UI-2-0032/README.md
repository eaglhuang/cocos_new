# UI-2-0032 QA Artifact README

這個資料夾保存 `UI-2-0032` 的 BattleScene icon v2 品質修正依據。

## 內容

- `baseline-compare-board.png`
  - 沿用 `UI-2-0028` 的 baseline 比較板，作為 v2 refinement 的起點。
- `agent1-generation-brief.md`
  - 交給 Agent1 的生圖規格包，包含 family、carrier、配色、尺寸驗收與 prompt/negative prompt。
- `notes.md`
  - 這一輪的品質判斷、需要改善的視覺差異，以及下一步 refine 方向。

## 用法

1. 先看 `baseline-compare-board.png`，確認 v1 baseline 和參考圖的差距。
2. 再看 `agent1-generation-brief.md`，直接取得可交給 Agent1 的生圖方向。
3. 最後看 `notes.md`，掌握這輪 v2 的 QA 判斷。
4. 後續產出的 `v2` 候選稿，直接放在同一個資料夾續寫比較。
