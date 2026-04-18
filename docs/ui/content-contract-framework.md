<!-- doc_id: doc_ui_0039 -->
# Content Contract Framework — Phase F 架構草案

**版本**: v1.0  
**日期**: 2026-04-05  
**作者**: TechDirector  
**狀態**: 草案（Phase F 正式提案）  
**對應任務**: UI-2-0080

---

## 1. 為什麼需要 Content Contract？

### 1.1 現況分析

目前的 UI 量產管線已具備三層 JSON 契約（layout/skin/screen），但 AI Agent 在生成 screen spec 時，對「這個 screen 需要哪些內容欄位」沒有明確約束。常見的問題模式：

| 問題 | 範例 |
|------|------|
| 必要欄位缺失 | `dialog-card` screen 沒有 `primaryKey`（確認按鈕文字） |
| bind path 憑空出現 | layout 用了 `{unit.name}` 但 screen spec 未宣告此欄位 |
| 內容與結構不匹配 | 選了 `detail-split` family 但 `tabs` 是空陣列 |
| runtime 才發現 | 上述所有問題都在運行時才顯現，不在 build time |

Unity 對照：
- 現況 = `Instantiate(prefab)` 後直接用，沒有 `null` 檢查也沒有 required field 驗證
- 目標 = 等同 `[RequireComponent]` + `[SerializeField]` 的靜態約束系統

### 1.2 目標

讓 Agent 能在**生成 screen spec 的那一刻**，就知道這個 family 需要哪些欄位，並能被機器驗證。

---

## 2. 核心概念

### 2.1 三層對應關係（擴充後）

```
Layout Spec          ← 結構骨架（節點樹、版位）
Skin Manifest        ← 視覺映射（顏色、sprite、字型）
Screen Spec          ← 組裝單元（layout + skin + bundle）
  └─ contentRequirements: ContentContractRef ← ★ Phase F 新增
```

### 2.2 ContentContractRef（UISpecTypes.ts）

```typescript
interface ContentContractRef {
    schemaId: string;         // 對應 contracts/{schemaId}.schema.json
    familyId: string;         // 所屬 template family（kebab-case）
    requiredFields: string[]; // 最少必填欄位清單
}
```

### 2.3 ContentContractSpec（schema JSON）

每個 family 一份，存放於 `assets/resources/ui-spec/contracts/`：

```json
{
  "schemaId": "detail-split-content",
  "familyId": "detail-split",
  "version": 1,
  "description": "detail-split 家族的內容契約。適用於武將詳細資料、血脈命鏡等具有多分頁結構的詳情畫面。",
  "fields": {
    "titleKey": {
      "type": "i18n-key",
      "required": true,
      "description": "畫面標題的 i18n key"
    },
    "bodyKey": {
      "type": "i18n-key",
      "required": false,
      "description": "主要說明文字的 i18n key（可選）"
    },
    "tabs": {
      "type": "array",
      "required": true,
      "minItems": 2,
      "maxItems": 6,
      "description": "分頁設定，至少 2 個最多 6 個"
    },
    "defaultTab": {
      "type": "string",
      "required": false,
      "default": "0",
      "description": "預設選中的分頁 index（字串數字）"
    }
  },
  "bindPaths": {
    "titleKey": "header.title",
    "bodyKey": "content.body",
    "defaultTab": "tabs.activeIndex"
  }
}
```

### 2.4 UIContentBinder（新 TS 類別）

```typescript
class UIContentBinder {
    // 接收 contractRef + data，映射至 UITemplateBinder
    bind(
        binder: UITemplateBinder,
        contractRef: ContentContractRef,
        data: Record<string, unknown>
    ): void

    // 驗證必填欄位
    validate(
        contractRef: ContentContractRef,
        data: Record<string, unknown>
    ): { valid: boolean; missing: string[]; warnings: string[] }
}
```

---

## 3. 已落地的 Schema（v1.0）

### 3.1 detail-split-content

適用畫面：武將詳細資料、血脈命鏡、精銳兵典

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `titleKey` | i18n-key | ✅ | 畫面標題 |
| `bodyKey` | i18n-key | ❌ | 副標題或說明文字 |
| `tabs` | array | ✅ | 分頁定義（2~6個） |
| `defaultTab` | string | ❌ | 預設選中分頁 index，預設 "0" |

### 3.2 dialog-card-content

適用畫面：確認對話框、提示訊息框、選擇框

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `titleKey` | i18n-key | ✅ | 對話框標題 |
| `bodyKey` | i18n-key | ✅ | 主要訊息文字 |
| `primaryKey` | i18n-key | ✅ | 主要行動按鈕文字 |
| `secondaryKey` | i18n-key | ❌ | 次要按鈕文字（取消/忽略） |

### 3.3 rail-list-content

適用畫面：武將列表、商城商品列表、戰報條目列表

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `titleKey` | i18n-key | ✅ | 列表標題 |
| `railItems` | array | ✅ | 列表項目定義（至少 1 個） |
| `emptyStateKey` | i18n-key | ❌ | 空清單時顯示文字 |
| `sortOptions` | array | ❌ | 排序選項 |

### 3.4 fullscreen-result-content

適用畫面：結算畫面、獲得武將、抽卡結果

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `resultType` | enum | ✅ | win / lose / draw / acquire |
| `titleKey` | i18n-key | ✅ | 結果標題 |
| `descKey` | i18n-key | ✅ | 結果說明文字 |
| `confirmKey` | i18n-key | ❌ | 確認按鈕文字，預設 "confirm" |

---

## 4. 使用流程（Agent SOP）

### 4.1 新建 Screen Spec

```
1. 判定 template family（detail-split / dialog-card / rail-list / fullscreen-result）
2. 從 assets/resources/ui-spec/contracts/{family}-content.schema.json 查必填欄位
3. 在 screen spec 中填寫 contentRequirements：
   {
     "schemaId": "detail-split-content",
     "familyId": "detail-split",
     "requiredFields": ["titleKey", "tabs"]
   }
4. 確認 screen spec 中或 data binding 中所有 requiredFields 都有對應值
5. 跑 validate-ui-specs.js --check-content-contract
```

### 4.2 Panel onReady 使用 UIContentBinder

```typescript
protected async onReady(binder: UITemplateBinder): Promise<void> {
    const contentBinder = new UIContentBinder();

    const contractRef: ContentContractRef = {
        schemaId: 'detail-split-content',
        familyId: 'detail-split',
        requiredFields: ['titleKey', 'tabs'],
    };

    // 驗證 data 是否符合 contract
    const { valid, missing } = contentBinder.validate(contractRef, this._data);
    if (!valid) {
        console.warn(`[GeneralDetailPanel] content contract 缺少欄位: ${missing.join(', ')}`);
    }

    // 依 schema.fields[*].bindPath 映射欄位到 binder 路徑索引
    await contentBinder.bind(binder, contractRef, this._data);
}
```

  補充：`UITemplateBinder` 現在除了 `id/name` 綁定外，也支援 layout 相對路徑索引（例如 `InfoContent/HeaderRow/TitleLabel`）。
  因此 `UIContentBinder` 可直接讀 `contracts/*.schema.json` 中的 `bindPath`，把欄位值注入對應節點，而不是要求欄位名稱必須剛好等於 node id。

  目前已落地的 runtime 範例：
  - `GeneralDetailOverviewShell.ts` 會載入 `general-detail-bloodline-v3-screen` 的 `contentRequirements`
  - 文字欄位透過 `UIContentBinder + bindPath` 綁定
  - `awakeningProgress / rarityTier / portraitResource` 這類非純文字欄位，仍由元件保留自訂邏輯處理

---

## 5. 驗證工具擴充（UI-2-0083 前置）

`validate-ui-specs.js --check-content-contract` 執行以下檢查：

1. screen spec 中有 `contentRequirements` 的，驗證 `schemaId` 對應的 schema 存在
2. `requiredFields` 中所有欄位，schema 中均已定義
3. screen spec 中有 bind path 用的，必須已在 `requiredFields` 或 schema `fields` 中宣告
4. 如果 screen 的 family 有對應 schema，但 `contentRequirements` 未填，輸出 warn

---

## 6. 未來延伸

| 方向 | 說明 | 時程 |
|------|------|------|
| `UIContentBinder` 自動生成 `onReady` 樣板程式碼 | scaffold-ui-component 可根據 schema 直接產出 binder 骨架 | Phase F UI-2-0081 |
| Per-field runtime 型別驗證 | i18n-key 欄位在 runtime 查詢 i18n bundle 確認 key 存在 | Phase G |
| Schema versioning | schema 版本升級時，舊 screen spec 有 migration guide | Phase G |
| 跨 family content 繼承 | 例如 `battle-general-detail` 繼承 `detail-split-content` 並擴充 | Phase G |

---

## 7. 相關文件

- [docs/keep.md (doc_index_0011) §20](../keep.md (doc_index_0011)) (doc_index_0011) — Content Contract 強制規則
- [docs/keep.md (doc_index_0011) §21](../keep.md (doc_index_0011)) (doc_index_0011) — Screen → Component Scaffold 流程
- [assets/scripts/ui/core/UISpecTypes.ts](../../assets/scripts/ui/core/UISpecTypes.ts) — ContentContractRef 介面
- [assets/scripts/ui/core/UIContentBinder.ts](../../assets/scripts/ui/core/UIContentBinder.ts) — ContentBinder 實作
- [assets/resources/ui-spec/contracts/](../../assets/resources/ui-spec/contracts/) — Schema 定義
- [docs/agent-briefs/tasks/UI-2-0080.md (doc_task_0103)](../agent-briefs/tasks/UI-2-0080.md (doc_task_0103)) (doc_task_0103) — 實作任務
- [docs/agent-briefs/tasks/UI-2-0081.md (doc_task_0104)](../agent-briefs/tasks/UI-2-0081.md (doc_task_0104)) (doc_task_0104) — Scaffold 任務
