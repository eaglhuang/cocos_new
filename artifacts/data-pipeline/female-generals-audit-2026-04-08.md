# 女性角色審校報告 2026-04-08

## 範圍
- 已匯入審校對象：17 位
- 依據：`rarity-thresholds.json` 的雙軸 tier 規則、`classify-generals-master.js` 的 EP/分類公式、以及現有 aptitudes 分布

## 總結
- 可直接維持現狀：孫尚香、黃月英、辛憲英、卞夫人
- 強烈建議人工複核：步練師、樊氏、大喬、小喬、董白
- 系統層 blocker：`terrainAptitude` 在 master 資料實際使用 `RIVER`，但 `GeneralDetailPanel` 目前顯示邏輯用的是 `WATER`；這會讓水域適性在 UI 顯示端出現落差

## 規則基準
- rarityTier：`maxStat` 與 `avg5` 取較高 tier
- 門檻：`95/80/65` 與 `80/65/50`
- EP 基準：`round(avg5 * 0.8 + maxStat * 0.2)`
- auto-category：若 `maxStat >= 80` 且 tier 至少 `epic`，傾向 `famed`

## 主要發現

### 1. 步練師
- 現況：`epic / general`，`maxStat=87`，`avg5=49.2`，`ep=57`
- 問題：若依專案自動分類邏輯，這筆更接近 `famed`，目前 `general` 類別偏保守
- 建議：把 `characterCategory` 改成 `famed`，或至少在 notes 裡標明這是刻意壓低戲劇化標籤的版本

### 2. 樊氏
- 現況：`rare / general`，`maxStat=65`，`avg5=42.0`，`ep=47`
- 問題：`troopTop / terrainTop / weatherTop` 全為 `0`，跟 rare 檔通常至少 1 個 A/S 焦點不太一致
- 建議：二選一
  - 保留 rare，但補一個明確 niche，例如 `PLAIN:A` 或 `SUNNY:A`
  - 若要維持現在的適性弱度，降成 `common` 會更乾淨

### 3. 大喬 / 小喬
- 現況：兩者數值幾乎鏡像，故事語氣與 aptitudes 也高度對稱
- 問題：同池並存時，角色辨識會太依賴名字與立繪，玩法和文案辨識度不足
- 建議：至少拆一軸
  - 大喬偏穩定支援／家門安定
  - 小喬偏樂奏／江東軍府節奏

### 4. 董白
- 現況：`common / general`，`maxStat=57`，`avg5=31.6`，`ep=37`
- 問題：機制上完全合理，但在目前女性 roster 裡顯得過低，若被放進同一收藏池會像素材角
- 建議：先做產品定位確認
  - 若她就是低稀有填池角，維持不動
  - 若希望她是可用角色，至少要補一個明確的干擾或內政 niche

### 5. 貂蟬
- 現況：`legendary / famed`，`maxStat=95`，`avg5=57.4`，`ep=65`
- 問題：她的 legendary 幾乎完全由 `cha=95` 單軸撐起，這跟專案門檻一致，但屬於高度偏科 legendary
- 建議：不用立刻改。如果之後設計想壓低「魅力單軸直升 SSR」的比例，再回頭調 thresholds，不要單改她一人

### 6. 關銀屏 / 呂玲綺 / 馬雲騄
- 現況：三位都落在 `rare` 區間，數值與 EP 大致合理
- 問題：她們在玩家心中的知名度通常高於純數值 tier，容易被期待有更高收藏感
- 建議：這是設計哲學題，不是資料錯。若專案要「以史料/數值為準」，現況可接受；若要兼顧三國遊戲品牌辨識，至少應在別名、story 或技能定位上做更強的個性化

### 7. 文案風格一致性
- 現況：第一、二批的 `bloodlineRumor` 普遍偏神祕化處理，對於后妃與名門女性也使用了較多「異象／預兆」語彙
- 風險：若後續產品希望正史感更重，董白、樊氏、大喬、小喬這類人物會最先顯得 AI 痕跡偏重
- 建議：保留 `historicalAnecdote`，優先人工淡化 `bloodlineRumor` 裡過於玄的句子

## 可先不動的項目
- 孫尚香：數值、tier、aptitude 焦點都清楚
- 黃月英：工程/器械 niche 很完整
- 辛憲英：智略支援定位成立
- 卞夫人：雖非戰鬥型，但 `epic / famed` 與現有故事調性一致

## 併批前備註
- 第三批匯入若沿用現行 master 格式，`terrainAptitude` 應繼續使用 `RIVER`
- 若要讓 UI 顯示完全一致，後續需統一 `RIVER/WATER` canonical key