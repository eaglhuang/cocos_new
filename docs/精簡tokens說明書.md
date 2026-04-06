# 精簡tokens說明書

## 目的

這份文件說明我們為什麼要做 token 節流、目前做了哪些防線、每一層的原理是什麼，以及 Agent 實際該怎麼用。

核心目標只有一個：

- 不讓 Agent 因為圖片、compare board、長篇 `md/json`、大批 changed files、整份 `keep.md` 或 `ui-quality-todo.json`，把上下文撐到不可控。

目前已完成三個 Phase 的防線建設：Phase 1（共識 + 口令）、Phase 2（Wrapper 層 + 工具）、Phase 3（Shard 目錄架構）。

## 為什麼只靠 skill 不夠

Skill 很重要，但 skill 本質上仍然偏向「高優先級規範」。

它能提升：

- 被觸發的機率
- 做法的一致性
- 團隊共識的可見度

但它不能保證：

- 每個 Agent 都會主動想到要用
- 每個 Agent 都會按照順序執行
- 大型 payload 一定會在進對話前就被擋下

所以我們把整套設計拆成多層：

1. 共識層：`keep.md`、`AGENTS.md`
2. 技能層：`best-mode`、`context-budget-guard`
3. 工具層：budget check / diff summary / summary card / turn usage
4. Wrapper 層：把前置檢查與收工回報硬性包在 workflow 外面

真正接近「硬保證」的是第 4 層。

## 我們現在做了什麼

### 1. 共識與口令

- `docs/keep.md`
  - 把 Agent Context Budget 列成 P0
- `AGENTS.md`
  - 把 `(best)` 定義成 strict mode

只要使用者訊息以 `(best)` 開頭，就代表：

- 先做 context guard
- 先做摘要
- 先做 diff 壓縮
- final 前一定要回報 token 量級估算

### 2. Skills

- `.agents/skills/best-mode/SKILL.md`
  - `(best)` 的嚴格模式路由器
- `.agents/skills/context-budget-guard/SKILL.md`
  - 真正的節流流程 skill

這兩個 skill 的關係是：

- `best-mode` 先決定策略
- `context-budget-guard` 再執行上下文節流

### 3. 單點工具

- `tools_node/check-context-budget.js`
  - 估算目前檔案集合的 token / 圖片風險
  - 會輸出 `ok / warn / hard-stop`

- `tools_node/generate-context-summary.js`
  - 把 handoff 壓成最小摘要卡
  - 格式固定成 `task / goal / read / known / need / avoid`

- `tools_node/summarize-structured-diff.js`
  - 把大型 `.md` / `.json` diff 先壓成結構化摘要
  - Markdown 看 heading 增減與變更區塊
  - JSON 看 top-level key，或 array by `id`

- `tools_node/report-turn-usage.js`
  - 在 final 前估算本輪工作量
  - 回傳 `少 / 中 / 大`

### 4. 可繼承底層

- `tools_node/lib/context-guard-core.js`

這是新的底層核心。目的不是讓每支腳本都自己重寫一次 budget 檢查，而是讓 wrapper 或未來新工具共用同一套能力：

- 收集 changed files / 指定 files / 指定 dirs
- 執行 budget check
- 執行 turn usage estimate
- 執行 diff summary
- 執行 summary card
- 判斷是否要 block
- 輸出 keep note

之後任何新 wrapper 或圖片相關腳本，只要引用這顆 core，就能自動繼承同一套節流規則。

### 5. Wrapper 層

- `tools_node/run-guarded-workflow.js`
  - 通用 wrapper
  - 不限 UI
  - 任何圖片任務、長 diff 任務、大型 notes 任務都能用

- `tools_node/run-ui-workflow.js`
  - UI 專用 wrapper
  - 內部仍然走通用 guarded workflow

- `tools_node/finalize-agent-turn.js`
  - 收工 finalizer
  - 負責在 final 前輸出 budget 狀態、keep note 建議與 token 量級估算

### 6. 文件分片架構（Shard Architecture，Phase 3）

針對無法靠「不要讀」徹底解決的必讀大型文件，採用「大檔 → shard 目錄群 + 薄索引 stub」的架構：

| 原始大檔（現為 index stub） | Shard 目錄 | 分片數 | 分片策略 |
|---|---|---|---|
| `docs/keep.md` | `docs/keep-shards/` | 4 | `markdown-h2`，依章節路由 |
| `docs/ui-quality-todo.json` | `docs/tasks/` | 4 | `json-array`，依 id 前綴路由 |
| `docs/cross-reference-index.md` | `docs/cross-ref/` | 3 | `markdown-h2`，依 A/B/C 節 |

**工具**：`tools_node/shard-manager.js`

```bash
# 分片有更新 → 重建索引 stub
node tools_node/shard-manager.js rebuild-index docs/keep-shards

# 完整性驗證（收工前，也會標示 >40 KB 的分片與 auto-parts 子目錄）
node tools_node/shard-manager.js validate docs/keep-shards

# 查看各分片大小
node tools_node/shard-manager.js status docs/keep-shards

# 初始分片（大檔有大幅改動時重跑）
node tools_node/shard-manager.js shard docs/keep-shards

# 若某個分片仍超過閾值 → 自動等分為 N 個 parts
node tools_node/shard-manager.js auto-split docs/tasks --threshold 30
```

**設定**：各 shard 目錄下的 `.shardrc.json` 定義 source、type、shards 路由規則。  
支援新增任意大型文件的分片群，不限於上方三個。  
`auto-split` 產生的 sub-dir 使用 `type: "auto-parts"`，分片數動態計算（`ceil(fileSize / threshold)`），無需寫死。

**Skill**：`.github/skills/doc-shard-manager/SKILL.md`

### 6b. 被索引管理的文件變更規則

當需要**人工修改**受 shard 管理的文件時，必須遵守以下規則，否則可能造成資料遺失或分片失去一致性。

#### ✅ 可以直接修改的操作

| 操作 | 說明 |
|------|------|
| 編輯分片檔案的**內容** | 直接編輯 `docs/keep-shards/keep-workflow.md`、`docs/tasks/tasks-ui.json` 等分片檔，不影響其他分片 |
| 新增任務 item 到 JSON 分片 | 在 `tasks-ui.json` 末端新增 `{ "id": "UI-2-xxxx", ... }` |
| 更新任務的 `status`、`notes`、`completed-date` | 業務欄位修改，不影響路由 |
| 在 Markdown 分片內新增段落 | 在既有 section 內增加內容，不跨越 `##` 邊界 |
| 修改 index stub 的**使用說明部分** | `docs/keep.md` 的 `## 使用說明` 區塊是手寫說明，可以更新 |

**修改後必須執行：**
```bash
node tools_node/shard-manager.js rebuild-index <shardDir>
node tools_node/shard-manager.js validate <shardDir>
```

#### ❌ 禁止的操作

| 禁止行為 | 理由 |
|----------|------|
| 直接編輯 index stub 的**分片索引表**（`docs/keep.md`、`docs/ui-quality-todo.json`）| stub 是 auto-generated，手改會被下次 `rebuild-index` 覆蓋 |
| 更改任務 `id` 的前綴（如把 `PROG-001` 改成 `UI-001`）| `id` 前綴決定資料路由到哪個分片，改了 prefix 會讓任務在下次 `shard` 時落入錯誤分片 |
| 把屬於其他分片的 Markdown section（`## 7.`）貼進錯誤的分片檔 | 下次執行 `shard` 時會重新路由，手動貼入的內容將被分配到正確的地方並從這裡移除 |
| 移動 Markdown 的 `##` section 跨分片邊界後不重跑 `shard` | 移動後的 heading 會繼續待在舊分片，直到下次 `shard` 才正確路由 |
| 在 auto-parts 子目錄（`docs/tasks/tasks-ui/`）中直接編輯 `part-*.json` | auto-parts 是由 `auto-split` 全量重產，手改會在下次 `auto-split` 時被覆蓋 |
| 刪除 `.shardrc.json` | 會讓整個分片群失去設定，所有 shard 命令都無法運作 |

#### ⚠️ 大幅改動後需要重跑的情境

| 情境 | 應執行的命令 |
|------|-------------|
| 在 `keep.md` 分片中新增了整個新 `##` section | `node tools_node/shard-manager.js shard docs/keep-shards` |
| 在 `tasks-ui.json` 中新增超過 10 筆任務（分片可能膨脹） | `node tools_node/shard-manager.js validate docs/tasks` → 若出現 >40 KB 警告則 `auto-split docs/tasks` |
| 某分片已超過 40 KB（validate 會警告） | `node tools_node/shard-manager.js auto-split <shardDir> --threshold 30` |
| 確認分片結構完整後收工 | `node tools_node/shard-manager.js validate <shardDir>` |

## 原理

### 原理 1：不要先讀整包

最浪費 token 的情況，通常不是推理本身，而是把不該進上下文的材料整包丟進來。

高風險來源包括：

- `docs/keep.md` → ⚠️ 已拆分為 `docs/keep-shards/`（4 個分片，按需讀對應檔）
- `docs/ui-quality-todo.json` → ⚠️ 已拆分為 `docs/tasks/`（4 個 prefix shard）
- `docs/cross-reference-index.md` → ⚠️ 已拆分為 `docs/cross-ref/`（3 個 section shard）
- 大型 QA notes
- compare board
- screenshot batch
- contact sheet
- binary / image diff

> 上方三個巨型文件已拆分完畢。**禁止整份讀入這三個原始檔**；改讀對應的分片，或讀索引 stub 後再按需取分片。

所以第一件事不是「讀」，而是先問：

- 這包大不大？
- 有沒有圖片？
- 有沒有必要整份讀？

`check-context-budget.js` 就是在做這件事。

### 原理 2：差異要看結構，不要看全文

很多 token 浪費在：

- 把整份 Markdown 改版前後都貼進來
- 把整份 JSON array 攤平比較

實際上我們通常只需要：

- 哪些 heading 新增了
- 哪些 top-level key 改了
- 哪些 id 變了

`summarize-structured-diff.js` 就是在把「全文 diff」轉成「結構 diff」。

### 原理 3：handoff 只傳任務卡，不傳原始檔

Agent handoff 最容易爆量，因為大家會想把上下文補齊。

但真正常用的資訊只需要：

- 這張單是什麼
- 目標是什麼
- 看了哪些檔
- 已知結論是什麼
- 下一步要什麼
- 哪些東西不能整份讀

所以我們固定 handoff 卡格式：

- `task`
- `goal`
- `read`
- `known`
- `need`
- `avoid`

這件事交給 `generate-context-summary.js`。

### 原理 5：大型文件按需讀分片，不讀全文

就算一定要讀某份共識文件，也應該只讀「對這個任務相關的那一節」，而不是整份讀入。

分片架構讓這件事變成可操作的：

| 任務類型 | 應讀分片 |
|---|---|
| 工具安全 / Skill 路由 | `docs/keep-shards/keep-core.md` |
| Cocos 工作流 / 編碼 / Git | `docs/keep-shards/keep-workflow.md` |
| UI 架構決策 | `docs/keep-shards/keep-ui-arch.md` |
| 目前實作狀態 | `docs/keep-shards/keep-status.md` |
| UI 任務（UI-*） | `docs/tasks/tasks-ui.json` |
| 程式任務（PROG-*） | `docs/tasks/tasks-prog.json` |
| 規格書索引 | `docs/cross-ref/cross-ref-specs.md` |

不確定讀哪本？先看索引 stub（`docs/keep.md` 28 行），再決定要哪個分片。

### 原理 4：final 一定要量化

如果每輪對話結束時都沒有量感，團隊會很難知道哪一類任務正在偷吃 token。

所以 final 前一定補：

- `Token 量級：少 / 中 / 大`

這不是精準計費，而是工作量與風險量級的儀表板。

## 實際使用方式

### A. UI 任務

```bash
node tools_node/run-ui-workflow.js --workflow ui-scaffold --task UI-2-0032 --goal "收斂 BattleScene icon QA" --files artifacts/ui-qa/UI-2-0032/notes.md artifacts/ui-qa/UI-2-0053/battle-main-ui-art-direction-audit.md --diff-files docs/keep.md docs/ui-quality-todo.json
```

如果 preflight 是 `warn` 或 `hard-stop`，wrapper 會直接擋住，不讓後面的任務繼續。

收工前：

```bash
node tools_node/finalize-agent-turn.js --workflow ui-scaffold --task UI-2-0032 --files artifacts/ui-qa/UI-2-0032/notes.md docs/keep.md
```

### B. 非 UI，但有圖片或大型文件

```bash
node tools_node/run-guarded-workflow.js --workflow image-review --task IMG-001 --goal "審查 compare board 與說明文件" --files artifacts/review/compare-board.png docs/review-notes.md --diff-files docs/review-notes.md
```

這代表：

- 不需要是 UI workflow
- 只要有圖片或重上下文風險，都能走同一套 wrapper

### C. `(best)` 嚴格模式

只要使用者訊息以 `(best)` 開頭：

- 先讀 `docs/keep.md`
- 先套用 `best-mode`
- 再進 `context-budget-guard`
- 最後才進任務本體

## 為什麼這樣設計

### 1. 對 Agent 友善

不是要求每個 Agent 都記住全部規則，而是把規則包進固定入口。

### 2. 對 token 友善

先做風險判斷，再決定載入什麼內容，會比先讀了再縮安全很多。

### 3. 對團隊友善

每輪都有 `少 / 中 / 大`，長期就能看出哪種任務最容易失控。

### 4. 對未來擴充友善

底層 core 已經抽出來了，未來新 wrapper、新任務、新圖片流程都能繼承。

## 接下來還能怎麼加強

目前已經做到很嚴格，但還有幾個可以往上補的方向：

1. 讓更多現有腳本直接改用 `context-guard-core`
2. 對 compare board / screenshot batch 增加更細的抽樣規則
3. 把 keep note 寫入流程再自動化
4. 做 wrapper usage audit，檢查哪些任務沒有走 wrapper
5. ✅ `tasks-ui.json` 已按 status 細拆（`docs/tasks-ui-shards/`）；`auto-split` 可動態拆分
6. ✅ 新增大型文件自動偵測：`scan` 命令；`validate` 自動警告 >40 KB 分片

## 結論

我們現在不是只做了「一個 skill」。

我們做的是一整套節流架構：

- `(best)` 專案口令
- strict mode skill
- context budget skill
- diff / summary / usage 工具
- 可繼承底層 core
- UI 與通用 wrapper
- finalizer

目標不是讓 Agent 綁手綁腳，而是讓 Agent 在高風險任務裡，預設走最小上下文、最不容易爆 token 的路線。

---

## Phase 2：Path-Specific Instructions 強化（2026-04-06）

### 背景

Skill 與 `(best)` 口令仍然屬於「Agent 要主動記住」的規範層，並不能保證在所有路徑的工作中都被觸發。Phase 2 利用 VS Code Copilot 的 **path-specific `.instructions.md` 自動注入機制**，把規則與路徑綁定，讓 Agent 不需要要記憶，結構本身就會強制給它看到正確的規則。

### 核心機制：`applyTo` 自動注入

`.github/instructions/` 下的 `*.instructions.md` 檔案有 YAML frontmatter：

```yaml
---
applyTo: "assets/scripts/**"
---
```

VS Code Copilot 會在 Agent 工作的檔案路徑符合 `applyTo` 時，自動把該 instruction 注入對話上下文，無需 Agent 主動讀取。

### 已建立的 Instruction 檔案

| 檔案 | applyTo | 內容 |
|------|---------|------|
| `token-guard.instructions.md` | `**`（全域） | 警戒線 6k/18k/30k、禁止操作、替代做法、handoff 摘要卡格式 |
| `artifacts-guard.instructions.md` | `artifacts/**` | 禁止整批讀 PNG、file_search 加 maxResults:10、圖片 1+1 限制 |
| `ui-pipeline.instructions.md` | UI/prefab 相關路徑 | 5 步驟 UI Pipeline、Debug skill 路由、武將管線 3 步驟 |
| `docs-guard.instructions.md` | `docs/**` | 先讀 keep.summary.md、讀 shard 不讀 aggregate；>6000 token 先用 grep |
| `project-conventions.instructions.md` | `assets/scripts/**` | 架構原則、Unity 對照學習說明 |

### keep.summary.md 輕量入口

`docs/keep.summary.md` 是 `docs/keep.md`（~400 行）的 33 行摘要索引。

- **Pre-flight 預設讀這份**，而非完整 keep.md
- 每個段落只有一行摘要 + 指向完整章節的引用
- 需要修改共識才讀 keep.md 全文

### copilot-instructions.md 精簡

主 instruction 檔從 102 行精簡至 26 行。

- 刪除的段落（items 6-9、架構原則、學習說明）全部搬入 keep.md §2c 和各 path-specific instruction 檔
- 只保留：語言規範、Build/Dev 指令、Pre-flight 5 條（含指向 path-specific instructions 的索引）

### 為什麼同時寫入 keep.md

Path-specific instructions 只在路徑符合時注入。若 Agent 工作的路徑不符合任何 instruction，它就看不到那些規則。

**`keep.md §2c`** 是安全網：把最重要的常識（Skill 路由、UI Pipeline、架構原則、Unity 對照）放在 Agent 每次 pre-flight 必讀的位置，確保不被遺漏。

### 新舊架構對比

| 防線 | Phase 1 | Phase 2 新增 |
|------|---------|--------------|
| 全域口令 | `(best)` 觸發 best-mode | ✅ 保留 |
| 主 instruction | copilot-instructions.md 102 行 | → 精簡至 26 行 |
| 路徑規則 | 無 | `.github/instructions/*.md`（5 檔，自動注入） |
| pre-flight 入口 | 讀 keep.md 全文（~400 行） | 讀 keep.summary.md（33 行） |
| Agent 常識保底 | 在 copilot-instructions.md 內 | → 搬至 keep.md §2c（pre-flight 必讀） |
