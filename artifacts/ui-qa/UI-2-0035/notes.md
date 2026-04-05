# Visual QA Notes: UI-2-0035 Icon Family Research

## 基本資料

- 任務：`UI-2-0035`
- 比對來源：`docs/UI品質參考圖/`
- 狀態：🟡 IN PROGRESS

## 目前判斷

這輪研究的目的不是直接產出某一張 icon，而是把參考圖中的 icon 語言拆成可重用的 family 規則，讓後續 BattleScene 的 icon 自動生成與人工選型都有明確依據。

## 研究焦點

1. 哪些 icon family 會出現在深色即時戰鬥畫面。
2. 哪些 icon family 只會出現在羊皮紙 / 商城 / 列表型介面。
3. 哪些 family 必須高彩高對比，哪些反而要低彩退後。
4. 哪些 icon 需要厚 carrier，哪些只需要單色 pictogram。
5. 如何把這些規則轉成可重複使用的生成描述。

## 本輪新增結論

- 已把目前已開立的 icon 量產需求單對應到 F1~F8 family，不再用「戰場 icon」這種過度籠統的說法。
- `UI-2-0028` 應拆成 `F7 戰場微型 badge` 與 `F8 戰鬥功能按鈕` 兩條子語言，而不是嘗試做一顆萬用 icon。
- `UI-2-0030` 的 TigerTally 卡圖與稀有度應回到 `F6 裝備 / 收藏 cell family`，只有角落兵種 badge 才應使用 `F7`。
- `gacha / shop / support-card` 這些列表與收藏情境，不能直接沿用 BattleScene 的高彩厚邊語言；需要依條件切回 `F2 / F3 / F5 / F6`。
- 已另外整理 `icon-family-assignment.md`，供後續自動生成 prompt 與選型規則直接引用。
