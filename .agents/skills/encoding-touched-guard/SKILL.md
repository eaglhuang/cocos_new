---
name: encoding-touched-guard
description: '快速編碼防災工作流。USE FOR：任何會修改 .md / .json / .ts / .js / .ps1 等文字檔的工作。目標是在每次編輯後立即檢查 touched files 是否出現 UTF-8 BOM、U+FFFD 或 mojibake，並在收工前再檢查一次，避免中文檔被整檔寫壞後才在 pre-commit 才發現。'
argument-hint: '說明這輪改了哪些高風險文字檔，或直接描述你剛完成哪一批編輯。'
---

# Encoding Touched Guard

這個 skill 是給所有 Agent 的**超快編碼自檢流程**。

重點不是取代 `pre-commit`，而是把檢查前移，讓你在「剛改完檔案」就能立刻發現中文亂碼、BOM 或 mojibake，而不是等到最後提交才爆炸。

## 何時使用

只要這輪有改到任何高風險文字檔，就要用：

- `.md`
- `.json`
- `.ts`
- `.js`
- `.ps1`

特別是：

- 任務追蹤文件
- 中文密集文件
- 含中文註解 / template string 的程式檔

## 標準流程

### 1. 編輯後立刻跑一次 touched-files 快檢

```bash
npm run check:encoding:touched -- --files <file...>
```

這一步只掃你這輪剛改的檔案，適合多人協作時每次寫完就跑。

若你確認目前 dirty working tree 都是自己這輪的內容，也可以直接跑：

```bash
npm run check:encoding:touched
```

### 2. 若失敗，先停下來修

常見原因：

- UTF-8 BOM
- `U+FFFD`
- 典型 mojibake

這時不要繼續做新改動，先把壞檔修回來，再繼續。

### 3. 收工前再跑一次

在你準備結束這輪、交接、或準備 commit 前，再跑一次：

```bash
npm run check:encoding:touched -- --files <file...>
```

### 4. commit 前仍由 staged 檢查硬擋

若你要手動檢查 staged files，可用：

```bash
npm run check:encoding:staged
```

## 為什麼不是只在最後檢查一次

- 太晚發現時，很難知道是哪一步把中文寫壞。
- 中途若有多次自動改寫，回溯成本會很高。
- 這和 Unity Prefab / YAML 很像：不是最後才知道壞了，而是要盡量在第一時間抓到。

## 配套原則

- touched-files 快檢：每次編輯後跑，成本最低。
- 收工前快檢：避免漏網之魚。
- pre-commit staged 檢查：最後硬保底。

三層一起上，才是正式流程。
