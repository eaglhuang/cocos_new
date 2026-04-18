<!-- doc_id: doc_spec_0165 -->
# doc-consolidation-flow 檔案清單（完整索引）

> 快速定位所有與此 Skill 相關的檔案與文檔

---

## 設計與規範層

| 檔案 | Doc ID | 目的 | 行數 | 狀態 |
|------|--------|------|------|------|
| `.github/skills/doc-consolidation-flow/SKILL.md` | doc_agentskill_0030 | Agent Skill 完整定義 | 262 | ✅ 完成 |
| `.github/skills/doc-consolidation-flow/NEXT-STEPS.md` | — | 後續行動與里程碑 | 196 | ✅ 完成 |

---

## 追蹤與配置層

| 檔案 | 格式 | 目的 | 內容 | 狀態 |
|------|------|------|------|------|
| `docs/遊戲規格文件/consolidation-manifest.json` | JSON | 追蹤 10 份聚焦檔案進度 | status / coverage / mcqRefs | ✅ 初始化完成 |
| `docs/遊戲規格文件/討論來源整併狀態.md` | Markdown | 優先級與源檔配置 | § 2&3 定義待整併清單 | 📖 現有文檔 |

---

## 工具層（4 個 Node.js 腳本）

### consolidation-scanner.js (192 行)

```
路徑：tools_node/consolidation-scanner.js
目的：掃描新檔案、驗證 hash、初始化 manifest
命令：
  scan              列出未追蹤檔案
  add-new           加入 manifest（status=pending）
  validate          驗證 hash 一致性
  update-hash       更新指定檔案 hash
狀態：✅ 完成
```

### consolidation-extract.js (273 行)

```
路徑：tools_node/consolidation-extract.js
目的：段落切分、標記狀態、計算覆蓋率
命令：
  parse <file>                     列出所有 ## 級段落
  summary <file>                   輸出段落摘要（JSON）
  mark <file> <i> --status ... --target ...
                                   標記並更新 manifest
  coverage <file>                  計算即時覆蓋率
狀態：✅ 完成
```

### consolidation-doubt-mcq.js (243 行)

```
路徑：tools_node/consolidation-doubt-mcq.js
目的：MCQ 產出、決策追蹤、更新疑問書
命令：
  generate --summary ... --sources ... --options ...
           產出新 MCQ（自動遞增 Q 編號）
  resolve <Q_number> --answer <A|B|C|D>
           標記已拍板
  list     列出所有未決策 MCQ
狀態：✅ 完成
```

### consolidation-finalize.js (248 行)

```
路徑：tools_node/consolidation-finalize.js
目的：覆蓋率驗證、收工、大檔掃描
命令：
  verify <file>               驗證單檔（100% → completed）
  verify-all                  批次驗證 processing 檔案
  check-shards --threshold 6  掃描超大規格書
  sync-status                 顯示待同步內容
  report                      進度統計
狀態：✅ 完成
```

---

## 文檔層（4 份參考文檔）

| 檔案 | Doc ID | 目的 | 讀者 | 狀態 |
|------|--------|------|------|------|
| `docs/遊戲規格文件/doc-consolidation-flow-implementation-plan.md` | doc_spec_0162 | 7 里程碑詳細規劃 | PM / 技術主導 | ✅ 完成 |
| `docs/遊戲規格文件/doc-consolidation-flow-quick-start.md` | doc_spec_0163 | 快速上手指南 | Agent / 決策者 | ✅ 完成 |
| `docs/遊戲規格文件/doc-consolidation-flow-DELIVERABLES.md` | doc_spec_0164 | 完整交付清單 | 項目驗收 | ✅ 完成 |
| `docs/遊戲規格文件/doc-consolidation-flow-FILE-MANIFEST.md` | doc_spec_0165 | 本檔——檔案索引 | 快速定位 | ✅ 完成 |

---

## 核心業務檔案

| 檔案 | Doc ID | 用途 | 整併依據 |
|------|--------|------|---------|
| `docs/遊戲規格文件/整併疑問書.md` | doc_spec_0160 | MCQ 決策記錄 | Skill Phase 3~4 |
| `docs/遊戲規格文件/正式規格矛盾審查.md` | doc_spec_0001 | 疑點與矛盾追蹤 | Skill Phase 3 |
| `docs/遊戲規格文件/系統規格書/*.md` | doc_spec_* | 正式承接檔（回寫目標） | Skill Phase 5 |

---

## 待整併討論源（10 份聚焦檔案）

### 優先級 1：系統/關卡/模式

1. `docs/遊戲規格文件/討論來源/更舊的討論/模組化戰場系統開發策略.md`
2. `docs/遊戲規格文件/討論來源/更舊的討論/策略遊戲視覺與系統設計.md`
3. `docs/遊戲規格文件/討論來源/最早的討論/養成遊戲的遺憾與挑戰設計.md`

### 優先級 2：新檔案驗證

4. `docs/遊戲規格文件/討論來源/20260412/傳承：血脈保底機制規格書.md`
5. `docs/遊戲規格文件/討論來源/20260412/培育系統規格書討論.md`
6. `docs/遊戲規格文件/討論來源/20260412/培育系統規格書：黃巾起義.md`
7. `docs/遊戲規格文件/討論來源/20260412/賽馬娘三國傳承系統解析.md`

### 優先級 3：舊提案清零

8. `docs/遊戲規格文件/討論來源/更舊的討論/賽馬娘機制三國化轉化.md`
9. `docs/遊戲規格文件/討論來源/更舊的討論/遊戲美術風格與市場區隔策略.md`
10. `docs/遊戲規格文件/討論來源/更舊的討論/馬娘養成機制三國化設計.md`

> 所有 10 份來源均記錄於 `consolidation-manifest.json`

---

## 相關索引與交叉參考

| 檔案 | Doc ID | 關聯方式 |
|------|--------|---------|
| `docs/cross-reference-index.md` | doc_index_0005 | 新增 Skill 與工具的反向索引 |
| `docs/keep.summary.md` | doc_index_0012 | 更新整併進度至全局摘要 |
| `.github/skills-manifest.json` | — | 需新增 doc-consolidation-flow 條目 |

---

## 統計數據

| 項目 | 數值 |
|------|------|
| **工具數量** | 4 個 Node.js 腳本 |
| **代碼行數** | 956 行 |
| **文檔數量** | 4 份參考文檔 + 1 個本索引 |
| **聚焦待整併檔案** | 10 份（來自 doc_spec_0159） |
| **預期 MCQ 數量** | Q31+ （新增，取決於矛盾數量） |
| **預期工作量** | M6~M7 計 5~7 天 |

---

## 快速查閱：按工作階段

### Phase 1: Pre-flight 準備

工具：`consolidation-scanner.js scan` → `add-new`
文檔：SKILL.md § Phase 1 + quick-start.md § Step 1

### Phase 2: Extraction & Mapping

工具：`consolidation-extract.js parse` → `mark`
文檔：SKILL.md § Phase 2 + quick-start.md § Step 2

### Phase 3: Conflict Detection

工具：`consolidation-doubt-mcq.js generate`
文檔：SKILL.md § Phase 3 + quick-start.md § MCQ 產出

### Phase 4: Human-in-the-loop

工具：`consolidation-doubt-mcq.js resolve`
文檔：SKILL.md § Phase 4

### Phase 5: Finalization

工具：`consolidation-finalize.js verify` → `report`
文檔：SKILL.md § Phase 5 + implementation-plan.md § M5

---

## 下一步導航

- **立即著手**：閱讀 [NEXT-STEPS.md](.github/skills/doc-consolidation-flow/NEXT-STEPS.md)
- **快速上手**：閱讀 [quick-start.md](doc-consolidation-flow-quick-start.md) § 1~3
- **詳細規劃**：閱讀 [implementation-plan.md](doc-consolidation-flow-implementation-plan.md)
- **工具使用**：閱讀各工具的 `--help` 或 SKILL.md § 工具命令

