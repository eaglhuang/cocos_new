<!-- doc_id: doc_ui_0026 -->
# UCUF 規範文件 — 協作規則、禁止事項與標準流程

> 版本：v1.0（源自 UCUF 規劃書 v1.3）| 日期：2026-04-12
>
> **本文件定位**：專案中執行 UCUF 時，所有人類與 Agent 必須遵守的規則、禁止事項與標準流程。
> 讀完後應知道「做 UCUF 時什麼能做、什麼不能做、要按什麼步驟」。
>
> **相關文件**：
> - [UCUF技術文件.md](UCUF技術文件.md) (doc_tech_0017) — 框架原理、架構設計與子系統
> - [UCUF里程碑文件.md](UCUF里程碑文件.md) (doc_ui_0025) — 可執行計畫與驗收規則
> - [universal-composite-ui-framework-plan.md](universal-composite-ui-framework-plan.md) (doc_ui_0052) — 原始規劃書（已拆分）

---

## 目錄

1. [硬性架構規則](#1-硬性架構規則)
2. [效能 Budget](#2-效能-budget)
3. [Lint 規則總表](#3-lint-規則總表)
4. [新 UI 開發標準流程](#4-新-ui-開發標準流程)
5. [舊代碼淘汰規則](#5-舊代碼淘汰規則)
6. [驗證工具與提交前指令](#6-驗證工具與提交前指令)
7. [Agent 規則](#7-agent-規則)
8. [多 Agent 並行規則](#8-多-agent-並行規則)
9. [動態規則注入流程](#9-動態規則注入流程)
10. [UCUF 任務卡撰寫規則](#10-ucuf-任務卡撰寫規則)

---

## 1. 硬性架構規則

以下規則無條件適用於所有 UCUF 相關的開發工作。違反任一條即為**阻塞項（blocker）**。

| # | 規則 | 理由 | 技術依據 |
|---|------|------|----------|
| H-01 | **1 邏輯面板 = 1 Layout 節點** — 禁止用多個同位置兄弟節點模擬視覺層級 | 消除 Fill/Bleed/Frame 堆疊浪費 | [技術文件 §5](UCUF技術文件.md#5-skin-layer-stack--消除物理性節點疊加) (doc_tech_0017) |
| H-02 | **1 Screen = 1 Layout** — 禁止一個 Panel 同時持有兩套完整 Layout | 消除雙 Layout 互相干擾 | [技術文件 §3](UCUF技術文件.md#3-composite-panel-容器) (doc_tech_0017) |
| H-03 | **所有新 Panel 必須繼承 CompositePanel** — 禁止直接繼承 UIPreviewBuilder | 統一生命週期管理 | [技術文件 §3.2](UCUF技術文件.md#32-與既有-uipreviewbuilder-的關係) (doc_tech_0017) |
| H-04 | **禁止在 Panel 中直接 import Cocos 渲染元件** — `Sprite`, `Label`, `ScrollView` 等只允許出現在 `platform/cocos/` | 維持跨引擎遷移性 | [技術文件 §7](UCUF技術文件.md#7-跨引擎遷移性設計) (doc_tech_0017) |
| H-05 | **所有可見文字 100% 資料驅動** — 禁止寫死中文、數值、圖片路徑，唯一資料來源是 `applyContentState(state)` | 確保資料與外觀分離 | [技術文件 §14](UCUF技術文件.md#14-資料綁定系統) (doc_tech_0017) |
| H-06 | **新增 ChildPanel 子類必須實作 `validateDataFormat()`** | 確保資料綁定可驗證 | [技術文件 §14.5](UCUF技術文件.md#145-childpanelbasevalidatedataformat) (doc_tech_0017) |
| H-07 | **Tab 延遲載入** — 只有當前激活的 Tab 才建立節點樹，使用 `lazySlot` | 避免所有 Tab 預建佔用資源 | [技術文件 §3.3](UCUF技術文件.md#33-fragment-延遲載入機制) (doc_tech_0017) |

### 禁止 import 清單

以下 import 只允許出現在 `platform/cocos/` 目錄中：

```typescript
// ❌ 禁止在 CompositePanel / ChildPanelBase 中出現
import { Node, Sprite, Label, UITransform, Widget, Layout, ScrollView } from 'cc';

// ✅ 替代方案
import type { NodeHandle } from '../core/interfaces/INodeFactory';
```

---

## 2. 效能 Budget

所有 UCUF 畫面必須符合以下效能預算。超過任一項視為 **warning**，超過 2x 視為 **blocker**。

| 指標 | Budget | 備註 |
|------|--------|------|
| `buildScreen` 總時間 | ≤ 50ms | 方案 A+B+E 優化後目標 ≤ 25ms |
| `switchSlot`（首次載入） | ≤ 30ms | 方案 A 預載入後目標 ≤ 15ms |
| `switchSlot`（重訪 / pool hit） | ≤ 5ms | 方案 C 物件池後目標 ≤ 1ms |
| 節點總數（單一畫面） | ≤ 35 | skinLayers + lazy 合計 |
| Draw Call（單一畫面） | ≤ 15 | 需 Atlas 合批配合 |
| 單一 Layout 總節點數 | ≤ 50 | 不含 lazySlot 內容（R21） |

> 瓶頸分析與優化方案見 [技術文件 §16](UCUF技術文件.md#16-效能深度優化) (doc_tech_0017)。

### Runtime 效能監控

`UCUFLogger` 在 `buildScreen` / `switchSlot` 完成後自動記錄耗時。
超過 budget 時輸出 `performance` 分類的 warn 級別日誌。

---

## 3. Lint 規則總表

### 3.1 靜態規則（validate-ui-specs.js）

| 規則 ID | 說明 | 嚴重度 | 來源章節 |
|---------|------|--------|----------|
| R19 | 同一 parent 下不允許 ≥3 個節點有完全相同的 widget | error | §9.4 |
| R20 | 偵測 `*Fill` / `*Bleed` / `*Frame` 同名模式，建議改用 `skinLayers` | warning | §9.4 |
| R21 | 單一 Layout 總節點數 ≤ 50（不含 lazySlot 內容） | warning | §9.4 |
| R22 | `composite-image` 的 layers 數量 ≤ 12 | warning | §9.4 |
| R23 | `_deprecated/` 內的 spec 不應被任何 screen 引用 | error | §11.5 |
| R24 | skinLayers 的所有 slot 必須屬於同一 Atlas（確保合批） | warning | §19.3 |
| R25 | 新增的 Panel `.ts` 必須繼承 `CompositePanel`（掃描 `extends` 關鍵字） | error | §21.4 |
| R26 | Panel `.ts` 中禁止直接 `import { Sprite, Label } from 'cc'`（外觀操作應透過 ChildPanel） | warning | §21.4 |
| R27 | Layout JSON 中的 `child-panel` 必須有對應的 `dataSource`（確保資料驅動） | error | §21.4 |
| R28 | Screen JSON 必須有 `contentRequirements`（確保 Content Contract 存在） | warning | §21.4 |

### 3.2 Runtime 規則（RuntimeRuleChecker）

| 規則 ID | 說明 | 嚴重度 | 偵測方式 |
|---------|------|--------|----------|
| RT-01 | 節點深度超過 8 層 | warning | 遞迴遍歷 children 計算最大深度 |
| RT-02 | 同一 dataSource 被多個 ChildPanel 綁定 | error | 掃描所有 ChildPanel 的 dataSource 欄位 |
| RT-03 | skinLayers 引用的 skinSlot 在 Skin JSON 中不存在 | error | 交叉比對 skinLayers[].slot vs. skinManifest |
| RT-04 | lazySlot 的 defaultFragment 載入失敗 | error | catch fragment load 的 reject |
| RT-05 | 同一 parent 下多個 children 使用完全相同的 widget | warning | 比對 siblings 的 widget 屬性 |
| RT-06 | composite-image layers 超過 12 層 | warning | 檢查 layers 陣列長度 |
| RT-07 | ChildPanel config 缺少必要欄位 | error | 依 childType 查表驗證必填欄位 |
| RT-08 | Tab 路由表引用不存在的 fragment | error | 嘗試 loadLayout 並 catch error |
| RT-09 | content state 中的欄位與 dataSource 不匹配 | warning | 比對 applyContentState 的 key set |
| RT-10 | 同一畫面中 skinSlot ID 重複但指向不同資源 | error | 掃描 skinManifest 的 slot → path 映射 |

### 3.3 Runtime 規則觸發時機

| 時機 | 執行規則 | 條件 |
|------|----------|------|
| `CompositePanel.mount()` 完成後 | 全部 RT-01~RT-10 | 僅 `DEBUG_MODE` 開啟時 |
| `switchSlot()` 完成後 | RT-01, RT-04 | 僅 `DEBUG_MODE` 開啟時 |
| `applyContentState()` 完成後 | RT-02, RT-09 | 僅 `DEBUG_MODE` 開啟時 |
| `validate-ui-specs.js` CLI | 靜態版 RT-03, RT-05~RT-08 | 永遠執行 |

### 3.4 任務卡規則（R-TC 系列）

見 [§10 UCUF 任務卡撰寫規則](#10-ucuf-任務卡撰寫規則)。

---

## 4. 新 UI 開發標準流程

### 4.1 Spec-First 開發原則

所有新 UI 畫面的開發**必須以 JSON Spec 為起點**。

```
✅ 正確順序：
  Screen JSON → Layout JSON → Skin JSON → Content Contract Schema
  → scaffold-ui-component.js 生成 Panel 骨架
  → 開發者/Agent 在骨架上填充業務邏輯

❌ 禁止順序：
  直接寫 Panel.ts → 手動建節點 → 事後補 JSON
```

### 4.2 scaffold-ui-component.js --ucuf 流程

```bash
# Step 1: Dry run 確認產出結構
node tools_node/scaffold-ui-component.js --screen <id> --ucuf --dry-run

# Step 2: 正式產出骨架
node tools_node/scaffold-ui-component.js --screen <id> --ucuf
```

`--ucuf` 模式自動產出：

| 檔案 | 說明 |
|------|------|
| `assets/scripts/ui/components/<Name>Panel.ts` | 繼承 CompositePanel 的 Panel 骨架 |
| `assets/resources/ui-spec/layouts/<id>-main.json` | 帶 lazySlot 的 Layout 骨架 |
| `assets/resources/ui-spec/screens/<id>-screen.json` | 帶 tabRouting 的 Screen 骨架 |
| `assets/resources/ui-spec/contracts/<id>-content.schema.json` | Content Contract 骨架 |

### 4.3 目錄結構強制規範

每個 UCUF 畫面遵循統一的目錄佈局：

```
assets/resources/ui-spec/
├── layouts/
│   └── my-screen-main.json         ← 主 Layout
├── fragments/layouts/
│   ├── my-screen-tab-a.json        ← Tab Fragment A
│   └── my-screen-tab-b.json        ← Tab Fragment B
├── skins/
│   └── my-screen-default.json      ← 預設 Skin
├── screens/
│   └── my-screen-screen.json       ← Screen 組裝單元
└── contracts/
    └── my-screen-content.schema.json ← Content Contract

assets/scripts/ui/components/
└── MyScreenPanel.ts                 ← Panel 實作（繼承 CompositePanel）
```

### 4.4 Content Contract 強制生成

`scaffold-ui-component.js --ucuf` 自動掃描 Layout JSON 中的所有 `child-panel` 節點，
提取 `dataSource` 欄位，自動生成 Content Contract 骨架。

生成後**必須手動補充欄位描述**，不可留空 `"TODO: 補充說明"`。

### 4.5 外觀與邏輯分離強制執行

由 R25~R28 lint 規則 + 提交前 hook 自動檢查。
違反 R25（未繼承 CompositePanel）或 R27（child-panel 無 dataSource）
為 **error** 級別，阻止提交。

---

## 5. 舊代碼淘汰規則

### 5.1 Deprecated Zone 策略

遷移期間，舊代碼不立即刪除，而是移入標準的緩衝目錄：

```
assets/scripts/ui/_deprecated/
├── GeneralDetailPanel.ts          ← 標記 @deprecated v1.1
├── GeneralDetailOverviewShell.ts  ← 標記 @deprecated v1.1
└── README.md                      ← 說明每個檔案的淘汰原因與替代方案

assets/resources/ui-spec/_deprecated/
├── layouts/general-detail-main.json
└── README.md
```

### 5.2 標記規範

所有待淘汰的 class / function 必須加上 JSDoc 標記：

```typescript
/**
 * @deprecated v1.1 — 由 GeneralDetailComposite 取代。
 * 預計在 M5 milestone 完成後移除。
 * @see CompositePanel
 * @removal-target M5
 */
export class GeneralDetailPanel extends UIPreviewBuilder { ... }
```

**必要欄位**：
- `@deprecated` + 版本號
- 替代方案（`@see`）
- 預計移除的里程碑（`@removal-target`）

### 5.3 四階段清理時機

| 階段 | 觸發時機 | 動作 | 舊代碼狀態 |
|------|----------|------|------------|
| Phase A | M4 — 遷移開始 | 建立新 CompositePanel + Layout | 舊代碼移入 `_deprecated/`，保留 import alias 相容 |
| Phase B | M4 — 遷移驗證 | 新畫面通過截圖對比驗證 | 舊代碼標記 `@deprecated`，console.warn 提醒 |
| Phase C | M5 — 穩定性確認 | 全域搜尋 `_deprecated/` import | 確認引用為零 |
| Phase D | M12 — 全域清理 | 刪除 `_deprecated/` 目錄 | 清理 UIConfig 中的舊 UIID |

### 5.4 掃描工具

```bash
# 掃描專案中是否仍有對 _deprecated/ 的引用
node tools_node/scan-deprecated-refs.js
# 輸出：
#   ✅ 0 references to _deprecated/ — 可安全刪除
#   ❌ 3 files still import from _deprecated/:
#      - assets/scripts/ui/components/LobbyScreen.ts:14
```

---

## 6. 驗證工具與提交前指令

### 6.1 靜態 Spec 驗證

```bash
# 完整驗證（包含 R19~R28 + content contract）
node tools_node/validate-ui-specs.js --strict --check-content-contract

# 只檢查特定規則
node tools_node/validate-ui-specs.js --rules R19,R20,R21,R22

# ChildPanel config 專項驗證
node tools_node/validate-child-panel-configs.js
```

### 6.2 Runtime 規則檢查

```bash
# 需要 Cocos preview 環境
node tools_node/ucuf-runtime-check.js --screen <screen-id>

# 只檢查有修改的 screen
node tools_node/ucuf-runtime-check.js --changed
```

### 6.3 編碼檢查

```bash
node tools_node/check-encoding-touched.js <changed-files...>
```

### 6.4 截圖回歸

```bash
# 對已遷移的 UCUF 畫面執行截圖回歸
node tools_node/ucuf-screenshot-regression.js --screens <screen-id> --baseline artifacts/ucuf-baseline/
```

### 6.5 Pass-All Gate

任何修改涉及以下路徑時，必須通過**全部** UCUF 測試層（Layer 1 + 2 + 3）：

| 觸發路徑 | 必要測試 |
|----------|----------|
| `assets/scripts/ui/core/**` | Layer 1 + 2 + 3 |
| `assets/scripts/ui/core/panels/**` | Layer 1 + 2 + 3 |
| `assets/resources/ui-spec/**` | Layer 1 + 2 |

```bash
# 執行全部測試層
node tools_node/run-ucuf-tests.js --layer 1
node tools_node/run-ucuf-tests.js --layer 2
node tools_node/run-ucuf-tests.js --layer 3
```

### 6.6 提交前 Hook（Pre-commit）

```bash
# .github/hooks/scripts/pre-commit-ucuf.js
# git commit 時自動執行
node tools_node/validate-ui-specs.js --strict --check-content-contract --rules R25,R26,R27,R28
node tools_node/check-encoding-touched.js <touched-files>
```

---

## 7. Agent 規則

### 7.1 三層指令集架構

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Path-Specific Instructions（自動載入）          │
│  .github/instructions/ucuf-compliance.instructions.md   │
│  applyTo: "assets/scripts/ui/**,assets/resources/ui-spec/**" │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Workflow Definitions（Agent 主動執行）          │
│  .agents/workflows/ucuf-develop.md                      │
│  .agents/workflows/ucuf-verify.md                       │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Skill Definition（按需載入）                    │
│  .agents/skills/ui-vibe-pipeline/SKILL.md (doc_agentskill_0008)（已存在，需更新）│
└─────────────────────────────────────────────────────────┘
```

### 7.2 ucuf-compliance.instructions.md 內容摘要

Agent 在修改 `assets/scripts/ui/**` 或 `assets/resources/ui-spec/**` 路徑時，
自動載入此 instructions 檔案。內容包含：

1. 硬性規則 H-01~H-07 的精簡版（見 [§1](#1-硬性架構規則)）
2. 效能 Budget 表格（見 [§2](#2-效能-budget)）
3. 提交前必跑的三條指令（見 [§6](#6-驗證工具與提交前指令)）

### 7.3 ucuf-develop.md 開發流程

Agent 開發新 UCUF 畫面時的標準 workflow：

| Phase | 步驟 | 指令 |
|-------|------|------|
| 1 — Spec 建立 | 執行 scaffold dry-run | `scaffold-ui-component.js --screen <id> --ucuf --dry-run` |
| | 確認後正式執行 | `scaffold-ui-component.js --screen <id> --ucuf` |
| | 補充 Content Contract 欄位描述 | 手動編輯 |
| 2 — Layout & Fragment | 定義主 Layout + skinLayers + lazySlot | 編輯 JSON |
| | 拆 Tab 為獨立 Fragment | 新增 fragment JSON |
| | 定義 Screen JSON 的 tabRouting | 編輯 screen JSON |
| 3 — 業務邏輯 | 實作 `buildContentState()` | 編輯 Panel.ts |
| | 自訂 ChildPanel（若需要） | 繼承 ChildPanelBase + 註冊 |
| 4 — 驗證 | 靜態驗證 | `validate-ui-specs.js --strict --check-content-contract` |
| | Runtime 驗證 | `ucuf-runtime-check.js --screen <id>` |
| | 截圖回歸（若有 baseline） | `ucuf-screenshot-regression.js --screens <id>` |

### 7.4 Pre-Submit Gate 機制

Agent 完成任務前，必須通過 gate 檢查。由 `finalize-agent-turn.js` 自動執行：

```bash
node tools_node/finalize-agent-turn.js --workflow ucuf-develop
```

內部自動執行：
1. `validate-ui-specs.js --strict --check-content-contract`
2. `ucuf-runtime-check.js --changed`
3. `check-encoding-touched.js`

**Gate 失敗時**：Agent 必須修復所有錯誤後才能結束任務。不允許跳過。

### 7.5 Gate 輸出格式

```
╔══════════════════════════════════════════════════╗
║          UCUF Pre-Submit Gate Report              ║
╠══════════════════════════════════════════════════╣
║ ✅ Spec Validation       : PASS (0 errors)       ║
║ ❌ Runtime Rules         : FAIL (2 violations)   ║
║    RT-05: FooterPanel — 同位置兄弟節點           ║
║    RT-07: SkillGrid — config 缺少 cellSize       ║
║ ✅ Content Contract      : PASS                  ║
║ ⚠️  Performance Budget   : WARN                  ║
║    buildScreen: 62ms (budget: 50ms)              ║
╠══════════════════════════════════════════════════╣
║ 結果: FAIL — 請修正 RT-05, RT-07 後重新提交       ║
╚══════════════════════════════════════════════════╝
```

---

## 8. 多 Agent 並行規則

### 8.1 Fragment-Based 任務分片策略

UCUF 的「1 Screen + N Fragment」架構支援以 Fragment 為單位分配工作給不同 Agent：

```
任務分片維度：
┌────────────────────────────────────┬───────────────────────────────┐
│ 維度 A：Layout Fragment            │ 維度 B：業務邏輯               │
│ 修改 JSON spec 結構               │ 修改 TypeScript 映射 / 資料流  │
│ 鎖定範圍：單一 fragment JSON       │ 鎖定範圍：單一 Mapper/Panel ts │
├────────────────────────────────────┼───────────────────────────────┤
│ 維度 C：Skin / 視覺               │ 維度 D：Content Contract       │
│ 修改 skin JSON + 圖片資源         │ 修改 contract schema JSON      │
│ 鎖定範圍：skin JSON + sprites/    │ 鎖定範圍：contract schema JSON │
└────────────────────────────────────┴───────────────────────────────┘
```

### 8.2 並行安全矩陣

| Agent A 工作 | Agent B 工作 | 衝突風險 | 防範方式 |
|-------------|-------------|----------|----------|
| tab-basics.json | tab-stats.json | ✅ 無衝突 | 不同 Fragment，自然隔離 |
| tab-basics.json | BasicInfoMapper.ts | ⚠️ 低風險 | Content Contract 為解耦點 |
| main-layout.json | tab-basics.json | ⚠️ 中風險 | `$ref` 引用可能受影響；Agent A 須通知 |
| main-layout.json | my-screen-default.json | ⚠️ 中風險 | skinSlot 名稱為契約；改名須同步 |
| BasicInfoMapper.ts | StatsMapper.ts | ✅ 無衝突 | 不同 ChildPanel，不同 dataSource |
| CompositePanel.ts | 任何 Fragment | 🔴 高風險 | 核心架構修改須獨佔鎖 |

### 8.3 Content Contract 作為解耦點

Content Contract 是 Fragment 開發者和業務邏輯開發者之間的**唯一契約邊界**：

```
Fragment 開發者（Agent A）              業務邏輯開發者（Agent B）
    │                                         │
    │  在 Layout JSON 中宣告                   │  在 Mapper.ts 中產出
    │  dataSource: "basicAttributes"          │  basicAttributes: [...]
    │                                         │
    └──────────── Content Contract ───────────┘
                  (schema JSON)
```

**Contract-First 開發流程**：

1. 人類 / Lead Agent 定義 Content Contract Schema → commit 到 main branch
2. Agent A：依 contract 開發 Layout + Fragment（只關心結構 + dataSource）
3. Agent B：依 contract 開發 Mapper + 業務邏輯（只關心資料格式）
4. 整合：兩邊都通過 `validate-ui-specs.js --check-content-contract` → 自動驗證

### 8.4 檔案鎖定

利用 `task-lock.js` 機制，擴充 UCUF 專屬的鎖定粒度：

```bash
# 開工前鎖定 Fragment
node tools_node/task-lock.js lock UCUF-TAB-BASICS agent1

# 查詢鎖定狀態
node tools_node/task-lock.js list --prefix UCUF-

# 收工後解鎖
node tools_node/task-lock.js unlock UCUF-TAB-BASICS agent1
```

**核心架構鎖定**：修改 `CompositePanel.ts` 等核心檔案時，
必須先鎖定 `UCUF-CORE-*` 獨佔鎖，確保同時只有一個 Agent 操作。

### 8.5 衝突偵測 CLI

```bash
node tools_node/ucuf-conflict-detect.js --agent1-changes file1.json,file2.ts --agent2-changes file3.json,file4.ts
# 輸出：
#   ✅ 無 skinSlot 名稱衝突
#   ✅ 無 dataSource 名稱衝突
#   ⚠️ 兩者都修改了 main-layout.json 的 tabRouting — 需人工合併
```

---

## 9. 動態規則注入流程

### 9.1 Agent 新增規則的 5 步工作流

當 Agent 在開發過程中發現新的禁止模式或效能瓶頸：

| 步驟 | 動作 | 說明 |
|------|------|------|
| Step 1 | 識別問題 | 例：發現 composite-image 的 layers 中有重複 skinSlot |
| Step 2 | 建立規則定義 | 呼叫 `UCUFRuleRegistry.register({ id, name, severity, ... })` |
| Step 3 | 自動同步 | RuntimeRuleChecker + UCUFLogger + 測試骨架自動擴充 |
| Step 4 | 持久化 | 寫入 `assets/resources/ui-spec/ucuf-rules-registry.json` |
| Step 5 | 提交 | 規則定義 + 檢查函式 + 測試骨架一起提交 |

> 技術實作（UCUFRuleRegistry 設計、三層同步機制）見 [技術文件 §19](UCUF技術文件.md#19-動態規則注入引擎) (doc_tech_0017)。

### 9.2 規則生命週期

| 狀態 | 說明 | 觸發條件 |
|------|------|----------|
| `draft` | Agent 新增，尚未經人類審核 | Agent 呼叫 `register()` |
| `active` | 人類審核通過，正式啟用 | 人類在 JSON 中標記 `"status": "active"` |
| `deprecated` | 規則已不適用 | 架構演進導致規則過時 |
| `removed` | 已從 registry 移除 | 人類手動刪除 |

**`draft` 規則行為**：在 runtime 中以 `info`（而非 `warning` / `error`）級別觸發，
避免誤攔阻開發流程。人類審核設為 `active` 後才以原始 severity 觸發。

### 9.3 持久化格式

```json
// assets/resources/ui-spec/ucuf-rules-registry.json
{
  "version": 1,
  "rules": [
    {
      "id": "RT-11",
      "name": "composite-image-duplicate-slot",
      "description": "composite-image 的 layers 中不允許重複的 skinSlot",
      "severity": "warning",
      "scope": "both",
      "category": "skin",
      "checkModule": "rules/RT-11-check",
      "status": "draft",
      "addedBy": "agent1",
      "addedAt": "2026-04-12T15:30:00"
    }
  ]
}
```

### 9.4 回饋閉環

```
Agent 發現問題
      │
      ▼
UCUFRuleRegistry.register()
      │
      ├──► RuntimeRuleChecker 自動擴充 → 下次 mount() 自動偵測
      ├──► UCUFLogger 啟用新 category → 相關日誌自動輸出
      ├──► ucuf-gen-rule-test.js → 測試骨架自動生成
      └──► ucuf-rules-registry.json → 持久化供所有 Agent 共用
              │
              ▼
      下一個 Agent 入場 → 自動載入所有動態規則
              │
              ▼
      finalize-agent-turn.js → Gate 檢查包含所有動態規則
```

---

## 10. UCUF 任務卡撰寫規則

> 完整模板：`docs/agent-briefs/UCUF-task-card-template.md (doc_task_0131)` (doc_task_0131)

### 10.1 任務卡結構

**Frontmatter（YAML）五區塊**：

| 區塊 | 內容 | 不可空白欄位 |
|------|------|-------------|
| A — 基本資訊 | id, priority, phase, type, status | id, type, status |
| B — UCUF 架構約束 | screen_id, fragments_owned, content_contract_schema, data_sources_owned, child_panels, skin_layers_used, atlas_group | screen_id, content_contract_schema, data_sources_owned, child_panels（≥1） |
| C — 驗證門檻 | smoke_route, verification_commands, perf_budget, acceptance | smoke_route, verification_commands（≥1 含 validate-ui-specs.js） |
| D — 交付物與回寫 | deliverables, docs_backwritten, shard_file | deliverables |
| E — 執行紀錄 | started_at, started_by_agent, completed_at, notes | 開工前可空白，開工後必填 |

**Markdown 本文四區**：

| Section | 撰寫規則 |
|---------|----------|
| 背景 | 2~5 句話，引用規劃書章節號 |
| 實作清單 | 每條標明**檔案路徑**和**動作**（新增/修改/刪除/搬移） |
| 驗收條件 | boolean 通過條件，禁止模糊描述（❌「看起來正確」→ ✅「截圖 diff ≤ 2%」） |
| 結案檢查清單 | 固定 9 條，不可刪減，可新增 |

### 10.2 十條撰寫規則

| 規則 | 說明 |
|------|------|
| **R-TC-01** | `type` 必須從分類表選取：composite-panel / fragment-develop / child-panel-type / skin-layer-work / content-contract / mapper-logic / migration / performance / tooling / architecture |
| **R-TC-02** | `parent_panel` 必須為 `CompositePanel`（禁止繼承 UIPreviewBuilder） |
| **R-TC-03** | `fragments_owned` 中的每個 Fragment 必須在 `deliverables` 中有對應條目 |
| **R-TC-04** | `data_sources_owned` 中的每個 dataSource 必須在 `child_panels` 中有對應 entry |
| **R-TC-05** | `verification_commands` 至少包含 `validate-ui-specs.js --strict --check-content-contract` |
| **R-TC-06** | `acceptance` 中的每個條件必須可量化（數值閾值 / 工具輸出 PASS/FAIL） |
| **R-TC-07** | `perf_budget` 的值不可超過 §2 的上限（build ≤50ms / slot ≤30ms / cached ≤5ms / nodes ≤35 / draws ≤15） |
| **R-TC-08** | 若 `type=architecture`，必須在開卡時鎖定 `UCUF-CORE-*` 獨佔鎖，並在 `notes` 中記錄鎖名 |
| **R-TC-09** | 實作清單中每個**新增**的 JSON spec 檔案，必須標明預期節點數上限 |
| **R-TC-10** | 結案檢查清單不可刪減模板中的 9 條，可新增但不可省略 |

### 10.3 任務卡驗證工具

```bash
node tools_node/validate-ucuf-task-card.js --card docs/agent-briefs/tasks/UCUF-XXXX.md
# 輸出：
#   ✅ Section A: 完整
#   ❌ Section B: data_sources_owned 為空 — 違反 R-TC-04
#   ✅ Section C: 完整
#   ⚠️ Section D: docs_backwritten 為空 — 建議補充
```
