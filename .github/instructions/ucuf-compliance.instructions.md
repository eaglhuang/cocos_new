---
doc_id: doc_ai_0019
applyTo: "assets/scripts/ui/**"
---

# UCUF CompositePanel 合規指令

本檔定義在 `assets/scripts/ui/**` 下開發 UI Panel 時必須遵守的 UCUF（Universal Composite UI Framework）架構規範。

目前專案仍處於 legacy `UIPreviewBuilder` → `CompositePanel` 遷移期，因此本指令的強制對象以**新建 Panel**與**正在遷移中的 Panel**為主；既有 legacy panel 若尚未遷移，需維持相容並在變更中避免擴散新依賴。

## 1. 新 Panel 必須繼承 CompositePanel

❌ 禁止：
```typescript
export class MyPanel extends UIPreviewBuilder { ... }
export class MyPanel extends Component { ... }
```

✅ 正確：
```typescript
import { CompositePanel } from '../core/CompositePanel';

export class MyPanel extends CompositePanel { ... }
```

**例外**：
- 輕量工具型 Panel（無 lazySlot、無 Content Contract）可繼承 `UIPreviewBuilder`。
- 已存在且尚在遷移中的 legacy panel 可暫時保留 `UIPreviewBuilder`，但不得新增新的 runtime 依賴面。
- 需先在 PR 評審中說明例外理由。

## 2. 必須附帶 Content Contract

每個繼承 `CompositePanel` 的 Panel 必須：
1. 聲明 `CONTRACT: ContentContractRef` 常數（見 `UISpecTypes.ts`）
2. 對應的 `{screenId}-content.schema.json` 必須存在於 `assets/resources/ui-spec/contracts/`

使用 scaffold 自動生成：
```bash
node tools_node/scaffold-ui-component.js --ucuf --screen {screenId}
```

## 3. dataSource 必須在 ChildPanel 聲明

`ChildPanelBase` 子類操作資料時，必須透過父類 `applyContentState(state)` 流程，不得自行從外部讀取。

❌ 禁止：
```typescript
// 直接在 Panel 子類操作外部資料
const data = await cc.resources.load('some/data');
```

✅ 正確：
```typescript
// 由 CompositePanel 驅動，在 ChildPanel.onDataUpdate() 中接收資料
public override onDataUpdate(data: unknown): void {
    const state = data as MyContentState;
    // 使用 state 更新 UI
}
```

## 4. 禁止在 CompositePanel 子類直接 import cc.resources

`CompositePanel` 子類（即頂層 Panel）的資料載入必須透過 `services()` 管理器，不得直接呼叫 `cc.resources`。

❌ 禁止：
```typescript
import { resources } from 'cc';

export class MyPanel extends CompositePanel {
    async load() {
        const data = await new Promise(r => resources.load('...', r));
    }
}
```

✅ 正確：
```typescript
export class MyPanel extends CompositePanel {
    async load() {
        const data = await services().dataLoader.load('...');
    }
}
```

## 5. lazySlot 必須宣告 defaultFragment

Layout JSON 中 `lazySlot: true` 的節點必須宣告 `defaultFragment`，否則 `validate-ui-specs --strict` 將報 **R26 lazy-slot-has-fragment** 警告。

```json
{
  "name": "SlotMain",
  "type": "container",
  "lazySlot": true,
  "defaultFragment": "general-overview-fragment"
}
```

## 6. tabRouting 完整性

Screen JSON 中的 `tabRouting` 每個 route 必須：
- `slotId` 對應 layout 中已存在的 `lazySlot: true` 節點名稱
- `fragment` 對應 `layouts/` 或 `fragments/` 中已存在的 JSON 檔案

違反時 `validate-ui-specs --strict` 將報 **R28 composite-panel-tab-route-integrity** 警告。

## 7. 單邊 Widget 錨點必須搭配 safeAreaConstrained（R29）

**背景**：Cocos Creator FIXED_HEIGHT 解析度策略下，在寬螢幕瀏覽器中，Canvas 節點的實際寬度
（如 3063px）會超過設計解析度（1920px）。當 CompositePanel 的宿主節點尺寸繼承 Canvas 全寬，
Widget 的 `left:0` 或 `right:X` 就會以 3063px 為基準計算座標，將面板推到設計可視範圍外——
在 Editor 中因恰好為 1920px 而正常，部署到瀏覽器後卻消失。

**規則**：Layout JSON 的 root 節點如果 widget 只有 `left`（無 `right`）或只有 `right`（無 `left`），
**必須**在 `canvas` 區段加入 `"safeAreaConstrained": true`。

❌ 違規（R29 warning）：
```json
{
  "canvas": { "designWidth": 1920, "designHeight": 1080 },
  "root": {
    "name": "TigerTallyRoot",
    "widget": { "top": 144, "left": 0, "bottom": 0 }
  }
}
```

✅ 正確：
```json
{
  "canvas": {
    "designWidth": 1920,
    "designHeight": 1080,
    "safeAreaConstrained": true
  },
  "root": {
    "name": "TigerTallyRoot",
    "widget": { "top": 144, "left": 0, "bottom": 0 }
  }
}
```

**Runtime 效果**：`CompositePanel.mount()` 在 `buildScreen` 完成後偵測到 `canvas.safeAreaConstrained: true`，
會在宿主節點（如 `TigerTallyPanel`）與 layout root 之間插入一個 `__safeArea` 中介節點
（`UITransform = designWidth × designHeight`，`localPos = 0,0`，無 Widget），
使 layout root 的 Widget 計算以 1920px 的 `__safeArea` 為基準，而非 Canvas 的擴展寬度（3063px）。

> **注意**：不可改用 `Widget.AlignMode.ONCE` 或直接呼叫 `setContentSize` 在宿主，
> 因為 Cocos Widget `_setDirty()` 機制會讓 ONCE-mode Widget 在父節點 UITransform 改變時依然重算。
> 插入固定大小的 `__safeArea` 中介節點是目前唯一可靠的修法。

**例外**：
- widget 同時有 `left` AND `right`（撐滿父容器，不需要限定寬度）→ 不需要 `safeAreaConstrained`。
- 只有 `top` / `bottom`（純垂直錨點）→ 不需要 `safeAreaConstrained`。
- 宿主節點有 Inspector 絑定的固定 UITransform（已知寬度 = 1920px）→ 可在 `validation.exceptions` 中豁免。

## 驗證指令

```bash
# 全量驗證（含 R26~R29）
node tools_node/validate-ui-specs.js --strict

# 僅驗證特定規則
node tools_node/validate-ui-specs.js --strict --rules lazy-slot-has-fragment,composite-panel-tab-route-integrity,layout-root-edge-anchor-needs-safe-parent
```

---

## 強制規則違反確認流程（Agent 必須執行）

> ⚠️ **BLOCKING REQUIREMENT — 適用所有 Agent**
>
> 任何對 `assets/scripts/ui/**` 下檔案完成修改後，**在宣告任務完成之前**，Agent **必須**依序執行以下驗證步驟，不得跳過：

### 步驟 1：靜態規格驗證

```bash
node tools_node/validate-ui-specs.js --strict
```

- 預期：`0 failures`（warnings 可視情況允許，但必須說明）
- 若有 failure：**必須修復後才能繼續**，不得略過

### 步驟 2：任務卡規則驗證（若本次工作有對應任務卡）

```bash
node tools_node/validate-ucuf-task-card.js --card <task-card-path> --strict
```

- 預期：`exit 0`（0 errors）
- 若有 R-TC-01~R-TC-10 violation：**必須修復後才能繼續**

### 步驟 3：UCUF 測試套件

```bash
node node_modules\ts-node\dist\bin.js --project tsconfig.test.json tests/run-ucuf-only.ts
```

- 預期：`0 failed`（skipped 可接受）
- 若有 test failure：**必須修復後才能繼續**

### 步驟 4：編碼完整性（若有修改 .ts / .md / .json 檔案）

```bash
node tools_node/check-encoding-integrity.js <修改的檔案列表>
```

- 預期：無 BOM / 無 U+FFFD / 無 mojibake 警告

### 違規確認結果格式

完成以下驗證後，Agent 必須在回覆中附上以下摘要：

```
✅ validate-ui-specs --strict: 0 failures, N warnings
✅ validate-ucuf-task-card: 0 errors (或 N/A)
✅ UCUF tests: X passed, Y skipped, 0 failed
✅ encoding-integrity: clean
```

若任何步驟失敗，Agent **不得**呼叫 `task_complete`，必須先修復。
