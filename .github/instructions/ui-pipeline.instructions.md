---
doc_id: doc_ai_0017
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

## Snapshot Regression Step（每次修改 spec JSON 後必跑）

在步驟 4 通過後、步驟 5 前，必須執行：

```bash
# 1. 靜態規則驗證
node tools_node/validate-ui-specs.js --strict --check-content-contract

# 2. JSON 結構快照 regression
node tools_node/headless-snapshot-test.js
```

- 若快照輸出 `CHANGED`，確認改動屬於預期後執行 `--update` 更新 baseline。
- 若快照輸出非預期 `CHANGED`，用 `layout-diff.js --git <file>` 找出差異並修復。
- 修改 fragment 時，額外先跑：`node tools_node/build-fragment-usage-map.js --query <ref>`

## Debug Skill 選擇

- **Runtime crash / TypeError** → 先用 `cocos-log-reader` skill 讀 `temp/logs/project.log`
- **視覺症狀**（畫面亂、UI 跑掉）→ 先用 `cocos-screenshot` skill 截取 Editor 視窗
- **視覺 + Runtime 同時異常** → 用 `cocos-bug-triage` skill（截圖 → log → 根源 → 修復）
- **Browser Review QA** → 用 `cocos-preview-qa` skill（前提：localhost:7456 可用、preview target 已接好）

## 武將資料管線（3 步驟）

1. **`general-balance-tuner`** — 雙軸稀有度計算、EP 重算、適性校驗
2. **`general-story-writer`** — 批次生成 historicalAnecdote / bloodlineRumor / storyStripCells
3. **`general-data-pipeline`** — 爬取 → 映射 → 合併 → 分類 → 驗證 → 匯出

## Handoff Contract Format（Agent 回合結束前必填）

每個 Agent 回合結束時，handoff 摘要必須包含以下格式：

```
### Handoff Summary

**修改檔案**:
- `<file-path>` — <描述改了什麼>

**決策紀錄**:
- <關鍵技術決策與原因>

**Blocker**:
- <若有，描述卡點；若無，填「無」>

**Post-flight 驗證結果**:
- validate-ui-specs: <PASS / FAIL / 跳過原因>
- headless-snapshot: <PASS / CHANGED-expected / CHANGED-unexpected>
- encoding check: <PASS / 跳過原因>

**下一步建議**:
- <具體可繼續的任務或待確認事項>
```

**強制規則**：
- 修改了任何 `ui-spec/*.json` 或 `fragments/*.json`，必須填寫 validate 結果。
- 若 handoff 無 Post-flight 驗證結果，下一個 Agent 入場時必須先補跑驗證再繼續。
