# Cross-Reference: 代碼索引（代碼 ↔ 規格書 雙向映射）

> 這是 cross-reference-index.md 的 B 節分片。完整索引見 `docs/cross-reference-index.md`。
> 最後更新請參考母檔 Header。

## B. 代碼索引（代碼 ↔ 規格書 雙向映射）

### B-1. 代碼 → 規格書

> 每個 .ts 檔對應的規格書來源，標示資料結構(D) / 公式(F) / 常數(C) / 概念(概) 的引用類型。

#### Core Systems (`assets/scripts/core/systems/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| FormulaSystem.ts | 數值系統.md, 兵種（虎符）系統.md | F: calculateDamage, getCounterMultiplier, calculateHeal, calculateGeneralAttack, getCritChance, getDodgeChance, rollCrit, rollDodge; D: DamageContext, GeneralCombatParams; C: COUNTER_MULTIPLIER, GENERAL_BASE_CRIT_CHANCE, GENERAL_MAX_CRIT_CHANCE, GENERAL_CRIT_DAMAGE_MULTIPLIER, GENERAL_BASE_DODGE_CHANCE, GENERAL_MAX_DODGE_CHANCE |
| BattleSystem.ts | 戰場部署系統.md, 數值系統.md | D: TurnSnapshot, TurnPhase; C: INITIAL_DP, DP_PER_TURN, GRID_LANES, GRID_DEPTH |
| BuffSystem.ts | 因子爆發系統.md | D: BuffEntry, StatusEffect; 概: 狀態效果管理 |
| ActionSystem.ts | 戰法系統.md, 奧義系統.md | D: SkillDef, ActionStep, ActionContext; 概: 技能時間軸演出 |
| EventSystem.ts | demo_技術架構.md | 概: Pub/Sub 事件匯流排 |
| PoolSystem.ts | demo_技術架構.md | 概: 物件池回收管理 |
| ResourceManager.ts | Data Schema文件.md, demo_技術架構.md, 美術素材規劃與使用說明.md | 概: JSON/Prefab/SpriteFrame 載入與快取 |
| EffectSystem.ts | demo_技術架構.md | 概: VFX 生命週期管理 |
| AudioSystem.ts | demo_技術架構.md | 概: BGM/SFX 混音管理 |
| FloatTextSystem.ts | demo_技術架構.md | D: FloatTextType; C: FLOAT_CONFIGS |
| I18nSystem.ts | demo_技術架構.md, 美術素材規劃與使用說明.md | 概: 多語系載入框架與字型目錄治理 |
| MaterialSystem.ts | 美術素材規劃與使用說明.md, keep.md §7 | D: OutfitConfig, ShaderEntry; 概: 材質實例與 Shader warmup |
| MemoryManager.ts | demo_技術架構.md | D: AssetRecord; 概: 資產追蹤與釋放 |
| CurveSystem.ts | demo_技術架構.md | 概: 非線性數值曲線（AnimationCurve 對等） |
| NetworkService.ts | Data Schema文件（本機端與Server端）.md | 概: Web/Native 離線網路狀態偵測 |
| SyncManager.ts | Data Schema文件（本機端與Server端）.md | 概: 離線 Action Log 佇列與 HMAC 背景同步 |
| **server/src/index.ts** | Data Schema文件（本機端與Server端）.md | 概: 後端驗證引擎 (Event Replay) 原型 |

#### Core Models (`assets/scripts/core/models/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| TroopUnit.ts | 兵種（虎符）系統.md, 數值系統.md | D: TroopStats, TroopUnit class; C: TroopType enum |
| GeneralUnit.ts | ????.md, ?????????.md, ????.md | D: `GeneralConfig`, `GeneralUnit` class???? `historicalAnecdote / bloodlineRumor / storyStripCells / crestHint / crestState` ?????? |

#### Core Data (`assets/scripts/core/data/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BattleBindData.ts | 主戰場UI規格書.md, BattleScene layouts | D: BattleStateData, UnitDisplayData, TallyUnitData, BattleActionData, BattleLogData; 概: BattleScene 動態 label 的 ViewModel 契約（DATA-1-0001，2026-04-05）|

#### Core Config (`assets/scripts/core/config/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| Constants.ts | 數值系統.md, 兵種（虎符）系統.md | D: TurnPhase, Faction, TroopType, TerrainType, StatusEffect; C: GAME_CONFIG, TROOP_COUNTER_MAP, TROOP_DEPLOY_COST, SP_PER_KILL |
| UIConfig.ts | UI 規格書.md, 主戰場UI規格書.md | D: UIID, LayerType; C: UIConfig 映射表 |
| UnitAssetCatalog.ts | 美術素材規劃與使用說明.md | D: TroopUnitAssetEntry, HeroUnitAssetEntry; C: TROOP_UNIT_ASSET_CATALOG, HERO_UNIT_ASSET_CATALOG |
| VfxEffectConfig.ts | demo_技術架構.md | D: VfxEffectDef; C: DEFAULT_VFX_EFFECTS |

#### Core Utils (`assets/scripts/core/utils/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| MaterialUtils.ts | keep.md §7 棄用 API 管理 | 概: setMaterialSafe wrapper |
| ParticleUtils.ts | demo_技術架構.md | D: ParticleOverride; F: applyParticleOverride |

#### Core Managers (`assets/scripts/core/managers/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| GameManager.ts | MVP遊戲驗證規格書.md | D: GameMode enum; 概: 遊戲模式切換 |
| ServiceLoader.ts | demo_技術架構.md | 概: DI 容器（9+ 服務註冊） |
| UIManager.ts | UI 規格書.md, 主戰場UI規格書.md | 概: 六層 UI 生命週期管理 |
| SceneManager.ts | 新手開場規格書.md | 概: A→Loading→B 場景切換；新增 `boardRenderer` 視圖橋（registerBoardRenderer / getBoardRenderer），供 BattleScene ↔ UI 跨組件查詢 |

#### Battle Controllers (`assets/scripts/battle/controllers/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BattleController.ts | 戰場部署系統.md, 數值系統.md, 兵種（虎符）系統.md | D: BattleResult, DeployOutcome; F: 部署驗證、戰鬥結算、TileBuff 計算; C: DEFAULT_STATS |
| EnemyAI.ts | 治理模式他國AI系統.md, AI武將強度系統.md | F: decideDeploy（35% 剋制偏向） |

#### Battle Models (`assets/scripts/battle/models/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BattleState.ts | 戰場部署系統.md, 數值系統.md | D: GridCell, TileBuff, TerrainGrid; C: 5×8 grid |

#### Battle Views (`assets/scripts/battle/views/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BattleScene.ts | 戰場部署系統.md, demo_playbook.md, 美術素材規劃與使用說明.md | D: EncounterConfig; 概: 戰鬥場景進入點與 BMFont 載入 |
| BoardRenderer.ts | 戰場部署系統.md | 概: 5×8 棋盤渲染 |
| UnitRenderer.ts | 美術素材規劃與使用說明.md | D: UnitView, GeneralView; 概: GLB 動態載入 |
| SceneBackground.ts | demo_技術架構.md | 概: 分層相機（BG/3D/UI） |
| SpriteFrameAnimator.ts | — | 概: 幀動畫工具（無直接規格書對應） |

#### Battle Views / Effects (`assets/scripts/battle/views/effects/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BuffGainEffectPool.ts | 因子爆發系統.md | D: EffectSlot, BuffEffectConfig; 概: 法陣+圖示+粒子池 |
| BuffEffectPrefabController.ts | 因子爆發系統.md | 概: Prefab 結構驗證（Ring/Icon/Spark/Accent） |
| BuffParticleProfileConfig.ts | demo_技術架構.md | D: BuffParticleProfile |

#### UI Components (`assets/scripts/ui/components/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| BattleHUD.ts              | UI 規格書.md, 主戰場UI規格書.md, 主戰場UI規格補充_v3.md                       | 概: 回合/糧草(v3 DP→Food)/武將血條即時顯示；頭像點擊→ShowGeneralQuickView event ✅ UIPreviewBuilder 已遷移 |
| BattleLogPanel.ts         | UI 規格書.md, 主戰場UI規格補充_v3.md                                          | 概: Zone5 滾動式戰鬥日誌+可折疊(v3 移除 EndTurn/Tactics/Duel 至 Zone7) ✅ UIPreviewBuilder → battle-log-{main/default/screen}.json |
| DeployPanel.ts            | 戰場部署系統.md, UI 規格書.md, 美術素材規劃與使用說明.md                       | 概: 兵種選擇 4 卡池 + 選路即部署 ✅ UIPreviewBuilder 已遷移 → deploy-panel-{main/default/screen}.json |
| DuelChallengePanel.ts     | 名將挑戰賽系統.md                                                              | 概: 單挑挑戰/接受 UI ✅ UIPreviewBuilder 已遷移 → duel-challenge-{main/default/screen}.json |
| GeneralDetailPanel.ts     | 武將系統.md, 武將人物介面規格書.md                                             | 概: 武將詳細面板；正式為多分頁容器，過渡期由 `Basics` 路由到 overview shell，其餘 tab 維持既有 content host ✅ UIPreviewBuilder 已遷移 |
| GeneralDetailOverviewMapper.ts | ?????????.md, UI ???.md | ?: ? `GeneralConfig` ??? overview shell ?????? header / summary / bloodline / crest / story content contract??? `GeneralDetail` ?????? runtime seam |
| GeneralDetailOverviewShell.ts | 武將人物介面規格書.md, UI 規格書.md                                       | 概: `general-detail-bloodline-v3` 的 runtime shell；目前已改為欄位表批次 `_setLabel`，對應 `OverviewSummaryModules / BloodlineOverviewModules / StoryStrip` 等正式 layout 群組 |
| GeneralListPanel.ts       | 武將系統.md, 武將人物介面規格書.md                                             | 概: 武將列表 ✅ UIPreviewBuilder 已遷移 |
| GeneralPortraitPanel.ts   | 武將系統.md                                                                    | 概: 武將立繪面板 ✅ UIPreviewBuilder 已遷移 |
| ResultPopup.ts            | 戰場部署系統.md                                                                | 概: 戰鬥結算面板 ✅ UIPreviewBuilder 已遷移 |
| ToastMessage.ts           | UI 規格書.md                                                                   | 概: 通知 Toast ✅ UIPreviewBuilder 已遷移 |
| StyleCheckPanel.ts        | UI技術規格書.md                                                                | 概: 風格驗證面板 ✅ UIPreviewBuilder 已遷移 |
| NetworkStatusIndicator.ts | UI技術規格書.md, Data Schema文件（本機端與Server端）.md                        | 概: 斷線警示與背景同步提示 UI ✅ UIPreviewBuilder 已遷移 → network-status-{main/default/screen}.json |
| UIScreenPreviewHost.ts    | UI參考圖品質分析.md, UI技術規格書.md                                          | 概: 以 `UISpecLoader.loadFullScreen(...)` 建立 screen-driven preview host，供 D-1~D-3 與後續 QA 共用 |

#### UI Core (`assets/scripts/ui/core/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| UIPreviewBuilder.ts | UI技術規格書.md, keep.md §8 | 概: 所有 UI 面板的基類（Unity 對照：Prefab Variant Builder + EditorWindow）；`buildScreen()` 末尾呼叫 `_realignAllWidgets()` + 清空 bind 佔位符 + `onReady(binder)`；子類覆寫 `onReady(binder)` 取代舊 `onBuildComplete()` |
| UIContentBinder.ts | UI技術規格書.md, keep-ui-arch.md §8.3 | 概: Content Contract 資料注入與 schema 驗證；`validate()` 支援 type / enum / range / pattern 四層進階驗證，以 warnings 回報不阻斷 runtime（Unity 對照：ViewModel 資料注入 + 欄位驗證器）|
| UISpecTypes.ts | UI技術規格書.md | D: WidgetDef(hCenter/vCenter), UILayoutNodeSpec, UINodeType(scroll-view 新增), UIWidgetFragmentSpec, UITemplateParamDef, UITemplateComposeItem; F: resolveSize |
| UITemplateBinder.ts | UI技術規格書.md, keep.md §8 | 概: 以 layout id/name 建立節點綁定表，供 `onReady(binder)` 查詢（Unity 對照：GetComponentInChildren 安全封裝）|
| UIPreviewLayoutBuilder.ts | UI技術規格書.md | 概: UIPreviewBuilder 拆分出的佈局計算 helper，負責 Widget 對齊與尺寸套用 |
| UIPreviewNodeFactory.ts | UI技術規格書.md | 概: 依 UILayoutNodeSpec 建立 Cocos 節點；bind path 節點顯示 {xxx.yyy} 佔位文字（buildScreen 後由 clearDynamic pass 清除）|
| UIPreviewShadowManager.ts | UI技術規格書.md | 概: 陰影層（9-slice 偽陰影）管理 |
| UIPreviewStyleBuilder.ts | UI技術規格書.md | 概: 字型/色彩/按鈕狀態渲染 helper |
| UIPreviewStateApplicator.ts | UI技術規格書.md, 美術風格規格書.md | 概: 將 preview content state 套用到 binder（texts / actives / rarity docks），避免 LoadingScene 各 target 手寫注入 |
| UIPreviewDiagnostics.ts | UI技術規格書.md | 概: 建立耗時、節點數量日誌工具 |
| UISkinResolver.ts | UI技術規格書.md | 概: 皮膚 slot 解析（SpriteFrame/ LabelStyle/ ButtonSkin）；已加入 frame.texture null 防禦 |
| UISpecLoader.ts | UI技術規格書.md | 概: ServiceLoader 單例，統一載入 layout/skin/screen/i18n/designTokens JSON |
| DraggableButton.ts        | —                                                                              | 概: 拖曳按鈕（無直接規格書對應）|
| SolidBackground.ts        | UI技術規格書.md                                                                | 概: 純色白模背景生成與美術貼圖預防覆蓋機制 |
| ActionCommandPanel.ts     | 主戰場UI規格書.md, 主戰場UI規格補充_v3.md                                     | 概: Zone7 奧義大圓(v3 120px)+EndTurn/Tactics/Duel 80px 軌道圓+奧義選擇彈窗 ✅ UIPreviewBuilder → action-command-{main/default/screen}.json |
| BattleScenePanel.ts       | 主戰場UI規格書.md                                                              | 概: 戰場UI總調度器；`ensureCanvasHost()` 統一建立子面板節點並設定 layer/size(1920×1080)/Widget.ALWAYS，修正舊版 UITransform=100×40 導致 Widget 錯位的問題 |
| TigerTallyPanel.ts        | 主戰場UI規格書.md, 兵種（虎符）系統.md, 主戰場UI規格補充_v3.md               | 概: Zone3 虎符卡片欄（v3 AtkLabel⚔/HpLabel❤ 頂角 + UnitTypeBadge 32px）✅ UIPreviewBuilder → tiger-tally-{main/default/screen}.json |
| UnitInfoPanel.ts          | 主戰場UI規格書.md, 兵種（虎符）系統.md                                         | 概: 兵種詳情滑出面板（fadeIn/fadeOut 0.2s）✅ UIPreviewBuilder → unit-info-panel-{main/default/screen}.json |
| GeneralQuickViewPanel.ts  | 主戰場UI規格補充_v3.md §v3-5                                                  | 概: Zone1 頭像點擊觸發武將快覽彈窗（名稱/HP/攻防/戰法，敵方遮蔽）✅ UIPreviewBuilder → general-quickview-{main/default/screen}.json |

#### UI Layers & Scenes (`assets/scripts/ui/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| UILayer.ts | UI 規格書.md | 概: UI 面板基類（show/hide） |
| LoadingScene.ts | 新手開場規格書.md, UI參考圖品質分析.md, 美術風格規格書.md | 概: 過場載入場景，同時也是 screen-driven preview hub（`previewMode` + `previewTarget` + `previewVariant`）；以 content state + applicator 驅動 Gacha / SpiritTally preview 注入 |
| LobbyScene.ts | 新手開場規格書.md, 武將系統.md, 武將人物介面規格書.md | 概: 大廳（武將列表+詳情）；含 `onClickGeneralDetailOverviewSmoke()` 最小 smoke route，可直接驗證 `GeneralListPanel -> GeneralDetailPanel(Basics -> overview shell)` |
| LoginScene.ts | 新手開場規格書.md | 概: 登入畫面 |

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
| general-detail | general-detail-main.json | general-detail-default.json | general-detail-screen.json | lobby_ui  | GeneralDetailPanel.ts |
| general-detail-bloodline-v3 | general-detail-bloodline-v3-main.json | general-detail-bloodline-v3-default.json | general-detail-bloodline-v3-screen.json | lobby_ui | GeneralDetailPanel.ts（v3 預設總覽殼層，待整合為正式入口） |
| general-portrait | general-portrait-main.json | general-portrait-default.json | general-portrait-screen.json | lobby_ui | GeneralPortraitPanel.ts |
| gacha          | gacha-main.json          | gacha-default.json          | gacha-screen.json          | lobby_ui  | (待建 GachaPanel.ts) |
| support-card   | support-card-main.json   | support-card-default.json   | support-card-screen.json   | lobby_ui  | (待建 SupportCardPanel.ts) |
| support-card-detail | support-card-detail-main.json | support-card-default.json（共用） | support-card-screen.json（子畫面） | lobby_ui | 支援卡詳情子畫面；收納於 support-card-screen.json |
| support-card-team-edit | support-card-team-edit-main.json | support-card-default.json（共用） | support-card-screen.json（子畫面） | lobby_ui | 編組預覽子畫面；收納於 support-card-screen.json |
| lobby-main     | lobby-main-main.json     | lobby-main-default.json     | lobby-main-screen.json     | lobby_ui  | LobbyScene.ts（待綁定） |
| shop-main       | shop-main-main.json       | shop-main-default.json       | shop-main-screen.json       | lobby_ui  | (待建 ShopPanel.ts) |
| tiger-tally     | tiger-tally-main.json     | tiger-tally-default.json     | tiger-tally-screen.json     | battle_ui | TigerTallyPanel.ts |
| action-command  | action-command-main.json  | action-command-default.json  | action-command-screen.json  | battle_ui | ActionCommandPanel.ts |
| unit-info-panel | unit-info-panel-main.json | unit-info-panel-default.json | unit-info-panel-screen.json | battle_ui | UnitInfoPanel.ts |
| general-quickview | general-quickview-main.json | general-quickview-default.json | general-quickview-screen.json | battle_ui | GeneralQuickViewPanel.ts |
| battle-scene-main | — (複合)                | — (複合)                     | battle-scene-main.json      | battle_ui | BattleScenePanel.ts |

#### UI Core Interfaces (`assets/scripts/ui/core/interfaces/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| INodeFactory.ts | UI技術規格書.md §7.5, keep-ui-arch.md §8.4 | D: `INodeFactory`, `NodeHandle`; 概: 引擎無關的 UI 節點建構介面（buildPanel/buildLabel/buildButton/buildImage/buildScrollList/createContainer）|
| IStyleApplicator.ts | UI技術規格書.md §7.5, keep-ui-arch.md §8.4 | D: `IStyleApplicator`, `ButtonVisualState`; 概: 引擎無關的視覺樣式套用介面（applyBackgroundSkin/applyButtonSkin/applyLabelStyle/applySpriteType）|
| ILayoutResolver.ts | UI技術規格書.md §7.5, keep-ui-arch.md §8.4 | D: `ILayoutResolver`, `Dimensions`, `WidgetConstraints`, `LayoutConfig`; 概: 引擎無關的佈局計算介面，回傳純資料 DTO（resolveSize/resolveWidget/resolveLayout）|
| index.ts | — | 概: barrel export，統一匯出三個介面 |

#### UI Platform Adapters (`assets/scripts/ui/platform/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| cocos/CocosNodeFactory.ts | UI技術規格書.md §7.5, keep-ui-arch.md §8.4 | 概: `INodeFactory` 的 Cocos Creator 3.x 實作；委派 `UIPreviewNodeFactory`；引擎耦合的單一聚合點（Unity 對照：UnityNodeFactory 同介面換 Unity API）|
| unity/UnityNodeFactory.ts | — | 概: `INodeFactory` 的 Unity stub；所有方法 throw not-implemented，供跨引擎移植時填充 |

#### Tools (`assets/scripts/tools/`)

| 代碼檔 | 對應規格書 | 引用類型 |
|---|---|---|
| SceneAutoBuilder.ts | 場景搭建指南.md | 概: 自動生成場景節點樹 |
| vfx-block-registry.ts | demo_技術架構.md, 美術素材規劃與使用說明.md | D: VfxBlockDef; 概: 特效積木登錄與 VFX 積木命名 / 路徑治理 |
| vfx-usage-table.ts | demo_技術架構.md | 概: 積木組合宣告 + 死資源偵測 |
| VfxComposerTool.ts | demo_技術架構.md, 美術素材規劃與使用說明.md | 概: 即時特效預覽工具與 VFX Core 路徑規則 |
| VideoPlayerTest.ts | 美術素材規劃與使用說明.md | 概: 影片播放測試 |
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

---

### B-2. 規格書 → 代碼（反向索引）

> 每份規格書目前已有對應代碼的清單。無代碼對應的規格書標記「尚無實作」。

> **測試檔案目錄讓明（2026-03-31 修正）**：CLI 可用的測試檔案位於 **`tests/`**（專案根目錄，**扁平結構，無子目錄**）。
> - ✅ **已建立**：`tests/FormulaSystem.test.ts`, `tests/ActionSystem.test.ts`, `tests/BuffSystem.test.ts`, `tests/BuffParticleProfileConfig.test.ts`, `tests/CurveSystem.test.ts`, `tests/EventSystem.test.ts`, `tests/GeneralListPanel.test.ts`, `tests/NetworkService.test.ts`, `tests/ResultPopup.test.ts`, `tests/SyncManager.test.ts`, `tests/UIManager.test.ts`, `tests/UISpecParser.test.ts`, `tests/UnityParticlePrefabParser.test.ts`, `tests/VfxEffectConfig.test.ts`
> - ⚠️ **發現問題**：`tsconfig.test.json` 的 `include` 路徑已修正為 `tests/**/*.ts`，但測試檔內的相對 import（如 `../../core/systems/FormulaSystem`）尚需更新為對應絕對路徑模式（規劃中, 見 `keep.md §9`）

| 規格書 | 對應代碼檔 | 完成度估算(%) | 單元測試關聯區塊 (Test Target) |
|---|---|---|---|
| **數値系統.md** | FormulaSystem.ts, Constants.ts, TroopUnit.ts, GeneralUnit.ts, BattleController.ts, BattleState.ts | 🟢 80% | `tests/FormulaSystem.test.ts` ✅ (核心算式驗證) |
| **兵種（虎符）系統.md** | FormulaSystem.ts, Constants.ts, TroopUnit.ts, BattleController.ts, EnemyAI.ts | 🟢 60% | 尚無（TroopUnit.test.ts 待建） |
| **戰場部署系統.md** | BattleSystem.ts, BattleState.ts, BattleController.ts, BattleScene.ts, BoardRenderer.ts, DeployPanel.ts, ResultPopup.ts | 🟢 75% | 尚無（BattleController.test.ts 待建）；已有：`tests/ResultPopup.test.ts` ✅ |
| **武將系統.md** | GeneralUnit.ts, GeneralDetailPanel.ts, GeneralListPanel.ts, LobbyScene.ts | 🟡 55% | 尚無（GeneralUnit.test.ts 待建） |
| **武將人物介面規格書.md** | GeneralDetailPanel.ts, GeneralListPanel.ts, LobbyScene.ts, GeneralUnit.ts | 🟢 70% | 尚無（GeneralDetailPanel.test.ts 待建）；已有：`tests/GeneralListPanel.test.ts` ✅ |
| **戰法系統.md** | ActionSystem.ts | 🔴 10% | `tests/ActionSystem.test.ts` ✅ (時間軸分發機制) |
| **奧義系統.md** | ActionSystem.ts | 🔴 0% | 尚無 |
| **因子爆發系統.md** | BuffSystem.ts, BuffGainEffectPool.ts, BuffEffectPrefabController.ts | 🔴 30% | `tests/BuffSystem.test.ts` ✅ (Buff 疊加與消退)；亦有：`tests/BuffParticleProfileConfig.test.ts` ✅ |
| **治理模式他國AI系統.md** | EnemyAI.ts | 🔴 10% | 尚無（EnemyAI.test.ts 待建） |
| **AI武將強度系統.md** | EnemyAI.ts | 🔴 0% | 尚無 |
| **名將挑戰賽系統.md** | DuelChallengePanel.ts | 🔴 5% | 尚無 |
| **MVP逰戲驗證規格書.md** | GameManager.ts | 🟢 80% | 尚無（GameManager.test.ts 待建） |
| **新手開場規格書.md** | SceneManager.ts, LoadingScene.ts, LobbyScene.ts, LoginScene.ts | 🟢 85% | (主要為 UI 流水線，由 E2E 或整合測試涵蓋) |
| **UI 規格書.md** | UIConfig.ts, UIManager.ts, BattleHUD.ts, BattleLogPanel.ts, DeployPanel.ts, ToastMessage.ts, UILayer.ts | 🔴 30% | `tests/UIManager.test.ts` ✅ (UI 堆疊演算法)；亦有：`tests/UISpecParser.test.ts` ✅ |
| **主戰場UI規格書.md** | UIConfig.ts, UIManager.ts, BattleHUD.ts, BattleScenePanel.ts, TigerTallyPanel.ts, UnitInfoPanel.ts, ActionCommandPanel.ts | 🟢 80% | (組件渲染邏輯，主要依賴手動或 VRT 驗證) |
| **主戰場UI規格補充_v3.md** | BattleHUD.ts, ActionCommandPanel.ts, BattleLogPanel.ts, TigerTallyPanel.ts, GeneralQuickViewPanel.ts, Constants.ts | 🟢 90% | v3 全套：DP→Food、Zone7 軌道圓、Zone3 AtkLabel/HpLabel、頭像QuickView，已完成 |
| **美術素材規劃與使用說明.md** | UnitAssetCatalog.ts, MaterialSystem.ts, UnitRenderer.ts, ResourceManager.ts, I18nSystem.ts, BattleScene.ts, DeployPanel.ts, VfxComposerTool.ts, vfx-block-registry.ts, VideoPlayerTest.ts | 🩵 95% | (路徑 / 命名 / manifest 一致性驗證) |
| **UI技術規格書.md** | SolidBackground.ts, GeneralListPanel.ts, NetworkStatusIndicator.ts | 🩵 90% | 尚無（SolidBackground.test.ts 待建） |
| **Data Schema文件.md** | ResourceManager.ts, NetworkService.ts, SyncManager.ts, NetworkStatusIndicator.ts, server/src/index.ts | 🟢 85% | 尚無（ResourceManager.test.ts 待建）；已有：`tests/NetworkService.test.ts` ✅, `tests/SyncManager.test.ts` ✅ |
| **場景搭建指南.md** | SceneAutoBuilder.ts | ☑️ 100% | 編輯器擴充功能測試 (免常規 Jest 執行) |
| **demo_playbook.md** | BattleScene.ts | ☑️ 100% | 腳本規格文件不參與代碼覆蓋率 |
| **demo_技術架構.md** | ServiceLoader.ts, PoolSystem.ts, ResourceManager.ts, EffectSystem.ts, AudioSystem.ts... | 🩵 90% | 尚無（ServiceLoader.test.ts 待建）；已有：`tests/EventSystem.test.ts` ✅, `tests/CurveSystem.test.ts` ✅, `tests/VfxEffectConfig.test.ts` ✅ |
| **keep.md §7** | MaterialUtils.ts, MaterialSystem.ts | ☑️ 100% | (過渡 API，無需測試) |
| 俘虜處理系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 傭兵系統（試用）.md | 尚無實作 | 🔴 0% | 尚無 |
| 可結緣女性來源系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 同名武將系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 名士預言系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 名詞定義文件.md | 尚無實作 | ☑️ 100% | 靜態定義，無邏輯測 |
| 因子解鎖系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 培育系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 家族關係系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 戰場適性系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 教官系統（支援卡）.md | 尚無實作 | 🔴 0% | 尚無 |
| 正式版劇本文案.md | 尚無實作 | 🔴 0% | 文案文件 |
| 武將壽命系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 武將戰績系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 武將背包（倉庫）系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 留存系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 結緣系統（配種）.md | 尚無實作 | 🔴 0% | 尚無 |
| 經濟系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 血統理論系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 資源循環系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 轉職與宿命系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 轉蛋系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 遊戲時間系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 運氣系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 道具系統.md | 尚無實作 | 🔴 0% | 尚無 |
| 領地治理系統.md | 尚無實作 | 🔴 0% | 尚無 |
| **戰法場景規格書.md** | ActionSystem.ts (部分) | 🔴 5% | `tests/core/systems/ActionSystem.test.ts` (場景戰法效果驗證) |
| 熱更新與版本控制規格書.md | 尚無實作 | 🔷 100% | 策略流程文件 |

---
