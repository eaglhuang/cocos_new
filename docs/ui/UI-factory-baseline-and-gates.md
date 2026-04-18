<!-- doc_id: doc_ui_0047 -->
# UI Factory Baseline And Gates

這份文件把目前分散在 `UI技術規格書`、`UI品質檢核表`、`ui-vibe-pipeline` skill、以及實際量產流程中的共通規則收斂成一份 baseline。

## 1. 統一 UI 基準

### 1.1 設計與平台基準

1. 設計基準解析度：1920 x 1080，橫向。
2. 主要支援平台：Web / iOS / Android / PC。
3. 當前正式量產基準仍以橫向為主。
4. 未來目標包含橫豎屏可轉換，但「豎向量產規則」目前尚未完成正式驗證，不應宣稱已 factory-ready。

### 1.2 自適應原則

1. 正式解法必須以 `Widget + SafeArea + Layout` 為主。
2. 禁止把硬編 `x / y` 絕對座標當成正式量產解。
3. 跨平台至少要涵蓋 16:9 與 19.5:9 類型比例。
4. 互動元件最小觸控熱區：44 x 44 px。
5. 需支援 Web / Mobile / PC 的 UI 自適應，不得只對單一 preview 解析度成立。

### 1.3 視覺與資產基準

1. 三層 JSON 契約維持為唯一正式主幹：`layouts / skins / screens`。
2. Frame / skin / asset family 必須走 family reuse，不可退回每頁自製孤島。
3. `non-9-slice ornate frame` 不可直接九宮拉伸。
4. Popup 畫面內 DrawCall 目標：3 到 5 次以內。
5. AI 生成的局部資產不得直接掛 runtime，必須先經過 post-process 與驗證。
6. post-process 至少要檢查：輸出尺寸、trim 後 occupancy、外圈 alpha 殘留、nine-slice border 整數性。

### 1.4 元件尺寸與幾何行為基準（2026-04-09 新增）

> 完整規則見 → **`docs/ui/component-sizing-contract.md (doc_ui_0038)` (doc_ui_0038)**

1. **每份 screen spec / task card 必須包含 Component Sizing Table**，才算規格齊備；缺少 sizing table 的規格不可進入 asset 委託或量產流程。
2. 每個元件必須標記幾何行為代號（FX / SS / SR / TR / LC / DI）。
3. Title 元件必須先判斷 Type A（FX，不開 cap）或 Type B（SS，分件）；未標記 Type 的 Title 視為規格不完整。
4. FX 元件必須有明確 W × H；沒有數字的 FX 規格不算完整。
5. 資產委託書（ArtRecipe）中必須附 sizing entry，與 screen spec 保持一致。

## 2. 其他 Agent 該被引導讀什麼

如果要讓其他 Agent 按照這條 UI factory 流程推動畫面，最少要讓它們讀：

1. `docs/keep.summary.md (doc_index_0012)` (doc_index_0012)
2. `docs/UI技術規格書.md (doc_ui_0049)` (doc_ui_0049)
3. `docs/UI品質檢核表.md (doc_ui_0050)` (doc_ui_0050)
4. `docs/UI-factory-agent-entry.md` (doc_ui_0032)
5. `docs/UI-reference-source-workflow.md (doc_ui_0036)` (doc_ui_0036)
6. `artifacts/ui-source/general-detail-overview/decomposition-pipeline-ops-guide.md`

其中：

1. `keep.summary` 負責專案共識與平台背景。
2. `UI技術規格書` 負責全域 UI 技術規則。
3. `UI品質檢核表` 負責 QA / 美術 / 工程共同驗收門檻。
4. `UI-factory-agent-entry` 負責告訴 Agent 讀取順序與路由。
5. `UI-reference-source-workflow` 負責決定 canonical reference 從哪裡來，以及 AI prompt 如何與使用者共同討論。
6. `ops-guide` 負責告訴 Agent 真正的量產流程怎麼走。
7. 若畫面含 icon / badge / currency family，需再讀 `docs/UI-icon-factory-workflow.md (doc_ui_0033)` (doc_ui_0033)。

## 3. 何時能驗證量產工程進度

量產工程不應只看「有沒有腳本」，而應看是否通過 gate。

### Gate A. 結構編譯可運作

條件：

1. 能生成 `intake / family-map / asset-task-manifest`。
2. 有 schema 與 validator。
3. compiler 寫檔後會自動自檢。

狀態：已完成。

### Gate F-2. Asset Post-Process 可驗證

條件：

1. `generate-partial-asset` 任務在進 runtime 前，必須有可重跑的 post-process 命令。
2. post-process 不能只做 trim，至少要附尺寸 / alpha / border 檢查報告。
3. 若為 sliced asset，border 必須可機械檢查，而不是只靠肉眼。

狀態：已建立工具入口（`tools_node/postprocess-ui-asset.js`），後續新資產任務應逐步接入。

### Gate B. 同 family 可複用

條件：

1. 至少 2 張同 family 畫面通過。
2. 第二張不需推翻第一張結構。

狀態：已完成（`GeneralDetailOverview`、`GeneralDetailBloodlineV3`）。

### Gate C. 非 GeneralDetail Popup 可複用

條件：

1. 非人物頁畫面也能落到 reuse / param-tune 路徑。
2. 不會被誤判成一定要生圖。

狀態：已完成（`ShopMain`）。

### Gate D. 戰場語言可複用

條件：

1. 戰場畫面可落到既有 family reuse。
2. 不會把 BattleScene 誤導回人物頁 / 商店語言。

狀態：已完成（`BattleHUD`）。

### Gate E. Review 產物齊備

條件：

1. `generated-review.json` 自動落檔。
2. `runtime-verdict.json` 至少有 skeleton。

狀態：已完成。

### Gate F. Runtime 驗證自動化

條件：

1. `runtime-verdict.json` 不只是 skeleton，而是能由 runtime capture / strict validation 真正回填。
2. 至少 3 張代表畫面有 pass / residuals / promoteable 的實際 verdict。

狀態：未完成。

最新進度：已開始接到真實流程，且已有 3 張代表畫面落下實際 runtime verdict：

1. `ShopMain`
2. `GeneralDetailOverview`
3. `BattleHUD`（由 `BattleScene` capture 回寫）
4. `GeneralDetailBloodlineV3`

因此 Gate F 的「開始可驗證」已達成，而且 4 張目前主要驗證樣本都已有實際 runtime verdict。

### Gate G. 量產效果可量化

條件：

1. 能追每張 screen 的人工時數、生成輪數、重工次數。
2. 能和手工流程比對「是否更快、更穩」。

狀態：未完成。

最新進度：已新增 `artifacts/ui-source/factory-throughput-report.json`，開始量化：

1. 每張畫面的 cycle time
2. asset-task / param-tune task 數
3. runtime rounds
4. rework rounds

因此 Gate G 已從「不可量化」進入「可開始量測，但樣本仍偏少」的階段。

## 3.5 Icon Factory 已納入主流程

icon / badge / currency / medal 不再視為零散附屬品，而是正式 factory 資產類型。

基準如下：

1. icon 先定義 family 與 structure mode，再進 AI 量產。
2. icon 若需要 underlay / badge plate / runtime label，必須在 proof 階段先講清楚。
3. 同 family icon 應優先 batch 生成，避免逐顆風格漂移。
4. proof 可用 `family: icon` 明確標註 icon zone，family router 再映射成 `icon-suite / icon-badge-suite / icon-currency-suite`。

## 4. 何時能說效果不錯

至少要同時滿足：

1. 4 張以上跨類型 screen 通過 gate A 到 E。
2. 至少 1 張新 screen 從零開始，能在 1 到 3 天內完成 first acceptable runtime。
3. `reuse-only + param-tune` 的 zone 比例高於 `generate-partial-asset`。
4. runtime verdict 的 residuals 開始穩定收斂，而不是每張都大改。

目前狀態：

1. Gate A 到 F 已達成。
2. Gate G 已開始量測，但尚未形成穩定趨勢。
3. 所以可以說「量產主幹與 runtime 驗證鏈已經成形」，但還不能說「量產效果已被長期數據完整驗證」。

## 5. 下一個最值得推動的步驟

1. 針對高 warning 的 runtime verdict，開始做 residual triage。
2. 找一張全新、未加工的 screen，從 `reference source -> prompt card -> intake -> runtime verdict` 跑一次完整 onboarding。
3. 補 task / human-time 的長期紀錄，讓 Gate G 從單次快照升級成趨勢報表。