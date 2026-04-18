---
doc_id: doc_ai_0020
description: UCUF CompositePanel 新畫面標準開發流程（M10 scaffold v2）
---

# UCUF 開發 Workflow（ucuf-develop）

此 workflow 用於使用 M10 scaffold v2 開發新的 UCUF CompositePanel 畫面。
適用場景：任何具有多個 lazySlot 子區域、按需載入 Fragment 的複合 UI 畫面。

## 前置條件

- M9 架構治理完善已完成（`CompositePanel.ts` + `ChildPanelBase.ts` + `EventSystem`）
- 目標畫面已有 proof-contract 或 screen brief
- `node tools_node/validate-ui-specs.js` 在現有代碼上通過（0 failures）

---

## Phase A：Brief 分析

### A1. 讀取 Screen Brief

```bash
# 讀取現有 screen spec（如已存在）
cat assets/resources/ui-spec/screens/{screenId}.json
# 讀取 proof-contract（如存在）
cat assets/resources/ui-spec/proof-contracts/{screenId}-proof.json
```

確認以下資訊：
- Screen ID（`{screenId}`）
- 預計 lazySlot 數量與名稱
- Tab 結構（若有 `tabRouting`）
- Content Contract 必填欄位

### A2. 讀取 keep.summary.md 確認架構共識

```bash
# 讀取精簡架構共識
cat docs/keep.summary.md
```

---

## Phase B：Scaffold 生成骨架

### B1. 執行 scaffold --ucuf

```bash
# dry-run 預覽
node tools_node/scaffold-ui-component.js --ucuf --screen {screenId} --dry-run

# 確認無誤後實際生成
node tools_node/scaffold-ui-component.js --ucuf --screen {screenId}
```

生成物列表：
- `assets/scripts/ui/components/{ClassName}Panel.ts` — CompositePanel 骨架
- `assets/resources/ui-spec/contracts/{screenId}-content.schema.json` — Content Contract

### B2. 建立 Screen / Layout JSON（若尚未存在）

Screen JSON 最小範例（`assets/resources/ui-spec/screens/{screenId}.json`）：
```json
{
  "id": "{screenId}",
  "layout": "{screenId}-layout",
  "skin": "{screenId}-skin",
  "tabRouting": {
    "TabA": { "slotId": "SlotA", "fragment": "{fragmentId}" }
  },
  "contentRequirements": {
    "schemaId": "composite-panel-content",
    "familyId": "composite-panel",
    "requiredFields": ["titleKey", "tabs"]
  }
}
```

Layout JSON 最小範例（包含 lazySlot）：
```json
{
  "id": "{screenId}-layout",
  "canvas": { "designWidth": 1920, "designHeight": 1080 },
  "root": {
    "type": "container",
    "name": "Root",
    "children": [
      {
        "name": "SlotA",
        "type": "container",
        "lazySlot": true,
        "defaultFragment": "{fragmentId}"
      }
    ]
  }
}
```

---

## Phase C：實作業務邏輯

### C1. 建立 ChildPanel 子類

每個 lazySlot 需要一個 `ChildPanelBase` 子類：

```typescript
// assets/scripts/ui/components/{screenId}/{SlotName}Child.ts
import { ChildPanelBase } from '../../core/ChildPanelBase';
import type { UITemplateBinder } from '../../core/UITemplateBinder';

export class {SlotName}Child extends ChildPanelBase {
    protected override onDataUpdate(data: unknown): void {
        const state = data as { /* 欄位型別 */ };
        // 更新 UI 節點
    }
}
```

### C2. 在 Panel 的 `_onAfterBuildReady` 登記 ChildPanel

```typescript
protected override _onAfterBuildReady(binder: UITemplateBinder): void {
    this.registerChildPanel('SlotA', new SlotAChild());
    // 綁定靜態按鈕事件
    const btnClose = binder.getButton('BtnClose');
    btnClose?.node.on('click', () => services().ui.close('{screenId}'), this);
    // 分頁切換
    // binder.getButton('BtnTabA')?.node.on('click', () => this.switchTab('TabA'), this);
}
```

### C3. 接線 Content Binder

確保 `show()` 方法傳入的 `data` 與 Content Contract `requiredFields` 一致：

```typescript
public async show(data: MyContentState): Promise<void> {
    if (!this._isMounted) {
        await this.mount('{ClassName}Panel.SCREEN_ID');
        this._isMounted = true;
    }
    this.node.active = true;
    await this.applyContentState(data as Record<string, unknown>);
}
```

---

## Phase D：驗證（⚠️ BLOCKING — 必須全部通過才能結案）

> 以下 D1~D4 四步驟為強制執行項目，**任何步驟失敗都必須修復後才能宣告完成**。

### D1. 執行 validate-ui-specs

```bash
node tools_node/validate-ui-specs.js --strict
```

確認 0 failures：
- R26（lazy-slot-has-fragment）：lazySlot 有 defaultFragment
- R27（dataSource-declared）：所有 dataSource 在 requiredFields 中
- R28（composite-panel-tab-route-integrity）：tabRouting slotId + fragment 均有效

### D2. 執行單元測試

```bash
node node_modules\ts-node\dist\bin.js --project tsconfig.test.json tests/run-ucuf-only.ts
```

預期：`0 failed`

若有任務卡，也要執行：
```bash
node tools_node/validate-ucuf-task-card.js --card <task-card-path> --strict
```

### D3. Cocos Editor 視覺驗收

```bash
# 刷新資產
curl.exe http://localhost:7456/asset-db/refresh
# 截圖（使用 cocos-screenshot skill）
```

### D4. 編碼完整性

```bash
node tools_node/check-encoding-integrity.js <本次修改的檔案>
```

### D5. 違規確認摘要（必填）

在 Agent 最終回覆中附上：

```
✅ validate-ui-specs --strict: 0 failures, N warnings
✅ validate-ucuf-task-card: 0 errors (或 N/A)
✅ UCUF tests: X passed, Y skipped, 0 failed
✅ encoding-integrity: clean
```

---

## 相關文件

- [ucuf-verify.md](.agents/workflows/ucuf-verify.md) — 快速驗證 workflow
- [ucuf-compliance.instructions.md](.github/instructions/ucuf-compliance.instructions.md) — 合規規則
- `docs/UCUF里程碑文件.md` — 里程碑進度追蹤
