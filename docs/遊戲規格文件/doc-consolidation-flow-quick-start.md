<!-- doc_id: doc_spec_0163 -->
# doc-consolidation-flow 快速開始指南

> 本文檔是 Agent Skill `doc-consolidation-flow` 的使用手冊，適合 Agent 與人類決策者快速上手。

---

## 0. 架構簡述

```
討論來源/（100+ 散亂檔案）
    ↓
[consolidation-scanner.js] 掃描偵測新檔
    ↓
[consolidation-manifest.json] 追蹤進度（10 份聚焦檔案）
    ↓
[consolidation-extract.js] 段落切分 + 標記
    ↓
討論內容 → 歸納至正式規格 / 轉為 MCQ 疑點 / 確認廢棄
    ↓
[consolidation-doubt-mcq.js] MCQ 產出供人類決策
    ↓
人類拍板 → [consolidation-finalize.js] 更新正式規格 + 驗證覆蓋率
    ↓
100% 覆蓋率達成 → manifest 標記 completed
```

---

## 1. 核心檔案速查表

| 檔案 | 用途 | 路徑 |
|------|------|------|
| **SKILL 定義** | Agent 觸發條件與 SOP | `.github/skills/doc-consolidation-flow/SKILL.md` (doc_agentskill_0030) |
| **追蹤 manifest** | 記錄每份檔案的進度 | `docs/遊戲規格文件/consolidation-manifest.json` |
| **優先級來源** | 哪些檔案該整併 | `docs/遊戲規格文件/討論來源整併狀態.md` (doc_spec_0159) § 2 & § 3 |
| **疑點記錄** | 轉為 MCQ 的所有疑問 | `docs/遊戲規格文件/整併疑問書.md` (doc_spec_0160) |
| **正式規格** | 整併後的正式承接檔 | `docs/遊戲規格文件/系統規格書/` 各檔 |

---

## 2. 工具清單

### Phase 1: 掃描偵測

```bash
node tools_node/consolidation-scanner.js scan
    → 列出新檔案（未在 manifest 中）

node tools_node/consolidation-scanner.js add-new
    → 自動加入 manifest（status=pending）
```

### Phase 2: 段落切分 & 標記

```bash
node tools_node/consolidation-extract.js parse <file>
    → 列出所有 ## 級段落

node tools_node/consolidation-extract.js coverage <file>
    → 計算覆蓋率

node tools_node/consolidation-extract.js mark <file> <index> \
    --status consolidated --target doc_spec_0026
    → 標記段落狀態並更新 manifest
```

### Phase 3: MCQ 產出

```bash
node tools_node/consolidation-doubt-mcq.js generate \
    --summary "疑點摘要" \
    --sources "doc_spec_0022,doc_spec_0012" \
    --options "A:選項A|B:選項B|C:選項C|D:選項D"
    → 新增 MCQ 至整併疑問書.md

node tools_node/consolidation-doubt-mcq.js resolve 31 --answer A
    → 標記 Q31 已裁決
```

### Phase 4: 覆蓋率驗證 & 收工

```bash
node tools_node/consolidation-finalize.js verify <file>
    → 驗證單檔覆蓋率（100% → 自動標 completed）

node tools_node/consolidation-finalize.js verify-all
    → 批次驗證所有 processing 檔

node tools_node/consolidation-finalize.js report
    → 輸出整併進度統計
```

---

## 3. 使用流程（逐步）

### Step 1: 初始掃描

```bash
cd c:\Users\User\3KLife
node tools_node/consolidation-scanner.js scan
node tools_node/consolidation-scanner.js add-new
```

預期輸出：manifest 新增未追蹤的檔案，status=pending。

### Step 2: 逐檔整併（Agent）

針對單份討論文件：

```bash
node tools_node/consolidation-extract.js parse <file>
  → 輸出段落清單

# Agent 逐段比對正式規格，調用：
node tools_node/consolidation-extract.js mark <file> 0 \
    --status consolidated --target doc_spec_0026

# 若遇到疑點，調用：
node tools_node/consolidation-doubt-mcq.js generate \
    --summary "..." --sources "..." --options "..."

node tools_node/consolidation-extract.js mark <file> 1 \
    --status doubt --target doc_spec_0026
```

### Step 3: 人類決策（MCQ）

Agent 輸出所有 MCQ，人類拍板後：

```bash
node tools_node/consolidation-doubt-mcq.js resolve 31 --answer A
```

Agent 接收決策，回寫至正式規格書。

### Step 4: 驗證完成

```bash
node tools_node/consolidation-finalize.js verify <file>
  → 若 coverage=100%，自動標 completed

node tools_node/consolidation-finalize.js report
  → 檢查整體進度
```

---

## 4. 100% 覆蓋率檢查清單

在標記檔案為 `completed` 前，確認：

- [ ] 每個 `## ` 段落都被標記為終態（consolidated / doubt_resolved / discarded）
- [ ] 無 `pending > 0` 的段落遺漏
- [ ] 所有 `doubt` 段落都已由人類拍板（MCQ 已 resolve）
- [ ] `coverage_percentage = 100%`
- [ ] manifest 中該檔 `status = completed` 且 `dateCompleted` 已填

---

## 5. 當前優先順序（由 doc_spec_0159 決定）

### 優先級 1: 系統/關卡/模式（M6.1）

1. `更舊的討論/模組化戰場系統開發策略.md`
2. `更舊的討論/策略遊戲視覺與系統設計.md`
3. `最早的討論/養成遊戲的遺憾與挑戰設計.md`

### 優先級 2: 新檔案整併驗證（M6.2）

4. `20260412/傳承：血脈保底機制規格書.md`
5. `20260412/培育系統規格書討論.md`
6. `20260412/培育系統規格書：黃巾起義.md`
7. `20260412/賽馬娘三國傳承系統解析.md`

### 優先級 3: 舊提案清零（M7）

8. `更舊的討論/賽馬娘機制三國化轉化.md`
9. `更舊的討論/遊戲美術風格與市場區隔策略.md`
10. `更舊的討論/馬娘養成機制三國化設計.md`

---

## 6. Manifest 結構速查

```json
{
  "files": [
    {
      "path": "相對路徑",
      "file_hash": "sha256 hash",
      "status": "pending|processing|completed",
      "paragraphs": {
        "total": 段落總數,
        "consolidated": 已歸納,
        "doubt": 疑點段落,
        "discarded": 廢棄,
        "pending": 未處理
      },
      "coverage_percentage": 0-100,
      "targetSpecs": ["doc_spec_0026", ...],
      "mcqRefs": ["Q31", "Q32", ...]
    }
  ]
}
```

---

## 7. 常見 Q&A

**Q: 如何判斷段落應該 consolidated vs doubt?**

A: 若段落內容與現行正式規格（§ 1「已整併」的母檔）一致，標 consolidated；若有邏輯矛盾或新增內容，標 doubt。

**Q: 一份檔案超過多大應該停下來?**

A: 單輪 token 預算若達 18k 警戒線，先暫停，產出 handoff 摘要，下一輪繼續。

**Q: MCQ 何時才算「已決策」?**

A: 當人類在整併疑問書.md 的 Q 題後方標記「✓ 決策：選項 X」，且 Agent 已回寫至正式規格書。

---

## 8. 下一步

1. 執行 `node tools_node/consolidation-scanner.js scan` 驗證環境
2. 選定優先級 1 的三份檔案之一，手動執行完整流程一遍，驗證工具合理性
3. 產出第一份完整「從討論到完成」的案例報告
4. 批次整併剩餘檔案

