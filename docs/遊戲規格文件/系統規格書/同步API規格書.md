<!-- doc_id: doc_tech_0010 -->
# 同步 API 規格書

**版本**：v1.0  
**最後更新**：2026-04-06  
**作者**：Agent1  
**來源**：資料中心架構規格書.md (doc_tech_0009) §六 M5  

---

## 1. 概述

本規格書定義遊戲客戶端與後端同步伺服器之間的 HTTP API，包含：

- `POST /sync/delta` — Delta 增量同步（優先使用）
- `POST /sync/full`  — 全量同步（fallback 或首次同步）

所有請求需帶 `Authorization` Header（Bearer Token），回應格式為 JSON。

---

## 2. 通用設定

| 項目 | 說明 |
|------|------|
| Base URL | `https://api.3klife.game/v1`（dev: `http://localhost:3000`）|
| 內容類型 | `Content-Type: application/json` |
| 認證方式 | `Authorization: Bearer <sessionToken>` |
| 壓縮格式 | 請求 body 可選用 gzip（Header: `Content-Encoding: gzip`） |
| 逾時設定 | 15 秒（客戶端應自行處理逾時）|

---

## 3. POST /sync/delta

### 3.1 用途

上傳自上次同步點以來的 delta patch，伺服器驗證後合併至主存檔。

### 3.2 Request

```json
{
  "deviceId": "DEV_1234567890_001",
  "sessionToken": "eyJhbGciOiJIUzI1NiJ9...",
  "baseHash": "sha256:abc123...",
  "patches": [
    { "op": "replace", "path": "/generals/0/str", "value": 95 },
    { "op": "add", "path": "/generals/5", "value": { "uid": "guo-jia", ... } }
  ],
  "actionRecords": [
    {
      "seq": 42,
      "type": "BATTLE_RESULT",
      "timestamp": 1712400000000,
      "payload": { "battleId": "B-001", "result": "WIN" }
    }
  ],
  "clientTimestamp": 1712400010000
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `deviceId` | string | ✅ | 裝置唯一識別碼 |
| `sessionToken` | string | ✅ | 當前會話 Token |
| `baseHash` | string | ✅ | 本次 patch 基準的存檔 hash（SHA-256） |
| `patches` | JsonPatch[] | ✅ | JSON Patch RFC 6902 陣列 |
| `actionRecords` | ActionRecord[] | ✅ | 本次同步批次的行動記錄 |
| `clientTimestamp` | number | ✅ | 客戶端 Unix ms 時間戳 |

### 3.3 Response — 成功 (200)

```json
{
  "status": "confirmed",
  "newHash": "sha256:def456...",
  "serverTimestamp": 1712400015000,
  "warnings": []
}
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| `status` | `"confirmed"` | 同步成功 |
| `newHash` | string | 伺服器合併後的新 hash |
| `serverTimestamp` | number | 伺服器時間戳（Unix ms）|
| `warnings` | string[] | 非阻塞性警告訊息 |

### 3.4 Response — 衝突 (409)

```json
{
  "status": "conflict",
  "conflictType": "hash_mismatch",
  "serverHash": "sha256:xyz789...",
  "message": "baseHash mismatch, please perform full sync"
}
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| `status` | `"conflict"` | 衝突，需走全量同步 |
| `conflictType` | string | 衝突原因 |
| `serverHash` | string | 伺服器當前 hash |

### 3.5 HTTP 狀態碼（delta）

| HTTP 狀態碼 | 說明 |
|-------------|------|
| 200 | 同步成功 |
| 400 | 請求格式錯誤（缺欄位、patch 格式非法） |
| 401 | Token 無效或過期 |
| 409 | hash 衝突，需全量同步 |
| 429 | 請求頻率過高（rate limit exceeded）|
| 500 | 伺服器內部錯誤 |

---

## 4. POST /sync/full

### 4.1 用途

上傳完整存檔（首次同步、hash 衝突後 fallback、或手動強制同步）。

### 4.2 Request

```json
{
  "deviceId": "DEV_1234567890_001",
  "sessionToken": "eyJhbGciOiJIUzI1NiJ9...",
  "saveData": {
    "version": "1.0.0",
    "generals": [ ... ],
    "battleLogs": [ ... ],
    "worldState": { ... }
  },
  "clientTimestamp": 1712400010000
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `deviceId` | string | ✅ | 裝置唯一識別碼 |
| `sessionToken` | string | ✅ | 當前會話 Token |
| `saveData` | object | ✅ | 完整存檔物件（未壓縮 JSON）|
| `clientTimestamp` | number | ✅ | 客戶端 Unix ms 時間戳 |

> **注意**：若使用 gzip 壓縮（Header `Content-Encoding: gzip`），`saveData` 欄位應為壓縮後的 Base64 字串，並附帶 `"compressed": true` 欄位。

### 4.3 Response — 成功 (200)

```json
{
  "status": "confirmed",
  "newHash": "sha256:abc999...",
  "serverTimestamp": 1712400020000,
  "warnings": []
}
```

### 4.4 Response — 衝突 (409)

```json
{
  "status": "conflict",
  "conflictType": "version_too_old",
  "serverVersion": "1.1.0",
  "message": "Client save version is outdated"
}
```

### 4.5 HTTP 狀態碼（full）

| HTTP 狀態碼 | 說明 |
|-------------|------|
| 200 | 全量同步成功 |
| 400 | 請求格式錯誤或存檔格式非法 |
| 401 | Token 無效或過期 |
| 409 | 版本衝突（伺服器版本更新）|
| 413 | 存檔超過大小上限（5MB compressed）|
| 429 | 請求頻率過高 |
| 500 | 伺服器內部錯誤 |

---

## 5. 錯誤碼表

| 錯誤碼 | HTTP 狀態 | 說明 |
|--------|-----------|------|
| `E001` | 400 | 必填欄位缺漏 |
| `E002` | 400 | patch 格式非法（非 RFC 6902）|
| `E003` | 401 | Token 無效 |
| `E004` | 401 | Token 已過期 |
| `E005` | 409 | hash 不匹配（需全量同步）|
| `E006` | 409 | 存檔版本過舊 |
| `E007` | 413 | 存檔超過大小限制 |
| `E008` | 429 | Rate limit exceeded（每分鐘最多 10 次同步）|
| `E099` | 500 | 伺服器內部錯誤 |

---

## 6. 客戶端流程

```
嘗試 /sync/delta
    │
    ├─ 200 → 更新 lastHash → 結束
    │
    ├─ 409 → fallback to /sync/full
    │           │
    │           ├─ 200 → 更新 lastHash → 結束
    │           └─ 4xx/5xx → 通知玩家，排程重試
    │
    └─ 401 → 重新驗證 Token → 重試
    └─ 5xx → 排程重試（指數退避，最多 3 次）
```

---

## 7. 安全性規範

1. `sessionToken` 每 24 小時輪換一次
2. `deviceId` 與 `sessionToken` 強制綁定，防止帳號共用
3. 所有請求強制 HTTPS（dev 環境例外）
4. Action_Records payload 不得包含 PII（個人可識別資訊）
5. 伺服器驗證 `patches` 中的 JSON Pointer 路徑白名單，防止注入攻擊
