---
doc_id: doc_agentskill_0025
name: ui-family-architect
description: 'UI Family 架構師 SKILL — 讀取 proof draft，為每個 visualZone 分配 structural family、themeStack 與 recipe seed，驗證 family 可用性，輸出 family-map 與 recipe 預填欄位。USE FOR: 在 ui-reference-decompose 完成後，進行 family 分派、family-map 產出與 recipe 選擇（UI pipeline Step 2）。DO NOT USE FOR: 直接產生 layout skeleton 或 asset 任務（需先完成此步）。'
argument-hint: '提供 proof draft 路徑（或 screenId），以及設計風格偏好（水墨戰國 / 明亮 / 特殊），並說明是否要直接輸出 family-map。'
---

# UI Family Architect

這是 UI production pipeline 的**第 2 步**：讀取 proof draft，決定每個 zone 的 family + recipe 組合。

Unity 對照：相當於 Scene Assembly — 決定每個 Prefab 要套哪個 Material Variant。

---

## 輸入

| 項目 | 說明 |
|---|---|
| `proofDraftPath` | `assets/resources/ui-spec/proof/screens/{screenId}.proof.json` |
| （可選）`themeOverride` | 強制指定 base skin（預設：`skin-base-v1`） |

## 輸出

1. `artifacts/ui-source/{screenId}/proof/{screenId}.family-map.json`
2. proof draft 中 family / notes / unresolved 欄位的補齊建議
3. normalized recipe 需要的 family、themeStack、asset readiness 預填值

---

## 執行步驟

### Step 1 — 讀取 proof draft

```
read_file { filePath: "assets/resources/ui-spec/proof/screens/{screenId}.proof.json" }
```

在 `visualZones` 列表中找出每個 zone 的候選 family、component intent 與 unresolved notes。

### Step 2 — 驗證 family 可用性

先判定 structural family 是否屬於既有 UCUF family：
- `detail-split`
- `dialog-card`
- `rail-list`
- `hud-overlay`
- `peek-drawer`

再確認對應的 skin family 與 recipe 是否存在，缺的部分標記為 `asset-pending` 或 `recipe-missing`，不要硬寫死人工作業對象。

### Step 3 — 補齊 recipe seed

對 proof draft 中尚未決定的欄位，補齊：
- structural family recommendation
- `themeStack` 預設值
- `assetReadiness`（ready / asset-pending / recipe-missing）
- recipe 需要的 unresolved questions

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
其他 family 的 slot 直接記錄到 family-map 的 `zoneMap` 與後續 recipe / skin 提示層。

### Step 5 — 輸出建議

建立一個 `family-map.json` 草稿（輸出至 `artifacts/ui-source/{screenId}/proof/{screenId}.family-map.json`）：

```jsonc
{
  "screenId": "shop-main",
  "resolvedAt": "2026-04-05",
  "primaryFamily": "rail-list",
  "themeStack": { "base": "skin-base-v1", "family": "skin-family-dark-metal" },
  "zoneMap": [
    { "zoneId": "header", "family": "rail-list", "frameFamily": "dark-metal", "status": "ready" },
    { "zoneId": "toolbar", "family": "rail-list", "frameFamily": "tab", "status": "asset-pending" },
    { "zoneId": "preview", "family": "detail-split", "frameFamily": "parchment", "status": "ready" }
  ],
  "recipeSeed": {
    "screenId": "shop-main",
    "familyId": "rail-list",
    "bundle": "lobby_ui",
    "layer": "Normal"
  },
  "missingAssets": ["toolbar tab family skin"],
  "unresolvedQuestions": ["preview 區是否需要 special slot"],
  "readyForRecipe": false
}
```

---

## 品質門檻

- 每個 zone 必須有 `status`（ready / asset-pending / recipe-missing）
- `family-map` 必須能說清楚 primary family、themeStack 與 unresolved questions
- 若有 missingAssets，**必須記錄** 並在下一步交給 ui-asset-gen-director

---

## 下一步

- 若 unresolvedQuestions 非空 → 先跑 `node tools_node/compile-proof-to-mcq.js`
- 若 MCQ 已回答 → 跑 `node tools_node/compile-mcq-answer-to-recipe.js`
- 若所有 zone status=ready 且 recipe 已齊 → 進入 **ui-vibe-pipeline** 或 recipe compiler
- 若有 asset-pending → 先進入 **ui-asset-gen-director** 準備資產任務
