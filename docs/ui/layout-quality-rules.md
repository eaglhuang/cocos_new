<!-- doc_id: doc_ui_0044 -->
# Layout Quality Rules（嚴格模式規則說明）

> 使用 `node tools_node/validate-ui-specs.js --strict` 啟用。  
> 支援 `--skip-rule <ruleId>` 單條停用；個別 layout 可在 `validation.exceptions` 中聲明豁免。

---

## 使用方式

```bash
# 基本嚴格模式
node tools_node/validate-ui-specs.js --strict

# 跳過特定規則
node tools_node/validate-ui-specs.js --strict --skip-rule no-empty-container

# 同時啟用 content contract 驗證
node tools_node/validate-ui-specs.js --strict --check-content-contract
```

## 在 Layout JSON 中聲明豁免

```json
{
  "id": "my-layout",
  "validation": {
    "exceptions": {
      "no-empty-container": "ItemGrid 於執行期由腳本動態填充",
      "scroll-list-needs-itemTemplate": "DataList 的 itemTemplate 由外部注入"
    }
  },
  "root": { ... }
}
```

---

## 規則清單

### 結構類

| ID | 說明 | 預設閾值 |
|----|------|---------|
| `max-node-depth` | 節點巢狀深度上限 | ≤ 12 層 |
| `max-children-per-container` | 單一容器子節點數量上限 | ≤ 20 個 |
| `no-empty-container` | 容器類型節點不得既無子節點又無 skinSlot | — |
| `scroll-list-needs-itemTemplate` | `scroll-list` 類型節點必須宣告 `itemTemplate`（可為字串引用或 inline object） | — |

### 數值範圍類

| ID | 說明 | 預設閾值 |
|----|------|---------|
| `spacing-range` | `layout.spacing` 間距值範圍 | 0 ~ 200 px |
| `font-size-range` | `fontSize` 字體大小值範圍 | 10 ~ 96 px |
| `widget-border-valid` | `widget` 所有數值必須為整數 | — |
| `alpha-range` | `alpha` 透明度值範圍 | 0 ~ 255 |
| `opacity-range` | `opacity` 不透明度值範圍 | 0.0 ~ 1.0 |

### 家族專屬類

| ID | 適用家族 | 說明 | 閾值 |
|----|---------|------|------|
| `dialog-max-cta` | `dialog-card` | button-group 容器內 button 類型節點數量上限 | ≤ 2 個 |
| `rail-list-min-items` | `rail-list` | scroll-list 節點的 `railItems` 最低數量 | ≥ 1 |
| `detail-split-tab-count` | `detail-split` | tab-bar 節點的子節點（tab 頁籤）數量範圍 | 2 ~ 6 |

> 家族識別：layout `id` 前綴為 `dialog-card-`、`rail-list-`、`detail-split-` 時觸發對應規則。

### 資料綁定類

| ID | 說明 | 嚴重性 |
|----|------|--------|
| `content-contract-requiredFields` | Screen 的 `contentRequirements.requiredFields` 須對應 contract schema 中定義的欄位，且 content state 中必須存在這些欄位 | ❌ 錯誤（需搭配 `--check-content-contract` 或 `--strict`） |
| `bind-path-declared` | 僅當 screen 已宣告 `content` / `contentRequirements` 時，Layout 的 `bind` 根欄位必須在 `requiredFields` 中 | ⚠️ 告警 |
| `no-dynamic-bind` | 不允許 `bind: "dynamic"` 的動態綁定宣告 | ❌ 錯誤 |

### 視覺品質類

| ID | 說明 |
|----|------|
| `nine-slice-border-not-zero` | 節點的 `nineSlice.border` 不得全為 `[0, 0, 0, 0]` |
| `skin-slot-references-exist` | 節點 `skinSlot` 值必須能在任一 skin 的 `slots` 中找到對應 key |

---

## 豁免範例（現有佈局）

以下佈局已在 `validation.exceptions` 中聲明豁免：

| 佈局 | 豁免規則 | 原因 |
|------|---------|------|
| `deploy-panel-main` | `no-empty-container` | GhostImage 為執行期動態填充容器 |
| `gacha-preview-main` | `no-empty-container` | TopSpacer 為純間距容器，意圖為空 |
| `general-list-main` | `scroll-list-needs-itemTemplate` | DataList 的 itemTemplate 由腳本動態設定 |
| `shop-main-main` | `no-empty-container` | ItemGrid 為執行期動態填充容器 |
| `unit-info-panel-main` | `no-empty-container` | TraitTags/AbilityList 為執行期動態填充容器 |

---

## 規則設定檔

全域閾值與家族覆蓋設定在 `assets/resources/ui-spec/validation-rules.json`，供文件參考用（目前驗證器使用硬編碼閾值）。

---

*最後更新：UI-2-0083 Phase F*
