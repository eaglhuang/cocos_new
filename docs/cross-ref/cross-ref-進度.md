<!-- doc_id: doc_index_0017 -->
# Cross-Reference: 實作進度（規格書 × 代碼 × 測試）

> 這是 `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005) 的 D 節分片。完整索引見 `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)。
> 最後更新請參考母檔 Header。
>
> ⚠️ **本檔是唯一保留完整中文規格書名稱的分片**，供人類查閱進度。
> Agent 請優先讀壓縮版分片（doc_id 索引），只在需要確認進度時才讀本檔。
> 名稱查詢：`node tools_node/resolve-doc-id.js <doc_id>`
> 自動更新：`node tools_node/rebuild-crossref.js --rebuild-progress`

## D. 實作進度（規格書 × 代碼 × 測試）

### D-1. 規格書實作進度

> 每份規格書目前已有對應代碼的清單。無代碼對應的規格書標記「尚無實作」。
> 本表由 `crossref-progress-scanner` skill 週期性掃描更新；手動補充請同步更新 `cross-ref-code.md (doc_index_0001)` B-1。

> **測試檔案目錄說明（2026-03-31 修正）**：CLI 可用的測試檔案位於 **`tests/`**（專案根目錄，**扁平結構，無子目錄**）。
> - ✅ **已建立**：`tests/FormulaSystem.test.ts`, `tests/ActionSystem.test.ts`, `tests/BuffSystem.test.ts`, `tests/BuffParticleProfileConfig.test.ts`, `tests/CurveSystem.test.ts`, `tests/EventSystem.test.ts`, `tests/GeneralListPanel.test.ts`, `tests/NetworkService.test.ts`, `tests/ResultPopup.test.ts`, `tests/SyncManager.test.ts`, `tests/UIManager.test.ts`, `tests/UISpecParser.test.ts`, `tests/UnityParticlePrefabParser.test.ts`, `tests/VfxEffectConfig.test.ts`
> - ⚠️ **發現問題**：`tsconfig.test.json` 的 `include` 路徑已修正為 `tests/**/*.ts`，但測試檔內的相對 import（如 `../../core/systems/FormulaSystem`）尚需更新為對應絕對路徑模式（規劃中，見 `keep.md (doc_index_0011) §9`）

| 規格書 | 對應代碼檔 | 完成度估算 | 單元測試關聯區塊 (Test Target) |
|---|---|---|---|
| **數值系統.md (doc_data_0001)** | FormulaSystem.ts, Constants.ts, TroopUnit.ts, GeneralUnit.ts, BattleController.ts, BattleState.ts | 🟢 80% | `tests/FormulaSystem.test.ts` ✅ (核心算式驗證) |
| **兵種（虎符）系統.md (doc_spec_0012)** | FormulaSystem.ts, Constants.ts, TroopUnit.ts, BattleController.ts, EnemyAI.ts | 🟢 60% | 尚無（TroopUnit.test.ts 待建） |
| **戰場部署系統.md (doc_spec_0040)** | BattleSystem.ts, BattleState.ts, BattleController.ts, BattleScene.ts, BoardRenderer.ts, DeployPanel.ts, ResultPopup.ts | 🟢 75% | 尚無（BattleController.test.ts 待建）；已有：`tests/ResultPopup.test.ts` ✅ |
| **武將系統.md (doc_spec_0016)** | GeneralUnit.ts, GeneralDetailComposite.ts, GeneralListPanel.ts, LobbyScene.ts | 🟡 55% | 尚無（GeneralUnit.test.ts 待建） |
| **武將人物介面規格書.md (doc_ui_0012)** | GeneralDetailComposite.ts, general-detail/GeneralDetailOverviewChild.ts, GeneralListPanel.ts, LobbyScene.ts, GeneralUnit.ts | 🟢 70% | 尚無（GeneralDetailComposite integration test / overview child regression 待建）；已有：`tests/GeneralListPanel.test.ts` ✅、`tests/ucuf/architectureGovernance.test.ts` ✅ |
| **戰法系統.md (doc_spec_0038)** | ActionSystem.ts | 🔴 10% | `tests/ActionSystem.test.ts` ✅ (時間軸分發機制) |
| **奧義系統.md (doc_spec_0030)** | ActionSystem.ts | 🔴 0% | 尚無 |
| **因子爆發系統.md (doc_spec_0010)** | BuffSystem.ts, BuffGainEffectPool.ts, BuffEffectPrefabController.ts | 🔴 30% | `tests/BuffSystem.test.ts` ✅ (Buff 疊加與消退)；亦有：`tests/BuffParticleProfileConfig.test.ts` ✅ |
| **治理模式他國AI系統.md (doc_spec_0020)** | EnemyAI.ts | 🔴 10% | 尚無（EnemyAI.test.ts 待建） |
| **大廳系統.md (doc_spec_0002)** | LobbyScene.ts, UIConfig.ts | 🟡 25% | 尚無（LobbyScene hall workflow test 待建） |
| **官職系統.md (doc_spec_0014)** | UIConfig.ts, LobbyScene.ts | 🔴 0% | 尚無（OfficerSystem 實作待建） |
| **AI武將強度系統.md (doc_data_0002)** | EnemyAI.ts | 🔴 0% | 尚無 |
| **名將挑戰賽系統.md (doc_spec_0007)** | DuelChallengePanel.ts | 🔴 5% | 尚無 |
| **關卡設計系統.md (doc_spec_0044)** | BattleScene.ts, BattleHUD.ts, DeployPanel.ts | 🔴 5% | 尚無（連環破 / Strategist_HUD / Stage_Salvage 實作待建） |
| **武將日誌與離線互動系統.md (doc_spec_0015)** | LobbyScene.ts（大廳入口預留） | 🔴 0% | 尚無 |
| **MVP遊戲驗證規格書.md (doc_spec_0045)** | GameManager.ts | 🟢 80% | 尚無（GameManager.test.ts 待建） |
| **新手開場規格書.md (doc_spec_0031)** | SceneManager.ts, LoadingScene.ts, LobbyScene.ts, LoginScene.ts | 🟢 85% | (主要為 UI 流水線，由 E2E 或整合測試涵蓋) |
| **UI 規格書.md (doc_ui_0027)** | UIConfig.ts, UIManager.ts, BattleHUD.ts, BattleLogPanel.ts, DeployPanel.ts, ToastMessage.ts, UILayer.ts | 🔴 30% | `tests/UIManager.test.ts` ✅ (UI 堆疊演算法)；亦有：`tests/UISpecParser.test.ts` ✅ |
| **主戰場UI規格書.md (doc_ui_0001)** | UIConfig.ts, UIManager.ts, BattleHUD.ts, BattleScenePanel.ts, TigerTallyPanel.ts, UnitInfoPanel.ts, ActionCommandPanel.ts | 🟢 80% | (組件渲染邏輯，主要依賴手動或 VRT 驗證) |
| **主戰場UI規格補充_v3.md (doc_ui_0003)** | BattleHUD.ts, ActionCommandPanel.ts, BattleLogPanel.ts, TigerTallyPanel.ts, GeneralQuickViewPanel.ts, Constants.ts | 🟢 90% | v3 全套：DP→Food、Zone7 軌道圓、Zone3 AtkLabel/HpLabel、頭像QuickView，已完成 |
| **美術素材規劃與使用說明.md (doc_art_0003)** | UnitAssetCatalog.ts, MaterialSystem.ts, UnitRenderer.ts, ResourceManager.ts, I18nSystem.ts, BattleScene.ts, DeployPanel.ts, VfxComposerTool.ts, vfx-block-registry.ts, VideoPlayerTest.ts | 🩵 95% | (路徑 / 命名 / manifest 一致性驗證) |
| **UI技術規格書.md (doc_ui_0049)** | SolidBackground.ts, GeneralListPanel.ts, NetworkStatusIndicator.ts | 🩵 90% | 尚無（SolidBackground.test.ts 待建） |
| **Data Schema文件（本機端與Server端）.md (doc_tech_0013)** | ResourceManager.ts, NetworkService.ts, SyncManager.ts, NetworkStatusIndicator.ts, server/src/index.ts | 🟢 85% | 尚無（ResourceManager.test.ts 待建）；已有：`tests/NetworkService.test.ts` ✅, `tests/SyncManager.test.ts` ✅ |
| **場景搭建指南.md (doc_tech_0007)** | SceneAutoBuilder.ts | ☑️ 100% | 編輯器擴充功能測試 (免常規 Jest 執行) |
| **demo_playbook.md (doc_spec_0161)** | BattleScene.ts | ☑️ 100% | 腳本規格文件不參與代碼覆蓋率 |
| **demo_技術架構.md (doc_tech_0015)** | ServiceLoader.ts, PoolSystem.ts, ResourceManager.ts, EffectSystem.ts, AudioSystem.ts... | 🩵 90% | 尚無（ServiceLoader.test.ts 待建）；已有：`tests/EventSystem.test.ts` ✅, `tests/CurveSystem.test.ts` ✅, `tests/VfxEffectConfig.test.ts` ✅ |
| **keep.md (doc_index_0011) §7** | MaterialUtils.ts, MaterialSystem.ts | ☑️ 100% | (過渡 API，無需測試) |
| 俘虜處理系統.md (doc_spec_0021) | 尚無實作 | 🔴 0% | 尚無 |
| 傭兵系統（試用）.md (doc_spec_0029) | 尚無實作 | 🔴 0% | 尚無 |
| 可結緣女性來源系統.md (doc_spec_0003) | 尚無實作 | 🔴 0% | 尚無 |
| 同名武將系統.md (doc_spec_0005) | 尚無實作 | 🔴 0% | 尚無 |
| 名士預言系統.md (doc_spec_0006) | 尚無實作 | 🔴 0% | 尚無 |
| 名詞定義文件.md (doc_spec_0008) | 尚無實作 | ☑️ 100% | 靜態定義，無邏輯測 |
| 因子解鎖系統.md (doc_spec_0009) | 尚無實作 | 🔴 0% | 尚無 |
| 培育系統.md (doc_spec_0026) | 尚無實作 | 🔴 0% | 尚無 |
| 家族關係（史實相性）系統.md (doc_spec_0024) | 尚無實作 | 🔴 0% | 尚無 |
| 戰場適性系統.md (doc_spec_0041) | 尚無實作 | 🔴 0% | 尚無 |
| 教官系統（支援卡）.md (doc_spec_0027) | 尚無實作 | 🔴 0% | 尚無 |
| 正式版劇本文案.md (doc_spec_0004) | 尚無實作 | 🔴 0% | 文案文件 |
| 武將壽命系統.md (doc_spec_0018) | 尚無實作 | 🔴 0% | 尚無 |
| 武將戰績系統.md (doc_spec_0019) | 尚無實作 | 🔴 0% | 尚無 |
| 武將背包（倉庫）系統.md (doc_spec_0017) | 尚無實作 | 🔴 0% | 尚無 |
| 留存系統.md (doc_spec_0025) | 尚無實作 | 🔴 0% | 尚無 |
| 結緣系統（配種）.md (doc_spec_0028) | 尚無實作 | 🔴 0% | 尚無 |
| 經濟系統.md (doc_spec_0032) | 尚無實作 | 🔴 0% | 尚無 |
| 血統理論系統.md (doc_spec_0011) | 尚無實作 | 🔴 0% | 尚無 |
| 資源循環系統.md (doc_spec_0033) | 尚無實作 | 🔴 0% | 尚無 |
| 轉職與宿命系統.md (doc_spec_0043) | 尚無實作 | 🔴 0% | 尚無 |
| 轉蛋系統.md (doc_spec_0042) | 尚無實作 | 🔴 0% | 尚無 |
| 遊戲時間系統.md (doc_spec_0034) | 尚無實作 | 🔴 0% | 尚無 |
| 運氣系統.md (doc_spec_0035) | 尚無實作 | 🔴 0% | 尚無 |
| 道具系統（付費免費道具）.md (doc_spec_0036) | 尚無實作 | 🔴 0% | 尚無 |
| 領地治理系統.md (doc_spec_0037) | 尚無實作 | 🔴 0% | 尚無 |
| **戰法場景規格書.md (doc_spec_0039)** | ActionSystem.ts (部分) | 🔴 5% | `tests/core/systems/ActionSystem.test.ts` (場景戰法效果驗證) |
| 熱更新與版本控制規格書.md (doc_tech_0012) | 尚無實作 | 🔷 100% | 策略流程文件 |

---

### D-2. 待建 UI Spec 檔案（待辦）

> 原 `cross-ref-ui-spec.md C-3`。優先級：P0 = 阻擋功能開發 / P1 = 下週目標 / P2 = 月底目標。

| 優先級 | 檔案 | 依賴規格書 |
|---|---|---|
| P0 | `layouts/nurture-session-main.json` | 培育系統.md (doc_spec_0026) |
| P1 | `skins/nurture-session-default.json` | 培育系統.md (doc_spec_0026) |
| P1 | `screens/nurture-session-screen.json` | 培育系統.md (doc_spec_0026)、教官系統（支援卡）.md (doc_spec_0027) |
| P2 | `layouts/general-detail.json` | 武將人物介面規格書.md (doc_ui_0012) |
| P2 | `layouts/general-bloodline-vignette-main.json` | 武將人物介面規格書.md (doc_ui_0012)、血統理論系統.md (doc_spec_0011) |
| P2 | `skins/general-bloodline-vignette-default.json` | 武將人物介面規格書.md (doc_ui_0012)、UI 規格書.md (doc_ui_0027) |
| P2 | `screens/general-bloodline-vignette-screen.json` | 武將人物介面規格書.md (doc_ui_0012)、UI 規格書.md (doc_ui_0027) |
| P2 | `layouts/spirit-tally-detail-main.json` | 兵種（虎符）系統.md (doc_spec_0012)、武將人物介面規格書.md (doc_ui_0012) |
| P2 | `skins/spirit-tally-detail-default.json` | 兵種（虎符）系統.md (doc_spec_0012)、UI 規格書.md (doc_ui_0027) |
| P2 | `screens/spirit-tally-detail-screen.json` | 兵種（虎符）系統.md (doc_spec_0012)、UI 規格書.md (doc_ui_0027) |
| P2 | `layouts/world-sandtable-main.json` | 大廳系統.md (doc_spec_0002)、官職系統.md (doc_spec_0014) |
| P2 | `skins/world-sandtable-default.json` | 大廳系統.md (doc_spec_0002)、UI 規格書.md (doc_ui_0027) |
| P2 | `screens/world-sandtable-screen.json` | 大廳系統.md (doc_spec_0002)、官職系統.md (doc_spec_0014) |
| P2 | `layouts/rank-progress-main.json` | 官職系統.md (doc_spec_0014) |
| P2 | `skins/rank-progress-default.json` | 官職系統.md (doc_spec_0014)、UI 規格書.md (doc_ui_0027) |
| P2 | `screens/rank-progress-screen.json` | 官職系統.md (doc_spec_0014)、UI 規格書.md (doc_ui_0027) |
| P2 | `layouts/bloodline-mirror-loading-main.json` | 血脈命鏡過場載入規格書.md (doc_ui_0005)、UI 規格書.md (doc_ui_0027) |
| P2 | `skins/bloodline-mirror-loading-default.json` | 血脈命鏡過場載入規格書.md (doc_ui_0005)、UI 規格書.md (doc_ui_0027) |
| P2 | `screens/bloodline-mirror-loading-screen.json` | 血脈命鏡過場載入規格書.md (doc_ui_0005)、UI 規格書.md (doc_ui_0027) |
| P2 | `content/bloodline-mirror-states-v1.json` | 血脈命鏡過場載入規格書.md (doc_ui_0005)、UI 規格書.md (doc_ui_0027) |
| P2 | `contracts/bloodline-mirror-state-content.schema.json` | 血脈命鏡過場載入規格書.md (doc_ui_0005)、UI 規格書.md (doc_ui_0027) |

---

### D-3. 待定 Contract（尚未決定是否拆成獨立 screen）

> 原 `cross-ref-ui-spec.md C-4`。

| 概念 | 暫定 contract / state | 目前掛點 | 規格來源 |
|---|---|---|---|
| 晨報摘要 | `pending: morning-report-content` | `LobbyMain` 登入後摘要層 | 武將日誌與離線互動系統.md (doc_spec_0015)、UI 規格書.md (doc_ui_0027) |
| 武將日誌抽屜 | `pending: general-journal-content` | `LobbyMain` / `GeneralDetail` 抽屜層 | 武將日誌與離線互動系統.md (doc_spec_0015)、武將人物介面規格書.md (doc_ui_0012) |
| 派遣整備掛點 | `pending: dispatch-board-content` | `LobbyMain` 任務 / 生活感入口 | 武將日誌與離線互動系統.md (doc_spec_0015)、UI 規格書.md (doc_ui_0027) |
| 挑戰賽賽季卡 | `pending: tournament-season-card` | `LobbyMain` 世界沙盤旁次卡 | 名將挑戰賽系統.md (doc_spec_0007)、UI 規格補遺_2026-04-11_大廳晨報與人物日誌pending.md (doc_ui_0030) |
| 經濟補貼提示 | `pending: economy-subsidy-banner` | `LobbyMain` 資源列 / 許願祭壇提示條 | 經濟系統.md (doc_spec_0032)、UI 規格補遺_2026-04-11_大廳晨報與人物日誌pending.md (doc_ui_0030) |
| 虎符戰記摘要 | `pending: general-tally-summary` | `GeneralDetail` overview 次卡 / peek | 兵種（虎符）系統.md (doc_spec_0012)、武將人物介面規格書.md (doc_ui_0012)、UI 規格補遺_2026-04-11_大廳晨報與人物日誌pending.md (doc_ui_0030) |
| 結緣模式摘要 | `pending: bonding-lineage-mode-chip` | `BondingSetup` 父母摘要列 / 結果預估卡 | 結緣系統（配種）.md (doc_spec_0028)、UI 規格補遺_2026-04-11_培育戰場轉蛋pending.md (doc_ui_0031) |
| 培育學年階段列 | `pending: nurture-phase-block-header` | `NurtureSession` 頂部進度列 | 培育系統.md (doc_spec_0026)、UI 規格補遺_2026-04-11_培育戰場轉蛋pending.md (doc_ui_0031) |
| 畢業戰術標籤條 | `pending: graduation-tags-strip` | `NurtureSession` 畢業摘要 / `GeneralDetail` peek | 培育系統.md (doc_spec_0026)、UI 規格補遺_2026-04-11_培育戰場轉蛋pending.md (doc_ui_0031) |
| 軍師 HUD 摘要 | `pending: strategist-hud-summary` | `BattleScene` Top HUD 次層 / 右側可收合抽屜 | 關卡設計系統.md (doc_spec_0044)、主戰場UI規格書.md (doc_ui_0001)、UI 規格補遺_2026-04-11_培育戰場轉蛋pending.md (doc_ui_0031) |
| 關卡回收摘要 | `pending: stage-salvage-summary` | `BattleScene` 戰中提示條 / 戰後摘要卡 | 關卡設計系統.md (doc_spec_0044)、主戰場UI規格書.md (doc_ui_0001)、UI 規格補遺_2026-04-11_培育戰場轉蛋pending.md (doc_ui_0031) |
| 雙池定位導覽 | `pending: gacha-pool-positioning-brief` | `GachaMain` tab header / pity 區旁說明帶 | 轉蛋系統.md (doc_spec_0042)、UI 規格補遺_2026-04-11_培育戰場轉蛋pending.md (doc_ui_0031) |
| 轉蛋 Banner 主視覺 | `pending: gacha-banner-hero-art-policy` | `GachaMain` BannerStage 人物主視覺 / pool-specific key visual | 轉蛋系統.md (doc_spec_0042)、UI 規格補遺_2026-04-11_培育戰場轉蛋pending.md (doc_ui_0031) |

---

### D-4. 專案總進度摘要

> 最後由 `crossref-progress-scanner` 自動計算：**2026-04-12**。
> 加權公式：核心戰場系統 ×3 ／ UI 系統 ×2 ／ 其他系統 ×1；🟢/🩵/☑️/🔷 = 1.0、🟡 = 0.5、🔴 = 0。
> 更新指令：`node tools_node/rebuild-crossref.js --rebuild-progress`

#### 加權進度總表

| 分類 | 計分權重 | 規格書數 | 最高得分 | 實得分 | 完成率 |
|---|---|---|---|---|---|
| 核心戰場系統（FormulaSystem / BattleSystem / BattleController / EnemyAI 等） | ×3 | 7 | 21 | 9.0 | **43%** |
| UI 系統（BattleHUD / GeneralDetailPanel / UIManager / UIPreviewBuilder 等） | ×2 | 6 | 12 | 9.0 | **75%** |
| 其他系統（工具 / 數據 / 大廳 / 未實作規格） | ×1 | 42 | 42 | 10.5 | **25%** |
| **合計（加權）** | — | **55** | **75** | **28.5** | **🟡 38%** |

#### 規格書實作狀態分布

| 狀態 | 說明 | 規格書數 |
|---|---|---|
| 🟢 / 🩵 完整實作（≥60%） | 數值系統、兵種虎符、戰場部署、武將人物介面、主戰場UI、主戰場v3、UI技術規格書、MVP、新手開場、Data Schema、美術素材、demo_技術架構 | 12 |
| ☑️ / 🔷 完結文件（規格完成，無需代碼覆蓋） | 場景搭建指南、demo_playbook、keep.md §7、名詞定義、熱更新規格書 | 5 |
| 🟡 進行中（20–59%） | 武將系統、大廳系統 | 2 |
| 🔴 尚無 / 極少實作（<20%） | 戰法/奧義/因子爆發/AI 戰場 + 36 個「尚無實作」規格 | 36 |
| **合計** | | **55** |

#### 代碼覆蓋摘要（來自 B-1 × scripts 掃描）

| 項目 | 數量 |
|---|---|
| B-1 已記錄 `.ts` 檔 | 124 |
| B-1 ∩ 磁碟一致（present） | 124 |
| B-1 中已消失（stale） | **0** ✅ |
| `assets/scripts/` 尚未收錄（uncovered） | **14** ⚠️ |
| `tests/` 測試檔數目 | 26 |

#### 14 個未收錄 `.ts` 分類（待補 B-1）

| 分類 | 主要檔案 | 數量 |
|---|---|---|
| 武將資料模型 | AIPopulationConfig, FamilyBranchSummary, GeneralLifecycle, PersonRegistry, SpiritCard, BloodlineGraph, BranchCompactor, BreedingQuotaEnforcer | 8 |
| 培育 / 血統 工具 | BloodlineGenerator, RarityResolver, NurtureSessionMapper | 3 |
| UI 面板 / 彈窗 | UltimateSelectPopup, BloodlineTreePanel, GeneralDataDebugPanel | 3 |
| **合計** | | **14** |

> 上述 14 檔尚未納入 B-1 映射。建議依上表分類，優先補入「武將資料模型」一組（合計 8 檔）再接葵育/血統與 UI 面板兩組。

> ✅ DC 架構 17 檔與 UCUF 框架 17 檔（合計 34 檔）已於 2026-04-12 補入 B-1（`doc_tech_0009` / `doc_ui_0049`）。剩餘 14 檔建議優先補入「武將資料模型」8 檔，再接培育/血統 3 檔與 UI 面板 3 檔。

---

### D-5. 進度歷史紀錄（每日）

> 每日最多一筆：同一天重跑結算時覆蓋該日資料。
> 歷史資料來源：早期可用 git 里程碑估算；自動化啟用後以掃描實算為主。

| 日期 | 加權總進度 | 資料來源 | 備註 |
|---|---|---|---|
| 2026-04-12 | 38% | 掃描實算（D-4） | 同日覆蓋最新值 |
| 2026-04-10 | 36% | 估算（cross-ref 壓縮與工具化） | 追蹤基礎穩定 |
| 2026-04-05 | 34% | 估算（戰場資料與 UI 合約補齊） | 核心/主戰場提升 |
| 2026-03-31 | 31% | 估算（測試骨架落地） | D-1 首版可用 |