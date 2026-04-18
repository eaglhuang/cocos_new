---
doc_id: doc_ai_0005
description: 利用 AI 將 i18n 字串翻譯為多國語系版本，考慮字型寬度與 UI 空間限制
---

## Context Budget Guard

- 進 workflow 前先看 `.agents/skills/context-budget-guard/SKILL.md` (doc_agentskill_0006)
- 先跑 `node tools_node/check-context-budget.js --changed --emit-keep-note`
- 大型 `.md` / `.json` 變更先跑 `node tools_node/summarize-structured-diff.js --git <file>`
- 收工前跑 `node tools_node/report-turn-usage.js --changed --emit-final-line`，並在 final answer 補上 `Token 量級：少 / 中 / 大（估算）`
# 多國語系翻譯自動化流程

此 workflow 利用 AI 翻譯能力，將 zh-TW 基礎語系字串翻譯為其他語言，
並考慮 UI 欄位寬度、字型大小、文字溢出等限制。

## 使用時機
- 新增 UI 畫面後，需要產出其他語系的翻譯
- 批量更新某一語系的所有字串
- 檢查翻譯後的文字是否會導致 UI 溢出

## 前提條件
- `assets/resources/i18n/zh-TW.json` 存在（基礎語系）
- `assets/resources/ui-spec/ui-design-tokens.json` 存在（字型大小參考 ）

## 支援語系
- `zh-TW`（繁體中文，基礎語系）
- `zh-CN`（簡體中文）
- `en-US`（英文）
- `ja-JP`（日文）
- `ko-KR`（韓文）

## 步驟

### 1. 讀取基礎語系

讀取 `assets/resources/i18n/zh-TW.json`，取得所有需翻譯的鍵值對。

### 2. 讀取 UI 限制參考

讀取 `ui-design-tokens.json` 中的字型大小，估算各欄位的最大字元數：
- 大標題（headlineMd, 34px）：約 15 個中文字 / 30 個英文字母
- 內文（bodyMd, 18px）：約 25 個中文字 / 50 個英文字母
- 標籤（labelMd, 14px）：約 8 個中文字 / 16 個英文字母
- 按鈕（buttonMinWidth 120px, bodyMd）：約 4 個中文字 / 10 個英文字母

### 3. 翻譯規則

針對每個鍵值對，執行 AI 翻譯時遵守：

1. **長度控制**：翻譯後的文字長度不應超過原文的 150%（英文）或 120%（日文/韓文）
2. **專業術語**：遊戲術語需一致（如「武將」→ "General" / "武将" / "武将" / "장군"）
3. **格式保留**：保留 `{variable}` 佔位符原樣不翻譯
4. **語氣風格**：三國策略遊戲 → 使用莊重、古典的用語風格
5. **縮短策略**：若翻譯超長，嘗試用縮寫或同義短詞

### 4. 產出語系檔

為每個目標語系產出 JSON 檔案到 `assets/resources/i18n/{locale}.json`。

### 5. 寬度溢出檢查報告

產出一份寬度檢查報告，列出可能溢出的翻譯：

```markdown
## 翻譯溢出警告

| 鍵值 | 原文 | 翻譯 | 語系 | 預估字元數 | 上限 | 風險 |
|------|------|------|------|-----------|------|------|
| ui.battle.deploy | 部署 | Deploy | en-US | 6 | 10 | ✅ |
| ui.general.attackBonus | 攻擊加成 | Attack Bonus | en-US | 12 | 10 | ⚠️ 略長 |
```

### 6. 驗證語系切換

如果 Cocos 預覽可用，使用 browser_subagent 驗證：
1. 切換到目標語系
2. 截圖檢查是否有文字溢出
3. 回報結果

