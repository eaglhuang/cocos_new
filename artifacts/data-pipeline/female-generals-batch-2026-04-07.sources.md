# Female Generals Batch 2026-04-07

## Source Basis

Primary stat source:
- `xgodgame` 攻略頁：<https://r.jina.ai/http://xgodgame.blogspot.com/2020/01/14100020.html>
- 用途：採 `統 / 武 / 智 / 政 / 魅` 五維，映射為 `lea / str / int / pol / cha`

Mapping rules used in this batch:
- `rarityTier`: 依專案 `rarity-thresholds.json` 的雙軸規則計算
- `ep`: `round(avg5 * 0.8 + maxStat * 0.2)`
- `epRating`: 依 `general-balance-tuner` skill 建議門檻換算
- `historicalAnecdote` / `bloodlineRumor` / `storyStripCells`: AI 依人物常識與常見敘事形象補寫，非原始攻略頁內容

## Imported Set

| 名稱 | 來源列名 | 原始五維（統/武/智/政/魅） | 匯入 faction | 匯入 rarity | 備註 |
|---|---|---:|---|---|---|
| 貂蟬 | 貂蟬 | 20 / 26 / 81 / 65 / 95 | `qun` | `legendary` | 傾國型角色，故事採長安連環計路線 |
| 大喬 | 大喬 | 18 / 12 / 73 / 69 / 92 | `wu` | `legendary` | 以江東宗族穩定角色處理 |
| 小喬 | 小喬 | 17 / 13 / 74 / 68 / 92 | `wu` | `legendary` | 以周瑜水戰幕後支點處理 |
| 甄姬 | 甄氏 | 15 / 7 / 72 / 66 / 90 | `wei` | `epic` | 匯入名用通俗稱呼 `甄姬` |
| 孫尚香 | 孫尚香 | 67 / 70 / 57 / 56 / 80 | `wu` | `epic` | 武裝宗室女性，保留弓系戰法形象 |
| 蔡琰 | 蔡琰 | 12 / 11 / 76 / 80 / 85 | `qun` | `epic` | 通俗別名蔡文姬，可後補 alias |
| 黃月英 | 黃月英 | 37 / 28 / 88 / 77 / 70 | `shu` | `epic` | 機巧 / 發明向角色 |
| 張春華 | 張春華 | 40 / 28 / 79 / 69 / 62 | `wei` | `rare` | 以司馬家早期內政核心處理 |
| 辛憲英 | 辛憲英 | 35 / 27 / 83 / 73 / 71 | `wei` | `epic` | 偏先見型 / 勸戒型角色 |
| 步練師 | 步練師 | 17 / 10 / 64 / 68 / 87 | `wu` | `epic` | 宮廷穩定與德行向角色 |
| 呂玲綺 | 呂玲綺 | 69 / 74 / 37 / 18 / 52 | `qun` | `rare` | 衍生形象，建議與史實池分開審核 |
| 馬雲騄 | 馬雲騄 | 70 / 73 / 39 / 32 / 61 | `shu` | `rare` | 衍生形象，本批次暫歸蜀系 |
| 關銀屏 | 關銀屏 | 71 / 72 / 39 / 48 / 70 | `shu` | `rare` | 衍生形象，但知名度高 |

## Review Notes

- 這批資料目前是 `staged import`，目標是先讓你在編輯器或 diff 審核時有完整可讀內容。
- 若要正式併入 `assets/resources/data/generals.json`，建議下一步補三件事：
  1. 決定衍生角色是否與史實角色混池
  2. 補 `troopAptitude / terrainAptitude / weatherAptitude`
  3. 為 `甄姬 / 蔡琰` 類角色加 alias 或 editor search key
