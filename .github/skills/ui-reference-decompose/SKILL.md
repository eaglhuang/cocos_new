---
doc_id: doc_agentskill_0028
name: ui-reference-decompose
description: '參考圖解析 SKILL — 從截圖、Figma 連結或參考 PNG 中，分解出 proof draft（visualZones + componentIntents + spacingRecipe + contentSlots + unresolved notes）。USE FOR: 拿到新畫面設計稿或截圖時，作為 UI production pipeline 第 1 步。DO NOT USE FOR: 直接生成 normalized recipe 或 screen package（需先完成此步再進 family / MCQ 收斂）。'
argument-hint: '提供參考圖路徑（ref://docs/UI品質參考圖/xxx.png 或 figma://）以及目標 screenId（建議 kebab-case，例如 shop-main、battle-hud）。'
---

# UI Reference Decompose

這是 UI production pipeline 的**第 1 步**：把視覺輸入轉成結構化 proof draft。

Unity 對照：相當於 Art Director 審圖後給技術美術的「元素清單 + 語意分區 metadata」。

---

## 輸入

| 項目 | 說明 |
|---|---|
| `proofSource` | `ref://docs/UI品質參考圖/<filename>` 或 `figma://file/<id>?node=<nodeId>` |
| `screenId` | 建議 kebab-case，例如 `shop-main`、`battle-hud` |
| （可選）`existingScreenJson` | 若已有 screen spec，提供以對齊 contentSlots |

## 輸出

`assets/resources/ui-spec/proof/screens/{screenId}.proof.json`（proof draft）

---

## 執行步驟

### Step 1 — 讀取參考圖

若 proofSource 為 `ref://` 路徑，先走 thumbnail-first progressive zoom：先產出 `125px` 預覽；只有在看不清時才升到 `250px`，再不夠才到 `500px`。

```powershell
$imgPath = "c:\Users\User\3KLife\<path-after-ref://>"
node tools_node/prepare-view-image.js --input $imgPath
# 若 125px 不足，再依序改跑：
# node tools_node/prepare-view-image.js --input $imgPath --maxWidth 250
# node tools_node/prepare-view-image.js --input $imgPath --maxWidth 500
```

```
view_image { filePath: "c:\Users\User\3KLife\<path-after-ref://>" }
```

若 helper 產出縮圖檔，改看那張 preview 檔，不要直接看原圖。

> 一次最多只開 1 張主圖；若需要對照圖，另加 1 張即可。

若 proofSource 為 `figma://`，讀取 sync-figma-proof-mapping.js 或 workflow 產出的快照（優先看 `artifacts/ui-source/{screenId}/...` 相關輸入包）。

### Step 2 — 語意區域分解（VisualZones）

從參考圖識別畫面中的語意區塊，依下列原則分區：
- 每個 zone 負責**一個語意功能**（標題列、商品格、行動按鈕區等）
- 指派對應的 `family`（dark-metal / parchment / gold-cta / tab / item-cell / panel-light / none）
- 若有明顯的 FrameRecipe 對應，填入 `frameRecipeRef`
- 若能量取設計稿座標，填入 `bounds`（否則留空，加 note 說明）

### Step 3 — 組件意圖宣告（ComponentIntents）

針對每個 zone 內的主要節點，逐一宣告：
- `nodeHint`：panel / button / label / icon / scroll-list / grid / progress-bar / tab-bar / dialog / image
- `skinSlot`：建議對應 skin slot key（前綴需符合所在 zone 的 family）
- `bind`：資料綁定路徑（若有資料驅動需求）
- `textKey`：若為靜態文字標籤

### Step 4 — 排版比例（SpacingRecipe）

估算或量取：
```json
{
  "containerPadding": 24,
  "itemSpacing": 16,
  "sectionGap": 32,
  "unitBasis": 8
}
```
原則：所有值必須為 unitBasis 的整數倍。

### Step 5 — 內容插槽（ContentSlots）

把畫面上每個需要資料填充的欄位列出：
- `id`：與 ContentContractRef.requiredFields 對齊
- `type`：label / button / list / image / number / bool / enum
- 若 type=list，補 minCount / maxCount
- 若 type=button，補 family

### Step 6 — 輸出草稿 JSON

使用 `create_file` 輸出至 `assets/resources/ui-spec/proof/screens/{screenId}.proof.json`，
格式依 `assets/resources/ui-spec/proof/proof-contract.schema.json`。

**草稿必須設定 `"_draft": true` 及 `"confidence": 0.5`**，提醒後續 Agent 補齊細節與 unresolved notes。

### Step 7 — 或使用 sync-figma 工具自動生成草稿

若有 proof mapping config，可直接：
```
node tools_node/sync-figma-proof-mapping.js \
  --config <mapping.json> \
  --proof-contract --screen-id <ScreenId> --dry-run
```
（去掉 `--dry-run` 正式寫出）

---

## 品質門檻

- visualZones 至少 2 個
- 每個 zone 必須有 `family`
- contentSlots 不能是空陣列
- confidence < 0.6 時，notes 必須說明限制原因

---

## 下一步

若要走完整自動化生產流程，完成後直接進入 **ui-vibe-pipeline**，由它編排 family 收斂、brief / task card、recipe、scaffold、驗證與 Browser QA。

若只想維持手動分步流程，才進入 **ui-family-architect** skill（Step 2），再由 `compile-proof-to-mcq.js` / `compile-mcq-answer-to-recipe.js` 收斂。

> **完整編排指令**：若要一鍵啟動完整 orchestrated workflow：
> ```
> node tools_node/run-ui-vibe-workflow.js --proof-source <image> --screen-id <screen-id>
> ```
