---
name: encoding-touched-guard
description: '快速編碼防災工作流。USE FOR：任何會修改 .md / .json / .ts / .js / .ps1 等文字檔的工作。目標是在每次編輯後立即檢查 touched files 是否出現 UTF-8 BOM、U+FFFD 或 mojibake，並在收工前再檢查一次，避免中文檔被整檔寫壞後才在 pre-commit 才發現。'
argument-hint: '說明這輪改了哪些高風險文字檔，或直接描述你剛完成哪一批編輯。'
---

<!-- 同步自 .agents/skills/encoding-touched-guard/SKILL.md，供 GitHub Copilot / 技能面板引用。 -->

# Encoding Touched Guard

這個 skill 是給所有 Agent 的超快編碼自檢流程。

## 標準流程

1. 編輯後立刻跑：

```bash
npm run check:encoding:touched -- --files <file...>
```

2. 若失敗，先修編碼，不要帶著壞檔繼續工作。
3. 收工前再跑一次：

```bash
npm run check:encoding:touched -- --files <file...>
```

4. commit 前仍由 staged 檢查保底：

```bash
npm run check:encoding:staged
```

## 使用時機

- 任何修改 `.md` / `.json` / `.ts` / `.js` / `.ps1` 的工作
- 特別是中文密集文件、任務追蹤文件、含中文註解或 template string 的檔案
