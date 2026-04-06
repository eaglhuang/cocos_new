---
name: ui-spec-scaffold
description: 'UI spec 與 Panel scaffold SKILL — 以 template family、proof mapping、content contract 產出或更新 ui-spec 三層 JSON 與 TypeScript Panel 骨架。USE FOR: 新 screen 落地、既有 screen 補 scaffold、需要執行 scaffold-ui-spec-family.js / scaffold-ui-component.js。DO NOT USE FOR: 最終視覺 QA、手工 Prefab 微調當正式流程。'
argument-hint: '提供 familyId、screenId、proof mapping config 或 Figma frame id，並說明要產生 ui-spec、Panel，或兩者都要。'
---

# UI Spec Scaffold

把已確認的 family / contract / proof mapping，正式落成目前專案使用的 `ui-spec + UIPreviewBuilder` 架構。

Unity 對照：相當於先生成 ScriptableObject / Prefab 骨架與 MonoBehaviour stub，再進入視覺與互動細修。

## 何時使用

- 新 UI 要建立 `layout / skin / screen` 三層 JSON
- screen spec 已存在，但還沒有對應的 Panel TS 骨架
- proof mapping 已成形，想轉成 repo 內正式骨架

## 不要這樣用

- 不要再走 `assets/resources/ui-layouts/` 或 `UIScaffold` 舊路徑
- 不要把 scaffold 產物當最終完成品，之後仍要補 contract、content、skin 與驗證
- 不要在未知 family 下直接大量覆蓋既有 JSON

## 主要工具

- `node tools_node/scaffold-ui-spec-family.js`
- `node tools_node/scaffold-ui-component.js`
- `node tools_node/sync-figma-proof-mapping.js`
- `node tools_node/validate-ui-specs.js --strict --check-content-contract`

## 標準流程

### 1. 先確認輸入真相

至少要有以下其中一種：

- 已存在的 task-ready brief
- proof mapping config JSON
- Figma frame 對應快照
- 已確認的 `familyId + screenId + content contract`

### 2. 先做 ui-spec dry-run

優先先看輸出，不要一開始就覆蓋檔案：

```bash
node tools_node/scaffold-ui-spec-family.js --config <config.json> --dry-run
```

若已經有 Figma proof mapping 快照：

```bash
node tools_node/scaffold-ui-spec-family.js --family-id <family-id> --figma-frame-id <frame-id> --dry-run
```

### 3. 寫入 ui-spec 三層 JSON

確認 dry-run 沒問題後，再正式寫入：

```bash
node tools_node/scaffold-ui-spec-family.js --config <config.json>
```

輸出應落在：

- `assets/resources/ui-spec/layouts/`
- `assets/resources/ui-spec/skins/`
- `assets/resources/ui-spec/screens/`

### 4. 生成 Panel 骨架

```bash
node tools_node/scaffold-ui-component.js --screen <screen-id> --dry-run
node tools_node/scaffold-ui-component.js --screen <screen-id>
```

若 family 無法自動推斷，顯式指定：

```bash
node tools_node/scaffold-ui-component.js --screen <screen-id> --family detail-split
```

### 5. 補齊目前架構要求

產出後立刻確認：

- `screen.contentRequirements` 已存在
- bind path 對齊 contract，而不是回退成 `"dynamic"`
- Panel 走 `UIPreviewBuilder + onReady(binder)` 路線
- `UIConfig.ts` 的新增入口不是空白或無效佔位

### 6. 執行驗證

```bash
node tools_node/validate-ui-specs.js --strict --check-content-contract
curl.exe http://localhost:7456/asset-db/refresh
```

## 產出邊界

這個 skill 負責：

- 三層 JSON 骨架
- Panel TypeScript 骨架
- 基本命名與 family 對齊

這個 skill 不負責：

- 最終視覺 polish
- QA compare board
- 專屬美術資產生成

## 與其他 skills 的銜接

- 還沒整理輸入：先用 `ui-brief-generator`
- 還沒把參考圖拆成 contract：先用 `ui-reference-decompose`
- scaffold 完要驗證：接 `ui-runtime-verify`
- 資產齊了要做自動規則檢查：接 `ui-asset-qc`
