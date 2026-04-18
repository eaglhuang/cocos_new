# GeneralDetailOverview — Component Sizing Table

> **畫面 ID**: `GeneralDetailOverview`
> **設計基準**: 1920 × 1080 px 橫向
> **sizing contract 參考**: `docs/ui/component-sizing-contract.md (doc_ui_0038)` (doc_ui_0038)
> **layout 數字來源**: `assets/resources/ui-spec/layouts/general-detail-main.json` (v8) + proof contract `artifacts/ui-source/general-detail-overview/proof/general-detail-overview.proof.json`
> **最後更新**: 2026-04-09

---

## Component Sizing Table

| component-id | class | standard-size @1920×1080 | adaptation | geometry | stretch-rule | notes |
|---|---|---|---|---|---|---|
| `BackgroundFull` | image | 1920 × 1080 | SR | sliced-rect | Widget 貼四邊 | fullscreen bg |
| `TopCloseBtn` | button | **42 × 42** | FX | fixed-scale | 整體 scale | 注意觸控下限 44px；widget: top=76, left=118 |
| `PortraitImage` | image | **760 × 860**（DI 槽） | DI | data-image-fixed | crop/fit 進槽，不拉伸肖像 | 左側人物舞台；layout JSON: 47% × 88% |
| `TopLeftInfo`（header plaque panel） | panel | **442 × 196**（23% × 1920 ≈ 442） | SS | stretch-safe-segmented | header band = cap-left + fill + cap-right | header-plaque zone；cap 標準 ~84×64 |
| `TitleLabel`（TopLeftInfo 內） | label | **100% × 68**（容器內） | LC | layout-container | 垂直 layout 自動排列 | 不固定 px，隨 TopLeftInfo 寬度 |
| `NameLabel`（TopLeftInfo 內） | label | **100% × 44** | LC | layout-container | — | 同上 |
| `MetaLabel`（TopLeftInfo 內） | label | **100% × 54** | LC | layout-container | — | 同上 |
| `BottomLeftInfo`（summary panel） | panel | **595 × 92**（31% × 1920 ≈ 595） | SR | sliced-rect | 9-slice；widget: top=68, right=152 | 概要屬性卡群橫向容器 |
| `EpCard` / `VitCard` | panel | **48% × 100%**（~286 × 92） | SR | sliced-rect | 9-slice inner card | 各高 92；並排 |
| `RightTabBarFill/Frame` | panel | **76 × (1080-64-60)** = 76 × 956 | SR | sliced-rect | Widget 貼 top/bottom/right | 右側 tab rail 裝飾層 |
| `RightTabBar` | container | **108 × 956** | LC | layout-container | 垂直 layout；spacing=8，padding 上下各 12 | 右側六個 tab 按鈕容器 |
| `BtnTab*`（六顆 tab 按鈕） | button | **98 × 60** | FX | fixed-scale | 整體 scale；三態必驗 | 觸控 OK（98×60 > 44）|
| `RightContentAreaFill/Frame` | panel | **730 × 850**（38% × 1920 ≈ 730） | SR | sliced-rect | Widget: top=174, bottom=56, right=152 | 右側內容區裝飾層 |
| `RightContentArea` | container | **730 × 850** | LC | layout-container | 子 Tab 充滿 | 右側主內容容器 |
| **`Section Title Label`（TabBasics / TabBloodline / TabStats 等區段標題）** | label | **~730 × 36–52**（FX 型） | **FX** | **fixed-scale** | **整體 scale；不預設 left-cap / right-cap** | **Type A 固定標題**：只在此畫面出現，文字長度有上限（≤ 6 CJK），不需跨畫面拉伸 |
| `TitleValue/NameValue/…`（TabBasics 欄位列表） | label | **100% × 30**（LC 容器內） | FX | fixed-scale | 行高固定 30 px；寬度隨 content area | 資訊欄位列高固定 |
| `StatsValue`（TabStats 屬性欄） | label | **100% × 40** | FX | fixed-scale | 行高固定 40 px | |
| `BloodlineSummaryCard` | panel | **100% × 180**（~730 × 180） | SR | sliced-rect | 9-slice；padding 18/18/20/20 | TabBloodline 內摘要卡 |
| `CrestMedallion`（命紋 medallion） | image | **280 × 360**（proof zone） | FX | fixed-scale | 整體 scale，不可拉伸 | proof: x=1640, y=250 |
| `StoryStrip`（底部故事帶） | panel | **1920 × 220** | SS | stretch-safe-segmented | 全寬；含 6 格故事條 | proof: y=860, h=220 |

---

## Title 分類確認

| 標題元件 | Type | 幾何行為 | 說明 |
|---------|------|---------|------|
| TopLeftInfo header plaque（角色姓名橫幅） | **B** | SS | 跨 tab 復用，採 cap-left + band-fill + cap-right |
| TabBasics / TabStats / TabBloodline / TabSkills 等頁籤區段標題 | **A** | FX | 每個頁籤只在本畫面固定位置出現；文字固定；**不應生成 left/right cap 資產** |
| RightContentArea 各欄位值標籤（TitleValue, NameValue 等） | — | FX | 純資料 label，非 Title 裝飾；row 高度 30px 固定 |

---

## 例外與注意事項

1. `PortraitImage` 使用 `47%` / `88%` 相對尺寸，但 DI 顯示槽應以 **760 × 860** 為 standard（與 proof contract 一致）。runtime 填圖時需 crop/fit 進此槽，不可整體拉伸肖像。
2. `RightContentArea` 寬度為 `38%`（≈730），其內所有子元件的 `100%` 寬度均基於此容器；設計稿數值填入時需折算為 730 px。
3. `TopCloseBtn` 目前為 42×42 px，略低於 44×44 觸控下限；若未來優化觸控體驗，建議改為 44×44 並更新 widget 偏移。
4. `BtnTab*` 按鈕如需增加 selected / hover state，view 寬高保持 98×60 不變，改 skinSlot 即可。

---

*參考*: `docs/ui/component-sizing-contract.md (doc_ui_0038)` (doc_ui_0038) / `assets/resources/ui-spec/layouts/general-detail-main.json` / `artifacts/ui-source/general-detail-overview/proof/general-detail-overview.proof.json`
