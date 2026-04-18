# UCUF 開發者指南

> **文件版本**：v1.0（2026-04-12）  
> **適用**：Cocos Creator 3.8.8 / TypeScript  
> **作者**：UCUF 架構工作組

---

## 目錄

1. [架構總覽](#架構總覽)
2. [核心概念](#核心概念)
3. [從 UIPreviewBuilder 遷移至 CompositePanel](#從-uipreviewbuilder-遷移至-compositepanel)
4. [生命週期參考](#生命週期參考)
5. [Content Contract 格式](#content-contract-格式)
6. [skinLayers 與 i18n 模式](#skinlayers-與-i18n-模式)
7. [CLI 工具參考](#cli-工具參考)
8. [常見錯誤與速查](#常見錯誤與速查)

---

## 架構總覽

UCUF（Universal Composite UI Framework）是本專案的 UI 製作標準架構。
核心思想是將「佈局 JSON + 皮膚 JSON + 內容合約」與元件代碼分離，
讓視覺規格可以由工具驗證、由 Agent 生成，不需要在 Prefab Editor 中手動搬節點。

```
                 ┌──────────────────────┐
                 │  UIPreviewBuilder    │  ← 基礎引擎（節點建構 + Binder）
                 └──────────┬───────────┘
                            │ extends
                 ┌──────────▼───────────┐
                 │   CompositePanel     │  ← UCUF 核心抽象（M2）
                 │  mount / switchSlot  │
                 │  applyContentState   │
                 └──────────┬───────────┘
                            │ extends
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
  GeneralDetailComposite  BattleHUDComposite  GeneralListComposite
  （武將詳情）             （戰鬥 HUD）        （武將列表）
```

**Unity 對照**：整體相當於 Unity 的 `ContentSwitcher + TabController + SubPanelManager` 組合。

---

## 核心概念

### Screen JSON

位置：`assets/resources/ui-spec/screens/<screenId>.json`

描述一個完整畫面的 layout 來源、skin 來源，以及內容合約綁定。

```json
{
  "id": "battle-hud-screen",
  "uiId": "BattleHUDComposite",
  "layout": "battle-hud-main",
  "skin": "battle-hud-default",
  "contentRequirements": {
    "schemaId": "battle-hud-content",
    "familyId": "battle-hud",
    "requiredFields": ["battleState"]
  }
}
```

### Layout JSON

位置：`assets/resources/ui-spec/layouts/<layoutId>.json`

定義節點樹結構（Widget、Label、Sprite 等），完全由工具生成。
**不要手動在 Prefab 中搬移節點** — 所有節點路徑由 Layout JSON 決定。

### Skin JSON

位置：`assets/resources/ui-spec/skins/<skinId>.json`

定義皮膚槽（spriteFrame 路徑、9-slice 邊距、顏色 token 等）。

### Fragment Layout

位置：`assets/resources/ui-spec/layouts/<fragmentId>.json`

可延遲載入的子面板佈局，由 `switchSlot()` 動態填入 lazySlot 容器。
對應 Unity 的 ContentSwitcher 在切換時填入的子物件。

---

## 從 UIPreviewBuilder 遷移至 CompositePanel

### 遷移期實務規則（2026-04-13 起）

- **新建 Panel**：必須優先使用 `CompositePanel`。
- **既有 legacy Panel**：可暫時保留，但不得再擴散新的 runtime 依賴面。
- **battle 主幹 / orchestration 層**：優先綁 `Node host` + runtime resolve component，避免 Inspector 直接綁死 legacy concrete class。
- **清理順序**：先做 composite-first / host-node 化，再清 direct import，最後才做 `_deprecated/` 物理搬遷。
- **完成判準**：不是「有 Composite 就算完成」，而是 battle 主路徑、gate、task workflow、文件四條線都要收斂。

### 快速對照表

| 舊（UIPreviewBuilder）                        | 新（CompositePanel）                              |
|-----------------------------------------------|---------------------------------------------------|
| `extends UIPreviewBuilder`                    | `extends CompositePanel`                          |
| `buildScreen(layout, skin, i18n)` 手動呼叫   | `mount(screenId)` 一行搞定                        |
| `onReady(binder)`                             | `_onAfterBuildReady(binder)`                      |
| `_specLoader.loadFullScreen(id)` 手動管理     | 內建於 `mount()`，無需手動呼叫                    |
| 手動管理 `_isBuilt` flag                      | 由 `_isMounted` 標誌管理（子類自行加即可）        |
| `onBuildComplete(rootNode)` 保留              | 保留（CompositePanel 不覆寫，子類可繼續使用）     |
| 手動訂閱 / 取消事件                           | 同舊模式，`_unsubs` 陣列 + `onDestroy` 取消       |
| `this.node.destroyAllChildren()` 手動清理     | `unmount()` 統一清理                              |

### 步驟範例

以 `MyPanel` 為例：

**步驟 1：換繼承基底**

```typescript
// 舊
export class MyPanel extends UIPreviewBuilder { ... }

// 新
export class MyPanel extends CompositePanel { ... }
```

**步驟 2：換 import**

```typescript
// 移除
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';

// 改為
import { CompositePanel } from '../core/CompositePanel';
```

**步驟 3：替換 buildScreen 為 mount**

```typescript
// 舊
private async _initialize(): Promise<void> {
    const [fullScreen, i18n] = await Promise.all([
        this._specLoader.loadFullScreen('my-screen'),
        this._specLoader.loadI18n(services().i18n.currentLocale),
    ]);
    await this.buildScreen(fullScreen.layout, fullScreen.skin, i18n);
}

// 新
public async show(): Promise<void> {
    if (!this._isMounted) {
        await this.mount('my-screen');
        this._isMounted = true;
    }
    // ... 後續邏輯
}
```

**步驟 4：替換 onReady → _onAfterBuildReady**

```typescript
// 舊
protected onReady(binder: UITemplateBinder): void {
    this._myLabel = binder.getLabel('MyLabel');
}

// 新
protected override _onAfterBuildReady(binder: UITemplateBinder): void {
    this._myLabel = binder.getLabel('MyLabel');
}
```

**步驟 5：替換 onDestroy**

```typescript
protected onDestroy(): void {
    this.unmount();           // CompositePanel 清理
    this._unsubs.forEach(fn => fn());  // 取消事件訂閱
    this._isMounted = false;
}
```

---

## 生命週期參考

```
onLoad()
  └─ show()
       └─ mount(screenId)
            ├─ loadFullScreen(screenId)     ← 載入 screen / layout / skin JSON
            ├─ buildScreen(layout, skin)    ← 建構節點樹
            ├─ onReady(binder)              ← CompositePanel 攔截，存 binder
            │    └─ _onAfterBuildReady()   ← 子類在此綁定節點與事件
            ├─ onBuildComplete(rootNode)   ← 可選，非標準 widget 在此處理
            └─ switchSlot(slot, fragment)  ← 填入 defaultFragment
```

```
onDestroy()
  └─ unmount()
       ├─ ChildPanel.onUnmount()
       ├─ destroyAllChildren() 各 lazySlot
       └─ 清空 _lazySlots / _nodePool / childPanels
```

---

## Content Contract 格式

Content Contract 定義畫面需要哪些數據，位於：  
`assets/resources/ui-spec/contracts/<schemaId>.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "BattleHudContent",
  "type": "object",
  "required": ["battleState"],
  "properties": {
    "battleState": {
      "type": "string",
      "enum": ["idle", "fighting", "victory", "defeat"]
    },
    "playerHp": { "type": "number" },
    "enemyHp":  { "type": "number" }
  }
}
```

合約由 `validate-ui-specs.js` 自動驗證；若畫面 screen.json 宣告了 `contentRequirements.schemaId`，工具會檢查合約是否存在。

---

## skinLayers 與 i18n 模式

### skinLayers

skinLayers 可在 skin JSON 中疊加多個視覺效果（陰影、噪點、光暈）：

```json
{
  "id": "battle-hud-default",
  "slots": { ... },
  "skinLayers": [
    { "type": "shadow", "spriteFrame": "ui_shadow_soft", "offsetY": -4 },
    { "type": "noise",  "spriteFrame": "ui_noise_01",    "opacity": 30 }
  ]
}
```

> **注意**：`UIPreviewShadowManager` 目前仍在使用中（存放於 `_pending-delete/`），  
> 長期計劃是讓 `UIPreviewBuilder` 直接透過 `skinLayers` 處理，屆時 ShadowManager 可刪除。

### i18n

所有靜態文字通過 UITemplateBinder 自動套用 i18n key。  
動態文字（如武將名稱）由子類程式碼在 `_onAfterBuildReady` 後直接設定 `Label.string`。

語系切換事件由 `CompositePanel` 自動訂閱，會呼叫所有已登記 `ChildPanel._refreshLabels()`。

---

## CLI 工具參考

### 日常驗證入口

```bash
npm run check:ui-spec
npm run check:ui-spec -- --strict --check-content-contract
npm run test:ucuf
npm run test:ucuf:m10
npm run test:ucuf:m11
npm run test:snapshot
npm run check:deprecated-refs
npm run gate:ucuf
npm run gate:ucuf:staged
```

- `check:ui-spec -- --strict --check-content-contract`：跑三層 JSON + Content Contract + R1~R28 strict 規則。
- `test:ucuf`：聚合跑 UCUF 相關測試，是目前最接近「整體遷移健康度」的本地入口。
- `test:ucuf:m10`：focused 驗證 M10 工具鏈，包含 `validate-ui-specs.js` 的真 CLI integration tests，不只測 inline stub。
- `test:ucuf:m11`：focused 驗證 M11 治理鏈，包含 `finalize-agent-turn.js` gate 的 pass / fail / warning / skip 路徑。
- `test:snapshot`：跑 `headless-snapshot-test.js`，比對 ui-spec 結構快照，適合在大批 JSON 改動後確認沒有意外結構漂移。
- `check:deprecated-refs`：掃描 `assets/scripts/` 是否仍有 `_deprecated/` import/require 引用，作為實體搬遷前的最後一道檢查。
- `gate:ucuf`：本地預提交流程入口，內部會跑 `validate-ui-specs --strict --check-content-contract`、runtime gate、衝突掃描與 touched encoding 檢查。
- `gate:ucuf:staged`：只看 staged 檔案，適合 pre-commit 前快速確認增量變更。

### Git hooks 啟用

本 repo 已提供 `.githooks/pre-commit`，但 Git 不會自動採用，必須先做一次：

```bash
npm run install:hooks
git config --get core.hooksPath
```

驗證標準：
- `npm run install:hooks` 成功
- `git config --get core.hooksPath` 回傳 `.githooks`

建議：
- repo clone 後先執行一次
- 若要確認 pre-commit 是否真的生效，可在 staged `ui-spec` JSON 時觀察 hook 是否自動跑 `validate-ui-specs.js`

### `validate-ui-specs.js` 測試模式

`validate-ui-specs.js` 現在支援測試用根目錄覆寫：

```bash
node tools_node/validate-ui-specs.js --strict --project-root <tmpRoot> --ui-spec-root <tmpRoot>/ui-spec
```

用途：
- 讓整合測試可在臨時 fixture 上跑真實 validator。
- 避免 CLI test 被專案現有大量 spec 污染。
- 驗證新規則時可先在最小 fixture 收斂，再回頭跑全專案 strict。

### `finalize-agent-turn.js` gate 行為

`finalize-agent-turn.js` 的 UCUF pre-submit gate 預設執行：

1. `validate-ui-specs.js --strict --check-content-contract`
2. 若 workflow 名稱含 `ucuf`：`ucuf-runtime-check.js --changed --strict --json`
3. 若 workflow 名稱含 `ucuf`：`ucuf-conflict-detect.js --strict`
4. `check-encoding-touched.js`

判定規則：
- `validate-ui-specs` / `runtime-check` / `conflict-detect` 失敗 → gate fail
- `check-encoding-touched` 在有明確 `--files` 時失敗 → gate fail
- `check-encoding-touched` 在未指定 `--files` 時失敗 → 先列 warning，不直接阻擋
- `--skip-ucuf` 可略過 gate，主要用於非 UCUF 工作流

### `gate:ucuf` / `gate:ucuf:staged` / `finalize-agent-turn` 分工

| 指令 | 使用時機 | 範圍 | 目的 |
|------|----------|------|------|
| `npm run gate:ucuf:staged` | 本地開發、pre-commit 前 | staged 檔案 | 快速檢查這次準備提交的增量變更 |
| `npm run gate:ucuf` | 本地較大改動、準備整批提交前 | dirty worktree changed 檔案 | 檢查整批本地變更是否引入新的 UCUF 問題 |
| `node tools_node/finalize-agent-turn.js --workflow ucuf --task <id> --task-scope --json` | AI/多 Agent handoff、任務回合收尾 | task-lock 記錄的檔案集 | 讓 task 範圍內的 gate / budget / turn usage / handoff 對齊 |

實務建議：
- 一般手工開發：先跑 `gate:ucuf:staged`，大改前或收尾前再跑 `gate:ucuf`
- 多 Agent 協作：優先使用 `task-lock + finalize-agent-turn --task-scope`
- PR / CI：由 GitHub Actions 跑 `check:ui-spec --strict --check-content-contract`、`ucuf-runtime-check --strict`、`test:ucuf`

### task-lock / task-scope 最小工作流

```bash
# 1. 鎖任務並寫入本輪檔案範圍
node tools_node/task-lock.js lock <taskId> <agentId> --files <file...>

# 2. 用 task-scope 跑 finalize，避免把整個 dirty worktree 都算進來
node tools_node/finalize-agent-turn.js --workflow ucuf --task <taskId> --task-scope --json

# 3. 收工解鎖
node tools_node/task-lock.js unlock <taskId> <agentId>
```

用途：
- 讓多 Agent 不同時改同一批高風險檔。
- 讓 context budget / turn usage 以 task 檔案集為準，而不是整個工作樹。
- 讓 handoff 更容易對齊「這一輪到底碰了哪些檔」。

### M12 legacy cleanup 準則

- 先做 `composite-first` 引用清理，再搬檔；不要反過來。
- 只有在 runtime / test / tool 三層都不再 import legacy panel 時，才可搬入 `_deprecated/`。
- `StyleCheckPanel` 屬工具面板，不在這一波搬遷範圍內。
- 實際搬遷前，先跑 `npm run check:deprecated-refs`；若仍有引用，先修引用，不要硬搬。

| 工具 | 用途 | 指令 |
|------|------|------|
| `scan-deprecated-refs.js` | 掃描 `_deprecated/` 引用，確認可安全刪除 | `node tools_node/scan-deprecated-refs.js` |
| `validate-ui-specs.js` | 驗證所有 screen / layout / skin JSON 格式 | `node tools_node/validate-ui-specs.js` |
| `ucuf-screenshot-regression.js` | 比對截圖 baseline，確認遷移後 diff ≤ 2% | `node tools_node/ucuf-screenshot-regression.js` |
| `collect-asset-registry.js` | 收集資產引用表（供 audit 使用） | `node tools_node/collect-asset-registry.js` |
| `audit-asset-usage.js` | 分析哪些 Layout 引用了哪些 spriteFrame | `node tools_node/audit-asset-usage.js` |
| `validate-i18n-coverage.js` | 驗證所有 i18n key 都有對應翻譯 | `node tools_node/validate-i18n-coverage.js` |

### 新畫面開發完整流程

```bash
# 1. 建構與驗證 JSON 規格
node tools_node/validate-ui-specs.js

# 2. 確認無 _deprecated/ 引用
node tools_node/scan-deprecated-refs.js

# 3. 截圖回歸測試
node tools_node/ucuf-screenshot-regression.js

# 4. 刷新 Cocos asset-db
curl.exe http://localhost:7456/asset-db/refresh
```

---

## 常見錯誤與速查

### `[CompositePanel] switchSlot: slotId "X" 未找到`

**原因**：Layout JSON 中沒有 `lazySlot: true` 的節點，或節點 `name` 與 `slotId` 不符。  
**解法**：確認 Layout JSON 對應節點有 `"lazySlot": true` 且 `"name"` 與呼叫 `switchSlot(slotId, ...)` 的 `slotId` 相同。

### `binder.getLabel('Xxx')` 回傳 `null`

**原因**：Layout JSON 中節點路徑或 `binderKey` 錯誤；或節點沒有 `Label` component。  
**解法**：用 Cocos Editor 確認節點路徑，再對照 Layout JSON 的 `binderKey` 欄位。  
**Unity 對照**：`GetComponentInChildren<Text>("NodePath")` 找不到 → 同樣要確認路徑。

### `onBuildComplete` 沒被呼叫

**原因**：`mount()` 尚未完成（async），若在 `onLoad` 中同步讀取節點會讀不到。  
**解法**：在 `onBuildComplete` 或 `_onAfterBuildReady` 之後才做節點操作。

### 事件重複訂閱（`_subscribeEvents` 被呼叫多次）

**原因**：`show()` 多次呼叫且沒有防護條件。  
**解法**：在 `_subscribeEvents` 開頭加 `if (this._unsubs.length > 0) return;`。

### 舊面板與新面板並存時畫面空白

**原因**：新的 `mount(screenId)` 所指向的 Screen JSON 不存在，或 layout JSON 路徑錯誤。  
**解法**：`node tools_node/validate-ui-specs.js` 會輸出所有找不到的 JSON 路徑。

---

## 遷移狀態總覽（2026-04-13 修訂）

| 面板 | 原類別 | 新類別 | 狀態 |
|------|--------|--------|------|
| 武將詳情 | `GeneralDetailPanel` | `GeneralDetailComposite` | ✅ 完成 |
| 武將列表 | `GeneralListPanel` | `GeneralListComposite` | ✅ 完成 |
| 武將肖像 | `GeneralPortraitPanel` | `GeneralPortraitComposite` | ✅ 完成 |
| 武將快覽 | `GeneralQuickViewPanel` | `GeneralQuickViewComposite` | ✅ 完成 |
| 虎符牌 | `TigerTallyPanel` | `TigerTallyComposite` | ✅ 完成 |
| 戰鬥 HUD | `BattleHUD` | `BattleHUDComposite` | ✅ 完成 |
| 戰鬥日誌 | `BattleLogPanel` | `BattleLogComposite` | ✅ 完成 |
| 部署面板 | `DeployPanel` | `DeployComposite` | ✅ 完成 |
| 決鬥挑戰 | `DuelChallengePanel` | `DuelChallengeComposite` | ✅ 完成 |
| 行動指令 | `ActionCommandPanel` | `ActionCommandComposite` | ✅ 完成 |
| 單位資訊 | `UnitInfoPanel` | `UnitInfoComposite` | ✅ 完成 |
| 結算彈窗 | `ResultPopup` | `ResultPopupComposite` | ✅ TypeScript 報柱完成（`showResult()` alias 已加；`@property(Node) resultPopupHost` 已換）。剩餘：prefab Inspector 重綁需 Editor 手動完成 |
| 終極技彈窗 | `UltimateSelectPopup` | `UltimateSelectPopupComposite` | ✅ 完成 |
| 吐司訊息 | `ToastMessage` | `ToastMessageComposite` | ✅ 完成 |
| UIPreviewShadowManager | — | 移至 `_pending-delete/` | ✅ 暫存 |

### Battle migration 目前阻礙（需 Editor 驗證）

1. **`BattleScene.ts` resultPopupHost** — TypeScript 報柱已完成：prefab Inspector 需在 Cocos Editor 中將 `resultPopupHost` Node 欄位拖入 Popup 節點。runtime fallback 已就位（`getChildByName("Popup")`），操作前特效不受阻。
2. **`DeployPanel.ts` toastHost** — TypeScript 報柱已完成：`@property(ToastMessage)` 已改為 `@property(Node) toastHost`，runtime 走 `ToastMessageComposite` 優先、`ToastMessage` 次選。剩餘：scene/prefab Inspector 需手動把 `toastHost` Node 欄位重綁到 Toast 節點。
3. **Inspector 節點審查** — 需在 Cocos Editor 中確認 battle prefab 所有節點不再直接序列化 legacy class 屬性。

---

*本文件由 UCUF 架構工作組維護。有任何疑問請先確認 `docs/keep.md` 與 `docs/cross-reference-index.md`。*
