# UI-2-0051 Screen-Context QA Spec

## 核心原則

不能只看單張 PNG 就判定完成。所有量產圖至少要經過三層 QA：

1. `reference board`
2. `compare board`
3. `screen-context placement`

## Reference Board

內容
- 參考圖裁切
- family 標註
- 色票角色
- 成功案例與失敗案例

## Compare Board

內容
- 參考圖
- 候選稿 v1 / v2 / v3
- 縮圖版 `64 / 32`
- 評語：保留 / 淘汰原因

## Screen-Context Placement

內容
- 把候選稿放回真實畫面
- 至少驗：
  - 深底
  - 淺底
  - 真實 HUD / panel / cell

## 最低驗收流程

### Icon

1. 單張原尺寸
2. `64 / 32` compare board
3. 放回真實畫面

### Portrait

1. crop proof
2. `64 / 32` compare
3. badge safe-zone 檢查

### Card / Container / Torso

1. silhouette 檢查
2. `256 / 128` compare
3. 放回對應 panel / reward screen

## 常見失敗點

- 只有單張圖，沒有 compare board
- compare 只看灰底，不放回真實畫面
- 不做 `32px` 驗證就直接定稿
