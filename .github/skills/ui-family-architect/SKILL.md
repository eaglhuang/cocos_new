---
name: ui-family-architect
description: 'UI Family 架構師 SKILL — 讀取 proof-contract-v1，為每個 visualZone 分配 FrameFamily + FrameRecipe + themeStack，驗證 family 可用性，輸出 screen.json 與 skin manifest 草稿的 family 預填欄位。USE FOR: 在 ui-reference-decompose 完成後，進行 family 分派與 recipe 選擇（UI pipeline Step 2）。DO NOT USE FOR: 直接產生 layout.json 或 asset 需求（需先完成此步）。'
argument-hint: '提供 proof contract 路徑（或 screenId），以及設計風格偏好（水墨戰國 / 明亮 / 特殊）。'
---

# UI Family Architect

這是 UI production pipeline 的**第 2 步**：讀取 proof contract，決定每個 zone 的 family + recipe 組合。

Unity 對照：相當於 Scene Assembly — 決定每個 Prefab 要套哪個 Material Variant。

---

## 輸入

| 項目 | 說明 |
|---|---|
| `proofContractPath` | `assets/resources/ui-spec/proof/screens/{screenId}.proof.json` |
| （可選）`themeOverride` | 強制指定 base skin（預設：`skin-base-v1`） |

## 輸出

1. 更新 proof contract 的 `frameRecipeRef` 欄位（補齊草稿中的空值）
2. `screen.json` 草稿中的 `recipeRef` 與 `skin` 初始值建議
3. 建議的 `themeStack` 設定（用於對應 family 的 skin manifest）

---

## 執行步驟

### Step 1 — 讀取 proof contract

```
read_file { filePath: "assets/resources/ui-spec/proof/screens/{screenId}.proof.json" }
```

在 `visualZones` 列表中找出每個 zone 的 `family`。

### Step 2 — 驗證 family 可用性

確認以下 family 已有對應的 skin family 檔案（`skins/skin-family-*.json`）：
- `dark-metal` → `skin-family-dark-metal.json` ✅
- `parchment` → `skin-family-parchment.json` ✅
- `gold-cta` → `skin-family-gold-cta.json` ✅
- `tab` → 尚無 family skin，需通知 Agent2（UI-2-0091）
- `item-cell` → 尚無 family skin，需通知 Agent2

驗證對應 recipe 是否存在（`recipes/families/{family}-v1.recipe.json`）：
```
recipes/families/dark-metal.recipe.json ✅
recipes/families/parchment.recipe.json ✅
recipes/families/gold-cta.recipe.json ✅
recipes/families/destructive.recipe.json ✅
recipes/families/tab.recipe.json ✅
```

### Step 3 — 補齊 frameRecipeRef

對 proof contract 中 `frameRecipeRef` 為空的 zone，根據 family 補齊預設值：
| family | 預設 frameRecipeRef |
|---|---|
| dark-metal | `dark-metal-v1` |
| parchment | `parchment-v1` |
| gold-cta | `gold-cta-v1` |
| destructive | `destructive-v1` |
| tab | `tab-v1` |
| none | （不設定） |

### Step 4 — 規劃 themeStack

決定此畫面的 skin manifest 要使用的 themeStack：

```json
{
  "themeStack": {
    "base": "skin-base-v1",
    "family": "skin-family-{主要 family}",
    "stateOverrides": []
  }
}
```

若畫面混用多個 family，選擇**最高頻的 family** 放在 `themeStack.family`；
其他 family 的 slot 直接放入 skin manifest 的 `slots` 層（最高優先級）。

### Step 5 — 輸出建議

建立一個 `_family-plan.json` 草稿（輸出至 `artifacts/ui-qa/{screenId}/family-plan.json`）：

```jsonc
{
  "screenId": "ShopMain",
  "resolvedAt": "2026-04-05",
  "primaryFamily": "dark-metal",
  "themeStack": { "base": "skin-base-v1", "family": "skin-family-dark-metal" },
  "zoneMap": [
    { "zoneId": "header",   "family": "dark-metal", "recipe": "dark-metal-v1", "status": "ready" },
    { "zoneId": "tab-bar",  "family": "tab",        "recipe": "tab-v1",        "status": "asset-pending" },
    { "zoneId": "item-grid","family": "item-cell",  "recipe": null,            "status": "asset-pending" }
  ],
  "skinManifestHints": {
    "id": "shop-main-default",
    "themeStack": { "base": "skin-base-v1", "family": "skin-family-dark-metal" }
  },
  "missingAssets": ["tab family skin", "item-cell family skin"],
  "readyForLayoutJson": true
}
```

---

## 品質門檻

- 每個 zone 必須有 `status`（ready / asset-pending / recipe-missing）
- 主要 family 必須有已建立的 skin family 檔案，否則 readyForLayout=false
- 若有 missingAssets，**必須記錄** 並在下一步通知 ui-asset-gen-director

---

## 下一步

- 若所有 zone status=ready → 進入 **ui-vibe-pipeline** 生成 layout + screen JSON
- 若有 asset-pending → 先進入 **ui-asset-gen-director** 準備資產委託
