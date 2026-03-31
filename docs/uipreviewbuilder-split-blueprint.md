# `UIPreviewBuilder.ts` 拆分藍圖

本文件只描述 `UIPreviewBuilder.ts` 的拆分方向。通用的高風險檔、單寫者與 400 行硬規則，統一以 [keep.md](./keep.md) 為準。

## 1. 為什麼要拆

`UIPreviewBuilder.ts` 同時承擔 preview orchestration、中文字串、diagnostics、layout、style 與節點建立，風險過高。

主要問題：

- 容易 merge conflict
- 編碼災難半徑過大
- review 困難
- 超過 400 行硬限制

Unity 對照：這很像一支過肥的 `MonoBehaviour` 同時包 UI 建構、文案、fallback 與 log，長期一定難維護。

## 2. 拆分目標

保留 `UIPreviewBuilder.ts` 為協調器，逐步拆出：

1. `UIPreviewTextCatalog.ts`
2. `UIPreviewDiagnostics.ts`
3. `UIPreviewLayoutBuilder.ts`
4. `UIPreviewStyleBuilder.ts`
5. `UIPreviewNodeFactory.ts`

## 3. 職責分工

### `UIPreviewBuilder.ts`

- 只保留流程協調
- 不再承載大量細節實作

### `UIPreviewTextCatalog.ts`

- 中文 placeholder
- 測試用文案
- 預覽字串常數

### `UIPreviewDiagnostics.ts`

- warning
- fallback 記錄
- debug log

### `UIPreviewLayoutBuilder.ts`

- anchor / widget / layout / spacing / padding

### `UIPreviewStyleBuilder.ts`

- frame / shadow / noise / overlay / sprite style

### `UIPreviewNodeFactory.ts`

- container / panel / label / button / sprite 的建立與掛件

## 4. 拆分順序

建議順序：

1. `UIPreviewTextCatalog.ts`
2. `UIPreviewDiagnostics.ts`
3. `UIPreviewLayoutBuilder.ts`
4. `UIPreviewStyleBuilder.ts`
5. `UIPreviewNodeFactory.ts`
6. 最後再瘦身 `UIPreviewBuilder.ts`

## 5. 施工規則

- 單寫者規則依 [keep.md](./keep.md)
- 每次拆分只處理單一責任
- 先搬移，不先改行為
- 新檔一律納入 UTF-8 防災檢查

## 6. 驗收

- 行為不變
- `npm run check:encoding` 通過
- `npm run check:acceptance` 通過
- `UIPreviewBuilder.ts` 行數下降，責任明確
