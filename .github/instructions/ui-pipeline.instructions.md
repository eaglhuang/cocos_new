---
applyTo: "assets/prefabs/**,assets/scripts/ui/**,docs/ui/**,docs/ui-quality-tasks/**"
---

# UI 開發流程指引

## UI Production Pipeline（5 步驟）

製作新 UI 畫面時，依序使用以下 skill：

1. **`ui-reference-decompose`** — 解析參考圖 → 產生 proof-contract-v1 草稿
2. **`ui-family-architect`** — 為每個 zone 分配 FrameFamily + recipe + themeStack
3. **`ui-asset-gen-director`** — 產生 ArtRecipe 委託書、列出缺失資產（交 Agent2 生成）
4. **`ui-asset-qc`** — 執行 R1-R6 自動驗證（`validate-visual-assets.js`），零 error 才可繼續
5. **`ui-preview-judge`** — 截圖比對設計稿，輸出信心分數與 PASS/FAIL 評審報告

## Debug Skill 選擇

- **Runtime crash / TypeError** → 先用 `cocos-log-reader` skill 讀 `temp/logs/project.log`
- **視覺症狀**（畫面亂、UI 跑掉）→ 先用 `cocos-screenshot` skill 截取 Editor 視窗
- **視覺 + Runtime 同時異常** → 用 `cocos-bug-triage` skill（截圖 → log → 根源 → 修復）
- **Browser Review QA** → 用 `cocos-preview-qa` skill（前提：localhost:7456 可用、preview target 已接好）

## 武將資料管線（3 步驟）

1. **`general-balance-tuner`** — 雙軸稀有度計算、EP 重算、適性校驗
2. **`general-story-writer`** — 批次生成 historicalAnecdote / bloodlineRumor / storyStripCells
3. **`general-data-pipeline`** — 爬取 → 映射 → 合併 → 分類 → 驗證 → 匯出
