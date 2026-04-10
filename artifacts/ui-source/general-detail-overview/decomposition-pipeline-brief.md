# GeneralDetailOverview Decomposition Pipeline Brief

## Goal

把「參考圖 -> AI 拆解圖 -> 可組裝 UI 產線」升級成真正可量產的工廠流程，讓新畫面不是每張都靠一個月的手工收斂，而是先經過結構化分解、family 套用、單件資產生成、固定後處理與自動驗收，再用少量人工處理最後 10% 殘差。

Unity 對照：這不是每次重做一張完整 Prefab，而是先把畫面拆成可重用 Prefab family、slot contract 與 sprite recipe，再讓局部資產生成器補稀缺件。

## Strategic Positioning

這條路線要解的不是「某一張 UI 比較像」，而是以下 3 個量產瓶頸：

1. 每張畫面都從零開始討論結構，沒有共用 family。
2. AI 生圖一次吃整頁，輸出不可控，導致返工成本極高。
3. 驗收太晚才發現問題，結果把時間消耗在長迴圈微調。

因此這份 brief 的核心不是多一份文件，而是把 UI 生產線改成：

1. contract-first
2. family-first
3. zone-first generation
4. automated QC before human polish

## Success Criteria

這條流程如果要算成功，目標不是「品質普通地更快」，而是要同時達成：

1. 80% 新畫面可在既有 family 上完成，不需要重開全新視覺體系。
2. 70% 以上的 AI 產出只發生在局部 ornament / face / wash / separator，不碰整頁 layout。
3. 新 screen 從 intake 到第一個可驗 runtime，目標縮到 1 到 3 天，不是 2 到 4 週。
4. 人工 polish 應只處理局部殘差，不再處理結構失控。

## Scope

- screenId: `GeneralDetailOverview`
- template_family: `detail-split`
- canonical target: jade-parchment header + parchment-first information card + restrained ornament caps
- source of truth: 正式 `layout / skin / screen / contract`
- role of decomposition image: 中介 proof，不是正式 runtime 真相

## Non-Goals

- 不直接讓 nb2 生整頁正式 UI
- 不把 AI 拆解圖直接掛到 runtime
- 不讓單張拆解圖取代 `proof-contract-v1`、family mapping、QC gate
- 不讓每張 screen 都獨立發明一套命名、目錄與驗收方法

## Why Current Work Is Slow

目前會拖成一個月，通常不是因為 AI 不夠強，而是流程順序錯了：

1. 太早碰最終視覺，太晚固定結構。
2. AI 任務切太大，導致每次失敗都要整頁重來。
3. 缺少 screen 分級，所有頁面都走同一套重流程。
4. 缺少 compile step，proof、family、task、prompt 都靠手填。
5. 驗收點太少，直到 runtime 才看到問題。

## Production Doctrine

未來所有新 UI 畫面都應遵守這 6 條原則：

1. 先決定 family，再談裝飾。
2. 先決定 content contract，再談字怎麼排。
3. AI 只補「缺件」，不負責整頁真相。
4. 每個 zone 必須能獨立驗收。
5. runtime opacity 只能做最後 10% 校正，不能當主修法。
6. 任務要以 timebox 收斂，不允許無限微調。

## Screen Taxonomy

不是每個畫面都該走同樣重量的 pipeline。先分類，才能量產。

### Tier A. Family Reuse Screen

定義：

- 70% 以上可由既有 family 承接
- 只有內容排列與少量 skin fragment 差異

例子：

- detail-split 的同系人物頁
- dialog-card 的子頁
- rail-list 的內容變體

流程：

- proof contract
- family-map
- scaffold
- runtime verify

AI 介入：

- 可選，且只碰 1 到 3 個小 ornament

時間盒：

- 0.5 到 2 天

### Tier B. Hybrid Screen

定義：

- 結構仍沿用既有 family
- 但有 2 到 6 個關鍵視覺區需要新資產或新 recipe

例子：

- 本次 GeneralDetailOverview header / medallion / portrait stage

流程：

- proof contract
- family-map
- task compile
- nb2 zone tasks
- post-process
- assembly
- runtime verify

AI 介入：

- 有，但只能是單 zone 資產

時間盒：

- 2 到 5 天

### Tier C. New Family Screen

定義：

- 既有 family 無法承接 50% 以上結構
- 需要新增一套可重用 family，而不是只救一張畫面

流程：

- brief
- proof contract
- family design
- recipe design
- scaffold
- sample screen verify
- family freeze

AI 介入：

- 只做探索稿與局部資產候選

時間盒：

- 1 到 2 週

規則：

- Tier C 必須產出 family 級成果，不能只服務單頁

## Target Operating Model

要量產，就不能把所有腦力都放在單次對話裡。流程需要拆成固定角色或固定步驟。

### Role 1. Intake Compiler

職責：

- 讀參考圖、規格與既有 runtime
- 判定 Tier A/B/C
- 輸出 intake manifest

最小輸出：

- `screenId`
- `tier`
- `template_family_candidate`
- `canonical refs`
- `risk zones`
- `smoke route`

### Role 2. Proof Compiler

職責：

- 產出 proof-contract-v1 草稿
- 確定 visual zones / content slots / spacing recipe

### Role 3. Family Router

職責：

- 將 zone 對應到既有 family / recipe
- 判定哪些 zone 需要新資產，哪些不需要

### Role 4. Asset Task Compiler

職責：

- 把需要 AI 的 zone 自動切成單件任務
- 產出 prompt、negative prompt、output spec、post-process spec

### Role 5. QC Router

職責：

- 把資產驗證與 runtime 驗證排成固定關卡
- 快速標記 pass / fail / fallback

## End-to-End Pipeline

## Stage 0. Normalize Inputs

輸入固定拆成 3 份：

1. 官方或 canonical 參考圖
2. AI 產出的拆解圖
3. 現行 runtime capture

規則：

- 對話內一律先看 `125px` preview；若不足才升到 `250px`、再到 `500px`
- 原圖保留在 `artifacts/ui-source/<screen-id>/reference/`
- 拆解圖只用來協助辨識 zone / layer intent，不直接當材質來源
- runtime capture 必須是可重現命令產生，不接受手動截圖當唯一真相

建議新增自動產物：

- `intake.json`
- `reference-index.json`

### 建議 intake.json 格式

```json
{
  "screenId": "GeneralDetailOverview",
  "tier": "B",
  "templateFamilyCandidate": "detail-split",
  "canonicalReferences": [
    "ref://docs/UI品質參考圖/general-detail-overview-official.png",
    "artifacts/ui-qa/UI-2-0094/runtime-r19-header-final-weight-tune/GeneralDetailOverview.png"
  ],
  "riskZones": ["headerPlaque", "crestMedallion", "portraitStage"],
  "smokeRoute": "node tools_node/capture-ui-screens.js --target GeneralDetailOverview --outDir artifacts/ui-qa/UI-2-0094/runtime-smoke"
}
```

## Stage 1. Decompose To Proof Contract

先用 `ui-reference-decompose` 產出 proof 草稿，將整頁拆成可討論的語意區。

最低輸出：

- `visualZones`
- `componentIntents`
- `spacingRecipe`
- `contentSlots`
- `_draft`
- `confidence`

對這頁至少拆成：

1. `portraitStage`
2. `headerPlaque`
3. `summaryCards`
4. `bloodlineSummary`
5. `crestMedallion`
6. `storyStrip`

建議輸出檔：

- `artifacts/ui-source/general-detail-overview/proof/general-detail-overview.proof.json`

### Rule: proof 不可寫成純美術感想

proof 應回答的是：

1. 哪裡是結構承載面
2. 哪裡是可替換皮膚
3. 哪裡是內容綁定位
4. 哪裡是 AI 可插入的資產槽

## Stage 2. Family Mapping

把每個 zone 對應到既有 family，而不是讓每次拆解都發明新元件。

本頁建議：

- `portraitStage` -> `detail-split / portrait-stage`
- `headerPlaque` -> `detail-split / header-rarity-plaque`
- `summaryCards` -> `detail-split / summary-card-grid`
- `bloodlineSummary` -> `detail-split / parchment-body-card`
- `crestMedallion` -> `detail-split / crest-medallion`
- `storyStrip` -> `detail-split / story-strip-rail`

輸出格式建議：

```json
{
  "screenId": "GeneralDetailOverview",
  "zoneFamilyMap": [
    {
      "zone": "headerPlaque",
      "family": "header-rarity-plaque",
      "recipe": "jade-parchment-light",
      "structureOwner": "layout+shell",
      "skinOwner": "skinFragments",
      "contentOwner": "contentContract",
      "generationNeed": "partial"
    },
    {
      "zone": "crestMedallion",
      "family": "crest-medallion",
      "recipe": "jade-ornate-medallion",
      "structureOwner": "layout+shell",
      "skinOwner": "skinFragments",
      "contentOwner": "contentContract",
      "generationNeed": "partial"
    }
  ]
}
```

建議輸出檔：

- `artifacts/ui-source/general-detail-overview/proof/general-detail-overview.family-map.json`

### Decision Rule

若 zone 可由既有 family 承接 80% 以上，就禁止直接開 AI 任務。

## Stage 3. Task Compilation

這是量產突破點之一。不是人工逐件想 prompt，而是由 `proof + family-map` 編譯出任務。

每個 zone 只允許落入以下 4 種任務型別：

1. `reuse-only`
2. `param-tune`
3. `generate-partial-asset`
4. `new-family-required`

### 任務判定規則

- `reuse-only`: 既有 family + skin 即可完成
- `param-tune`: 只需 layout / opacity / tint / spacing 微調
- `generate-partial-asset`: 需要新 ornament / wash / medallion part
- `new-family-required`: 現有 family 完全無法承接

### 這一步的目標

把 1 張畫面拆成 5 到 20 個小任務，而不是 1 個巨任務。

## Stage 4. NB2 Task Cutting

`nano-banana-2` 只接「單 zone、單責任、無文字」任務。不要把整頁 UI 丟進去。

### 可交給 nb2 的任務

1. `header-cap-left`
2. `header-cap-right`
3. `header-center-ornament`（只有在 band 中段真的缺件時才開）
4. `portrait-wash-diagonal`
5. `crest-face`
6. `crest-ring`
7. `story-strip-separator`
8. `small-corner-ornament`

### 不應交給 nb2 的任務

1. 全頁 layout
2. 文本位置
3. 三欄 summary 的卡片排列
4. 任何帶字 badge / title bar
5. 需要 9-slice 精準邊界的整框 frame
6. 可由現有 family 拼出的結構件

### 單任務輸入格式

每個 nb2 任務都應有一份 JSON brief + 一份 prompt txt。

JSON brief 範例：

```json
{
  "taskId": "gd-overview-header-cap-left-v1",
  "model": "nano-banana-2",
  "screenId": "GeneralDetailOverview",
  "zone": "headerPlaque",
  "slot": "capLeft",
  "taskType": "generate-partial-asset",
  "targetStyle": "jade-parchment light plaque ornament",
  "mustKeep": ["asymmetric left cap", "thin connector", "light gold edge"],
  "mustAvoid": ["text", "double rails", "heavy dark metal", "full frame rectangle"],
  "fitRules": {
    "maxVisualOccupancy": 0.65,
    "connectorLength": "short",
    "runtimeIntrusionForbidden": true
  },
  "postProcess": {
    "trimByBackground": true,
    "allowFadeSide": "right",
    "fitPadding": 12
  },
  "output": {
    "preferredMime": "image/png",
    "targetLongEdge": 512,
    "transparentBackgroundPreferred": true
  }
}
```

Prompt txt 規則：

- 第一段寫 visual goal
- 第二段寫 family 語氣與材質限制
- 第三段寫 hard negatives
- 最後固定加：`no text, no letters, no calligraphy, no symbols`

建議路徑：

- `artifacts/ui-source/<screen-id>/prompts/*.txt`
- `artifacts/ui-source/<screen-id>/tasks/*.json`

### 批次限制

每輪只允許 2 到 4 個 nb2 任務同時進行。原因不是模型算力，而是驗收帶寬有限；太多候選會讓比較成本再次爆炸。

## Stage 5. Post-Process

nb2 輸出不能直接上 runtime，必須先過後處理。

固定步驟：

1. 去背或背景裁切
2. `trim-png-by-background.js` 收邊
3. 必要時做單側 fade
4. 尺寸標準化
5. alias policy 檢查
6. slot occupancy 檢查

對 header cap 的最小要求：

- connector 不可過長
- ornament 主體不可吃進名字區
- 左右 cap 必須對稱成對驗證
- 不得生成雙軌或雙桿 connector

### 後處理輸出建議

每件資產都保留 3 份：

1. `raw/`
2. `processed/`
3. `runtime-linked/`

這樣失敗時可以快速判斷問題是在模型、後處理還是 runtime slot。

## Stage 6. Assembly

只有過完後處理與 QC 的素材，才允許接到 `skin slot`。

組裝規則：

1. 結構仍由 `layout / shell` 控制
2. AI 資產只替換 `skin fragment`
3. 不得為了遷就 AI 圖而回頭扭曲 content contract
4. header 若要微調，先改 asset，最後才改 runtime opacity
5. 若一個 zone 需要超過 2 次 runtime opacity 補救，視為 asset 或 family 選錯，必須回退

## Stage 7. QC Gates

### Gate A. Structure Gate

- `proof` 與 `family-map` 齊全
- 每個 zone 都能回答「誰負責結構、誰負責皮膚、誰負責內容」
- 沒有把整頁視為單一圖片
- 每個 content slot 都能對上 contract field

### Gate B. Asset Gate

- 無文字 hallucination
- 無深綠重金裝備框語言回滲
- header / crest / portrait 各自只承擔單一責任
- 不可出現需要靠額外 glow 才成立的假完成度
- 單件資產在 isolated preview 下已能說清用途

### Gate C. Runtime Gate

固定命令：

```powershell
curl.exe http://localhost:7456/asset-db/refresh
node tools_node/validate-ui-specs.js --strict --check-content-contract
node tools_node/capture-ui-screens.js --target GeneralDetailOverview --outDir artifacts/ui-qa/UI-2-0094/<run>
```

通過標準：

1. 名字區仍清楚可讀
2. header 不讀成厚重深綠橫條
3. crest medallion 不退回 placeholder 感
4. portrait stage 不失去對角 wash 與主體焦點
5. story strip 不因新資產被壓到邊緣或變成噪訊區

### Gate D. Factory Gate

這是量產真正需要的新 gate，用來防止單頁成功但流程不可複製。

必查：

1. 這次新增的 family / task / prompt 是否能複用到至少 2 張畫面。
2. 這次新增的規則能否寫回 compiler 或 schema，而不是只留在人腦。
3. 若同類畫面再做一次，是否可以少 30% 以上人工時間。

若答案都是否，代表這次只是做出一張畫面，不算流程突破。

## Timebox Policy

量產流程一定要有停止條件，不然還是會無限微調。

### 每個 zone 的預設 timebox

- `reuse-only`: 0.5 小時
- `param-tune`: 2 小時
- `generate-partial-asset`: 0.5 天
- `new-family-required`: 1 到 2 天

### 失敗升級規則

- 同一個 zone 若連續 3 輪生成都失敗，停止 prompt 微調，改檢查 family 選錯或 slot geometry 錯誤。
- 同一個 zone 若需要第 4 次 runtime compare，必須先寫出失敗原因，再決定是否繼續。
- 若一張 screen 超過 6 個 zone 都需要 `generate-partial-asset`，重新評估是否其實是 Tier C。

## Automation Backlog

如果真的要從「一張一張救火」變成量產，下面這些工具最好補起來。

### Tool 1. intake-ui-screen.js

用途：

- 從參考圖、規格、現行 runtime 自動生成 `intake.json`
- 判定 screen tier 與風險 zones

### Tool 2. compile-proof-to-family-map.js

用途：

- 根據 proof contract 與 family 規則，自動產生 family-map 草稿
- 標記哪些 zone 可 reuse、哪些 zone 需要 AI 補件

### Tool 3. compile-family-map-to-asset-tasks.js

用途：

- 自動為 `generate-partial-asset` zones 產生 tasks JSON 與 prompts TXT
- 自動帶入 negatives、尺寸規則與 post-process spec

### Tool 4. review-generated-zone-assets.js

用途：

- 對 raw / processed / runtime-linked 三份圖做對照
- 自動輸出 fail reason，例如 `too heavy`, `too text-like`, `intrudes title zone`

### Tool 5. measure-screen-throughput.js

用途：

- 統計每張 screen 的人工時數、生成次數、比較次數、最終採納率
- 讓量產優化不是憑感覺，而是有數字

## Data Products To Standardize

未來每張畫面都應固定產出這些資料，不然就無法自動化。

1. `intake.json`
2. `proof.json`
3. `family-map.json`
4. `asset-task-manifest.json`
5. `generated-review.json`
6. `runtime-verdict.json`

### runtime-verdict.json 建議欄位

```json
{
  "screenId": "GeneralDetailOverview",
  "runId": "runtime-r19-header-final-weight-tune",
  "status": "pass-with-minor-residuals",
  "residuals": [
    "header middle still slightly dense",
    "crest socket can still gain finish quality"
  ],
  "promoteable": true,
  "factoryLearnings": [
    "header slimming should stop at asset layer after r19",
    "badge/frame deletion is reusable cleanup rule for similar detail-split headers"
  ]
}
```

## Folder Convention

建議目錄：

```text
artifacts/ui-source/<screen-id>/
  reference/
  proof/
  prompts/
  tasks/
  generated/
    <task-id>/
      raw/
      processed/
      runtime-linked/
  review/
  manifests/
```

## Deliverables

最小可執行輸出應包含：

1. `manifests/intake.json`
2. `proof/<screen-id>.proof.json`
3. `proof/<screen-id>.family-map.json`
4. `manifests/asset-task-manifest.json`
5. `tasks/*.json` 的 nb2 單件任務
6. `prompts/*.txt`
7. `generated/<task-id>/raw|processed|runtime-linked`
8. `review/generated-review.json`
9. `review/runtime-verdict.json`

## KPI Suggestions

如果這流程要變成量產流程，建議每週追這 6 個指標：

1. 每張新 screen 第一次可看 runtime 的平均天數
2. 每張 screen 的 nb2 任務數量
3. 每個 zone 的平均生成輪數
4. 最終採納資產比率
5. 可重用 family 命中率
6. 需要進入人工長時間 polish 的 screen 比例

## Adoption Strategy

不要一次把所有畫面都切過來，應該分 3 步走。

### Phase 1. Validate On One Screen

- 先用 `GeneralDetailOverview` 跑完完整流程
- 補齊 intake / family-map / task-manifest / runtime-verdict 標準格式

### Phase 2. Validate On Same Family Screens

- 挑 2 到 3 張同屬 `detail-split` 的畫面
- 驗證 family reuse 與 task compiler 是否真的能複用

### Phase 3. Promote To Factory Default

- 把 `Tier A / Tier B / Tier C` 判定寫成正式開工規則
- 將 intake、proof、task compile、QC 的命令納入固定 workflow

## Recommended Next Actions

1. 先把 `GeneralDetailOverview` 補齊 `intake.json`、`family-map.json`、`asset-task-manifest.json` 三個缺口。
2. 再補一個 `compile-family-map-to-asset-tasks.js` 的最小版本，先只支援 `headerPlaque` 與 `crestMedallion`。
3. 用同一套流程挑第二張 `detail-split` 畫面驗證，確認這不只是單頁成功，而是 family 級可複製方法。