# `crest` family 說明

這個資料夾存放 `GeneralDetailBloodlineV3` 命紋徽章所使用的圖像資產。

## 目前結構

- `proof/dragon_medallion_face_v1.png`

## 使用原則

- `proof/` 只放 proof 與 compare 階段可替換的命紋 face。
- runtime 應透過 `gdv3.bloodline.crest.face` 或 content contract 指向資產，不要把字形 glyph 直接硬寫成最終方案。
- 如果未來有正式命紋美術，只需替換 face 資產路徑，不需重構 layout 與 shell。

Unity 對照：
- 這相當於把 `crest medallion` 做成可換材質 / 可換貼圖的 Prefab 插槽，而不是把圖案和結構寫死在同一層。
