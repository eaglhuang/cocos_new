# 資料中心落差清單

- 產出時間: 2026-04-07T04:36:15.479Z
- done: 35
- reopen: 2
- master/generals-base: 200
- master/generals-lore: 200
- master/generals-stories: 200
- runtime/generals.json: 200
- runtime/generals-index.json: 200
- person-registry persons/links: 3000 / 2800

## 本輪關鍵結論

- master -> generals-index/generals.json build pipeline 已補齊，runtime 不再只停留在 5 筆 legacy 武將。
- DataCatalog 與 DataPageLoader 的前置資料檔已恢復可用，L0/L1-L5 主幹斷鏈已修補。
- 目前仍需 reopen 的主要缺口集中在雙形態資料工具驗收（DC-7-0001、DC-7-0002）。
- 200 筆資料的結構完整度已達標，但內容品質仍需另看 core-50 審校報告。

## 任務卡對照

| 卡號 | 標示 | 標題 | 審核摘要 |
| --- | --- | --- | --- |
| DC-0-0001 | done | 稀有度門檻 JSON 設定檔建立 | 與 tasks-dc.json 現況一致。 |
| DC-0-0002 | done | GeneralUnit.ts 擴充 rarityTier + characterCategory 欄位 | 與 tasks-dc.json 現況一致。 |
| DC-0-0003 | done | resolveRarityTier() 雙軸演算法實作 | 與 tasks-dc.json 現況一致。 |
| DC-1-0001 | done | 建立 master/ 目錄結構與 JSON 骨架 | 與 tasks-dc.json 現況一致。 |
| DC-1-0002 | done | validate-generals-data.js 資料品質驗證工具 | 與 tasks-dc.json 現況一致。 |
| DC-1-0003 | done | merge-generals-master.js 資料合併工具 | 與 tasks-dc.json 現況一致。 |
| DC-1-0004 | done | ingest-generals-wiki.js Wiki 爬取工具 | 與 tasks-dc.json 現況一致。 |
| DC-1-0005 | done | ingest-generals-ai.js AI 故事生成工具 | 與 tasks-dc.json 現況一致。 |
| DC-1-0006 | done | 首批 50 位核心武將資料落地 | 與 tasks-dc.json 現況一致。 |
| DC-1-0007 | done | 武將資料管線規格書建立 | 與 tasks-dc.json 現況一致。 |
| DC-2-0001 | done | DataStorageAdapter 抽象類 (IndexedDB/SQLite 雙實作) | 依任務 acceptance，IndexedDB 已完成、SQLite 允許 stub + TODO；此卡保持 done。 |
| DC-2-0002 | done | DataCatalog L0 索引層實作 | 本輪已補齊 build pipeline，generals-index.json 由 master 生成並含 200 筆資料。 |
| DC-2-0003 | done | DataPageLoader L1-L5 分頁載入器實作 | 由重建後的 generals-index/generals.json 驗證分頁載入前提已恢復。 |
| DC-2-0004 | done | ResourceManager 擴充 loadPagedData() API | 與 tasks-dc.json 現況一致。 |
| DC-2-0005 | done | MemoryManager 擴充 data scope 管理 | 與 tasks-dc.json 現況一致。 |
| DC-2-0006 | done | M2 分層載入效能基準測試 | 與 tasks-dc.json 現況一致。 |
| DC-3-0001 | done | PersonRegistry 介面 + 資料表定義 | 與 tasks-dc.json 現況一致。 |
| DC-3-0002 | done | BloodlineGraph 服務實作 | 與 tasks-dc.json 現況一致。 |
| DC-3-0003 | done | Ancestors_JSON → ancestor_chain 遷移腳本 | 與 tasks-dc.json 現況一致。 |
| DC-3-0004 | done | BloodlineTreePanel 改為從 PersonRegistry 渲染 | 與 tasks-dc.json 現況一致。 |
| DC-3-0005 | done | validate-bloodline-integrity.js 完整性驗證工具 | 目前 validate-bloodline-integrity.js 已能對 200 筆 runtime generals 驗證。 |
| DC-4-0001 | done | MessagePack 序列化整合 | 與 tasks-dc.json 現況一致。 |
| DC-4-0002 | done | pako gzip 壓縮整合 | 與 tasks-dc.json 現況一致。 |
| DC-4-0003 | done | SaveSerializer 服務實作（序列化 + 壓縮管線） | 與 tasks-dc.json 現況一致。 |
| DC-5-0001 | done | DeltaPatchBuilder 服務實作（JSON Patch RFC 6902） | 與 tasks-dc.json 現況一致。 |
| DC-5-0002 | done | SyncManager 改造：delta mode + 全量 fallback | 與 tasks-dc.json 現況一致。 |
| DC-5-0003 | done | Server API spec 文件（/sync/delta + /sync/full） | 與 tasks-dc.json 現況一致。 |
| DC-5-0004 | done | Action_Records 壓縮批次上傳 | 與 tasks-dc.json 現況一致。 |
| DC-5-0005 | done | Network 狀態偵測 + 自動重試 + 斷點續傳 | 與 tasks-dc.json 現況一致。 |
| DC-6-0001 | done | 200+ 武將完整資料擴充 | 結構達標，但內容品質仍需另看 core-50 審校報告。 |
| DC-6-0002 | done | 戰鬥日誌歸檔策略實作 | 與 tasks-dc.json 現況一致。 |
| DC-6-0003 | done | 已故武將歸檔機制（Spirit_Card 快照） | 與 tasks-dc.json 現況一致。 |
| DC-6-0004 | done | LRU 故事快取（20 位武將常駐） | 與 tasks-dc.json 現況一致。 |
| DC-6-0005 | done | DataGrowthMonitor 服務實作 | 與 tasks-dc.json 現況一致。 |
| DC-6-0006 | done | M6 長期成長模擬測試 | 與 tasks-dc.json 現況一致。 |
| DC-7-0001 | reopen | General Data Editor - Cocos Editor Extension | 仍缺 Cocos Editor 內實機啟動/儲存回寫驗證，且 deliverable 仍為 JS scaffold。 |
| DC-7-0002 | reopen | General Data Editor - Runtime Debug Panel | 仍缺 CC_DEV build-time 排除驗證，且尚未完成完整 runtime 上線驗收。 |
