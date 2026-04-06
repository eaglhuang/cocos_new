# Agent Context Budget Guideline

## 目的

這份文件的目標不是追求「完全不看資料」，而是讓 Agent 永遠只吃到完成任務所需的最小上下文。
對我們現在的流程來說，真正昂貴的不是一般 `.ts` 程式碼，而是：

- 大型共識文件整份讀入
- 任務 manifest / QA notes / compare board 說明重複展開
- PNG、screenshot、compare board、contact sheet 被直接帶進對話
- binary diff 或大批 changed files 被當成文字 diff 處理
- 同一輪反覆貼入相同背景說明

## 高風險來源

### 1. 大型核心文件

- `docs/keep.md`
- `docs/ui-quality-todo.json`
- `docs/cross-reference-index.md`
- 大型 workflow / skill 說明

這類文件的問題不是「不能讀」，而是「很容易整份重複讀」。
規則：先用搜尋或 shard，只取需要的小段落，不要整份貼進 handoff。

### 2. QA 圖片與美術資產

- `artifacts/ui-qa/**/compare-board*.png`
- `artifacts/ui-qa/**/GeneralDetailOverview.png`
- `docs/UI品質參考圖/*.png`
- `artifacts/ui-qa/**/contact-sheet*.png`
- AI 生圖中間稿、1024 輸出圖、多版驗證截圖

圖片是最容易把上下文瞬間撐大的來源之一。
規則：一次最多只允許 1 張主圖 + 1 張對照圖，其餘只傳路徑、尺寸、用途與簡短結論。

### 3. Binary / 圖片 diff

- `git diff` 遇到 binary 資產
- `get_changed_files` 類工具把圖片變更也展開
- compare board 與 smoke screenshot 被當成「可直接讀全文」的輸入

規則：binary 變更只能傳「檔名 + 大小 + 版本用途 + QA 結論」，不能直接把 diff 當上下文主體。

### 4. 重複性任務背景

- 同一張卡的 family 規則、style profile、舊版 notes 在每輪重講
- 同一組 assets 在多個回合反覆列舉
- handoff 同時攜帶 keep、todo、artifact README、notes、brief 全套

規則：改用「摘要卡」而不是「全文包」。

## 強制策略

### A. 摘要卡

每個 Agent handoff 只允許帶這 6 類資訊：

1. 任務 ID 與一句目標
2. 本輪唯一要看的 1~3 個檔案路徑
3. 已知結論 3 點以內
4. 未決策項目 3 點以內
5. 驗證方式 1 條
6. 禁止重讀的背景來源

建議格式：

```text
Task: UI-2-0032
Goal: 從 v2a/v2b/v2c 中選出 BattleScene F7 micro badge 採用稿
Read:
- artifacts/ui-qa/UI-2-0032/v2-compare-board.png
- artifacts/ui-qa/UI-2-0032/notes.md
- artifacts/ui-qa/UI-2-0053/battle-main-ui-art-direction-audit.md
Known:
- F7 是正確 family
- 候選稿已產出，不再生新圖
- 下一步是 QA 選型，不是 refinement
Need:
- 判斷哪一版最適合 32x32 與真場景
Avoid:
- 不要重讀 docs/ui-quality-todo.json 全文
- 不要展開所有 QA 圖片
```

### B. 圖片節流

- 單次對話最多 2 張圖
- 同系列驗證圖只保留索引檔或 compare board
- 原圖、中間稿、1024 輸出圖不可一起帶入
- 大圖只保留路徑與一句摘要，例如：

```text
artifacts/ui-qa/UI-2-0032/unitinfo_type_icon_spear_v2b_dalle3_1024.png
- 用途：AI 原始輸出，不進 handoff，只在需要裁切追查時再開
```

### C. 文件節流

- `keep.md` 只保留最高層共識與 P0 警戒，不放長篇分析
- 長分析搬到獨立文件，`keep.md` 只留一句索引
- `ui-quality-todo.json` 只讀單卡，不讀整份
- workflow / skill 只取與本輪任務直接相關的段落

### D. 搜尋節流

- 搜尋預設排除 `artifacts/`、`docs/UI品質參考圖/`、大圖資料夾
- 只有在明確找 QA 資產時才進圖檔目錄
- 檔案清單優先，內容全文次之

## 警戒線

### 單檔警戒

- 單一文字檔估算超過 `6000 tokens`：禁止整份讀入，只能節錄

### 單輪警戒

- 本輪估算上下文總量超過 `18000 tokens`：提出警告，先縮小上下文再繼續
- 本輪估算上下文總量超過 `30000 tokens`：視為 `hard-stop`，必須先整理摘要卡

### 圖片警戒

- 單輪超過 `3` 張圖片：警告
- 單輪圖片總量超過 `4 MB`：警告

## 工具

新增：

```bash
node tools_node/check-context-budget.js --changed --emit-keep-note
```

用途：

- 掃描本輪 changed files 的上下文風險
- 估算文字檔 token 量
- 標記 compare board / screenshot / large manifest / keep 等高風險來源
- 在 `warn` / `hard-stop` 時輸出可直接貼進 `keep.md` 的警告摘要

常用方式：

```bash
node tools_node/check-context-budget.js --changed
node tools_node/check-context-budget.js --files docs/keep.md docs/ui-quality-todo.json
node tools_node/check-context-budget.js --scan-default --top 15
```

## 爆量時的處置順序

1. 先停掉全文型 handoff
2. 改成摘要卡
3. 圖片縮成 1 張主圖 + 1 張對照圖
4. 把大型分析搬到獨立文件，只在 `keep.md` 留索引
5. 在 `keep.md` 記錄本次爆量原因與修正方案

## keep.md 應記錄的內容

當上下文突然暴增時，`keep.md` 應只記：

- 發生日期
- 估算 token 量級
- 疑似原因
- 已採取的縮減策略
- 是否列為 P0

不要把整份分析全文再塞回 `keep.md`，否則會二次放大問題。
## Skill Entry

When the work is image-heavy, diff-heavy, or handoff-heavy, route the task through `.agents/skills/context-budget-guard/SKILL.md` first.
If the user message starts with `(best)`, route through `.agents/skills/best-mode/SKILL.md` first, then continue into `context-budget-guard`.

Recommended commands:

```bash
node tools_node/check-context-budget.js --changed --emit-keep-note
node tools_node/generate-context-summary.js --task UI-2-0032 --goal "QA select one BattleScene icon" --files artifacts/ui-qa/UI-2-0032/notes.md artifacts/ui-qa/UI-2-0035/icon-family-assignment.md
node tools_node/summarize-structured-diff.js --git docs/keep.md
node tools_node/summarize-structured-diff.js --git docs/ui-quality-todo.json
```

Default behavior from this skill:

- run `check-context-budget.js` before loading large artifacts
- compress handoff into `task / goal / read / known / need / avoid`
- summarize `.md` and `.json` changes before anyone pastes a large diff into chat
- report a final `少 / 中 / 大` turn-usage estimate before closing the task

## Wrapper Policy

To reduce variance between agents, wrappers now sit above the raw tools:

- UI tasks: `node tools_node/run-ui-workflow.js --workflow <workflow-id> ...`
- Non-UI but image-heavy / diff-heavy tasks: `node tools_node/run-guarded-workflow.js --workflow <name> ...`
- Final close-out: `node tools_node/finalize-agent-turn.js --workflow <workflow-id> ...`

These wrappers use `tools_node/lib/context-guard-core.js` as the shared base, so future scripts can inherit the same preflight and finalization behavior.

## Best Prefix

Project convention:

- `(best)` at the start of the user message means strict mode
- strict mode must apply `best-mode` and then `context-budget-guard`
- strict mode forbids direct full-inline of large docs, compare boards, screenshot batches, and large diff dumps

## Final Turn Report

Exact API token billing is not available from the local workspace, so the project standard is to report an estimate based on the files and artifacts touched in the turn.

```bash
node tools_node/report-turn-usage.js --files <file...> --emit-final-line
node tools_node/report-turn-usage.js --changed --emit-final-line
```

Tier rules:

- `少`: usually under `8000` estimated tokens and no image-heavy payload
- `中`: usually `8000` to `19999`, or any single large text file / one image payload
- `大`: usually `20000+`, or compare board / screenshot batch / multiple images
