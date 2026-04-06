# 精簡tokens說明書

## 目的

這份文件說明我們為什麼要做 token 節流、目前做了哪些防線、每一層的原理是什麼，以及 Agent 實際該怎麼用。

核心目標只有一個：

- 不讓 Agent 因為圖片、compare board、長篇 `md/json`、大批 changed files、整份 `keep.md` 或 `ui-quality-todo.json`，把上下文撐到不可控。

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

## 原理

### 原理 1：不要先讀整包

最浪費 token 的情況，通常不是推理本身，而是把不該進上下文的材料整包丟進來。

高風險來源包括：

- `docs/keep.md`
- `docs/ui-quality-todo.json`
- `docs/cross-reference-index.md`
- 大型 QA notes
- compare board
- screenshot batch
- contact sheet
- binary / image diff

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
