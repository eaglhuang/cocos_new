<!-- doc_id: doc_spec_0164 -->
# doc-consolidation-flow 完整交付清單

> 日期：2026-04-12
> 目標：將「文件整併與歸納」流程從「人工追蹤」轉升為「Agent Skill 驅動 + manifest 自動追蹤」
> 狀態：**M1~M5 工具與設計架構完成，M6~M7 待執行驗證**

---

## ✅ 已交付項目

### 1. SKILL 定義與規範（M1）

- ✅ `.github/skills/doc-consolidation-flow/SKILL.md` (doc_agentskill_0030)
  - 五階段 SOP 完整定義（Pre-flight → Extraction → Conflict Detection → Human-in-the-loop → Finalization）
  - 依賴 skill 清單（context-budget-guard, doc-shard-manager, encoding-touched-guard）
  - 100% 覆蓋率檢查邏輯與防遺漏機制
  - Token 節流約束（18k/30k 警戒線）

### 2. 追蹤 Manifest（M1）

- ✅ `docs/遊戲規格文件/consolidation-manifest.json`
  - JSON schema 完整定義
  - 10 份聚焦檔案初始化（來自 doc_spec_0159 § 2 & § 3）
  - `file_hash`, `status`, `paragraphs`, `coverage_percentage` 等欄位完備
  - 與 doc_spec_0159 同步管理優先級

### 3. 掃描與偵測工具（M2）

- ✅ `tools_node/consolidation-scanner.js` (192 行)
  - `scan` — 列出未追蹤新檔案
  - `add-new` — 自動加入 manifest（status=pending）
  - `validate` — 驗證檔案 hash 一致性
  - `update-hash` — 更新指定檔案 hash

### 4. 段落切分 & 標記引擎（M3）

- ✅ `tools_node/consolidation-extract.js` (273 行)
  - `parse <file>` — 以 `## ` 為單位切分段落
  - `summary <file>` — 輸出段落摘要（JSON）
  - `mark <file> <index> --status ... --target ...` — 標記並更新 manifest
  - `coverage <file>` — 計算即時覆蓋率

### 5. MCQ 產出與管理（M4）

- ✅ `tools_node/consolidation-doubt-mcq.js` (243 行)
  - `generate --summary ... --sources ... --options ...` — 自動 Q 編號遞增
  - `resolve <Q_number> --answer <A|B|C|D>` — 標記已拍板
  - `list` — 列出所有未決策 MCQ
  - 同步更新 `整併疑問書.md` 與 manifest 的 `mcqRefs`

### 6. 覆蓋率驗證與收工（M5）

- ✅ `tools_node/consolidation-finalize.js` (248 行)
  - `verify <file>` — 驗證單檔 100% 覆蓋率自動標 completed
  - `verify-all` — 批次驗證 processing 狀態檔案
  - `check-shards --threshold 6` — 掃描系統規格書超大檔案
  - `sync-status` — 顯示待同步至 doc_spec_0159 內容
  - `report` — 輸出整併進度統計

### 7. 實作計畫書（文件）

- ✅ `docs/遊戲規格文件/doc-consolidation-flow-implementation-plan.md` (doc_spec_0162)
  - 七個里程碑詳細規畫
  - 工具依賴總表
  - 風險與緩解措施

### 8. 快速開始指南（文件）

- ✅ `docs/遊戲規格文件/doc-consolidation-flow-quick-start.md` (doc_spec_0163)
  - Agent 與人類決策者上手手冊
  - 工具清單速查表
  - 逐步使用流程
  - Manifest 結構速查
  - 常見 Q&A

---

## 📋 工具統計

| 工具 | 行數 | 功能數 | 狀態 |
|------|------|--------|------|
| consolidation-scanner.js | 192 | 4 | ✅ 完成 |
| consolidation-extract.js | 273 | 4 | ✅ 完成 |
| consolidation-doubt-mcq.js | 243 | 3 | ✅ 完成 |
| consolidation-finalize.js | 248 | 5 | ✅ 完成 |
| **合計** | **956** | **16** | ✅ 完成 |

---

## 🎯 核心設計亮點

### 1. 100% 覆蓋率保證

```
每段落必須 → consolidated（已歸納）
          → doubt_resolved（疑點已拍板）
          → discarded（確認廢棄）

coverage = (consolidated + doubt_resolved + discarded) / total × 100

只有 coverage = 100% 且無未解 doubt 才可標 completed
```

### 2. 疑點攔截（Doubt-to-MCQ）

Agent 遇到邏輯矛盾 → **禁止自決** → MCQ 產出 → 人類拍板 → 回寫正式規格

### 3. Token 節流

- 單次最多 3 份檔案
- 掃描優先級來自 doc_spec_0159（非全量 100+ 檔）
- 大檔分段讀取 + grep 搜尋

### 4. Manifest 集中管理

單一 JSON 追蹤進度，與 `討論來源整併狀態.md` 同步更新

---

## ⚠️ 待完成項目

### M6: 首批實戰驗證（優先級 2）

需整併 20260412/ 的 4 份新檔案：
1. 傳承：血脈保底機制規格書.md
2. 培育系統規格書討論.md
3. 培育系統規格書：黃巾起義.md
4. 賽馬娘三國傳承系統解析.md

**預期產出**：
- 4 份檔案 coverage = 100%
- 可能新增 Q31+ MCQ（若有矛盾）
- 更新 `培育系統.md` / `英靈世家系統.md` / `血統理論系統.md`

### M7: 歷史 Backlog 清零（優先級 1 & 3）

分三輪整併：
1. **第一輪（優先級 1）**：模組化戰場、策略遊戲視覺、養成遊戲遺憾 (3 份)
2. **第二輪（優先級 3 前 3 份）**：賽馬娘機制轉化、美術風格、馬娘養成機制 (3 份)
3. **收尾**：驗證整體 100% 覆蓋

預估工時：3~5 天

---

## 🔄 與現有系統的銜接

- **與 doc-shard-manager 銜接**：系統規格書超 6 KB 時自動分片
- **與 context-budget-guard 銜接**：每輪 pre-flight 評估 token 預算
- **與 encoding-touched-guard 銜接**：編輯後立即檢查編碼（防 UTF-8 BOM 污染）
- **與 cross-reference-index.md (doc_index_0005) 銜接**：整併時同步更新反向索引

---

## 📌 關鍵檔案位置速查

| 用途 | 路徑 | Doc ID |
|------|------|--------|
| Skill 定義 | `.github/skills/doc-consolidation-flow/SKILL.md` | doc_agentskill_0030 |
| Manifest 追蹤 | `docs/遊戲規格文件/consolidation-manifest.json` | — |
| 優先級來源 | `docs/遊戲規格文件/討論來源整併狀態.md` | doc_spec_0159 |
| 疑點記錄 | `docs/遊戲規格文件/整併疑問書.md` | doc_spec_0160 |
| 實作計畫 | `docs/遊戲規格文件/doc-consolidation-flow-implementation-plan.md` | doc_spec_0162 |
| 快速開始 | `docs/遊戲規格文件/doc-consolidation-flow-quick-start.md` | doc_spec_0163 |
| 掃描工具 | `tools_node/consolidation-scanner.js` | — |
| 段落切分 | `tools_node/consolidation-extract.js` | — |
| MCQ 產出 | `tools_node/consolidation-doubt-mcq.js` | — |
| 覆蓋驗證 | `tools_node/consolidation-finalize.js` | — |

---

## ✨ 下一步建議

1. **環境驗證**：執行 `consolidation-scanner.js scan` 驗證工具是否正常執行
2. **手動試跑**：選 `20260412/培育系統規格書討論.md` 手動走一遍完整流程，驗證設計合理性
3. **問題回饋**：記錄試跑中發現的 UX 瓶頸或工具 bug
4. **正式批次**：完成驗證後，批次整併 M6 → M7

---

## 📊 預期效果

| 指標 | 目前 | 目標 |
|------|------|------|
| 追蹤檔案數 | 0 | 10 份（聚焦） |
| 討論覆蓋率 | 0% | 100% |
| 疑點記錄方式 | 散亂 | 統一 MCQ |
| 正式規格更新追蹤 | 手工 | 自動 manifest |
| 防遺漏檢查 | 無 | 段落 100% 驗證 |

