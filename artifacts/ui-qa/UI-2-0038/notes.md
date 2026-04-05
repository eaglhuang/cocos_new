# Visual QA Notes: UI-2-0038 BattleHUD Portrait Crop

## 任務狀態

- 任務卡：`UI-2-0038`
- 狀態：`IN PROGRESS`

## 本輪結論

- BattleHUD 的 portrait slot 是 `64x64`，實際縮到戰場 HUD 後會接近 `24~32px` 視覺辨識壓力。
- 目前 `sprites/generals/*_portrait.png` 是完整角色立繪，不適合直接塞進 HUD slot。
- 參考圖中的 HUD 頭像是「頭部主導 + 肩線 + 小 badge + 深底裁片」，不是完整半身卡圖。
- 因此 `UI-2-0038` 的重點不是再找 portrait 資產，而是把完整 portrait 轉成一套可量產的 HUD crop 規格。

## 本輪驗證

- 比對 `battle-hud-main.json` 確認 portrait slot 為 `64x64`
- 比對 `battle-hud-default.json` 確認目前仍是 placeholder
- 已將參考圖、現況立繪、placeholder 複製到本資料夾

## 本輪變更

- 建立 `portrait-family-spec.md`
- 建立 `agent1-generation-brief.md`
- 整理 QA 參考素材：
  - `ref-hud-portrait-sample.png`
  - `current-zhang-fei-portrait.png`
  - `current-player-placeholder.png`

## 阻塞

- 待 Agent1 依 `UI-2-0043` 產出首批 crop proof
