# `story_strip` 使用說明

這個資料夾存放 `GeneralDetailBloodlineV3` 底部故事帶所使用的圖片資產。

## 目標結構

- 視覺載體採用「一張 master art 長條圖 + 六個 overlay slot」。
- 六個語意槽位維持不變：
  - `origin`
  - `faction`
  - `role`
  - `awakening`
  - `bloodline`
  - `future`

Unity 對照：
- 這比較像一個 `StoryStrip Prefab family`，底圖是一張共用長卷，六個事件點是上層 metadata / hotspot，而不是六張各自獨立的卡片 Prefab。

## proof 與正式資產

- `proof/` 只放 proof、compare、裁切驗證用資產。
- `proof/` 內的素材不能直接視為最終商業美術。
- 目前 proof strip：
  - `proof/zhangfei_story_strip_master_v1.png`
  - `proof/zhangfei_story_strip_master_v2_adaptive.png`

## 重跑 proof strip

請以 `ArtRecipe` 為唯一入口，不要手工直接覆蓋 proof 圖：

```powershell
powershell -ExecutionPolicy Bypass -File tools_node/build-story-strip-proof.ps1 `
  -Recipe artifacts/ui-source/ai-recipes/story-strip-horizontal-scroll-r1.art-recipe.json
```

這條流程會：
- 讀取 `sourceImagePath`
- 套用 `cropRecipe`
- 產出 proof strip 到 `outputAssetPath`

之後再執行：

```powershell
curl.exe http://localhost:7456/asset-db/refresh
node tools_node/capture-ui-screens.js --target GeneralDetailOverview --outDir <輸出資料夾>
```

## 規則

- 預設禁止正臉特寫。
- 優先半身、背影、側身、剪影、武器與旗幟辨識。
- 如果沒有專案內正式 reference / LoRA，故事帶資產一律標記為 `proof-only`。
- 不要把六格故事帶做成六張獨立海報拼接。
