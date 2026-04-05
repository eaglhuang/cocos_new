# Agent1 Generation Brief: UI-2-0038 BattleHUD Portrait Crop

## 任務目的

依 `UI-2-0038` 的 `A2 HUD 頭像裁片 family`，先做一組 BattleHUD portrait crop proof，驗證這套頭像語言是否能在 `64x64` 與 `32x32` 站得住。

## 目標 family

- `A2 HUD 頭像裁片 family`

## 首批建議角色

- `zhang-fei`
- `zhao-yun`

理由：

- 張飛適合驗證高對比頭巾 / 鬍鬚 / 盔甲是否容易讀
- 趙雲適合驗證較年輕臉型與頭盔輪廓是否容易讀

## 產出要求

### 輸出檔

- `battlehud_portrait_zhang_fei_v1a.png`
- `battlehud_portrait_zhang_fei_v1b.png`
- `battlehud_portrait_zhao_yun_v1a.png`
- `battlehud_portrait_zhao_yun_v1b.png`

### 尺寸

- 母圖：`512x512`
- 驗收縮圖：
  - `64x64`
  - `32x32`

### 構圖

- 頭部 + 肩線
- 不可出現全身
- 不可保留長兵器全長
- 左下角需能讓出 badge 區

### 視覺語言

- 偏寫實三國武將
- 臉部辨識優先
- 金屬盔甲與布料細節可見，但不能搶過臉
- 背景透明或近黑低對比

## Prompt 建議

### Base prompt

`three kingdoms warrior head-and-shoulders crop for battle hud portrait, realistic painted armor, strong face readability, compact silhouette, dark transparent background, badge-safe lower corner, readable at 64x64, no full-body framing`

### Negative prompt

`full body, wide landscape, long weapon dominating frame, tiny head, side profile, hidden eyes, busy background, toy style, chibi, low contrast face, cluttered lower corner`

## 驗收標準

- `64x64` 時臉與主配件都清楚
- `32x32` 時仍能快速分辨角色不是 placeholder
- 左下角可疊 F7 小 badge
- 不會像卡面或立繪，而是明顯的 HUD crop

## 回寫位置

- QA 請回寫到 `artifacts/ui-qa/UI-2-0038/notes.md`
- 任務追蹤請更新 `docs/agent-briefs/tasks/UI-2-0043.md`
