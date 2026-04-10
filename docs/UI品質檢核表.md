# UI 品質檢核表（v0）

目的：把 `UI參考圖品質分析.md` 的規範轉成可執行的檢核清單，供 UI 美術、工程與 QA 共同驗收。

最後更新：2026-03-31

## 快速檢查清單
- [ ] 設計基準解析度為 1920×1080，Canvas 設定符合專案標準
- [ ] 所有互動元件最小觸控熱區 >= 44×44 px
- [ ] 全域色票使用指定色值（見下方色票表）
- [ ] 深色底上的淺色/金色文字均有 1~2px 黑色描邊或陰影
- [ ] 每種框體（Deep Metal / Parchment / CTA / Item Cell）已配置 9-slice 與 bleed 設定

## 元件尺寸與幾何行為驗收（必填）

> 完整標準尺寸矩陣與行為定義見 → **`docs/ui/component-sizing-contract.md`**

- [ ] Screen spec 或 task card 中已有 **Component Sizing Table**，每個元件都有明確 W × H 數值（不可只寫「依內容」）
- [ ] 每個 UI 元件已標記幾何行為代號（FX / SS / SR / TR / LC / DI）
- [ ] **Title 元件** 已區分 Type A（FX，不開 cap）或 Type B（SS，cap＋band＋fill）
- [ ] FX 元件：輸出資產尺寸與 sizing contract 標準尺寸完全一致，不允許浮動
- [ ] SS 元件（分件）：cap、band、fill 各件均有獨立資產，且 cap 尺寸符合 sizing contract 規定
- [ ] SR 元件（9-slice）：`border` 設定在委託書與 skin JSON 中保持一致，且角區不含裝飾內容
- [ ] Icon 類：大 64 px / 中 48 px / 小 32 px，未達標準需在 screen spec 中標記例外原因
- [ ] 若 icon 為 `underlay + glyph` 結構，glyph 外圍矩陣預設佔底板有效承載區 **80%**，不可每顆 icon 個別調比例
- [ ] Badge 類：標準 56 × 56 px，不可隨意縮為 40 px 以下
- [ ] Portrait 槽：已明確定義 DI 顯示槽尺寸，runtime 圖片 crop/fit，不可整體拉伸肖像圖

## 框體與 9-slice 檢核
- Deep Metal Frame：角區保留 20~24px、border 1~2px、bleed 2~4px
- Parchment Frame：角區保留 16~20px、使用低對比 noise 紋理、用投影替代 bleed
- Gold CTA：角區保留 24~32px、邊框 3~4px、三態（normal/pressed/disabled）驗證
- Item Cell：若固定尺寸可用 simple sprite；若需響應式，9-slice border 建議 [8,8,8,8]
- 所有需拉伸的 sprite 必須在 atlas 中保留 4px padding，以避免 trim 剪裁到裝飾
- 若框體包含四角完整花角 + 四邊連續 ornament，視為 `non-9-slice ornate frame`：不可直接九宮拉伸，必須改成固定尺寸、分件拼裝，或提供 stretch-safe 中段版本

驗收條件（例）：
- 打開預覽面板（100% UI scale），視覺元素無明顯貼邊或被 trim，邊角裝飾無拉伸異常

## 顏色與對比
- 使用文件中定義的色票（深底、淺底、金色高光、警示紅、正向綠等）
- 深色底文字對比需可讀（視覺上具有明顯輪廓，必要時用描邊而非純色）
- 羊皮紙底上的正文字為深褐色，禁止在淺底上套黑描邊

## 字體與文字規範
- 標題：28~42px，粗體，有微描邊或陰影
- 正文：18~22px（長段落） / 14~20px（數值、標籤）
- 深底上白色/金色文字必須 1~2px 黑色描邊（opacity 70~90%）

## Icon / Badge / Currency 檢核
- 同一套 icon 必須先定義 family，再 batch 生成，不可逐顆臨時找風格
- 若 icon 需要襯底、medal、badge plate，必須先明確定義 underlay 用途
- 若 icon 採 `underlay + glyph`，**glyph 外圍矩陣預設為 underlay 有效承載區的 80%**；這是統一承載比例，不逐顆另訂
- 若 icon 需要標識文字或 count，AI 只產底板 / chip / glyph，runtime 文字不可烤死在圖內
- 小尺寸 icon 必須在 100% UI scale 仍可辨識，不可只在放大圖下成立
- 同一 screen 內的貨幣、badge、state icon 不可混用多套不同材質語言
- 需要多態（normal / selected / disabled / locked）的 icon，必須驗證狀態切換後輪廓仍可讀

## 互動元件與按鈕態
- CTA：邊框 3~4px，pressed 狀態縮 1px 並內填色加亮，disabled opacity 0.5
- 破壞按鈕（紅）：2~3px 暗紅邊 + 白字，需二次確認「不可逆操作」的二次確認流程

## 資產輸出規格
- Atlas 分組：按 bundle（lobby_ui / battle_ui / ui_common）分組
- Sprite padding：至少 4px；九宮格角區留白如上
- 紋理格式：RGBA 8-bit，必要時對於圓角使用 32-bit alpha

## 預覽與驗收流程
1. UI 美術輸出 sprite 與 skin JSON，提交到 `assets/scripts/` 或指定 bundle
2. UI 工程匯入至測試場景，逐項檢核：9-slice、bleed、文字可讀性、按鈕三態
3. QA 在 1920×1080 與 1366×768 解析度下驗證畫面，確認無斷字、色差問題

## 負責人與交付物
- UI 美術：輸出 sprite / 9-slice / 紋理
- UI 工程：skin JSON、預覽場景、交互狀態實作
- QA：驗收清單、問題回報（issue）

---

參考：`docs/UI參考圖品質分析.md`
