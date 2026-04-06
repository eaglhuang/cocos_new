---
description: 自動啟動 Cocos 預覽、截圖、檢查 Console 並驗證 UI 佈局
---

## Context Budget Guard

- 進 workflow 前先看 `.agents/skills/context-budget-guard/SKILL.md`
- 先跑 `node tools_node/check-context-budget.js --changed --emit-keep-note`
- 大型 `.md` / `.json` 變更先跑 `node tools_node/summarize-structured-diff.js --git <file>`
- 收工前跑 `node tools_node/report-turn-usage.js --changed --emit-final-line`，並在 final answer 補上 `Token 量級：少 / 中 / 大（估算）`
# UI 自動驗證流程

此 workflow 用於在修改 UI 代碼或佈局 JSON 後，自動驗證渲染結果是否正確。

## 使用時機
- 修改任何 `UILayoutConfig` JSON 後
- 修改 `UIScaffold` 或 UI 組件代碼後
- 替換美術貼圖後

## 步驟

// turbo-all

### 1. 刷新 Cocos 資源資料庫
```bash
curl.exe http://localhost:7456/asset-db/refresh
```

### 2. 使用 browser_subagent 執行瀏覽器驗證

啟動 browser_subagent，執行以下子步驟：

1. **開啟頁面**：前往 `http://localhost:7456/`
2. **等待載入**：等待 3~5 秒讓遊戲初始化完成
3. **擷取 Console**：檢查是否有致命錯誤（如 `global is not defined`、`ENOENT`、`module not found`）
   - 若有致命錯誤 → 立即回報並**停止**，不繼續導航
4. **導航至目標畫面**：依照呼叫者指定的路徑（如「點擊開始遊戲 → 點擊武將列表 Tab」）操作
5. **截圖**：擷取當前畫面截圖
6. **佈局分析**：觀察截圖判斷：
   - [ ] 文字是否重疊或被截斷？
   - [ ] 欄位是否水平對齊？
   - [ ] 資料列是否垂直排開（不重疊）？
   - [ ] 背景面板是否正確顯示？
   - [ ] 是否有不應出現的空白或黑區？
7. **回報結果**：回傳截圖路徑與分析結論

### 3. 失敗後的自動修正（最多 3 次）

若驗證失敗，依照以下流程嘗試修正：

1. 分析失敗的具體原因（如佈局擠壓、文字截斷、節點缺失）
2. 修改對應的 `UILayoutConfig` JSON 或 UI 組件 `.ts` 檔
3. 重新執行步驟 1~2
4. 若 3 次重試後仍失敗，回報問題細節供人工介入

### 4. 通過後的確認

驗證通過後：
- 將最終截圖嵌入 walkthrough artifact
- 回報「✅ UI 驗證通過」

