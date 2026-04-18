<!-- doc_id: doc_ui_0030 -->
# UI 規格補遺 2026-04-11 大廳晨報與人物日誌 pending

> 對應母規格：`武將日誌與離線互動系統.md` (doc_spec_0015)、`名將挑戰賽系統.md` (doc_spec_0007)、`經濟系統.md` (doc_spec_0032)
> 對應入口：`LobbyMain`、`GeneralDetail`

## 補遺目的

本補遺只定義「待定 contract 掛點」，不宣告新的正式 fullscreen 畫面，也不建立平行人物系統。

## LobbyMain pending contract

1. `morning-report-content`
   - 定位：登入後第一層摘要條。
   - 內容：晨報摘要、昨夜派遣結果、離線戰記摘要。
   - 限制：只顯示摘要與未讀數，不展開全文。

2. `dispatch-board-content`
   - 定位：軍事牆 / 生活感入口旁的次層抽屜。
   - 內容：可摘要結算的低風險派遣、補充派遣欄位、待回報結果。
   - 限制：不可承接高風險正式戰役。

3. `tournament-season-card`
   - 定位：世界沙盤側邊次卡。
   - 內容：本季盃賽名稱、主地形、主天氣、剩餘天數、已登錄快照狀態。
   - 限制：只做賽季導覽，不在此直接展開完整賽制頁。

4. `economy-subsidy-banner`
   - 定位：資源列或許願祭壇附近的提示條。
   - 內容：地窖保護狀態、每日補貼可領 / 已領、目前保底線。
   - 限制：只做提示與跳轉，不在大廳直接塞滿商城細項。

## GeneralDetail pending contract

1. `general-journal-content`
   - 定位：`GeneralDetail` overview 次層抽屜或故事條旁 peek 卡。
   - 內容：近期戰記、晨報摘錄、派遣紀錄、未讀日誌。
   - 限制：不得取代既有 `歷史趣聞 / 血脈傳聞` 故事主線。

2. `general-tally-summary`
   - 定位：overview 次卡。
   - 內容：當前裝備虎符、`TigerTallyScore` band、兵種傾向、近期戰場表現摘要。
   - 限制：只顯示摘要，不在人物首頁展開完整虎符圖鑑或深度養成頁。

## 非目標

1. 不在本補遺內宣告新的 `screen.json` 正式路徑。
2. 不把 `GeneralDetail` 切成另一套平行人物頁。
3. 不在大廳直接塞入完整挑戰賽或商城主流程。