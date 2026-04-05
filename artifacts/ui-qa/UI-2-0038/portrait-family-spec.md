# UI-2-0038 Portrait Family Spec

## Family 定位

- Family：`A2 HUD 頭像裁片 family`
- 使用場景：
  - `battle-hud-main` 的 `hud.portrait.player`
  - `battle-hud-main` 的 `hud.portrait.enemy`
  - 後續可延伸到 `general-quickview` 的小尺寸 portrait

## 參考結論

參考圖中的 HUD 頭像不是「完整角色圖縮小」，而是為 HUD 重新裁出的頭部裁片。它有三個關鍵：

1. 臉部永遠是第一閱讀重點。
2. 肩線或盔甲只保留少量，用來提供職業/陣營識別。
3. 左下或右下預留一個小 badge 落點，不與五官打架。

## 構圖規則

### 裁切比例

- 產出母圖建議：`512x512`
- 最終運行尺寸：`64x64`
- 測試縮圖尺寸：
  - `64x64`
  - `32x32`
  - `24x24`

### 頭部佔比

- 臉部寬度佔畫面 `40%~52%`
- 頭頂到下巴佔畫面高度 `48%~62%`
- 肩線可進畫面，但胸口不得超過畫面高度 `35%`

### 視線方向

- 玩家側可偏向右前 `10~20` 度
- 敵方側可偏向左前 `10~20` 度
- 不可完全側臉
- 眼睛不可被陰影蓋住

### 禁止事項

- 不要保留武器全長
- 不要保留底座、地面、岩石
- 不要把披風佔比做太大
- 不要用大面積亮背景破壞 HUD 對比

## 背景與材質

- 背景優先透明或深色壓暗背景
- 若需要環境氛圍，只能保留極低對比的深色輪廓
- 整體材質應偏寫實、帶金屬與布料層次，不可卡通化

## Badge 疊加規則

- badge 視為外掛層，不是頭像本體的一部分
- badge 落點預設：
  - 玩家側：左下
  - 敵方側：右下
- badge 安全區至少保留 `18x18`
- 重要五官、眉眼、鼻樑不可進 badge 區

## 輪廓要求

- 縮到 `32x32` 時仍要看得出：
  - 臉部方向
  - 髮型/頭盔/頭巾
  - 一個最強識別配件
- 不依賴細碎花紋當主識別

## Prompt DNA

### 正向描述

`three kingdoms warrior head-and-shoulders crop, battle hud portrait, realistic painted armor, strong facial readability, compact shoulder silhouette, dark transparent background, reserved badge corner, readable at 64x64 and 32x32, no full-body framing`

### 負向描述

`full body, long weapon, large background scenery, toy-like shading, chibi proportions, washed out face, side profile, covered eyes, heavy bloom, tiny head, cluttered lower corner`

## 驗收清單

- `64x64` 看得出角色是誰
- `32x32` 還能分辨主頭飾/臉型
- badge 疊上去不遮眼鼻口
- 背景不會搶過 topbar 文字
- 玩家與敵方兩側都能做鏡像配置
