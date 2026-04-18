---
doc_id: doc_agentskill_0027
name: ui-preview-judge
description: 'UI 預覽評審 SKILL — 截取 Cocos Editor Preview 畫面，與 proof draft 提供的參考圖逐 zone 比對，輸出視覺信心分數與 PASS/FAIL 評審報告，並回寫 runtime-verdict。USE FOR: ui-asset-qc 通過後，需要人工確認 + 自動評審的最終視覺驗收。DO NOT USE FOR: Runtime 崩潰（用 cocos-log-reader）、Browser QA 截圖（用 cocos-preview-qa）、資產規格問題（用 ui-asset-qc）。'
argument-hint: '提供 screenId（對應 proof draft / review 骨架），確認 Cocos Editor 已開啟該畫面的 Preview 模式。'
---

# UI Preview Judge

這是 UI production pipeline 的**第 5 步（最終關卡）**：截圖並比對設計稿與實機畫面。

Unity 對照：相當於 UnityEditor PlayMode Screenshot + Design Diff Tool — 在 Play Mode 接近設計稿後截圖，送審設計師確認。

---

## 前提條件

1. Cocos Creator Editor 正在執行（`http://localhost:7456` 可連）
2. 目標 Screen 的場景已在 Editor Preview 或 Canvas 中開啟
3. `ui-asset-qc` 已通過（零 errors）
4. proof draft 中有可用的 `proofSource`（參考圖路徑或 ref://）

---

## 輸入

| 項目 | 說明 |
|---|---|
| `screenId` | 對應 `assets/resources/ui-spec/proof/screens/{screenId}.proof.json` |
| `referenceImagePath` | 本地參考圖路徑（proof draft 的 `proofSource` 值）|

---

## 輸出

1. `artifacts/ui-source/{screenId}/review/runtime-verdict.json` — 逐 zone 評審結果
2. `artifacts/ui-source/{screenId}/review/preview-screenshot.png` — 截圖存档

---

## 執行步驟

### Step 1 — 讀取 proof draft

```
read_file { filePath: "assets/resources/ui-spec/proof/screens/{screenId}.proof.json" }
```

記錄 visualZones 的 zone 清單、每個 zone 的 `bounds`（x/y/w/h）、`family`、`confidence`。

### Step 2 — 截圖（使用 cocos-screenshot skill）

先讀取並遵循 `cocos-screenshot` skill 的截圖流程：
```
read_file { filePath: ".github/skills/cocos-screenshot/SKILL.md" }
```

執行截圖，確認截圖儲存至：
```
artifacts/ui-source/{screenId}/review/preview-screenshot.png
```

### Step 3 — 查看截圖與參考圖

預覽截圖請沿用 `cocos-screenshot` 的縮圖流程；參考圖同樣先走 `125 -> 250 -> 500` 的 progressive zoom。

同時用 `view_image` 開啟兩張圖：
```
view_image { filePath: "artifacts/ui-source/{screenId}/review/preview-screenshot.png" }
view_image { filePath: "{referenceImagePath}" }
```

> 圖片檢視硬規定：一次最多 `1` 張主圖 + `1` 張對照圖；先試 `125px`，不足才放大一倍；需要看 `>500px` 原圖時，必須先取得使用者明確同意。

### Step 4 — 逐 zone 比對

依 proof draft 的 zone 清單，對每個 zone 比對以下項目：

| 比對項目 | 說明 |
|---|---|
| 字體風格 | 標題/內容/說明文字的粗細、大小是否與設計稿一致 |
| 框體 family | 邊框風格是否符合 family（dark-metal/parchment/gold-cta 等）|
| 色彩基調 | 背景色、主要顏色是否與設計稿接近 |
| 間距比例 | 元素間距是否明顯偏移（>10% 視為問題）|
| 內容佔位 | Icon、頭像、資料欄位是否有正確的佔位符 |

### Step 5 — 輸出評審報告

```markdown
## Preview Judge Report — {screenId} ({timestamp})

### 總評：PASS / CONDITIONAL PASS / FAIL

| Zone | Family | 信心分數 | 備註 |
|---|---|---|---|
| header | dark-metal | 0.85 | 標題文字稍大，約差 2pt |
| tab-bar | tab | 0.60 | tab 資產尚未生成，佔位符狀態 |
| item-grid | item-cell | 0.70 | 間距比設計稿多 8px |
| footer | dark-metal | 0.90 | 一致 |

### 整體信心分數：0.76

### PASS 條件
- ✅ 主要 zone（header/footer）信心 ≥ 0.8
- ⚠️ asset-pending zone（tab-bar）允許 conditonal pass
- ⚠️ item-grid 間距問題 → 記錄為改善項

### 建議後續行動
1. tab family 資產完成後重跑 ui-preview-judge
2. item-grid 間距問題排入 UI-backlog
```

同時輸出 JSON 版：
```jsonc
// 注意：screenId 在 JSON 中使用 kebab-case（如 "shop-main"），
// artifacts 目錄亦用 kebab-case（如 artifacts/ui-source/shop-main/review/）。
{
  "screenId": "shop-main",
  "timestamp": "2026-04-05T12:00:00Z",
  "verdict": "CONDITIONAL_PASS",
  "overallConfidence": 0.76,
  "zones": [
    { "zoneId": "header", "family": "dark-metal", "confidence": 0.85, "issues": [] },
    { "zoneId": "tab-bar", "family": "tab", "confidence": 0.60, "issues": ["asset-pending"] }
  ],
  "nextActions": ["complete tab assets", "fix item-grid spacing"]
}
```

---

## 評審標準

| 評審結果 | 條件 |
|---|---|
| **PASS** | 所有 zone 信心 ≥ 0.75，無 asset-pending zone |
| **CONDITIONAL PASS** | asset-pending zone 存在，或有 1-2 個 zone 信心 0.6-0.75 |
| **FAIL** | 任何 zone 信心 < 0.6（非 asset-pending），或主要 zone < 0.7 |

---

## 下一步

- **PASS** → 更新 `artifacts/ui-source/{screenId}/review/runtime-verdict.json`，必要時再回寫 proof draft 的 `confidence`
- **CONDITIONAL PASS** → 記錄未完成項，持續推進其他優先任務，之後重跑
- **FAIL** → 回到 **ui-vibe-pipeline** 調整 layout/skin，或回到 **ui-asset-gen-director** 重新委託
