<!-- doc_id: doc_task_plan_0001 -->
# 戰場 UI 與邏輯架構優化規劃書

> **版本**：v1.0
> **日期**：2026-04-12
> **範圍**：v2 → v3 UI 遷移後的戰鬥場景功能失效全面修復與架構重構
> **相關規格**：`docs/主戰場UI規格補充_v3.md` (doc_ui_0003)、`docs/主戰場UI規格書.md` (doc_ui_0001)

---

## 一、故障根本原因分析 (Root Cause Analysis)

### 1.1 BattleScenePanel @property 節點綁定：時序競爭與引用丟失

#### 問題描述

`BattleScenePanel` 作為戰鬥 UI 總調度器，在 `onLoad()` 中執行三步關鍵初始化：

```
onLoad() → _ensureSubPanels() → _wireCallbacks() → _subscribeEvents()
```

**時序競爭（Race Condition）風險點：**

| 位置 | 問題 | 嚴重度 |
|---|---|---|
| `BattleScenePanel.onLoad()` 呼叫 `services().initialize(this.node)` | 與 `BattleScene.start()` 中的同一呼叫重複；若 BattleScene 先執行，此處是安全的冪等操作；但若 BattleScenePanel 先掛載，可能使後續 `services()` 呼叫引用到不完整的服務容器 | 中 |
| `_ensureSubPanels()` 中 `addComponent(TigerTallyPanel)` | TigerTallyPanel 繼承 `UIPreviewBuilder`，其 `onLoad()` 會觸發非同步的 `buildScreen()`。但 `_wireCallbacks()` 在 `_ensureSubPanels()` 之後**同步**執行，此時 TigerTallyPanel 的 `onReady()` 尚未完成，卡片節點未建立 | **高** |
| `wirePanels()` 被 `BattleScene.start()` 在步驟 6-1 呼叫 | 會再次呼叫 `_wireCallbacks()`，重複綁定 `onCardSelect`。若第一次綁定時 TigerTallyPanel 已存在但未 ready，第二次綁定可覆蓋正確回呼 — 但也可能因為兩次綁定間 TigerTallyPanel 被重建而導致引用丟失 | 中 |

**根因結論**：`BattleScenePanel` 的設計假設子面板在 `onLoad()` 同步階段即可用，但所有基於 `UIPreviewBuilder` 的子面板（`TigerTallyPanel`、`BattleLogPanel`、`ActionCommandPanel`）都有非同步的 `buildScreen()` 流程。`_wireCallbacks()` 在節點樹尚未建構完成時執行，導致事件回呼掛載到空殼組件上。

#### 影響

- **虎符卡片點擊無反應**：`TigerTallyPanel.onReady()` 在 `_wireCallbacks()` 之後才執行，此時 `onCardSelect` 回呼雖已設定，但卡片節點尚未綁定 `Button.EventType.CLICK` 監聽器。幸運的是 `onReady()` 中有做 `cardNode.on(Button.EventType.CLICK, ...)` 綁定，所以**卡片點擊事件鏈本身是完整的**。真正的問題在於：若 `_ensureSubPanels()` 動態建立了新的 TigerTallyPanel 節點，但 Inspector 中原本已有一個綁定好的節點，則會產生兩個面板實例，只有一個有正確的 `onCardSelect` 回呼。

### 1.2 DeployPanel 與 TigerTallyPanel 事件監聽掛載問題

#### DeployPanel 事件鏈分析

```
BattleScene.start()
  → ensureDeployPanel()           // 步驟 6
  → deployPanel.setController()   // 步驟 6 之後
  → deployPanel.registerDragDropCallback()
  → deployPanel.node.on("endTurn", ...)   // 步驟 8
  → deployPanel.node.on("playerDeployed", ...)
```

**風險點：**

| 問題 | 分析 |
|---|---|
| `ensureDeployPanel()` 在 Canvas 下尋找 "Panel" 節點 | 若 v3 UI 重組將節點重新命名或移動層級，`getChildByName("Panel")` 將找不到節點，導致 `deployPanel` 為 null，後續所有 `?.` 調用靜默失敗 |
| `DeployPanel.onLoad()` 中的 `ensureBindings()` | 依賴 Inspector 綁定的 5 個 `@property(Button)` 按鈕節點。若 v3 重組後按鈕節點名稱或層級變更，`slotButtons` 陣列將包含 null 項目，`bindSlotButtons()` 中 `btn.node.on()` 靜默跳過 |
| 拖曳放手回調 `dragDropCallback` | 由 `BattleScene.registerDragDropCallback()` 注入。若 `ensureDeployPanel()` 失敗（返回 null），回調不會被註冊，拖曳放手後 `processDragEnd()` 中 `this.dragDropCallback` 為 null，不會觸發射線偵測 |

#### TigerTallyPanel 事件鏈分析

```
TigerTallyPanel (UIPreviewBuilder)
  → onLoad() → buildScreen() [async]
    → onReady(binder)
      → cardNode.on(Button.EventType.CLICK, () => _onCardClick(i))
      → _onCardClick(i) → this.onCardSelect?.(index, data)
```

**結論**：TigerTallyPanel 的事件鏈**設計上是正確的**。`onCardSelect` 回呼由 `BattleScenePanel._wireCallbacks()` 在 TigerTallyPanel 實例建立後即設定，而卡片節點的 `CLICK` 監聽在 `onReady()` 中綁定。兩者透過 `this.onCardSelect` 函式指標串接。

**但存在以下隱患**：
1. 若 `_wireCallbacks()` 執行時 `this.tigerTallyPanel` 引用的是舊實例（Inspector 綁定），而 `_ensureSubPanels()` 後來又建了新實例，則新實例的 `onCardSelect` 未被設定
2. `setCards()` 在 `buildScreen()` 完成前被呼叫的競態已由 `onReady()` 中的重播機制處理（第 153-156 行），但 `onCardSelect` 無此保護

### 1.3 DP → 糧草（Food/Grain）更名同步狀態

根據 `主戰場UI規格補充_v3.md` 的 v3-4 要求，所有 DP 概念需更名為「糧草」。目前代碼層的同步狀態：

| 層級 | 檔案 | 舊名殘留 | 新名已實作 | 狀態 |
|---|---|---|---|---|
| **常數定義** | `Constants.ts` | `INITIAL_DP`、`DP_PER_TURN`、`MAX_DP` | — | ⛔ **未更名** |
| **戰鬥系統** | `BattleSystem.ts` | `playerDp`、`canSpendDp()`、`spendDp()` | — | ⛔ **未更名** |
| **快照介面** | `BattleSystem.getSnapshot()` | `playerDp` 欄位 | — | ⛔ **未更名** |
| **控制器** | `BattleController.ts` | `enemyDp` | — | ⛔ **未更名** |
| **場景** | `BattleScene.ts` | `snap.playerDp`、`GAME_CONFIG.MAX_DP` | — | ⛔ **未更名** |
| **HUD 事件處理** | `BattleHUD._onTurnPhaseChanged()` | 參數名 `playerDp` | `_setFood()` | ⚠ 混用 |
| **HUD 顯示** | `BattleHUD.ts` | — | `_foodLabel`、`_setFood()`、`FoodLabel` | ✅ 已更名 |
| **Layout JSON** | `battle-hud-main.json` | — | `FoodLabel` / `foodLabel` | ✅ 已更名 |
| **資料綁定** | `BattleBindData.ts` | — | `food` 欄位 | ✅ 已更名 |
| **日誌輸出** | `BattleScene.onTurnPhaseChanged()` | `snap.playerDp` | 顯示文字用「糧草」 | ⚠ 混用 |


**根因結論**：UI 顯示層（BattleHUD、Layout JSON）已完成 DP → Food 更名，但**底層數據流（Constants → BattleSystem → BattleController → BattleScene → 事件 payload）完全未更名**。目前透過 `_setFood(snap.playerDp, ...)` 做了隱式轉換，功能上暫時不受影響，但語意不一致會造成：
1. 新開發者閱讀代碼時的認知混亂
2. 未來若 `playerDp` 與 `food` 在機制上分道（規格中糧草不再每回合增長），將難以分離
3. 搜尋 `dp` 或 `food` 時無法全面定位相關代碼

---

## 二、架構耦合度評估 (Architecture Review)

### 2.1 UI 組件與戰鬥邏輯的耦合度

```
BattleScene (場景入口，God Object 傾向)
  ├── BattleController (純邏輯控制器)
  │     └── BattleState (棋盤資料模型)
  ├── BattleHUD (@property 綁定)
  ├── DeployPanel (@property 綁定)
  ├── BattleLogPanel (@property 綁定)
  ├── BattleScenePanel (@property 綁定 → 內部管理子面板)
  │     ├── TigerTallyPanel (自動建立或 Inspector 綁定)
  │     ├── UnitInfoPanel (自動建立)
  │     └── ActionCommandPanel (自動建立)
  ├── BoardRenderer (3D 棋盤渲染)
  ├── UnitRenderer (3D 兵種渲染)
  └── ResultPopup (@property 綁定)
```

**耦合問題分析：**

| 維度 | 現況 | 風險 |
|---|---|---|
| **BattleScene 職責過重** | BattleScene.ts 超過 1100 行，同時負責：服務初始化、控制器管理、UI 連結、事件訂閱、射線偵測、回合驅動、視覺佇列排程 | 任何一項變更都需要修改此檔案，是所有 Bug 的集散中心 |
| **雙重管理體系** | BattleScene 直接持有 `hud`、`deployPanel`、`battleLogPanel`，同時又透過 `battleScenePanel` 管理 TigerTallyPanel 等。兩者之間的職責劃分不清晰 | 糧草更新同時由 `BattleScene.onUnitDeployed()` 直接呼叫 `hud.setFood()` 以及由 `BattleHUD._onTurnPhaseChanged()` 事件驅動，存在重複更新與一致性風險 |
| **Inspector 與 Code-first 混合模式** | 每個 `ensure*()` 方法都做「Inspector 未綁定時自動尋找/建立」的 fallback。這導致同一個面板可能同時存在 Inspector 版本與 Code-first 版本 | Inspector 綁定斷裂時不會報錯，只會靜默建立新實例，舊實例仍掛在場景樹中佔用資源 |
| **事件系統碎片化** | 部分通訊走全局事件（`services().event.on(EVENT_NAMES.xxx)`），部分走節點事件（`node.on("endTurn")`），部分走函式指標（`onCardSelect`），部分走直接呼叫（`hud.refresh()`） | 同一類型的通訊使用不同機制，難以追蹤和調試 |

### 2.2 BattleScene 初始化流程中的 UI 異步加載競爭

`BattleScene.start()` 是一個巨大的 `async` 方法，大致流程如下：

```
start() [async]
  1. services().initialize()
  2. BattleController 載入資料 [await]
  2.5 載入技能 + VFX [await Promise.all]
  3. 載入遭遇戰設定 [await]
  4. 建立武將 [await]
  5. initBattle()
  6. ensure*() 系列 — UI 節點自動尋找/建立 [同步]
  6-1. battleScenePanel.wirePanels() [同步]
  6-2. setCards() / setUltimateSkills() [同步，但子面板可能未 ready]
  → hud.refresh() [同步呼叫，但 HUD buildScreen 可能未完成]
  7. subscribeEvents()
  8. 監聯 DeployPanel/BattleLogPanel 節點事件
```

**關鍵競爭點（參考 `battle-ui-p0-battle-hud-timing-fix_task.md`）：**

步驟 6 中 `ensureHUD()` → `addComponent(BattleHUD)` 會觸發 `BattleHUD.onLoad()` → `_initialize()` [async，不 await]。但步驟 6 之後立即呼叫 `hud.refresh()`，此時 `_initialized = false`。

**已有緩解措施（方案 A 已部分實施）**：
- `BattleHUD.refresh()` 在 `_initialized = false` 時暫存參數到 `_pendingRefreshArgs`
- `_initialize()` 完成後呼叫 `_replayPendingRefresh()` 重播

**尚未修復的競爭**：
- `TigerTallyPanel.setCards()` 在 `buildScreen()` 完成前被呼叫 → `onReady()` 中有重播（第 153-156 行）✅
- `ActionCommandPanel` 同樣繼承 `UIPreviewBuilder`，但目前未見對應的 pending 機制
- `DeployPanel` 的 `ensureBindings()` 在 `onLoad()` 中同步執行，若 Inspector 未綁定則按鈕為 null，後續 `bindSlotButtons()` 靜默跳過

---

## 三、優化與重構建議 (Optimization Proposals)

### 3.1 解耦方案：分層事件總線

**現況問題**：BattleScenePanel 對子面板的直接引用（`this.tigerTallyPanel.onCardSelect = ...`）在 v3 UI 重組後極度脆弱。

**建議：引入分層事件架構**

```
┌─────────────────────────────────────────────┐
│  Global Event Bus (services().event)        │
│  ► 戰鬥邏輯事件：TurnPhaseChanged, etc.     │
│  ► 跨面板通訊：UltimateSkillSelected, etc.  │
└──────────────┬──────────────────────────────┘
               │
┌──────────────┴──────────────────────────────┐
│  UI Event Bus (新增，BattleScenePanel 持有)  │
│  ► UI 內部事件：CardSelected, DeployRequest │
│  ► 替代函式指標與 node.emit 模式             │
└──────────────┬──────────────────────────────┘
               │
┌──────────────┴──────────────────────────────┐
│  子面板（TigerTallyPanel, DeployPanel 等）   │
│  ► 只 emit/listen UI Event Bus              │
│  ► 不直接引用其他子面板                      │
└─────────────────────────────────────────────┘
```

**具體改動**：

```typescript
// 新增：UI 事件常數
export const UI_EVENTS = {
    CardSelected: 'ui:card-selected',
    DeployRequest: 'ui:deploy-request',
    EndTurnRequest: 'ui:end-turn-request',
    TacticsRequest: 'ui:tactics-request',
} as const;

// TigerTallyPanel 改為 emit 事件，不再依賴 onCardSelect 函式指標
private _onCardClick(index: number): void {
    const data = this._cards[index];
    if (!data) return;
    services().event.emit(UI_EVENTS.CardSelected, { index, data });
}

// BattleScenePanel 訂閱事件而非直接設定回呼
private _subscribeEvents(): void {
    this._unsubs.push(
        services().event.on(UI_EVENTS.CardSelected, this._onCardSelected.bind(this)),
    );
}
```

**好處**：
1. 消除 `_wireCallbacks()` 的時序依賴 — 事件訂閱與發送解耦
2. 子面板可獨立初始化，不需等待協調器先綁回呼
3. 新增面板時不需修改 BattleScenePanel

### 3.2 防錯機制：運行時節點綁定驗證

**問題**：Inspector 節點引用斷裂時完全靜默，`ensure*()` 方法建立的替代實例可能與場景中已有的重複。

**建議：啟動時驗證 + 開發模式警告**

```typescript
/**
 * 在 onLoad() 或 start() 中呼叫，檢查所有 @property 綁定是否完整。
 * 開發模式下以 console.error 輸出，生產模式靜默降級。
 */
private _validateInspectorBindings(): void {
    const bindings: Record<string, unknown> = {
        'battleHUD': this.battleHUD,
        'deployPanel': this.deployPanel,
        'battleLogPanel': this.battleLogPanel,
        'battleScenePanel': this.battleScenePanel,
        'resultPopup': this.resultPopup,
    };
    for (const [name, ref] of Object.entries(bindings)) {
        if (!ref) {
            console.warn(
                `[BattleScene] ⚠ Inspector 綁定缺失：${name}。` +
                `將使用 Code-first fallback，請確認場景節點結構。`
            );
        }
    }
}
```

**進階：子面板就緒契約**

```typescript
// 所有基於 UIPreviewBuilder 的面板實作統一的 whenReady() Promise
interface IReadyPanel {
    whenReady(): Promise<boolean>;
}

// BattleScene 在呼叫 refresh/setCards 前等待
await Promise.all([
    this.hud?.whenReady(),
    this.battleScenePanel?.tigerTallyPanel?.whenReady(),
]);
this.hud?.refresh(...);
this.battleScenePanel?.setCards(cards);
```

> 注：`BattleHUD` 和 `TigerTallyPanel` 中已有 `_readyWaiters` 陣列與 `_flushReadyWaiters()` 機制，但 `BattleScene` 並未使用。建議將此機制統一暴露為 `whenReady(): Promise<boolean>` 公開 API。

### 3.3 虎符拖拽部署：DragAndDrop 狀態機重構

**現況問題**：
- 拖拽狀態散佈在 `DeployPanel` 的多個布爾旗標（`isDragging`）和回呼（`dragDropCallback`）中
- `processDragEnd()` 使用 `scheduleOnce(0.1)` 的時間延遲判斷部署是否成功，這是脆弱的 heuristic
- `BattleScene.doDeployRaycast()` 與 `DeployPanel.endDrag()` 之間的呼叫關係隱晦

**建議：顯式狀態機**

```
┌─────────┐  TOUCH_START   ┌──────────┐  TOUCH_MOVE  ┌──────────┐
│  IDLE   │ ──────────────→ │ SELECTED │ ────────────→│ DRAGGING │
└─────────┘                 └──────────┘              └────┬─────┘
     ↑                           │                         │
     │         CLICK (tap)       │      TOUCH_END          │
     │    ←──────────────────────┘          │               │
     │                              ┌──────┴──────┐        │
     │                              │ VALIDATING  │←───────┘
     │                              │ (Raycast)   │
     │                              └──────┬──────┘
     │                    invalid ↙        │ valid
     │              ┌──────────┐    ┌──────┴──────┐
     └──────────────┤ CANCELLED│    │  DEPLOYED   │
                    └──────────┘    └─────────────┘
```

**好處**：
1. 消除 `scheduleOnce(0.1)` 的時間假設 — 改為射線偵測完成後直接 emit 結果
2. 每個狀態有明確的進入/退出動作，便於調試
3. `VALIDATING` 狀態可加入視覺反饋（如格子高亮閃爍）

---

## 四、實作路線圖 (Implementation Roadmap)

### Phase 1 — 緊急修復（1-3 天）

| # | 任務 | 優先級 | 影響檔案 |
|---|---|---|---|
| F-1 | **修復 Inspector 雙實例問題**：在 `_ensureSubPanels()` 中，若 Inspector 已綁定則跳過自動建立；在 `ensureDeployPanel()` / `ensureHUD()` 同理，避免產生重複面板 | P0 | `BattleScenePanel.ts`, `BattleScene.ts` |
| F-2 | **修復 DeployPanel 節點名稱硬編碼**：將 `getChildByName("Panel")` 改為配置常數或多名稱 fallback | P0 | `BattleScene.ts` |
| F-3 | **統一 whenReady() API**：在 `BattleHUD`、`TigerTallyPanel`、`BattleLogPanel`、`ActionCommandPanel` 暴露 `whenReady(): Promise<boolean>`，BattleScene 在呼叫業務 API 前 await | P0 | 各面板 `.ts`, `BattleScene.ts` |
| F-4 | **加入啟動時 Inspector 綁定驗證**：`_validateInspectorBindings()` 在開發模式輸出缺失警告 | P1 | `BattleScene.ts` |

### Phase 2 — 用語統一（3-5 天）

| # | 任務 | 優先級 | 影響檔案 |
|---|---|---|---|
| N-1 | **Constants.ts 更名**：`INITIAL_DP` → `INITIAL_FOOD`、`DP_PER_TURN` → `FOOD_PER_TURN`、`MAX_DP` → `MAX_FOOD` | P1 | `Constants.ts` + 所有引用處 |
| N-2 | **BattleSystem.ts 更名**：`playerDp` → `playerFood`、`canSpendDp()` → `canSpendFood()`、`spendDp()` → `spendFood()` | P1 | `BattleSystem.ts` + 事件訂閱處 |
| N-3 | **TurnSnapshot 介面更名**：`playerDp` → `playerFood` | P1 | 全局搜索 `playerDp` |
| N-4 | **BattleController.ts 更名**：`enemyDp` → `enemyFood` | P1 | `BattleController.ts` |
| N-5 | **BattleScene.ts 日誌與呼叫更名** | P2 | `BattleScene.ts` |

### Phase 3 — 架構重構（1-2 週）

| # | 任務 | 優先級 | 影響檔案 |
|---|---|---|---|
| R-1 | **引入 UI Event Bus**：建立 `UI_EVENTS` 常數，TigerTallyPanel / ActionCommandPanel / BattleLogPanel 改用事件發佈，BattleScenePanel 改用事件訂閱 | P2 | 新增 `UIEvents.ts`、修改各面板 |
| R-2 | **拆分 BattleScene**：將 UI 連結邏輯抽取為 `BattleUIBridge.ts`，將回合驅動邏輯抽取為 `TurnFlowManager.ts` | P2 | `BattleScene.ts`（瘦身至 <400 行） |
| R-3 | **DeployPanel 狀態機重構**：以 `DeployDragState` enum 取代布爾旗標，消除 `scheduleOnce` 時間假設 | P2 | `DeployPanel.ts` |
| R-4 | **消除 Inspector / Code-first 雙軌模式**：統一選擇一種策略（建議 Code-first），移除 `ensure*()` 的 fallback 邏輯 | P3 | 所有 `ensure*()` 方法 |

### Phase 4 — 防護與測試（持續）

| # | 任務 | 優先級 |
|---|---|---|
| T-1 | **建立 UI 初始化整合測試**：驗證 `BattleScene.start()` 完成後所有面板 `whenReady()` 均為 true、所有節點引用非 null | P2 |
| T-2 | **建立 DP → Food 更名回歸測試**：確保重構後糧草數值在 HUD、日誌、Toast 中正確顯示 | P2 |
| T-3 | **CI 加入場景結構驗證**：掃描場景 JSON 中的節點名稱與 `ensure*()` / `getChildByName()` 的字串是否一致 | P3 |

---

## 五、附錄

### A. 已知相關任務卡

| 任務 ID | 狀態 | 關聯 |
|---|---|---|
| `battle-ui-p0-battle-hud-timing-fix` | done | 本文 §2.2 — HUD 時序競爭已部分修復 |
| `battle-ui-p0-battle-log-scrollview-fix` | not-started | BattleLogPanel ScrollView 斷鏈 |
| `battle-ui-p0-duel-challenge-fix` | not-started | DuelChallengePanel i18n + 定位 |
| `battle-ui-p1-hp-bar-visual` | in-progress | HP 進度條視覺 |

### B. 關鍵檔案清單

| 檔案 | 角色 |
|---|---|
| `assets/scripts/battle/views/BattleScene.ts` | 場景入口 / God Object |
| `assets/scripts/ui/components/BattleScenePanel.ts` | UI 總調度器 |
| `assets/scripts/ui/components/BattleHUD.ts` | TopBar HUD |
| `assets/scripts/ui/components/DeployPanel.ts` | 兵種部署面板 |
| `assets/scripts/ui/components/TigerTallyPanel.ts` | 虎符卡片欄 |
| `assets/scripts/ui/components/ActionCommandPanel.ts` | 奧義指令區 |
| `assets/scripts/ui/components/BattleLogPanel.ts` | 戰鬥日誌 |
| `assets/scripts/battle/controllers/BattleController.ts` | 戰鬥邏輯控制器 |
| `assets/scripts/battle/models/BattleState.ts` | 棋盤資料模型 |
| `assets/scripts/core/systems/BattleSystem.ts` | 回合/糧草系統 |
| `assets/scripts/core/config/Constants.ts` | 全局常數 (DP 殘留) |
| `assets/scripts/core/models/GeneralUnit.ts` | 武將資料模型 |