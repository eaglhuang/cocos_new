---
description: 從 UILayoutConfig JSON 自動產生 Cocos 3.8 UI 組件代碼
---

# UI 代碼自動產出流程

此 workflow 用於從 JSON 佈局配置自動產生 TypeScript UI 組件。

## 使用時機
- 建立新的 UI 畫面時
- 需要快速產出符合架構規範的 UI 骨架代碼時

## 前提條件
- `assets/scripts/ui/core/UIScaffold.ts` 基底類別已存在
- `assets/scripts/ui/core/UILayoutConfig.ts` 型別定義已存在
- 目標 `UILayoutConfig` JSON 已建立在 `assets/resources/ui-layouts/`

## 步驟

// turbo-all

### 1. 讀取 UILayoutConfig JSON

讀取目標 JSON 檔案（如 `assets/resources/ui-layouts/general-list.json`），解析：
- `screenId`：作為組件類別名稱
- `root.children`：用來推導 `@property` 綁定
- `root.layout`：用來決定佈局策略

### 2. 產生 TypeScript 組件

根據 JSON 配置產生 `.ts` 檔案：

```typescript
// 產生規則：
// 1. 類別名 = PascalCase(screenId) + "Panel"
// 2. 檔名 = 類別名 + ".ts"
// 3. 放置路徑 = assets/scripts/ui/components/
// 4. 繼承 UIScaffold
// 5. 覆寫 getLayoutPath() 回傳 JSON 路徑
// 6. 覆寫 onConfigLoaded() 掛載業務邏輯
// 7. 檔案頂部加上 // @spec-source → 見 docs/cross-reference-index.md
```

### 3. 產生 UnitTest

在 `tests/` 目錄產生對應測試檔：
- 驗證 UIScaffold 能從 JSON 正確建立節點樹
- 驗證百分比寬度計算結果
- 驗證 spriteKey 映射

### 4. 刷新 Cocos 資源
```bash
curl.exe http://localhost:7456/asset-db/refresh
```

### 5. 執行 /ui-verify 驗證
觸發 ui-verify workflow 驗證渲染結果。
