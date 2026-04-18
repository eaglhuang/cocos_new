<!-- doc_id: doc_task_0015 -->
# 戰場入口統一 — Checklist

> 追蹤「Lobby → Battle 與 Preview Target 5 統一化」工作的所有步驟與進度。

## Phase A: 定義資料介面

- [x] 新增 `BattleEntryParams` 介面（`assets/scripts/battle/models/BattleEntryParams.ts`）
- [x] 新增 `Weather` enum（`Constants.ts`）
- [x] 新增 `BattleTactic` enum（`Constants.ts`）
- [x] 擴充 `EncounterConfig`（增加 weather / battleTactic / equipment 欄位）
- [x] 新增 `DEFAULT_BATTLE_ENTRY_PARAMS` 預設值
- [x] 新增 `formatBattleEntryLog()` log 格式器

## Phase B: 統一 BattleScene 入口

- [x] 新增 `_resolveBattleParams()` 方法
- [x] `start()` 使用 resolved params 取代硬編碼 encounter-001 / zhang-fei / lu-bu
- [x] 印出正式入口 log（`[大廳進入戰場]` vs `[QA工具進入戰場]`）
- [x] `buildTallyCards()` 接受 `selectedCardIds?` 參數

## Phase C: Lobby 側對接

- [x] `LobbyScene.onClickEnterBattle()` 構造並傳遞 `BattleEntryParams`
- [x] 確認 `SceneManager.switchScene()` 已支援 `data?` 參數（原本就有）
- [x] 確認 `LoadingScene._startTransition()` 不需改動（透傳 data）

## Phase D: Preview Target 5 統一化

- [x] `_resolveBattleParams()` fallback 到 `DEFAULT_BATTLE_ENTRY_PARAMS`（Preview 路徑不需改 LoadingScene）
- [x] `_isBattleCaptureMode()` 語義不變，capture + preview 都走統一 `_resolveBattleParams()`

## Phase E: Browser 端對端驗證路徑

- [x] 新增 `LoadingPreviewTarget.BattleSceneFromLobby = 11`
- [x] 新增 `_previewBattleSceneFromLobby()` 方法（Lobby → Battle 完整路徑）
- [x] 新增 `capture-ui-screens.js` target: `BattleSceneFromLobby`

## Phase F: 文件

- [x] 撰寫 `docs/battle-entry-path-comparison.md`（兩條路徑差異對照）
- [x] 撰寫本 checklist

## 驗證

- [x] TypeScript 全專案無新編譯錯誤
- [x] 編碼檢查通過（無 BOM / mojibake）
- [x] `capture-ui-screens --target BattleScene` → console 印出 `[QA工具進入戰場]` log ✅ `[QA工具進入戰場] 預設參數為：我軍主將(張飛)...`
- [x] `capture-ui-screens --target BattleSceneFromLobby` → console 印出 `[大廳進入戰場]` log ✅ `[大廳進入戰場] 正式參數為：我軍主將(張飛)...`
- [x] 兩張截圖視覺幾乎相同（同組預設參數）✅ 同地圖格線 / 同 HUD 佈局 / 同鏡頭角度
- [x] Cocos Editor asset-db refresh 成功

## 後續優化（非阻塞）

- [x] BattleScene 實際截圖驗收：正式 QA 流程確認左側 R/SR/UR/LR 虎符卡列與右側 detail panel runtime 殘差（target 11 / scene-graph click / before-after capture）✅ (2026-04-14)
- [x] detail panel 第二版：將 source / lore / traits / abilities 從摘要式抽屜改為可讀的模組化右側 panel v2，並清除 `TigerTallyDetailRoot` 自動縮放殘差 ✅ (2026-04-14)
- [x] shell family 精修：強化 R/SR/UR/LR tier tint / plaque / rail 差異，並清掉 type badge 假殘差 fallback warn ✅ (2026-04-14)
- [x] `Weather` / `BattleTactic` 接入 `BattleState` + `BattleController.initBattle()` 實際消費 ✅ (2025-01)
- [x] `encounters.json` 增加 `weather` / `battleTactic` 欄位（encounter-001: clear/normal, encounter-002: fog/ambush-attack）✅ (2025-01)
- [x] `SceneManager.setNextScene()` 增加（供 QA preview 直接注入目標，避免橋接 LoadingScene 遞迴問題）✅ (2025-01)
- [x] `_isBattleCaptureMode()` 擴充至同時支援 previewTarget=5 與 previewTarget=11
- [ ] 讓 Preview Target 5 也走 `SceneManager.switchScene` 完整中繼路徑（需要 LoadingScene 先 init ServiceLoader）
- [ ] 實作 `selectedCardIds` 查卡功能（目前一律走 demo 預設卡組）
- [ ] Lobby 出戰前 UI（選將、選裝備、選卡組）→ 填入真實 `BattleEntryParams`
- [ ] ServiceLoader 重複初始化的長期處理（雖然目前冪等，但 state 殘留風險需持續觀察）
