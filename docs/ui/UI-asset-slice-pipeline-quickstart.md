<!-- doc_id: doc_ui_0045 -->
# UI Asset Slice Pipeline Quickstart

這份是一頁版操作手冊，給要快速判斷「現在該不該走切件流程」的 Agent。

## 什麼時候該走這條線

符合下列任一條，就不要直接開 AI 生圖，先走切件流程：

1. 使用者手上已經有整頁 UI、2K 母圖、panel sheet。
2. 目標是抽出 `panel / cap / badge / glyph` 等局部件，不是整頁重畫。
3. 需要先把大量候選切出來，再由 Agent 收斂到少數可用件。
4. 後面還要接正式的 `asset-task-manifest.json` 做 postprocess。

若來源不是使用者提供的整頁母圖，而是先由 `ComfyUI` 產生單一 `partial asset`，先讀：

- `docs/ui/ComfyUI-Cocos-partial-asset-minimal-flow.md (doc_ui_0037)` (doc_ui_0037)

## 什麼時候不要走這條線

1. 只是改 `layout / opacity / tint / spacing`，那是 `param-tune`。
2. 已經有正式 raw PNG，而且檔名已對齊 task，不需要再切。
3. 問題是 runtime 顯示錯誤，應先走 runtime verify，不是切圖。

## 標準三段式

### A. 先全切或定向裁切

整頁或整板原圖：

```bash
npm run slice:ui-components -- --input <image-or-dir> --out-dir artifacts/ui-generated/<task-id>
```

已知就是 `GeneralDetail` header caps：

```bash
npm run crop:general-detail-header-caps -- --input <image-or-dir> --auto-detect --out-dir artifacts/ui-generated/<task-id>
```

### B. 看 selected，不看 temp

1. `temp` 是垃圾桶，保留未挑選 provisional 切片。
2. `selected` 才是後續要接正式流程的候選區。
3. 若檔名還是 `component_*.png`，補一份 `selection-map`。

### C. 從 selected 直接接正式 task flow

```bash
npm run postprocess:ui-asset-selected -- \
  --manifest artifacts/ui-source/<screen-id>/manifests/asset-task-manifest.json \
  --selected-dir artifacts/ui-generated/<slice-task>/selected/<bucket> \
  [--selection-map artifacts/ui-source/<screen-id>/manifests/<demo>.selection-map.json] \
  [--task-id <task-id>] \
  [--generated-root artifacts/ui-generated/<run-id>] \
  --strict
```

這條 wrapper 會：

1. 從 `selected` 找到對應 task 的候選圖。
2. 先建立 staging input。
3. 再呼叫 `run-ui-asset-task-batch.js`。
4. 產生 `selected-postprocess-plan.json` 與 `postprocess-batch-report.json`。

## 推薦示範

`GeneralDetailOverview` 是目前最適合的示範 screen，因為它已有正式的 header cap tasks。

示範 selection map：

- `artifacts/ui-source/general-detail-overview/manifests/selected-slice-postprocess-demo.selection-map.json`

示範命令：

```bash
npm run postprocess:ui-asset-selected -- \
  --manifest artifacts/ui-source/general-detail-overview/manifests/asset-task-manifest.json \
  --selected-dir artifacts/ui-generated/header-cap-crop-smoke \
  --selection-map artifacts/ui-source/general-detail-overview/manifests/selected-slice-postprocess-demo.selection-map.json \
  --task-id general-detail-overview-header-cap-left \
  --task-id general-detail-overview-header-cap-right \
  --generated-root artifacts/ui-generated/general-detail-overview-selected-demo \
  --strict
```

若要看非 `GeneralDetail` 的示範，直接看 `GachaMain`：

- `artifacts/ui-source/gacha-main/manifests/selected-postprocess-auto-match-demo.json`

示範命令：

```bash
npm run postprocess:ui-asset-selected -- \
  --manifest artifacts/ui-source/gacha-main/manifests/asset-task-manifest.json \
  --selected-dir artifacts/ui-generated/gacha-selected-curated-demo/selected/curated \
  --task-id gacha-main-pool-tier-badge-badge-glyph \
  --task-id gacha-main-pool-tier-badge-badge-underlay \
  --generated-root artifacts/ui-generated/gacha-main-selected-demo \
  --strict
```

這個例子驗證的是 `auto-exact`：只要 `selected` 裡的檔名已對齊 `outputName`，wrapper 可以不靠 `selection-map` 直接匹配。

## 收尾最少要留什麼

1. 切件 summary：`slice-components-report.json`
2. 若有正式挑選，留 `selection-map`
3. 批次 postprocess 後，留 `selected-postprocess-plan.json`
4. 批次 runner 結果：`postprocess-batch-report.json`