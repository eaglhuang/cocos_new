# 交叉索引表 (Cross-Reference Index)

> **唯一索引來源**：本檔案是所有規格書與代碼之間關聯的唯一真實來源。
> 維護規則見 `docs/keep.md` → 🔗 文件與代碼交叉索引規範。
> 正式規格優先回寫母規格；補遺只作過渡整理。若非全新功能規格，結案前必須併回正式規格書並同步更新本索引。
> `docs/討論來源/` 目錄下的文件不參與索引。

> 代碼索引/掃描範圍：僅包含 `assets/` 與 `extensions/` 目錄下的程式碼檔案；其他資料夾不參與代碼索引或自動掃描。

**最後更新**: 2026-04-05 (第十六批：UIPreviewBuilder onReady/Binder 框架整合 + BattleScenePanel ensureCanvasHost + UISpecTypes Widget Fragment)

> **第十八批整合（2026-04-05）**：`UI-2-0059` 已完成收斂並可提交。`general-detail-bloodline-v3-main.json` 正式新增 `OverviewSummaryModules` 與 `BloodlineOverviewModules` 兩個群組邊界，`GeneralDetailOverviewShell.ts` 也改為欄位表批次填值；對應規格、manifest 與 tasks index 已同步回寫。
> **第十七批整合（2026-04-05）**：`UI-2-0058` 已提交 commit `2071d92`。`GeneralDetailBloodlineV3` 進一步進入 `UI-2-0059` skeleton 收斂：overview shell 已將暫時的 `Unowned*` 節點名改為可重用的 `PortraitMode* / OverviewMode*` 語意；覺醒條正式改為 `AwakeningBarTrack + AwakeningBarFill` 的 node contract，對應 `track / fill` skin slot；故事帶也已改用 `Origin / Faction / Role / Awakening / Bloodline / Future` 語意節點，screen contract 收緊為 `allowMissingSkin: false`。
> **第十六批整合（2026-04-05）**：`UIPreviewBuilder.buildScreen()` 正式在 post-build 末尾呼叫 `onReady(binder: UITemplateBinder)`，完成 UI-2-0076 基礎框架；同步加入 Widget realignment pass (`_realignAllWidgets`) 與 bind 佔位符清空邏輯（Unity 對照：`Canvas.ForceUpdateCanvases()`）。`UISpecTypes.ts` 新增 `hCenter/vCenter`、`scroll-view` nodeType、Widget Fragment/Template Param 介面群。`BattleScenePanel` 重構為 `ensureCanvasHost()` helper，統一設定 layer / size(1920×1080) / Widget.AlignMode.ALWAYS。`SceneManager` 新增 `boardRenderer` 視圖橋接。`GeneralDetailOverviewShell` 完全移除 `_mountCardCopy`，改用純 `_setLabel` 對應 layout JSON 節點。

> **第十四批整合（2026-04-05）**：`tasks_index.md` 已重建為乾淨 UTF-8 索引，改由 `ui-quality-todo.json` 生成；同時 `GeneralDetailOverviewShell` 已把 `TopSummaryRow / BloodlineRow / StoryStrip` 的文字節點正式落回 `layout JSON`，runtime 不再臨時建立最終字框。
> **第十三批整合（2026-04-05）**：`GeneralDetailBloodlineV3` 已正式以 `UI-2-0058 -> UI-2-0059 -> UI-2-0061` 的順序收斂；第一批優先固定 slot family / skin contract，並明確要求先重用既有 `general_detail` family 資產，避免 overview shell 繼續停留在 `color-rect` placeholder。
> **第十二批整合（2026-04-05）**：`GeneralDetailPanel` 已開始採用 `overview shell host + tab content host` 的過渡整合方式；目前 `Basics` 可路由到 `GeneralDetailOverviewShell`，而其他 tab 維持既有內容宿主，作為不破壞分頁主體的第一步 runtime 收斂。

> **第十一批整合（2026-04-05）**：補上 `GeneralDetailPanel` 現行 tab 結構與 `GeneralDetailBloodlineV3` overview slot 的一對一對映，正式定義 v3 不應被塞回舊 `RightContentArea/TabBasics`，而是升級為 `GeneralDetail` 的外層首頁殼層；其餘 tab 預設沿用同一個人物頁母型，以模組延展為主，不預設各自獨立成新正式畫面。

> **第十批整合（2026-04-05）**：正式把「補遺僅作過渡、重要內容必須併回母規格」回寫到 `keep.md`，並同步回寫 `武將人物介面規格書.md`、`UI 規格書.md` 與本索引；同時明確定義 `GeneralDetailBloodlineV3` 屬於 `GeneralDetail` 的預設首頁 / 總覽殼層，而不是第二套平行正式人物系統。

> **第九批整合（2026-04-02）**：新增 `血脈命鏡過場載入規格書.md`，正式定義品牌級 Loading / 覺醒 / 升星畫面的 `雙面命格 + 命鏡裂隙 + 定心者 + 命運故事帶` 骨架；同步回寫 `UI 規格書.md` 的世界觀過場序列與 ui-spec 待建入口。

> **第八批整合（2026-04-01）**：依據基因傳承世界觀重定位，正式回寫 `新手開場規格書.md`、`血統理論系統.md`、`武將人物介面規格書.md`、`同名武將系統.md`、`兵種（虎符）系統.md`、`名詞定義文件.md`、`血統樹14人UI規格書.md`、`UI 規格書.md`。本批新增的核心主軸包含：`祖紋命篆`、`命紋靈獸`、`歷史趣聞 / 血脈傳聞`、`血脈卡 / 英靈虎符`、重複卡分流（`復生重練 / 血脈灌注`），以及「UI 只做微調、不整套翻新」原則。

> **本次批次更新（2026-03-30）**：依據 `docs/討論來源/比較舊的/` 11 份舊討論檔整合，更新以下 12 份規格書（新增 K/L 章節或公式補充）：武將壽命系統、遊戲時間系統、培育系統、運氣系統、結緣系統（配種）、血統理論系統、戰場適性系統、教官系統（支援卡）、轉蛋系統、留存系統、領地治理系統、名將挑戰賽系統。衝突以現行規格書為準。

> **第二批整併（2026-03-30）**：再依 `docs/討論來源/更舊的討論/` 與根目錄討論檔補強正式文件，主要回寫至：血統理論系統、因子爆發系統、武將壽命系統、結緣系統（配種）、名士預言系統、轉蛋系統、俘虜處理系統、戰場部署系統、新手開場規格書、UI 規格書、主戰場UI規格書、demo_技術架構.md、keep.md。所有衝突仍以現行正式規格與本索引為準。

> **第四批整合（2026-03-31）**：支援卡系統 + 支援卡轉蛋系統完整設計。主要變更：
> 1. `教官系統（支援卡）.md` — 新增 § K 師友羈絆系統、§ L 好友借用教官機制、§ M 分解與碎片系統；E table 補充 9-12 功能項；J 名詞補充；I Schema 新增 Training_Slot_Affinity / Synergy_Partners / Decompose_Value
> 2. `轉蛋系統.md` — F 公式改為雙池機率表（英靈名將池 SSR3%/SR10%；策謀紅顏池 SSR3%/SR15%）；新增三幣制（靈玉/銅錢符/求籤令）+ 1抽/10連UI規格；I Schema 改為雙池獨立保底結構；H/J 補充新字串與名詞
-> 2. 新建 `ui-quality-todo.md` — 23 個 task 的分配、狀態、依賴、優先序追蹤；含 Agent1/Agent2 雙軌平行路線圖與打斷恢復流程

> **第六批整合（2026-03-31）**：依據新一輪 UI 參考圖分析，回寫兩份正式文件的按鈕 family 標準：
> 1. `keep.md` § 4.1 — 補充參考圖歸納出的 5 類按鈕 family、family 分配的 4 個判斷軸，以及參考圖導向的 family 萃取工作流
> 2. `美術素材規劃與使用說明.md` § 4.4 / § 8 — 補充參考圖驅動的按鈕 family workflow、預備命名與建立 common family 的升級條件

> **第三批整合（2026-03-30）**：全量文件矛盾掃描與結構化整理。主要變更：
> 1. Data Schema文件 — 修正 Stats.CHR→CHA、補 LEA、Vitality_Current→Vitality+Vitality_Max、新增 § 2 子系統快照匯總表
> 2. 新建 `戰法場景規格書.md` — 集中 30 戰法×場景效果 + 天氣/地形/夜襲/奧義演出
> 3. UI 規格書 § 8.1 — 補齊 7 個延伸系統 UI 入口
> 4. demo_技術架構.md § 13 — 新增技術分類索引（工具類/UI技術/核心代碼）

---

## A. 規格書索引（文件 → 相關文件）

> 只列出明確的依賴 / 引用關係，不列模糊的主題重疊。

### 核心基礎系統

| 規格書 | 被依賴（下游系統） | 依賴（上游系統） |
|---|---|---|
| 數值系統.md | 兵種（虎符）系統、武將系統、AI武將強度系統、戰場適性系統、戰場部署系統、轉職與宿命系統 | — |
| 武將系統.md | 轉職與宿命系統、傭兵系統（試用）、武將壽命系統、武將背包（倉庫）系統、俘虜處理系統、武將人物介面規格書.md | 數值系統、遊戲時間系統、名詞定義文件 |
| 名詞定義文件.md | 全系統（UID/Bloodline_ID/Gene/Status 統一定義） | — |

### 血統 + 因子系統族群

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| 血統理論系統.md | 因子爆發系統、培育系統、結緣系統（配種）、同名武將系統、家族關係（史實相性）系統、兵種（虎符）系統、武將人物介面規格書.md、新手開場規格書.md、UI 規格書.md | — |
| 因子爆發系統.md | 戰法系統、戰場適性系統、因子解鎖系統、運氣系統、家族關係（史實相性）系統 | 血統理論系統 |
| 因子解鎖系統.md | 名士預言系統 | 因子爆發系統、培育系統 |
| 同名武將系統.md | 兵種（虎符）系統 | 血統理論系統、轉蛋系統 |
| 家族關係（史實相性）系統.md | — | 血統理論系統、因子爆發系統 |
| 運氣系統.md | — | 因子爆發系統 |

### 養成流水線

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| 結緣系統（配種）.md | 可結緣女性來源系統 | 血統理論系統、因子爆發系統、名士預言系統、資源循環系統、武將壽命系統 |
| 培育系統.md | 戰法系統、教官系統（支援卡） | 因子爆發系統、因子解鎖系統、資源循環系統 |
| 教官系統（支援卡）.md | — | 培育系統、轉蛋系統、武將壽命系統、傭兵系統（試用） |
| 武將壽命系統.md | 結緣系統（配種）、教官系統（支援卡） | 遊戲時間系統、資源循環系統 |
| 轉蛋系統.md | 同名武將系統、教官系統（支援卡）、傭兵系統（試用） | 武將系統 |
| 轉職與宿命系統.md | 兵種（虎符）系統 | 數值系統、因子爆發系統、培育系統 |
| 奧義系統.md | — | 轉蛋系統、武將系統 |

### 戰場系統族群

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| 戰場部署系統.md | 名將挑戰賽系統 | 經濟系統、兵種（虎符）系統、數值系統、武將戰績系統 |
| 兵種（虎符）系統.md | 戰場部署系統、名將挑戰賽系統、武將人物介面規格書.md | 轉職與宿命系統、戰法系統、血統理論系統、同名武將系統 |
| 戰場適性系統.md | — | 因子爆發系統、戰法系統、數值系統 |
| 戰法系統.md | 戰場適性系統、戰法場景規格書（格子戰法定義） | 因子爆發系統、培育系統、教官系統（支援卡） |
| 武將戰績系統.md | 戰場部署系統 | 轉蛋系統 |
| AI武將強度系統.md | — | 數值系統、戰場部署系統 |
| 名將挑戰賽系統.md | — | 戰場部署系統、兵種（虎符）系統、戰場適性系統 |
| 治理模式他國AI系統.md | — | 經濟系統、領地治理系統 |
| **戰法場景規格書.md** | — | 戰法系統、戰場適性系統、奧義系統、戰場部署系統、主戰場UI規格書、治理模式他國AI系統（E-4/E-5 場景戰法觸發） |

### 經濟 & 資源系統

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| 經濟系統.md | 戰場部署系統、道具系統 | 資源循環系統、領地治理系統 |
| 領地治理系統.md | 經濟系統 | 遊戲時間系統 |
| 資源循環系統.md | 結緣系統（配種）、培育系統、經濟系統 | 武將壽命系統 |
| 道具系統（付費免費道具）.md | — | 經濟系統、結緣系統、傭兵系統、培育系統、領地治理系統 |
| 遊戲時間系統.md | 武將壽命系統、領地治理系統、培育系統 | — |

### 社交 & 留存

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| 傭兵系統（試用）.md | 教官系統（支援卡）、可結緣女性來源系統 | 轉蛋系統 |
| 留存系統.md | — | 傭兵系統（試用）、教官系統（支援卡） |
| 名士預言系統.md | 結緣系統（配種） | 因子解鎖系統 |
| 可結緣女性來源系統.md | — | 結緣系統（配種）、傭兵系統（試用）、俘虜處理系統、培育系統 |
| 俘虜處理系統.md | 可結緣女性來源系統 | 經濟系統、武將系統 |
| 武將背包（倉庫）系統.md | — | 轉職與宿命系統、傭兵系統（試用） |

### 樞紐 & 規劃文件

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| MVP遊戲驗證規格書.md | — | 武將系統、結緣系統、培育系統、血統理論系統、因子爆發系統、戰場部署系統 |
| Data Schema文件（本機端與Server端）.md | — | 全系統（匯總所有 I 區 Schema） |
| 新手開場規格書.md | 正式版劇本文案、UI 規格書.md | 轉蛋系統、血統理論系統、因子解鎖系統、道具系統 |
| 正式版劇本文案.md | — | 新手開場規格書、UI 規格書 |
| 血脈命鏡過場載入規格書.md | UI 規格書.md | 血統理論系統.md、武將人物介面規格書.md |

### Docs 層級文件

| 文件 | 被依賴 | 依賴 |
|---|---|---|
| keep.md | 全專案（最高執行準則） | — |
| demo_playbook.md | 場景搭建指南、主戰場UI規格書 | 戰場部署系統、兵種（虎符）系統、數值系統 |
| demo_技術架構.md | — | 數值系統、戰法系統、資源循環系統、戰法場景規格書 |
| 場景搭建指南.md | — | demo_playbook |
| 討論來源整併狀態.md | keep.md | cross-reference-index.md |
| 正式規格矛盾審查.md | keep.md | 討論來源整併狀態.md、cross-reference-index.md |
| 程式規格書.md | — | 新手開場規格書、血統理論系統、轉蛋系統 |
| UI 規格書.md | 正式版劇本文案、UI技術規格書、武將人物介面規格書.md、血統樹14人UI規格書.md | 新手開場規格書、程式規格書、血統理論系統.md、兵種（虎符）系統.md |
| 武將人物介面規格書.md | UI技術規格書、武將系統.md、血統理論系統.md、戰法系統.md、戰場適性系統.md、兵種（虎符）系統.md | GeneralDetailPanel.ts、GeneralUnit.ts、GeneralListPanel.ts、LobbyScene.ts |
| 武將人物介面美術接線清單.md | 武將人物介面規格書.md、UI技術規格書.md | — |
| 主戰場UI規格書.md | UI技術規格書 | demo_playbook、戰場部署系統、兵種（虎符）系統、戰法場景規格書（§ 6 場景視覺主題） |
| 美術素材規劃與使用說明.md | UI技術規格書、demo_技術架構.md | keep.md |
| UI參考圖品質分析.md | UI技術規格書、UI 規格書.md、美術素材規劃與使用說明.md、ui-quality-todo.md | ui-design-tokens.json、general-detail-default.json、keep.md § 4.1 |
| ui-quality-todo.md | — | UI參考圖品質分析.md § 8、keep.md、美術素材規劃與使用說明.md |
| UI技術規格書.md | — | keep.md、UI 規格書.md、主戰場UI規格書.md、美術素材規劃與使用說明.md、武將人物介面規格書.md、武將人物介面美術接線清單.md |
| 熱更新與版本控制規格書.md | — | Data Schema文件（本機端與Server端）.md |
| **Shared Protocols** | SyncManager.ts, server/src/index.ts | 跨平台對稱驗證協議定義 |

---

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
| UISpecTypes.ts | UI技術規格書.md | D: WidgetDef(hCenter/vCenter), UILayoutNodeSpec, UINodeType(scroll-view 新增), UIWidgetFragmentSpec, UITemplateParamDef, UITemplateComposeItem; F: resolveSize |
| UITemplateBinder.ts | UI技術規格書.md, keep.md §8 | 概: 以 layout id/name 建立節點綁定表，供 `onReady(binder)` 查詢（Unity 對照：GetComponentInChildren 安全封裝）|
| UIPreviewLayoutBuilder.ts | UI技術規格書.md | 概: UIPreviewBuilder 拆分出的佈局計算 helper，負責 Widget 對齊與尺寸套用 |
| UIPreviewNodeFactory.ts | UI技術規格書.md | 概: 依 UILayoutNodeSpec 建立 Cocos 節點；bind path 節點顯示 {xxx.yyy} 佔位文字（buildScreen 後由 clearDynamic pass 清除）|
| UIPreviewShadowManager.ts | UI技術規格書.md | 概: 陰影層（9-slice 偽陰影）管理 |
| UIPreviewStyleBuilder.ts | UI技術規格書.md | 概: 字型/色彩/按鈕狀態渲染 helper |
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
| LoadingScene.ts | 新手開場規格書.md, UI參考圖品質分析.md | 概: 過場載入場景，同時也是 D-1~D-3 的 screen-driven preview hub（`previewMode` + `previewTarget`） |
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

## C. UI Spec JSON 資產索引（assets/resources/ui-spec/）

> 三層合約：`layouts/` 節點樹 → `skins/` 外觀資源 → `screens/` 組裝+資料綁定  
> Bundle: `lobby_ui`；Atlas 分組見各檔 `atlasPolicy` 欄位

### C-1. 現有 Spec 檔案清單

| 檔案 | 類型 | 對應規格書 | Atlas | 備注 |
|---|---|---|---|---|
| `layouts/support-card-main.json` | layout | 教官系統（支援卡）.md | lobby_support_card | 三欄 Grid，450×460 cell，4-tab |
| `skins/support-card-default.json` | skin | 教官系統（支援卡）.md | lobby_support_card | 稀有度卡背、星星槽、突破按鈕 |
| `screens/support-card-screen.json` | screen | 教官系統（支援卡）.md | — | 3 screens + 2 popups（突破確認/好友借用） |
| `layouts/gacha-main.json` | layout | 轉蛋系統.md | lobby_gacha | 雙池分頁、PityBar、CurrencyBar、Pull1+Pull10 |
| `skins/gacha-default.json` | skin | 轉蛋系統.md | lobby_gacha | 三池 bg 變體、結果卡背三稀有度、天命商店 |
| `screens/gacha-screen.json` | screen | 轉蛋系統.md | — | 3 screens + 2 popups（機率公告/求籤定向） |

### C-2. UI Spec JSON → 規格書（反向索引）

| UI Spec JSON | 主要依賴規格書 | 相關 Schema 欄位 |
|---|---|---|
| support-card-*.json (×3) | 教官系統（支援卡）.md §B, §D, §F, §K, §L, §M | Support_Card_ID, Star_Level, Training_Slot_Affinity, Synergy_Partners, Decompose_Value, BorrowSession |
| gacha-*.json (×3) | 轉蛋系統.md §C, §E, §F, §I | Hero_Pool, Support_Pool, Pity_Independent, Player_Currency（Spirit_Jade/Bronze_Charm/Divination_Token） |

### C-3. 尚需建立的 Spec 檔案（待辦）

| 優先級 | 檔案 | 依賴規格書 |
|---|---|---|
| P0 | `layouts/training-main.json` | 培育系統.md |
| P1 | `skins/training-default.json` | 培育系統.md |
| P1 | `screens/training-screen.json` | 培育系統.md、教官系統（支援卡）.md |
| P2 | `layouts/general-detail.json` | 武將人物介面規格書.md |
| P2 | `layouts/general-bloodline-vignette-main.json` | 武將人物介面規格書.md、血統理論系統.md |
| P2 | `skins/general-bloodline-vignette-default.json` | 武將人物介面規格書.md、UI 規格書.md |
| P2 | `screens/general-bloodline-vignette-screen.json` | 武將人物介面規格書.md、UI 規格書.md |
| P2 | `layouts/spirit-tally-detail-main.json` | 兵種（虎符）系統.md、武將人物介面規格書.md |
| P2 | `skins/spirit-tally-detail-default.json` | 兵種（虎符）系統.md、UI 規格書.md |
| P2 | `screens/spirit-tally-detail-screen.json` | 兵種（虎符）系統.md、UI 規格書.md |
| P2 | `layouts/bloodline-mirror-loading-main.json` | 血脈命鏡過場載入規格書.md、UI 規格書.md |
| P2 | `skins/bloodline-mirror-loading-default.json` | 血脈命鏡過場載入規格書.md、UI 規格書.md |
| P2 | `screens/bloodline-mirror-loading-screen.json` | 血脈命鏡過場載入規格書.md、UI 規格書.md |
> **第二十批整合（2026-04-05）**：正式將 UI 量產方法論沉到 `keep.md §19` 與 `UI 規格書.md §8.2`。本批明確定義 `選 template family -> 填 content contract -> 套 skin fragment` 為 UI 量產主工作流，並補上 UI Agent 進場必讀順序與文件回寫原則，作為後續多 Agent 協作的共同入口。
> **第二十一批整合（2026-04-05）**：將 UI 量產方法正式落到 Agent brief 執行入口。新增 `docs/agent-briefs/UI-task-card-template.md`，並同步更新 `CheckList.md`、`tasks_index.md`、`agent1-instructions.md`、`agent2-instructions.md` 與 `ui-quality-todo.json` 的 task template，要求新 UI 任務至少寫出 `template_family / content_contract / skin_fragments / smoke_route / docs_backwritten`。
> **第二十二批整合（2026-04-05）**：將 `UI-2-0058 / UI-2-0059 / UI-2-0061` 回補為新模板格式。三張卡與 `ui-quality-todo.json` 現已同步補上 `template_family / content_contract / skin_fragments / smoke_route / docs_backwritten`，並修正 `UI-2-0058` 的 manifest / tasks index 狀態為 `done`。
> **第二十三批整合（2026-04-05）**：將下一張待做卡 `UI-2-0060` 也改為新模板格式，正式指定 `fullscreen-result` 為 template family，並在任務卡與 `ui-quality-todo.json` 補上 `content_contract / skin_fragments / smoke_route / docs_backwritten`，避免後續又回到舊格式開工。
> **第二十四批整合（2026-04-05）**：`UI-2-0060` 已進入真正實作。新增 `layouts/bloodline-mirror-loading-main.json` 與 `skins/bloodline-mirror-loading-default.json`，並讓 `bloodline-mirror-loading-screen.json`、`bloodline-mirror-awakening-screen.json` 一起切到 shared skeleton；正式固定命鏡 loading / awakening 共用 `StateBadge / MirrorHeader / CenterStage / TipPanel / ActionRow / StoryStrip` 模組。
