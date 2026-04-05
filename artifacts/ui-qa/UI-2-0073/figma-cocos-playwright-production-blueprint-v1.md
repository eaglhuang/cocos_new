# Figma + Cocos MCP + Playwright 量產流程藍圖 v1

## 目標

把目前已建立的：

- `UI_PROOF_TEMPLATE`
- `wireframe`
- `slot-map`
- `layout / skin / screen ui-spec skeleton`

正式接成一條可重複的高品質 UI 量產線，避免每次都從 `proof 圖` 重新猜節點階層。

Unity 對照：

- `Figma` 類似把 UI 設計稿與 Prefab 組件庫先定型。
- `Cocos ui-spec skeleton` 類似把 Prefab 結構、Theme 與 Screen route 拆成可組合資料。
- `Playwright` 類似自動化的 Game View 截圖回歸測試。
- `Cocos MCP` 則像能從外部腳本讀寫 Editor 結構的工具橋。

## 工具分工

### 1. AI proof 層

來源：

- Gemini / PixAI / 其他 AI 生圖
- 目前既有參考資料夾：`docs/UI品質參考圖/UI_PROOF_TEMPLATE`

輸出：

- `01_proof`
- `02_select`

責任：

- 找方向
- 找構圖
- 找資訊區塊權重
- 找世界觀符號語言

不負責：

- 最終 hierarchy
- 真正 slot 名稱
- 直接可跑的 UI code

### 2. Figma 規格化層

用途：

- 把已選中的 proof，轉成可重複 component library。
- 把日常人物頁、血脈命鏡、英靈虎符詳情、特種軍隊圖鑑做成同一套 design token / component variant。

輸入：

- `02_select`
- `03_wireframe`
- `04_slotmap`

輸出：

- Figma page: `screen proof`
- Figma page: `wireframe`
- Figma page: `component library`
- Figma tokens:
  - spacing
  - radius
  - crest slot
  - story-strip cell
  - rarity glow

最適合在 Figma 做的事：

- 把 `story-strip-01~06` 固定成 component
- 把 `gdv3.bloodline.card`、`mirror.center.gate`、`spirit-tally.crest` 固定成 reusable block
- 把 badge / ribbon / veil 的狀態收成 variant

### 3. slot-map / contract 層

用途：

- 把 Figma 的畫面，翻譯成 Cocos 真正可掛節點的語言。

輸入：

- Figma 畫面與 component
- `03_wireframe`

輸出：

- `04_slotmap`
- slot naming
- state naming
- asset responsibility

最低要求：

- 每個畫面至少能說清楚：
  - 哪些是 frame
  - 哪些是 content
  - 哪些是 badge
  - 哪些是 decorative overlay
  - 哪些是 dynamic text

### 4. Cocos MCP / ui-spec skeleton 層

用途：

- 把 slot-map 轉成真正的 `layout / skin / screen JSON`
- 必要時由 MCP 幫忙讀 scene / prefab / node tree，做非破壞性 scaffold

輸入：

- `04_slotmap`
- Figma component mapping
- 現有 skeleton JSON

輸出：

- `assets/resources/ui-spec/layouts/*.json`
- `assets/resources/ui-spec/skins/*.json`
- `assets/resources/ui-spec/screens/*.json`
- 後續可補 Prefab scaffold 與 node tree scaffold

建議用法：

- `cocos-creator` MCP 只先用在：
  - scene read
  - prefab browse
  - node hierarchy read
  - new scaffold create
- 不建議第一階段就讓 AI 全自動改現有複雜畫面。

### 5. Playwright QA 層

用途：

- 驗證 `proof -> slot-map -> codegen` 後，畫面是否還守住構圖。

輸入：

- Browser Review host
- Cocos 預覽頁或對應 web 化畫面

輸出：

- screenshot capture
- regression notes
- layout drift report

最適合驗證：

- 人物寬度比例
- 血脈 crest 是否過大
- 故事條 5/6 格節奏
- 未持有標記是否搶戲

## 對照目前資料夾流程

### `UI_PROOF_TEMPLATE`

- `00_brief`
  - 提示詞、構圖要求、世界觀限制
- `01_proof`
  - Gemini / PixAI / 其他 AI proof
- `02_select`
  - 人工挑選 1~3 張
- `03_wireframe`
  - 空白 wireframe base + 結構線稿
- `04_slotmap`
  - slot / badge / CTA / story-cell / crest / veil
- `05_codegen`
  - JSON / prefab / TS scaffold

### Figma 對應

- `00_brief` -> Figma page `brief`
- `02_select` -> Figma page `selected proof`
- `03_wireframe` -> Figma page `wireframe`
- `04_slotmap` -> Figma page `component map`
- `05_codegen` -> 給 Cocos skeleton 與實作

### Cocos 對應

- `03_wireframe` -> node region
- `04_slotmap` -> `layout` naming
- design token / family -> `skin`
- route / state -> `screen`

## 推薦生產節奏

### A. 新畫面第一次建立

1. AI proof 產 4~8 張
2. 挑 1~2 張進 `02_select`
3. 畫 `03_wireframe`
4. 畫 `04_slotmap`
5. 進 Figma 建 component
6. 生 `layout / skin / screen skeleton`
7. 用 MCP 讀 scene / scaffold
8. 用 Playwright 做第一輪 capture QA

### B. 已存在畫面 family 擴張

1. 直接複用 Figma component
2. 只換角色圖 / crest / story cell / rarity
3. 只補局部 slot-map
4. 生成新 screen JSON
5. Playwright 回歸檢查

## 目前最值得優先接工具的畫面

### 第一批

- `general-detail-bloodline-v3`
- `bloodline-mirror`
- `spirit-tally-detail`

原因：

- 結構清楚
- 已有 proof
- 已有 slot-map 思路
- 已有 skeleton JSON
- 最能代表新世界觀

### 第二批

- `elite-troop-codex`
- `loading screen family`
- `unowned marker family`

## 可行性評估

### 高可行

- Figma 用來做 component library 與 token
- Cocos MCP 用來讀 hierarchy 與搭 scaffold
- Playwright 用來做 screen-level 回歸檢查

### 中可行

- 讓 Cocos MCP 自動建立新畫面骨架
- 讓 AI 依 slot-map 產出初版 JSON

### 暫不建議先做

- 讓 AI 直接全自動重構既有複雜畫面
- 讓 Playwright 直接判定美術品質而無人工 review
- 讓 Figma 成為唯一真相來源而不回寫 repo JSON

## 成功標準

- 新畫面從 proof 到 skeleton 的時間可穩定縮短
- 不需要每次都重新猜 slot 與 hierarchy
- 日常人物頁 / 命鏡 / 英靈虎符三條線能共用同一套生產節奏
- Browser QA 能在合圖之前發現 70% 以上的版型偏移
