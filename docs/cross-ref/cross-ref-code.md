<!-- doc_id: doc_index_0001 -->
# Cross-Reference: 代碼索引（代碼 ↔ 規格書 雙向映射）

> 這是 doc_index_0005 的 B 節分片。完整索引見 `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)。
> 最後更新請參考母檔 Header。
>
> **doc_id 查詢**：用 `node tools_node/resolve-doc-id.js <搜尋詞>` 查文件代號，或瀏覽 `docs/doc-id-registry.md (doc_other_0001)` (doc_other_0001)。
> ⚠️ **壓縮版（doc_id 索引）**：中文名稱已移除，查詢名稱請用 resolve-doc-id.js。人類可讀進度 → `docs/cross-ref/cross-ref-進度.md (doc_index_0017)` (doc_index_0017)

## B. 代碼索引（代碼 ↔ 規格書 雙向映射）

### B-1. 代碼 → 規格書

> 每個 .ts 檔對應的規格書來源，標示資料結構(D) / 公式(F) / 常數(C) / 概念(概) 的引用類型。

#### Core Systems (`assets/scripts/core/systems/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| FormulaSystem.ts | doc_data_0001, doc_spec_0012 | F: calculateDamage, getCounterMultiplier, calculateHeal, calculateGeneralAttack, getCritChance, getDodgeChance, rollCrit, rollDodge; D: DamageContext, GeneralCombatParams; C: COUNTER_MULTIPLIER, GENERAL_BASE_CRIT_CHANCE, GENERAL_MAX_CRIT_CHANCE, GENERAL_CRIT_DAMAGE_MULTIPLIER, GENERAL_BASE_DODGE_CHANCE, GENERAL_MAX_DODGE_CHANCE |
| BattleSystem.ts | doc_spec_0040, doc_data_0001 | D: TurnSnapshot, TurnPhase; C: INITIAL_DP, DP_PER_TURN, GRID_LANES, GRID_DEPTH |
| BuffSystem.ts | doc_spec_0010 | D: BuffEntry, StatusEffect; 概: 狀態效果管理 |
| ActionSystem.ts | doc_spec_0038, doc_spec_0030 | D: SkillDef, ActionStep, ActionContext; 概: 技能時間軸演出 |
| EventSystem.ts | doc_tech_0015 | 概: Pub/Sub 事件匯流排 |
| PoolSystem.ts | doc_tech_0015 | 概: 物件池回收管理 |
| ResourceManager.ts | doc_tech_0013, doc_tech_0015, doc_art_0003 | 概: JSON/Prefab/SpriteFrame 載入與快取 |
| EffectSystem.ts | doc_tech_0015 | 概: VFX 生命週期管理 |
| AudioSystem.ts | doc_tech_0015 | 概: BGM/SFX 混音管理 |
| FloatTextSystem.ts | doc_tech_0015 | D: FloatTextType; C: FLOAT_CONFIGS |
| I18nSystem.ts | doc_tech_0015, doc_art_0003 | 概: 多語系載入框架與字型目錄治理 |
| MaterialSystem.ts | doc_art_0003, doc_index_0011 §7 | D: OutfitConfig, ShaderEntry; 概: 材質實例與 Shader warmup |
| MemoryManager.ts | doc_tech_0015 | D: AssetRecord; 概: 資產追蹤與釋放 |
| CurveSystem.ts | doc_tech_0015 | 概: 非線性數值曲線（AnimationCurve 對等） |
| NetworkService.ts | doc_tech_0013 | 概: Web/Native 離線網路狀態偵測 |
| SyncManager.ts | doc_tech_0013 | 概: 離線 Action Log 佇列與 HMAC 背景同步 |
| **server/src/index.ts** | doc_tech_0013 | 概: 後端驗證引擎 (Event Replay) 原型 |

#### Core Models (`assets/scripts/core/models/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| TroopUnit.ts | doc_spec_0012, doc_data_0001 | D: TroopStats, TroopUnit class; C: TroopType enum |
| GeneralUnit.ts | TBD_DOC_IDS（scan-required） | D: `GeneralConfig`, `GeneralUnit` class；`historicalAnecdote / bloodlineRumor / storyStripCells / crestHint / crestState` 欄位契約待 crossref-progress-scanner 補全 |

#### Shared Contracts (`shared/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| skill-runtime.ts | doc_spec_0038, doc_spec_0030, doc_tech_0013 | D: `SkillSourceType`, `BattleSkillTargetMode`, `BattleSkillTiming`, `TacticModuleType`, `UltimateEffectFamily`, `BattleSkillRequest`, `BattleSkillDefinitionDraft`, `SkillExecutionResult`；概: 戰法 / 奧義共用 runtime contract draft |
| protocols.ts | doc_tech_0013 | D: `ActionRecord`, `SyncRequest`, `SyncResponse` |

#### Core Data (`assets/scripts/core/data/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BattleBindData.ts | doc_ui_0001, BattleScene layouts | D: BattleStateData, UnitDisplayData, TallyUnitData, BattleActionData, BattleLogData; 概: BattleScene 動態 label 的 ViewModel 契約（DATA-1-0001，2026-04-05）|

#### Core Config (`assets/scripts/core/config/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| Constants.ts | doc_data_0001, doc_spec_0012 | D: TurnPhase, Faction, TroopType, TerrainType, StatusEffect; C: GAME_CONFIG, TROOP_COUNTER_MAP, TROOP_DEPLOY_COST, SP_PER_KILL |
| UIConfig.ts | doc_ui_0027, doc_ui_0001, doc_spec_0002, doc_spec_0014 | D: UIID, LayerType; C: UIConfig 映射表 |
| UnitAssetCatalog.ts | doc_art_0003 | D: TroopUnitAssetEntry, HeroUnitAssetEntry; C: TROOP_UNIT_ASSET_CATALOG, HERO_UNIT_ASSET_CATALOG |
| VfxEffectConfig.ts | doc_tech_0015 | D: VfxEffectDef; C: DEFAULT_VFX_EFFECTS |

#### Core Utils (`assets/scripts/core/utils/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| MaterialUtils.ts | doc_index_0011 §7 棄用 API 管理 | 概: setMaterialSafe wrapper |
| ParticleUtils.ts | doc_tech_0015 | D: ParticleOverride; F: applyParticleOverride |

#### Core Managers (`assets/scripts/core/managers/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| GameManager.ts | doc_spec_0045 | D: GameMode enum; 概: 遊戲模式切換 |
| ServiceLoader.ts | doc_tech_0015 | 概: DI 容器（9+ 服務註冊） |
| UIManager.ts | doc_ui_0027, doc_ui_0001 | 概: 六層 UI 生命週期管理 |
| SceneManager.ts | doc_spec_0031 | 概: A→Loading→B 場景切換；新增 `boardRenderer` 視圖橋（registerBoardRenderer / getBoardRenderer），供 BattleScene ↔ UI 跨組件查詢 |

#### Core Storage (`assets/scripts/core/storage/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| DataStorageAdapter.ts | doc_tech_0009 | 概: 儲存後端抽象層（IndexedDB / SQLite 統一介面）|
| IndexedDbAdapter.ts | doc_tech_0009 | 概: DataStorageAdapter 的 Web 平台 IndexedDB 實作 |
| SqliteAdapter.ts | doc_tech_0009 | 概: DataStorageAdapter 的 Native 平台 SQLite stub |
| DataCatalog.ts | doc_tech_0009 | 概: L0 資料目錄，啟動時載入 generals-index.json |
| DataPageLoader.ts | doc_tech_0009 | 概: 分頁查詢器，L1–L5 分層載入 |
| GeneralSearch.ts | doc_tech_0009 | 概: 武將全文搜索（IndexedDB 查詢 + JS 過濾）|
| SchemaMigration.ts | doc_tech_0009 | 概: 資料 Schema 版本控制與漸進式遷移機制 |

#### Core Services (`assets/scripts/core/services/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| SaveSerializer.ts | doc_tech_0009 | 概: 存檔序列化 + 壓縮管線（欄位縮寫 → Msgpack → Gzip）|
| GeneralArchiver.ts | doc_tech_0009 | 概: 武將資料封存服務（DataStorageAdapter 注入）|
| BattleLogArchiver.ts | doc_tech_0009 | 概: 戰鬥日誌封存服務 |
| DataGrowthMonitor.ts | doc_tech_0009 | 概: 資料成長量監控 |
| DataLifecycleScheduler.ts | doc_tech_0009 | 概: 資料生命週期排程（老舊資料清理）|
| DeltaPatchBuilder.ts | doc_tech_0009 | 概: 增量更新補丁產生器 |
| PendingDeleteStore.ts | doc_tech_0009 | 概: 待刪除資料暫存（軟刪除機制）|
| SeasonalRollup.ts | doc_tech_0009 | 概: 季度數據彙整 |

#### Core Serialization (`assets/scripts/core/serialization/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| GzipCodec.ts | doc_tech_0009 | 概: Gzip 壓縮/解壓編解碼器 |
| MsgpackCodec.ts | doc_tech_0009 | 概: MessagePack 序列化編解碼器 |

#### Battle Controllers (`assets/scripts/battle/controllers/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BattleController.ts | doc_spec_0040, doc_data_0001, doc_spec_0012 | D: BattleResult, DeployOutcome; F: 部署驗證、戰鬥結算、TileBuff 計算; C: DEFAULT_STATS |
| EnemyAI.ts | doc_spec_0020, doc_data_0002 | F: decideDeploy（35% 剋制偏向） |

#### Battle Models (`assets/scripts/battle/models/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BattleState.ts | doc_spec_0040, doc_data_0001 | D: GridCell, TileBuff, TerrainGrid; C: 5×8 grid |

#### Battle Views (`assets/scripts/battle/views/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BattleScene.ts | doc_spec_0040, doc_spec_0161, doc_art_0003, doc_spec_0038, doc_spec_0030 | D: EncounterConfig; 概: 戰鬥場景進入點；正式讀取 `tacticSlots[] / ultimateSlots[]`，載入 battle skill metadata，並把戰法摘要 / 奧義列表推入 HUD |
| BattleSceneLoader.ts | doc_spec_0040, doc_spec_0038, doc_spec_0030 | D: EncounterConfig, BattleSkillMetadata; 概: 由 `tactic-library.json` / `ultimate-definitions.json` 建立戰法摘要與奧義執行資料 |
| TurnFlowManager.ts | doc_spec_0040, doc_spec_0038 | 概: 戰中行為流程；`onTactics()` 直接使用正式戰法摘要，不再顯示 placeholder toast |
| BoardRenderer.ts | doc_spec_0040 | 概: 5×8 棋盤渲染 |
| UnitRenderer.ts | doc_art_0003 | D: UnitView, GeneralView; 概: GLB 動態載入 |
| SceneBackground.ts | doc_tech_0015 | 概: 分層相機（BG/3D/UI） |
| SpriteFrameAnimator.ts | — | 概: 幀動畫工具（無直接規格書對應） |

#### Battle Views / Effects (`assets/scripts/battle/views/effects/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BuffGainEffectPool.ts | doc_spec_0010 | D: EffectSlot, BuffEffectConfig; 概: 法陣+圖示+粒子池 |
| BuffEffectPrefabController.ts | doc_spec_0010 | 概: Prefab 結構驗證（Ring/Icon/Spark/Accent） |
| BuffParticleProfileConfig.ts | doc_tech_0015 | D: BuffParticleProfile |

#### UI Components (`assets/scripts/ui/components/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BattleHUD.ts              | doc_ui_0027, doc_ui_0001, doc_ui_0003                       | 概: 回合/糧草(v3 DP→Food)/武將血條即時顯示；頭像點擊→ShowGeneralQuickView event ✅ UIPreviewBuilder 已遷移 |
| BattleLogPanel.ts         | doc_ui_0027, doc_ui_0003                                          | 概: Zone5 滾動式戰鬥日誌+可折疊(v3 移除 EndTurn/Tactics/Duel 至 Zone7) ✅ UIPreviewBuilder → battle-log-{main/default/screen}.json |
| DeployPanel.ts            | doc_spec_0040, doc_ui_0027, doc_art_0003                       | 概: 兵種選擇 4 卡池 + 選路即部署 ✅ UIPreviewBuilder 已遷移 → deploy-panel-{main/default/screen}.json |
| DuelChallengePanel.ts     | doc_spec_0007                                                              | 概: 單挑挑戰/接受 UI ✅ UIPreviewBuilder 已遷移 → duel-challenge-{main/default/screen}.json |
| GeneralDetailComposite.ts | doc_spec_0016, doc_ui_0012, doc_ui_0046                                    | 概: `GeneralDetail` 的 canonical runtime controller；負責 Overview child 與多 tab child 的 show/hide、切頁與資料下發，作為目前正式母路由 |
| GeneralDetailOverviewMapper.ts | TBD_DOC_IDS（scan-required） | 概: `GeneralConfig` 對應 Overview child 的 header / summary / bloodline / crest / story content contract；供 `GeneralDetailComposite -> GeneralDetailOverviewChild` 資料下發使用 |
| GeneralDetailOverviewChild.ts | doc_ui_0012, doc_ui_0046 | 概: `GeneralDetail` 的 Overview child panel；負責 schema preload、content bind、覺醒條與 rarity visuals 套用，作為 unified screen 的首頁子面板 |
| GeneralListPanel.ts       | doc_spec_0016, doc_ui_0012                                             | 概: 武將列表 ✅ UIPreviewBuilder 已遷移 |
| GeneralPortraitPanel.ts   | doc_spec_0016                                                                    | 概: 武將立繪面板 ✅ UIPreviewBuilder 已遷移 |
| ResultPopup.ts            | doc_spec_0040                                                                | 概: 戰鬥結算面板 ✅ UIPreviewBuilder 已遷移 |
| ToastMessage.ts           | doc_ui_0027                                                                   | 概: 通知 Toast ✅ UIPreviewBuilder 已遷移 |
| StyleCheckPanel.ts        | doc_ui_0049                                                                | 概: 風格驗證面板 ✅ UIPreviewBuilder 已遷移 |
| NetworkStatusIndicator.ts | doc_ui_0049, doc_tech_0013 | 概: 斷線警示與背景同步提示 UI ✅ UIPreviewBuilder 已遷移 → network-status-{main/default/screen}.json |
| UIScreenPreviewHost.ts    | doc_ui_0051, doc_ui_0049                                          | 概: 以 `UISpecLoader.loadFullScreen(...)` 建立 screen-driven preview host，供 D-1~D-3 與後續 QA 共用 |

#### UI Core (`assets/scripts/ui/core/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| UIPreviewBuilder.ts | doc_ui_0049, doc_index_0011 §8 | 概: 所有 UI 面板的基類（Unity 對照：Prefab Variant Builder + EditorWindow）；`buildScreen()` 末尾呼叫 `_realignAllWidgets()` + 清空 bind 佔位符 + `onReady(binder)`；子類覆寫 `onReady(binder)` 取代舊 `onBuildComplete()` |
| UIContentBinder.ts | doc_ui_0049, doc_index_0008 §8.3 | 概: Content Contract 資料注入與 schema 驗證；`validate()` 支援 type / enum / range / pattern 四層進階驗證，以 warnings 回報不阻斷 runtime（Unity 對照：ViewModel 資料注入 + 欄位驗證器）|
| UISpecTypes.ts | doc_ui_0049 | D: WidgetDef(hCenter/vCenter), UILayoutNodeSpec, UINodeType(scroll-view 新增), UIWidgetFragmentSpec, UITemplateParamDef, UITemplateComposeItem; F: resolveSize |
| UITemplateBinder.ts | doc_ui_0049, doc_index_0011 §8 | 概: 以 layout id/name 建立節點綁定表，供 `onReady(binder)` 查詢（Unity 對照：GetComponentInChildren 安全封裝）|
| UIPreviewLayoutBuilder.ts | doc_ui_0049 | 概: UIPreviewBuilder 拆分出的佈局計算 helper，負責 Widget 對齊與尺寸套用 |
| UIPreviewNodeFactory.ts | doc_ui_0049 | 概: 依 UILayoutNodeSpec 建立 Cocos 節點；bind path 節點顯示 {xxx.yyy} 佔位文字（buildScreen 後由 clearDynamic pass 清除）|
| UIPreviewShadowManager.ts | doc_ui_0049 | 概: 陰影層（9-slice 偽陰影）管理 |
| UIPreviewStyleBuilder.ts | doc_ui_0049 | 概: 字型/色彩/按鈕狀態渲染 helper |
| UIPreviewStateApplicator.ts | doc_ui_0049, doc_art_0002 | 概: 將 preview content state 套用到 binder（texts / actives / rarity docks），避免 LoadingScene 各 target 手寫注入 |
| UIPreviewDiagnostics.ts | doc_ui_0049 | 概: 建立耗時、節點數量日誌工具 |
| UISkinResolver.ts | doc_ui_0049 | 概: 皮膚 slot 解析（SpriteFrame/ LabelStyle/ ButtonSkin）；已加入 frame.texture null 防禦 |
| UISpecLoader.ts | doc_ui_0049 | 概: ServiceLoader 單例，統一載入 layout/skin/screen/i18n/designTokens JSON |
| DraggableButton.ts        | —                                                                              | 概: 拖曳按鈕（無直接規格書對應）|
| SolidBackground.ts        | doc_ui_0049                                                                | 概: 純色白模背景生成與美術貼圖預防覆蓋機制 |
| ActionCommandPanel.ts     | doc_ui_0001, doc_ui_0003, doc_spec_0038, doc_spec_0030                                     | 概: Zone7 奧義大圓(v3 120px)+EndTurn/Tactics/Duel 80px 軌道圓+奧義選擇彈窗；Tactics 副標與奧義列表來自正式 skill seed 資料流 ✅ UIPreviewBuilder → action-command-{main/default/screen}.json |
| BattleScenePanel.ts       | doc_ui_0001, doc_spec_0038, doc_spec_0030                                                              | 概: 戰場UI總調度器；`ensureCanvasHost()` 統一建立子面板節點並設定 layer/size(1920×1080)/Widget.ALWAYS，並承接 battle loader 輸出的戰法摘要 / 奧義列表 |
| TigerTallyPanel.ts        | doc_ui_0001, doc_spec_0012, doc_ui_0003               | 概: Zone3 虎符卡片欄（v3 AtkLabel⚔/HpLabel❤ 頂角 + UnitTypeBadge 32px）✅ UIPreviewBuilder → tiger-tally-{main/default/screen}.json |
| UnitInfoPanel.ts          | doc_ui_0001, doc_spec_0012                                         | 概: 兵種詳情滑出面板（fadeIn/fadeOut 0.2s）✅ UIPreviewBuilder → unit-info-panel-{main/default/screen}.json |
| GeneralQuickViewPanel.ts  | doc_ui_0003 §v3-5                                                  | 概: Zone1 頭像點擊觸發武將快覽彈窗（名稱/HP/攻防/戰法，敵方遮蔽）✅ UIPreviewBuilder → general-quickview-{main/default/screen}.json |
| ChildPanelBase.ts | doc_ui_0049 | 概: UCUF 子面板基類 |
| CompositePanel.ts | doc_ui_0049 | 概: UCUF 複合面板容器 |
| UILayoutConfig.ts | doc_ui_0049 | 概: UI 佈局設定資料結構 |
| UIPreviewTextCatalog.ts | doc_ui_0049 | 概: 預覽文字目錄（佔位文字字典）|
| UIRarityMark.ts | doc_ui_0049 | 概: 稀有度標記元件 |
| UIRarityMarkVisual.ts | doc_ui_0049 | 概: 稀有度標記視覺渲染器 |
| UITemplateResolver.ts | doc_ui_0049 | 概: UI 模板解析器（template param 展開）|
| UIValidationRunner.ts | doc_ui_0049 | 概: UI 規格驗證執行器 |

#### UI Core Panels (`assets/scripts/ui/core/panels/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| AttributePanel.ts | doc_ui_0049 | 概: 屬性面板（數值展示）|
| GridPanel.ts | doc_ui_0049 | 概: 格狀排列面板 |
| ProgressBarPanel.ts | doc_ui_0049 | 概: 進度條面板 |
| RadarChartPanel.ts | doc_ui_0049 | 概: 雷達圖面板 |
| ScrollListPanel.ts | doc_ui_0049 | 概: 捲動列表面板 |

#### UI Layers & Scenes (`assets/scripts/ui/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| UILayer.ts | doc_ui_0027 | 概: UI 面板基類（show/hide） |
| LoadingScene.ts | doc_spec_0031, doc_ui_0051, doc_art_0002 | 概: 過場載入場景，同時也是 screen-driven preview hub（`previewMode` + `previewTarget` + `previewVariant`）；以 content state + applicator 驅動 Gacha / SpiritTally preview 注入 |
| LobbyScene.ts | doc_spec_0031, doc_spec_0002, doc_spec_0014, doc_spec_0016, doc_ui_0012, doc_spec_0015, doc_spec_0007, doc_spec_0032, doc_spec_0038, doc_spec_0030 | 概: 大廳（LobbyMain + 武將列表 + 詳情）；含 `onClickGeneralDetailOverviewSmoke()` 與 `onClickGeneralDetailSkillsSmoke()` smoke routes，可直接驗證 `LobbyMain -> GeneralListPanel -> GeneralDetailComposite -> Skills child` 的正式 skill seed 資料流 |
| LoginScene.ts | doc_spec_0031 | 概: 登入畫面 |

#### UI Spec JSON（三層 JSON 系統，截至 2026-03-30）

| JSON 系統 | Layout | Skin | Screen | Bundle | 對應 TS |
|---|---|---|---|---|---|
| battle-hud     | battle-hud-main.json     | battle-hud-default.json     | battle-hud-screen.json     | battle_ui | BattleHUD.ts |
| battle-log     | battle-log-main.json     | battle-log-default.json     | battle-log-screen.json     | battle_ui | BattleLogPanel.ts |
| deploy-panel   | deploy-panel-main.json   | deploy-panel-default.json   | deploy-panel-screen.json   | battle_ui | DeployPanel.ts |
| duel-challenge | duel-challenge-main.json | duel-challenge-default.json | duel-challenge-screen.json | battle_ui | DuelChallengePanel.ts |
| network-status | network-status-main.json | network-status-default.json | network-status-screen.json | ui_common | NetworkStatusIndicator.ts |
| result-popup   | result-popup-main.json   | result-popup-default.json   | result-popup-screen.json   | battle_ui | ResultPopup.ts |
| toast-message  | toast-message-main.json  | toast-message-default.json  | toast-message-screen.json  | ui_common | ToastMessage.ts |
| style-check    | style-check-main.json    | style-check-default.json    | — (預覽工具)               | —         | StyleCheckPanel.ts |
| general-list   | general-list-main.json   | general-list-default.json   | general-list-screen.json   | lobby_ui  | GeneralListPanel.ts |
| general-detail-unified | general-detail-unified-main.json | general-detail-unified-default.json + general-detail-unified-base.json | general-detail-unified-screen.json | lobby_ui | GeneralDetailComposite.ts + general-detail/GeneralDetailOverviewChild.ts |
| general-detail | general-detail-main.json | general-detail-default.json | general-detail-screen.json | lobby_ui  | legacy reference only；runtime 不再消費，對應 shim 已刪除 |
| general-detail-bloodline-v3 | general-detail-bloodline-v3-main.json | general-detail-bloodline-v3-default.json | general-detail-bloodline-v3-screen.json | lobby_ui | overview sample / contract 驗證用 screen；由 GeneralDetailComposite.ts + general-detail/GeneralDetailOverviewChild.ts 承接，不再是獨立 runtime 入口 |
| general-portrait | general-portrait-main.json | general-portrait-default.json | general-portrait-screen.json | lobby_ui | GeneralPortraitPanel.ts |
| gacha          | gacha-main.json          | gacha-default.json          | gacha-screen.json          | lobby_ui  | (待建 GachaPanel.ts) |
| support-card   | support-card-main.json   | support-card-default.json   | support-card-screen.json   | lobby_ui  | (待建 SupportCardPanel.ts) |
| support-card-detail | support-card-detail-main.json | support-card-default.json（共用） | support-card-screen.json（子畫面） | lobby_ui | 支援卡詳情子畫面；收納於 support-card-screen.json |
| support-card-team-edit | support-card-team-edit-main.json | support-card-default.json（共用） | support-card-screen.json（子畫面） | lobby_ui | 編組預覽子畫面；收納於 support-card-screen.json |
| lobby-main     | lobby-main-main.json     | lobby-main-default.json     | lobby-main-screen.json     | lobby_ui  | LobbyScene.ts（runtime 已綁定） |
| shop-main       | shop-main-main.json       | shop-main-default.json       | shop-main-screen.json       | lobby_ui  | (待建 ShopPanel.ts) |
| tiger-tally     | tiger-tally-main.json     | tiger-tally-default.json     | tiger-tally-screen.json     | battle_ui | TigerTallyPanel.ts |
| action-command  | action-command-main.json  | action-command-default.json  | action-command-screen.json  | battle_ui | ActionCommandPanel.ts |
| unit-info-panel | unit-info-panel-main.json | unit-info-panel-default.json | unit-info-panel-screen.json | battle_ui | UnitInfoPanel.ts |
| general-quickview | general-quickview-main.json | general-quickview-default.json | general-quickview-screen.json | battle_ui | GeneralQuickViewPanel.ts |
| battle-scene-main | — (複合)                | — (複合)                     | battle-scene-main.json      | battle_ui | BattleScenePanel.ts |

#### UI Core Interfaces (`assets/scripts/ui/core/interfaces/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| INodeFactory.ts | doc_ui_0049 §7.5, doc_index_0008 §8.4 | D: `INodeFactory`, `NodeHandle`; 概: 引擎無關的 UI 節點建構介面（buildPanel/buildLabel/buildButton/buildImage/buildScrollList/createContainer）|
| IStyleApplicator.ts | doc_ui_0049 §7.5, doc_index_0008 §8.4 | D: `IStyleApplicator`, `ButtonVisualState`; 概: 引擎無關的視覺樣式套用介面（applyBackgroundSkin/applyButtonSkin/applyLabelStyle/applySpriteType）|
| ILayoutResolver.ts | doc_ui_0049 §7.5, doc_index_0008 §8.4 | D: `ILayoutResolver`, `Dimensions`, `WidgetConstraints`, `LayoutConfig`; 概: 引擎無關的佈局計算介面，回傳純資料 DTO（resolveSize/resolveWidget/resolveLayout）|
| ICompositeRenderer.ts | doc_ui_0049 §7.5 | D: `ICompositeRenderer`; 概: 引擎無關的複合 UI 渲染介面 |
| IScrollVirtualizer.ts | doc_ui_0049 §7.5 | D: `IScrollVirtualizer`; 概: 引擎無關的虛擬化捲動清單介面 |
| index.ts | — | 概: barrel export，統一匯出三個介面 |

#### UI Platform Adapters (`assets/scripts/ui/platform/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| cocos/CocosNodeFactory.ts | doc_ui_0049 §7.5, doc_index_0008 §8.4 | 概: `INodeFactory` 的 Cocos Creator 3.x 實作；委派 `UIPreviewNodeFactory`；引擎耦合的單一聚合點（Unity 對照：UnityNodeFactory 同介面換 Unity API）|
| cocos/CocosCompositeRenderer.ts | doc_ui_0049 §7.5 | 概: `ICompositeRenderer` 的 Cocos Creator 3.x 實作 |
| cocos/CocosScrollVirtualizer.ts | doc_ui_0049 §7.5 | 概: `IScrollVirtualizer` 的 Cocos Creator 3.x 實作 |
| unity/UnityNodeFactory.ts | — | 概: `INodeFactory` 的 Unity stub；所有方法 throw not-implemented，供跨引擎移植時填充 |

#### Tools (`assets/scripts/tools/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| SceneAutoBuilder.ts | doc_tech_0007 | 概: 自動生成場景節點樹 |
| vfx-block-registry.ts | doc_tech_0015, doc_art_0003 | D: VfxBlockDef; 概: 特效積木登錄與 VFX 積木命名 / 路徑治理 |
| vfx-usage-table.ts | doc_tech_0015 | 概: 積木組合宣告 + 死資源偵測 |
| VfxComposerTool.ts | doc_tech_0015, doc_art_0003 | 概: 即時特效預覽工具與 VFX Core 路徑規則 |
| VideoPlayerTest.ts | doc_art_0003 | 概: 影片播放測試 |
| UnityParticlePrefabParser.ts | — | 概: Unity 粒子遷移工具（無直接規格書對應） |
| UnityParticleCompoundMapper.ts | — | 概: Unity 複合粒子映射（無直接規格書對應） |

#### Build Tools (`tools_node/`)

> 更新日期：2026-04-10。所有工具透過 `tools_node/lib/project-config.js` 取得集中路徑，禁止工具內部 `path.join(__dirname, '../assets/...')` 硬編碼。

| 工具 | 功能 | 關鍵路徑 / 產出 |
|------|------|----------------|
| `validate-ui-specs.js` | UI spec 三層 JSON 靜態驗證器（R1–R18） | 輸入：layouts/skins/screens；輸出：errors / warnings |
| `validate-widget-registry.js` | widget-registry.json ↔ 實際 widget 檔案一致性驗證 | `fragments/widget-registry.json` ↔ `fragments/widgets/*.json` |
| `build-fragment-usage-map.js` | 掃 layouts 的 `$ref` 引用，輸出片段使用地圖 | `--query <ref>` 查單一 fragment 影響範圍 |
| `task-lock.js` | Multi-Agent file-based task 鎖定 | `.task-locks/<id>.lock.json`；並確保 .gitignore 排除 |
| `headless-snapshot-test.js` | UI spec JSON 結構 hash 快照測試（baseline 113 specs） | `tools_node/.ui-spec-snapshot.json`；`--update` 更新 baseline |
| `layout-diff.js` | 兩份 layout JSON 人類可讀 diff 比對 | `--git <file>` 比對 HEAD vs 工作目錄 |
| `i18n-overflow-check.js` | CJK 文字寬度估算 + 溢出風險報告 | `i18n/*.json`；目錄不存在 graceful exit |
| `bootstrap-new-project.js` | 匯出 18 個可移植元件至新專案目錄 | `--name/--out/--list/--dry-run/--include/--exclude` |
| `lib/project-config.js` | 集中路徑管理（30+ paths, scenes, locales, templateFamilies, ROOT） | 被 validate-ui-specs / validate-widget-registry / task-lock / build-fragment-usage-map 等引用 |
| `skills-manager.js` | Agent Skills CLI（list / info / validate / export / sync-mirrors / status） | `.github/skills-manifest.json`（25 skills） |
| `check-encoding-touched.js` | 修改後 UTF-8 BOM / mojibake 防護 | 傳入 `<changed-files>` 清單 |
| `scaffold-ui-spec-family.js` | 以 config JSON 一鍵產出三層 UI spec 骨架 | `--config <json>`；輸出 layouts / skins / screens |

#### UCUF Compiler / Orchestrator (`tools_node/`)

> 更新日期：2026-04-16。以下工具為 UCUF UI 模板化藍圖（doc_ui_0046）的工具鏈核心。

| 工具 | 功能 | 關鍵路徑 / 產出 |
|------|------|----------------|
| `compile-proof-to-family-map.js` | proof draft → family-map | `artifacts/ui-source/<screen-id>/proof/<screen-id>.family-map.json` |
| `compile-proof-to-mcq.js` | proof draft 未決欄位 → MCQ 問卷 | `artifacts/ui-source/<screen-id>/mcq/*.json` |
| `compile-mcq-answer-to-recipe.js` | MCQ answers → normalized recipe | `docs/ui/examples/<screen>.recipe.json` |
| `compile-recipe-to-screen-spec.js` | recipe → screen JSON | `assets/resources/ui-spec/screens/<screen>.json` |
| `compile-recipe-to-panel-scaffold.js` | recipe → CompositePanel / ChildPanel .ts 骨架 | `assets/scripts/ui/components/` |
| `compile-recipe-to-task-card.js` | recipe → 可執行任務卡 | `docs/ui-quality-tasks/<task-id>.json` |
| `compile-family-map-to-asset-tasks.js` | family-map → asset-task-manifest | `artifacts/ui-source/<screen-id>/manifests/asset-task-manifest.json` |
| `compile-family-map-to-param-tune-tasks.js` | family-map（80%+ reuse）→ param-tune-manifest | `artifacts/ui-source/<screen-id>/manifests/param-tune-manifest.json` |
| `run-ui-vibe-workflow.js` | 圖驅動 orchestration front-end（串接上述全部） | `--proof-source <image> --screen-id <id>` |

#### Agent Skills（`.github/skills/` + `.agents/skills/`）

> 更新日期：2026-04-16。共 27 個 unique skill（19 僅 .github、2 僅 .agents、6 雙鏡像）。

| Skill | doc_id | 主要消費工具 | 關聯規格 |
|-------|--------|-------------|----------|
| best-mode | doc_agentskill_0001 | check-context-budget.js, report-turn-usage.js | doc_ai_0018 |
| cocos-bug-triage | doc_agentskill_0009 / 0002 | cocos-screenshot + cocos-log-reader 組合 | doc_ui_0049 |
| cocos-log-reader | doc_agentskill_0010 / 0003 | project.log 讀取 | doc_ui_0049 |
| cocos-preview-qa | doc_agentskill_0011 / 0004 | capture-ui-screens.js | doc_ui_0049, doc_ui_0051 |
| cocos-screenshot | doc_agentskill_0012 / 0005 | PrintWindow capture | doc_ui_0049 |
| comfyui-sdxl-partial-asset-gen | doc_agentskill_0013 | ComfyUI local backend | doc_ui_0046 |
| context-budget-guard | doc_agentskill_0006 | check-context-budget.js, summarize-structured-diff.js | doc_ai_0015 |
| crossref-progress-scanner | doc_agentskill_0032 | resolve-doc-id.js, cross-ref shards | doc_index_0005 |
| dalle3-image-gen | doc_agentskill_0014 | MCP DALL-E 3 | doc_ui_0046 |
| doc-consolidation-flow | doc_agentskill_0034 | consolidation-manifest tools | doc_index_0005 |
| doc-shard-manager | doc_agentskill_0015 | shard-manager.js | doc_index_0005 |
| encoding-touched-guard | doc_agentskill_0016 / 0007 | check-encoding-integrity.js, check-encoding-touched.js | doc_ai_0008 |
| general-balance-tuner | doc_agentskill_0017 | — | doc_data_0001 |
| general-data-pipeline | doc_agentskill_0018 | — | doc_data_0001, doc_spec_0016 |
| general-story-writer | doc_agentskill_0019 | — | doc_spec_0016 |
| nano-banana-gen | doc_agentskill_0020 | — | — |
| ui-asset-gen-director | doc_agentskill_0021 | compile-family-map-to-asset-tasks.js | doc_ui_0046 |
| ui-asset-qc | doc_agentskill_0022 | validate-visual-assets.js, validate-ui-specs.js | doc_ui_0049 |
| ui-asset-slice-pipeline | doc_agentskill_0023 | slice-ui-sheet.js, trim-png-by-background.js | doc_ui_0045 |
| ui-brief-generator | doc_agentskill_0024 | — | doc_ui_0046 |
| ui-family-architect | doc_agentskill_0025 | compile-proof-to-family-map.js | doc_ui_0046 |
| ui-i18n-localize | doc_agentskill_0026 | i18n-overflow-check.js | doc_art_0003 |
| ui-preview-judge | doc_agentskill_0027 | cocos-screenshot | doc_ui_0049 |
| ui-reference-decompose | doc_agentskill_0028 | run-ui-vibe-workflow.js | doc_ui_0046 |
| ui-runtime-verify | doc_agentskill_0029 | capture-ui-screens.js, validate-ui-specs.js | doc_ui_0049 |
| ui-spec-scaffold | doc_agentskill_0030 | compile-recipe-to-screen-spec.js, compile-recipe-to-panel-scaffold.js | doc_ui_0046, doc_ui_0049 |
| ui-vibe-pipeline | doc_agentskill_0031 / 0008 | run-ui-vibe-workflow.js + 全 compiler chain | doc_ui_0046, doc_ui_0048 |

---
