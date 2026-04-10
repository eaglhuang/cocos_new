---
name: ui-asset-slice-pipeline
description: 'UI 資產切件與候選收斂 SKILL — 從使用者提供的整頁 UI、2K 母圖、panel sheet 或單張素材，自動執行全切、auto-classify、auto-pick、temp/selected 分流、背景裁切、透明化與 post-process。USE FOR: 切出 panel / cap / badge / glyph / noise 候選、把未挑選切片集中到 temp 可一次清掃、把高信心候選升到 selected、再接 trim-png-by-background.js / postprocess-ui-asset.js。DO NOT USE FOR: runtime 畫面驗收（用 ui-runtime-verify）、純 icon 規格設計（用 UI-icon workflow）、單純修改 layout/skin JSON。'
argument-hint: '提供 input 圖檔或資料夾、希望走 full-slice 還是 targeted crop、是否需要 auto-pick、以及後續要不要直接接 postprocess/task runner。'
---

# UI Asset Slice Pipeline

這個 skill 的用途不是只「切圖」，而是把「切件 -> 候選收斂 -> 暫存清掃 -> 後處理」包成同一條資產前處理線。

Unity 對照：相當於先把整張 concept / parts sheet 自動切成 sub-assets，再做 importer 前的 auto-tag、auto-trim 與 candidate promotion。

## 適用情境

- 使用者提供整頁 UI 截圖、2K 母圖、panel sheet，希望先自動切出所有局部件
- 希望把切片先分成 `panel / cap / badge / glyph / noise`
- 希望高信心候選直接進 `selected`，剩下全部留在 `temp`
- 希望後面直接接 `trim-png-by-background.js`、`postprocess-ui-asset.js`、`run-ui-asset-postprocess.js`
- 希望從 `selected` 直接批次接正式 task-aware postprocess

## 主要工具

### 1. 全切 + auto-classify + auto-pick

```bash
node tools_node/slice-ui-image-components.js \
  --input <image-or-dir> \
  --out-dir artifacts/ui-generated/<task-id> \
  [--name-prefix UI_] \
  [--max-components 80]
```

輸出結構：

- `artifacts/ui-generated/<task-id>/temp/...`：所有 provisional 切片，之後可整包清掃
- `artifacts/ui-generated/<task-id>/selected/...`：heuristic auto-pick 升格的高信心候選
- `slice-components-report.json`：batch summary
- `temp/<image>/slice-components-item-report.json`：單圖詳細 report

### 2. 針對 header cap 的定向裁切

```bash
node tools_node/crop-general-detail-header-caps.js \
  --input <image-or-dir> \
  --auto-detect \
  --out-dir artifacts/ui-generated/<task-id>
```

當你明確知道要抓 `GeneralDetail` 家族的左右 cap 時，優先走這條。

### 3. 去背 / 透明裁切 / 安全去毛邊

```bash
node tools_node/trim-png-by-background.js \
  --input <raw.png> \
  --output <trimmed.png> \
  --report <report.json>
```

適用於背景可判定、需要把實底母圖轉成透明碎件時。

### 4. 資產 post-process

```bash
node tools_node/postprocess-ui-asset.js --input <png> --output <png> --report <report.json>
```

若已經有正式 task，改走：

```bash
node tools_node/run-ui-asset-postprocess.js --task <task.json> --input <raw.png> --out-dir <out-dir>
```

### 5. 從 selected 直接批次接 postprocess

```bash
npm run postprocess:ui-asset-selected -- \
  --manifest artifacts/ui-source/<screen-id>/manifests/asset-task-manifest.json \
  --selected-dir artifacts/ui-generated/<slice-task>/selected/<bucket> \
  [--selection-map artifacts/ui-source/<screen-id>/manifests/<demo>.selection-map.json] \
  [--task-id <task-id>] \
  [--generated-root artifacts/ui-generated/<run-id>] \
  --strict
```

這層會先把 `selected` 內已挑出的候選檔轉成 batch runner 可吃的 staging input，再呼叫 `run-ui-asset-task-batch.js`。

若 `selected` 內檔名已經對齊 `taskId / outputName / slot`，可以不帶 `--selection-map`。
若 `selected` 還保留像 `component_014.png` 這類 generic 名稱，就補 `selection-map` 明確綁定。

## 建議流程

### 路徑 A：整頁/整板原圖，先全切再收斂

1. 跑 `slice-ui-image-components.js`
2. 看 `slice-components-report.json` 的 `selectedRoot` 與 `pickedCount`
3. 只對 `selected` 內候選做下一步 trim / postprocess
4. `temp` 只當暫存區，最後可整包刪掉
5. 要接正式資產輸出時，優先跑 `postprocess:ui-asset-selected`

### 路徑 B：已知目標就是 header caps

1. 跑 `crop-general-detail-header-caps.js`
2. 若來源背景非透明，再接 `trim-png-by-background.js`
3. 再接 `postprocess-ui-asset.js` 或 task-aware runner

### 路徑 C：已經有人從 selected 挑好候選，要直接交回 screen task flow

1. 準備 `selected` 目錄，或補一份 `selection-map`
2. 跑 `postprocess:ui-asset-selected`
3. 讓 wrapper 自動呼叫 `run-ui-asset-task-batch.js`
4. 檢查 `selected-postprocess-plan.json` 與 `postprocess-batch-report.json`

## 成功標準

- `temp` 與 `selected` 分流清楚
- 沒被選中的 provisional 切片都集中在 `temp`
- `selected` 只保留高信心候選，不把 noise 混進正式資產區
- 若需要 runtime 使用，至少再經過一次 trim / postprocess
- 若是正式 screen task flow，優先保留 `selection-map + batch report`，讓別的 Agent 可重跑

## 已驗證示範

- `GeneralDetailOverview`：可直接用 `artifacts/ui-source/general-detail-overview/manifests/selected-slice-postprocess-demo.selection-map.json` 示範把 header caps 從 curated `selected` 候選接回正式 task flow
- `GachaMain`：可直接用 `artifacts/ui-source/gacha-main/manifests/selected-postprocess-auto-match-demo.json` 示範非 `GeneralDetail` screen 也能走同一套 wrapper，且這次驗證的是 `auto-exact` 命名對齊，不靠 `selection-map`

## 不要做的事

1. 不要把 `temp` 內所有切片直接當正式資產
2. 不要略過 `selected` / `temp` 分流，讓垃圾切片污染主產出區
3. 不要把這個 skill 當 runtime 驗收工具
4. 不要在未經 postprocess 前就把 raw 切片塞回 sliced runtime slot