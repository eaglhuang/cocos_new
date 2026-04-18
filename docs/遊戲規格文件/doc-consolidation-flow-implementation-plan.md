<!-- doc_id: doc_spec_0162 -->
# doc-consolidation-flow 實作計畫書

> 目標：將 `docs/遊戲規格文件/討論來源/` 的整併流程從「人工追蹤」升級為「Agent Skill 驅動 + manifest 自動追蹤」，保證 100% 段落覆蓋率。

---

## 里程碑總覽

| 里程碑 | 名稱 | 交付物 | 預估工時 | 依賴 |
|--------|------|--------|----------|------|
| M1 | SKILL 定義與 Manifest 結構 | SKILL.md + manifest.json + skills-manifest 更新 | 1 天 | 無 |
| M2 | 掃描偵測工具 | `tools_node/consolidation-scanner.js` | 1~2 天 | M1 |
| M3 | 段落切分與標記引擎 | `tools_node/consolidation-extract.js` | 2~3 天 | M1 |
| M4 | MCQ 產出器 | `tools_node/consolidation-doubt-mcq.js` | 1 天 | M3 |
| M5 | 回寫與覆蓋率驗證 | `tools_node/consolidation-finalize.js` | 2 天 | M3, M4 |
| M6 | 首批實戰驗證 | 整併 20260412/ 四份新文件 | 1~2 天 | M2~M5 |
| M7 | 歷史 backlog 清零 | 整併 § 2.1 ~ § 2.4 共 7 份待處理檔 | 3~5 天 | M6 |

---

## M1：SKILL 定義與 Manifest 結構（✅ 已完成）

### 交付物

- [x] `.github/skills/doc-consolidation-flow/SKILL.md` (doc_agentskill_0030)
- [x] `docs/遊戲規格文件/consolidation-manifest.json`（初始版，含 11 份 pending 檔案）
- [ ] 更新 `.github/skills-manifest.json` 新增 `doc-consolidation-flow` 條目
- [ ] 更新 `docs/cross-reference-index.md` (doc_index_0005) 補上新 skill 索引

### 驗收標準

- SKILL.md 完整定義五階段 SOP
- manifest.json 結構含 `file_hash`、`status`、`coverage_percentage`
- 可被 `(best)` 模式正確觸發

---

## M2：掃描偵測工具

### 目標

建立 `tools_node/consolidation-scanner.js`，自動偵測新檔案並更新 manifest。

### 功能

```bash
# 掃描並列出未追蹤檔案
node tools_node/consolidation-scanner.js scan

# 將新檔案加入 manifest（status=pending）
node tools_node/consolidation-scanner.js add-new

# 驗證 manifest 與磁碟一致性（hash 比對）
node tools_node/consolidation-scanner.js validate
```

### 技術要點

- 遞迴掃描 `docs/遊戲規格文件/討論來源/` 所有 `.md`
- 計算 SHA-256 hash，與 manifest 中的 `file_hash` 比對
- 若 hash 不符（文件被修改），標記為 `needs-rescan`
- 輸出 JSON 格式結果，可被 Agent 直接解析

### 驗收標準

- `scan` 正確識別 20260412/ 的 4 份新檔
- `validate` 能偵測 hash 不一致
- 不讀取檔案內容（只掃路徑 + hash），保持低 token 消耗

---

## M3：段落切分與標記引擎

### 目標

建立 `tools_node/consolidation-extract.js`，將討論文件切分為段落並支援標記。

### 功能

```bash
# 切分段落並輸出段落清單
node tools_node/consolidation-extract.js parse <file>

# 標記段落狀態
node tools_node/consolidation-extract.js mark <file> --paragraph 3 --status consolidated --target doc_spec_0026

# 輸出單檔覆蓋率
node tools_node/consolidation-extract.js coverage <file>
```

### 技術要點

- 以 `## ` 為段落分隔符，preamble 為段落 0
- 每個段落產出摘要（前 3 行 + 字數）
- 標記寫入 manifest 的 `paragraphs` 計數器
- 支援關鍵字比對，自動建議可能的 `targetSpecs`

### 驗收標準

- 正確切分含 5+ 段落的討論文件
- `coverage` 計算結果與手動驗算一致
- 標記操作冪等（重複標記不改變計數）

---

## M4：MCQ 產出器

### 目標

建立 `tools_node/consolidation-doubt-mcq.js`，從疑點自動產出 MCQ 格式。

### 功能

```bash
# 產出 MCQ 並附加到整併疑問書.md
node tools_node/consolidation-doubt-mcq.js generate \
  --summary "英靈卡誕生門檻與血脈保底機制衝突" \
  --sources "doc_spec_0011,doc_spec_0022" \
  --options "A:只保底史實名將|B:全 SSR 保底|C:依戰績決定|D:不做保底"
```

### 技術要點

- 自動讀取 `整併疑問書.md` 現有最大 Q 編號，遞增
- 產出標準 MCQ 格式並 append
- 同步更新 `consolidation-manifest.json` 的 `mcqRefs`
- 同步在 `正式規格矛盾審查.md` 新增對應條目

### 驗收標準

- Q 編號自動遞增且不衝突
- MCQ 格式與現有 Q1~Q30 一致
- manifest 的 `mcqRefs` 正確關聯

---

## M5：回寫與覆蓋率驗證

### 目標

建立 `tools_node/consolidation-finalize.js`，自動化收工流程。

### 功能

```bash
# 驗證單檔覆蓋率並更新 manifest
node tools_node/consolidation-finalize.js verify <file>

# 批次驗證所有 processing 狀態的檔案
node tools_node/consolidation-finalize.js verify-all

# 更新 討論來源整併狀態.md
node tools_node/consolidation-finalize.js sync-status
```

### 技術要點

- 讀取 manifest，計算每檔覆蓋率
- 100% 覆蓋且無未解 doubt → 自動標為 `completed`
- 產出更新段落並插入 `討論來源整併狀態.md` 的對應 section
- 呼叫 `shard-manager.js scan` 檢查是否有新的大檔需分片

### 驗收標準

- `verify` 正確判定 100% 覆蓋率的檔案
- `sync-status` 產出的 Markdown 格式與現有 `討論來源整併狀態.md` 一致
- 整體流程可在 `(best)` 模式下自動串接

---

## M6：首批實戰驗證

### 目標

使用完整工具鏈整併 `20260412/` 的 4 份新討論文件。

### 執行步驟

1. `consolidation-scanner.js scan` → 確認 4 份新檔
2. 逐檔執行 `consolidation-extract.js parse` → 切分段落
3. Agent 逐段落比對正式規格，標記 `consolidated` / `doubt` / `discarded`
4. 若有 doubt → `consolidation-doubt-mcq.js generate` → 等人類拍板
5. `consolidation-finalize.js verify-all` → 確認 100% 覆蓋
6. 更新所有下游文件

### 預期產出

- 4 份討論文件從 `pending` → `completed`
- 可能的正式規格書更新：`培育系統.md`、`英靈世家系統.md`、`血統理論系統.md`
- 若有新疑點：Q31+ 加入整併疑問書

### 驗收標準

- manifest 中 4 份檔案的 `coverage_percentage = 100%`
- `討論來源整併狀態.md` 新增 `§ 1.12 2026-04-12 已整併`

---

## M7：歷史 Backlog 清零

### 目標

整併 `討論來源整併狀態.md` § 2.1 ~ § 2.4 中仍待整併的 7 份檔案。

### 檔案清單

| # | 檔案 | 預估難度 | 可能受影響規格書 |
|---|------|----------|----------------|
| 1 | 更舊的討論/模組化戰場系統開發策略.md | 中 | 戰場部署系統、戰法場景規格書 |
| 2 | 更舊的討論/策略遊戲視覺與系統設計.md | 中 | 關卡設計系統、美術風格規格書 |
| 3 | 更舊的討論/賽馬娘機制三國化轉化.md | 低 | 培育系統、結緣系統 |
| 4 | 更舊的討論/遊戲美術風格與市場區隔策略.md | 低 | 美術風格規格書 |
| 5 | 更舊的討論/馬娘養成機制三國化設計.md | 低 | 培育系統、因子解鎖系統 |
| 6 | 更舊的討論/三國傳承：賽馬娘養成融合提案.md | 中 | 多系統交叉 |
| 7 | 最早的討論/養成遊戲的遺憾與挑戰設計.md | 低 | 留存系統、培育系統 |

### 執行策略

- 每輪最多處理 3 份（token 節流）
- 第一輪：#1, #2, #3（中難度優先消化）
- 第二輪：#4, #5, #6
- 第三輪：#7 + 全體驗證

### 驗收標準

- `討論來源整併狀態.md` § 2「仍待整併」清空
- manifest `overallCoverage` 達到 100%
- 所有 doubt 已由人類拍板或確認不需拍板

---

## 風險與緩解

| 風險 | 影響 | 緩解措施 |
|------|------|---------|
| 討論文件過大超過 token 預算 | 單輪無法完成 | 分段讀取 + 多輪處理 |
| MCQ 過多導致人類決策瓶頸 | 流程卡住 | 優先標記低爭議段落，集中高爭議 MCQ |
| 正式規格書在整併期間被修改 | hash 不一致 | finalize 前重新驗證 cross-ref |
| 舊討論與現行規格完全矛盾 | 廢棄比例高 | 直接標 `discarded` 並附理由，不升級為 MCQ |

---

## 工具依賴總表

| 工具 | 用途 | 已存在 |
|------|------|--------|
| `check-context-budget.js` | Token 預算評估 | ✅ |
| `shard-manager.js` | 大檔分片管理 | ✅ |
| `check-encoding-touched.js` | 編碼檢查 | ✅ |
| `report-turn-usage.js` | 收工回報 | ✅ |
| `generate-context-summary.js` | Handoff 摘要卡 | ✅ |
| `consolidation-scanner.js` | 新檔掃描偵測 | ❌ M2 新建 |
| `consolidation-extract.js` | 段落切分標記 | ❌ M3 新建 |
| `consolidation-doubt-mcq.js` | MCQ 產出 | ❌ M4 新建 |
| `consolidation-finalize.js` | 覆蓋率驗證收工 | ❌ M5 新建 |
