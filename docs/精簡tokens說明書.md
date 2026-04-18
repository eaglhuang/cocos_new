<!-- doc_id: doc_tech_0014 -->
# 精簡tokens說明書

## 目的

這份文件說明我們為什麼要做 token 節流、目前做了哪些防線、每一層的原理是什麼，以及 Agent 實際該怎麼用。

核心目標只有一個：

- 不讓 Agent 因為圖片、compare board、長篇 `md/json`、大批 changed files、整份 `keep.md` (doc_index_0011) 或 `ui-quality-todo.json`，把上下文撐到不可控。

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

1. 共識層：`keep.md` (doc_index_0011)、`AGENTS.md` (doc_ai_0018)
2. 技能層：`best-mode`、`context-budget-guard`
3. 工具層：budget check / diff summary / summary card / turn usage
4. Wrapper 層：把前置檢查與收工回報硬性包在 workflow 外面

真正接近「硬保證」的是第 4 層。

## 我們現在做了什麼

### 1. 共識與口令

- `docs/keep.md (doc_index_0011)` (doc_index_0011)
  - 把 Agent Context Budget 列成 P0
- `AGENTS.md` (doc_ai_0018)
  - 把 `(best)` 定義成 strict mode

只要使用者訊息以 `(best)` 開頭，就代表：

- 先做 context guard
- 先做摘要
- 先做 diff 壓縮
- final 前一定要回報 token 量級估算

### 2. Skills

- `.agents/skills/best-mode/SKILL.md` (doc_agentskill_0001)
  - `(best)` 的嚴格模式路由器
- `.agents/skills/context-budget-guard/SKILL.md` (doc_agentskill_0006)
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
| `docs/keep.md (doc_index_0011)` (doc_index_0011) | `docs/keep-shards/` | 4 | `markdown-h2`，依章節路由 |
| `docs/ui-quality-todo.json` | `docs/tasks/` | 4 | `json-array`，依 id 前綴路由 |
| `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005) | `docs/cross-ref/` | 3 | `markdown-h2`，依 A/B/C 節 |

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

**Skill**：`.github/skills/doc-shard-manager/SKILL.md` (doc_agentskill_0015)

### 6b. 被索引管理的文件變更規則

當需要**人工修改**受 shard 管理的文件時，必須遵守以下規則，否則可能造成資料遺失或分片失去一致性。

#### ✅ 可以直接修改的操作

| 操作 | 說明 |
|------|------|
| 編輯分片檔案的**內容** | 直接編輯 `docs/keep-shards/keep-workflow.md (doc_index_0009)` (doc_index_0009)、`docs/tasks/tasks-ui.json` 等分片檔，不影響其他分片 |
| 新增任務 item 到 JSON 分片 | 在 `tasks-ui.json` 末端新增 `{ "id": "UI-2-xxxx", ... }` |
| 更新任務的 `status`、`notes`、`completed-date` | 業務欄位修改，不影響路由 |
| 在 Markdown 分片內新增段落 | 在既有 section 內增加內容，不跨越 `##` 邊界 |
| 修改 index stub 的**使用說明部分** | `docs/keep.md (doc_index_0011)` (doc_index_0011) 的 `## 使用說明` 區塊是手寫說明，可以更新 |

**修改後必須執行：**
```bash
node tools_node/shard-manager.js rebuild-index <shardDir>
node tools_node/shard-manager.js validate <shardDir>
```

#### ❌ 禁止的操作

| 禁止行為 | 理由 |
|----------|------|
| 直接編輯 index stub 的**分片索引表**（`docs/keep.md (doc_index_0011)` (doc_index_0011)、`docs/ui-quality-todo.json`）| stub 是 auto-generated，手改會被下次 `rebuild-index` 覆蓋 |
| 更改任務 `id` 的前綴（如把 `PROG-001` 改成 `UI-001`）| `id` 前綴決定資料路由到哪個分片，改了 prefix 會讓任務在下次 `shard` 時落入錯誤分片 |
| 把屬於其他分片的 Markdown section（`## 7.`）貼進錯誤的分片檔 | 下次執行 `shard` 時會重新路由，手動貼入的內容將被分配到正確的地方並從這裡移除 |
| 移動 Markdown 的 `##` section 跨分片邊界後不重跑 `shard` | 移動後的 heading 會繼續待在舊分片，直到下次 `shard` 才正確路由 |
| 在 auto-parts 子目錄（`docs/tasks/tasks-ui/`）中直接編輯 `part-*.json` | auto-parts 是由 `auto-split` 全量重產，手改會在下次 `auto-split` 時被覆蓋 |
| 刪除 `.shardrc.json` | 會讓整個分片群失去設定，所有 shard 命令都無法運作 |

#### ⚠️ 大幅改動後需要重跑的情境

| 情境 | 應執行的命令 |
|------|-------------|
| 在 `keep.md` (doc_index_0011) 分片中新增了整個新 `##` section | `node tools_node/shard-manager.js shard docs/keep-shards` |
| 在 `tasks-ui.json` 中新增超過 10 筆任務（分片可能膨脹） | `node tools_node/shard-manager.js validate docs/tasks` → 若出現 >40 KB 警告則 `auto-split docs/tasks` |
| 某分片已超過 40 KB（validate 會警告） | `node tools_node/shard-manager.js auto-split <shardDir> --threshold 30` |
| 確認分片結構完整後收工 | `node tools_node/shard-manager.js validate <shardDir>` |

## 原理

### 原理 1：不要先讀整包

最浪費 token 的情況，通常不是推理本身，而是把不該進上下文的材料整包丟進來。

高風險來源包括：

- `docs/keep.md (doc_index_0011)` (doc_index_0011) → ⚠️ 已拆分為 `docs/keep-shards/`（4 個分片，按需讀對應檔）
- `docs/ui-quality-todo.json` → ⚠️ 已拆分為 `docs/tasks/`（4 個 prefix shard）
- `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005) → ⚠️ 已拆分為 `docs/cross-ref/`（3 個 section shard）
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

### 原理 1b：看圖成本吃的是像素，不是檔案壓縮率

這一條是最近補上的重點。

Agent 用 `view_image` 看圖時，真正吃 token 的主因是**像素維度**，不是 PNG 檔案大小，也不是 Cocos / Unity build 時使用的 ASTC、ETC2 之類平台壓縮。

也就是說：

- 同樣一張圖，`1920 x 1080` 一定比 `512 x 288` 貴很多
- 就算把貼圖做成平台壓縮格式，`view_image` 前仍會回到解碼後的像素資料，**不會**因此省 vision token
- 真正有效的做法只有兩個：
  - 先縮解析度
  - 一次少看幾張

目前專案硬規定是：

- 所有讀圖流程都採 thumbnail-first progressive zoom：先試 `125px`，不夠才 `250px`，再不夠才 `500px`
- `PrintWindow`、參考圖、compare board、editor/browser capture 在 `view_image` 前，必須先套這條 `125 -> 250 -> 500` 規則
- 一次最多只看 `1` 張主圖 + `1` 張對照圖
- 若要看 `>500px` 原圖，必須先取得使用者明確同意

實務上，先從 `125px` thumbnail 開始，再依需求升到 `250px`、`500px`，通常比直接看 `512px` 或原圖更能穩定壓低 vision token 成本。這就是為什麼「縮圖階梯」比「只訂一個上限」更重要。

### 原理 1c：方法要寫進工具，不只寫在規則裡

如果只有文件寫「請縮圖」，但腳本和 skill 還是照舊輸出大圖，最後通常還是會有人直接拿原圖去看。

所以這件事要做成兩層：

1. **規則層**：`token-guard.instructions.md` (doc_ai_0015)、`AGENTS.md` (doc_ai_0018)、skills 明寫 `125 -> 250 -> 500` 與原圖需同意
2. **工具層**：`capture-ui-screens.js`、`debug-capture.js` 這類腳本直接在輸出階段縮圖

這樣 Agent 不需要每次靠記憶手動做對，工具本身就先把大部分風險擋掉。

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
| 工具安全 / Skill 路由 | `docs/keep-shards/keep-core.md (doc_index_0006)` (doc_index_0006) |
| Cocos 工作流 / 編碼 / Git | `docs/keep-shards/keep-workflow.md (doc_index_0009)` (doc_index_0009) |
| UI 架構決策 | `docs/keep-shards/keep-ui-arch.md (doc_index_0008)` (doc_index_0008) |
| 目前實作狀態 | `docs/keep-shards/keep-status.md (doc_index_0007)` (doc_index_0007) |
| UI 任務（UI-*） | `docs/tasks/tasks-ui.json` |
| 程式任務（PROG-*） | `docs/tasks/tasks-prog.json` |
| 規格書索引 | `docs/cross-ref/cross-ref-specs.md (doc_index_0002)` (doc_index_0002) |

不確定讀哪本？先看索引 stub（`docs/keep.md (doc_index_0011)` (doc_index_0011) 28 行），再決定要哪個分片。

### 原理 4：final 一定要量化

如果每輪對話結束時都沒有量感，團隊會很難知道哪一類任務正在偷吃 token。

所以 final 前一定補：

- `Token 量級：少 / 中 / 大`

這不是精準計費，而是工作量與風險量級的儀表板。

## 實際使用方式

### A. UI 任務

```bash
node tools_node/run-ui-workflow.js --workflow ui-scaffold --task UI-2-0032 --goal "收斂 BattleScene icon QA" --files artifacts/ui-qa/UI-2-0032/notes.md artifacts/ui-qa/UI-2-0053/battle-main-ui-art-direction-audit.md --diff-files docs/keep.md (doc_index_0011) docs/ui-quality-todo.json
```

如果 preflight 是 `warn` 或 `hard-stop`，wrapper 會直接擋住，不讓後面的任務繼續。

收工前：

```bash
node tools_node/finalize-agent-turn.js --workflow ui-scaffold --task UI-2-0032 --files artifacts/ui-qa/UI-2-0032/notes.md docs/keep.md (doc_index_0011)
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

- 先讀 `docs/keep.md (doc_index_0011)` (doc_index_0011)
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
| `token-guard.instructions.md` (doc_ai_0015) | `**`（全域） | 警戒線 6k/18k/30k、禁止操作、替代做法、handoff 摘要卡格式 |
| `artifacts-guard.instructions.md` (doc_ai_0010) | `artifacts/**` | 禁止整批讀 PNG、file_search 加 maxResults:10、圖片 1+1 限制 |
| `ui-pipeline.instructions.md` (doc_ai_0017) | UI/prefab 相關路徑 | 5 步驟 UI Pipeline、Debug skill 路由、武將管線 3 步驟 |
| `docs-guard.instructions.md` (doc_ai_0011) | `docs/**` | 先讀 keep.summary.md (doc_index_0012)、讀 shard 不讀 aggregate；>6000 token 先用 grep |
| `project-conventions.instructions.md` (doc_ai_0014) | `assets/scripts/**` | 架構原則、Unity 對照學習說明 |

### keep.summary.md (doc_index_0012) 輕量入口

`docs/keep.summary.md (doc_index_0012)` (doc_index_0012) 是 `docs/keep.md (doc_index_0011)` (doc_index_0011)（~400 行）的 33 行摘要索引。

- **Pre-flight 預設讀這份**，而非完整 keep.md (doc_index_0011)
- 每個段落只有一行摘要 + 指向完整章節的引用
- 需要修改共識才讀 keep.md (doc_index_0011) 全文

### copilot-instructions.md (doc_ai_0008) 精簡

主 instruction 檔從 102 行精簡至 26 行。

- 刪除的段落（items 6-9、架構原則、學習說明）全部搬入 keep.md (doc_index_0011) §2c 和各 path-specific instruction 檔
- 只保留：語言規範、Build/Dev 指令、Pre-flight 5 條（含指向 path-specific instructions 的索引）

### 為什麼同時寫入 keep.md (doc_index_0011)

Path-specific instructions 只在路徑符合時注入。若 Agent 工作的路徑不符合任何 instruction，它就看不到那些規則。

**`keep.md §2c`** 是安全網：把最重要的常識（Skill 路由、UI Pipeline、架構原則、Unity 對照）放在 Agent 每次 pre-flight 必讀的位置，確保不被遺漏。

### 新舊架構對比

| 防線 | Phase 1 | Phase 2 新增 |
|------|---------|--------------|
| 全域口令 | `(best)` 觸發 best-mode | ✅ 保留 |
| 主 instruction | copilot-instructions.md (doc_ai_0008) 102 行 | → 精簡至 26 行 |
| 路徑規則 | 無 | `.github/instructions/*.md`（5 檔，自動注入） |
| pre-flight 入口 | 讀 keep.md (doc_index_0011) 全文（~400 行） | 讀 keep.summary.md (doc_index_0012)（33 行） |
| Agent 常識保底 | 在 copilot-instructions.md (doc_ai_0008) 內 | → 搬至 keep.md (doc_index_0011) §2c（pre-flight 必讀） |

---

## Phase 4：Copilot Hooks 自動攔截（2026-04-06）

### 什麼是 Copilot Hook

VS Code Copilot Agent 支援在特定生命週期事件時，自動執行本地 shell script / Node.js 程式，將其輸出注入 Agent 的上下文，或直接封鎖工具呼叫。與 Skill / Instruction 不同，Hook 不依賴 Agent 記憶或主動觸發，是**結構層面的硬性攔截**。

Hook 設定檔：`.github/hooks/token-guard.json`

```json
{
  "hooks": {
    "SessionStart": [ { "command": "node .github/hooks/scripts/session-start.js",   "timeout": 10 } ],
    "PreToolUse":   [ { "command": "node .github/hooks/scripts/pre-tool-guard.js",  "timeout": 10 } ],
    "PostToolUse":  [ { "command": "node .github/hooks/scripts/post-encode-check.js","timeout": 20 } ]
  }
}
```

### Hook 1：SessionStart — 自動注入 keep.summary.md (doc_index_0012)

**觸發時機**：每次新 Agent 對話（Session）開始時，自動執行一次。

**腳本**：`.github/hooks/scripts/session-start.js`

**行為**：
- 讀取 `docs/keep.summary.md (doc_index_0012)` (doc_index_0012) 的完整內容（33 行）
- 把內容包成 `additionalContext` 注入 Agent 的初始上下文
- 同時附加禁止呼叫 `get_changed_files` 的紅色警告

**效果**：Agent 不需要主動讀取 keep.summary.md (doc_index_0012)，也能在對話開始時就知道：
- 各 shard 目錄路徑
- pre-flight 必讀規則
- 禁止行為清單

**注入格式範例**：
```
## [Auto-injected by SessionStart hook] docs/keep.summary.md (doc_index_0012)
...（keep.summary.md 全文）...
🚫 禁止事項：不要呼叫 get_changed_files（含大量 PNG binary，必定觸發 413）
📋 完整規則：docs/keep.md (doc_index_0011) §2b / .github/instructions/token-guard.instructions.md (doc_ai_0015)
```

---

### Hook 2：PreToolUse — 工具呼叫前攔截

**觸發時機**：Agent 每次呼叫任何工具之前，自動執行。

**腳本**：`.github/hooks/scripts/pre-tool-guard.js`

**行為**：有三條攔截規則：

#### 規則 A：完全封鎖 `get_changed_files`

```
[token-guard] ❌ get_changed_files 已被封鎖！
本專案含大量 PNG/binary QA artifact，此工具會把所有 diff（含 PNG binary）
一次塞入 context，必定觸發 413 Request Entity Too Large 並導致 Agent 凍結。
```

- 使用 `process.exit(2)`（blocking error），工具呼叫被終止
- Agent 收到 stderr 作為上下文，並提示替代方式：
  - `git status --short`
  - `git diff -- <filepath>`（限 .ts/.json/.md）
  - `git log -1 --stat`

#### 規則 B：大型重量檔案讀取警告（`permissionDecision: "ask"`）

當 Agent 嘗試用 `read_file` 直接讀以下三個大型原始檔時，觸發確認對話框：
- `docs/keep.md (doc_index_0011)` (doc_index_0011)
- `docs/ui-quality-todo.json`
- `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)

注入訊息：
```
⚠️ Token 警告：keep.md (doc_index_0011) 是大型重量檔案（估算 >6000 tokens）。
建議替代方式：
  • docs/keep.md (doc_index_0011) → 先讀 docs/keep.summary.md (doc_index_0012)
  • 其他大型 doc → 用 grep_search 搜尋特定關鍵字
  • ui-quality-todo.json → 讀對應 shard docs/tasks/*.json
確定仍要整份讀入？
```

Agent 必須明確確認，才能繼續讀取整份大型檔。

#### 規則 C：`grep_search` 萬用 artifacts 路徑警告

當 `grep_search` 的 `includePattern` 包含 `artifacts` 且未設定 `maxResults` 時，注入提示：
```
⚠️ token-guard：在 artifacts/ 目錄使用 grep_search 時，
請加上 "maxResults": 10 避免大量 PNG 路徑塞滿結果。
```

---

### Hook 3：PostToolUse — 寫檔後自動編碼防災

**觸發時機**：Agent 每次呼叫寫檔工具（`create_file`、`replace_string_in_file`、`multi_replace_string_in_file`）後，自動執行。

**腳本**：`.github/hooks/scripts/post-encode-check.js`

**行為**：
1. 從工具輸入中提取被修改的檔案路徑
2. 只對高風險副檔名執行：`.md` / `.json` / `.ts` / `.js` / `.ps1`
3. 呼叫 `tools_node/check-encoding-touched.js` 檢查是否有：
   - UTF-8 BOM（`\xEF\xBB\xBF`）
   - U+FFFD 替換字元
   - Latin mojibake（中文被錯誤編碼為拉丁字元）
4. 若編碼正常 → 靜默通過
5. 若發現問題 → 注入警告：

```
🚨 編碼防災警告：以下檔案可能有 UTF-8 BOM 或亂碼（mojibake）：
  docs/keep-shards/keep-workflow.md (doc_index_0009)

請立刻執行修復：
  node tools_node/check-encoding-touched.js --files docs/keep-shards/keep-workflow.md (doc_index_0009)

若確認有問題，用乾淨 UTF-8 重建檔案，不要做猜字修補。
```

**設計決策**：PostToolUse hook 使用 `process.exit(0)`（不 blocking），讓 Agent 自行判斷是否修復，而非強制中斷工作流。

---

### Hook 架構總覽

| Hook 事件 | 腳本 | 攔截類型 | 封鎖力度 |
|-----------|------|---------|---------|
| `SessionStart` | `session-start.js` | 注入 keep.summary.md (doc_index_0012) + 禁止提示 | 軟注入（always inject） |
| `PreToolUse` | `pre-tool-guard.js` | 封鎖 `get_changed_files` / 大型檔警告 / artifacts grep 提示 | 硬封鎖（exit 2）/ 確認對話框 / 軟提示 |
| `PostToolUse` | `post-encode-check.js` | 寫檔後自動編碼檢查 | 軟警告（不中斷） |

### 為什麼 Hook 是最硬的一層

| 防線 | 依賴 Agent 記憶 | 可被繞過 |
|------|----------------|---------|
| Skills | ✅ 要主動讀 | ✅ 可以不讀 |
| Instructions (`applyTo`) | ❌ 自動注入 | ✅ 路徑不符就不注入 |
| Copilot Hooks | ❌ 自動執行 | ❌ 無法繞過（結構層攔截） |

Hooks 不存在「Agent 忘了讀」或「路徑不符合」的問題。只要在 VS Code Copilot Agent 環境內，三個 Hook 每次都會被執行。

### 新舊架構最終對比

| 防線 | Phase 1 | Phase 2 | Phase 4（Hooks）|
|------|---------|---------|-----------------|
| 全域口令 | `(best)` strict mode | ✅ 保留 | ✅ 保留 |
| 主 instruction | 102 行 | → 26 行精簡 | ✅ 保留 |
| 路徑規則 | 無 | 5 個 `.instructions.md` 自動注入 | ✅ 保留 |
| Pre-flight 入口 | keep.md (doc_index_0011) 全文 | keep.summary.md (doc_index_0012)（33 行）| ✅ SessionStart 自動注入 |
| 危險工具封鎖 | 無（靠規範） | 無（靠規範） | ✅ PreToolUse 硬封鎖 |
| 重量檔案防護 | 無 | instruction 提醒 | ✅ PreToolUse `ask` 對話框 |
| 寫檔後編碼防護 | 手動跑 | 手動跑 | ✅ PostToolUse 自動觸發 |
