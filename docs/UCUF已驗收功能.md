<!-- doc_id: doc_other_0005 -->
# UCUF 已驗收功能索引

> 版本：1.0 | 最後更新：2026-04-15
>
> 本文件列出 UCUF（通用複合 UI 框架）中**可立即使用**的功能，
> 分為「完整驗收」（含 runtime 或等效 stub 驗證）與「代碼驗收待 runtime」兩類。
>
> 相關文件：
> - [UCUF里程碑文件.md](UCUF里程碑文件.md) (doc_ui_0025) — 完整計畫與驗收數據
> - [UCUF技術文件.md](UCUF技術文件.md) (doc_tech_0017) — 框架原理與架構
> - [UCUF規範文件.md](UCUF規範文件.md) (doc_ui_0026) — 協作規則與標準流程

---

## 驗收狀態速查

| 里程碑 | 功能群 | 狀態 | 測試覆蓋 | 可用於生產 |
|--------|--------|------|---------|-----------|
| M1 | skinLayers / composite-image / Lint R19-R24 | ✅ 完整驗收 | 10 tests | ✅ |
| M2 | CompositePanel / ChildPanelBase / AttributePanel | ✅ 完整驗收 | 22 tests | ✅ |
| M3 | GridPanel / ScrollListPanel / RadarChartPanel / ProgressBarPanel | ✅ 完整驗收 | 69 tests 含 runtime smoke | ✅ |
| M4 | GeneralDetailComposite 遷移（7 Tab Fragment） | ⚠️ 程式碼驗收 | runtime smoke 通過 | ✅（量化指標待補） |
| M5 | UCUFLogger / RuntimeRuleChecker / DataBindingValidator | ✅ 完整驗收（stub） | 278 total passing | ✅ |
| M6 | AssetRegistry / ucuf-screenshot-regression / Layer 2 測試標記 | ✅ 完整驗收（stub） | — | ✅ |
| M7 | I18n 注入 / EditableTextPanel / validateDataFormat 全子類 | ✅ 完整驗收（stub） | 278 total passing | ✅ |
| M8 | UINodePool / forceRelease / onAssetEvicted 閉環 | ⚠️ 代碼驗收 | eviction stub：7 tests | 代碼可用；效能指標待 runtime |
| M9 | scope 管理 / Fragment 快取 / specVersion 降級 | ⚠️ 代碼驗收 | spec degradation： 8 tests | 代碼可用；動畫目視待 runtime |
| M10 | scaffold --ucuf / Lint R25-R28 / ucuf-compliance | ✅ 完整驗收（stub） | CLI 測試 R25~R28 全綠 | ✅ |
| M11 | UCUFRuleRegistry / ucuf-conflict-detect / Gate Report / validate-ucuf-task-card | ✅ 完整驗收（stub） | 15 CLI tests | ✅ |
| M12 | scan-deprecated-refs / _deprecated 清理 | 🔄 持續進行 | — | 工具可用 |

> **說明**
> - **完整驗收**：所有驗收規則均有實際量測數據或等效 stub 測試佐證。
> - **代碼驗收**：邏輯已確認正確（單元/整合測試 PASS），但部分量化指標（效能、視覺）需 Cocos Editor Preview 才能填入。
> - **待 runtime 確認**：M4 截圖 diff、M8 效能 budget、M9 過渡動畫；見文末「尚待 runtime 驗收」章節。

---

## 一、核心框架 API（M1 + M2，✅）

### 1.1 CompositePanel

繼承 `UIPreviewBuilder`，是所有 UCUF 複合 Panel 的抽象基類。

**路徑**：`assets/scripts/ui/core/CompositePanel.ts`

```typescript
// 掛載：載入 Screen JSON → 建構節點樹 → 載入 defaultFragment
await myPanel.mount('my-screen-id');

// 切換 Slot（指定 fragmentId）
await myPanel.switchSlot('contentSlot', 'tab-stats');

// 切換 Tab（用 tabRouting key）
await myPanel.switchTab('stats');

// 下發資料到所有 ChildPanel
myPanel.applyContentState({ attributes: [...], overview: {...} });

// 卸載：所有 ChildPanel.onUnmount + 清空 Map
myPanel.unmount();

// 取得子面板
const attr = myPanel.getChildPanel<AttributePanel>('attributePanel');

// 取得 Slot 容器節點
const slotNode = myPanel.getSlotNode('contentSlot');
```

**Screen JSON 最小範例**：
```json
{
  "screenId": "my-screen",
  "specVersion": 1,
  "layoutRef": "layouts/my-main.json",
  "skinManifest": "skins/my-skin.json",
  "tabRouting": {
    "stats": { "slotId": "contentSlot", "fragment": "fragments/layouts/tab-stats.json" },
    "skills": { "slotId": "contentSlot", "fragment": "fragments/layouts/tab-skills.json" }
  }
}
```

---

### 1.2 ChildPanelBase

所有子面板的抽象基類，由 `CompositePanel.registerChildPanel()` 自動注入服務。

**路徑**：`assets/scripts/ui/core/ChildPanelBase.ts`

```typescript
export class MyPanel extends ChildPanelBase {
  dataSource = 'myData';          // 對應 applyContentState() 的 key

  onMount(spec: UILayoutNodeSpec): void { /* 首次掛載，可用 this.binder */ }
  onDataUpdate(data: unknown): void { /* 資料更新時呼叫 */ }
  validateDataFormat(data: unknown): string | null {
    // null = 合法；return '錯誤訊息' = 拒絕
    if (!Array.isArray(data)) return 'expected array';
    return null;
  }

  // I18n helper（M7）
  protected _refreshLabels(): void {
    this.binder.setLabelText('titleLabel', this.t('ui.myPanel.title'));
  }
}
```

**DI 注入屬性**（由 CompositePanel 自動設置，`onMount` 後可用）：
| 屬性 | 型別 | 說明 |
|------|------|------|
| `hostNode` | `Node` | 子面板的根節點 |
| `binder` | `UITemplateBinder` | 節點綁定器（提供 getLabel/getNode/setLabelText 等） |
| `skinResolver` | `UISkinResolver` | 皮膚 Sprite Frame 解析 |

---

### 1.3 UITemplateBinder 快速 API

```typescript
binder.getLabel('myLabel')           // Label 元件
binder.getNode('myNode')             // Node
binder.getSprite('mySprite')         // Sprite 元件
binder.setLabelText('titleLabel', 'Hello')
binder.applyDesignToken('bgSprite', 'color.primary')
```

---

## 二、內建 ChildPanel 子類（M2 + M3 + M7，✅）

### 2.1 AttributePanel

顯示「標籤 + 數值」對，適用於基礎屬性一覽。

**路徑**：`assets/scripts/ui/core/panels/AttributePanel.ts`  
**dataSource**：`'attributes'`

```typescript
// 資料格式
type AttributeData = Array<{ label: string; value: string }>;

panel.applyContentState({
  attributes: [
    { label: '統率', value: '95' },
    { label: '武力', value: '88' },
  ]
});
```

- 超出容器行數：靜默忽略多餘資料
- 資料不足：多餘行自動隱藏

---

### 2.2 GridPanel

動態格子，透過 `ICompositeRenderer` 抽象渲染。

**路徑**：`assets/scripts/ui/core/panels/GridPanel.ts`  
**dataSource**：`'gridItems'`

```typescript
// 資料格式：每個 item 為 object（含 cellFragmentRef 所需欄位）
type GridData = Array<Record<string, unknown>>;

panel.applyContentState({
  gridItems: [
    { id: 'slot_0', icon: 'sword', label: '長劍' },
    { id: 'slot_1', icon: 'bow',   label: '弓矢' },
  ]
});
```

- `validateDataFormat` 驗證每個元素為非 null 的 object

---

### 2.3 ScrollListPanel

可捲動清單，透過 `IScrollVirtualizer` 抽象虛擬化。

**路徑**：`assets/scripts/ui/core/panels/ScrollListPanel.ts`  
**dataSource**：`'listItems'`

```typescript
// 資料格式：每個 item 為 object，應有唯一 key
type ListData = Array<Record<string, unknown>>;

panel.applyContentState({
  listItems: Array.from({ length: 100 }, (_, i) => ({
    id: `item_${i}`, name: `武將 ${i}`
  }))
});
```

---

### 2.4 RadarChartPanel

六軸雷達圖，支援雙層（實力 / 資質）。

**路徑**：`assets/scripts/ui/core/panels/RadarChartPanel.ts`  
**dataSource**：`'radarStats'`

```typescript
// 資料格式（固定 6 軸）
type RadarData = {
  primary:   [str: number, int: number, lea: number, pol: number, cha: number, luk: number];
  secondary?: [str: number, int: number, lea: number, pol: number, cha: number, luk: number];
};

panel.applyContentState({
  radarStats: {
    primary:   [95, 80, 70, 65, 88, 72],
    secondary: [90, 85, 75, 68, 82, 78],
  }
});
```

---

### 2.5 ProgressBarPanel

六項進度條，適用於培育 Tab。

**路徑**：`assets/scripts/ui/core/panels/ProgressBarPanel.ts`  
**dataSource**：`'progress'`

```typescript
// 資料格式
type ProgressData = Array<{
  label: string;
  current: number;  // 0–100
  max: number;
}>;

panel.applyContentState({
  progress: [
    { label: '武藝', current: 60, max: 100 },
    { label: '謀略', current: 45, max: 100 },
  ]
});
```

---

### 2.6 EditableTextPanel（M7，✅）

可編輯文字面板，支援顯示/隱藏輸入狀態。

**路徑**：`assets/scripts/ui/core/panels/EditableTextPanel.ts`  
**dataSource**：`'editableText'`

```typescript
// 資料格式
type EditableTextData = { text: string; editable: boolean };

panel.applyContentState({
  editableText: { text: '曹操', editable: true }
});
```

- `editable = true`：顯示輸入框（`hostNode.children[0].active = true`）
- `editable = false`：隱藏輸入框，僅顯示 `TextLabel`

---

## 三、穩定性工具（M5，✅）

### 3.1 UCUFLogger

**路徑**：`assets/scripts/ui/core/UCUFLogger.ts`

```typescript
import { UCUFLogger, LogCategory, LogLevel } from '../core/UCUFLogger';

// 基本使用（禁止裸 console.log，全改用此 API）
UCUFLogger.debug(LogCategory.LIFECYCLE, '[MyPanel] onMount');
UCUFLogger.info(LogCategory.DATA,       '[MyPanel] 資料更新', payload);
UCUFLogger.warn(LogCategory.RULE,       '[MyPanel] RT-03 違規');
UCUFLogger.error(LogCategory.LIFECYCLE, '[MyPanel] 掛載失敗');

// 效能計量
const t = UCUFLogger.perfBegin('buildScreen');
// ... 建構操作
UCUFLogger.perfEnd('buildScreen', t);   // 自動輸出 [perf] buildScreen = XXms
```

**現有 LogCategory**：
| 分類 | 適用場景 |
|------|----------|
| `LIFECYCLE` | mount / unmount / destroy / init |
| `DATA` | 資料更新、validateDataFormat |
| `SKIN` | 皮膚解析、skinSlot |
| `PERFORMANCE` | perfBegin/perfEnd |
| `RULE` | RT-* 規則觸發 |
| `DRAG` | 拖曳操作（DeployDragDebug） |

**Browser Console 開關**：
```js
// 在 Browser Console 執行
__ucuf_debug()    // 開啟全部 DEBUG
__ucuf_quiet()    // 靜音，只顯示 ERROR
__ucuf_level(1)   // 0=DEBUG / 1=INFO / 2=WARN / 3=ERROR
```

---

### 3.2 RuntimeRuleChecker

執行期 UCUF 規則驗證，RT-01~RT-10 全部內建。

**路徑**：`assets/scripts/ui/core/RuntimeRuleChecker.ts`

```typescript
import { RuntimeRuleChecker } from '../core/RuntimeRuleChecker';

// 驗證單一節點（自動檢查所有啟用的規則）
const violations = RuntimeRuleChecker.check(node, spec);
// violations: Array<{ ruleId: string; message: string }>

// 只觸發特定規則
const result = RuntimeRuleChecker.checkRule('RT-03', node, spec);
```

**內建規則 RT-01~RT-10**：
| 規則 ID | 說明 |
|---------|------|
| RT-01 | Panel 掛載前必須設定 hostNode |
| RT-02 | dataSource 必須宣告 |
| RT-03 | Layout 引用必須存在 |
| RT-04 | skinSlot 引用必須在 manifest 中 |
| RT-05 | CompositePanel 不得在 onDestroy 後呼叫 API |
| RT-06 | lazySlot 節點不得直接修改（需透過 switchSlot） |
| RT-07 | tabRouting 的 fragment 必須可載入 |
| RT-08 | dispose 後不得持有子面板引用 |
| RT-09 | applyContentState 資料格式需通過 validateDataFormat |
| RT-10 | 同一 Slot 不得重複觸發 switchSlot（防止競態） |

---

### 3.3 DataBindingValidator

靜態分析資料綁定問題（missing-source / format-mismatch / unused-key）。

**路徑**：`assets/scripts/ui/core/DataBindingValidator.ts`

```typescript
import { DataBindingValidator } from '../core/DataBindingValidator';

const result = DataBindingValidator.validate(panel, contentState);
// result.errors: string[]   — 需修正
// result.warnings: string[] — 建議修正

if (result.errors.length > 0) {
  UCUFLogger.error(LogCategory.DATA, result.errors.join('\n'));
}
```

| 檢測類型 | 說明 |
|----------|------|
| `missing-source` | Panel 宣告的 dataSource 在 contentState 中找不到對應 key |
| `format-mismatch` | validateDataFormat 回傳錯誤訊息 |
| `unused-key` | contentState 提供了某 key 但沒有任何 Panel 使用 |

---

## 四、效能優化機制（M8，⚠️ 代碼驗收）

### 4.1 UINodePool

Fragment 切換時的節點回收池，減少 GC 壓力。

**路徑**：`assets/scripts/ui/core/UINodePool.ts`

```typescript
// CompositePanel.switchSlot() 內部已自動使用，無需手動呼叫。
// 若需手動操作：
import { UINodePool } from '../core/UINodePool';

UINodePool.recycle('tab-stats', node);           // 回收節點
const recycled = UINodePool.acquire('tab-stats'); // 取得回收節點（或 null）
```

> ⚠️ 效能目標（待 runtime 驗證）：switchSlot 重訪 ≤ 5ms（pool hit）

---

### 4.2 onAssetEvicted 閉環

`MemoryManager.onAssetEvicted` 自動觸發 `ResourceManager.forceRelease()`。

```typescript
// ServiceLoader.initialize() 已自動接線：
// this.memory.onAssetEvicted = (key) => { this.resource.forceRelease(key); }
// 
// forceRelease() 清除：spriteFrameCache / textureCache / jsonCache / atlasCache
// 並呼叫 assetManager.releaseAsset(asset)
```

**驗收狀態**（7 tests，stub 環境）：
- `onAssetEvicted(key)` → `forceRelease(key)` 呼叫：✅（assetEvictionClosedLoop.test.ts）
- 多次 eviction：✅
- null key 安全：✅
- exception isolation：✅

---

### 4.3 specVersion 前向相容降級（M9）

```typescript
// UISpecLoader 會在載入 Screen JSON 時自動檢查
// 若 spec.specVersion > CURRENT_SPEC_VERSION：
//   - 觸發降級警告（UCUFLogger.warn）
//   - 仍正常載入（不 crash）
//   - 可觀察 spec.degraded = true
```

**驗收狀態**（8 tests，stub）：specVersionDegradation.test.ts 全 PASS

---

## 五、I18n 支援（M7，✅）

### 5.1 CompositePanel 語系注入

```typescript
// mount() 後自動監聽 onLocaleChanged
// 語系切換時自動呼叫各 ChildPanel._refreshLabels()

// ChildPanel 中使用
export class MyPanel extends ChildPanelBase {
  protected _refreshLabels(): void {
    this.binder.setLabelText('titleLabel', this.t('ui.myPanel.title'));
    this.binder.setLabelText('descLabel',  this.t('ui.myPanel.desc'));
  }
}
```

### 5.2 validate-i18n-coverage.js

```bash
# 驗證 zh-TW 覆蓋率 100%
node tools_node/validate-i18n-coverage.js --strict

# 指定語系
node tools_node/validate-i18n-coverage.js --locale zh-CN
```

---

## 六、開發工具鏈 CLI（M1 + M6 + M10 + M11，✅）

### 6.1 validate-ui-specs.js（Lint R19~R28）

**最常用指令**：
```bash
# 全量 Lint（基本）
node tools_node/validate-ui-specs.js --strict

# 含 Content Contract 驗證
node tools_node/validate-ui-specs.js --strict --check-content-contract

# 只跑特定規則
node tools_node/validate-ui-specs.js --rules skin-layer-unique-zorder,max-layout-node-count

# 跳過特定規則
node tools_node/validate-ui-specs.js --strict --skip-rule atlas-batch-limit
```

**規則清單（含對照編號）**：
| 規劃書編號 | Rule ID | 說明 | 嚴重度 |
|-----------|---------|------|--------|
| R19 | `no-duplicate-widget-siblings` | 同 parent 3+ 同 widget 兄弟 | warning |
| R20 | `no-fill-bleed-frame-triplet` | 禁止 Fill/Bleed/Frame 三件套 | warning |
| R21 | `max-layout-node-count` | 單一 Layout 節點數上限 50 | failure |
| R22 | `skin-layer-unique-zorder` | skinLayers zOrder 不重複 | failure |
| R23 | `skin-layer-max-count` | skinLayers.length ≤ 12 | warning |
| R24 | `atlas-batch-limit` | Atlas 合批（skinLayers Atlas 一致）| warning |
| R25 | `spec-version-mismatch` | specVersion 前向相容 | warning |
| R26 | `lazy-slot-has-fragment` | lazySlot 需宣告 defaultFragment | warning |
| R27 | `dataSource-declared` | dataSource 需在 requiredFields 中 | warning |
| R28 | `composite-panel-tab-route-integrity` | tabRouting fragment 必須存在 | failure |

---

### 6.2 scaffold-ui-component.js --ucuf（M10）

快速產出 CompositePanel 骨架。

```bash
# Dry-run（看清單，不寫檔）
node tools_node/scaffold-ui-component.js --ucuf --dry-run --name MyNewPanel

# 實際產出
node tools_node/scaffold-ui-component.js --ucuf --name MyNewPanel --screen my-new-screen
```

產出物：
- `assets/scripts/ui/components/MyNewPanel.ts`（繼承 CompositePanel）
- `assets/resources/ui-spec/layouts/my-new-panel-main.json`
- `assets/resources/ui-spec/screens/my-new-screen.json`
- `assets/resources/ui-spec/contracts/my-new-panel-content.schema.json`

---

### 6.3 資產管理工具（M6）

```bash
# 掃描所有 Screen / Layout / Skin 中的資產引用，產出 registry JSON
node tools_node/collect-asset-registry.js

# 孤兒資源 / 缺失資源 / 動態資産分析報告
node tools_node/audit-asset-usage.js

# 截圖回歸比對（pixelmatch）
node tools_node/ucuf-screenshot-regression.js \
  --screens general-detail \
  --baseline artifacts/screenshots/baseline \
  --current  artifacts/screenshots/current \
  --threshold 5 \
  --strict \
  --output artifacts/screenshots/report.json
```

---

### 6.4 scan-deprecated-refs.js（M12）

```bash
# 確認 _deprecated/ 目錄已無任何引用
node tools_node/scan-deprecated-refs.js
# → 無任何 _deprecated/ 引用（✅ 已驗證）
```

---

## 七、Agent 治理工具（M10 + M11，✅）

### 7.1 ucuf-compliance.instructions.md（M10）

已設置為 **GitHub Copilot 自動載入指令**（`applyTo: assets/scripts/ui/**`）。

Agent 修改 `assets/scripts/ui/**` 時自動觸發以下 4 步驟：
1. `node tools_node/validate-ui-specs.js --strict` — Lint R19~R28
2. `node tools_node/validate-ucuf-task-card.js --card <task-card>` — 任務卡驗證
3. `node node_modules\ts-node\dist\bin.js --project tsconfig.test.json tests/run-ucuf-only.ts` — UCUF 測試全綠
4. `node tools_node/check-encoding-integrity.js <touched-files>` — 編碼檢查

**BLOCKING REQUIREMENT**：上述任一步驟失敗 → 禁止呼叫 `task_complete`。

---

### 7.2 validate-ucuf-task-card.js（M11）

驗證 UCUF 任務卡 Markdown（R-TC-01~R-TC-10 共 10 條規則）。

```bash
node tools_node/validate-ucuf-task-card.js --card docs/agent-briefs/my-task.md
node tools_node/validate-ucuf-task-card.js --card docs/agent-briefs/my-task.md --strict
```

| 規則 | 驗證項目 |
|------|----------|
| R-TC-01 | `screen_id` 非空 |
| R-TC-02 | `parent_panel` 為 CompositePanel 子類 |
| R-TC-03 | `content_contract_schema` 非空 |
| R-TC-04 | `fragments_owned` 為陣列 |
| R-TC-05 | `data_sources_owned` 非空陣列 |
| R-TC-06 | `skin_manifest` 非空 |
| R-TC-07 | `verification_commands` 非空陣列 |
| R-TC-08 | `smoke_route` 非空 |
| R-TC-09 | `deliverables` 無空字串項目 |
| R-TC-10 | `type` 為合法值（`ucuf-screen`/`ucuf-fragment` 等） |

---

### 7.3 UCUFRuleRegistry（M11）

動態注入新規則，`register` 後 `RuntimeRuleChecker` 立即可用。

**路徑**：`assets/scripts/ui/core/UCUFRuleRegistry.ts`

```typescript
import { UCUFRuleRegistry } from '../core/UCUFRuleRegistry';

// 注冊自訂規則
UCUFRuleRegistry.register({
  ruleId: 'RT-11',
  scope: 'ChildPanel',
  description: '我的自訂規則',
  check: (node, spec) => {
    if (/* 違規條件 */) return { ruleId: 'RT-11', message: '...' };
    return null;
  }
});

// 取得所有 ChildPanel scope 規則
const rules = UCUFRuleRegistry.getRulesByScope('ChildPanel');
```

---

### 7.4 ucuf-conflict-detect.js（M11）

偵測 skinSlot / dataSource 定義衝突。

```bash
node tools_node/ucuf-conflict-detect.js --strict
# 偵測：同一 skinSlot 在多個 Fragment 重複定義
# 偵測：同一 dataSource 被多個 Panel 宣告
```

---

### 7.5 finalize-agent-turn.js Gate Report（M11）

Agent 收工前的 UCUF Pre-Submit Gate（4 道驗證）。

```bash
node tools_node/finalize-agent-turn.js --workflow ucuf-develop

# Dry-run（不真的執行，只印清單）
node tools_node/finalize-agent-turn.js --workflow ucuf-develop --dry-run
```

Gate 結構：
1. **Gate 1 Spec Validation** — `validate-ui-specs.js --strict`
2. **Gate 2 Runtime Rules** — `ucuf-runtime-check.js --changed --strict`
3. **Gate 3 Content Contract** — `ucuf-conflict-detect.js --strict`
4. **Gate 4 Encoding** — `check-encoding-touched.js`

---

### 7.6 ucuf-gen-rule-test.js（M11）

自動產出規則的測試骨架（避免手寫重複 boilerplate）。

```bash
node tools_node/ucuf-gen-rule-test.js --rule-id RT-11
# 產出：tests/ucuf/rt11.generated.test.ts（含 pass/fail 骨架各一）
```

---

## 八、自動化測試框架（M6，✅）

### 8.1 測試架構

**測試入口**：`tests/run-ucuf-only.ts`  
**執行指令**：`node node_modules\ts-node\dist\bin.js --project tsconfig.test.json tests/run-ucuf-only.ts`

```typescript
import { TestSuite } from './TestRunner';

// Layer 1 — 純邏輯單元測試（最快）
const suite1 = new TestSuite('UCUF-MyPanel', 1);

// Layer 2 — 元件行為測試（含 Stub 模擬器互動）
const suite2 = new TestSuite('UCUF-MyPanel-Component', 2);

// Layer 3 — 整合測試（跨系統 Stub 串接）
const suite3 = new TestSuite('UCUF-MyFeature-Integration', 3);

suite1.test('基本 validateDataFormat', () => {
  const panel = new MyPanel();
  assert.isNull(panel.validateDataFormat([{ label: '統率', value: '95' }]));
});

suite1.test('非法格式拒絕', () => {
  const panel = new MyPanel();
  assert.notNull(panel.validateDataFormat('not-an-array'));
});
```

**Assert API**：
| 方法 | 說明 |
|------|------|
| `assert.equals(expected, actual)` | 深度相等 |
| `assert.isTrue(val)` | 為 true |
| `assert.isFalse(val)` | 為 false |
| `assert.notEquals(a, b)` | 不相等 |
| `assert.doesNotThrow(fn)` | 不拋出例外 |
| `assert.contains(str, sub)` | 字串包含子字串 |
| `assert.isNull(val)` | 為 null |
| `assert.notNull(val)` | 非 null |

**Layer 過濾**（執行 --layer 參數）：
```bash
# 只跑 Layer 1（快速驗證）
node ... tests/run-ucuf-only.ts -- --layer 1

# Layer 1 + Layer 2（完整單元 + 元件）
node ... tests/run-ucuf-only.ts -- --layer 2
```

**目前測試數量**：278 passed / 3 skipped / 0 failed（2026-04-15）

---

## 九、尚待 Runtime 驗收

以下項目**代碼已實作**，但需要在 Cocos Editor Preview 中才能填入量化數據：

| 項目 | 需要操作 | 驗收條件 |
|------|----------|----------|
| **M4-P1** 截圖 diff | `ucuf-screenshot-regression.js` 比對遷移前後 6 Tab | diff ≤ 2% |
| **M4-P1** 節點數 | runtime 計數 `GeneralDetailComposite` | ≤ 35 個節點 |
| **M8-P1** buildScreen 耗時 | 觀察 Console `[perf]` 輸出 | ≤ 50ms |
| **M8-P1** switchSlot 首次 | 觀察 Console `[perf]` 輸出 | ≤ 30ms |
| **M8-P1** switchSlot 重訪 | 觀察 Console `[perf]` 輸出（pool hit）| ≤ 5ms |
| **M9-P1** 過渡動畫 | 切換 Tab → 目視 fadeIn/fadeOut | 無 crash、無殘留節點 |

**操作步驟**：
1. 開啟 Cocos Editor → LoadingScene Preview
2. 切換至 `GeneralDetailComposite` 預覽目標
3. 開啟 Browser Console，執行 `__ucuf_debug()` 開啟 DEBUG 輸出
4. 觀察 `[perf]` 分類日誌，記錄數值
5. 切換不同 Tab，確認過渡動畫正常
6. 將數值填入 `docs/UCUF里程碑文件.md` M4 / M8 驗收表

---

## 附錄：快速路徑參考

| 目標 | 路徑 |
|------|------|
| CompositePanel 基類 | `assets/scripts/ui/core/CompositePanel.ts` |
| ChildPanelBase 基類 | `assets/scripts/ui/core/ChildPanelBase.ts` |
| 內建 ChildPanel 子類 | `assets/scripts/ui/core/panels/` |
| UCUFLogger | `assets/scripts/ui/core/UCUFLogger.ts` |
| RuntimeRuleChecker | `assets/scripts/ui/core/RuntimeRuleChecker.ts` |
| DataBindingValidator | `assets/scripts/ui/core/DataBindingValidator.ts` |
| UINodePool | `assets/scripts/ui/core/UINodePool.ts` |
| UCUFRuleRegistry | `assets/scripts/ui/core/UCUFRuleRegistry.ts` |
| 測試入口 | `tests/run-ucuf-only.ts` |
| Lint 工具 | `tools_node/validate-ui-specs.js` |
| Scaffold 工具 | `tools_node/scaffold-ui-component.js` |
| 任務卡驗證 | `tools_node/validate-ucuf-task-card.js` |
| Gate Report | `tools_node/finalize-agent-turn.js` |
| Agent 指令 | `.github/instructions/ucuf-compliance.instructions.md` |
| Workflow | `.agents/workflows/ucuf-develop.md` |
