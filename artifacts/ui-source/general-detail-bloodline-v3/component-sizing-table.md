# GeneralDetailBloodlineV3 — Component Sizing Table

> **畫面 ID**: `GeneralDetailBloodlineV3`
> **設計基準**: 1920 × 1080 px 橫向
> **sizing contract 參考**: `docs/ui/component-sizing-contract.md`
> **數字來源**: `artifacts/ui-source/general-detail-bloodline-v3/proof/general-detail-bloodline-v3.proof.json` + `general-detail-main.json` (v8) 共用骨架
> **最後更新**: 2026-04-09
>
> **注意**: 本畫面與 `GeneralDetailOverview` 共用 `detail-split` template family，右側欄位採用 `RightContentArea`（~730px）。本表只列與 Overview 不同或本畫面特有的元件；共用結構見 `artifacts/ui-source/general-detail-overview/component-sizing-table.md`。

---

## Component Sizing Table

| component-id | class | standard-size @1920×1080 | adaptation | geometry | stretch-rule | notes |
|---|---|---|---|---|---|---|
| `BackgroundFull` | image | 1920 × 1080 | SR | sliced-rect | Widget 貼四邊 | 與 Overview 共用 |
| `TopCloseBtn` | button | **42 × 42** | FX | fixed-scale | 整體 scale | 共用；觸控下限 44px 注意 |
| `PortraitImage` | image | **760 × 860**（DI 槽） | DI | data-image-fixed | crop/fit 進槽 | 共用左側舞台 |
| `HeaderPlaque`（右上血脈標題牌匾） | panel | **1160 × 180** | SS | stretch-safe-segmented | cap-left + band-fill + cap-right | proof: x=760, w=1160, h=180 |
| **血脈標題 label**（header 內） | label | **LC 容器內 100% × ~48** | FX | fixed-scale | 行高固定；不開 cap | **Type A 固定標題**；只在此頁 header 出現 |
| `BloodlineSummaryArea` | panel | **820 × 260** | SR | sliced-rect | 9-slice；proof: x=820, y=180 | 血脈名稱/說明/人格摘要 |
| **BloodlineSummaryTitle**（區段標題） | label | **~730 × 40** | **FX** | **fixed-scale** | **整體 scale；不開 cap** | **Type A**：固定在此區段頂部，文字長度 ≤ 6 CJK |
| `BloodlineNameValue` | label | **100% × 36** | FX | fixed-scale | 行高 36px | 資料欄位 |
| `BloodlineBodyValue` | label | **100% × ~120** | FX | fixed-scale | 可多行，但外槽高度固定 | |
| `AwakeningTrack` | panel | **820 × 160** | SR | sliced-rect | 9-slice；proof: x=820, y=440 | 覺醒進度列容器 |
| `AwakeningChip`（各覺醒段） | panel | **~160 × 80**（約 5 chip） | FX | fixed-scale | 等寬並排；chip 寬固定 | 每 chip FX，外容器 LC |
| **AwakeningTitle label**（區段標題） | label | **~730 × 40** | **FX** | **fixed-scale** | **整體 scale；不開 cap** | **Type A** |
| `CrestMedallion` | image | **280 × 360** | FX | fixed-scale | 整體 scale | proof: x=1640, y=250；共用 medallion 規格 |
| `StoryStrip` | panel | **1920 × 220** | SS | stretch-safe-segmented | 全寬；6 格故事條 | proof: y=860, h=220；共用 |
| `StoryStripCard`（單格） | panel | **~280 × 200**（160 × 6 + 間距） | FX | fixed-scale | 整體 scale | 依 scroll-list itemTemplate 定義 |
| `RightTabBar`（六顆 tab） | container | **108 × 956** | LC | layout-container | 共用；垂直 layout | |
| `BtnTab*` | button | **98 × 60** | FX | fixed-scale | 三態；共用規格 | |
| `RightContentArea` | container | **730 × 850** | LC | layout-container | 共用；子 Tab 充滿 | |

---

## Title 分類確認（本畫面特有）

| 標題元件 | Type | 幾何行為 | 說明 |
|---------|------|---------|------|
| HeaderPlaque 內角色姓名橫幅 | **B** | SS | 跨 Tab 復用，採 cap-left + band-fill + cap-right；cap ~84×64 |
| BloodlineSummaryTitle（「血脈概覽」等區段標題） | **A** | FX | 只在 Bloodline 頁籤固定位置出現；**不應生成 left/right cap** |
| AwakeningTitle（「覺醒進度」等區段標題） | **A** | FX | 同上 |

---

## 與 GeneralDetailOverview 共用項目

下列元件尺寸與行為與 Overview 完全一致，不再重複列表：

- `BackgroundFull`、`TopCloseBtn`、`PortraitImage`（DI 槽）
- `RightTabBar`、`BtnTab*`（六顆 Tab 按鈕）
- `RightContentArea`（730 × 850 容器）
- `CrestMedallion`（280 × 360）
- `StoryStrip`（1920 × 220）

---

*參考*: `docs/ui/component-sizing-contract.md` / `artifacts/ui-source/general-detail-overview/component-sizing-table.md` / `artifacts/ui-source/general-detail-bloodline-v3/proof/general-detail-bloodline-v3.proof.json`
