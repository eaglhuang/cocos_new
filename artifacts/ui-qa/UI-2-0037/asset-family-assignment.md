# UI-2-0037 Asset Family Assignment

## 已開立需求單 × 非 icon family 指派

| 任務卡 | 建議 family | 指派結論 |
|---|---|---|
| `UI-2-0029` 戰場 Portrait | `A2 HUD 頭像裁片 family` 為主；若未來戰前詳情放大則可借 `A5 主將半身 panel family` | BattleHUD 現在最需要的是可裁成 64x64 的頭像裁片語言，不是完整半身立繪。 |
| `UI-2-0030` TigerTally Card Art / Badge | `A4 城樓/建築 diorama card family`、`A5 主將半身 panel family`、`A15 獎勵容器 family` 供後續選型參考 | 若 TigerTally 想走部隊/據點卡面，可參考 A4；若走名將主題卡面，可參考 A5；若抽取外包裝與獎勵揭示，則參考 A15。 |
| `UI-2-0027` 圖像資產總表 | `A2`、`A4`、`A5`、`A13`、`A14`、`A15`、`A16` | 總表不應只追 icon；新圖證明量產需求至少還有 portrait、card art、prop pack、container、outfit 五大類。 |

## UI 規格情境 × 非 icon family 指派

| 規格情境 | 建議 family | 理由 |
|---|---|---|
| `主戰場UI規格書` 主將 / 敵將肖像資訊 | `A2` | 戰場資訊條需要可裁切的頭像與旁掛 badge。 |
| `主戰場UI規格書` 虎符卡片 / 左側卡列 | `A4` 或 `A5` | 若卡面主體是據點/部隊場景走 A4；若是主將半身或部隊代表人物走 A5。 |
| `UI 規格書` 劇情章節 / 勢力選章 | `A6` | 章節大圖、陣營條與人物輪播明顯是敘事 banner 語言。 |
| `UI 規格書` 商業序列 / bundle / 活動獎勵 | `A15` + `A14` + `A13` | 商城與獎勵畫面需要容器、道具包與武器素材一起組成價值訊號。 |
| 主城 / 城建總覽 / 建築互動 | `A7` + `A11` + `A12` | 建築節點、點擊操作與教學高亮是同一條城建交互語言。 |
| 任務 / 事件說明彈窗 | `A10` | 左側插畫裁片 + 右側說明 + 底部 reward strip 的組合可量產。 |
| 未來換裝 / 裝備 / 造型養成 | `A16` | 新圖已經提供成熟的 torso 素材語言，可直接作為服裝系統參考。 |

## 反推建議補開需求單

| 新卡號 | 方向 | 對應 family |
|---|---|---|
| `UI-2-0038` | BattleHUD portrait 裁片量產規格 | `A2` |
| `UI-2-0039` | TigerTally card art 母型規格 | `A4` / `A5` |
| `UI-2-0040` | reward container / bundle props 規格 | `A8` |
| `UI-2-0041` | 主城 building node / interaction 規格 | `A7` |
| `UI-2-0042` | outfit torso / paperdoll 規格 | `A16` |
