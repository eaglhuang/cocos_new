---
doc_id: doc_agentskill_0032
name: crossref-progress-scanner
description: 'Cross-Reference 進度掃描器 — 自動掃描 assets/scripts/**/*.ts 與 tests/*.ts，比對 cross-ref-code.md B-1 表格，產生進度差異報告。USE FOR: 進度掃描、cross-ref 更新。DO NOT USE FOR: 程式碼編輯、UI layout 調整。'
argument-hint: '請求「掃描進度」、「更新 cross-ref」、「crossref 進度」。'
---

# crossref-progress-scanner Skill

## Overview

Cross-Reference 進度掃描器。自動掃描 `assets/scripts/**/*.ts` 與 `tests/*.ts`，比對 `cross-ref-code.md (doc_index_0001)` B-1 表格，產生進度差異報告，並更新 `cross-ref-進度.md (doc_index_0017)` D-4 摘要節。

**觸發語**：「掃描進度」、「更新 cross-ref」、「crossref 進度」

---

## When to load this skill

Load this skill when the user asks to:
- 掃描程式實作進度 / update cross-ref progress
- 檢查哪些 .ts 檔已從 B-1 消失（stale entries）
- 在 cross-ref-進度.md 看不到最新進度
- 新 .ts 檔 or spec 文件落地後需要更新映射

**Do NOT use for**: runtime crash debug (use cocos-bug-triage), UI asset generation (use ui-vibe-pipeline).

---

## Four-Stage Workflow

### Stage A — 關係掃描（Relationship Scan）

**目標**：識別 B-1 中的 stale entries 與未收錄的新 .ts 檔

1. 執行 `--rebuild-progress` 取得掃描報告：
   ```bash
   node tools_node/rebuild-crossref.js --rebuild-progress
   ```
2. 讀取 `temp_crossref_progress_report.json`（工具自動生成）
3. 分層整理結果：
   - `stale[]`：在 B-1 有記錄但 `assets/scripts/` 已無此檔 → 應從 B-1 移除
   - `uncovered_scripts[]`：在 `assets/scripts/` 有但 B-1 尚未記錄 → 候選新增
   - `present[]`：正常（無需動作）
4. 輸出紀要給使用者確認，例如：
   ```
   stale: HeadlessRenderer.ts (1)
   uncovered: NewSystem.ts, AnotherPanel.ts (2)
   ```

### Stage B — 完成度掃描（Completion Scan）

**目標**：為 D-1 中每筆規格書估算三段完成度

估算邏輯（簡易三段式）：
- 🟢（≥60%）：.ts 檔存在 + 有直接測試（文件指名出現在 B-1 且 test_files 中有對應 `.test.ts`）
- 🟡（20–59%）：.ts 檔存在但無測試，或測試待建
- 🔴（<20%）：無任何 .ts 實作 / 僅佔位

不需要 AST 級別解析，以「有實作 .ts + 有測試 .ts」作為首要判斷依據。

**不得**自動修改 D-1 表格的完成度直欄位（🟢/🟡/🔴）：若發現偏差，以**提案格式**列出建議變更，等使用者確認後方才執行。

### Stage C — 專案總進度（Project Progress）

**目標**：計算加權進度，更新 `cross-ref-進度.md (doc_index_0017)` D-4 節

加權公式：
- 核心戰場系統（FormulaSystem, BattleSystem, BattleState, BattleController, EnemyAI…）× 3
- UI 系統（BattleHUD, GeneralDetailComposite, CompositePanel, ChildPanelBase, general-detail-unified-screen…）× 2
- 其他系統 × 1

計算方式：按現有 D-1 🟢/🟡/🔴 分類，🟢 × 完整分；🟡 × 0.5；🔴 × 0。

自動寫入 D-4 摘要表後，**等使用者確認**後才寫入 cross-ref-進度.md。

### Stage D — 清理（Cleanup）

**目標**：移除 B-1 中確認 stale 的條目，標記 `????` 佔位符

執行流程（需使用者確認）：
1. 對 Stage A 確認的 stale 條目，從 `cross-ref-code.md (doc_index_0001)` B-1 移除對應行
2. `????` 佔位符條目（如 `GeneralUnit.ts` 的規格書欄位）：僅標記、不自動填充
3. 每次 cleanup 後重新執行 `--validate`：
   ```bash
   node tools_node/rebuild-crossref.js --validate
   ```

---

## Internal Flow

```
1. node tools_node/rebuild-crossref.js --rebuild-progress
2. 讀 temp_crossref_progress_report.json
3. Stage A: 比對 stale / uncovered → 輸出提案
4. Stage B: 掃描測試覆蓋 D-1 → 輸出完成度差異
5. Stage C: 計算加權 D-4 → 輸出草稿
6. [使用者確認]
7. Stage D: 寫入 D-4, cleanup B-1 stale (if confirmed)
8. node tools_node/rebuild-crossref.js --validate
9. node tools_node/check-encoding-touched.js <changed-files>
```

---

## Key Files

| 檔案 | 用途 |
|------|------|
| `docs/cross-ref/cross-ref-進度.md (doc_index_0017)` | 人類可讀進度儀表板（D-1/D-2/D-3/D-4） |
| `docs/cross-ref/cross-ref-code.md (doc_index_0001)` | B-1 代碼→規格書映射（壓縮版，doc_id 索引） |
| `tools_node/rebuild-crossref.js` | `--rebuild-progress` 掃描、`--validate` 驗證 |
| `temp_crossref_progress_report.json` | Stage A 掃描輸出（temp，git-ignored） |

---

## Guardrails

- **不自動寫入**任何 .md 檔案，所有變更先以提案格式輸出等使用者確認
- **無 AST 解析**：僅用 filename match，不解析 TypeScript AST
- **不刪除** `????` 佔位符：標記並提示用 `general-data-pipeline` 或手動補全
- Stage D cleanup 需 explicit confirm（不預設執行）
- 每次變更後必跑 `check-encoding-touched.js`，確保 0 BOM

---

## Output Artifacts

- 提案報告：以純文字列表格式輸出（Markdown 表格或條列）
- D-4 草稿：以 Markdown table 格式呈現，可直接貼入 cross-ref-進度.md
- cleanup diff：列出每個要移除的 B-1 行
