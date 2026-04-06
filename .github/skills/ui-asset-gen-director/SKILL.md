---
name: ui-asset-gen-director
description: 'UI 資產委託導演 SKILL — 讀取 family-plan.json + skin-family-*.json，產生精確的 ArtRecipe（美術委託書），列出每個 family slot 所需的 spriteFrame 路徑、尺寸規格、9-slice 邊距，交由 Agent2（UI-2-0091）執行實際資產生成。USE FOR: family-architect 輸出 asset-pending 狀態後，正式委託美術生產。DO NOT USE FOR: 非 UI 資產生成、程式邏輯開發、QA 驗證（用 ui-asset-qc）。'
argument-hint: '提供 screenId 或 family-plan.json 路徑，以及目標 family 清單（如 tab, item-cell）。'
---

# UI Asset Gen Director

這是 UI production pipeline 的**第 3 步**：根據 family plan 產生 ArtRecipe，委託資產生成。

Unity 對照：相當於 Art Director 給美術師 Texture Spec Sheet — 明確規定每張 sprite 的尺寸、切割比例、解析度。

---

## 輸入

| 項目 | 說明 |
|---|---|
| `familyPlanPath` | `artifacts/ui-qa/{screenId}/family-plan.json`（或 screenId） |
| `missingFamilies` | family-plan 中 `status: "asset-pending"` 的 family 清單 |

---

## 輸出

1. `artifacts/ui-qa/{screenId}/art-recipe.json` — 每個 slot 的美術規格
2. 報告哪些路徑（`sprites/ui_families/{family}/{asset}`）需要被建立

---

## Slot 路徑慣例

| 部位 | 路徑樣板 |
|---|---|
| Frame Edge | `sprites/ui_families/{family}/frame_edge/spriteFrame` |
| Frame Fill | `sprites/ui_families/{family}/frame_fill/spriteFrame` |
| Frame Glow | `sprites/ui_families/{family}/frame_glow/spriteFrame` |
| Frame Corner | `sprites/ui_families/{family}/frame_corner_tl/spriteFrame` |
| Tab Active | `sprites/ui_families/{family}/tab_active/spriteFrame` |
| Tab Inactive | `sprites/ui_families/{family}/tab_inactive/spriteFrame` |
| Cell Default | `sprites/ui_families/{family}/cell_default/spriteFrame` |
| Button Normal | `sprites/ui_families/{family}/btn_normal/spriteFrame` |
| Button Pressed | `sprites/ui_families/{family}/btn_pressed/spriteFrame` |

---

## 執行步驟

### Step 1 — 讀取 family plan

```
read_file { filePath: "artifacts/ui-qa/{screenId}/family-plan.json" }
```

找出所有 `status: "asset-pending"` 或 `recipe: null` 的 zone。

### Step 2 — 讀取 skin-family-{family}.json

對每個 pending family，讀取對應的 skin manifest：
```
read_file { filePath: "assets/resources/ui-spec/skins/skin-family-{family}.json" }
```

列出 `slots` 中每個 slot 的 `asset`（sprite 路徑），這就是**需要建立的目標清單**。

### Step 3 — 確認既有資產

對每個目標路徑，用 file_search 確認是否已存在：
```
file_search { query: "assets/textures/ui_families/{family}/**" }
```

將結果分成：
- `exists`: 路徑已有對應 spriteFrame
- `missing`: 需要美術生成

### Step 4 — 產生 ArtRecipe

輸出 `artifacts/ui-qa/{screenId}/art-recipe.json`：

```jsonc
{
  "screenId": "ShopMain",
  "generatedAt": "2026-04-05",
  "artRecipes": [
    {
      "family": "tab",
      "slots": [
        {
          "slotId": "tab.frame.active",
          "targetPath": "assets/textures/ui_families/tab/tab_active.png",
          "spriteFramePath": "sprites/ui_families/tab/tab_active/spriteFrame",
          "status": "missing",
          "spec": {
            "size": [120, 40],
            "sliceMode": "9-slice",
            "sliceBorder": { "top": 8, "right": 8, "bottom": 8, "left": 8 },
            "colorHint": "#C8A45A",
            "styleNote": "戰國卷軸風格，活躍 tab，有金邊高亮"
          }
        }
      ]
    }
  ],
  "summary": {
    "totalSlots": 12,
    "existingSlots": 4,
    "missingSlots": 8
  }
}
```

### Step 5 — 委託備忘

輸出一段給 Agent2（或美術人員）的委託說明：

```
【資產委託備忘】
Screen: {screenId}
Missing family assets:
- tab: tab_active, tab_inactive（120×40, 9-slice 8px, 金邊/素邊）
- item-cell: cell_default（160×60, 9-slice 12px, 戰國卷軸質感）

請依據 art-recipe.json 的 spec 生成對應 PNG，
放置路徑：assets/textures/ui_families/{family}/{asset}.png
生成後執行 ui-asset-qc skill 驗證。
```

---

## 品質門檻

- 每個在 skin manifest 中列出的 slot 都必須出現在 ArtRecipe
- `missing` 的 slot 必須有 `spec.size` 和 `spec.sliceBorder`
- 9-slice border 每邊不超過 `size / 3`（否則會撕裂），若超過須 flag

---

## 下一步

- 若 missingSlots > 0 → 交由 Agent2（UI-2-0091）按 art-recipe.json 生成資產
- 資產生成後 → 進入 **ui-asset-qc** 執行 R1-R6 驗證
