---
doc_id: doc_agentskill_0030
name: ui-spec-scaffold
description: 'UI spec 與 Panel scaffold SKILL — 以 normalized recipe、family defaults、content contract 產出或更新 screen package 與 CompositePanel / ChildPanel TypeScript 骨架。USE FOR: 新 screen 從 recipe 落地、既有 screen 做 structure normalization、需要執行 compile-recipe-to-screen-spec.js / compile-recipe-to-panel-scaffold.js。DO NOT USE FOR: 最終視覺 QA、手工 Prefab 微調當正式流程。'
argument-hint: '提供 recipe 路徑、screenId 或 familyId，並說明要產生 screen package、Panel scaffold，或兩者都要。'
---

# UI Spec Scaffold

把已確認的 normalized recipe / contract / family defaults，正式落成目前專案使用的 `ui-spec + CompositePanel / ChildPanel` 架構。

Unity 對照：相當於先生成 Screen ScriptableObject、PageController 與子 ViewController 骨架，再進入視覺與互動細修。

## 何時使用

- 新 UI 已有 normalized recipe，要建立 `layout / skin / screen` screen package
- screen spec 已存在，但還沒有對應的 Composite / Child Panel TS 骨架
- 想把 `proof -> MCQ -> recipe` 的結果正式落成 repo 內骨架

## 不要這樣用

- 不要直接從 raw proof 或 Figma snapshot 跳進 scaffold，先經 `ui-reference-decompose` 與 recipe 收斂
- 不要把 scaffold 產物當最終完成品，之後仍要補 mapper、bind path policy、skin 與驗證
- 不要在未知 family 或未收斂 recipe 下直接大量覆蓋既有 JSON

## 主要工具

- `node tools_node/compile-recipe-to-screen-spec.js`
- `node tools_node/compile-recipe-to-panel-scaffold.js`
- `node tools_node/compile-recipe-to-task-card.js`
- `node tools_node/validate-ui-specs.js --strict --check-content-contract`

Legacy fallback：只有在 recipe compiler 尚未覆蓋的舊畫面，才回退 `scaffold-ui-spec-family.js` / `scaffold-ui-component.js`。

## 標準流程

### 1. 先確認輸入真相

至少要有以下其中一種：

- `normalized recipe.json`
- 已完成 MCQ 收斂、可等價重建 recipe 的結構包
- 已確認的 `screenId + familyId + content contract`

### 2. 先做 screen package dry-run

優先先看輸出，不要一開始就覆蓋檔案：

```bash
node tools_node/compile-recipe-to-screen-spec.js --recipe <recipe.json> --dry-run
```

### 3. 寫入 ui-spec 三層 JSON

確認 dry-run 沒問題後，再正式寫入：

```bash
node tools_node/compile-recipe-to-screen-spec.js --recipe <recipe.json> --write
```

輸出應落在：

- `assets/resources/ui-spec/layouts/`
- `assets/resources/ui-spec/skins/`
- `assets/resources/ui-spec/screens/`

### 4. 生成 Panel 骨架

```bash
node tools_node/compile-recipe-to-panel-scaffold.js --recipe <recipe.json> --dry-run
node tools_node/compile-recipe-to-panel-scaffold.js --recipe <recipe.json> --write
```

### 5. 補齊目前架構要求

產出後立刻確認：

- `screen.contentRequirements` 已存在
- bind path 對齊 contract，而不是回退成 `"dynamic"`
- 頁級宿主走 `CompositePanel`，slot 內容走 `ChildPanelBase` 子類
- recipe 中的 `slots / dataSources / smokeRoute` 已反映到 scaffold 與 task card

### 6. 執行驗證

```bash
node tools_node/validate-ui-specs.js --strict --check-content-contract
node tools_node/headless-snapshot-test.js
curl.exe http://localhost:7456/asset-db/refresh
```

## 產出邊界

這個 skill 負責：

- screen package 骨架
- Composite / Child Panel TypeScript 骨架
- recipe 對齊的基本命名、slot 與 data source 結構

這個 skill 不負責：

- 最終視覺 polish
- QA compare board
- 專屬美術資產生成

## 與其他 skills 的銜接

- 還沒整理輸入：先用 `ui-brief-generator`
- 還沒把參考圖拆成 proof draft：先用 `ui-reference-decompose`
- scaffold 完要驗證：接 `ui-runtime-verify`
- 資產齊了要做自動規則檢查：接 `ui-asset-qc`
