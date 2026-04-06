---
name: doc-shard-manager
description: >
  文件分片管理 SKILL — 管理「大型文件 → shard 目錄群」的生命週期。
  USE FOR: 任何大型 .md / .json 檔案需要拆分為小分片、更新分片後重建索引、
  驗證分片完整性，或新增 shard 目錄給新的大型文件。
  DO NOT USE FOR: 程式碼編輯、UI layout 調整、任務卡狀態更新（那些直接改對應 JSON）。
argument-hint: >
  Describe which document group needs work:
  'keep-shards', 'tasks', 'cross-ref', or a new file path.
  Specify intent: 'shard (initial split)', 'rebuild-index', 'validate', or 'status'.
---

# Doc Shard Manager SKILL

## 概念與用途

大型文件（>6000 tokens）會觸發 Token 節流警戒線。解法是將其拆分為「shard 目錄群」：
- 原始大檔變成一個輕量的「索引 stub」（< 1 KB），列出各分片路徑
- 實際內容拆入各 shard 檔案（通常 3–10 KB 各自獨立）
- Agent 只按需讀取相關分片，大幅降低每輪 token 消耗

本 SKILL 的核心工具是 `tools_node/shard-manager.js`，設定檔為各 shard 目錄下的 `.shardrc.json`。

---

## 本專案現有 Shard Groups

| 索引 stub | Shard 目錄 | 分片數 | 類型 |
|-----------|-----------|--------|------|
| `docs/keep.md` | `docs/keep-shards/` | 4 | `markdown-h2` |
| `docs/ui-quality-todo.json` | `docs/tasks/` | 4 | `json-array` |
| `docs/cross-reference-index.md` | `docs/cross-ref/` | 3 | `markdown-h2` |

---

## 可用命令

```bash
# 初始分片（首次拆分 or 原始大檔有重大更新後重跑）
node tools_node/shard-manager.js shard  <shardDir>

# 反向維護：分片有修改 → 重建索引 stub
node tools_node/shard-manager.js rebuild-index  <shardDir>

# 完整性驗證（CI 前 / 收工前必跑）
node tools_node/shard-manager.js validate  <shardDir>

# 狀態瀏覽（大小 + 修改時間）
node tools_node/shard-manager.js status  <shardDir>

# 一次分片多個 shard 目錄
node tools_node/shard-manager.js shard-all  docs/keep-shards docs/tasks docs/cross-ref
```

---

## Workflow A：維護既有分片（最常見）

**觸發時機**：某個 shard 檔案的內容被修改（加新條目、更新狀態、新增章節等）。

### Step 1 — 直接編輯對應分片

不要改索引 stub，直接找到對應的 shard 檔案修改：
- 新的 keep 共識 → 對應的 `docs/keep-shards/keep-*.md`
- 任務狀態 → `docs/tasks/tasks-<prefix>.json`
- 交叉索引 → `docs/cross-ref/cross-ref-*.md`

### Step 2 — 重建索引

```bash
node tools_node/shard-manager.js rebuild-index docs/keep-shards
# 或
node tools_node/shard-manager.js rebuild-index docs/tasks
# 或
node tools_node/shard-manager.js rebuild-index docs/cross-ref
```

→ 索引 stub 自動更新為最新分片大小。

### Step 3 — 驗證

```bash
node tools_node/shard-manager.js validate docs/keep-shards
```

---

## Workflow B：全新大型文件 → 新 Shard Group

**觸發時機**：遇到 > 6000 tokens 的新文件需要拆分。

### Step 1 — 規劃拆分策略

| 文件類型 | 建議 `type` | 拆分依據 |
|---------|------------|---------|
| Markdown 筆記（有 `## ` 章節） | `markdown-h2` | 章節前綴 regex（如 `^(1|2|3)\.`） |
| JSON 陣列（如任務清單） | `json-array` | 每 item 的特定 field 值 regex |

目標：每個 shard ~3–10 KB，單份讀入不超過 6000 tokens（約 4 KB）。

### Step 2 — 建立 shard 目錄與 .shardrc.json

```
docs/
  my-new-large-file.md         ← 原始大檔（稍後會變成 stub）
  my-new-shards/               ← 新建目錄
    .shardrc.json              ← 設定檔（見下方格式）
    README.md                  ← 選填：給人讀的說明
```

**.shardrc.json 格式（markdown-h2）**：
```json
{
  "version": 1,
  "source": "../my-new-large-file.md",
  "indexTitle": "My Document Title",
  "indexPath": "docs/my-new-large-file.md",
  "type": "markdown-h2",
  "preambleShard": "shard-a",
  "defaultShard": "shard-a",
  "shards": [
    { "name": "shard-a", "title": "A 部分（§1–§5）",  "pattern": "^[1-5]\\." },
    { "name": "shard-b", "title": "B 部分（§6–§10）", "pattern": "^([6-9]|10)\\." }
  ]
}
```

**.shardrc.json 格式（json-array）**：
```json
{
  "version": 1,
  "source": "../items.json",
  "indexTitle": "Items Index",
  "type": "json-array",
  "arrayPath": "items",
  "splitField": "category",
  "defaultShard": "items-other",
  "shards": [
    { "name": "items-a", "title": "Category A",  "pattern": "^A-" },
    { "name": "items-b", "title": "Category B",  "pattern": "^B-" },
    { "name": "items-other", "title": "Others", "pattern": "." }
  ]
}
```

### Step 3 — 執行分片

```bash
node tools_node/shard-manager.js shard docs/my-new-shards
```

→ 產生各 shard 檔案，原始大檔自動被索引 stub 取代。

### Step 4 — 驗證

```bash
node tools_node/shard-manager.js validate docs/my-new-shards
```

### Step 5 — 更新相關 Guard 文件

若新的 shard group 對應本專案的重要参考文件，請同步更新：
- `docs/keep.summary.md` — 新增分片路徑提示
- `.github/instructions/token-guard.instructions.md` — 新增禁止整份讀入的規則

---

## Workflow C：原始大檔有重大更新

若大檔有大量新章節（非單章節修改），需重新執行 `shard`：

```bash
# 1. 先確認大檔有原始內容（不是 stub）
# 2. 若已是 stub，從 git 恢復原版或手動合併分片
git show HEAD:docs/keep.md > docs/keep.md   # 範例

# 3. 重新分片
node tools_node/shard-manager.js shard docs/keep-shards

# 4. 驗證
node tools_node/shard-manager.js validate docs/keep-shards
```

---

## Pattern 注意事項

`.shardrc.json` 的 `pattern` 欄位是 JavaScript 正規表達式字串，作用於 h2 標題除去前置 `## ` 之後的文字（markdown-h2）或 splitField 欄位值（json-array）。

| 常見情境 | 推薦 pattern |
|--------|-------------|
| `## 3. 標題` | `"^3\\."` |
| `## 2b. 標題` | `"^2b\\."` |
| `## P0. 標題` | `"^P0\\."` |
| `## A. 標題` | `"^A\\."` |
| id 以 `UI-` 開頭 | `"^UI-"` |
| fallback（任何） | `"."` |

**多章節 alternation**：`"^(3|4|5|6|13)\\."` 匹配 `3.`、`4.`、`5.`、`6.`、`13.`。

**警告**：避免使用過短的前綴（如 `"^1"` 不加 `\\.`），否則會誤匹配 `10.`、`11.` 等。

---

## 收工確認清單

- [ ] `validate` 三個 shard groups 全 pass
- [ ] 所有 shard 單檔 < 30 KB（如超過考慮再拆）
- [ ] 索引 stub 已更新（大小顯示最新）
- [ ] encoding check：`node tools_node/check-encoding-touched.js --files <修改的檔案>`
- [ ] git commit 含 shard 目錄、stub 檔與 .shardrc.json
