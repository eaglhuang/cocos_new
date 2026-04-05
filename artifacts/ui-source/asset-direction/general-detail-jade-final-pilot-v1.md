# GeneralDetail Jade Final Pilot v1

對應任務：
- `UI-2-0089` ArtRecipe
- `UI-2-0091` Asset Direction
- `UI-2-0092` Agent1 正式切圖

## 目標

為 `GeneralDetailBloodlineV3` 建立第一批正式可重用 family 資產方向，避免 proof 感殘留在正式頁面。

這一批只做三個 family：

1. `jade-parchment-panel-final`
2. `crest-medallion-final`
3. `jade-rarity-badge-final`

## 整體美術方向

- 主氣質：青綠玉飾 + 淺羊皮紙 + 低彩金屬邊飾
- 不要：厚重黑金、紫色獨立 badge、過深陰影黑塊
- 參考用途：人物日常介紹 v3 的正式框體，而不是戰鬥 HUD 或黑金奇幻框

Unity 對照：
- 這一批相當於把 `GeneralDetail` 的共用 Prefab kit，從暫時拼裝的 placeholder theme，升級成正式可重用的 Theme / Sprite family。

## Family 1: jade-parchment-panel-final

### 必要輸出

- `header_band`
- `header_cap_left`
- `header_cap_right`
- `body_frame_9slice`
- `body_fill_tile`
- `paper_noise_overlay`
- `inner_shadow_overlay`

### 視覺要求

- header 玉件要與 body frame 屬於同一套視覺語言
- 玉色偏青綠，不偏藍紫
- 羊皮紙底不可過白，要有自然暖灰與紙纖維感
- 9-slice 只拉中段，不可破壞角飾與 header cap

### slot 對照

- `gdv3.header.band`
- `gdv3.header.capLeft`
- `gdv3.header.capRight`
- `gdv3.info.frame`
- `gdv3.info.fill`
- `gdv3.info.noise`
- `gdv3.info.innerShadow`

## Family 2: crest-medallion-final

### 必要輸出

- `medallion_ring`
- `medallion_face`
- `glyph_safe_mask`
- `soft_shadow`
- `jade_inner_ring`

### 視覺要求

- 不可再出現黑色方塊陰影
- ring / face / inner ring 必須能與 jade header 同族
- face 可容納命紋圖騰或 glyph，但不應綁死單一角色
- 稀有度 tint 只能作加成，不可蓋掉原本紋理

### slot 對照

- `gdv3.crest.shadow`
- `gdv3.crest.ring`
- `gdv3.crest.innerRing`
- `gdv3.crest.face`
- `gdv3.crest.glow`

## Family 3: jade-rarity-badge-final

### 必要輸出

- `badge_common`
- `badge_rare`
- `badge_epic`
- `badge_legendary`

### 視覺要求

- 與 jade/parchment family 同語言
- 不可回到獨立紫色膠感 badge
- 要像 UI 系統的一部分，不像外掛商店貼紙

### slot 對照

- `gdv3.rarity.badge.common`
- `gdv3.rarity.badge.rare`
- `gdv3.rarity.badge.epic`
- `gdv3.rarity.badge.legendary`

## 交付規則

- 原始生成圖與工作檔放 `artifacts/ui-source/`
- proof 不可直接進 final 路徑
- runtime 正式引用應以 `final` family 為主

## 驗證

```bash
node tools_node/capture-ui-screens.js --target GeneralDetailOverview --outDir artifacts/ui-qa/UI-2-0092
```

通過條件：
- 右側主框不再有 proof 拼裝感
- 右下 crest 不再像黑塊或暫時裁圖
- rarity badge 與 jade/parchment 不打架
