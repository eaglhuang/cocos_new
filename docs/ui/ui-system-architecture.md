# UI 系統技術架構

> 更新日期: 2026-04-10
> 3KLife / Cocos Creator 3.8.8 / TypeScript ES2015

## 1. 架構全景

```
┌─ Screen JSON ──────────────────────────────────────────┐
│  uiId + canvas + layoutRef + skinRef + contentContract │
└────┬──────────────────────────┬────────────────────────┘
     │                          │
┌────▼───────────────┐  ┌──────▼──────────────────────┐
│  Layout JSON       │  │  Skin Manifest              │
│  (結構 + widget)   │  │  (slot → sprite/style)      │
│  ↕ $ref fragments  │  │  ↕ $fragments + themeStack  │
└────┬───────────────┘  └──────┬──────────────────────┘
     │                          │
     ▼                          ▼
UISpecLoader ── cache ── $ref 遞迴展開 ── themeStack 層疊
     │
     ▼
UIPreviewBuilder（指揮者）
  ├─ UIPreviewNodeFactory    → 建立 Cocos Node
  ├─ UIPreviewStyleBuilder   → 套 Sprite/Label/Button 樣式
  ├─ UIPreviewLayoutBuilder  → 解算 Widget/Layout
  ├─ UIPreviewShadowManager  → 五層裝飾框體
  └─ UISkinResolver          → slot → 資產路徑
     │
     ▼
UIContentBinder ← Content Contract Schema
UITemplateBinder ← data → node bindPath
```

## 2. 三層 JSON Spec 系統

| 層 | 目錄 | 職責 | 改動影響 |
|----|------|------|----------|
| **Layout** | `ui-spec/layouts/` | 結構（node tree + widget + layout constraints） | 節點結構改變 → Panel bindPath 需同步 |
| **Skin** | `ui-spec/skins/` | 外觀（slot → spriteFrame/color/style） | 只影響視覺，不影響結構 |
| **Screen** | `ui-spec/screens/` | 組裝（canvas + layout ref + skin ref） | 只影響畫面配置組合 |

**解耦效益**：換皮層不改結構層；改結構不需動外觀；新畫面只需新 screen JSON。

## 3. $ref Fragment 組合系統

### 3.1 Layout Fragments

位於 `ui-spec/fragments/layouts/`，透過 `$ref` 引用：
```json
{ "$ref": "fragments/layouts/gdv3-header-row" }
```

**Merge 語意**：`{ ...fragment, ...node }` — node 端屬性勝出，fragment 作為 fallback。

**不可變欄位**：`type` 為 immutable，node 不得覆寫（`no-override-immutable` 規則）。

### 3.2 Widget Fragments

位於 `ui-spec/fragments/widgets/`，12 個原子元件。

**統一索引**：`fragments/widget-registry.json`，Agent 讀此檔即可查表所有可用元件。

分類：
- **action**: button-bar, close-button
- **container**: dialog-card, scroll-panel
- **header**: header-rarity-plaque, panel-header
- **display**: hp-bar, resource-display, stat-row
- **content**: text-body
- **overlay**: overlay-mask
- **feedback**: toast

### 3.3 Skin Fragments

透過 `$fragments` 陣列 + themeStack 四層合併：
```
base → family → stateOverrides → manifest（後者覆寫前者）
```

## 4. Design Token 系統

`ui-design-tokens.json`：100+ color token + rarity palette + typography。

- Skin slot reference token key → 改一處全域生效
- 禁止 hex 硬編碼（強制走 token）

## 5. Content Contract 系統

- `contracts/*.schema.json`：定義 `requiredFields` + `bindPath`
- `UIContentBinder`：驗證 data ↔ contract 一致性
- `UITemplateBinder`：data → node 綁定

## 6. Recipe 系統（Phase G）

| Recipe 類型 | 職責 |
|------------|------|
| FrameRecipe | 五層框體（frame/bleed/shadow/fill/ornament）|
| ArtRecipe | AI 資產來源追蹤（prompt/seed/tool/approval）|
| MaterialRecipe | 材質/紋理/金屬感 |

7 frame families × 5 states → compact themeStack。

## 7. Runtime Pipeline

| 元件 | 職責 | Unity 對照 |
|------|------|-----------|
| `UISpecLoader` | 載入 + cache + $ref 遞迴展開 + themeStack | AssetBundle Loader |
| `UIPreviewBuilder` | 指揮者，遞迴建立 node tree | Canvas Builder |
| `UIPreviewNodeFactory` | 按 type 建立 Cocos Node | Prefab Instantiation |
| `UIPreviewStyleBuilder` | 套 Sprite/Label/Button 樣式 | Material Override |
| `UIPreviewLayoutBuilder` | Widget + Layout 解算 | RectTransform + LayoutGroup |
| `UIPreviewShadowManager` | 五層裝飾框體同步 | Shadow Rendering |
| `UISkinResolver` | slot → 資產路徑解析 | Addressables |
| `UIContentBinder` | 驗證 data ↔ contract | Data Binding Validator |
| `UITemplateBinder` | data → node 文字/圖標綁定 | MVVM Binder |

## 8. 驗證 & 自動化工具

| 工具 | 職責 |
|------|------|
| `validate-ui-specs.js` | R1-R18 品質規則 + $ref immutable guard |
| `validate-widget-registry.js` | Widget registry ↔ 實際檔案同步 |
| `build-fragment-usage-map.js` | $ref 引用地圖（修改前查影響範圍）|
| `scaffold-ui-spec-family.js` | 自動產生 layout/skin/screen 三件套 |
| `scaffold-ui-component.js` | 自動產生 Panel .ts + UIConfig stub |
| `check-encoding-touched.js` | UTF-8 完整性驗證 |

## 9. 檔案總覽

### Runtime Core（9 檔）
- `assets/scripts/ui/core/UISpecLoader.ts`
- `assets/scripts/ui/core/UISpecTypes.ts`
- `assets/scripts/ui/core/UIPreviewBuilder.ts`
- `assets/scripts/ui/core/UIPreviewNodeFactory.ts`
- `assets/scripts/ui/core/UIPreviewStyleBuilder.ts`
- `assets/scripts/ui/core/UIPreviewLayoutBuilder.ts`
- `assets/scripts/ui/core/UIPreviewShadowManager.ts`
- `assets/scripts/ui/core/UISkinResolver.ts`
- `assets/scripts/ui/core/UIPreviewDiagnostics.ts`

### Content Binding（2 檔）
- `assets/scripts/ui/core/UIContentBinder.ts`
- `assets/scripts/ui/core/UITemplateBinder.ts`

### Spec Resources
- `ui-spec/layouts/` — 28+ layout 階層
- `ui-spec/screens/` — 26+ screen 組裝
- `ui-spec/skins/` — 31+ skin manifest
- `ui-spec/fragments/layouts/` — 7+ layout fragment
- `ui-spec/fragments/widgets/` — 12 widget fragment
- `ui-spec/contracts/` — 6 content contract
- `ui-spec/recipes/families/` — 7 frame family
