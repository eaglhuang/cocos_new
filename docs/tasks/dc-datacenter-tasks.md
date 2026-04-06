# 資料中心實作任務 (DC 系列)

> **任務來源**: `docs/資料中心架構規格書.md` v1.1  
> **任務代號前綴**: `DC-{里程碑}-{流水號}`  
> **建立日期**: 2026-04-06  
> **任務總數**: 34 張  
> **機器可讀 Shard**: `docs/ui-quality-tasks/phase-dc-datacenter.json`

---

## 任務代號命名規則

| 前綴 | 對應里程碑 | 說明 |
|------|-----------|------|
| `DC-0` | 共用基礎 | 稀有度系統、GeneralUnit 擴充等跨里程碑基礎 |
| `DC-1` | M1 資料管線基礎 | ingest / merge / validate 工具鏈 |
| `DC-2` | M2 分層儲存架構 | DataStorageAdapter / DataCatalog / DataPageLoader |
| `DC-3` | M3 血統正規化 | PersonRegistry / BloodlineGraph / 遷移腳本 |
| `DC-4` | M4 壓縮 + 序列化 | MessagePack / pako / SaveSerializer |
| `DC-5` | M5 增量同步協議 | DeltaPatchBuilder / SyncManager delta mode |
| `DC-6` | M6 完整覆蓋 + 增長控管 | 200+ 武將 / 歸檔機制 / DataGrowthMonitor |

---

## DC-0 共用基礎（3 張）

| 卡號 | 優先 | 標題 | 依賴 |
|------|------|------|------|
| DC-0-0001 | P0 | 稀有度門檻 JSON 設定檔建立 | 無 |
| DC-0-0002 | P0 | GeneralUnit.ts 擴充 rarityTier + characterCategory 欄位 | 無 |
| DC-0-0003 | P0 | resolveRarityTier() 雙軸演算法實作 | DC-0-0001, DC-0-0002 |

### DC-0-0001 稀有度門檻 JSON 設定檔建立
- **交付物**: `assets/resources/data/rarity-thresholds.json`
- **驗收**: 五級 (N/R/SR/SSR/UR) maxStat + avg5 雙軸門檻可被 general-balance-tuner 讀取

### DC-0-0002 GeneralUnit.ts 擴充
- **交付物**: `assets/scripts/core/models/GeneralUnit.ts`（RarityTier + characterCategory enum 擴充）
- **驗收**: `GeneralDetailRarityTier` (5 值) + `characterCategory` (5 值) 介面完整，0 TS errors

### DC-0-0003 resolveRarityTier() 雙軸演算法
- **交付物**: `assets/scripts/core/utils/RarityResolver.ts`（或 GeneralDetailOverviewMapper 更新）
- **驗收**: maxStat + avg5 雙軸取較高 tier，mythical 強制 UR，unit tests 覆蓋邊界

---

## DC-1 M1 資料管線基礎（7 張）

| 卡號 | 優先 | 標題 | 依賴 |
|------|------|------|------|
| DC-1-0001 | P0 | 建立 master/ 目錄結構與 JSON 骨架 | 無 |
| DC-1-0002 | P0 | validate-generals-data.js 資料品質驗證工具 | DC-1-0001 |
| DC-1-0003 | P0 | merge-generals-master.js 資料合併工具 | DC-1-0001, DC-1-0002 |
| DC-1-0004 | P1 | ingest-generals-wiki.js Wiki 爬取工具 | DC-1-0001 |
| DC-1-0005 | P1 | ingest-generals-ai.js AI 故事生成工具 | DC-1-0001 |
| DC-1-0006 | P1 | 首批 50 位核心武將資料落地 | DC-1-0002~0005 |
| DC-1-0007 | P1 | 武將資料管線規格書建立 | DC-1-0002 |

### DC-1-0001 master/ 目錄結構
- **交付物**: 6 個 JSON 骨架（generals-base / generals-lore / generals-stories / gene-dictionary / bloodline-templates / troop-definitions）
- **驗收**: 均可 JSON.parse()，含 version/updatedAt/data 欄位

### DC-1-0002 validate-generals-data.js
- **交付物**: `tools_node/validate-generals-data.js`
- **驗收**: 空骨架零 error，非法型別 exit(1)，數值超範圍報 error

### DC-1-0003 merge-generals-master.js
- **交付物**: `tools_node/merge-generals-master.js`
- **驗收**: --dry-run 只印 diff，重複 uid 不覆蓋，合併後自動 validate

### DC-1-0004 ingest-generals-wiki.js
- **交付物**: `tools_node/ingest-generals-wiki.js`
- **驗收**: smoke test 抓 10 位，User-Agent + 速率限制已設定，封鎖時回報 warning

### DC-1-0005 ingest-generals-ai.js
- **交付物**: `tools_node/ingest-generals-ai.js`
- **驗收**: 輸出含 historicalAnecdote / bloodlineRumor / storyStripCells，AI 呼叫失敗不整批失敗

### DC-1-0006 首批 50 位武將資料落地
- **交付物**: generals-base.json / generals-lore.json / generals-stories.json (各 50 位)
- **驗收**: validate-generals-data.js 零 error，每位含完整故事條與 rarityTier

### DC-1-0007 武將資料管線規格書
- **交付物**: `docs/系統規格書/武將資料管線規格書.md`
- **驗收**: 含工具鏈流程圖、欄位映射表、人工審核 checklist

---

## DC-2 M2 分層儲存架構（6 張）

| 卡號 | 優先 | 標題 | 依賴 |
|------|------|------|------|
| DC-2-0001 | P1 | DataStorageAdapter 抽象類 (IndexedDB/SQLite 雙實作) | DC-1-0001 |
| DC-2-0002 | P1 | DataCatalog L0 索引層實作 | DC-2-0001 |
| DC-2-0003 | P1 | DataPageLoader L1-L5 分頁載入器實作 | DC-2-0001, DC-2-0002 |
| DC-2-0004 | P1 | ResourceManager 擴充 loadPagedData() API | DC-2-0003 |
| DC-2-0005 | P1 | MemoryManager 擴充 data scope 管理 | DC-2-0003 |
| DC-2-0006 | P2 | M2 分層載入效能基準測試 | DC-2-0001~0005 |

### DataStorageAdapter 三件套
- **交付物**: `assets/scripts/core/storage/DataStorageAdapter.ts` (抽象) + `IndexedDbAdapter.ts` + `SqliteAdapter.ts`
- **驗收**: IndexedDb 可在 Web Preview 實際寫入/讀取，API 含 JSDoc

### DataCatalog L0
- **交付物**: `assets/scripts/core/storage/DataCatalog.ts` + `assets/resources/data/generals-index.json`
- **驗收**: 350 武將模擬資料下啟動 < 100ms

### DataPageLoader L1-L5
- **交付物**: `assets/scripts/core/storage/DataPageLoader.ts`
- **驗收**: L2 倉庫分頁 < 50ms，page cursor 可翻頁

### ResourceManager 擴充
- **交付物**: `assets/scripts/core/ResourceManager.ts` (loadPagedData 新增)

### MemoryManager 擴充
- **交付物**: `assets/scripts/core/MemoryManager.ts` (data scope + LRU 20 整合)

### 效能基準測試
- **交付物**: `tools_node/benchmark-storage.js` + `docs/tasks/benchmark-storage-report.md`

---

## DC-3 M3 血統正規化（5 張）

| 卡號 | 優先 | 標題 | 依賴 |
|------|------|------|------|
| DC-3-0001 | P1 | PersonRegistry 介面 + 資料表定義 | DC-1-0001 |
| DC-3-0002 | P1 | BloodlineGraph 服務實作 | DC-3-0001, DC-2-0001 |
| DC-3-0003 | P1 | Ancestors_JSON → ancestor_chain 遷移腳本 | DC-3-0001 |
| DC-3-0004 | P2 | BloodlineTreePanel 改為從 PersonRegistry 渲染 | DC-3-0002, DC-3-0003 |
| DC-3-0005 | P1 | validate-bloodline-integrity.js 完整性驗證工具 | DC-3-0001 |

### PersonRegistry
- **交付物**: `assets/scripts/core/models/PersonRegistry.ts` + `assets/resources/data/person-registry.json`
- **核心欄位**: uid, template_id, name, gene_refs[], ep_base, faction, is_virtual

### BloodlineGraph 服務
- **交付物**: `assets/scripts/core/services/BloodlineGraph.ts`
- **驗收**: 5 代 500 位 + 2000 虛擬祖先，資料量 < 舊方案 70%

### 遷移腳本
- **交付物**: `tools_node/migrate-bloodline-to-registry.js`
- **驗收**: --dry-run 不修改，遷移前自動輸出 .bak 備份

### 完整性驗證
- **交付物**: `tools_node/validate-bloodline-integrity.js`
- **驗收**: 循環引用時 exit(1)

---

## DC-4 M4 壓縮 + 序列化（3 張）

| 卡號 | 優先 | 標題 | 依賴 |
|------|------|------|------|
| DC-4-0001 | P2 | MessagePack 序列化整合 | DC-3-0002 |
| DC-4-0002 | P2 | pako gzip 壓縮整合 | DC-4-0001 |
| DC-4-0003 | P2 | SaveSerializer 服務實作（序列化 + 壓縮管線） | DC-4-0001, DC-4-0002 |

### MessagePack
- **交付物**: `assets/scripts/core/serialization/MsgpackCodec.ts` + `package.json (dependency)`
- **驗收**: 純 JS 版本，在 Cocos Creator Web Preview 可執行

### pako gzip
- **交付物**: `assets/scripts/core/serialization/GzipCodec.ts`
- **驗收**: 2MB 測試資料 → < 600KB

### SaveSerializer
- **交付物**: `assets/scripts/core/services/SaveSerializer.ts` + `assets/resources/data/field-abbreviation-map.json`
- **驗收**: 2MB JSON → < 500KB，deserialize < 50ms

---

## DC-5 M5 增量同步協議（5 張）

| 卡號 | 優先 | 標題 | 依賴 |
|------|------|------|------|
| DC-5-0001 | P2 | DeltaPatchBuilder 服務實作（JSON Patch RFC 6902） | DC-4-0003 |
| DC-5-0002 | P2 | SyncManager 改造：delta mode + 全量 fallback | DC-5-0001 |
| DC-5-0003 | P2 | Server API spec 文件（/sync/delta + /sync/full） | DC-5-0001 |
| DC-5-0004 | P2 | Action_Records 壓縮批次上傳 | DC-5-0002, DC-4-0003 |
| DC-5-0005 | P2 | Network 狀態偵測 + 自動重試 + 斷點續傳 | DC-5-0002 |

### DeltaPatchBuilder
- **交付物**: `assets/scripts/core/services/DeltaPatchBuilder.ts`
- **驗收**: RFC 6902 格式，日常 diff < 20KB

### SyncManager 改造
- **交付物**: `assets/scripts/core/SyncManager.ts`（delta + fallback 更新）

### Server API spec
- **交付物**: `docs/系統規格書/同步API規格書.md`

### Action_Records 批次壓縮
- **驗收**: 100 筆 Action_Records < 50KB compressed

### Network retry
- **驗收**: 重試 3 次，佇列上限 10 筆（超過降級全量）

---

## DC-6 M6 完整覆蓋 + 增長控管（6 張）

| 卡號 | 優先 | 標題 | 依賴 |
|------|------|------|------|
| DC-6-0001 | P2 | 200+ 武將完整資料擴充 | DC-1-0006, DC-3-0003 |
| DC-6-0002 | P2 | 戰鬥日誌歸檔策略實作 | DC-2-0001, DC-3-0002 |
| DC-6-0003 | P2 | 已故武將歸檔機制（Spirit_Card 快照） | DC-2-0001, DC-3-0002 |
| DC-6-0004 | P2 | LRU 故事快取（20 位武將常駐） | DC-2-0005 |
| DC-6-0005 | P2 | DataGrowthMonitor 服務實作 | DC-2-0001 |
| DC-6-0006 | P2 | M6 長期成長模擬測試 | DC-6-0002~0005 |

### 200+ 武將資料
- **交付物**: master/ 各 JSON 更新（200+ 位）
- **驗收**: validate-generals-data.js 零 error

### BattleLogArchiver
- **交付物**: `assets/scripts/core/services/BattleLogArchiver.ts`
- **策略**: 最近 100 場完整 → 季度摘要 → 2 年前刪除

### GeneralArchiver + SpiritCard
- **交付物**: `assets/scripts/core/services/GeneralArchiver.ts` + `assets/scripts/core/models/SpiritCard.ts`

### LRU 故事快取
- **交付物**: `MemoryManager.ts`（LRU lore scope 更新）
- **驗收**: 超 20 位自動 evict，下次存取重載

### DataGrowthMonitor
- **交付物**: `assets/scripts/core/services/DataGrowthMonitor.ts`
- **驗收**: > 5MB warning，> 10MB error 事件

### 長期成長模擬測試
- **交付物**: `tools_node/simulate-data-growth.js` + 模擬報告
- **驗收**: 1000 天/500 武將/10000 場 → 存檔 < 5MB compressed

---

## 執行優先序建議

```
【P0 立即開工】
DC-0-0001 → DC-0-0002 → DC-0-0003
DC-1-0001 → DC-1-0002 → DC-1-0003

【P1 M1 管線】
DC-1-0004, DC-1-0005（可並行）→ DC-1-0006 → DC-1-0007
DC-2-0001 → DC-2-0002 → DC-2-0003 → DC-2-0004, DC-2-0005（可並行）
DC-3-0001 → DC-3-0005（並行 DC-3-0003）→ DC-3-0002 → DC-3-0004

【P2 後期品質提升】
DC-2-0006（基準測試）
DC-4-0001 → DC-4-0002 → DC-4-0003
DC-5-0001 → DC-5-0002 → DC-5-0003, DC-5-0004, DC-5-0005（可並行）
DC-6-0001~0005（可並行）→ DC-6-0006
```

---

## 統計摘要

| 里程碑 | 任務數 | P0 | P1 | P2 |
|--------|--------|----|----|-----|
| DC-0 共用基礎 | 3 | 3 | - | - |
| DC-1 資料管線 | 7 | 3 | 4 | - |
| DC-2 分層儲存 | 6 | - | 5 | 1 |
| DC-3 血統正規化 | 5 | - | 4 | 1 |
| DC-4 壓縮序列化 | 3 | - | - | 3 |
| DC-5 增量同步 | 5 | - | - | 5 |
| DC-6 完整覆蓋 | 6 | - | - | 6 |
| **合計** | **35** | **6** | **13** | **16** |

> 注意：DC-6-0004 (LRU 故事快取) 實際上由 DC-2-0005 實作，DC-6-0004 是其 M6 phase 的驗收確認任務。
