# UI-1-0016 Artifact README

這個資料夾是 `UI-1-0016 / D-3` 的 QA 交付位置。

## 目的

驗證 `duel-challenge` 畫面中的 mixed-family 語意分層是否成立：

1. `reject = paper.utility`
2. `accept = equipment.primary`
3. 玩家不看文字也能感受到操作權重差異

## 對應資產

- preview host: `assets/scenes/LoadingScene.scene` → root `LoadingScene` 元件 → `previewMode=true` → `previewTarget=DuelChallenge`
- screen: `assets/resources/ui-spec/screens/duel-challenge-screen.json`
- layout: `duel-challenge-main`
- skin: `assets/resources/ui-spec/skins/duel-challenge-default.json`

## 預期檔案

- `duel-challenge-phone-16-9.png`
- `duel-challenge-phone-19_5-9.png`
- `notes.md`

## 目前狀態

- `UI-2-0018` 已完成，D-3 不再被 preview host 阻塞。
- 後續正式截圖統一從 `LoadingScene.scene` 進入，不再借用 legacy `DuelChallengePanel.ts`。
