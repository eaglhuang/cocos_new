<!-- doc_id: doc_tech_0015 -->
# Demo 技術架構

> 第一階段 Demo 的程式架構、模組分工、資料流與技術決策。  
> 玩法規格請參考 `docs/demo_playbook.md (doc_spec_0161)` (doc_spec_0161)。

**最後更新**: 2026-03-30

---

## 1. 架構總覽

採用 **MVC + Service 混合架構**：
- **MVC** 負責戰鬥模組與 UI 模組的互動分層
- **Service** 負責可共用的運算、資源、事件、物件池等橫切關注點
- **ServiceLoader** 作為輕量 DI 容器，統一初始化與查找所有核心系統

```
ServiceLoader（進入點）
 ├── EventSystem      ← 模組通知
 ├── FormulaSystem    ← 傷害 / 治療運算
 ├── PoolSystem       ← 物件池
 ├── ResourceManager  ← 資源載入與快取
 ├── EffectSystem     ← 視覺特效（骨架）
 ├── BuffSystem       ← 狀態效果管理
 ├── BattleSystem     ← 回合階段狀態機
 ├── GameManager      ← 全域模式管理
 └── UIManager        ← UI 層級堆疊

BattleController（遭遇戰主控）
 ├── BattleState      ← 棋盤 + 單位資料 (Model)
 ├── BattleSystem     ← 回合推進 (Service)
 ├── FormulaSystem    ← 傷害計算 (Service)
 ├── BuffSystem       ← 暈眩等狀態效果 (Service)
 ├── EnemyAI          ← 敵方 AI 部署策略
 └── BattleScene      ← 場景入口 + UI 連結 (View)
```

---

## 2. 架構分層原則

| 層級 | 職責 | 規則 |
|------|------|------|
| **Model** | 純資料與狀態 | 不依賴 Cocos 節點、不引用 Service |
| **View** | 顯示、動畫、輸入回傳 | 只讀取 Model，透過回呼或事件通知 Controller |
| **Controller** | 銜接 UI 行為與戰鬥流程 | 驅動 Service 與 Model，不直接操作節點細節 |
| **Service** | 橫切運算與工具 | 無狀態或自管狀態，不依賴特定 Controller |

### 關鍵約束
- 戰鬥核心狀態由 `BattleState` 持有，不由 Node 或 Component 持有
- UI 狀態切換由 `UIManager` + `UILayer` 控制，面板之間不直接互相開關
- 核心戰鬥流程由 `BattleSystem` 明確驅動，事件系統只做通知、不替代主流程狀態機
- View 不直存規則常數，所有戰鬥數值從 Service 或配置取得

---

## 3. 目錄結構與檔案說明

```
assets/scripts/
├── core/
│   ├── config/
│   │   └── Constants.ts         ← 列舉、常數、互剋表、地形修正、事件名稱
│   ├── managers/
│   │   ├── ServiceLoader.ts     ← 系統初始化 & DI 容器
│   │   ├── GameManager.ts       ← 全域模式管理 (None / Encounter / Advance)
│   │   └── UIManager.ts         ← UI Layer 堆疊管理
│   ├── systems/
│   │   ├── EventSystem.ts       ← 泛用 pub/sub 事件匯流排
│   │   ├── FormulaSystem.ts     ← 集中傷害 / 治療 / 互剋公式
│   │   ├── PoolSystem.ts        ← NodePool 物件池封裝
│   │   ├── ResourceManager.ts   ← resources 目錄載入 & 快取
│   │   ├── EffectSystem.ts      ← 傷害飄字 / 受擊特效（骨架）
│   │   ├── BuffSystem.ts        ← 狀態效果管理（暈眩等）
│   │   └── BattleSystem.ts      ← 回合階段狀態機 & 戰場部署資源 / 冷卻管理
│   └── models/
│       ├── TroopUnit.ts         ← 兵種單位資料模型（含移動力、攻擊距離、盾牆狀態）
│       └── GeneralUnit.ts       ← 武將資料模型（含 SP 能量系統、技能 ID）
│
├── battle/
│   ├── controllers/
│   │   ├── BattleController.ts  ← 遭遇戰主控：部署 / 移動 / 戰鬥 / 特殊 / 技能 / 勝敗
│   │   └── EnemyAI.ts           ← 敵方 AI：互剋策略 + 隨機路線部署
│   ├── models/
│   │   └── BattleState.ts       ← 棋盤格子 + 單位索引 + 將軍與城防 HP
│   └── views/
│       ├── BattleScene.ts       ← 場景入口元件：初始化、載入遭遇戰、連結 UI、多相機配置
│       ├── SceneBackground.ts   ← 背景底圖管理：獨立 BGCamera + 背景 Quad
│       ├── BoardRenderer.ts     ← 3D 棋盤格、地板閃光、部署提示、Tile Buff 視覺化
│       ├── UnitRenderer.ts      ← 單位/武將視圖、數值飄字、SP 吸取、Buff 特效入口
│       └── effects/
│           └── BuffGainEffectPool.ts ← Buff 特效物件池（ATK± / HP± 共用類別）
│
├── ui/
│   ├── layers/
│   │   └── UILayer.ts           ← UI 層級基底 Component (show/hide 淡入淡出)
│   └── components/
│       ├── BattleHUD.ts         ← 抬頭顯示器：回合/糧草/SP/堡壘/狀態
│       ├── DeployPanel.ts       ← 部署面板：兵種選擇 + 路線部署 + 技能 + 結束回合 + 糧草 / 冷卻 Toast 提示
│       ├── BattleLogPanel.ts    ← 戰鬥紀錄小面板：顯示近期事件（部署/移動/陣亡/回合）
│       ├── ToastMessage.ts      ← 輕量提示元件：短訊息自動消失
│       └── ResultPopup.ts       ← 結果彈窗：勝/負/平 + 再來一場
│
├── tools/
│   ├── SceneAutoBuilder.ts      ← 運行時場景生成器（已被編輯器擴展取代）
│   └── SpriteAutoPreview.ts     ← 精靈幀自動預覽播放
│
└── utils/                       ← (待實作) 通用工具函式

assets/resources/data/
├── troops.json                  ← 兵種數值表（HP/攻擊/防禦/移動力/攻擊距離）
├── generals.json                ← 武將數值表（HP/SP/技能/攻擊加成/地形偏好）
└── encounters.json              ← 遭遇戰關卡定義（地形配置、雙方武將、初始敵軍）

assets/resources/effects/
├── board-jelly.effect           ← 棋盤玻璃感地板 Shader
└── vfx-buff-quad.effect         ← Buff Quad 特效 Shader（透明 / 加亮 / 外光）

extensions/
├── battle-scene-builder/        ← 編輯器擴展：一鍵生成戰鬥場景節點樹
│   ├── main.ts                  ← Editor Main Process（選單轉發）
│   ├── scene-script.ts          ← Scene Renderer Process（cc API 節點建立）
│   ├── package.json             ← 擴展設定（package_version: 2）
│   └── dist/                    ← 編譯輸出
└── studio-tools-hub/            ← 編輯器擴展：精靈管線工具
    ├── main.js                  ← 精靈處理腳本執行器
    └── package.json             ← 擴展設定

tools/sprite-pipeline/
├── process-spritesheet.js       ← 角色圖集拆幀與去背流程
├── process-effect-textures.js   ← 特效貼圖黑底轉 alpha 的前處理腳本
└── config/
  ├── default.config.json      ← 拆幀流程預設參數
  └── effect-textures.config.json ← 特效貼圖轉透明參數與輸出清單
```

---

## 4. 核心系統說明

### 4.1 ServiceLoader
- 單例模式，透過 `services()` 全域函式取得
- 職責：建立並持有所有 Service 實例
- **不應**在 `initialize()` 中啟動遊戲邏輯（如 beginBattle），僅做服務間依賴注入
- 擴充方式：新增 Service 時加一個 `public readonly` 欄位即可

### 4.2 BattleSystem（回合狀態機）
- 管理 5 個階段循環：`PlayerDeploy → AutoMove → BattleResolve → SpecialResolve → TurnEnd`
- 管理戰場部署資源（糧草）、兵種冷卻與普通小兵降級產出的相關狀態
- `nextTurn()` 推進回合計數、重置回合型冷卻或階段狀態，並回到 `PlayerDeploy`（由 BattleController 呼叫）
- `advancePhase()` 逐階段推進（保留接口，目前未使用）
- 階段變化時透過 EventSystem 發送 `TurnPhaseChanged` 通知

### 4.3 BuffSystem（狀態效果）
- 以 unitId 為 key 管理所有單位的狀態效果列表
- `applyBuff()` 施加（同效果取較長持續時間，不疊加）
- `hasBuff()` 查詢、`tickBuff()` 每回合倒計時、`clearUnit()` 陣亡清除
- 目前支援：暈眩 (Stun) — 跳過移動與攻擊、解除盾牆

### 4.3 FormulaSystem（公式中樞）
- 傷害公式：`max(1, floor(攻擊 × 互剋係數 × 地形攻擊修正 × 武將加成 - 防禦 × 地形防禦修正))`
- 治療公式：`max(固定值, 目標最大 HP × 治療比例)`
- 互剋倍率：剋制 1.3 / 被剋 0.7 / 無關 1.0
- 所有數值計算集中於此，不散落在 Controller 或 View

### 4.4 EventSystem（事件匯流排）
- 泛用 pub/sub：`on()` 註冊、`off()` 解除、`emit()` 廣播
- 用於通知型解耦（如 unit-died、turn-phase-changed）
- **不用於**驅動主戰鬥流程的狀態推進

### 4.5 PoolSystem（物件池）
- 封裝 Cocos `NodePool`，以字串 key 管理多組池
- `register()` 預熱、`acquire()` 取出、`release()` 回收
- 主要用於傷害飄字、受擊特效等高頻建立/銷毀的節點

### 4.6 ResourceManager（資源載入）
- 封裝 `cc.resources.load` / `loadDir` 的 Promise 介面
- 支援 JSON 配置、Prefab、SpriteFrame 目錄載入
- 內建快取機制，避免重複請求相同路徑

### 4.7 EffectSystem（視覺特效）
- 目前為骨架，提供 `showDamageText()` 與 `recycleEffect()` 呼叫入口
- `showDamageText()` 尚未實作，保留 Prefab + Tween + PoolSystem 回收的擴充接口
- 已透過 `setup(poolSystem)` 注入 PoolSystem 依賴

### 4.8 Battle 視覺層（Board / Unit / Background）
- `BattleScene` 採用三層渲染概念：背景、3D 棋盤/單位、UI
- `SceneBackground` 以獨立 `BGCamera(priority=-1)` + `BACKGROUND_LAYER` 顯示底圖
- `Main Camera` 專責 `DEFAULT` layer，`Canvas` 內 UI Camera 使用 `DEPTH_ONLY`，避免把背景清掉
- 背景 Quad 與 Buff 特效 Quad 均關閉背面裁切，避免 2.5D 視角下因面向翻轉而不可見

### 4.9 Buff 特效流程（ATK± / HP±）
- Tile Buff 被踩到時，由 `BattleController.tryConsumeTileBuff()` 計算 `attackDelta` / `hpDelta`
- `BattleScene.onTileBuffConsumed()` 同步驅動：棋盤 burst、數值文字、Buff 特效 Pool
- `UnitRenderer.playBuffEffect()` 依數值正負分派到 4 組 Pool：`AtkGain / AtkLoss / HpGain / HpLoss`
- `BuffGainEffectPool` 使用單一 Quad + Tween 漂浮/縮放動畫，底層材質改為自訂 `vfx-buff-quad.effect`
- 特效貼圖採前處理輸出 `_alpha` 版本，避免執行期 shader 匯入失敗拖累整個場景

### 4.10 VFX Shader Effect 範本（本專案 Buff Quad 專用）
- 實作檔案：`assets/resources/effects/vfx-buff-quad.effect`
- 用途：統一 Quad 類 VFX 的材質行為，避免 `builtin-unlit` + runtime state override 分散在程式碼中。
- 核心策略：同一份 Effect 提供 3 種 technique，交由 `BuffGainEffectPool` 依圖層選用。

#### 4.10.1 Technique 分工
- `transparent`：主符號、法陣、箭頭本體。使用標準 alpha blend，保留貼圖解析細節與邊緣輪廓。
- `additive`：火花粒子。使用 `src_alpha + one` 疊色，做亮點與能量粒子。
- `outer-glow`：外光層。仍採 additive，但搭配較低 alpha 與較寬鬆的 alpha softening，只負責柔光，不負責符號本體。

#### 4.10.2 Effect 範本
```glsl
CCEffect %{
  techniques:
  - name: transparent
    passes:
    - vert: vfx-buff-vs:vert
      frag: vfx-buff-fs:frag
      depthStencilState:
        depthTest: false
        depthWrite: false
      blendState:
        targets:
        - blend: true
          blendSrc: src_alpha
          blendDst: one_minus_src_alpha
      rasterizerState:
        cullMode: none
      properties: &sharedProps
        mainTexture: { value: white }
        mainColor: { value: [1, 1, 1, 1], editor: { type: color } }
        uvTransform: { value: [1, 1, 0, 0] }
        effectParams: { value: [0.0, 0.04, 1.0, 1.0] }

  - name: additive
    passes:
    - vert: vfx-buff-vs:vert
      frag: vfx-buff-fs:frag
      depthStencilState:
        depthTest: false
        depthWrite: false
      blendState:
        targets:
        - blend: true
          blendSrc: src_alpha
          blendDst: one
      rasterizerState:
        cullMode: none
      properties:
        mainTexture: { value: white }
        mainColor: { value: [1, 1, 1, 0.45], editor: { type: color } }
        uvTransform: { value: [1, 1, 0, 0] }
        effectParams: { value: [0.0, 0.08, 1.12, 0.82] }

  - name: outer-glow
    passes:
    - vert: vfx-buff-vs:vert
      frag: vfx-buff-fs:frag
      depthStencilState:
        depthTest: false
        depthWrite: false
      blendState:
        targets:
        - blend: true
          blendSrc: src_alpha
          blendDst: one
      rasterizerState:
        cullMode: none
      properties:
        mainTexture: { value: white }
        mainColor: { value: [1, 1, 1, 0.32], editor: { type: color } }
        uvTransform: { value: [1, 1, 0, 0] }
        effectParams: { value: [0.02, 0.22, 0.92, 0.55] }
}%
```

#### 4.10.3 統一 Uniform 規約
- `mainTexture`：VFX 貼圖本體。
- `mainColor`：色相與整體 alpha 控制。
- `uvTransform`：保留給 UV 平移/縮放，現階段固定 `[1,1,0,0]`。
- `effectParams`：`[alphaCutoff, alphaSoftness, colorBoost, alphaBoost]`。

#### 4.10.4 腳本側使用方式
```ts
const material = new Material();
material.initialize({
  effectAsset: vfxEffectAsset,
  technique: 0,
});
material.setProperty('mainTexture', texture);
material.setProperty('mainColor', color);
material.setProperty('uvTransform', new Vec4(1, 1, 0, 0));
material.setProperty('effectParams', new Vec4(0.0, 0.04, 1.0, 1.0));
```

#### 4.10.5 本專案實務規則
- 符號「清晰度」優先交給 `transparent` technique，本體不可依賴 additive 發亮來撐清晰度。
- 外光只可輔助輪廓與氣氛，不可把主符號洗白。
- 如果 VFX 解析度不足，應優先升級來源圖到 `256x256` 或 `512x512`，不是把 glow 開更大。
- Quad VFX 一律 `depthTest=false`、`depthWrite=false`、`cullMode=none`，避免被棋盤與單位遮蔽。

---

## 棄用 API 管理原則（Project-wide Deprecation Policy）

為避免專案在不同檔案或自動產生的程式碼中反覆散布已棄用的引擎簽章，本專案採用以下統一策略：

- **發現即記錄**：任何發現的 deprecated API 都要在 `keep.md` (doc_index_0011) 中記錄來源、影響範圍與建議替代方案，並同步在此文件中加入說明。
- **Wrapper-first（先包裝再替換）**：在 `assets/scripts/core/utils/` 建立 wrapper 函式（例：`MaterialUtils.setMaterialSafe`），wrapper 負責兼容不同引擎簽章與提供 fallback，所有程式碼應改為呼叫 wrapper 而非直接呼叫被標記為 deprecated 的 API。
- **AI / 自動化產生碼規範**：自動產生的程式碼（包含 AI 生成）不得使用 `keep.md` (doc_index_0011) 中列為棄用的直接呼叫。自動化工具應改為呼叫對應的 wrapper。
- **漸進替換流程**：採取小步驟替換策略（搜尋 → 建立 wrapper → 批次替換 → PR review → merge），每次替換應附帶測試或手動驗證步驟，並保留回退路徑。
- **文件化與審查**：每個 wrapper 檔案需在檔頭註明被替代的 deprecated API、建立日期、作者與回退建議；PR 必須接受 code review 並在 CI 中加入檢查以阻止直接使用列入棄用清單的簽章。

示例：`assets/scripts/core/utils/MaterialUtils.ts` 已提供 `setMaterialSafe`，並在 `keep.md` (doc_index_0011) 註明該案例為示範。未來若發現其他 deprecated API，請依此流程建立對應 wrapper 並在 `keep.md` (doc_index_0011) 記錄替代方案。

---

## UnitTest 框架（CLI Test Infrastructure）

> **Unity 對照**：相當於 NUnit + ReSharper/SonarQube 的自訂規則，在不開 Unity Editor 情況下的純邏輯 CLI 測試。

### 設計目標

- **零外部依賴**：純 TypeScript，不依賴 Jest / Mocha / Chai，避免 node_modules 污染 Cocos 編譯
- **雙模執行**：同一套測試可在 Node.js CLI（CI / 本機命令列）和 Cocos DevMode 瀏覽器執行
- **靜態掃描整合**：DeprecatedApiScanner 作為一個 TestSuite 加入，棄用 API 問題自動亮紅燈

### 架構圖

```
node tools/run-tests.js
    └─ npx ts-node --project tsconfig.test.json
         └─ assets/scripts/tools/tests/run-cli.ts
              ├─ runner.register(createFormulaSuite())     ← FormulaSystem 邏輯測試
              ├─ runner.register(createBuffSuite())        ← BuffSystem 邏輯測試
              └─ runner.register(createDeprecatedApiSuite(scriptsDir))  ← 靜態掃描
```

### 關鍵類別（TestRunner.ts）

| 類別 / 函式 | Unity 對照 | 說明 |
|------------|-----------|------|
| `TestSuite` | `[TestFixture]` | 一個功能模組的測試集合 |
| `suite.test(name, fn)` | `[Test]` | 新增單一測試，fn 拋例外 = 失敗 |
| `suite.skip(name, fn)` | `[Ignore]` | 跳過測試（不影響總計） |
| `TestRunner.register(suite)` | 加入 Test Assembly | 將 suite 加入執行清單 |
| `runner.runAll()` | Run All Tests | 執行全部，回傳 RunSummary |
| `assert.equals(expected, actual)` | `Assert.AreEqual` | 相等比較 |
| `assert.isTrue(val)` | `Assert.IsTrue` | 真值斷言 |
| `assert.inRange(min, max, val)` | `Assert.That(val, Is.InRange)` | 範圍斷言 |
| `assert.throws(fn)` | `Assert.Throws` | 應拋出例外 |

### DeprecatedApiScanner 掃描機制

```
掃描根目錄（assets/scripts/）
  ↓ 遞迴收集所有 .ts 檔案
  ↓ 對每條 DEPRECATED_RULES 規則：
      ↓ 逐行比對字串 substring（非 regex，降低複雜度）
      ↓ whitelist 豁免（wrapper 本身 + scanner 自身）
      ↓ 有違規 → 報告 file:line + 建議替代 → 測試失敗
```

DEPRECATED_RULES 現有規則：

| Rule ID | pattern | Replacement | Reason |
|---------|---------|-------------|--------|
| `mr.setMaterial(mat,index)` | `.setMaterial(` | `setMaterialSafe(mr, mat, index)` | Cocos 3.8.8 ts(6387) |

### 執行輸出範例

```
════════════════════════════════════════════════════════════
  UnitTest Report
════════════════════════════════════════════════════════════
  📦 FormulaSystem
    ✅ 基本傷害 = max(MIN_DAMAGE, floor(atk - def)) (0ms)
    ✅ 互剋加成：騎兵 vs 步兵 應大於中立傷害 (0ms)
    ...
  📦 BuffSystem
    ✅ applyBuff：一般套用後 hasBuff 回傳 true (0ms)
    ...
  📦 Deprecated API Scanner
    ✅ [mr.setMaterial(mat,index)] 不應直接使用棄用 API (3ms)
    ✅ 掃描目錄含有足量的 .ts 原始碼檔案 (0ms)

════════════════════════════════════════════════════════════
  🟢  ALL PASS: 36 passed, 0 skipped
════════════════════════════════════════════════════════════
```

---


- 管理全域模式切換：None / Encounter / Advance
- 進入遭遇戰時通知 BattleController 初始化
- 進入推進模式時通知推進系統（待實作）

### 4.9 UIManager（UI 層級管理）
- 四層堆疊：Scene / Panel / Popup / Toast
- `push()` 開啟、`pop()` 關閉、`peek()` 查詢最上層
- 阻斷型 Popup 同一時間只允許一個在最上層
- 返回鍵統一由 UIManager 處理（Demo Web 版用 Esc 模擬）

---

## 5. 資料模型

### 5.1 TroopUnit（兵種單位）
- 純 TypeScript 類別，不繼承 Component
- 持有：id、type、faction、maxHp、currentHp、attack、defense、lane、depth
- 進階屬性：`moveRange`（移動力，騎兵 2 格）、`attackRange`（攻擊距離，弓兵 2 格）、`isShieldWallActive`（盾牆狀態）
- 提供：`moveTo()`、`takeDamage()`、`heal()`、`isDead()`
- 數值由 troops.json 驅動，建構時透過 `TroopStats` 介面注入

### 5.2 GeneralUnit（武將）
- 純 TypeScript 類別
- 持有：id、name、faction、hp、SP 能量（maxSp/currentSp）、skillId、attackBonus
- 進階屬性：`preferredTerrain`、`terrainDefenseBonus`
- 提供：`takeDamage()`、`heal()`、`addSp()`、`isDead()`、`canUseSkill()`
- 數值由 generals.json 驅動，建構時透過 `GeneralConfig` 介面注入

### 5.3 BattleState（棋盤狀態）
- 5 × 8 格陣列，每格含 lane、depth、terrain、occupantId
- 使用索引直算 `lane * GRID_DEPTH + depth` 取格，O(1) 效率
- 持有所有 TroopUnit 的 Map，以及雙方將軍 HP、城防 HP
- 提供 `addUnit()` / `removeUnit()` / `getCell()` / `getUnitsInLane()`

---

## 6. 遭遇戰資料流

```
[玩家選擇兵種 → 點擊路線按鈕]
  → DeployPanel.selectLane(lane) → onDeployClick()
    → BattleController.tryDeployTroop(type, lane)
      → 檢查每回合部署上限（MAX_PLAYER_DEPLOY_PER_TURN）
      → BattleSystem.consumeFood(cost) / 檢查兵種冷卻
      → 建立 TroopUnit（從 troops.json 讀取數值）
      → BattleState.addUnit(unit)
      → EventSystem.emit("unit-deployed")
      → BattleScene.onUnitDeployed → 即時更新 HUD 的糧草與 DeployPanel
      → DeployPanel 發出 "playerDeployed" → BattleScene 自動呼叫 advanceTurn()
      → BattleLogPanel 新增一筆部署紀錄
    → 若部署失敗（糧草不足 / 格位被佔用 / 本回合已部署）
      → 若允許降級產出，改派普通小兵並記錄品質為 BASIC
      → DeployPanel 以 Toast 顯示失敗原因

[玩家點擊「結束回合」（本回合選擇不部署）]
  → DeployPanel 發出 "endTurn" 自訂事件
  → BattleScene.onEndTurn()
    → BattleController.advanceTurn()
      → 敵方部署（EnemyAI 互剋策略，每回合最多 1 隻）
      → 自動移動（暈眩跳過、盾兵觸發盾牆）
      → 戰鬥結算（同步收集 → 統一套用 → 移除陣亡 → 發放 SP）
        → FormulaSystem.calculateDamage(context)
      → 特殊行動（醫護治療、工兵破城、敵將自動技能）
      → 勝敗判定

### 4.11 模組化戰場環境（Tile-State Machine）

> **整併來源**：模組化戰場系統開發策略.md (doc_spec_0089)、戰場互動矩陣與養成動力.md (doc_spec_0091)

- 場景（Scene）只作為外殼；真正的玩法差異由格子狀態與任務變數驅動。
- 建議維持統一的 Tile-State 模組：`Normal`、`Hazard`、`Force-Move`、`Stealth`。
- 火燒、水淹、夜襲、落石等特殊戰場，不另做一套新戰鬥框架，而是在同一個 5×8 棋盤上替換：
  - 地表貼圖 / Decal
  - 環境粒子 / VFX
  - Tile 行為（受傷、推移、隱匿）
- 這種設計對應 Unity 中「同一個 Grid + 不同 Tile Metadata / Scriptable Rule Set」的做法，便於在 Cocos 內保持資料驅動與低維護成本。
      → 若 "ongoing"：BuffSystem.tickBuff() → BattleSystem.nextTurn()
      → BattleLogPanel 追加回合推進與移動/陣亡紀錄

[武將技能]
  → DeployPanel.onSkillClick()
    → BattleController.triggerGeneralSkill()
      → dispatchGeneralSkill(skillId)
        → zhang-fei-roar: 全體暈眩 1 回合
        → guan-yu-slash / lu-bu-rampage / cao-cao-tactics: 範圍傷害

[勝敗判定]
  → 敵將 HP ≤ 0 或敵城防 ≤ 0 → 玩家勝利
  → 我將 HP ≤ 0 或超過回合上限 → 玩家失敗
  → EventSystem.emit("battle-ended", result)
  → ResultPopup.showResult() → 「再來一場」→ BattleScene.restartBattle()
```

---

## 7. UI 管理規格

### 7.1 Layer 分類

| 名稱 | 用途 | 行為 |
|------|------|------|
| SceneLayer | 常駐場景 UI（戰場 HUD） | 不阻斷輸入，多個可共存 |
| PanelLayer | 功能面板（部署、詳情） | 不阻斷，可與 Scene 共存 |
| PopupLayer | 彈窗（結算、確認） | 阻斷輸入，同時只允許一個 |
| ToastLayer | 飄字提示 | 不阻斷，自動消失 |

### 7.2 堆疊規則
- 所有 UI 的開啟與關閉均透過 `UIManager`
- PopupLayer 開啟時屏蔽下方所有輸入
- 返回鍵優先關閉最上層 Popup，無 Popup 時嘗試關閉最上層 Panel
- Demo Web 版以 Esc 鍵模擬返回

---

## 8. 資料驅動設計

### 8.1 配置檔案（已建立）
```
assets/resources/data/
├── troops.json       ← 兵種基礎數值表（HP、攻擊、防禦、移動力、攻擊距離）
├── generals.json     ← 武將數值表（HP、SP、技能 ID、攻擊加成、擅長地形）
└── encounters.json   ← 遭遇戰關卡定義（地形配置、雙方武將、初始敵軍）
```

> 注意：`terrain.json` 未獨立建立，地形修正值在 `Constants.ts` 中以 `TERRAIN_ATTACK_MOD` / `TERRAIN_DEFENSE_MOD` 硬編碼。

### 8.2 擴充流程
1. 新增兵種 → 在 `troops.json` 加一筆資料 + `TroopType` 列舉加一個值
2. 新增地形 → 在 `terrain.json` 加修正值 + `TerrainType` 列舉加一個值
3. 新增武將 → 在 `generals.json` 加一筆資料
4. 新增關卡 → 在 `encounters.json` 加一個遭遇定義
5. 不需要修改 FormulaSystem 或 BattleSystem 的流程碼

---

## 9. 設計決策與取捨

### 9.1 為什麼用 ServiceLoader 而非 Cocos 原生 Component？
- 戰鬥邏輯需要單元測試，純 TypeScript 類別比 Component 更容易測試
- Service 之間的依賴關係在 `initialize()` 中明確建立，不依賴場景載入順序
- 未來若需要從 Cocos 搬到其他引擎，純邏輯層無需大改

### 9.2 為什麼 BattleState 用陣列而非 Map？
- 棋盤大小固定（5×8=40 格），陣列索引直算比 Map 快且記憶體更友善
- 視覺渲染也需要按順序遍歷所有格子，陣列更自然

### 9.3 為什麼傷害公式不直接寫在 TroopUnit 裡？
- 傷害涉及攻守雙方 + 地形 + 武將加成，超出單一 Unit 的職責
- 集中在 FormulaSystem 方便全域平衡調整，也避免公式散落

### 9.4 為什麼不做成全事件驅動？
- 主流程用明確呼叫（BattleController.advanceTurn），保持可追蹤性
- 事件只用於通知 View 更新與 UI 響應，不決定流程走向
- 全事件驅動在 Debug 時難以追蹤執行順序，對 AI 協作不友善

### 9.5 編輯器擴展的雙進程架構
- Cocos Creator 的編輯器擴展分為兩個進程：**Editor Main Process**（Electron 主進程）和 **Scene Renderer Process**（場景渲染進程）
- **main.ts** 在 Editor Main Process 執行，**不能** `import 'cc'`，只能操作 `Editor` API
- **scene-script.ts** 在 Scene Renderer Process 執行，**可以** `import 'cc'`，操作場景節點
- 選單事件由 main.ts 接收，透過 `Editor.Message.request('scene', 'execute-scene-script', ...)` 轉發至 scene-script.ts 執行
- 這相當於 Unity 的 `Editor` 與 `EditorWindow` 分開處理 — 編輯器邏輯和場景操作不在同一個上下文

---

## 10. 已知限制與改進方向

| 項目 | 現況 | 改進方向 |
|------|------|----------|
| EffectSystem | 只有呼叫入口，`showDamageText()` 為空 | 接入 Prefab + Tween + PoolSystem |
| BattleView | 以文字棋盤 Debug 佔位 | 棋盤格子與單位的 2.5D 節點渲染 |
| UIManager | 已實作但未被 BattleScene 使用 | 正式版整合 UI 堆疊管理 |
| 遭遇初始敵軍 | encounters.json 有定義但未被程式讀取 | 讀取 `enemyInitialDeployment` 並在開局部署 |
| SceneAutoBuilder | 已被編輯器擴展取代 | 可考慮移除或歸檔 |
| 推進模式 | 僅保留 GameMode 定義 | 待實作 |

---

## 11. 記憶體管理與 GC 優化規範 (防卡頓與崩潰)

手機平台上容易因為資源未釋放導致 OOM（Out Of Memory）崩潰，也容易因為頻繁的 GC（Garbage Collection）導致畫面卡頓。本專案遵守以下規範：

### 11.1 資源釋放 (Cocos Ref Count)
- **載入與快取**：呼叫 `ResourceManager` 載入資源時，內部會呼叫 `asset.addRef()` 以增加參考計數。
- **釋放機制**：在切換場景、離開戰鬥或銷毀 UI 時，必須呼叫 `ResourceManager.releaseAsset(path)` 或 `clearCache()`。該方法會呼叫 `asset.decRef()`，讓 Cocos 引擎能安全地進行底層記憶體釋放。
- 此設計避免了直接呼叫 `assetManager.releaseAsset` 所造成的資源「正在使用中被強制砍掉」的畫面閃爍與破圖問題。

### 11.2 降低每幀 GC 壓力 (防卡頓)
- **避免高頻 `new` 物件**：
  - 不在 `update()` 迴圈內 `new` 陣列、物件或 `Vec3`。盡量使用類別層級的暫存變數。
  - 使用 `PoolSystem` 回收與重用 `Node`（例如傷害飄字、特效），不要頻繁 `instantiate` 與 `destroy`。
- **陣列與集合的重用**：
  - 如果可以，避免在每回合或每幀回傳新陣列。改為傳入暫存陣列（`outArray`）來填充資料，或使用 iterator。
  - `PoolSystem.clear()` 執行時會確保 `NodePool.clear()` 被明確呼叫，真正釋放引擎層的 Node 物件。

---

## 12. 多場景切換架構 (Multi-Scene Transition Architecture)

> **Unity 對照**：等同 Unity 的 A -> Empty Scene C -> B 換場法，目的是利用 C 確保 A 的記憶體在進入 B 之前已全數卸載，避免記憶體峰值觸發 Android / iOS 系統強殺（OOM Kill）或 Web 分頁崩潰。

### 12.1 場景清單

| 場景名稱 | 檔案 | 說明 |
|---------|------|------|
| `LoginScene` | `LoginScene.scene` | 登入 / 語系選擇入口（預留） |
| `LoadingScene` | `LoadingScene.scene` | 中繼卸載場景 C；另支援 UI screen-driven preview hub 模式 |
| `LobbyScene` | `LobbyScene.scene` | 大廳 / 選關選武將（預留） |
| `BattleScene` | `demo.scene` | 戰鬥主場景（已存在） |

場景常數統一定義在 `assets/scripts/core/config/Constants.ts` 的 `SceneName` 列舉中：

```typescript
export enum SceneName {
  Login   = "LoginScene",
  Loading = "LoadingScene",
  Lobby   = "LobbyScene",
  Battle  = "BattleScene",
}
```

### 12.2 換場流程（A → LoadingScene → B）

```
任何場景（A）
  └─ services().scene.switchScene(SceneName.Lobby)
        └─ director.loadScene("LoadingScene")   ← SceneManager 統一攔截
              └─ LoadingScene.start()
                    ├─ assetManager.releaseUnusedAssets()   ← 清除 A 的未引用資源
                    ├─ (Native) garbageCollect()             ← iOS/Android 額外 GC
                    ├─ this._loadedBgFrame.decRef()          ← 釋放 Loading 自身圖片
                    └─ director.preloadScene("Lobby", onProgress, onComplete)
                          └─ director.loadScene("Lobby")    ← 全部清乾淨後才切換
```

> **Web 端特別說明**：瀏覽器（尤其 iOS Safari）單一分頁記憶體上限約 1~1.5 GB，超過後分頁直接被系統重整，無法捕捉。中繼卸載場景是唯一可靠的防崩措施。

### 12.3 SceneManager

- 位置：`assets/scripts/core/managers/SceneManager.ts`
- 掛載：透過 `ServiceLoader` 全域存取（`services().scene`）
- **主要 API**：

| 方法 | 說明 |
|------|------|
| `switchScene(name, data?)` | 換場唯一入口，所有換場必須走此 API |
| `getTargetScene()` | 供 LoadingScene 讀取目標場景名稱與夾帶資料 |

```typescript
// 任意腳本中換場
services().scene.switchScene(SceneName.Lobby);

// 夾帶資料（例如：選中的關卡 ID）
services().scene.switchScene(SceneName.Battle, { encounterId: 'encounter_01' });
```

### 12.4 ResourceManager 資源標籤 (Tags)

所有 Load API 均支援 `options?: { tags?: string[] }`，可以為資源貼上場景標籤，方便在換場時精準釋放：

```typescript
// 在 LoginScene 中載入資源時加上標籤
await services().resource.loadJson('data/login-config', { tags: ['LoginScene'] });

// 進入 LoadingScene 後，一行清掉 Login 的所有標籤資源
services().resource.releaseByTag('LoginScene');
```

| API | 說明 |
|-----|------|
| `loadJson(path, { tags })` | 載入並記錄標籤 |
| `loadPrefab(path, { tags })` | 同上 |
| `loadSpriteFrames(path, { tags })` | 同上 |
| `loadFont(path, { tags })` | 同上 |
| `releaseByTag(tag)` | 批次釋放指定標籤下的所有資源（decRef） |
| `releaseAsset(path)` | 釋放單一路徑資源 |
| `clearCache()` | 清空所有快取 |

### 12.5 LoadingScene 自我釋放機制

LoadingScene 自身動態載入的背景圖透過 `resources.load` 取得後立即 `addRef()`，在呼叫 `director.loadScene(target)` 之前呼叫 `decRef()`，確保場景卸載後圖片引用計數歸零，引擎可即時回收。

```typescript
// 切換前先釋放 Loading 自身的背景圖
if (this._loadedBgFrame) {
    this._loadedBgFrame.decRef();
    this._loadedBgFrame = null;
}
director.loadScene(target.name);
```

> Unity 對照：等同在 `OnDestroy()` 呼叫 `Addressables.Release(handle)`。

### 12.6 背景圖替換方式

`LoadingScene.ts` 使用 `@property bgTexturePath` 讓圖片路徑可在 Cocos Inspector 面板中修改，不需要改程式碼。預設使用 `textures/bg_normal_day`。

### 12.7 加入新場景的 SOP

1. 在 Cocos Editor「Assets」面板右鍵 → Create → Scene，命名（例如 `LobbyScene`）
2. 在 `Constants.ts` 的 `SceneName` 列舉加一個新值
3. 在 Editor「Project Settings → Build → Included Scenes」列表中加入新場景（確保編譯時打包）
4. 新場景腳本繼承 `Component`，換場時統一呼叫 `services().scene.switchScene(SceneName.新場景)`
5. 若是一般換場需求，無需修改 `LoadingScene.ts` 的既有中繼流程；若是 UI QA / screen-driven 預覽需求，改在 Inspector 切 `previewMode` 與 `previewTarget`

### 12.8 UI Preview Hub 模式

`LoadingScene.ts` 現在除了負責 A → Loading → B 的中繼卸載，也支援 QA 專用的 preview hub 模式。

| 欄位 | 用途 |
|------|------|
| `previewMode` | 啟用後不再執行一般換場流程，改為直接掛載 screen-driven UI |
| `previewTarget` | 指定要預覽的 screen：`LobbyMain` / `ShopMain` / `Gacha` / `DuelChallenge` |

實作方式：

1. `LoadingScene` 會在 preview mode 下建立 `UIScreenPreviewHost`。
2. `UIScreenPreviewHost` 透過 `UISpecLoader.loadFullScreen(...)` 載入 screen/layout/skin 三層契約。
3. QA 或開發者可在同一個場景中反覆切換不同 UI screen，而不需為每個畫面建立獨立測試 scene。

Unity 對照：這相當於保留原本的 loading scene，但再額外讓它兼任一個「UI screen sandbox」，用 enum 決定要 instantiate 哪組 prefab/JSON 組合來做驗收。

---

## 13. 技術分類索引（工具 / UI 技術 / 核心代碼）

> **2026-03-30 新增**：為了讓三類技術需求清晰可查，以下將專案所有技術元件分為三大類別。

### 13.1 工具類（產生器 / 模擬器 / 編輯器擴展）

> 工具類元件不參與 runtime 遊戲邏輯，僅供開發階段或離線批次使用。

| 工具名稱 | 代碼位置 | 對應規格書 | 功能說明 |
|---|---|---|---|
| **血統矩陣計算器** | 待實作 | 血統理論系統.md (doc_spec_0011) | 輸入父母 → 計算 14 人祖先矩陣 → 預估 EP |
| **名士占卜模擬器** | 待實作 | 名士預言系統.md (doc_spec_0006) | 選名士 + 父母 → 預覽子嗣因子傾向 |
| **虛擬祖先生成器** | 待實作 | 血統理論系統.md (doc_spec_0011) K 節 | 初代名將 → 自動補齊 3 代 14 人虛擬祖先 |
| **因子分配計算器** | 待實作 | 因子爆發系統.md (doc_spec_0010) | 14 人因子 + 標籤 → EP 與共鳴加成 |
| **配種最佳化計算** | 待實作 | 結緣系統（配種）.md (doc_spec_0028) | 父母組合 → 預估 EP、因子、五維範圍 |
| **傷害計算器** | FormulaSystem.ts（runtime 共用） | 數值系統.md (doc_data_0001) + 戰場適性系統.md (doc_spec_0041) | 攻防 + 適性 + 兵種 + 地形 + 天氣 → 最終傷害 |
| SceneAutoBuilder | assets/scripts/tools/SceneAutoBuilder.ts | 場景搭建指南.md (doc_tech_0007) | 運行時場景生成器（已被編輯器擴展取代） |
| VfxComposerTool | assets/scripts/tools/VfxComposerTool.ts | demo_技術架構.md (doc_tech_0015) | 即時特效預覽工具 |
| vfx-block-registry | assets/scripts/tools/vfx-block-registry.ts | 美術素材規劃與使用說明.md (doc_art_0003) | 特效積木登錄與路徑治理 |
| vfx-usage-table | assets/scripts/tools/vfx-usage-table.ts | demo_技術架構.md (doc_tech_0015) | 積木組合宣告 + 死資源偵測 |
| UnityParticlePrefabParser | assets/scripts/tools/UnityParticlePrefabParser.ts | — | Unity 粒子遷移工具 |
| UnityParticleCompoundMapper | assets/scripts/tools/UnityParticleCompoundMapper.ts | — | Unity 複合粒子映射 |
| DeprecatedApiScanner | assets/scripts/tools/tests/ | 本文件 UnitTest 章節 | 棄用 API 靜態掃描 |
| battle-scene-builder | extensions/battle-scene-builder/ | 場景搭建指南.md (doc_tech_0007) | 編輯器擴展：一鍵生成戰鬥場景節點樹 |
| studio-tools-hub | extensions/studio-tools-hub/ | 美術素材規劃與使用說明.md (doc_art_0003) | 編輯器擴展：精靈管線工具 |
| unit-asset-organizer | extensions/unit-asset-organizer/ | 美術素材規劃與使用說明.md (doc_art_0003) | 編輯器擴展：單位資產整理 |
| unity-particle-translator | extensions/unity-particle-translator/ | — | 編輯器擴展：Unity 粒子翻譯 |
| sprite-pipeline | tools/sprite-pipeline/ | 美術素材規劃與使用說明.md (doc_art_0003) | Node.js 圖集拆幀與特效貼圖轉 alpha |

### 13.2 UI 技術（畫面框架 / 三層契約 / 元件）

| 元件名稱 | 代碼位置 | 對應規格書 | 功能說明 |
|---|---|---|---|
| **UIManager** | assets/scripts/core/managers/UIManager.ts | UI 規格書.md (doc_ui_0027) | 六層 UI 生命週期管理 |
| **UISpecLoader** | assets/scripts/ui/UISpecLoader.ts | UI技術規格書.md (doc_ui_0049) | 三層 JSON 契約載入（layouts/skins/screens） |
| **UIPreviewBuilder** | 待實作 | UI技術規格書.md (doc_ui_0049) | 從 JSON 契約動態生成 Prefab 預覽 |
| **UIValidationRunner** | 待實作 | UI技術規格書.md (doc_ui_0049) | 驗證 skinSlot 路徑、textKey、bind 欄位合法性 |
| **UILayer** | assets/scripts/ui/layers/UILayer.ts | UI 規格書.md (doc_ui_0027) | UI 層級基底 Component |
| **UIConfig** | assets/scripts/core/config/UIConfig.ts | 主戰場UI規格書.md (doc_ui_0001) | UIID / LayerType 定義 |
| **SolidBackground** | assets/scripts/ui/components/SolidBackground.ts | UI技術規格書.md (doc_ui_0049) | 純色白模背景生成 |
| **BattleHUD** | assets/scripts/ui/components/BattleHUD.ts | 主戰場UI規格書.md (doc_ui_0001) | 回合/糧草/SP 即時 HUD |
| **DeployPanel** | assets/scripts/ui/components/DeployPanel.ts | 戰場部署系統.md (doc_spec_0040) | 兵種選擇 + 路線部署 |
| **GeneralDetailPanel** | assets/scripts/ui/components/GeneralDetailPanel.ts | 武將人物介面規格書.md (doc_ui_0012) | 武將詳細面板（6 頁籤） |
| **GeneralListPanel** | assets/scripts/ui/components/GeneralListPanel.ts | 武將人物介面規格書.md (doc_ui_0012) | 武將列表 |
| **DuelChallengePanel** | assets/scripts/ui/components/DuelChallengePanel.ts | 名將挑戰賽系統.md (doc_spec_0007) | 單挑挑戰/接受 UI |
| **ResultPopup** | assets/scripts/ui/components/ResultPopup.ts | 戰場部署系統.md (doc_spec_0040) | 戰鬥結算面板 |
| **ToastMessage** | assets/scripts/ui/components/ToastMessage.ts | UI 規格書.md (doc_ui_0027) | 通知 Toast |
| **NetworkStatusIndicator** | assets/scripts/ui/components/NetworkStatusIndicator.ts | Data Schema文件.md | 斷線警示與同步提示 |
| **ui-design-tokens.json** | assets/resources/ui-spec/ui-design-tokens.json | UI技術規格書.md (doc_ui_0049) | 全域色彩/排版/間距 token |
| **三層 JSON 契約** | assets/resources/ui-spec/layouts\|skins\|screens/ | UI技術規格書.md (doc_ui_0049) | 結構層/樣式層/組裝層 |
| **i18n/zh-TW.json** | assets/resources/i18n/zh-TW.json | — | 繁體中文 UI 字串 |

### 13.3 核心代碼（戰鬥邏輯 / 資料模型 / 架設框架）

| 元件名稱 | 代碼位置 | 對應規格書 | 功能說明 |
|---|---|---|---|
| **ServiceLoader** | assets/scripts/core/managers/ServiceLoader.ts | 本文件 § 4.1 | DI 容器（9+ 服務註冊） |
| **GameManager** | assets/scripts/core/managers/GameManager.ts | MVP遊戲驗證規格書.md (doc_spec_0045) | 全域模式切換 |
| **SceneManager** | assets/scripts/core/managers/SceneManager.ts | 本文件 § 12.3 | A→Loading→B 場景切換 |
| **BattleSystem** | assets/scripts/core/systems/BattleSystem.ts | 戰場部署系統.md (doc_spec_0040) | 回合階段狀態機 + 糧草管理 |
| **FormulaSystem** | assets/scripts/core/systems/FormulaSystem.ts | 數值系統.md (doc_data_0001) | 集中傷害/治療/互剋公式 |
| **BuffSystem** | assets/scripts/core/systems/BuffSystem.ts | 因子爆發系統.md (doc_spec_0010) | 狀態效果管理 |
| **ActionSystem** | assets/scripts/core/systems/ActionSystem.ts | 戰法系統.md (doc_spec_0038) + 奧義系統.md (doc_spec_0030) | 技能時間軸演出 |
| **EventSystem** | assets/scripts/core/systems/EventSystem.ts | 本文件 § 4.4 | Pub/Sub 事件匯流排 |
| **PoolSystem** | assets/scripts/core/systems/PoolSystem.ts | 本文件 § 4.5 | NodePool 物件池 |
| **ResourceManager** | assets/scripts/core/systems/ResourceManager.ts | Data Schema文件.md | JSON/Prefab 載入與快取 |
| **EffectSystem** | assets/scripts/core/systems/EffectSystem.ts | 本文件 § 4.7 | VFX 生命週期管理 |
| **AudioSystem** | assets/scripts/core/systems/AudioSystem.ts | 本文件 | BGM/SFX 混音管理 |
| **MaterialSystem** | assets/scripts/core/systems/MaterialSystem.ts | 美術素材規劃與使用說明.md (doc_art_0003) | 材質實例與 Shader warmup |
| **MemoryManager** | assets/scripts/core/systems/MemoryManager.ts | 本文件 § 11 | 資產追蹤與釋放 |
| **NetworkService** | assets/scripts/core/systems/NetworkService.ts | Data Schema文件.md | 離線網路狀態偵測 |
| **SyncManager** | assets/scripts/core/systems/SyncManager.ts | Data Schema文件.md | 離線 Action Log + HMAC 同步 |
| **BattleController** | assets/scripts/battle/controllers/BattleController.ts | 戰場部署系統.md (doc_spec_0040) | 遭遇戰主控 |
| **EnemyAI** | assets/scripts/battle/controllers/EnemyAI.ts | 治理模式他國AI系統.md (doc_spec_0020) | 敵方 AI 部署策略 |
| **BattleState** | assets/scripts/battle/models/BattleState.ts | 戰場部署系統.md (doc_spec_0040) | 5×8 棋盤格子 + 單位索引 |
| **TroopUnit** | assets/scripts/core/models/TroopUnit.ts | 兵種（虎符）系統.md (doc_spec_0012) | 兵種單位資料模型 |
| **GeneralUnit** | assets/scripts/core/models/GeneralUnit.ts | 武將系統.md (doc_spec_0016) | 武將資料模型 + GeneralConfig DTO |
| **Constants** | assets/scripts/core/config/Constants.ts | 數值系統.md (doc_data_0001) | 列舉、常數、互剋表、地形修正 |
| **UnitAssetCatalog** | assets/scripts/core/config/UnitAssetCatalog.ts | 美術素材規劃與使用說明.md (doc_art_0003) | 單位資產路徑映射 |
| **VfxEffectConfig** | assets/scripts/core/config/VfxEffectConfig.ts | 本文件 | VFX Effect 定義 |
| **server/src/index.ts** | server/src/index.ts | Data Schema文件.md | 後端驗證引擎原型 |
