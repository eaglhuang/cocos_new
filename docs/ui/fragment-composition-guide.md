# Fragment 組合指南

> 更新日期: 2026-04-10

## 1. 什麼是 Fragment？

Fragment 是可重用的 JSON 結構片段，透過 `$ref` 引用嵌入到 Layout 或其他 Fragment 中。

**目的**：DRY 原則 — 同一組件只維護一份定義。

## 2. Fragment 類型

| 類型 | 目錄 | 用途 |
|------|------|------|
| Layout Fragment | `fragments/layouts/` | 較大的結構區塊（header row、stat panel 等）|
| Widget Fragment | `fragments/widgets/` | 原子級可重用元件（button、dialog、bar 等）|

## 3. $ref 引用語法

### 3.1 純引用（最常見）
```json
{
  "children": [
    { "$ref": "fragments/widgets/close-button" }
  ]
}
```
效果：該位置完全被 `close-button.json` 的內容取代。

### 3.2 Override 引用（覆寫部分屬性）
```json
{
  "children": [
    {
      "$ref": "fragments/widgets/stat-row",
      "name": "atk-stat-row",
      "widget": { "left": 20, "right": 20 }
    }
  ]
}
```
效果：以 fragment 為基底，node 端的 `name` 和 `widget` 覆寫 fragment 的同名屬性。

### 3.3 Merge 語意

```
resolved = { ...fragment, ...node }
delete resolved.$ref
```

- **node 勝出**：node 端同名屬性永遠覆寫 fragment
- **$ref 移除**：合併後 `$ref` 本身被刪除
- **children 不合併**：若 node 有 `children`，完全取代 fragment 的 `children`

### 3.4 不可變欄位（Immutable Keys）

以下欄位受保護，node 不得宣告不同值：

| 欄位 | 原因 |
|------|------|
| `type` | 改變 type 會導致 NodeFactory 誤判節點類型 |

靜態檢查：`validate-ui-specs.js --strict` 規則 `no-override-immutable`
運行時防護：`UISpecLoader._resolveLayoutRefs()` 在 merge 前警告

## 4. Layout Fragment 撰寫規範

### 命名
```
<screen-prefix>-<section-name>.json
例: gdv3-header-row.json, gdv3-stat-panel.json
```

### 結構
- 頂層應有 `type`、`name`、`children`
- 允許有自己的 `$ref` 引用（遞迴展開）
- 可以包含 `widget`、`layout`、`skin` 等屬性

### 範例
```json
{
  "type": "container",
  "name": "gdv3-header-row",
  "widget": { "top": 0, "left": 0, "right": 0 },
  "height": 120,
  "children": [
    { "$ref": "fragments/widgets/header-rarity-plaque" },
    { "type": "label", "name": "name-label", "fontSize": 36 }
  ]
}
```

## 5. Widget Fragment 撰寫規範

### 統一索引
所有 widget 必須登記在 `fragments/widget-registry.json`。

### 維護流程
1. 新增/刪除 widget JSON → 同步更新 `widget-registry.json`
2. 執行 `node tools_node/validate-widget-registry.js` 確認一致

### 結構
- 頂層 `type` 必填（如 `container`、`button` 等）
- `name` 必填，使用 widget 語意名（如 `close-button`、`hp-bar`）
- 建議提供 `slot` 或 `params` 說明可客製化的位置

## 6. 修改前必做

修改 **任何 fragment** 前：
```bash
node tools_node/build-fragment-usage-map.js --query fragments/layouts/gdv3-header-row
```
確認影響範圍，避免破壞其他畫面。

## 7. 常見錯誤

| 錯誤 | 解法 |
|------|------|
| `$ref` 路徑打錯 | validate-ui-specs 會報 `$ref` 解析失敗 |
| 覆寫 `type` | 移除 node 端的 `type` 宣告 |
| 忘記更新 registry | 跑 `validate-widget-registry.js` 會報 orphan |
| Fragment 內使用絕對路徑 | 一律用相對於 `ui-spec/` 的路徑 |
