---
doc_id: doc_agentskill_0001
name: best-mode
description: Strict routing mode for prompts prefixed with `(best)`. USE FOR: any turn where the user explicitly wants the safest, smallest-context, highest-discipline execution path. This skill must route into context-budget-guard first, then continue into the task-specific workflow.
---

# Best Mode

這個 skill 是一個「嚴格模式路由器」。

只要使用者訊息以 `(best)` 開頭，或直接點名 `$best-mode`，就先套用這個 skill。

## 核心原則

- 先做 context 節流，再做任務本體
- 先做摘要，再讀大型檔案
- 先做風險預警，再決定要不要讀圖或讀 diff
- final 前一定要回報本輪 token 量級估算

## 強制順序

### 1. 先進 `context-budget-guard`

先看：

- `.agents/skills/context-budget-guard/SKILL.md` (doc_agentskill_0006)

然後至少跑：

```bash
node tools_node/check-context-budget.js --changed --emit-keep-note
```

### 2. 視任務型別進下一層

- UI / 畫面 / compare board / QA：優先走 `node tools_node/run-ui-workflow.js --workflow <workflow-id> ...`
- 大型 `.md` / `.json`：先跑 `summarize-structured-diff.js`
- 需要 handoff：先跑 `generate-context-summary.js`
- 非 UI，但有圖片或大型 artifact：優先走 `node tools_node/run-guarded-workflow.js --workflow <name> ...`

## `(best)` 下的默認限制

- 禁止直接貼整份大型文件
- 禁止整批帶入 compare board / screenshot / contact sheet
- 禁止跳過 context budget 預警
- 禁止省略 final 的 token 量級回報

## Final 必做

```bash
node tools_node/finalize-agent-turn.js --workflow <workflow-id> --changed
```

回覆格式至少要包含：

```text
Token 量級：少 / 中 / 大（估算）
```

## 說明

這不是 API 層面的硬 parser，而是專案內的高優先級協作口令。

它的目的不是讓 Agent 變慢，而是讓 Agent 在高風險任務下，優先選擇最省 token、最可控、最不容易失手的路線。
