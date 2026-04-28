<!-- doc_id: doc_other_0011 -->
# HTML Skill Plan 2

## 1. 文件目的

本文件定義 HTML-to-UCUF skill 的第二版正式目標：從「HTML / CSS 草稿轉成 UCUF JSON」升級為「指定來源目錄、轉成 Cocos UI、並以 Cocos Editor 實際畫面對 HTML 來源畫面達 95% 以上相似度」的閉環流程。

舊版 `docs/html_skill_plan.md` 仍保留為工具演進歷史與 Phase A 參考；本文件優先處理這次驗證暴露出的核心問題：browser 端 `source HTML vs UCUF preview` 分數不能代表 Cocos runtime fidelity。新版 skill 的最終通過條件必須看 `HTML source screenshot vs Cocos Editor screenshot`。

Unity 對照：舊流程像是把 UXML / USS 轉成 ScriptableObject 草稿；新版流程要進一步完成 Prefab 實機畫面驗收，以 Game View / Editor Preview 截圖與原始設計稿做百分比比對，沒有達標不得宣稱 production-ready。

## 2. Skill 目標

HTML-to-UCUF v2 的目標如下：

1. 以 source package 作為唯一正式輸入，不再讓 HTML、token、CSS 分散在不同隱性預設路徑。
2. 在流程開始前驗證 `ui-design-tokens.json`、`colors_and_type.css`、主要 HTML 都存在且合法。
3. 把 HTML / CSS / token 中可規則化的資訊拆解成 UCUF layout / skin / screen / sidecar。
4. 明確標出無法直譯到 Cocos 的 CSS primitive，改走 assetize、skin layer、manual rewrite 或 rule evolution。
5. 將 browser preview compare 降級為前置診斷，不得作為最終通過依據。
6. 以 Cocos Editor 目前畫面的 screenshot 對 HTML source reference screenshot 做 pixel score，`runtimeVsSource.score >= 0.95` 才能通過。
7. 當解析不足或分數低於門檻時，把可改進規則回寫 `docs/html_skill_rule-evolution2.md`，讓後續 skill run 能讀取已接受規則並自動改善。

## 3. 與舊版流程的關係

舊版流程仍可作為 Phase A 的局部工具集，但以下觀念在 v2 中必須修正：

| 舊觀念 | v2 修正 |
|---|---|
| `--input <html>` 是正式入口 | 正式入口改為 `--source-dir <dir>`；`--input` 僅保留 debug / legacy alias |
| browser `sourceVsUcuf` 達 95% 可以視為通過 | 只能視為前置診斷；最終 gate 必須是 Cocos Editor screenshot vs HTML source screenshot |
| token registry 可依賴 runtime + old handoff 預設 | source package 的 `ui-design-tokens.json` 是本畫面的 authority；runtime token 只能補充 |
| HTML link CSS 只要 browser 看得到即可 | converter 必須也吃得到 `colors_and_type.css`；不能只在 snapshot 階段可見 |
| `runtime-screen-diff.js --runtime` 有圖即可 cutover | `runtimeVsSource.score` 不得為 null；必須實際計分 |
| skip annotate / optimize / compare 後仍可宣稱 workflow pass | skip 類參數只能 debug；正式流程不可用 skip 結果通過 |

## 4. Source Package Contract

### 4.1 必要輸入

正式 skill input 必須指定來源目錄：

```bash
node tools_node/run-ui-workflow.js --workflow html-to-ucuf \
  --source-dir "Design System 3" \
  --main-html "ui_kits/character/index.html" \
  --screen-id character-ds3-main \
  --bundle lobby_ui
```

`--source-dir` 指向的目錄必須包含：

| 檔案 | 用途 | 必要性 |
|---|---|---|
| `ui-design-tokens.json` | 本畫面 color / spacing / typography authority | 必要 |
| `colors_and_type.css` | CSS variables、font-face、全域 type/color style | 必要 |
| 主要 HTML | 實際畫面來源；可為 static HTML 或需要 pre-render 的 HTML | 必要 |

若 source dir 下只有一個 HTML，可自動視為 main HTML；若有多個 HTML，必須提供 `--main-html <relativePath>`。`--main-html` 必須是 source dir 內的相對路徑，不得使用絕對路徑或 `..` 穿出 source dir。

### 4.2 起始合法性檢查

新增 source package validator，流程一開始就檢查：

1. `--source-dir` 存在且為目錄。
2. `ui-design-tokens.json` 存在、可 parse，且至少包含 `colors`、`spacing`、`typography` 三個 root key。
3. `colors_and_type.css` 存在、可讀，且包含 `:root` 或 CSS variable 定義。
4. main HTML 存在、可讀，且 `<body>` 內有可渲染根節點。
5. HTML 中的 `<link rel="stylesheet">` 必須能解析到本地檔案；若連到外部 URL，必須列入 unsupported external dependency。
6. source package hash 必須寫入 manifest：HTML hash、CSS hash、token hash、source dir path、main HTML path、viewport。

任何必要檔案缺失或 JSON / HTML / CSS 不合法，CLI 直接 exit 2，不可等到轉換中段才 fallback。

### 4.3 Source Package Manifest

每次 run 都要輸出：

```text
artifacts/skill-test-html-to-ucuf/<screen-id>/<screen-id>.source-package.json
```

建議 schema：

```json
{
  "screenId": "character-ds3-main",
  "sourceDir": "Design System 3",
  "mainHtml": "ui_kits/character/index.html",
  "tokens": "ui-design-tokens.json",
  "css": "colors_and_type.css",
  "hashes": {
    "html": "sha256:...",
    "css": "sha256:...",
    "tokens": "sha256:..."
  },
  "validatedAt": "2026-04-28T00:00:00.000Z",
  "warnings": []
}
```

## 5. CLI 契約與過時參數清理

### 5.1 新版正式入口

正式入口為：

```bash
node tools_node/run-ui-workflow.js --workflow html-to-ucuf \
  --source-dir <dir> \
  --main-html <relative-html> \
  --screen-id <screen-id> \
  --bundle <bundle> \
  --editor-screenshot <png>
```

`--editor-screenshot` 可由 `cocos-screenshot` skill / PrintWindow 產生；若要自動化，後續可新增 `--editor-target <target>` 由工具包裝截圖流程。

### 5.2 內部與 debug 參數

以下參數降級為內部或 debug 用途，不得在 skill 正式流程中作為主要入口：

| 參數 | v2 狀態 | 原因 |
|---|---|---|
| `--input <html>` | legacy / debug alias | 無法保證 tokens/CSS 與 HTML 同源 |
| `--tokens-runtime` / `--tokens-handoff` | internal only | 常規來源應由 source package 提供 |
| `--content-contract` | 待決 | 若不能接到 annotation / validation，從 public flow 移除 |
| `--skip-annotate` | debug only | 正式流程不可跳過語意補強後宣稱通過 |
| `--skip-optimize` | debug only | 正式流程不可跳過 runtime node budget |
| `--skip-compare` | debug only | 正式流程不可跳過視覺診斷 |
| `--warn-only` | debug only | 正式 flow 必須 fail-fast |

### 5.3 建議新增工具模組

| 模組 | 職責 |
|---|---|
| `tools_node/lib/html-to-ucuf/source-package.js` | 解析與驗證 source dir、main HTML、token、CSS、hash manifest |
| `tools_node/compare-html-to-cocos-editor.js` | HTML reference screenshot vs Cocos Editor screenshot pixel score |
| `tools_node/lib/dom-to-ui/css-capability-matrix.js` | CSS property supported / assetize / unsupported 分流 |
| `tools_node/lib/dom-to-ui/rule-evolution2.js` | 產生與讀取 rule-evolution2 entry |

## 6. 拆解搬到 Cocos 的原理

### 6.1 Pre-render 與 DOM 來源

HTML 若使用 React / Babel / Vue / Svelte / runtime script 產生主要 DOM，不可直接丟給靜態 parser。必須先用 browser pre-render 取得 `document.documentElement.outerHTML` 與 computed style snapshot。

輸入 HTML 的 `<link rel="stylesheet">` 與 source package 的 `colors_and_type.css` 都必須被 converter 讀取。browser 能看到 CSS 不代表 JSON converter 已吃到 CSS。

### 6.2 DOM -> UCUF Layout

DOM 結構轉成 UCUF layout 時，遵守以下映射：

| HTML / CSS 意圖 | UCUF / Cocos 對應 |
|---|---|
| page root / fixed viewport | root canvas + fill widget |
| generic block | `container` |
| visual panel / background block | `panel` + skin slot |
| `img` / background image | `image` 或 skin sprite layer |
| `p` / `span` / heading | `label` |
| `button` / clickable element | `button` + interaction draft |
| `display:flex` | Cocos `Layout` horizontal / vertical |
| `display:grid` | Cocos grid layout contract |
| `gap` / `padding` | layout spacing / widget inset |
| tab area | `lazySlot` 或 `child-panel` route |
| scroll area | `scroll-view` contract |

layout 不得存放 hex color、font path、local absolute path、`db://` raw path 或 Cocos class name。

### 6.3 CSS / Token -> UCUF Skin

skin 負責承接視覺素材與文字樣式：

1. color：優先映射 source token；不能映射者進 token suggestion / evolution2。
2. typography：fontSize、lineHeight、fontWeight、letterSpacing 反查 source token。
3. spacing：padding、gap、margin 反查 spacing token；無 token 時保留 px 並列入 suggestion。
4. image：本地素材轉 sprite-frame 候選；不允許直接寫本機絕對路徑。
5. button state：normal / hover / pressed / disabled / focus 必須有 state layer 或明確 warning。

### 6.4 CSS Effect 三分流

HTML/CSS 中的視覺 primitive 分成三類：

| 類別 | 處理方式 | 範例 |
|---|---|---|
| supported | 直接轉成 layout / skin | color、fontSize、lineHeight、padding、gap、basic border |
| assetize | 產出 skin layer 或 asset task | gradient、shadow、ornate border、complex background |
| unsupported | 產 evolution2 candidate，不可靜默 fallback | filter、clip-path、blend mode、pseudo-element content、complex animation |

大面積視覺差異通常來自 gradient / shadow / filter / pseudo-element / font-face / background image，而不是少數字級或間距。v2 報告必須把 top offender 列出來，避免把全局差異誤判成局部微調。

### 6.5 Runtime Contract

畫面能看不代表能上線。正式 cutover 前必須確認：

1. content contract 不丟失。
2. button / tab / route / modal interaction 不丟失。
3. lazySlot / ChildPanel route 可被 runtime mount。
4. runtime state 走 registry 或 component-owned provider。
5. CompositePanel / ChildPanel smoke route 通過。

## 7. 完整驗證方法

### 7.1 Gate 分層

| Gate | 目的 | 通過條件 |
|---|---|---|
| Source package gate | 確認三件套與 HTML 合法 | validator pass |
| Convert gate | layout / skin / screen 可生成 | raw pass + strict replay pass |
| UCUF schema gate | 專案 JSON 契約合法 | `validate-ui-specs.js --strict --check-content-contract` pass |
| Browser diagnostic gate | 早期看到 source vs UCUF preview 差異 | 只輸出診斷，不作 final pass |
| Cocos Editor visual gate | 最終 fidelity 驗收 | `runtimeVsSource.score >= 0.95` |
| Logic / interaction gate | 防止功能被洗掉 | logic guard / smoke route pass |
| Evolution gate | 失敗可學習 | fail 時產 evolution2 candidate |

### 7.2 HTML Source Reference Screenshot

source reference screenshot 必須使用同一份 source package：

1. main HTML。
2. `colors_and_type.css`。
3. `ui-design-tokens.json`。
4. 相同 viewport / design canvas。
5. 同一套 font fallback policy。

若 source HTML 需 pre-render，reference screenshot 應以 pre-render 後 DOM 為準，並保存 rendered HTML artifact。

### 7.3 Cocos Editor Screenshot

Cocos screenshot 必須來自 Editor / Editor Preview 目前畫面。短期由 `cocos-screenshot` skill 使用 PrintWindow 產生 PNG，然後傳給 compare CLI：

```bash
node tools_node/compare-html-to-cocos-editor.js \
  --source-dir "Design System 3" \
  --main-html "ui_kits/character/index.html" \
  --screen-id character-ds3-main \
  --editor-screenshot artifacts/screenshots/character-ds3-editor.png \
  --output artifacts/runtime-diff/character-ds3
```

工具必須輸出：

1. `<screen>.html-cocos-verdict.json`
2. `<screen>.html-cocos-compare.png`
3. `<screen>.html-cocos-heatmap.png`
4. `<screen>.html-cocos-source.png`
5. `<screen>.html-cocos-editor-crop.png`
6. `<screen>.html-cocos-top-offenders.json`

### 7.4 Score 規則

正式 score 欄位：

```json
{
  "runtimeVsSource": {
    "score": 0.956,
    "threshold": 0.95,
    "verdict": "pass"
  }
}
```

規則：

1. `score >= 0.95`：pass。
2. `0.90 <= score < 0.95`：fail，需要人工審查與 evolution2 candidate。
3. `score < 0.90`：blocker，通常代表 renderer / token / CSS ingestion 系統性問題。
4. `score:null`：fail，不得 cutover。
5. 動態文字、游標、loading spinner、Editor chrome 必須用 crop / waiver 明確處理，不得用全圖雜訊掩蓋。

### 7.5 Browser Diagnostic 命名

舊 `runtime-screen-diff.js` 中的 `sourceVsUcuf` 在 v2 改名為：

```json
{
  "sourceVsUcufPreview": {
    "score": 0.96,
    "role": "diagnostic-only"
  }
}
```

這個分數只代表 browser renderer 下的 UCUF preview 與 source 相似，不代表 Cocos Editor runtime 相似。

## 8. Rule Evolution 2 正向循環

### 8.1 觸發條件

以下任一狀況都要產生 `docs/html_skill_rule-evolution2.md` candidate：

1. source package validator fail。
2. linked CSS 未被 converter 攝取。
3. token suggestion count 超過 strict 門檻。
4. unsupported CSS property 出現在大面積區域。
5. Cocos Editor visual score 低於 0.95。
6. `runtimeVsSource.score` 為 null。
7. logic guard / interaction guard 發現功能丟失。

### 8.2 Entry 欄位

每筆 candidate 必須包含：

| 欄位 | 說明 |
|---|---|
| suggestion id | 穩定唯一 id |
| status | `candidate` / `accepted` / `rejected` / `applied` |
| source package | source dir、main HTML、hash |
| screenId | 目標畫面 |
| before score | 失敗分數或 null |
| top offenders | CSS property、token、asset、zone |
| proposed rule | 建議新增 mapper / assetize / waiver / validator 規則 |
| safety | auto-applicable / reviewer-required |
| verification | 接受後要跑的命令 |
| applied by | reviewer / agent / commit 或 PR |

### 8.3 下一輪自動套用

skill 開始時讀取 evolution2：

1. `accepted` + `auto-applicable`：可套到 sandbox 轉換流程。
2. `accepted` + `reviewer-required`：只能提示，不自動修改正式產物。
3. `candidate`：只列入報告，不自動套用。
4. `rejected`：不再提示，除非同樣 gap 重新出現且 source hash 不同。

套用後仍必須跑完整 gate；規則套用不等於 pass。

## 9. 里程碑

| 里程碑 | 目標 | 代表產出 | 驗證 |
|---|---|---|---|
| M0 | 文件重建 | `html_skill_plan2.md`、`html_skill_rule-evolution2.md`、skill 入口改寫 | doc_id assign + encoding clean |
| M1 | Source Package Validator | `source-package.js`、`.source-package.json` | 缺 token/CSS/HTML 時 exit 2 |
| M2 | CLI Contract Cleanup | `--source-dir` / `--main-html` 正式接線，舊參數降級 | wrapper help 與 self-test |
| M3 | Token/CSS Authority | source token / CSS 進 converter 與 sidecar | linked CSS fixture pass |
| M4 | CSS Capability Matrix | supported / assetize / unsupported report | top offender report 可機讀 |
| M5 | UCUF Generation Gate | raw / optimized / final strict replay | validate + content contract pass |
| M6 | Cocos Editor Runtime Gate | HTML vs Editor screenshot scoring | `runtimeVsSource.score >= 0.95` |
| M7 | Rule Evolution Loop | fail -> evolution2 candidate -> accepted rule -> next run | candidate / accepted / applied test |
| M8 | DS3 Character Pilot | Design System 3 人物頁全流程 | Editor score >= 0.95 或產 blockers |
| M9 | Regression / CI Hardening | self-test、snapshot、encoding、verdict regression | CI / local check 全綠 |

### 2026-04-28 Implementation Status

本輪已完成 v2 toolchain：source package validator、source token/CSS authority、CSS capability report、HTML source vs Cocos Editor screenshot gate、evolution2 candidate feedback、workflow verdict hardening 與 regression self-test。M8 的 DS3 pilot 仍需要指定實際 Cocos Editor screenshot 作為正式畫面輸入；未提供該截圖時，只能驗證工具鏈與 synthetic Editor screenshot fixture。

## 10. Checklist

### M0 文件重建

- [x] 建立 `docs/html_skill_plan2.md`。
- [x] 建立 `docs/html_skill_rule-evolution2.md`。
- [x] 使用 `node tools_node/doc-id-registry.js --assign <path>` 分配 doc_id。
- [x] 更新 `.github/skills/html-to-ucuf/SKILL.md`，把 v2 source package flow 放在正式入口。
- [x] 將舊 `--input` flow 標為 legacy / debug。
- [x] 說明 browser preview compare 不再是 final pass。

### M1 Source Package Validator

- [x] 新增 `tools_node/lib/html-to-ucuf/source-package.js`。
- [x] 驗證 source dir 存在。
- [x] 驗證 `ui-design-tokens.json` 可 parse 且含必要 root key。
- [x] 驗證 `colors_and_type.css` 可讀且含 CSS vars 或 `:root`。
- [x] 驗證 main HTML 在 source dir 內。
- [x] 多 HTML 時要求 `--main-html`。
- [x] 輸出 `.source-package.json`。
- [x] validator fail 時 exit 2。

### M2 CLI Contract Cleanup

- [x] `run-ui-workflow.js` 支援轉送 `--source-dir` / `--main-html`。
- [x] `run-html-to-ucuf-workflow.js` 支援 source package。
- [x] `--input` 改為 legacy alias。
- [x] `--content-contract` 真接線或從 public help 移除。
- [x] `--skip-editor-compare` 在正式 flow 下不可產生 pass verdict；`--skip-compare` 僅略過 browser diagnostic。
- [x] summary 寫入 source package manifest path。

### M3 Token/CSS Authority

- [x] `token-registry.js` 支援 source token authority。
- [x] token 合併順序明確記錄：source > runtime supplement。
- [x] token conflict report 可機讀。
- [x] `dom-to-ui-json.js` 傳 source token path 到 `buildDraftFromHtml()`。
- [x] `fidelity-sidecars.js` 使用同一份 source token。
- [x] `html-parser.js` 或 pre-render stage 支援 source CSS 注入。
- [x] linked CSS fixture 加入 self-test。

### M4 CSS Capability Matrix

- [x] 建立 supported / assetize / unsupported property matrix。
- [x] gradient / shadow / filter / pseudo-element / clip-path 必須出現在 coverage report。
- [x] unsupported 大面積 property 產 evolution2 candidate。
- [x] assetize 類 property 產 asset task hint。
- [x] 不允許靜默 fallback 為透明或單色。

### M5 UCUF Generation Gate

- [x] raw layout / skin 生成 pass。
- [x] optimize pass 並輸出 node budget report。
- [x] skin autofix pass 並補 button state layer。
- [x] strict replay pass。
- [x] `validate-ui-specs.js --strict --check-content-contract` pass。
- [x] logic / interaction / motion sidecar 無 blocker。

### M6 Cocos Editor Runtime Gate

- [x] 新增或改造 HTML vs Cocos Editor compare CLI。
- [x] source reference screenshot 使用 source package。
- [x] editor screenshot 支援 `--editor-screenshot`。
- [x] 支援 crop / viewport normalization / font fallback policy。
- [x] 輸出 verdict / compare board / heatmap / top offenders。
- [x] `runtimeVsSource.score:null` 必須 fail。
- [x] `runtimeVsSource.score >= 0.95` 才 pass。

### M7 Rule Evolution Loop

- [x] fail 時 append evolution2 candidate。
- [x] candidate entry 含 source hash、screenId、score、top offenders、proposed rule。
- [x] skill 開始時讀 accepted / auto-applicable rules。
- [x] auto-applicable rule 先套 sandbox，再跑完整 gate。
- [x] reviewer-required rule 不自動修改正式產物。

### M8 DS3 Character Pilot

- [x] 使用 `Design System 3` source package。
- [x] 驗證 DS3 token 與 CSS 確實進 converter。
- [x] 產出 `character-ds3-main` v2 artifacts。
- [x] 打通 `LoadingScene -> LobbyScene -> GeneralList -> 張飛 -> character-ds3-main` 正式 smoke route。
- [x] `node tools_node/capture-ui-screens.js --target CharacterDs3 --outDir artifacts/ui-source/character-ds3/review` 產出 runtime screenshot / verdict。
- [x] `capture-ui-screens.js` 已支援顯式 `uiVariant`，可強制 unified / ds3 route，避免 sticky localStorage 誤判。
- [x] 正式玩家路徑補雙入口驗證 target：`GeneralDetailFromLobbyGeneralsButton` 走 UCUF 底部 `btnGenerals`；`GeneralDetailFromSceneGeneralListButton` 走 scene-authored `BtnGeneralList`，兩者都開 `GeneralList` 後點張飛進 `GeneralDetailComposite`。
- [x] `node tools_node/capture-ui-screens.js --target GeneralDetailFromLobbyGeneralsButton --outDir artifacts/ui-source/general-detail-overview/formal-route-lobby-generals-pass` 通過；runtime guard PASS，僅 AudioSystem preview warning。
- [x] `node tools_node/capture-ui-screens.js --target GeneralDetailFromSceneGeneralListButton --outDir artifacts/ui-source/general-detail-overview/formal-route-scene-general-list` 通過；runtime guard PASS，僅 AudioSystem preview warning。
- [ ] 正式產品 default cutover 仍 blocked：`ui=ds3` 走 `GeneralDetailComposite` 會 fail-fast 缺 `GeneralDetailRoot/RightTabBar/BtnTabOverview`；`character-ds3-main` 尚未補齊 GeneralDetailComposite shell / tabRouting 契約。
- [ ] 取得 Cocos Editor screenshot。
- [ ] HTML vs Editor score >= 0.95，或產出 top blockers 與 evolution2 candidates。

### M9 Regression / CI Hardening

- [x] `node tools_node/test/dom-to-ui-self-test.js` 全通過。
- [x] 新增 source package validator fixture。
- [x] 新增 linked CSS fixture。
- [x] 新增 runtime verdict fixture，覆蓋 `score:null` fail。
- [x] `node tools_node/validate-ui-specs.js --strict --check-content-contract` 通過。
- [x] `node tools_node/check-encoding-touched.js --files <touched>` clean。

### M10 i18n / bindPath 抽取（dom-to-ui-json 規則升級）

> 觸發原因：M8 baseline 0.3986 顯示 layout JSON 把 React-rendered 的所有文字都烤成 `"text"`，包含應該 data-bind 的武將名與傳記長文，導致換武將就壞、不能多語系。

- [ ] `tools_node/lib/dom-to-ui/text-classifier.js`：判斷 text node 屬於 dynamic / static-i18n / static-literal 三類。
- [ ] 規則：tag 內出現「武將/角色名稱、屬性數值、tab 內容、列表 item」→ dynamic；標題/分類/UI label → static-i18n；數學符號/單字符箭頭/`LEGEND` 類旗標 → static-literal。
- [ ] 顯式標記優先：`data-bind="config.name"` → dynamic with bindPath；`data-text-static` → static-literal；無顯式標記時用 classifier。
- [ ] layout schema 擴：`"i18nKey"`、`"bindPath"` 兩個新欄位（與 `"text"` 互斥）。
- [ ] dom-to-ui-json 新增 `--emit-i18n` flag，輸出 `<screen>.i18n.zh-TW.json`。
- [ ] `validate-ui-specs.js` 認新欄位（`"i18nKey"` 必須存在於 i18n 字典；`"bindPath"` 必須有對應 contentRequirement）。
- [ ] `UITemplateBinder` 在 mount 時依 `i18nKey` / `bindPath` 自動注入。
- [ ] self-test fixture：對 character HTML 跑後，「張飛」「燕人武聖」「傳記長文」變 bindPath；「人物傳記」「Chronicles」「逸 事」變 i18nKey；「←」「LEGEND」保留 static text。

### M11 CSS Variables → ui-design-tokens 反向同步

> 觸發原因：`Design System 3/colors_and_type.css` 內 `:root` 定義約 80+ CSS variable，其中 `--surface-sepia`、`--surface-sepia-warm`、`--jade-base/light/crest/field`、`--accent-gold-cta`、`--resource-gold`、`--bg-mid`、`--bg-olive`、`--surface-charcoal`、`--parchment-summary/module/main/detail/side`、`--text-warm-gold`、`--text-off-white`、`--text-khaki`、`--outline-heavy/standard/light` 等多項在 `ui-design-tokens.json` 缺漏，導致 dom-to-ui-json 反查命中率低、skin 大量 `unmappedColor`。

- [x] `tools_node/sync-css-vars-to-tokens.js`：解析 source dir 下的 `colors_and_type.css`，抽出 `:root` 內 `--*` 變數。
- [x] kebab-case → camelCase 轉換（`--surface-sepia` → `surfaceSepia`），衝突時 warning。
- [x] `--mode dry-run|append`：dry-run 列差異；append 補進專案 `assets/resources/ui-spec/ui-design-tokens.json`。（`patch` 模式暫不需要，DS3 source 與專案 tokens 已分離。）
- [x] 跨 token 種類分流：CSS vars `--type-*` / `--lh-*` 歸 `typography`；`--ease-*` / `--dur-*` 歸 `motion`；`--sp-*` 歸 `spacing`；`--r-*` 歸 `radii`。
- [x] alias / composite（rgba 多色、`var(--xxx)` 參照）skip 並計數。
- [x] 對 DS3 跑 `--mode append`：實際補進 26 colors / 7 spacing / 13 typography / 6 motion / 5 radii。
- [x] `validate-ui-specs.js` 通過（layouts=35, skins=38, screens=32, recipes=5）。

#### 2026-04-28 觀察與後續

- M11 把 token 覆蓋率補齊，但 skin 中的 `unmappedColor` 沒有下降（27 vs 26 ≈ 不變）。
- 原因：DS3 character HTML 的失敗 slot 多是 `style.background` 為 null 的 panel（draft-builder 第 740 行 `else` 直接寫 `unmappedColor`），不是 hex 反查失敗。剩下的少量 hex 失敗集中在 `rgba(...,0.x)` 透明度疊色與 inline 多層 gradient。
- 真正修這 27 個 slot 需要 M12（gradient → PNG 烘焙含 inventory 複用）+ draft-builder 對「無 background」的 panel 不要硬塞 color-rect（改成 `kind: "transparent"`）。
- 重要教訓：`character-ds3-main.json` layout 已做過 M38 codemod；任何重跑 dom-to-ui-json **必須用 `--merge-mode preserve-human`**，否則 `OverviewSlot` / `RightContentArea` 等命名節點會被 div_N 自動命名覆蓋，runtime guard 直接 fail。

### M12 Gradient / Shadow → PNG 烘焙器（含資產複用檢查）

> 觸發原因：HTML portrait-bg / panel 大量使用 3 層 `radial-gradient` + `linear-gradient` 疊加，CSS effect matrix 將其分類為 `assetize`，但目前無工具自動產出對應 PNG，導致 skin slot 只剩 `color-rect` fallback。

- [ ] **資產複用優先**（強制前置步驟）：在烘焙任何新 PNG 之前，先掃描 `assets/resources/sprites/**`、`assets/textures/**`、現有 layout/skin 引用過的 sprite-frame 路徑，建立資產 inventory。
- [ ] `tools_node/scan-existing-ui-sprites.js`：對既有 production UI（如 `general-detail-unified-screen` 的 right tab 按鈕、portrait frame、panel bg）建索引，輸出 `<screen>.sprite-inventory.json`：每個 sprite 含路徑、尺寸、9-slice、來源畫面、語意 tag（如 `tab-button-frame`、`portrait-bg-vignette`、`panel-parchment`）。
- [ ] `tools_node/match-slot-to-existing-sprite.js`：對每個 assetize 槽位，用語意 + 視覺指紋（dominant color、shape）和 inventory 比對；命中閾值 > 0.85 直接複用，並寫 evolution2 entry 紀錄複用。
- [ ] `tools_node/gradient-to-png-baker.js`：用 puppeteer-core 把指定 CSS rule 渲到無頭 canvas 並截圖。**只對 inventory 比對 miss 的槽位才烘焙新圖**。
- [ ] 輸入：source CSS file + selector + 輸出尺寸（與 layout node 同寬高）。
- [ ] 輸出：`assets/resources/sprites/ui_generated/<screen-id>/<slot>.png` + 對應 `.meta`。
- [ ] dom-to-ui-json 新增 `--bake-gradients` flag：對 `assetize` 類 background 自動跑「inventory 比對 → 命中複用 / 未命中烘焙」二段流程，skin slot 改寫為 `kind: "sprite-frame"` + 路徑。
- [ ] 9-slice 推斷：當 gradient 為 axis-aligned linear 時自動加 `nineSlice` margin；radial / 多層直接 `nineSlice: false`。
- [ ] `--force-rebake` flag：source CSS hash 變更時自動重烘（仍走 inventory 比對，避免覆蓋手動委託資產）。
- [ ] CSS evolution2 entry：當烘焙產生明顯 banding 或失真時 candidate；當 inventory 命中複用時也記錄為 reuse-evidence。
- [ ] 對 DS3 character pilot 跑一次：預期 right tab button、back button、rank badge 命中 unified 既有資產；只有 portrait-bg / story-strip 等 DS3 獨有 zone 需要新烘焙。

### M13 Tab-Routing Mount 命名規則

> 觸發原因：`character-ds3-main.tab-routing.json` 寫 `mount: "TabOverviewContent"`，但 layout JSON 中只有 auto-generated `CharacterDs3Main_div_N`，ChildPanel 找不到掛載點，等同 6 個 ChildPanel 完全失效。

- [ ] `dom-to-ui-json` 在遇到 `data-tab-content="<id>"` 時，把節點命名為 `Tab<Id>Content`。
- [ ] 沒有 `data-tab-content` 時，依 `data-slot="tab-content.<id>"` 反推同樣命名。
- [ ] HTML 端：對 DS3 character `index.html` / React component（`tabs.jsx`）追加 `data-tab-content` 標記。
- [ ] `generate-tab-childpanels.js` 改為依 layout JSON 真實節點名產 mount，不再硬碼 `Tab<Id>Content`。
- [ ] validator：tab-routing.json 內每個 mount 必須能在 layout 中找到 node。

### M14 UISpecLoader 預載 + Frame-spread Mount（runtime 性能）

> 觸發原因：使用者回報「點武將 → 開人物頁很慢」「切 tab 也很慢」，懷疑是當場才解析 JSON + 同步建 157 節點 block 主執行緒。

- [ ] `UISpecLoader` 增 `preloadSpec(screenId)`，在 `LobbyScene.onLoad` 之後 idle-time 預讀 layout/skin/screen 三 JSON 並 cache。
- [ ] `CompositePanel.show()` 第一次掛載時，把 children 建立分散到 N frame（每 frame 建 ≤ 30 節點，整體完成不超過 5 frame）。
- [ ] ChildPanel lazy 子樹：背景 tabs 在 idle 時預建 `active=false` 節點樹，使用者點 tab 時只切換 active 即可。
- [ ] 不適用預建的 tab（資料量過大）保留 on-demand，但限制單 tab 不超過 60 節點。
- [ ] 加 timing log：`[UCUF] spec-load 8ms / mount 42ms / first-tab 12ms`。
- [ ] 測試：點武將到完整顯示 ≤ 200ms；切 tab ≤ 60ms。

### M15 DS3 Cutover Iteration（reach ≥95%）

- [ ] M11 同步 token 完成後重跑 dom-to-ui-json 產 skin；統計 `unmappedColor` 槽位數應降至 ≤ 5。
- [ ] M12 烘焙 gradient PNG 補進 sprite slot；portrait-bg / right-content / story-strip 三大 zone 換 sprite。
- [ ] M13 重命名 layout tab content 節點；6 個 ChildPanel mount 點對齊。
- [ ] M10 完成後 layout 中只剩真正靜態文字；其他改 i18nKey / bindPath。
- [ ] capture + compare-html-to-cocos-editor.js 每輪記錄分數。
- [x] 收斂表：score 從 0.3986（M11 baseline）→ 0.3479（transparent-only）→ 0.3791（zone-aware）→ 0.0906（bg fill, BAD revert）→ 回到 ~0.40。
- [ ] 達標後 flip default 為 ds3，跑真實 Chrome puppeteer LoginScene→LobbyScene→GeneralList→張飛 完整路徑驗證。

### M15 已知瓶頸（2026-04-28 後段實證）

當前 dom-to-ui-json 反向產線在 ~0.40 分有結構性上限，光調 skin 顏色無法越過：

1. **layout 節點命名化 vs 自動化**：M38 codemod 名（OverviewSlot / RightContentArea / TabOverviewContent）只在某次手動 codemod 過後保留；任何 dom-to-ui-json 重跑會以 auto 名（CharacterDs3Main_div_N）覆蓋。tab-routing.json 對映的 mount 名因此不存在於 layout，6 個 ChildPanel 完全沒掛上。
2. **ChildPanel TODO 化**：6 個 `CharacterDs3{Overview,Stats,Tactics,Bloodline,Equip,Aptitude}Child` 都是 generate-tab-childpanels.js 產的空殼（`onMount` / `onDataChanged` 全 TODO）。即使 mount 對齊也不會渲染任何視覺內容。
3. **顏色填補的反例**：把 `kind: color-rect` 的 token 砸在 container panel 上，會 OPAQUE 蓋掉它的 portrait sprite child。亦即 div_2（62% 寬 portrait area）若塗 `bgMid`，整個立繪會被遮，分數從 0.39 直接掉到 0.09。同理整片塗 `parchmentBase` 也不可行。
4. **右欄沒有可塗的 panel**：div_7（右欄 720px wrapper）以下幾乎都是 `container` type，無 skinSlot；HTML 那塊 parchment 其實來自 page-level CSS + 內部分區的細部 `<div>` 多層 gradient。layout 中找不到單一節點來代表「整個右欄背景」。
5. **parseColor 範圍不足**：dom-to-ui-json 只看 inline `style.background`，看不到 React-rendered computed style；大量 React 子元件的背景被 `unmappedColor` 預設值蓋掉。

### M16 突破 0.40 的路線決議（2026-04-28，美術總監角度裁決）

**結論：B 為主線、A 為產線輔助、C 僅作短期烘焙工具、D 不採納。**

| 路徑 | 角色 | 意義 | 缺點 / 邊界 |
| ---- | ---- | ---- | ----------- |
| **B. 手寫 6 個 ChildPanel 的 binder 內容**（主線） | 產品路線 | 把 DS3 從「靜態殼」推進為可營運的 `將/屬/命/技/寶/兵` 六頁，可動態換武將 / 換語系 / 換稀有度 / 切 tab / 接 hover / pressed 與 fail-fast | 工期最真實；mount target 與 slot map 需先補；單頁先做才能驗 score 提升 |
| **A. dom-to-ui-json 用 getComputedStyle 抽取真背景**（輔助） | 工具路線 | 修正 converter 的「眼睛」，讓 CSS variable / cascade / React-rendered computed style 都能正確進 token；降低 unmappedColor、減少黑塊與錯色 | 只修轉換品質，不修「runtime 沒內容」；單獨走無法到 0.95；屬於 B 的支援工程 |
| **C. puppeteer bake 右欄為 sprite-frame**（戰術） | 截圖路線 | 適合非互動裝飾、羊皮紋理、複雜框、漸層底圖等局部烘焙 | 文字 / 數值 / tab / 語系 / 稀有度狀態無法動，把 UI 變成「漂亮截圖」；不可用於整個右欄正式內容 |
| ~~D. 鎖定 ~0.40 不再前進~~ | 不採納 | — | 違反使用者「≥95% 才 flip default」共識 |

### M16 實作 checklist（B 主線；分階段，多 turn）

**階段 1：B 路線基礎修復（不改 layout 大架構，先讓 ChildPanel 能跑）** — ✅ 2026-04-28 完成

- [x] 對齊 6 個 `CharacterDs3{Overview,Stats,Tactics,Bloodline,Equip,Aptitude}Child` 的 method signature 到 `ChildPanelBase`（`onMount(spec): Promise<void>`、`onDataUpdate(data): void`、`validateDataFormat(data): string|null`）。先前 generate-tab-childpanels.js 產出的 `onMount(binder, skin)` + `onDataChanged` 簽名與 base 不符，框架實際呼叫不到；現已全部修正。
- [x] Overview ChildPanel 加上 `_nameLabel / _roleLabel / _rarityLabel / _bioLabel` cache slot 與 `binder.getLabelByPath(...)` 查詢；找不到時 `UCUFLogger.warn`。
- [x] 補 `validateDataFormat` 最小實作（檢查 `data && typeof data === 'object'`）。
- [x] 6 個檔案 `get_errors` clean。

**階段 2：B 路線 mount target 落地（Overview 先行）** — ✅ 2026-04-28 完成（rename-only 策略）

- [x] 針對 Overview：`assets/resources/ui-spec/layouts/character-ds3-main.json` 重命名 4 個節點（不增刪，保留原視覺）：
  - `CharacterDs3Main_div_9` → `TabOverviewContent`
  - `CharacterDs3Main_span_5`（「張飛」）→ `OverviewName`
  - `CharacterDs3Main_div_13`（「翼德 · 蜀 · 先鋒」）→ `OverviewRoleBadge`
  - `CharacterDs3Main_span_7`（「UR」）→ `OverviewRarityTier`
  - `CharacterDs3Main_div_15`（5 顆星 container）→ `OverviewRarityStars`
- [x] `validate-ui-specs.js` pass。
- [x] capture + compare 後 score = **0.3791**（與 baseline 持平，無視覺回歸）。
- [ ] Stats/Tactics/Bloodline/Equip/Aptitude 的 layout 改名與可選 sibling mount node 延到階段 4 逐 tab 進行。

**階段 3：B 路線 Overview ChildPanel 真實內容** — ✅ 2026-04-28 完成（smoke wiring）

- [x] `CharacterDs3OverviewChild.onMount` 改用 `binder.getLabel(name)` flat lookup 快取 Label / Node refs。
- [x] `onDataUpdate(data: GeneralConfig)` 寫入 `name` / `roleArchetype` / `rarityLabel`；Rarity stars 以 `OverviewRarityStars` container 子 Label 數量 toggle。
- [x] `GeneralDetailComposite._onAfterBuildReady` / `show()` DS3 分支直接實例化 `CharacterDs3OverviewChild` 並呼叫 `onMount` + `onDataUpdate`（暫不走 fragment / slot 機制）。
- [x] capture + compare 後 score = **0.3792**（水平位移 +0.0001，無回歸）。
- [ ] `OverviewBio` Label 類似位置（例如 `historicalAnecdote` 的 200~300 字介紹）需要 layout 补訂；等階段 4 部分 tab 評估一起补。

**階段 4：B 路線複製到其他 5 個 tab**

- [ ] Stats（屬）：六色屬性條 / 教官評價。
- [ ] Tactics（技）：戰法習得清單。
- [ ] Bloodline（命）：14 人祖先血統圖 + 命槽。
- [ ] Equip（寶）：一般裝備 + 傳家寶 + 道具。
- [ ] Aptitude（兵）：戰場適性 + 虎符槽。
- [ ] 每補一個 tab 跑一次 compare，逐步逼近 ≥0.95。

**階段 5：A 路線（產線輔助，可與 B 並行）**

- [ ] 在 `tools_node/lib/dom-to-ui/draft-builder.js` 注入 puppeteer：對每個 panel 在 `parseColor` 前先 `page.evaluate(el => getComputedStyle(el).backgroundColor)` 取真色。
- [ ] dom-to-ui-json 加上 `--use-computed-style` flag（預設 off，避免破壞 self-test baseline）。
- [ ] 重跑 DS3：`node tools_node/dom-to-ui-json.js --use-computed-style --merge-mode preserve-human`，驗證 `unmappedColor` 槽位數降低、且 codemod 名（`OverviewName` 等）不被覆蓋。
- [ ] 不要在沒跑 self-test 之前把 `--use-computed-style` 變成預設。

**階段 6：C 路線（戰術用途，僅針對特定 zone）**

- [ ] 不烘焙整個右欄；只考慮把 portrait 後方裝飾、羊皮紙背景紋理或最複雜的框體烘成 sprite-frame。
- [ ] 必須在 `artifacts/ui-library/` 暫存，不直接 promote 到 runtime path。
- [ ] 任何烘焙 sprite 不可承載文字 / 數值 / 狀態。

**Gate**：

- 在階段 3 完成前不再做任何整面色塊覆蓋實驗（已驗證會掉到 0.09–0.11）。
- 在 compare 達 ≥0.95 前不 flip default 為 ds3。
- A 路線工具升級必須通過 `tools_node/test/dom-to-ui-self-test.js`（18/18）才能合入。

## 11. 收斂標準

一張 HTML UI 只有在以下條件全部成立時，才可宣稱 HTML-to-UCUF v2 通過：

1. source package validator pass。
2. UCUF layout / skin / screen strict validate pass。
3. token / CSS ingestion 報告顯示來源為 source package。
4. unsupported CSS 均有 assetize / rewrite / evolution2 處理。
5. logic / interaction / runtime state 不丟失。
6. Cocos Editor screenshot vs HTML source screenshot `runtimeVsSource.score >= 0.95`。
7. 低於門檻時有 evolution2 candidate，且下一輪可讀取已接受規則。
