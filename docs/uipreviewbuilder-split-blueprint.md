# `UIPreviewBuilder.ts` 拆分藍圖

本文件定義 `UIPreviewBuilder.ts` 的拆分方向與強制邊界。

對照 Unity，`UIPreviewBuilder.ts` 現況很像一支過胖的 `MonoBehaviour`：
同時承擔節點建立、版面配置、樣式套用、中文字串、fallback、diagnostics 與 preview orchestration。
這種檔案會同時放大三種風險：

- merge conflict
- 編碼災害半徑
- review 成本

## 硬規則

- 任一代碼檔超過 400 行，即視為必須拆分。
- `UIPreviewBuilder.ts` 已明確屬於強制拆分對象。
- 之後不得再把新功能長期堆進這支檔案。

## 目標分層

### 1. `UIPreviewBuilder.ts`

- 只保留總協調與公開入口
- 負責高層 orchestration
- 不再承擔大量細節邏輯

### 2. `UIPreviewNodeFactory.ts`

- 專責建立節點
- 管理 container / panel / label / button / sprite 等基本節點工廠

### 3. `UIPreviewLayoutBuilder.ts`

- 專責 anchor / widget / layout / padding / spacing
- 處理版面幾何與佈局規則

### 4. `UIPreviewStyleBuilder.ts`

- 專責 skin 套用
- 管理 frame / shadow / noise / overlay / sprite style

### 5. `UIPreviewTextCatalog.ts`

- 專責中文 placeholder、預設文案與測試文案
- 降低大段中文常數混在主邏輯中的風險

### 6. `UIPreviewDiagnostics.ts`

- 專責 warning / fallback / debug log
- 集中管理 preview 期的診斷輸出

## 拆分原則

- 每個新檔都要有單一主要責任。
- 中文常數與視覺組裝邏輯不要再和 orchestration 混在一起。
- 不允許只是把同樣耦合的內容平移到別的檔案。
- 拆分後仍需保持原有行為不變，再逐步做結構優化。

## 推薦拆分順序

1. `UIPreviewTextCatalog.ts`
2. `UIPreviewDiagnostics.ts`
3. `UIPreviewLayoutBuilder.ts`
4. `UIPreviewStyleBuilder.ts`
5. `UIPreviewNodeFactory.ts`
6. 最後縮減 `UIPreviewBuilder.ts`

## 驗收條件

- `UIPreviewBuilder.ts` 行數下降到合理範圍
- 新檔職責清楚，不互相重疊
- `npm run check:encoding` 通過
- `npm run check:acceptance` 通過
- 非 ASCII 大量變更有專門 reviewer 檢查

## 協作規則

- 拆分期間採單寫者規則
- 若需要多 Agent 併行，必須明確切開 write scope
- commit message 仍遵循：
  ```text
  [bug|feat|chore] 任務卡號 功能描述 [AgentX]
  ```
