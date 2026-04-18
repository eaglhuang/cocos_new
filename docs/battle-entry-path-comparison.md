<!-- doc_id: doc_tech_0020 -->
# 戰場入口路徑對照與統一架構

> 追蹤 BattleScene 兩條入口路徑（Lobby 正式入口 vs QA Preview Target 5）的差異，以及統一後的架構設計。

## 1. 兩條路徑流程圖

### Preview Target 5（QA 工具 / 開發用）

```
LoadingScene._previewBattleScene()
  → director.loadScene('BattleScene')     ← 直接跳轉，跳過中繼
    → BattleScene.start()
      → _resolveBattleParams()            ← SceneManager data 為空 → 使用 DEFAULT_BATTLE_ENTRY_PARAMS
      → console.log("[QA工具進入戰場] 預設參數為：...")
```

### Lobby 正式入口（生產路徑）

```
LobbyScene.onClickEnterBattle()
  → SceneManager.switchScene("BattleScene", BattleEntryParams)
    → director.loadScene("LoadingScene")  ← 經過中繼場景
      → LoadingScene._startTransition()
        → releaseAll()                    ← 釋放前場景資源
        → preloadScene("BattleScene")
        → director.loadScene("BattleScene")
          → BattleScene.start()
            → _resolveBattleParams()      ← 從 SceneManager.data 讀取 BattleEntryParams
            → console.log("[大廳進入戰場] 正式參數為：...")
```

### BattleSceneFromLobby（QA 驗證用 — Preview Target 11）

```
LoadingScene._previewBattleSceneFromLobby()
  → director.loadScene('LobbyScene')
    → LobbyScene.start() + waitForReady()
      → lobbyScene.onClickEnterBattle()   ← 走 Lobby 正式路徑
        → SceneManager.switchScene(...)
          → LoadingScene → BattleScene    ← 完整生產路徑
```

---

## 2. BattleScene 自建節點（兩條路徑完全相同）

以下節點全部由 `BattleScene.start()` 自行初始化，與入口路徑無關：

| 類別 | 節點 / 元件 | 說明 |
|---|---|---|
| 核心邏輯 | `ServiceLoader` | DI 容器（冪等初始化） |
| 核心邏輯 | `BattleController` | 戰鬥控制器 |
| 核心邏輯 | `ActionSystem` / `VFX` | 技能 + 特效系統 |
| 戰場渲染 | `BoardRenderer` | 棋盤格渲染 |
| 戰場渲染 | `UnitRenderer` | 兵種單位渲染 |
| 戰場渲染 | `SceneBackground` | 場景背景 |
| UI 面板 | `BattleHUD` | 血量 / 糧草 / 回合 HUD |
| UI 面板 | `DeployPanel` | 部署面板 |
| UI 面板 | `ResultPopup` | 戰果彈窗 |
| UI 面板 | `DuelChallengePanel` | 單挑挑戰面板 |
| UI 面板 | `BattleScenePanel` | 戰場 UI 總調度器 |
| UI 子面板 | `TigerTallyComposite` | 虎符卡片面板 |
| UI 子面板 | `TigerTallyDetailComposite` | 虎符詳細資訊面板 |
| UI 子面板 | `ActionCommandPanel` | 行動指令面板 |
| UI 子面板 | `UnitInfoComposite` | 兵種資訊面板 |
| UI 子面板 | `BattleLogComposite` | 戰鬥日誌面板 |

---

## 3. Lobby 正式入口才有的潛在風險

| 風險 | 說明 | 現況 |
|---|---|---|
| **ServiceLoader 重複初始化** | LobbyScene 已 `services().initialize()`，BattleScene 再次呼叫 | ✅ `ServiceLoader.initialize()` 已是冪等的（`if (this.initialized) return`） |
| **LoadingScene 資源釋放** | `_startTransition()` 會 `releaseAll()` 清掉共用資源，BattleScene 需重新載入 | ⚠️ 已知行為，BattleScene 會自行載入所需資源 |
| **全局狀態殘留** | Lobby 中的選擇、對話、Toast 等全局狀態可能殘留 | ⚠️ 目前無清理機制，但戰場不消費這些狀態 |
| **Preview 跳過中繼** | Preview Target 5 不經過 LoadingScene 中繼，不釋放資源 | ✅ 開發用途無害，可透過 Target 11 驗證完整路徑 |

---

## 4. 統一後的架構

### BattleEntryParams 介面

所有入口路徑統一透過 `BattleEntryParams` 傳遞參數：

```typescript
interface BattleEntryParams {
  entrySource: 'lobby' | 'preview' | 'replay';
  encounterId: string;
  playerGeneralId: string;
  enemyGeneralId: string;
  playerEquipment?: string[];
  enemyEquipment?: string[];
  selectedCardIds?: string[];
  weather: Weather;
  battleTactic: BattleTactic;
  backgroundId?: string;
}
```

### 入口 Log 格式

- Lobby: `[大廳進入戰場] 正式參數為：我軍主將(張飛) 裝備: (無裝備), 帶虎符軍隊: 虎豹騎/陷陣營/大戟士/連弩手, 敵軍 呂布 裝備: (無裝備), 天氣: 晴天, 遭遇戰: 虎牢關之戰, 戰法: 普通`
- Preview: `[QA工具進入戰場] 預設參數為：...`（相同格式，標籤不同）

### 相關檔案

| 檔案 | 職責 |
|---|---|
| `assets/scripts/battle/models/BattleEntryParams.ts` | 介面 + 預設值 + log 格式器 |
| `assets/scripts/core/config/Constants.ts` | Weather / BattleTactic enum |
| `assets/scripts/battle/views/BattleScene.ts` | `_resolveBattleParams()` 統一入口 |
| `assets/scripts/battle/views/BattleSceneLoader.ts` | EncounterConfig 擴充 |
| `assets/scripts/ui/scenes/LobbyScene.ts` | 傳遞 BattleEntryParams |
| `assets/scripts/ui/scenes/LoadingScene.ts` | PreviewTarget 11 (BattleSceneFromLobby) |
| `tools_node/capture-ui-screens.js` | 新增 BattleSceneFromLobby target |
