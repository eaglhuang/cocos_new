---
doc_id: doc_agentskill_0022
name: ui-asset-qc
description: 'UI 資產品質驗證 SKILL — 執行 validate-visual-assets.js、validate-ui-specs.js 與必要的 snapshot regression，對 skin family 資產、screen package、proof draft / family-map 進行全面驗證，並回寫 generated-review。USE FOR: 任何 UI 資產生成後、在 ui-preview-judge 前必須先通過的 QA 關卡。DO NOT USE FOR: debug runtime 崩潰（用 cocos-log-reader）、Layout 佈局調整（用 ui-vibe-pipeline）。'
argument-hint: '提供 screenId 或 family 名稱，選擇 --strict 模式（blocker=error 不得過）或 --warn-only 模式。'
---

# UI Asset QC

這是 UI production pipeline 的**第 4 步**：執行自動化規則驗證，確保資產品質可進入預覽階段。

Unity 對照：相當於 Unity Asset Audit / ImportSettings Checker — 確認所有貼圖的 Texture Type、Max Size、Compression 都符合規範才能進 build。

---

## 規則速查表（R1-R6）

| 規則 | 全名 | Severity | 快速說明 |
|---|---|---|---|
| R1 | sliced-sprite-border-valid | error | 9-slice 精靈的 border 必須 > 0 |
| R2 | sprite-atlas-consistency | warn | 同 family 的精靈應在同一 Auto Atlas |
| R3 | texture-resolution-valid | warn | 貼圖解析度必須是 2 的冪次（或在 UI atlas 白名單內）|
| R4 | skin-slot-completeness | error | skin manifest 中每個 slot 必須有實際對應的 spriteFrame |
| R5 | sprite-border-reasonable | warn | 9-slice border 不應超過 32px（否則易撕裂） |
| R6 | proof-draft-slot-coverage | warn | screen package 的 slots 應100%被 proof draft 覆蓋 |

---

## 輸入

| 項目 | 說明 |
|---|---|
| `screenId` / `familyId` | 要驗證的對象（可兩者都填）|
| `mode` | `strict`（預設）或 `warn-only`（研發期） |
| `reportPath` | 輸出報告路徑（預設：`artifacts/ui-source/{screenId}/review/generated-review.json`）|

---

## 執行步驟

### Step 1 — 執行 visual assets 驗證

```bash
node tools_node/validate-visual-assets.js \
  --family {familyId} \
  --strict \
  --report artifacts/ui-source/{screenId}/review/generated-review.raw.json \
  --config tools_node/qa-rules-config.json
```

若無特定 family，省略 `--family` 旗標（掃描全部）。

### Step 2 — 執行 UI spec 驗證

```bash
node tools_node/validate-ui-specs.js \
  --strict \
  --check-content-contract
# 注意：此工具驗證所有 screen spec，無 --screen 單一篩選旗標
```

若本次改到 `layout / skin / screen` JSON，補跑：

```bash
node tools_node/headless-snapshot-test.js
```

### Step 3 — 讀取報告

```
read_file { filePath: "artifacts/ui-source/{screenId}/review/generated-review.raw.json" }
```

統計：
- `errors` (R1/R4 類型)：**必須全數清零**才能繼續
- `warnings` (R2/R3/R5/R6 類型)：可記錄並推進，但需在 PR 說明中列出

### Step 4 — Proof draft / family-map 覆蓋驗證

讀取 proof draft：
```
read_file { filePath: "assets/resources/ui-spec/proof/screens/{screenId}.proof.json" }
```

必要時再讀 `artifacts/ui-source/{screenId}/proof/{screenId}.family-map.json`，比對 proof 的 `contentSlots[*].id` 與 recipe / screen package 的 `slots` 是否一致。若有缺漏，列出 missing slot IDs。

### Step 5 — 回寫 review skeleton

把 QC 結果彙整到：

```text
artifacts/ui-source/{screenId}/review/generated-review.json
```

### Step 6 — 輸出 QC 摘要

```markdown
## QC Report — {screenId} ({timestamp})

### 結果：PASS / FAIL

**R1 (sliced-border-valid)**: ✅ 0 errors  
**R2 (atlas-consistency)**: ⚠️ 2 warnings (tab: tab_active + tab_inactive 不同 atlas)  
**R3 (resolution)**: ✅ 0 errors  
**R4 (skin-slot-completeness)**: ✅ 0 errors  
**R5 (border-reasonable)**: ⚠️ 1 warning (item-cell border=40px)  
**R6 (proof-coverage)**: ✅ 100% covered  

### Blockers（需修復後才可繼續）
- 無

### Warnings（可推進，但需留意）
- tab atlas 不一致 → 建議合入 auto-atlas-tab
- item-cell R5 border=40px → 確認是設計稿規格才保留
```

---

## 品質門檻

- **zero-error 原則**：errors > 0 則本步驟**不通過**，必須修復再重跑
- 若 `--warn-only` 模式則 error 也降為 warning（僅研發初期使用）
- QC 報告檔案必須輸出（不可僅在終端顯示）

---

## 下一步

- QC PASS → 進入 **ui-preview-judge** 執行視覺驗收
- QC FAIL（有 errors）→ 回到 **ui-asset-gen-director** 或直接修復資產後重跑
