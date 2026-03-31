# 保留共識 (Keep Consensus)

> **說明**: 本文件記錄專案開發過程中的重要技術決策、架構共識與關鍵約定。AI 助手在處理任何請求前須先讀取此文件，並同步參考 `docs/demo_playbook.md` 的玩法規格。
> 此檔案為當前會話的最高執行準則。所有技術決策需與此保持一致。
> `docs/keep.md` 是專案唯一保留的 keep 共識檔；專案根目錄不再保留第二份 `keep.md`。

**最後更新**: 2026-03-19

---

## 📋 專案基本資訊

- **專案名稱**: NewProject
- **專案類型**: Cocos Creator 跨平台 2.5D 戰鬥遊戲專案
- **引擎版本**: Cocos Creator 3.8.8-121518
- **專案 UUID**: 3cabd774-9528-4461-99d1-01e92b52bdf9
- **開發語言**: TypeScript (ES2015)
- **目標平台**: Web / Android / iOS
- **專案階段**: Demo 規格定案與雛型啟動階段

---

## 🎯 核心開發原則

### 1. 編輯器驅動開發模式
- **必須透過 Cocos Creator 編輯器進行開發**（監聽於 `http://localhost:7456`）
- 所有資源編譯、場景編輯、組件綁定均由編輯器處理
- **禁止**依賴 npm scripts 進行建置

### 2. TypeScript 配置約定
- 使用 `experimentalDecorators: true`（支援 `@ccclass` 等裝飾器）
- **不啟用** strict 模式
- 目標版本: ES2015
- 配置延伸自 `temp/tsconfig.cocos.json`（由 Cocos Creator 自動生成）

### 3. 平台與互動約定
- 第一優先迭代平台為 Web，Android / iOS 需定期進行 smoke test
- 玩家主要互動方式為 **大按鈕 UI + 點擊 / 觸控選目標**
- UI 尺寸與交互必須以手機觸控友善為前提

### 4. 視覺與雛型約定
- 正式表現方向優先採 **2D / Spine**
- Demo 雛型階段優先使用 Cocos Creator 內建 placeholder 資源
- 第一版重點是驗證玩法、節奏與操作，不以正式美術量產為優先

### 5. 架構原則
- 專案必須採 **資料驅動**、**模組解耦**、**可擴充平台抽象層**
- 戰鬥邏輯、單位表現、UI 顯示、配置資料需分離
- 遊戲邏輯不得直接耦合第三方 SDK

### 6. AI / Vibe Coding 協作原則
- AI 產出需以清楚資料夾結構、命名規則、模組責任為前提
- 每次任務應限制修改範圍，避免同時重構多個模組
- 事件機制可用於模組通知，但不應讓核心戰鬥流程過度依賴全域事件
- 動態載入可作為 Demo 手段，但不應把所有資源策略永久綁死在單一路徑機制


### 7. 引擎 API 注意事項

- **`mr.setMaterial(material, index)` 已被標記為 deprecated（ts(6387)）**：請不要在新程式碼或自動產生的程式碼中直接使用此簽章。
- **應用規範**：統一使用 `setMaterialSafe(mr, material, index)`（檔案：[assets/scripts/core/utils/MaterialUtils.ts](assets/scripts/core/utils/MaterialUtils.ts)），或透過 `services().material.bindUnit()` 等高階 API 由系統管理 per-unit material，避免在多處散落直接操作 `MeshRenderer`。
- **給 AI 的指引**：自動產生或修改程式碼時，若需要將材質指派給 `MeshRenderer`，請呼叫 `setMaterialSafe`；不要輸出或插入 `mr.setMaterial(mat, idx)`（舊簽章），以免 TypeScript 編譯或未來引擎更新出現問題。

### 8. 棄用 API 管理原則（必讀）

- **發現即記錄**：任何人或自動化工具發現引擎 API 被標記為 deprecated，應在 `keep.md` 中新增一條目說明（來源、建議替代方案、風險），並同步在相關技術文件（如 `docs/demo_技術架構.md`）加入備註。
- **先包裝再替換**：對外公開或常用的引擎 API（如 `MeshRenderer.setMaterial`），一律先建立 `assets/scripts/core/utils/` 下的 wrapper（例：`MaterialUtils.setMaterialSafe`），在 wrapper 中處理多種引擎簽章或 fallback。所有程式碼應改為呼叫 wrapper，而非直接呼叫被標記為 deprecated 的 API。
- **AI 產生碼規範**：CI 或自動化腳本在自動生成或修正程式碼時，必須參照 `keep.md` 的棄用清單（human-reviewed），避免再次產生已棄用的簽章。對 AI：輸出程式碼不得包含被列入 `keep.md` 棄用清單的直接呼叫。
- **可逐步替換策略**：若專案中有多處已使用 deprecated API，採取可回滾的替換流程：
   1. 登錄到 `keep.md` 的棄用清單並指定替代 wrapper。
   2. 在 `utils/` 新增 wrapper，寫單元測試或手動驗證。
   3. 以搜尋 + 批次替換（PR）進行替換，分小批量提交以便 code review。
   4. 一旦所有呼叫點改用 wrapper，移除舊用法的註解或封存代碼。
- **代碼審查與 CI 檢查**：PR 應強制由至少一名 reviewer 核准替換並在 CI 中加入 lint 規則（或自訂檢查）提醒不得直接使用列為棄用的簽章。
- **文件化**：每個 wrapper 檔案開頭註明：被替代的 deprecated API、建立日期、作者、簡短替代理由，以及回退建議（若適用）。例如 `MaterialUtils.ts` 檔案開頭應包含簡短說明。

### 9. 測試政策（Unit Test）

> **原則**：每開發一個新功能，必須評估是否需要同步建立 unit test，並整合到 test 框架中統一管理。

- **評估標準**：若功能包含複雜邏輯（計算公式、狀態機、資料轉換、邊界條件），應同步建立 unit test。
- **純邏輯優先**：與 cc 引擎無關的純 TypeScript 業務邏輯（BattleFormula、BuffSystem、GeneralSystem 等）為最高優先測試對象。
- **測試框架**：使用 `mocha` + `chai` 或 Cocos Creator 內建測試工具，測試檔案統一放置於 `assets/scripts/tests/` 目錄下。
- **AI 協作規範**：AI 在實作邏輯類功能時，應主動評估並提示是否需要同步建立 unit test，並在確認後一併產出測試程式碼。
- **現有功能補齊**：BattleFormula、DuelSystem、TileBuff 計算邏輯為首批補測試的目標。
---

## 🧭 Demo 核心方向

### 1. 第一階段玩法定位
- Demo 採 **2.5D 俯視角、雙入口主玩法**
- 玩法 A：**遭遇戰**
- 玩法 B：**推進模式**

### 2. 共通戰場規格
- 核心戰場為 **5 路 x 8 格深度** 的小棋盤
- 雙方各有一名將軍作為核心目標
- 小兵以格子為單位推進與接戰
- 敵方將軍被擊倒則獲勝，我方將軍被擊倒則失敗

### 3. 遭遇戰共識
- 玩家可直接進入一場完整戰鬥
- 主要用於驗證對推規則、部署操作、勝敗循環與可讀性
- 當遭遇敵將時，敵將固定出現在棋盤右上方並面向我方

### 4. 推進模式共識
- 玩家先沿道路持續推進，再遭遇事件
- 推進途中可能遭遇：敵將、神秘商人、大寶箱、其他 NPC
- 遭遇敵將時切入遭遇戰版型
- 推進模式需預留「棋盤轉換為道路向前移動」的視覺與動畫方向

### 5. 畫面構圖共識
- 我方武將固定在畫面左下角區域
- 左下角需預留額外空間，供未來玩家角色站在武將旁邊作為輔助角色
- 左下區域不可被主要按鈕 UI 遮擋
- 主要操作按鈕區應優先配置於畫面下方中間或右下方

---

## 🚫 禁止操作清單

以下檔案/資料夾**禁止手動編輯**，由 Cocos Creator 自動管理：

- `temp/tsconfig.cocos.json` — 自動生成的 TypeScript 配置
- `profiles/v2/`, `settings/v2/` — 編輯器設定檔
- `library/` — 資源資料庫（唯讀、雜湊索引）
- `build/`, `native/` — 建置輸出（.gitignore 已排除）

---

## 🔧 開發工作流

### 編譯與重新整理
- 透過 Cocos Creator 編輯器與既有任務進行資源刷新與編譯
- VS Code 的 `Cocos Creator compile` task 統一使用 `curl.exe http://localhost:7456/asset-db/refresh`，避免 PowerShell 將 `curl` 解譯成 `Invoke-WebRequest` 而跳出互動式安全提示。

### 除錯配置
- Chrome Debugger 連接至 `http://localhost:7456`
- 使用 VS Code 內建的 Chrome Debugger 擴充功能

### 腳本與文件開發
1. 在 `assets/` 資料夾中撰寫 TypeScript 組件
2. 使用 `@ccclass` 裝飾器註冊組件類別
3. 透過 Cocos Creator Inspector 綁定至場景物件
4. Demo 規格與技術決策同步維護於 `docs/` 目錄
5. `VfxComposerTool` 作為場上即時預覽工具持續維護，預設支援分類切換、搜尋、單積木大圖預覽、Quad / Particle Prefab 雙模式，以及 Particle 顏色/尺寸/速度覆寫。
6. 小兵 / 武將 GLB 原始資產若要支援執行期動態載入，統一整理到 `assets/resources/units/troops/<type>/unit.glb` 與 `assets/resources/units/heroes/<hero-id>/hero.glb`；`UnitRenderer` 的小兵視覺改為優先讀取 `UnitAssetCatalog`，troop 若沒有實體 `.prefab` 則改以 `gltf-scene` sub-asset UUID 動態載入，載不到才 fallback cube。
7. `assets/scripts/core/config/UnitAssetCatalog.ts` 為執行期單位資產索引表，集中管理 troop 的 `sceneUuid`、formation scale/spacing，以及 hero 的 prefab 路徑；若資產調整，應優先重新產生 catalog，而不是在 `UnitRenderer` 內硬編碼 UUID。

---

## 📦 型別定義來源

- **引擎 API**: `@cocos/creator-types/engine` → `cc` 模組
- **編輯器 API**: `@cocos/creator-types/editor` → `Editor` 物件
- **自動生成**: `temp/declarations/` (cc, jsb, macros, env)

---

## 🏗 架構決策

1. **MVC + Service 混合架構**：戰鬥邏輯集中在純 TypeScript 類別，不依賴 Component，方便測試與移植。
2. **ServiceLoader 單例 DI 容器**：持有 9 個服務（Event, Formula, Pool, Resource, Effect, Buff, Battle, Game, UI），`initialize()` 時注入依賴。
3. **資料驅動**：兵種（troops.json）、武將（generals.json）、遭遇戰（encounters.json）皆以 JSON 設定檔管理。

### 資料驅動原則擴展

4. **ActionSystem / 技能配置 JSON 化**：技能演出（動畫、特效、音效、傷害時機）應朝 JSON 時間軸配置發展，設計師可免編譯調整演出流程。參見 M-5。
5. **VFX_EFFECT_TABLE JSON 化**：`vfx-usage-table.ts` 的 TS 常量表應遷移為 `vfx-effects.json`，讓特效配置可由非程式人員維護。參見 M-7。

### 特效綁定完整性（三位一體原則）

6. **特效-音效-通知三位一體**：新增特效時，必須同時定義對應的音效與 UI 通知（浮字/提示），透過 `playFullEffect(key)` 單一入口觸發，防止視/聽/邏輯不一致。參見 M-7。
7. **Buff 主圖示表現改為設定驅動**：`BuffGainEffectPool` 的主圖示旋轉角與縮放倍率需由 `BuffEffectConfig` 控制，不再把劍/愛心朝向與尺寸硬寫死在 pool 內。這樣後續新增 buff 圖示時，只需在 `UnitRenderer` 初始化時調整設定即可。

### Core / Logic 分層意識

8. **core/ 不引用 battle/ 或 ui/**：`scripts/core/` 應只包含引擎抽象與通用服務，可跨專案共用。遊戲特化邏輯歸入 `battle/` 或 `ui/`。Core 層的 import 不可引用 battle 或 ui 的任何內容。參見 L-8。

### 棋盤遊戲移動原則

9. **格子移動使用 tween + easing，不使用 Steering Behaviors**：本專案為格子制策略遊戲，單位移動是離散的格子到格子，tween + easing 已足夠且更合適。Steering Behaviors（seek/flee/arrive/wander）適用於自由移動的 3D 遊戲，在棋盤上為過度設計。此決策已記錄於優化方案「Section 五 — 評估後不納入項目」。

---

## 🔧 編輯器擴展

9. **雙進程架構**：Cocos Creator 編輯器擴展必須分成 `main.ts`（Editor Main Process，不可用 cc）和 `scene-script.ts`（Scene Renderer Process，可用 cc）。
10. **package_version: 2**：所有擴展的 `package.json` 必須包含 `"package_version": 2`。
11. **battle-scene-builder**：一鍵生成場景節點樹（推薦方案），取代 SceneAutoBuilder 運行時方案。
12. **studio-tools-hub**：精靈管線工具，使用 `console.log` 而非 `Editor.log`。

---

## ⚔️ 戰鬥系統

13. **回合流程**：PlayerDeploy（成功部署後自動推進）→ 敵方部署 → AutoMove → BattleResolve → SpecialResolve → 勝敗判定 → nextTurn；若本回合不部署可手動按「結束回合」。
14. **武將技能 SP 系統**：擊殺敵方單位 +20 SP，SP 滿 → 可發動技能。
15. **狀態效果**：由 BuffSystem 統一管理，暈眩（Stun）使單位跳過移動與攻擊、解除盾牆。
16. **部署 UX**：選擇兵種 → 點擊路線按鈕 = 立即部署（選路即部署）。
17. **部署限制**：敵我雙方每回合最多部署 1 隻小兵（保留 DP 計算與可調參常數）。
18. **提示 UX**：部署成功/失敗、手動結束回合統一使用 Toast 提示，避免無回饋造成誤判。
19. **戰況可視化**：右側維持「文字棋盤 + 戰鬥紀錄小面板」雙欄顯示，優先提升可讀性與除錯效率。

---

## 💻 開發環境

20. **Cocos Creator 3.8.8**，TypeScript ES2015，Editor 監聽 `http://localhost:7456`。
21. **Node.js v24.12.0**，PowerShell 不直接支援 npx，需 `cmd /c "npx ..."`。
22. **擴展編譯**：`cd extensions/battle-scene-builder && cmd /c "npx tsc"` 產出 `dist/main.js` + `dist/scene-script.js`；`cd extensions/unit-asset-organizer && cmd /c "npx tsc"` 產出單位資產整理工具的 `dist/main.js`。

---

## ⚠️ 已知限制

23. **EffectSystem** 為骨架，`showDamageText()` 尚未實作。
24. **UIManager** 已實作但 BattleScene 未使用（直接管理 UI）。
25. **encounters.json** 的 `enemyInitialDeployment` 尚未被程式讀取（敵方初始部署由 AI 自動產生）。
26. **SceneAutoBuilder** 預設也可在編輯模式直接生成並持久保留節點，但推薦方案仍是 `battle-scene-builder` 擴展。

27. **固定相機與 UI 構圖**：
   - 主攝影機使用固定數值 (Position `(-3.80528,7.598808,-7.911689)`, Rotation `(-44.111815,-143.244049,5.5)`, FOV 30) 對齊參考示意圖。
   - 棋盤縮放為目標深度 6.8，格子間距為寬度 10%。
   - 設定 UI 左側保留兩欄兵種按鈕並預留左上角給玩家頭像，技能按鈕固定在右下。
   - 這些規則已寫入相應的 View 組件並於 `start()` 時自動套用，避免場景手動調整。

28. **事件資料豐富化**：
   - `UnitMoved`、`UnitDamaged`、`UnitHealed` 與 `UnitDied` 現在攜帶位置信息，有助於動畫與特效。
   - `GeneralDamaged` 用於記錄與顯示主將受擊。
   - 旨在保持控制器與 View 間的明確責任分界。

29. **部署入口收斂**：
   - 移除底部 `路1~路5` 路線按鈕，統一改為「選兵種後直接點棋盤部署列」。

30. **戰鬥演出節奏化**：
   - 受擊演出改為事件佇列逐筆播放，每筆間隔 0.5 秒，避免同時播放造成資訊壓縮。

31. **地板 Buff 系統（資料驅動）**：
   - 每回合隨機產生 1~3 個 Buff，規則改由 `assets/resources/data/tile-buffs.json` 管理。
   - Buff 被踩到後消失，但單位身上的數值加成可持續疊加，並以頭頂括號顯示差值。

31-1. **Buff 粒子參數 JSON 化**：
   - Buff 粒子參數主來源改為 `assets/resources/data/buff-particle-profiles.json`。
   - `BuffGainEffectPool.ts` 只負責載入、正規化與套用，不再作為 preset 唯一真實來源。
   - JSON 可只覆寫部分欄位，缺漏值由 TypeScript fallback 自動補齊，便於熱更 patch 與 AI 批次改參。
   - prefab 仍負責節點結構，JSON 只管理數值與顏色，不負責描述節點拓樸。

31-2. **VFX Effect 表版本化**：
   - `assets/resources/data/vfx-effects.json` 採用 `version + effects` schema，並由純 TypeScript 正規化模組處理 migration 與 fallback。
   - 舊版裸 `Record<string, VfxEffectDef>` 結構視為 legacy v0，載入時自動升級到目前 schema。
   - 未來若熱更包只覆寫部分欄位，既有效果定義會由內建 fallback 自動補齊，避免因漏欄位而整批失效。
   - 若載入到高於客戶端可理解的 schema 版本，系統應保守退回內建 fallback，確保舊版客戶端不因未知資料結構崩潰。

32. **武將單挑系統**：
   - 觸發條件：任一武將推進至對方前排即發動邀請（對稱法則）。
   - 武將化身 TroopUnit 上場：HP=currentHp, ATK=maxHp×8%, DEF=30, moveRange=2, attackRange=1（含斜對角，Chebyshev距離）。
   - 全軍增益：出陣方所有小兵攻擊力翻倍（含後續部署）。
   - 敵軍仇恨：敵方小兵優先攻擊出陣中的武將。
   - 防守方接受判定：依主將HP、場上兵力、總戰力計算評分，score=0.45×HP+0.35×兵力+0.2×戰力，≥0.58接受。
   - 拒絕懲罰：拒絕方全軍攻防與武將HP減半（新部署小兵同樣減半）。
   - 狀態追蹤：`playerGeneralUnitId`、`enemyGeneralUnitId`、`isWaitingDuelPlacement`、`duelRejectedFaction`。
   - 武將每回合可與友軍交換位置繼續突進。
   - 5 個新事件：`GeneralDuelStart`、`GeneralDuelChallenge`、`GeneralDuelAccepted`、`GeneralDuelRejected`、`DuelPenaltyApplied`。

33. **結算面板 UI 層級**：
   - ResultPopup 使用動態建立的全螢幕半透明遮罩 + 彩色卡片背景，並透過 `setSiblingIndex` 確保最高 UI 層級。

34. **右下操作按鈕**：
   - 技能釋放 → 武將單挑 → 計謀策略 → 回合結束，共 4 顆，統一 200×70，間距 14px。


---

## 📦 資產管理與 Bundles

35. **Bundle 分層策略**：
   - `vfx_core`：可共用的特效積木（貼圖、Shader、Mesh），按視覺功能分類（glow/fire/smoke/impact/trails/lightning/projectile/status）。
36. **Buff 粒子 prefab 固化規格**：
   - Buff 視覺只維護兩個 base prefab：`assets/resources/fx/buff/buff_gain_3d.prefab` 與 `assets/resources/fx/buff/buff_debuff_3d.prefab`。
   - 兩個 prefab 的固定節點規格必須一致：`RingRoot`、`IconRoot`、`SparkPS`、`AccentPS`。
   - prefab root 必須掛 `BuffEffectPrefabController`，由它在 Editor / Runtime 驗證節點結構、承接舊版 `Particle-001` 命名，並補齊 Accent 粒子 emitter。
   - `RingRoot` / `IconRoot` 只承接 quad 視覺層；`SparkPS` / `AccentPS` 只承接 3D 粒子層。不要把圖示 quad 和粒子 emitter 混掛在同一節點。

37. **四種 Buff 變體只靠 runtime preset 區分**：
   - `AtkGain`、`HpGain` 共用 gain prefab；`AtkLoss`、`HpLoss` 共用 debuff prefab。
   - 四種表現差異統一由 `BuffGainEffectPool.ts` 的 preset 表覆寫：粒子數量、上浮高度、顏色、尺寸、壽命、速度、burst 數量與 debuff 的濁度感。
   - 除非 base prefab 的材質、貼圖或 emitter 拓樸需要改，否則不要為四種 Buff 各自再複製 prefab。

38. **Editor 檢視規則**：
   - 在 Assets 面板直接選 prefab 資產時，Inspector 只會顯示資產層級資訊，不會展開 `Node Transform` 與 `ParticleSystem` 模組。
   - 需要檢視或調整節點 transform / 粒子參數時，必須雙擊 prefab 進入 Prefab 編輯模式，或拖到場景後選取實例節點。
   - `vfx_skills`：技能專用特效 Prefab，使用 `@SIZE` 命名規範（`@256`/`@128`/`@no-compress`）。
   - `audio`：音效與音樂，分 `bgm/`、`sfx/`、`voice/`。
   - `ui`：UI 圖集與字型。
   - `scenes`：場景專用資源。

36. **VFX Core 積木庫管理**：
   - **命名規範**：`tex_{分類}_{描述}.png`（如 `tex_glow_flash_burst.png`）。
   - **Registry 登錄**：所有積木必須在 `vfx-block-registry.ts` 的 `VFX_BLOCK_REGISTRY` 中登錄 `VfxBlockDef`。
   - **Usage 宣告**：在 `vfx-usage-table.ts` 的 `VFX_EFFECT_TABLE` 中宣告積木組合關係。
   - **擴充 SOP**：拆解 → 改名 → 歸檔 → Registry 登錄 → Usage 宣告 → 更新 README → 驗證（7 步驟）。
   - **治理工具**：`findUnusedBlocks()` API 可偵測死資源。

37. **壓縮規格**：
   - 貼圖尺寸 ≤256 放入 `@256` 子資料夾，≤128 放入 `@128`，特殊需求放入 `@no-compress`。
   - 詳見 `assets/bundles/vfx_core/textures/_TEX_COMPRESSION.md`。

---

## 🎬 Buff 增益特效分鏡

38. **地板 Buff 視覺規範**：
   - 每個 Buff 由 3 層組成：底層光環（Glow）+ 中層圖示（Icon）+ 頂層粒子（Particle）。
   - 光環使用 `tex_glow_*` 積木，圖示使用 UI Sprite，粒子使用 `tex_smoke_*` 或 `tex_fire_*`。
   - 顏色編碼：攻擊 Buff 紅色系、防禦 Buff 藍色系、速度 Buff 綠色系、治療 Buff 金色系。

39. **拾取演出**：
   - 單位踩到 Buff 時，觸發 3 階段演出：
     1. Buff 光環向上飛起並縮小（0.3 秒）
     2. 飛向單位頭頂並爆開（0.2 秒）
     3. 數值變化浮字顯示（0.5 秒）
   - 音效：拾取時播放 `sfx_buff_pickup`，依 Buff 類型調整音調。

---

## 🎨 特效與素材治理規範

40. **特效生命週期**：
   - **Active**：正在使用的特效，必須在 `VFX_EFFECT_TABLE` 中有引用。
   - **WIP**：開發中的特效，放在 `vfx_skills/_wip/` 子資料夾。
   - **Archive**：已棄用的特效，移至 `vfx_skills/_archive/` 並在 `_MANIFEST.md` 中記錄棄用原因與日期。

41. **素材審查流程**：
   - 每月執行 `findUnusedBlocks()` 稽核，將未使用積木標記為 WIP 或 Archive。
   - PR 新增特效時，必須同步更新 `vfx-usage-table.ts` 和對應 Bundle 的 README。

42. **跨專案共用原則**：
   - `vfx_core` 中的積木應保持風格中性，可跨專案共用。
   - 三國特化的視覺元素（如武將頭像、兵種圖示）應放在 `vfx_skills` 或 `ui` Bundle。

---

## 🔤 字型治理規範

43. **字型 Bundle 分離**：
   - 所有字型檔案統一放在 `assets/bundles/ui/fonts/`。
   - BMFont 用於動態飄字（傷害數字、Buff 數值），TTF 用於靜態 UI 文字。

44. **BMFont 命名規範**：
   - `bmfont_{用途}_{顏色}.fnt`（如 `bmfont_damage_red.fnt`、`bmfont_heal_green.fnt`）。
   - 每個 BMFont 必須包含 `.fnt` + `.png` 兩個檔案，並在 `fonts/README.md` 中登錄。

45. **多語系字型**：
   - 中文使用 `NotoSansCJK-Regular.ttf`（涵蓋繁中/簡中/日文/韓文）。
   - 英文使用 `Roboto-Regular.ttf`。
   - 數字使用 `bmfont_numbers.fnt`（性能優化）。

---

## 🌐 多國語系架構

46. **i18n 資料結構**：
   - 語系檔統一放在 `assets/resources/i18n/{locale}.json`（如 `zh-TW.json`、`en-US.json`）。
   - 使用巢狀 key 結構：`{ "ui": { "battle": { "deploy": "部署" } } }`。

47. **語系切換機制**：
   - 透過 `I18nService.setLocale(locale)` 切換語系，自動重新載入所有 UI 文字。
   - 當前語系儲存在 `localStorage`，下次啟動時自動套用。

48. **動態文字替換**：
   - UI Label 使用 `I18nLabel` Component，自動監聽語系變更並更新文字。
   - 程式碼中使用 `services().i18n.t('ui.battle.deploy')` 取得翻譯文字。

49. **數字與日期格式化**：
   - 數字使用 `Intl.NumberFormat` 依語系格式化（如 `1,234` vs `1.234`）。
   - 日期使用 `Intl.DateTimeFormat` 依語系格式化。

---

## 💬 動態飄字系統

50. **飄字類型**：
   - **傷害飄字**：紅色，向上飄動並放大後淡出，使用 `bmfont_damage_red.fnt`。
   - **治療飄字**：綠色，向上飄動並閃爍，使用 `bmfont_heal_green.fnt`。
   - **Buff 飄字**：金色，向上飄動並帶括號（如 `(+5)`），使用 `bmfont_buff_gold.fnt`。
   - **暴擊飄字**：橘色，放大 1.5 倍並震動，使用 `bmfont_crit_orange.fnt`。

51. **飄字物件池**：
   - 使用 `PoolSystem` 管理飄字節點，預熱 20 個節點。
   - 飄字動畫結束後自動回收到物件池。

52. **飄字佇列**：
   - 同一單位同時觸發多個飄字時，使用佇列機制依序播放，間隔 0.2 秒。
   - 避免飄字重疊造成資訊混亂。

53. **3D 世界座標轉換**：
   - 飄字位置使用 `Camera.convertToUINode()` 將 3D 單位頭頂座標轉換為 UI 座標。
   - 每幀更新飄字位置，跟隨單位移動（若單位在飄字期間移動）。

---

## 🎨 材質/Shader 管理規範

54. **材質命名規範**：
   - `mat_{用途}_{描述}.mtl`（如 `mat_unit_default.mtl`、`mat_tile_highlight.mtl`）。
   - 所有材質統一放在 `assets/resources/materials/`。

55. **Shader 版本管理**：
   - 自訂 Shader 統一放在 `assets/resources/effects/`。
   - 每個 Shader 必須在檔案開頭註明：作者、建立日期、用途、依賴的 Uniform 參數。

56. **材質安全 API**：
   - 統一使用 `MaterialUtils.setMaterialSafe(mr, material, index)` 設定材質，避免使用已棄用的 `mr.setMaterial(material, index)`。
   - 詳見「引擎 API 注意事項」章節。

57. **GPU Instancing**：
   - 相同材質的多個單位應啟用 GPU Instancing 優化渲染性能。
   - 使用 `MaterialUtils.enableInstancing(material)` 統一管理。

---

## 🧪 UnitTest 框架規範

58. **測試框架選擇**：
   - 使用 `mocha` + `chai` 作為測試框架。
   - 測試檔案統一放在 `assets/scripts/tests/`，命名為 `*.test.ts`。

59. **測試覆蓋目標**：
   - **P0**：BattleFormula（傷害計算、屬性克制）、DuelSystem（單挑判定）、TileBuff（Buff 計算）。
   - **P1**：BuffSystem（狀態效果）、GeneralSystem（武將技能）、EventSystem（事件分發）。
   - **P2**：UI 互動邏輯、動畫播放邏輯。

60. **測試撰寫規範**：
   - 每個測試檔案對應一個被測試的類別或模組。
   - 使用 `describe` 描述測試套件，`it` 描述測試案例。
   - 測試案例應涵蓋：正常情況、邊界條件、異常情況。

61. **Mock 與 Stub**：
   - 使用 `sinon` 進行 Mock 與 Stub。
   - 測試純邏輯時，Mock 掉 Cocos Creator 引擎依賴（如 `Node`、`Component`）。

62. **CI 整合**：
   - 在 GitHub Actions 中配置自動測試流程，PR 合併前必須通過所有測試。
   - 測試覆蓋率目標：核心邏輯 ≥80%，UI 邏輯 ≥50%。


---

## 🎨 Curve 系統（可視化數值曲線）

63. **Curve 系統用途**：
   - 技能傷害衰減曲線（如火球術距離越遠傷害越低）
   - Buff 強度曲線（如中毒每回合傷害遞增）
   - 單位移動速度曲線（加速→勻速→減速）
   - 所有需要「非線性數值變化」的場景

64. **CurveAsset 資料結構**：
   - 使用 Cocos Creator 內建的 `CurveRange` 類型
   - 設計師可在編輯器中視覺化編輯曲線
   - 程式碼只需呼叫 `curve.evaluate(time, ratio)` 取值

65. **CurveGroup 管理器**：
   - 將多條曲線組織在一起，方便批量管理和查詢
   - 例如：一個技能可能有「傷害曲線」、「範圍曲線」、「冷卻曲線」三條
   - 使用 `getCurve(name)` 根據名稱查詢曲線

66. **整合到 ActionSystem**：
   - 在 `ActionSystem` 中新增 `registerSkillCurves(skillId, curveGroup)` 方法
   - 技能傷害計算時使用曲線評估：`calculateSkillDamage(skillId, distance, baseDamage)`

67. **整合到 BuffSystem**：
   - 在 `BuffSystem` 中新增 `registerBuffCurves(buffType, curveGroup)` 方法
   - Buff 數值計算時使用曲線評估：`calculateBuffValue(buffType, turn, baseValue)`

---

## 🔍 新版 CocosCyberpunk 能力評估

68. **新版差異重點**：
   - 相較先前參考版本，新版 `CocosCyberpunk` 額外確認有 `extensions/pipeline/` 自訂渲染管線、`assets/LightFX/` 光影烘焙輸出、`fx_born` / `fx_dead` / `hit` 三組新特效模組，以及 `assets/src/utils/disable-update-ubo.ts`、`switch-probe.ts` 等效能/反射探針輔助腳本。

69. **Curve 系統**：
   - `core/curve/` 已確認仍是值得導入的高價值模組，適合本專案的技能數值衰減、Buff 強度、移動節奏等非線性參數場景。
   - 視為 **應納入優化** 的項目，優先級維持 P1。

70. **Msg.bind / Logger / Notify / JSON Tool**：
   - `core/msg/msg.ts` 的 `bind()`、`core/io/log.ts`、`core/io/notify.ts`、`core/io/json-tool.ts` 屬於工程便利層。
   - 本專案已有 `EventSystem`、`ServiceLoader` 與資料驅動配置基礎，不應為了對齊 Cyberpunk 而整包搬入。
   - 原則為 **擇優吸收概念，不直接照搬 API**；若未來發現事件綁定、診斷日誌或 JSON 驗證有痛點，再局部增補。

71. **SoundActorMain 音效節點生命週期**：
   - 新版 Cyberpunk 的 `SoundActorMain` 可作為 AudioSystem 進一步細化節點生命週期的參考，但目前本專案的 AudioSystem 已完成動態音軌混合，沒有立即重構必要。
   - 視為 **可選優化**，僅在後續出現音效節點殘留、場景切換釋放不完整時再排入。

72. **Exit Pointer Lock / Touch Cancel / Editor 工具**：
   - `exit-pointer-lock.ts` 偏向 FPS/滑鼠鎖定場景，不適用本專案的手機友善點擊戰鬥流程。
   - `touch-cancel.ts` 可作為未來進階觸控防呆參考，但不是當前核心需求。
   - `core/editor/editor-calculate-nodes.ts` 屬編輯器輔助工具，可參考思路，不列入近期優化清單。

73. **自訂渲染管線（Pipeline）**：
   - 新版 `extensions/pipeline/` 已直接提供 Bloom、FXAA、FSR、TAA 等長期優化的實作來源，屬於本次分析最有價值的新情報。
   - 這些能力對應本專案的 L-1、L-3、L-5，應視為後續長期項目的主要技術樣板，而非立即搬入。

74. **新版素材狀態**：
   - 已匯入本專案的 8 張 Cyberpunk 來源 PNG 與新版內容比對後完全一致，現有 S-6 產物不需重做。
   - 新增的 `fx_born` / `fx_dead` / `hit` 可列為第二批素材候選，但不影響目前已完成功能。

---

## 📝 技術決策記錄

### [2026-03-19] 新版 CocosCyberpunk 二次比對結論
- **分析結果**：新版相對舊版的真正增量不在已匯入的 8 張貼圖，而在自訂渲染管線、LightFX 光影輸出與少量工程輔助腳本。
- **需要納入的方向**：`core/curve/`（P1）與 `extensions/pipeline/` 對應的 Bloom / FXAA / FSR / TAA 研究資料。
- **不需立即搬入的內容**：`Msg.bind()`、`SoundActorMain`、`json-tool.ts`、`log.ts`、`notify.ts`、`exit-pointer-lock.ts`、`touch-cancel.ts`，維持「有痛點再局部吸收」原則。
- **既有功能影響**：目前已完成的 S-1~S-6、M-1~M-7 均無須因新版 Cyberpunk 而回頭修改。

### [2026-03-19] 引入 Curve 系統
- **來源**：CocosCyberpunk 專案的 `core/curve/` 模組
- **原因**：讓設計師可視覺化調整技能傷害衰減、Buff 強度變化等非線性數值
- **決策**：引入 `CurveAsset` 和 `CurveGroup`，整合到 `ActionSystem` 和 `BuffSystem`
- **預估工時**：3 天
- **優先級**：P1

### [2026-03-19] CocosCyberpunk 專案分析完成
- **分析結果**：三國 Demo 的架構已全面優於 CocosCyberpunk
- **值得引入的特性**：Curve 系統（P1）、Logger 工具（P2）
- **已實作且更優的部分**：EventSystem.onBind()、PoolSystem、ResourceManager、ServiceLoader DI 容器
- **詳見**：`docs/可優化說明書2.md` 第 13 章

### [2026-03-06] 初始化專案文檔架構
- 建立 `.github/copilot-instructions.md` 作為 AI 助手的工作空間指引
- 建立 `docs/keep.md` 作為技術共識與決策記錄
- 確立「執行前置檢查」規範，AI 須優先讀取本文件

### [2026-03-06] 確立第一階段 Demo 與 AI 協作方向
- 目標平台確立為 `Web / Android / iOS`
- 第一階段 Demo 確立為 **2.5D 俯視角、雙方對推式格子 PVE 戰鬥**
- 戰場採 **5 路 x 8 格深度** 小棋盤
- Demo 共有兩種主玩法：`A. 遭遇戰`、`B. 推進模式`
- 玩家操作採 **大按鈕 UI + 滑鼠 / 觸控點選目標**
- 我方武將固定於左下角，並預留未來玩家輔助角色站位空間
- 遭遇敵將時，敵將固定出現在棋盤右上方並面向我方
- 正式視覺方向優先採 **2D / Spine**，雛型階段優先使用內建 placeholder 資源
- 短期內不接真實第三方 SDK，僅保留平台抽象層
- 專案架構以 **資料驅動、模組解耦、適合 AI / vibe coding 持續擴充** 為原則
- 詳細玩法規格統一維護於 `docs/demo_playbook.md`

### [2026-03-06] 建立 Editor 工具中樞與 Sprite 自動化管線
- 選定 **Node.js** 作為專案工具鏈標準（優先整合 Cocos Creator Editor Extension）
- 建立 `extensions/studio-tools-hub`，統一管理後續 AI 工具並掛載於上方選單
- 建立 `tools/sprite-pipeline` 自動化流程：綠幕去背、連通區切幀、底部錨點對齊、防抖輸出
- 工具輸出同時覆寫到 `assets/resources/sprites/`，以利 Cocos 直接載入與預覽

### [2026-03-08] 確立 MVC + Service 混合架構
- 採用 **MVC + Service 混合架構**，戰鬥模組使用 MVC、橫切關注使用 Service
- **ServiceLoader** 作為輕量 DI 容器，僅負責建立與注入依賴，不啟動遊戲邏輯
- **BattleSystem** 為回合狀態機，階段切換時透過 EventSystem 發送通知
- **FormulaSystem** 集中所有傷害 / 治療 / 互剋計算，避免公式散落
- **ResourceManager** 具備路徑快取，避免重複載入
- Model 層為純 TypeScript 類別（TroopUnit、GeneralUnit、BattleState），不依賴 Cocos 節點
- 技術架構文件獨立於 `docs/demo_技術架構.md`，玩法規格留在 `docs/demo_playbook.md`

### [2026-03-08] 架構審查與修正
- **BattleState.getCell()** 改為 O(1) 索引直算（原為 Array.find O(n)）
- **ServiceLoader.initialize()** 移除自動 beginBattle()，戰鬥啟動由 Controller 負責
- **BattleSystem** 新增 EventSystem 注入，階段變化時自動發送 `TurnPhaseChanged` 事件
- **GameManager** 新增 EventSystem 注入，模式切換時發送 `GameModeChanged` 事件
- **TroopUnit** 移除冗餘 `terrain` 欄位，地形資訊統一從 BattleState.GridCell 取得
- 新增 **GeneralUnit** 資料模型（武將 HP、攻擊加成、擅長地形）
- 新增 `UnitDeployed` / `GameModeChanged` 事件名稱

---

## 🛠 開發環境

- **引擎**: Cocos Creator 3.8.8
- **平台**: Web / Android / iOS
- **狀態**: 環境建置完成，已導出類型定義並配置 `tsconfig.json`

---

## 🤝 已達成共識

- [x] **語言**: 繁體中文互動與代碼註釋
- [x] **編輯器工作流**: 以 Cocos Creator 編輯器開發為主
- [x] **平台目標**: Web / Android / iOS
- [x] **Demo 玩法**: 2.5D 俯視角、5 路 x 8 格雙入口對推式 PVE Demo
- [x] **操作方式**: 大按鈕 UI + 滑鼠 / 觸控點選目標
- [x] **視覺策略**: 正式方向為 2D / Spine，雛型使用內建 placeholder
- [x] **主將構圖**: 我方主將位於左下角並保留未來玩家輔助角色空間
- [x] **第三方整合策略**: 短期僅保留抽象層，不接真實 SDK
- [x] **架構原則**: 資料驅動、模組解耦、利於 AI / vibe coding 穩定協作
- [x] **工具管理策略**: 採用 Cocos Editor 上方選單的工具中樞（`extensions/studio-tools-hub`）
- [x] **素材處理策略**: 採 Node.js `sprite-pipeline` 進行可量產的自動切幀與防抖對齊
- [x] **程式架構**: 採 MVC + Service 混合架構，ServiceLoader 為輕量 DI 容器
- [x] **文件分離**: 玩法規格在 `demo_playbook.md`，技術架構在 `demo_技術架構.md`

---

## 🔄 維護規範

1. **新增決策時機**:
   - 架構層級變更
   - 引入新的開發工具或框架
   - 確立命名規範或資料夾結構
   - Demo 主玩法規格或視覺方向調整
   - 解決重要技術問題後的經驗記錄

2. **更新方式**:
   - 在「技術決策記錄」區塊新增條目（含日期）
   - 若有過時內容，註記 `[已廢棄]` 並說明替代方案
   - 玩法層級調整需同步更新 `docs/demo_playbook.md`

3. **AI 助手職責**:
   - 每次對話開始時摘要本文件內容
   - 執行玩法或架構相關任務前，同步參考 `docs/demo_playbook.md`
   - 達成新技術決策時提醒用戶更新本文件
   - 遵循本文件記錄的所有準則與約定
4. **專案文檔**: 重要的技術決策、架構設計和開發規範需記錄於 `demo_技術架構.md`，並定期更新以反映最新共識。
5. **Demo 規格維護**: 詳細的玩法規格統一維護於 `demo_playbook.md`，確保所有開發人員對核心玩法有一致理解。

### [2026-03-31] 中文編碼防災規範補強（repo-wide）
- 專案文字檔正式以 `.editorconfig`、`.gitattributes`、`.vscode/settings.json` 統一規範為 UTF-8 + LF；適用副檔名至少包含 `.ts`、`.js`、`.json`、`.md`、`.ps1`。
- `tools_node/check-encoding-integrity.js` 的預設掃描範圍已提升為「git 追蹤中的專案文字檔」，不再只掃少數高風險檔；因此 `docs/*.md`、JSON 契約與一般 TypeScript 檔案都必須納入編碼驗收。
- repo-wide 掃描會排除 vendored / 第三方型別來源（例如 `@cocos/creator-types/`），也不應把工作樹中已不存在的舊追蹤路徑視為專案錯誤。
- `npm run check:acceptance` 與 git `pre-commit` 的編碼檢查，至少要能攔截：`U+FFFD` replacement character、非預期 BOM、可疑 mojibake 特徵、高風險檔非 ASCII 基線異常漂移。

### [2026-03-31] 中文檔回救與寫檔流程
- 中文檔案的「UTF-8 格式正確」不等於「中文字內容正確」；若先經過錯誤碼頁解碼再寫回，就算最後仍是 UTF-8 檔案，內容也可能已經變成亂碼。
- 回救中文檔時，禁止使用會經過主控台碼頁或 PowerShell 字串轉碼的流程，例如：
  - `Set-Content`
  - `Out-File`
  - `git show ... | Out-String | WriteAllText(...)`
- 回救 / 覆寫中文檔時，必須使用二進位安全或明確指定 UTF-8 的流程，例如：
  - `apply_patch`
  - `cmd /c "git show HEAD:path\\to\\file > path\\to\\file"`
  - 明確指定 UTF-8（無 BOM）的檔案 API
- 本次 `docs/keep.md` 的事故已證明：若用 PowerShell / 主控台字串流程搬運 git blob，即使來源內容正確，也可能在工作樹再次被 `cp950` 類碼頁污染。

### [2026-03-31] 高風險中文檔協作規範
- 高風險中文檔（例如大量中文 template string、中文 log、長段註解檔）必須採單寫者規則；同一時間只允許一位 Agent / 開發者修改。
- 編輯高風險中文檔前，必須先執行 `npm run prepare:high-risk-edit -- <file>`，建立 SHA256 與 `local/encoding-backups/` 備份。
- commit message 正式採用 `[bug|feat|chore] 任務卡號 功能描述 [AgentX]`；git commit 是災難回救保底，但不能取代 pre-commit 編碼檢查。

### [2026-03-31] 代碼檔 400 行硬規則
- 任一代碼檔只要超過 400 行，就必須列為強制重構與拆分對象。
- 這不是「有空再整理」的軟建議，而是正式工程規則；後續新功能不得持續堆疊在已超標的大檔中。
- 若當輪任務無法完成拆分，至少必須同時做到：
  - 開正式任務卡或在既有任務卡明確記錄拆分責任
  - 在 notes / 規格文件中留下拆分計畫
  - 避免再把額外責任塞進同一檔案
- 對照 Unity，這條規則等同於禁止長期維護超肥大的 `MonoBehaviour`；節點建立、版面、樣式、診斷、文案、資料轉換應逐步拆成獨立模組。
