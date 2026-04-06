# Story Strip Compare Input v1

這份輸入清單提供 `UI-2-0087` compare board 使用，固定 story strip review 時要放在同一個板上的基準素材，避免每次憑印象比對。

## Compare Board 必備欄位

1. 正確 UI 參考圖
2. AI 原始輸出
3. strip proof v1
4. strip proof v2 adaptive
5. runtime 預覽截圖
6. 文字備註

## 本次比較素材

正確 UI 參考圖
- `docs/UI品質參考圖/UI-2-0054_人物頁與血脈命鏡/06_日常人物頁_v3_正確參考.png`

AI 原始輸出
- `C:/Users/User/Downloads/Gemini_Generated_Image_tvltx7tvltx7tvlt.png`

strip proof v1
- `assets/resources/sprites/ui_families/general_detail/story_strip/proof/zhangfei_story_strip_master_v1.png`

strip proof v2 adaptive
- `assets/resources/sprites/ui_families/general_detail/story_strip/proof/zhangfei_story_strip_master_v2_adaptive.png`

runtime 預覽
- `artifacts/ui-qa/UI-2-0059/preview-compare-2026-04-05-v23-zhangfei-proof-strip-fixmeta/GeneralDetailOverview.png`
- `artifacts/ui-qa/UI-2-0059/preview-compare-2026-04-05-v24-zhangfei-proof-strip-adaptive/GeneralDetailOverview.png`
- `artifacts/ui-qa/UI-2-0059/preview-compare-2026-04-05-v25-route-debug/GeneralDetailOverview.png`
- `artifacts/ui-qa/UI-2-0059/preview-compare-2026-04-05-v26-recipe-rebuilt/GeneralDetailOverview.png`

## 本次比較結論

- AI 原始輸出雖然已經改成單張大圖，但仍偏一般插畫海報構圖，不是 UI story strip 載體優先的構圖。
- strip proof v1 的主要問題是頭部裁切太高，重要主體容易被切掉。
- strip proof v2 adaptive 已可保住張飛頭部、馬頭與主要武器輪廓，適合作為目前的 proof strip。
- `v24` 截圖曾退回 LobbyMain，不能作為 runtime 視覺判斷基準。
- `v25` 與 `v26` 已恢復真實人物頁路徑，其中 `v26` 是經過 `ArtRecipe -> build-story-strip-proof.ps1 -> asset-db refresh -> capture-ui-screens` 的可重現結果，可作為目前正式 runtime 基準。
