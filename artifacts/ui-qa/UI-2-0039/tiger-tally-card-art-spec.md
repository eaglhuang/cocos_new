# UI-2-0039 TigerTally Card Art Spec

## 主語言

- `asset_family`: `A4-tactical-diorama-card`
- `presentation_role`: `tiger-tally-card-art`
- `value_signal`: `collectible-mid-to-high`
- `background_tone`: `dark-battlefield`
- `size_set`: `512,256,128`

## 次語言

- `asset_family`: `A5-hero-panel-card`
- 只用於明確角色主題卡，不作為 TigerTally 全系統預設

## 為什麼 TigerTally 先走 A4

- TigerTally 更像戰術卡，不是角色立繪卡
- `A4` 可自然呈現：
  - 城樓
  - 關卡
  - 行軍線
  - 要地
  - 防禦設施
- 放回 card slot 時，`A4` 的縮圖辨識度比角色半身更穩

## A4 具體規格

### 構圖

- 俯視或 3/4 俯視的戰場 / 城樓 / 要地主體
- 主體占畫面 55%~70%
- 至少保留一個清楚 silhouette
- 避免太多小兵小物件，縮到 `128` 仍要讀得出主題

### 材質

- 深色 battlefield 底
- 金屬 / 木構 / 石牆 / 地圖紋理可混合
- 避免過亮現代 UI 發光感

### 色彩

- 主色仍維持：
  - `battle-light`
  - `cta-gold` 僅作高價值邊緣或稀有點綴
- 不應大面積使用 `danger-red`

### 與 badge / rarity 的關係

- 稀有度與 type badge 不畫進 card art 本體
- card art 保持主體閱讀，badge 交由 runtime 疊加

## A5 使用條件

只有在以下情況才改走 `A5-hero-panel-card`：

- 卡片主題明確屬於特定武將
- 玩家預期先看到角色，再看地點
- 畫面需要強角色收藏感，而非戰術辨識

## QA 要求

- 必做 `A4` 與 `A5` 對照稿
- 必做 `256 / 128` compare
- 必回放到 TigerTally card slot 檢查：
  - silhouette
  - 縮圖辨識
  - 與 rarity border / type badge 的共存性
