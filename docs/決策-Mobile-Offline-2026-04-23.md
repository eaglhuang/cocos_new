---
title: Mobile-first Offline Support Decision
date: 2026-04-23
---

# 決策：Mobile-first Offline Support（2026-04-23）

## TL;DR
- 決策：離線支援只要求 `Android` / `iOS` 原生 App 必須提供可靠離線體驗；`Web` / `PC` 為線上優先，行動瀏覽器 / PWA 支援列入 Phase 2。
- 行為約束：所有金流、付費、以及正式的 `Gacha` 動作維持 online-only（無網路時阻擋）。

## 原因
- 桌面與瀏覽器環境多數常連網，且瀏覽器的 IndexedDB 容易被使用者清除或系統回收，無法保證跨裝置一致性。原生 App 能使用 SQLite 與 OS 提供的可持久儲存路徑，較適合做可靠的離線存檔。

## 決議內容（實作要點）
1. 優先完成 `SqliteAdapter`（Android / iOS）與 background uploader（retry/backoff/idempotency）。
2. `SyncManager` 暴露 `forceSync()` / `sync_outbox` 狀態機，供使用者在換裝置或上線前強制 flush。
3. `Web` / `PC`：保留 `IndexedDbAdapter` 作為暫存/快取，但不視為跨裝置的可靠備份；在 UI 顯示「最後同步時間」與「需上傳」提示。
4. `Gacha` / 商城 / 金流一律 online-only（若無網路則阻擋並顯示友善提示）。

## 單機（Local-only）使用場景說明
- 允許存在一個明確標示為「單機模式 / 開發模式」的行為類別：`LOCAL_GACHA_PULL`，僅用於單裝置體驗或開發測試。此類行為：
  - 永遠只存在本地 `snapshot` 與 `action_log`，不會自動送到 server。  
  - 在 action record 中標示 `localOnly: true`。  

## 文件更新與追蹤
- 本決議為暫時性設計變更（2026-04-23）；請將此檔加入 PR 描述並同步更新：
  - `docs/資料中心架構規格書.md`（新增摘要與 decision link）
  - `docs/遊戲規格文件/系統規格書/Data Schema文件（本機端與Server端）.md`（新增 local-only action 範例）

---

## 實作檢核（Acceptance Criteria）
1. Native (Android/iOS) 能在離線時執行必要本地動作並寫入 SQLite（或等價持久儲存），重啟後資料仍存在。  
2. SyncManager 提供 `forceSync()` 可在上線時把 outbox flush 並等待 ACK。  
3. Web/PC 在無網路時 UI 明確阻擋金流動作並提示「需網路」。  

---

最後更新：2026-04-23
