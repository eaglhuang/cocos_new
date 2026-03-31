# UI-1-0015 QA Notes

## 任務資訊
- task_id: `UI-1-0015`
- legacy_id: `D-2`
- preview_host: `assets/scenes/LoadingScene.scene` -> root `LoadingScene` -> `previewMode=true` -> `previewTarget=ShopMain / Gacha`
- semantic_target: `common-parchment / light-surface carrier consistency`
- shop_screen: `shop-main-screen`
- shop_layout: `shop-main-main`
- shop_skin: `shop-main-default`
- gacha_screen: `gacha-main-screen`
- gacha_layout: `gacha-preview-main`
- gacha_skin: `gacha-default`

## Capture Log
- capture_time: `2026-03-31`
- captured_by: `Codex`
- editor_status: `http://localhost:7456` reachable
- preview_host_ready: `yes`
- semantic_target_ready: `yes`
- artifacts:
  - `artifacts/ui-qa/UI-2-0023/ShopMain.png`
  - `artifacts/ui-qa/UI-2-0023/Gacha.png`

## 目前判定
- status: `active-qa`
- blocker: `none`
- follow_up: `人工比對 shop 與 gacha 的 light-surface carrier 層次、紙張噪點感、文字對比與 CTA 互相搶焦問題`

## 比對重點
- `shop-main` 的 `MainContainer` 是否維持 parchment light-surface 的主承載感。
- `gacha` 的 `PityInfoBar` 是否能作為有效的 light-surface carrier QA anchor。
- 兩者在深色背景上是否同樣保有清楚的明暗分層，而不是只剩單塊淺色板。
- 文字在 light-surface 上的可讀性是否一致，尤其是金色與綠色資訊字。

## 結論欄位
- comparison_result: `pending-human-review`
- human_review: `pending`
- notes: `headless capture 已就緒，等待 Agent2 / human 進一步回填視覺比較結論。`
