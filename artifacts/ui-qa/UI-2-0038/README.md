# UI-2-0038 QA Artifact README

這個資料夾收斂 `UI-2-0038` 的 BattleHUD portrait 裁片研究，目的不是直接交付 runtime 資產，而是先建立可回查的 QA 證據與生圖規格。

## 內容

- `notes.md`
  - 本輪分析紀錄與 blocker
- `portrait-family-spec.md`
  - A2 HUD 頭像裁片 family 的尺寸、構圖、badge、prompt DNA
- `agent1-generation-brief.md`
  - 可直接交給 Agent1 的生圖需求
- `ref-hud-portrait-sample.png`
  - 參考圖中的 HUD 頭像樣本
- `current-zhang-fei-portrait.png`
  - 專案目前的張飛完整 portrait 原圖
- `current-player-placeholder.png`
  - 專案目前的 BattleHUD placeholder

## 用途

- 幫助理解為什麼現有完整 portrait 不能直接塞進 `64x64` HUD slot
- 讓後續生圖時能直接沿著既定 family 規格走
- 讓 Agent1 / human QA 能回到同一份參考證據，不必重新找圖
