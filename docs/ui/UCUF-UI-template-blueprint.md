<!-- doc_id: doc_ui_0046 -->
# UCUF UI 模板化藍圖

> 狀態：draft
> 目的：把 `GeneralDetail` 這次的收斂做法整理成可重複套用的 UI 量產藍圖，作為後續 `family + recipe + generator + validation pipeline` 的正式骨架。

---

## 1. 這份藍圖要解決什麼

`GeneralDetail` 這次的價值，不只是把一張人物頁修好，而是把「原本靠單一 Panel + 大量手動節點控制」的做法，收斂成可組裝、可驗證、可交給 Agent 量產的 UCUF 主幹。

如果用 Unity 的方式理解：

1. `family` 類似一組可重複使用的 Prefab Variant 規格。
2. `recipe` 類似一份 Screen ScriptableObject，描述這張畫面要選哪個 family、哪些 slot、哪些 data source。
3. `CompositePanel` 類似 PageController / ScreenPresenter，負責切換子區塊，不直接硬寫所有 view 邏輯。
4. `ChildPanel` 類似子 ViewController，吃單一 data source，綁自己的 fragment 與 content contract。
5. `generator` 類似 Editor Tool，把 recipe 編譯成 `layout / skin / screen / panel scaffold / review skeleton`。

如果用 MVC 的方式理解：

1. `Model`：`GeneralConfig`、對應 mapper state、content contract schema。
2. `View`：`layouts / skins / screens / fragments` 與 visual pass。
3. `Controller`：`CompositePanel`、`ChildPanelBase`、LoadingScene preview route、runtime verify pipeline。

這份藍圖的核心目標是把 UI 開發從「每次重做一頁」變成「給一份 UI 示意圖，先做結構分析與 proof draft，再進 MCQ 收斂 recipe，最後跑 generator、補少量 screen-specific 邏輯、走固定驗收 pipeline」。

---

## 2. GeneralDetail 這次已驗證的 canonical sample

`GeneralDetail` 現在應視為 `detail-split` family 的 canonical sample，因為它已經驗證了以下幾件事：

1. 主畫面可由 `CompositePanel` 接管，而不是由單一 legacy panel 直控所有節點。
2. tab 可以統一走 `slot + child panel + switchTab()`，不再保留 `Overview` 這類特例 shell route。
3. `Overview` 的資料流可先經 mapper，轉成 contract-compatible state，再由 binder 綁定到 fragment。
4. visual pass 可以抽成共用 renderer，避免 shell 路徑與 unified child 路徑漂移。
5. `layout / screen / content contract / bind path policy / regression guard` 可以一起收斂，而不是只有畫面有跑出來。

因此，後續要抽象成模板時，不應以 `GeneralDetailPanel.ts` 那種 legacy host 為真相，而應以：

1. `GeneralDetailComposite`
2. `GeneralDetailOverviewChild`
3. `general-detail-unified-screen`
4. `general-detail-unified-main`
5. `GeneralDetailOverviewBindPathPolicy`
6. `GeneralDetailOverviewVisuals`

作為第一個「可模板化」樣本。

補充：截至目前 repo 狀態，`GeneralDetailPanel.ts` 已從 live workspace 移除；canonical runtime truth 已明確收斂到 `GeneralDetailComposite + ChildPanel` 主幹，後續正式工具鏈、scene wiring 與規格描述都應以這組結構為準，而不再把 legacy host 視為正式真相。

---

## 3. UCUF UI 模板化的五層主幹

後續所有可量產 UI，建議都收斂成以下五層，不再跳過其中任一層：

### Layer 0. Visual Intake / Structure Decompose

定義這張畫面的視覺入口，回答「使用者丟進來的示意圖，如何先被拆成可問答、可編譯的結構草稿」。

應至少包含：

1. proof source（截圖、Figma、參考 PNG）
2. visual zones
3. component intents
4. spacing recipe
5. content slots
6. confidence / unresolved notes

Unity 對照：這一層像把美術稿先轉成一份技術美術可執行的 prefab breakdown sheet，而不是直接拿圖硬刻節點。

### Layer A. Family Registry

定義這類畫面的結構家族，回答「這張畫面大骨架是什麼」。

應至少包含：

1. family id
2. slot 拓樸
3. chrome 區塊
4. 可複用 fragment 清單
5. 預設 controller archetype
6. validation profile id

### Layer B. Screen Recipe / MCQ Bridge

定義這張畫面的組裝選項，回答「這個 family 這次要怎麼拼」，並承接 Layer 0 未解完的變數，轉成 MCQ 讓人類補決策。

應至少包含：

1. screen identity
2. family 選擇
3. zone / slot 分配
4. data sources
5. visual theme
6. feature toggles
7. smoke route
8. unresolved questions -> MCQ answers -> normalized recipe

### Layer C. Generator

把 normalized recipe 編譯成工程可直接接手的輸出物。

應產生：

1. layout / fragment / screen skeleton
2. panel / child panel scaffold
3. mapper / contract stub
4. review / runtime verdict skeleton
5. task card

### Layer D. Validation Pipeline

保證產出物不只是「能顯示」，而是可以通過固定 gate。

應至少包含：

1. schema / static validation
2. snapshot / regression validation
3. runtime route validation
4. screenshot / visual verdict
5. throughput metrics

---

## 4. 建議的 Family 清單

以下不是最終全集，而是應優先正式化的第一批 family。

### 4.1 `detail-split`

用途：人物頁、裝備詳情、虎符詳情、培育結果詳情。

結構特徵：

1. 左側主體（portrait / emblem / hero object）
2. 上方 meta chrome
3. 右側主內容區
4. 可選 tab rail
5. 1 個主 content slot + 0 到 N 個特殊 slot

Unity 對照：左側常駐角色展示 + 右側 tab content host 的角色詳情頁 Prefab family。

GeneralDetail 對應：

1. `OverviewSlot`
2. `ContentSlot`
3. `RightTabBar`
4. `TopLeftInfo / BottomLeftInfo`

### 4.2 `dialog-card`

用途：確認彈窗、獎勵彈窗、任務完成、選擇器。

結構特徵：

1. modal blocker
2. header
3. body content slot
4. footer CTA slot
5. 可選 badge / rarity plaque

Unity 對照：標準 Modal Window Controller + Header / Body / Footer prefab slots。

### 4.3 `rail-list`

用途：商店主頁、武將列表、背包、圖鑑。

結構特徵：

1. 左 rail filter / category
2. 中央 list/grid slot
3. 右側 preview / detail slot
4. toolbar / search / sorting chrome

Unity 對照：ListPageController + SelectionPreviewPanel。

### 4.4 `hud-overlay`

用途：BattleHUD、場景狀態條、上方資源列。

結構特徵：

1. 不遮 full scene
2. 多 anchor overlay zones
3. 極小 slot、極低 draw call budget
4. 多數資料走即時更新，不強依賴 tab

Unity 對照：多個 anchored HUD presenter 的 overlay canvas family。

### 4.5 `peek-drawer`

用途：日誌抽屜、側邊 peek card、summary drawer。

結構特徵：

1. 半浮層進出場
2. 單主內容 slot
3. header / tab 可選
4. 常與 `detail-split` 或 `rail-list` 配套使用

---

## 5. Screen Recipe 欄位規格

每一張要進 generator 的 UI，都應先有一份 recipe。但在這版藍圖裡，recipe 不再是人工開工時第一個填的東西，而是由「示意圖結構分解 + MCQ 收斂」共同產出的中介真相。建議流程如下：

1. 先給一份 UI 示意圖、Figma snapshot、或參考 PNG。
2. Agent 先執行結構分解，輸出 proof draft。
3. 由 proof draft 判斷可直接推導的 family / slot / component intent。
4. 只把仍未決定的結構變數轉成 MCQ 問題給使用者回答。
5. 回答完成後，才產出 normalized recipe，交給 generator。

也就是說，recipe 的角色比較像 Unity 裡真正進入 Editor Tool 的 Screen ScriptableObject，而不是最前端的人工作業表。

### 5.1 Recipe 必填欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `screenId` | string | screen 唯一 id，對應 `screens/*.json` |
| `uiId` | string | 對應 controller 類型或 composite 名稱 |
| `familyId` | string | 採用哪個 family |
| `variantId` | string | family 下的具體 variant |
| `bundle` | string | `lobby_ui` / `battle_ui` / `ui_common` |
| `layer` | string | Popup / HUD / Normal 等 |
| `contentSchemaId` | string | content contract schema id |
| `dataSources` | string[] | 這張畫面有哪些 child data source |
| `slots` | object[] | slot 分配表 |
| `chromeFlags` | object | 需要哪些 header / footer / tab / portrait chrome |
| `validationProfile` | string | 要套哪組驗收規則 |
| `smokeRoute` | string | 最小可驗證進入路徑 |

### 5.2 `slots` 欄位建議結構

```json
[
  {
    "slotId": "OverviewSlot",
    "fragment": "fragments/layouts/gd-tab-overview",
    "childPanel": "GeneralDetailOverviewChild",
    "dataSource": "overview",
    "mode": "specialized"
  },
  {
    "slotId": "ContentSlot",
    "fragment": "fragments/layouts/gd-tab-stats",
    "childPanel": "GeneralDetailStatsChild",
    "dataSource": "config",
    "mode": "tab-routed"
  }
]
```

### 5.3 `chromeFlags` 欄位建議結構

```json
{
  "hasPortrait": true,
  "hasTopMeta": true,
  "hasBottomSummary": true,
  "hasTabRail": true,
  "hasFooterActions": true,
  "hasOverviewSpecialSlot": true
}
```

### 5.4 `visualTheme` 建議欄位

雖然不是每張都必填，但建議 recipe 一開始就保留：

1. `skinFamily`
2. `frameRecipe`
3. `tokenTheme`
4. `rarityPresentation`
5. `ornamentPolicy`

這樣 generator 才能決定要直接 reuse、param-tune，還是開 partial asset task。

### 5.5 從示意圖進入 recipe 的收斂流程

建議新增一條固定 workflow：

1. `proofSource -> proof draft`
2. `proof draft -> family-map`
3. `family-map + unresolved fields -> MCQ`
4. `MCQ answers + family defaults -> normalized recipe`

其中：

1. `proof draft` 負責保留畫面結構真相。
2. `family-map` 負責把 proof draft 收斂成 structural family、themeStack、asset readiness 與 unresolved questions。
3. `MCQ` 只處理「圖上看不出來，但 generator 必須知道」的變數。
4. `normalized recipe` 才是後續 compiler 的正式輸入。

建議實作上，直接把 `ui-vibe-pipeline` 當成這條 workflow 的總控入口 skill，而不是再讓使用者手動決定先跑哪個子步驟。

這樣做的好處是，workflow 入口從「人要先懂整套 family 與欄位」改成「先看圖，再回答少數關鍵結構問題」。

---

## 6. Generator 輸入與輸出

### 6.1 Generator 的輸入

最小輸入集合建議如下：

1. `proof draft` 或可等價重建 proof 的 structure package
2. `family-map.json`
3. `MCQ answers` 或其他 unresolved decision package
4. `normalized recipe.json`
5. `family registry entry`
6. `content contract schema` 或 schema stub
7. `design tokens / skin family`
8. optional `reference package`
9. optional `existing runtime sample`

### 6.2 Generator 的輸出

建議 generator 不只產一個 screen，而要一次產出完整工作包。

| 輸出類型 | 建議檔案 |
|---|---|
| layout skeleton | `assets/resources/ui-spec/layouts/<screen>-main.json` |
| fragment skeletons | `assets/resources/ui-spec/fragments/layouts/*.json` |
| screen spec | `assets/resources/ui-spec/screens/<screen>-screen.json` |
| skin stub | `assets/resources/ui-spec/skins/<screen>-default.json` |
| panel scaffold | `assets/scripts/ui/components/<Screen>Composite.ts` |
| child panel scaffold | `assets/scripts/ui/components/<screen>/*Child.ts` |
| mapper stub | `assets/scripts/ui/components/<Screen>Mapper.ts` |
| bind policy stub | `...BindPathPolicy.ts` |
| validation profile | `tools_node/check-<screen>-regression.js` |
| review skeleton | `artifacts/ui-source/<screen>/review/generated-review.json` |
| runtime skeleton | `artifacts/ui-source/<screen>/review/runtime-verdict.json` |
| task card | `docs/ui-quality-tasks/<task-id>.json` 或等價 task card |

### 6.3 建議的 Generator 階段

建議拆成六段，避免單一工具過胖：

1. `reference -> proof draft`
2. `proof draft -> family-map`
3. `family-map -> MCQ package`
4. `MCQ answers -> normalized recipe`
5. `recipe -> structure / screen package`
6. `structure package -> validation package`
7. `structure package -> task package`

也就是說，真正要有的不是一支巨型 generator，而是一組 compiler / router：

1. `decompose-ui-reference-to-proof`（或等價 skill / tool）
2. `compile-proof-to-family-map.js`
3. `compile-proof-to-mcq.js`
4. `compile-mcq-answer-to-recipe.js`
5. `compile-recipe-to-screen-spec.js`
6. `compile-recipe-to-panel-scaffold.js`
7. `compile-recipe-to-validation-profile.js`
8. `compile-recipe-to-task-card.js`

若要從 proof draft 直接串完整 v0 工具鏈，則應再提供一支 orchestration front-end，例如：

9. `node tools_node/run-ui-vibe-workflow.js --proof-source <image> --screen-id <screen-id>`

---

## 7. GeneralDetail 作為第一個模板化範本時，recipe 應長什麼樣

以下是 `GeneralDetail` 應被抽象成 recipe 的樣子。

```json
{
  "screenId": "general-detail-unified",
  "uiId": "GeneralDetailComposite",
  "familyId": "detail-split",
  "variantId": "general-detail-v1",
  "bundle": "lobby_ui",
  "layer": "Popup",
  "contentSchemaId": "general-detail-content",
  "dataSources": ["overview", "config"],
  "chromeFlags": {
    "hasPortrait": true,
    "hasTopMeta": true,
    "hasBottomSummary": true,
    "hasTabRail": true,
    "hasFooterActions": true,
    "hasOverviewSpecialSlot": true
  },
  "slots": [
    {
      "slotId": "OverviewSlot",
      "routeKey": "Overview",
      "fragment": "fragments/layouts/gd-tab-overview",
      "childPanel": "GeneralDetailOverviewChild",
      "dataSource": "overview",
      "mode": "specialized"
    },
    {
      "slotId": "ContentSlot",
      "routeKey": "Basics|Stats|Bloodline|Skills|Aptitude|Extended",
      "fragmentFamily": "general-detail-tabs",
      "childPanels": [
        "GeneralDetailBasicsChild",
        "GeneralDetailStatsChild",
        "GeneralDetailBloodlineChild",
        "GeneralDetailSkillsChild",
        "GeneralDetailAptitudeChild",
        "GeneralDetailExtendedChild"
      ],
      "dataSource": "config",
      "mode": "tab-routed"
    }
  ],
  "validationProfile": "detail-split-popup-strict",
  "smokeRoute": "LobbyScene -> GeneralList -> GeneralDetailComposite.show()"
}
```

這份 recipe 的重點，不是把所有實作細節都寫死，而是把真正會影響 generator 的變化點寫出來。

---

## 8. 驗收 Pipeline

所有模板化產物，應走同一條驗收主幹。

### Stage 0. Reference Intake / Proof Draft 完整性

檢查：

1. 是否有明確的 proof source
2. visual zones 是否足夠覆蓋主要畫面區塊
3. content slots 是否非空
4. unresolved notes 是否清楚標出

### Stage 1. MCQ 收斂與 Recipe 完整性

檢查：

1. 必填欄位是否齊備
2. family 是否存在
3. slot 拓樸是否合法
4. dataSource 是否有對應 child panel
5. proof draft 中 unresolved fields 是否已收斂進 MCQ answers

### Stage 2. 結構靜態驗證

執行：

```bash
node tools_node/validate-ui-specs.js --strict --check-content-contract
```

檢查：

1. layout / skin / screen schema
2. content contract 存在性
3. widget / layout / slot 規則
4. skin slot / token 合法性

### Stage 3. Snapshot Regression

執行：

```bash
node tools_node/headless-snapshot-test.js
```

必要時：

```bash
node tools_node/layout-diff.js --git <file>
```

目的：確保 generator 改動不會無聲破壞既有 family。

### Stage 4. Screen-specific Regression Guard

例如 `GeneralDetail` 這類 canonical sample，應有自己的 regression guard，例如：

1. canonical slot route 不可回退
2. contract alias 不可遺失
3. composite 不可重新引入 legacy shell 特例

這一層是模板化後最重要的保險，因為它保護的是「架構 invariant」，不是單次畫面結果。

### Stage 5. Runtime Smoke Route

檢查最小進入路徑是否真的能打開畫面，且 child panel 會收到資料。

對 `GeneralDetail` 而言，至少應驗：

1. `LobbyScene -> GeneralList -> show(detail)`
2. `OverviewSlot` 可正確 mount
3. `switchTab()` 後各 child panel 正常顯示

### Stage 6. Visual Verdict

輸出：

1. `review/generated-review.json`
2. `review/runtime-verdict.json`

判準：

1. 是否 clean pass
2. 是否僅 residual polish
3. 是否有 blocker

### Stage 7. Throughput Metrics

記錄：

1. scaffold 完成時間
2. runtime rounds
3. rework rounds
4. generate-partial-asset 區塊數量
5. reuse-only / param-tune 比例

只有進入這一層，才有辦法回答「模板化是否真的讓 UI 開發更快」。

---

## 9. Task Card 自動化應如何接進來

模板化的目標不是只產 code，而是自動開出對的任務卡。

建議 `compile-recipe-to-task-card.js` 至少輸出以下欄位：

1. `type`
2. `screen_id`
3. `family_id`
4. `fragments_owned`
5. `content_contract_schema`
6. `data_sources_owned`
7. `verification_commands`
8. `smoke_route`
9. `deliverables`
10. `acceptance`

也就是直接對齊既有 `UCUF UI Task Card Template`，避免任務卡又變成另一套平行格式。

對 Agent 來說，理想流程會變成：

1. 人先給一份 UI 示意圖 / Figma snapshot / 參考 PNG
2. workflow 先產 proof draft，分析 visual zones、slots、component intents
3. 系統只針對 unresolved fields 生成 MCQ
4. MCQ answers 被收斂成 normalized recipe
5. generator 產 screen package
6. generator 同步產 task card
7. Agent 接 task card 實作 screen-specific 邏輯
8. pipeline 自動回填驗收結果

---

## 10. 建議的 MCQ 收斂方向

如果未來要做到「先看圖、再回答最少量的問題就能開工」，MCQ 至少要能覆蓋以下問題：

1. 這張畫面屬於哪個 family？
2. 是否有 portrait / hero object？
3. 是否需要 tab rail？
4. 是否有 overview special slot？
5. 主資料源是單一 source，還是多個 child source？
6. 是否需要 footer CTA？
7. 視覺主題屬於哪個 skin family？
8. 是 reuse-only、param-tune，還是 generate-partial-asset？
9. smoke route 從哪個 scene 進？
10. 驗收 profile 要走哪一組？

也就是說，MCQ 不應再被視為 workflow 的入口，而應被視為「proof draft 之後的決策收斂層」。

它的責任不是決定畫得漂不漂亮，而是補上這些圖面本身無法 100% 推斷、但 generator 必須知道的結構變數。

理想狀態下，MCQ 問題數量應隨 family 與 proof 品質下降，而不是維持一份固定的大問卷。

---

## 11. 後續落地順序

建議依下列順序推進，而不是一次想把整個工廠做完。

### Phase 0. 建立示意圖入口與 proof draft

先做：

1. 定義 `proofSource` 與 proof draft 格式
2. 固定 `ui-reference-decompose` 的輸出欄位
3. 確認 proof draft 可以對接 family / slots / content slots

目標：讓 workflow 可以從「給一張圖」開始，而不是從「先填一份 recipe」開始。

### Phase 1. 把 family 與 proof / recipe 正式化

先做：

1. `detail-split`
2. `dialog-card`
3. `rail-list`

目標：先讓 70% 的常見 popup 與詳情頁可被 proof + recipe 描述。

### Phase 2. 做 `proof -> MCQ -> recipe` bridge

讓系統可以：

1. 從 proof draft 自動推 family 建議
2. 只針對 unresolved fields 出題
3. 把答案收斂成可驗證的 recipe

### Phase 3. 做第一版 recipe compiler

先產：

1. screen JSON
2. layout skeleton
3. CompositePanel scaffold
4. ChildPanel scaffold

### Phase 4. 做 validation package compiler

讓每一張新畫面自動有：

1. regression guard stub
2. generated-review skeleton
3. runtime-verdict skeleton

### Phase 5. 接 task card compiler

讓 Agent 不用每次手工整理交付物、驗收命令、smoke route。

### Phase 6. 做圖驅動 orchestration front-end

到這一步，workflow 才真正完成「示意圖 -> proof -> MCQ -> recipe -> generator -> 驗收」的一站式入口。

建議承接這個 Phase 6 的正式入口 skill 為 `ui-vibe-pipeline`，由它負責編排 proof、brief、task card、scaffold、驗證、Browser QA 與最終人類驗收 handoff。

---

## 12. 完成定義

可以宣稱 `UCUF UI 模板化藍圖` 進入可用狀態，至少要同時滿足：

1. 給一份 UI 示意圖後，系統可以先輸出 proof draft，而不是要求人手填完整 recipe。
2. proof draft 的 unresolved fields 可以被自動轉成 MCQ。
3. MCQ answers 可以被收斂成合法的 normalized recipe。
4. `GeneralDetail` 已被正式登記為 `detail-split` canonical sample。
5. 至少 3 個 family 有正式 proof / recipe 描述能力。
6. 至少 1 支 recipe compiler 能輸出 `layout + screen + panel scaffold`。
7. 至少 1 支 task card compiler 能輸出可執行任務卡。
8. 新 screen 可在不手刻大半節點的前提下，從示意圖一路進到 runtime verdict。

---

## 13. 一句話總結

`GeneralDetail` 這次真正留下來的，不是一張人物頁，而是一種方法：把 UI 從「手工堆畫面」改成「示意圖先分解、family 定骨架、MCQ 補結構變數、recipe 定變化、generator 產結構、pipeline 做驗收」。後續只要持續把這條線 formalize，UI 開發就會從專案製作，逐步升級成可重複的組裝式工作流。

---

## 14. 機器可讀結構初稿

這份藍圖現在對應到第一批機器可讀檔案：

1. `docs/ui/ucuf-screen-recipe.schema.json`
2. `docs/ui/ucuf-screen-recipe.enums.json`
3. `docs/ui/examples/general-list-screen.recipe.json`

而要支援新的圖驅動入口，下一批必補的機器可讀結構應為：

1. `assets/resources/ui-spec/proof/screens/<screenId>.proof.json`
2. `artifacts/ui-source/<screen-id>/proof/<screen-id>.family-map.json`
3. `artifacts/ui-source/<screen-id>/design-brief.md` 或等價 brief
4. `artifacts/ui-source/<screen-id>/mcq/*.json` 或等價問答收斂包

定位如下：

1. `recipe.schema.json` 是 generator 的資料契約，也是 proof / MCQ 收斂完成後的正式輸入。
2. `field enum` 是 UI family / bundle / layer / slot mode / validation profile 的受控字典。
3. `GeneralList` sample recipe 是第一個 `rail-list` family 的機器可讀樣本。
4. `proof.json` 應成為「從示意圖進 workflow」的第一個正式結構化輸出。
5. `family-map.json` 應成為「proof 已被結構化路由到 family / asset readiness / unresolved questions」的第一個正式中介真相。

### 14.1 這一版 schema 的範圍

第一版先只處理「screen recipe 層」，也就是：

1. family / variant
2. controller kind / class
3. content schema id
4. data source 定義
5. slot 拓樸
6. chrome flags
7. generation policy
8. validation profile
9. smoke route

這代表第一版 generator 已經可以吃一份穩定的 recipe 輸入，但圖驅動入口仍需補上 proof / MCQ bridge，才算完成新的工作流目標。

---

## 15. 用 GeneralList 推動第一版工具鏈

`GeneralList` 適合拿來做第一版 compiler，不是因為它最複雜，而是因為它剛好落在「已有 Composite、已有 screen/layout/contract、但還沒正式 recipe 化」的甜蜜點。

如果用 Unity 類比：它像一個已經能跑的 `RosterScreenController`，現在要做的不是重畫，而是先讓系統可以從一張 UI 示意圖推回 prefab breakdown，再把建構參數抽成 ScriptableObject，最後讓工具從這份 ScriptableObject 生成 screen spec 與任務卡。

也就是說，`GeneralList` 的 v0 已經驗證了 `recipe -> screen/task` 這段；下一步要補的是更前面的 `image -> proof -> MCQ -> recipe`。

### 15.1 `compile-recipe-to-screen-spec.js` v0 範圍

第一版建議故意收窄，只做以下事情：

1. 讀入 `recipe.schema.json` 合法的 recipe
2. 驗證 `screenId / layoutId / skinId / contentSchemaId` 是否存在或可產生
3. 產出或更新 `screens/<screen>.json`
4. 補齊 `uiId / bundle / layer / validation`
5. 若 recipe 指向既有 layout / skin，先不自動改寫 layout 與 skin

也就是說，`GeneralList` 在 v0 階段應被視為「existing-screen normalization sample」，不是 full scaffold sample。

#### v0 輸入

1. `docs/ui/examples/general-list-screen.recipe.json`

#### v0 輸出

1. `assets/resources/ui-spec/screens/general-list-screen.json` 的標準化內容
2. optional `artifacts/ui-source/general-list/generated/screen-spec.diff.json`
3. optional `artifacts/ui-source/general-list/review/generated-review.json` skeleton

#### v0 不做的事

1. 不改 layout 節點樹
2. 不生成 skin slots
3. 不生成 child panel 代碼
4. 不判定 partial asset 任務

### 15.2 `compile-recipe-to-task-card.js` v0 範圍

第一版建議直接對齊既有 `UCUF UI Task Card Template`，讓輸出可直接交給 Agent 執行。

#### v0 從 recipe 推導的欄位

1. `type`
2. `screen_id`
3. `content_contract_schema`
4. `data_sources_owned`
5. `verification_commands`
6. `smoke_route`
7. `deliverables`
8. `acceptance`

#### GeneralList 建議輸出語意

對 `GeneralList` 而言，第一版 task card 應偏向：

1. `type = composite-panel`
2. `screen_id = general-list-screen`
3. `family_id = rail-list`
4. `data_sources_owned = [generals]`
5. `deliverables` 先聚焦於 `screen spec normalization + review skeleton`

這樣做的好處是：第一版工具鏈先解決「怎麼把 recipe 變成可執行任務」，而不是一開始就把所有 scaffold、asset routing、layout 編譯全塞進同一支 script。

### 15.3 建議 CLI 介面

```bash
node tools_node/compile-recipe-to-screen-spec.js --recipe docs/ui/examples/general-list-screen.recipe.json --dry-run
node tools_node/compile-recipe-to-screen-spec.js --recipe docs/ui/examples/general-list-screen.recipe.json --write

node tools_node/compile-recipe-to-task-card.js --recipe docs/ui/examples/general-list-screen.recipe.json --dry-run
node tools_node/compile-recipe-to-task-card.js --recipe docs/ui/examples/general-list-screen.recipe.json --out artifacts/ui-source/general-list/generated/general-list-task-card.md

node tools_node/check-general-detail-lobby-flow-smoke.js --outDir artifacts/ui-qa/<run-id>
```

### 15.4 第一版完成判準

用 `GeneralList` 驗證時，至少要能回答以下問題：

1. recipe 是否能穩定通過 schema 驗證？
2. `compile-recipe-to-screen-spec.js` 是否能從 recipe 重建出不漂移的 screen metadata？
3. `compile-recipe-to-task-card.js` 是否能產出 Agent 可以直接接手的任務卡？
4. 同一份 recipe 重跑兩次，輸出是否穩定且 idempotent？
5. 以 `LobbyScene -> onClickGeneralList() -> GeneralListPanel -> GeneralDetailComposite -> Skills child` 為代表的產品流 smoke，是否能穩定 clean pass？

只要這五點成立，就代表藍圖已從概念文，正式進入可工具化的第一階段；而第二階段則是把這份 recipe 改成由示意圖與 MCQ 自動收斂出來。

---

## 16. 目前完成度與里程碑 Check List

以下勾選狀態以目前 repo 已落地內容為準。

### Milestone M0. `GeneralDetail` 架構收斂

- [x] `CompositePanel + ChildPanel` 主幹已成立
- [x] `Overview` 已有獨立 child panel
- [x] tab 已統一收斂到 `slot + child panel + switchTab()` 路線
- [x] overview 已拆成 mapper / bind policy / visuals
- [x] canonical runtime truth 已轉移到 `GeneralDetailComposite + ChildPanel`
- [ ] legacy `GeneralDetailPanel` 已物理刪除，且 scene / spec / docs 不再依賴它

#### M0a. `GeneralDetailPanel` 實體退場盤點（2026-04-16）

目前尚未能把 M0 最後一格勾掉，原因不是 scene wiring，而是仍有以下 legacy 殘留：

1. `assets/scripts/ui/components/GeneralDetailPanel.ts` 已刪除；目前剩下的 runtime 主幹是 `GeneralDetailComposite + Overview child`，不再保留 compat class-name shim。
2. `assets/resources/ui-spec/layouts/general-detail-main.json`、`skins/general-detail-default.json`、`screens/general-detail-screen.json` 仍存在；但 unified runtime 已改由 `general-detail-unified-base` 承接 base，因此剩餘債務是 legacy spec 組仍待退場，不再是 unified 對舊 base 的 hard dependency。
3. `GeneralDetailOverviewShell.ts` / `GeneralDetailOverviewShellResources.ts` 已從 runtime code 移除；剩下待清的是與它們同時代的 legacy spec / 長尾歷史 docs 敘述，而不是 controller 主幹本身。
4. `docs/cross-ref/*`、`武將人物介面規格書.md` 等正式文件已同步到「canonical runtime = `GeneralDetailComposite + Overview child`、legacy spec = archival reference」的 wording；下一步是逐步清理長尾歷史文件。
5. smoke 驗證必須持續守住 `LobbyScene -> onClickGeneralList() -> GeneralListPanel -> GeneralDetailComposite -> Skills child` 這條產品流，避免未來又偷偷繞回 legacy route。

因此，真正可關閉 M0 的條件應是：

1. `GeneralDetailPanel.ts` 與 `GeneralDetailOverviewShell.ts` 的最後使用點被替換或刪除。
2. `general-detail-main/default/screen` 舊 spec 組不再被 runtime 消費。
3. 正式文件已收斂到「live runtime shim 已刪除、legacy spec = archival reference」；待 legacy spec 組實體退場完成後，再進一步收斂到「legacy 已刪除」。
4. 上述產品流 smoke 仍保持 clean pass。

### Milestone M1. Canonical sample 與 family 基底

- [x] `GeneralDetailComposite` 已存在
- [x] `GeneralDetailOverviewChild` 已存在
- [x] `GeneralDetailOverviewBindPathPolicy` 已存在
- [x] `GeneralDetailOverviewVisuals` 已存在
- [x] unified screen spec 已存在
- [ ] `GeneralDetail` 已正式登記為 `detail-split` canonical registry entry
- [ ] family registry 已有正式機器可讀入口

### Milestone M2. 圖驅動入口

- [x] 已有 `ui-reference-decompose` workflow 可描述「示意圖 -> proof draft」這一步
- [x] 已有正式 `proof.json` 產物納入這份藍圖的 runtime 工具鏈
- [x] 已有一條從 UI 示意圖直接啟動的固定入口命令或 orchestration：`node tools_node/run-ui-vibe-workflow.js --proof-source <image> --screen-id <screen-id>`
- [x] 已有一條從 `proof.json` 直接啟動的固定 orchestration：`node tools_node/run-ui-vibe-workflow.js`
- [x] proof draft 產出後可自動判定 family 建議
- [x] proof draft 已可產出對應的 `family-map.json`

### Milestone M3. MCQ bridge

- [x] proof draft 的 unresolved fields 可自動轉成 MCQ
- [x] MCQ answers 可自動回填成 normalized recipe
- [x] MCQ 已從「入口表單」改成「第二階段決策收斂」

### Milestone M4. Recipe 與 compiler v0

- [x] recipe schema 已存在
- [x] field enums 已存在
- [x] `GeneralList` sample recipe 已存在
- [x] `compile-recipe-to-screen-spec.js` 已存在
- [x] `compile-recipe-to-task-card.js` 已存在
- [ ] `GeneralDetail` canonical recipe 檔已正式落地
- [ ] 至少 3 個 family 都有完整 proof / recipe 範例

### Milestone M5. Scaffold / validation package

- [x] generated review skeleton 已可產出
- [x] runtime verdict skeleton 已可產出
- [x] intake / asset-task-manifest skeleton 已可選擇產出
- [x] `compile-recipe-to-panel-scaffold.js` 已完成
- [ ] `compile-recipe-to-validation-profile.js` 已完成
- [ ] screen-specific regression guard 已形成常規化 compiler 輸出

### Milestone M6. 從圖到驗收的閉環

- [ ] 可以從 UI 示意圖一路走到 proof draft
- [x] 可以從 proof draft 一路走到 MCQ
- [x] 可以從 MCQ 一路走到 normalized recipe
- [x] 可以從 recipe 一路走到 screen package + task card
- [ ] 可以從 screen package 一路走到 runtime verdict
- [ ] 整條流程可讓 Agent 在少量 screen-specific 邏輯下完成新畫面生產

### 目前總結

目前狀態可判定為：

1. `GeneralDetail` 已證明 UCUF 主幹可行。
2. `recipe -> screen/task/review skeleton` 已進入 v0 可用。
3. `proof draft -> family-map -> MCQ -> normalized recipe -> screen/task package` 已有 v0 bridge 與 orchestration。
4. 新目標要求的「示意圖 -> 結構分析 -> MCQ -> 自動化生產 -> runtime 驗證」尚未完全打通。
5. 因此這份藍圖現在屬於「proof 起點已打通、raw image 起點與最終 runtime 閉環未完工」的階段。