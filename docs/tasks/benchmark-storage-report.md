# Benchmark Storage 效能基準報告

> 生成日期：2026-04-06 16:12:32 (UTC+8)
> 工具：tools_node/benchmark-storage.js
> 測試 runs：3
> 模擬武將數：350

## 測試結果（ms）

| 驗收 | 測試項目 | avg | min | max | 目標 |
|------|---------|-----|-----|-----|------|
| ✅ | L0 generals-index.json 解析（啟動） | 0.1ms | 0.09ms | 0.1ms | < 100ms |
| -- | L1 陣容預載（12 位武將） | 0.02ms | 0.01ms | 0.02ms | 參考值 |
| ✅ | L2 倉庫分頁載入（20 位 / 頁） | 0.02ms | 0.02ms | 0.03ms | < 50ms |
| -- | L3 單筆詳情載入（含 lore） | 0ms | 0ms | 0.01ms | 參考值 |

## 資料量估算

| 層級 | 說明 | 大小 |
|------|------|------|
| L0 index JSON | 350 武將索引（uid/name/faction/rarityTier） | 34.3 KB |
| L1 active JSON | 12 位陣容武將完整資料 | 4.8 KB |
| L2 page JSON | 倉庫單頁 20 位武將 | 8.1 KB |
| L3 single lore | 單筆武將 lore（故事/血脈） | 1.0 KB |
| **記憶體峰值估算** | **L0 + L1 + LRU 20 故事** | **58.4 KB** |

## 總驗收結果

**✅ PASS**

- L0 < 100ms：✅ PASS（avg 0.1ms）
- L2 < 50ms：✅ PASS（avg 0.02ms）

## 備注

- 本測試使用 Node.js in-memory JSON.parse 模擬，不含網路/磁碟 I/O。
- 實際遊戲環境因 Cocos cc.resources.load 的 async I/O 可能略高於此值。
- 若 L0 > 80ms 或 L2 > 40ms 建議開啟欄位壓縮（field-abbreviation-map）。
- 相依：DataPageLoader.ts、DataCatalog.ts、DataStorageAdapter.ts (DC-2-0001~0003)。
