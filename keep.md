# Keep — 技術共識紀錄

> 此檔案為當前會話的最高執行準則。所有技術決策需與此保持一致。

**最後更新**: 2026-03-17

---

## 引擎 API 注意事項

- **`mr.setMaterial(material, index)` 已被標記為 deprecated（ts(6387)）**：請不要在新程式碼或自動產生的程式碼中直接使用此簽章。
- **應用規範**：統一使用 `setMaterialSafe(mr, material, index)`（檔案：[assets/scripts/core/utils/MaterialUtils.ts](assets/scripts/core/utils/MaterialUtils.ts)），或透過 `services().material.bindUnit()` 等高階 API 由系統管理 per-unit material，避免在多處散落直接操作 `MeshRenderer`。
- **給 AI 的指引**：自動產生或修改程式碼時，若需要將材質指派給 `MeshRenderer`，請呼叫 `setMaterialSafe`；不要輸出或插入 `mr.setMaterial(mat, idx)`（舊簽章），以免 TypeScript 編譯或未來引擎更新出現問題。

### 棄用 API 管理原則（必讀）

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



## 架構決策

1. **MVC + Service 混合架構**：戰鬥邏輯集中在純 TypeScript 類別，不依賴 Component，方便測試與移植。
2. **ServiceLoader 單例 DI 容器**：持有 9 個服務（Event, Formula, Pool, Resource, Effect, Buff, Battle, Game, UI），`initialize()` 時注入依賴。
3. **資料驅動**：兵種（troops.json）、武將（generals.json）、遭遇戰（encounters.json）皆以 JSON 設定檔管理。

## 編輯器擴展

4. **雙進程架構**：Cocos Creator 編輯器擴展必須分成 `main.ts`（Editor Main Process，不可用 cc）和 `scene-script.ts`（Scene Renderer Process，可用 cc）。
5. **package_version: 2**：所有擴展的 `package.json` 必須包含 `"package_version": 2`。
6. **battle-scene-builder**：一鍵生成場景節點樹（推薦方案），取代 SceneAutoBuilder 運行時方案。
7. **studio-tools-hub**：精靈管線工具，使用 `console.log` 而非 `Editor.log`。

## 戰鬥系統

8. **回合流程**：PlayerDeploy（成功部署後自動推進）→ 敵方部署 → AutoMove → BattleResolve → SpecialResolve → 勝敗判定 → nextTurn；若本回合不部署可手動按「結束回合」。
9. **武將技能 SP 系統**：擊殺敵方單位 +20 SP，SP 滿 → 可發動技能。
10. **狀態效果**：由 BuffSystem 統一管理，暈眩（Stun）使單位跳過移動與攻擊、解除盾牆。
11. **部署 UX**：選擇兵種 → 點擊路線按鈕 = 立即部署（選路即部署）。
12. **部署限制**：敵我雙方每回合最多部署 1 隻小兵（保留 DP 計算與可調參常數）。
13. **提示 UX**：部署成功/失敗、手動結束回合統一使用 Toast 提示，避免無回饋造成誤判。
14. **戰況可視化**：右側維持「文字棋盤 + 戰鬥紀錄小面板」雙欄顯示，優先提升可讀性與除錯效率。

## 環境

15. **Cocos Creator 3.8.8**，TypeScript ES2015，Editor 監聽 `http://localhost:7456`。
16. **Node.js v24.12.0**，PowerShell 不直接支援 npx，需 `cmd /c "npx ..."`。
17. **擴展編譯**：`cd extensions/battle-scene-builder && cmd /c "npx tsc"` 產出 `dist/main.js` + `dist/scene-script.js`。

## 已知限制

18. **EffectSystem** 為骨架，`showDamageText()` 尚未實作。
19. **UIManager** 已實作但 BattleScene 未使用（直接管理 UI）。
20. **encounters.json** 的 `enemyInitialDeployment` 尚未被程式讀取（敵方初始部署由 AI 自動產生）。
21. **SceneAutoBuilder** 預設也可在編輯模式直接生成並持久保留節點，但推薦方案仍是 `battle-scene-builder` 擴展。

22. **固定相機與 UI 構圖**：
   - 主攝影機使用固定數值 (Position `(-3.80528,7.598808,-7.911689)`, Rotation `(-44.111815,-143.244049,5.5)`, FOV 30) 對齊參考示意圖。
   - 棋盤縮放為目標深度 6.8，格子間距為寬度 10%。
   - 設定 UI 左側保留兩欄兵種按鈕並預留左上角給玩家頭像，技能按鈕固定在右下。
   - 這些規則已寫入相應的 View 組件並於 `start()` 時自動套用，避免場景手動調整。

23. **事件資料豐富化**：
   - `UnitMoved`、`UnitDamaged`、`UnitHealed` 與 `UnitDied` 現在攜帶位置信息，有助於動畫與特效。
   - `GeneralDamaged` 用於記錄與顯示主將受擊。
   - 旨在保持控制器與 View 間的明確責任分界。

24. **部署入口收斂**：
   - 移除底部 `路1~路5` 路線按鈕，統一改為「選兵種後直接點棋盤部署列」。

25. **戰鬥演出節奏化**：
   - 受擊演出改為事件佇列逐筆播放，每筆間隔 0.5 秒，避免同時播放造成資訊壓縮。

26. **地板 Buff 系統（資料驅動）**：
   - 每回合隨機產生 1~3 個 Buff，規則改由 `assets/resources/data/tile-buffs.json` 管理。
   - Buff 被踩到後消失，但單位身上的數值加成可持續疊加，並以頭頂括號顯示差值。

27. **武將單挑系統**：
   - 觸發條件：任一武將推進至對方前排即發動邀請（對稱法則）。
   - 武將化身 TroopUnit 上場：HP=currentHp, ATK=maxHp×8%, DEF=30, moveRange=2, attackRange=1（含斜對角，Chebyshev距離）。
   - 全軍增益：出陣方所有小兵攻擊力翻倍（含後續部署）。
   - 敵軍仇恨：敵方小兵優先攻擊出陣中的武將。
   - 防守方接受判定：依主將HP、場上兵力、總戰力計算評分，score=0.45×HP+0.35×兵力+0.2×戰力，≥0.58接受。
   - 拒絕懲罰：拒絕方全軍攻防與武將HP減半（新部署小兵同樣減半）。
   - 狀態追蹤：`playerGeneralUnitId`、`enemyGeneralUnitId`、`isWaitingDuelPlacement`、`duelRejectedFaction`。
   - 武將每回合可與友軍交換位置繼續突進。
   - 5 個新事件：`GeneralDuelStart`、`GeneralDuelChallenge`、`GeneralDuelAccepted`、`GeneralDuelRejected`、`DuelPenaltyApplied`。

28. **結算面板 UI 層級**：
   - ResultPopup 使用動態建立的全螢幕半透明遮罩 + 彩色卡片背景，並透過 `setSiblingIndex` 確保最高 UI 層級。

29. **右下操作按鈕**：
   - 技能釋放 → 武將單挑 → 計謀策略 → 回合結束，共 4 顆，統一 200×70，間距 14px。


## 資產管理與 Bundles (Asset Management & Bundles)

30. **Asset Bundles 管理**：所有動態載入的資源都放在 `assets/bundles/`，並依功能區分子資料夾（如 `vfx_core/`、`ui/`、`battle/`）。
31. **VFX / UI 素材尺寸**：透明 PNG 建議以 128×128 或 256×256 儲存，避免在引擎中放大縮小造成鋸齒或過度模糊。
32. **素材結構**：VFX 素材放在 `assets/bundles/vfx_core/textures/`，常見子資料夾為 `icons/`、`shapes/`、`skills/`。
33. **命名規範**：以 `ex_` 前綴作為 VFX 素材識別，例如 `ex_ring_runemagic.png`、`ex_icon_sword.png`、`ex_shape_arrowup.png`。
34. **減少 Draw Call**：使用 Cocos Creator 的 Auto Atlas (`.pac`) 將精靈集中打包，Atlas 建議最大 2048，避免過度碎片化導致大量 Draw Call。

35. **嚴格保留原始貼圖**：
    - 原始貼圖請保持不變（不要直接在 `assets/bundles/vfx_core/textures/` 進行破壞性編輯）。
    - 若需修正透明邊緣或黑邊，優先透過 shader / `.effect` 的 blending 與 alpha 參數解決；若確實需要修改貼圖，請同時保留一份 `*_orig.png` 作為備份。

## Buff 增益特效分鏡

36. **Buff 增益特效唯一正確分鏡**：
   - 以三層結構呈現：最下層法陣、中層小劍、上層箭頭。
   - `0.0s ~ 0.5s`：只有地面法陣存在，法陣貼地並繞 `Y` 軸緩慢旋轉。
   - `0.0s ~ 2.0s`：法陣周圍持續噴發火花粒子。
   - `0.5s`：中間小劍出現。
   - `1.0s`：箭頭出現。
   - `1.0s ~ 2.0s`：小劍與箭頭停留展示，不立即退場。
   - `2.0s ~ 3.0s`：小劍與箭頭一起往上移動並同步淡出；法陣也在這一段淡出消失，不保留殘影。
   - 生命系 Buff（HPGain / HPLoss）使用雙箭頭層，兩個箭頭必須保持垂直堆疊，不可與中心符號交叉重疊。
   - 主符號本體不做整體過曝發光，應以貼圖原貌為主；若需要發光，只允許邊緣與火花粒子呈現柔和光感，不可出現黑邊。
   - 任何不符合此節奏的版本，視為錯誤實作，不可作為後續 Buff 特效基準。

37. **Buff Quad Shader 技術決策**：
   - BuffGainEffectPool 不再依賴 `builtin-unlit` + runtime state override，改用 `assets/resources/effects/vfx-buff-quad.effect`。
   - 此 effect 至少維持 3 種 technique：`transparent`（本體）、`additive`（火花）、`outer-glow`（柔光外圈）。
   - 本體清晰度優先由 `transparent` pass 保證，禁止用過強 additive 讓主符號過曝來假裝清晰。
   - 外光層只作氛圍補強，不可覆蓋原始符號細節；若畫面發糊，先檢查來源貼圖解析度是否仍為 128x128。
   - 若需要修正黑邊／透明度問題，請先檢查貼圖是否使用「預乘 alpha」或「背景色填滿」，並優先在 shader 中做修正；僅在無法解決時，才用非破壞性的方式生成 `*_fixed.png` 並保留 `*_orig.png`。
   - 所有 shader 參數（如 `alpha`, `boost`, `softness`）變動需同步更新 `docs/demo_技術架構.md` 的對應段落。

38. **Cocos Creator 資源刷新**：
   - 編輯器資源變更後，可透過 VS Code 任務「Cocos Creator compile」或 `curl http://localhost:7456/asset-db/refresh` 強制刷新。

---

## 特效與素材治理規範 (VFX & Asset Governance)

> **起源範例**：2026-03-18，從 `3DEffectController` 遷移 24 個音效至 `bundles/audio/clips/`。
> 所有未來的素材遷移均應遵循此規範，防止專案變成素材垃圾場。

### 核心原則：資料夾即模組 (Folder = Module)

**一個功能單元 = 一個資料夾。刪除整個資料夾 = 完整移除，無殘留孤兒檔案。**

```
✅ 正確：vfx_skills/boom/textures/ + vfx_skills/boom/prefabs/ + vfx_skills/boom/README.md
❌ 錯誤：vfx_skills/textures/boom_fire.png + vfx_skills/prefabs/Boom.prefab（孤兒散落）
```

39. **特效模組標準結構**：
   ```
   vfx_skills/[effect-key]/
   ├── @256/          # 主貼圖 ≤256×256 → 可壓 ETC2 / ASTC 4×4
   ├── @128/          # 輔助貼圖 ≤128×128 → 可壓 ASTC 8×8
   ├── @no-compress/  # BMFont atlas / 漸層 LUT → 禁止有損壓縮
   ├── prefabs/       # .prefab 特效預製體
   └── README.md      # 一行說明：用途 | 關聯技能/事件 | 預設回收時間(秒)
   ```
   `effect-key` 必須與 `PoolSystem.register(key, prefab)` 的 key **完全一致**，方便全域搜尋確認是否有引用。

40. **@SIZE 貼圖尺寸命名規範**：
   所有貼圖子資料夾一律使用 `@SIZE` 或 `@no-compress` 命名，讓壓縮規格「目錄即文件」，不需查閱額外設定：

   | 資料夾名稱 | 原始解析度上限 | 建議壓縮格式 | 典型用途 |
   |-----------|-------------|-----------|---------|
   | `@128` | 128×128 | ASTC 8×8 / ETC2 | 小圖示、輔助形狀、箭頭 |
   | `@256` | 256×256 | ASTC 4×4 / ETC2 | 粒子主貼圖、環形光圈 |
   | `@512` | 512×512 | ASTC 6×6 | 高精度特效貼圖 |
   | `@no-compress` | 任意 | 禁止有損壓縮 | BMFont atlas、漸層 LUT、UI 主圖 |

   **現有 `vfx_core/textures/` 例外**：`icons/`=@128、`rings/`=@256、`shapes/`=@128（已存在，無法改名）。
   詳見 `assets/bundles/vfx_core/textures/_TEX_COMPRESSION.md`。新建資料夾請直接使用 `@SIZE` 命名。

41. **_MANIFEST.md 索引**：
   每個 Bundle 根目錄放一個 `_MANIFEST.md`，記錄所有模組的使用狀態：

   | 狀態標記 | 含義 | 行動 |
   |---------|------|------|
   | ✅ Active | 程式碼已引用，會被打包 | 維持 |
   | 🚧 WIP | 開發中，暫不刪除 | 等待接入 |
   | 📦 Archive | 準備廢棄 | 移至 `_archive/` → 確認後整刪 |

   **每次新增或刪除模組，必須同步更新 `_MANIFEST.md`。**

42. **_archive/ 廢棄清理工作流**：
   1. 確認模組未被任何 `.ts` / `.scene` 引用（VS Code 全域搜尋 PoolSystem key 字串）
   2. 整個模組資料夾移至同 Bundle 下的 `_archive/[YYYY-MM-DD]-[effect-key]/`
   3. 在 `_MANIFEST.md` 中更新狀態為 📦 Archive
   4. 下次 Sprint Review → 確認無誤 → 整資料夾刪除，從清單移除
   - **禁止只刪貼圖檔保留 Prefab**（Cocos meta 殘留會污染 library/，造成警告）

43. **壓縮預算快速參考**：
   | 資源類型 | 單張/單檔上限 | 說明 |
   |---------|-------------|------|
   | 粒子主貼圖（@256）| 256×256 | 超過會大幅增加 GPU 記憶體佔用 |
   | 輔助圖示（@128）| 128×128 | Buff、小圖示，128 已足夠 |
   | BMFont Atlas | ≤1024×1024 | 禁壓縮，才能保留字體邊緣 |
   | SFX (.mp3) | ≤200 KB/檔 | 單次音效；BGM 可達 1–3 MB |
   | Auto Atlas (.pac) | 最大 2048×2048 | 分組打包，單 Atlas 不超過 2048 |
   | 同時存在特效 Prefab | ≤15 個 | 超過考慮分 Bundle 延遲載入 |

### 外部素材遷移 Checklist

44. **從其他專案遷移素材的標準流程**：

   **遷移前**：
   - [ ] 確認素材授權可用（CC0 / 商業授權 / 自製）
   - [ ] 此素材對應一個功能？→ 建立獨立模組資料夾（`vfx_skills/[key]/`）
   - [ ] 此素材被多個功能共用？→ 放入 `vfx_core/textures/`（加進 `_TEX_COMPRESSION.md`）

   **遷移時**：
   - [ ] `.png` 貼圖：確認尺寸符合 @SIZE 分類，放入對應子資料夾
   - [ ] `.mp3` 音效：放 `audio/clips/`，在 `audio/_MANIFEST.md` 加一行記錄
   - [ ] `.prefab`：確認其引用的腳本已在新專案中存在，否則先搬腳本
   - [ ] `.mtl` 材質：更新引用的 `.effect` Shader 路徑
   - [ ] 在 `_MANIFEST.md` 標記新增模組狀態為 🚧 WIP

   **遷移後**：
   - [ ] 程式碼中呼叫 `PoolSystem.register(key, prefab)` → 狀態改為 ✅ Active
   - [ ] Cocos Creator 無資源警告（紅色 UUID 缺失提示）
   - [ ] 不用的遷移素材已移入 `_archive/`，而非留在根目錄

45. **禁止打包原則（重要）**：
   - 放在 Bundle 目錄中的資源**一律會被打包**，即使程式碼未引用
   - 「放進去再說」是讓 Bundle 肥大的根因
   - 唯一例外：`_archive/` 資料夾可設定為 Bundle 排除，或直接刪除
   - **沒有對應 PoolSystem key 的 Prefab 不應存在於 Bundle 中**

---

## 字型治理規範 (Font Governance)

> **完整規範**：見 `assets/resources/fonts/_GOVERNANCE.md`
> **起源**：2026-03-18，設計多國語系架構時建立。

46. **兩類字型嚴格分開，禁止混放**：

   | 類型 | 目錄 | 管理系統 | 載入時機 | 壓縮 |
   |------|------|---------|---------|------|
   | VFX 飄字 BMFont | `resources/fonts/vfx/{name}/` | `FloatTextSystem.registerFont()` | 遊戲初始化一次 | 禁壓縮 |
   | 語系 UI 字型 | `resources/fonts/locale/{locale}/` | `I18nSystem.setLocale()` 自動管理 | 語系切換時懶載入 | 不壓縮（TTF） |

47. **BMFont 配對原則**：
   - `.fnt` 和 `_0.png` 是配對資源，**必須在同一資料夾**
   - BMFont atlas PNG 禁止有損壓縮（ETC2 / ASTC 會破壞字體邊緣）
   - 刪除時 `.fnt` 和所有 `_N.png` 必須一起刪，不可只刪其中一個

48. **語系字型 addRef / decRef 生命週期**：
   - `I18nSystem.setLocale(locale)` 會：懶載入目標語系字型（`addRef`）→ 卸載前一語系字型（`decRef`）
   - `Font.decRef()` 降計數，讓 Cocos GC 決定實際釋放時機
   - **不可手動 destroy Font 資源**；只能 decRef

---

## 多國語系架構 (I18n Architecture)

49. **I18nSystem 使用原則**：
   - 所有 UI 顯示文字必須透過 `services().i18n.t(key)` 查詢，禁止寫死中文字串
   - UI 元件需在 `onEnable()` 訂閱 `onLocaleChanged`，在 `onDestroy()` 取消訂閱
   - 字串 JSON 放在 `resources/i18n/{locale}.json`（key 格式：`{namespace}.{context}.{id}`）

   ```typescript
   // ✅ 正確
   label.string = services().i18n.t('status.poison');

   // ❌ 禁止
   label.string = '中毒';
   ```

50. **語系切換事件模式（UI 元件標準寫法）**：
   ```typescript
   private _unsubI18n?: () => void;

   onEnable() {
       this.refresh();
       this._unsubI18n = services().i18n.onLocaleChanged(() => this.refresh());
   }

   onDestroy() {
       this._unsubI18n?.();  // 取消訂閱，防止 Component 銷毀後仍被呼叫
   }

   private refresh() {
       this.nameLabel.string = services().i18n.t('ui.general.name');
       const f = services().i18n.getFont('body');
       if (f) this.nameLabel.font = f;
   }
   ```

51. **新增語系 Checklist**：
   - [ ] 在 `LocaleCode` 類型中新增代碼（`I18nSystem.ts`）
   - [ ] 建立 `resources/i18n/{locale}.json`（複製 `zh-TW.json` 為模板翻譯）
   - [ ] 建立 `resources/fonts/locale/{locale}/body.ttf`（選配）
   - [ ] 更新 `resources/fonts/locale/_MANIFEST.md`

---

## 動態飄字系統 (FloatTextSystem)

52. **FloatTextSystem 是所有浮動文字的唯一入口**：
   - 傷害數字、治療量、狀態效果（中毒/暈眩）、場景提示（Debug）皆走此系統
   - **禁止**在任何地方重新實作 `new Node + addComponent(Label)` 的飄字邏輯
   - **禁止**直接呼叫舊的 `UnitRenderer.spawnFloatText()`（已改為委託 FloatTextSystem）

53. **FloatTextType 擴充規則**：
   - 新增飄字類型 = 在 `FloatTextType` 聯合類型新增名稱 + 在 `FLOAT_CONFIGS` 新增一行設定
   - 視覺調整（顏色/大小/速度）**只改 `FLOAT_CONFIGS`**，程式邏輯不動
   - 連擊防爆靠 `maxConcurrent`：超量時自動回收最舊節點，不要調高到不合理的值

54. **FloatTextSystem 初始化時序**：
   - `ServiceLoader.initialize()` 建立實例（在 BattleScene.start() 最前面）
   - `services().floatText.setup(uiRoot, camera, canvas)` 由 `UnitRenderer.initialize()` 呼叫
   - 若 setup 未被呼叫，`show()` 會靜默無效（不會崩潰）

55. **語系整合**：
   - 狀態效果文字應透過 I18nSystem：`services().floatText.showStatus(services().i18n.t('status.poison'), worldPos)`
   - BMFont 字型透過 registerFont：Phase 3 完成後在啟動時呼叫 `services().floatText.registerFont('dmg_crit', font)`
   - 語系字型也可套入飄字：`services().floatText.registerFont('status', services().i18n.getFont('body'))`

---

**MD 文件索引與摘要**

- **assets/bundles/vfx_skills/_MANIFEST.md**: 使用時機：管理或新增技能特效模組時檢視與更新；內容大綱：模組清單表（資料夾 ↔ PoolSystem key）、狀態標記（✅/🚧/📦）、清理流程與搬移 Checklist；檔案位置：[assets/bundles/vfx_skills/_MANIFEST.md](assets/bundles/vfx_skills/_MANIFEST.md)
- **assets/bundles/vfx_skills/README.md**: 使用時機：查看 VFX Skills Bundle 的整體約定或加入新特效前；內容大綱：Bundle 範圍說明、快速規則（資料夾=PoolSystem key、@SIZE 子資料夾、_archive 流程）、新增/刪除同步 _MANIFEST.md 的提醒；檔案位置：[assets/bundles/vfx_skills/README.md](assets/bundles/vfx_skills/README.md)
- **assets/bundles/audio/_MANIFEST.md**: 使用時機：新增/移除音效或在開發時搜尋 SFX key；內容大綱：SFX 清單（檔名 ↔ AudioSystem key）、BGM 區塊、清理規則、載入與播放範例程式碼（registerClip / playSfx）；檔案位置：[assets/bundles/audio/_MANIFEST.md](assets/bundles/audio/_MANIFEST.md)
- **assets/bundles/vfx_core/textures/_TEX_COMPRESSION.md**: 使用時機：新增貼圖或調整壓縮設定時參考；內容大綱：現有資料夾對照與等效 @SIZE（icons/rings/shapes → @128/@256）、新增貼圖命名與壓縮建議、Auto Atlas 參數與為何不直接重命名為 @SIZE 的說明；檔案位置：[assets/bundles/vfx_core/textures/_TEX_COMPRESSION.md](assets/bundles/vfx_core/textures/_TEX_COMPRESSION.md)
- **assets/resources/fonts/_GOVERNANCE.md**: 使用時機：管理字型（新增 BMFont 或語系字型）時參照；內容大綱：字型兩大分類（`vfx/` vs `locale/`）目錄範例、載入/卸載時序、VFX BMFont 與語系字型的使用範例程式碼、Checklist 與禁止事項（不得混放、BMFont 禁止有損壓縮等）；檔案位置：[assets/resources/fonts/_GOVERNANCE.md](assets/resources/fonts/_GOVERNANCE.md)
- **assets/resources/fonts/locale/_MANIFEST.md**: 使用時機：新增或驗證語系字型是否存在時查看；內容大綱：語系字型狀態表（locale、FontRole、檔案路徑、使用狀態）、role 說明（body/title）、找不到字型時的 fallback 行為、新增語系步驟；檔案位置：[assets/resources/fonts/locale/_MANIFEST.md](assets/resources/fonts/locale/_MANIFEST.md)

（以上 MD 為本次素材治理、字型治理與 VFX 規範的核心輔助文件；後續新增任何模組/語系/音效，請務必同步更新對應的 `_MANIFEST.md`。）


## 材質 / Shader 管理規範 (Shader & Material Governance)

> **起源**：2026-03-18，引入 `MaterialSystem` 實作 per-unit 材質實例與參數化服裝系統。
> **核心設計**：一個 Shader（`unit-base.effect`）支撐無限種服裝變體，實現產品差異化。

### 兩層參數模型（重要！）

```
Tier 1 — Outfit 持久參數（setProperty）
  material.setProperty('u_primaryColor', vec4);   // 換裝時呼叫一次
  material.setProperty('u_gradientTop',  vec4);   // 保持到下次換裝

Tier 2 — 戰鬥即時參數（setInstancedAttribute）
  mr.setInstancedAttribute('a_rimColor', [r,g,b,a]);   // 受擊後 200ms 恢復
  mr.setInstancedAttribute('a_dissolve', [progress]);  // 死亡動畫逐幀更新
```

56. **Shader 優先級三層**：

   | 優先級 | 觸發時機 | 典型用途 |
   |--------|---------|---------|
   | `critical` | 遊戲啟動 `warmupCritical()` | 角色本體 `unit-base.effect` |
   | `standard` | 進入戰鬥場景前 `warmupStandard()` | 常用 VFX Shader |
   | `lazy` | 隨 Prefab Bundle 懶載入 | 特殊武將技能特效 |

   **BattleScene.start() 標準初始化順序**：
   ```typescript
   services().material.registerShader('unit-base', 'effects/unit-base', 'critical');
   services().material.registerShader('vfx-buff',  'effects/vfx-buff-quad', 'standard');
   await services().material.warmupCritical(this.node);
   ```

57. **絕對禁止修改 sharedMaterial**：

   ```typescript
   // ❌ 禁止：會影響所有使用此材質的 unit（全區染色 bug）
   meshRenderer.sharedMaterial.setProperty('u_primaryColor', teamColor);

   // ✅ 正確：透過 MaterialSystem 取得 per-unit clone
   services().material.bindUnit(unitId, 'unit-base', meshRenderer);
   services().material.applyOutfit(unitId, 'unit-base', outfitConfig);
   ```

   Unity 對照：不要直接改 `renderer.sharedMaterial`，要用 `renderer.material`（自動 clone）。

58. **per-unit Material 生命週期**：
   - `bindUnit(unitId, shaderKey, mr)` — unit 生成時呼叫，clone base material 並指定给 MeshRenderer
   - `applyOutfit(unitId, shaderKey, outfit)` — 套用服裝（可在 bindUnit 後立即呼叫）
   - `releaseUnit(unitId)` — **unit 死亡 / 銷毀時必須呼叫**，decRef 所有 clone 材質避免記憶體洩漏
   - Unity 對照：相當於 `Destroy(renderer.material)` 配合 `MaterialPropertyBlock` 的正確釋放

59. **OutfitConfig — 可序列化服裝結構**：
   ```typescript
   interface OutfitConfig {
       primaryColor:    [number, number, number, number]; // rgba 0-1
       secondaryColor:  [number, number, number, number];
       gradientTop:     [number, number, number, number];
       gradientBottom:  [number, number, number, number];
       gradientRange:   [number, number];     // [minWorldY, maxWorldY]
       emissionColor:   [number, number, number, number];
       emissionIntensity: number;
   }
   ```
   - 所有數值 0.0–1.0，可直接 JSON 存入玩家資料 → 讀取後設值即完成服裝恢復
   - `captureOutfit(unitId, shaderKey)` 可快照目前狀態（用於 UI 預覽或換裝存檔）
   - `DEFAULT_OUTFIT` 作為 clone 起點，確保無服裝時渲染結果正確

60. **Rim 邊緣光使用規範**：
   - 受擊：`setRim(unitId, shaderKey, hurtColor)`，200ms 後 `clearRim(unitId, shaderKey)`
   - 選取高亮：白色低強度（`Color(255,255,255,120)`）
   - **a_rimColor.a 是強度控制**：a=0 表示無 rim，shader 會自動跳過計算
   - 每個 setRim 呼叫都需對應一個 clearRim（否則殘留）

61. **Dissolve 溶解規範**：
   - 死亡動畫：0 → 1（2 秒 tween），完成後呼叫 `releaseUnit()`
   - 出場（反向）：1 → 0（0.5 秒 tween），出場完成後移除溶解
   - 溶解需要噪聲貼圖（`u_dissolveTex`），預設指向 `white`（退化為無溶解）
   - 正式溶解需提供 128×128 Perlin Noise PNG，放入 `resources/textures/noise/`

62. **unit-base.effect 的 Uniform 與 Instanced 對照表**：

   | 參數 | 類型 | 層級 | 呼叫方式 |
   |------|------|------|---------|
   | `u_primaryColor` | vec4 | Tier 1 | `material.setProperty()` |
   | `u_secondaryColor` | vec4 | Tier 1 | `material.setProperty()` |
   | `u_gradientTop/Bottom` | vec4 | Tier 1 | `material.setProperty()` |
   | `u_gradientRange` | vec4 | Tier 1 | `material.setProperty()` |
   | `u_emissionColor` | vec4 | Tier 1 | `material.setProperty()` |
   | `u_emissionIntensity` | float | Tier 1 | `material.setProperty()` |
   | `a_rimColor` | vec4 | Tier 2 | `mr.setInstancedAttribute()` |
   | `a_dissolve` | float | Tier 2 | `mr.setInstancedAttribute()` |

---

## UnitTest 框架規範

> **起源**：2026-03-18，建立零外部依賴的 TypeScript 測試框架，同時包含 Deprecated API 靜態掃描。

### 框架位置

| 檔案 | 功能 |
|------|------|
| `assets/scripts/tools/tests/TestRunner.ts` | 框架核心（assert、TestSuite、TestRunner） |
| `assets/scripts/tools/tests/DeprecatedApiScanner.ts` | 靜態程式碼棄用 API 掃描 |
| `assets/scripts/tools/tests/FormulaSystem.test.ts` | FormulaSystem 測試（19 個案例） |
| `assets/scripts/tools/tests/BuffSystem.test.ts` | BuffSystem 測試（15 個案例） |
| `assets/scripts/tools/tests/run-cli.ts` | CLI 入口（串接所有 Suite） |
| `assets/scripts/tools/tests/TestEntryPoint.ts` | Cocos DevMode 入口（window.__runTests） |
| `tools/run-tests.js` | Node.js CLI wrapper（從專案根目錄執行） |
| `tools/watch-tests.js` | Watch 模式：監看檔案變更並自動重跑 |
| `tsconfig.test.json` | 測試專用 tsconfig（含 Node types，不影響 Cocos 編譯） |

### 執行測試

```powershell
# 單次執行（CI / 手動驗證）
node tools/run-tests.js
# 或
npm test

# Watch 模式（開發中持續監看）：存檔即自動重跑
node tools/watch-tests.js
# 或
npm run test:watch
```

- 全通過 → `🟢 ALL PASS: N passed`
- 有失敗 → `🔴 FAILED: X failed / Y passed`，process 退出碼非 0
- Watch 模式監看 `assets/scripts/`、`extensions/`、`tools/` 目錄的 `.ts`/`.js` 變更，debounce 500ms

### 新增測試套件規則

1. 在 `assets/scripts/tools/tests/` 新增 `XSystem.test.ts`，export `createXSuite(): TestSuite`
2. **不可** import 任何 `cc` 模組（純邏輯）
3. 在 `run-cli.ts` 的 import 區及 `runner.register(createXSuite())` 新增一行
4. 執行 `node tools/run-tests.js` 確認全綠

### DeprecatedApiScanner 規則新增方式

在 `DeprecatedApiScanner.ts` 的 `DEPRECATED_RULES` 陣列新增一筆：

```typescript
{
    id:      'uniqueRuleId',
    // string = 精確 substring；RegExp = 正規表達式（推薦，可限制邊界）
    pattern: /\.deprecatedMethod\s*\(/,
    whitelist: [
        'assets/scripts/core/utils/WrapperFile.ts',        // wrapper 本身豁免
        'assets/scripts/tools/tests/DeprecatedApiScanner.ts', // 規則定義字串
    ],
    replacement: 'safeWrapper() 來自 core/utils/WrapperFile.ts',
    reason:      'keep.md 引擎 API 注意事項 / GitHub issue 連結',
}
```

**注意事項**：
- `whitelist` 路徑**相對於專案根目錄**（包含 `assets/scripts/` 前綴），使用後綴 `endsWith` 精確比對
- `DeprecatedApiScanner.ts` 自身**務必**加入每條規則的 whitelist（規則定義字串含有 pattern）
- Scanner 掃描範圍：`assets/scripts/`、`extensions/`（含子目錄 .ts）、`tools/`（含子目錄 .ts）
- 純注解行（`//`、`*`、`/*` 開頭）自動跳過，不會誤判為違規
- 建議使用 RegExp 而非 string，可避免誤比到前後無關字元（如 `.setMaterialSafe(` 被 `.setMaterial(` substring 誤中）

### 63. 測試執行環境需求

- **Node.js**：v18+（目前環境 v24.12.0 ✅）
- **ts-node + @types/node + typescript**：已安裝至 `node_modules/`（`npm install --save-dev ts-node @types/node typescript`）
- **PowerShell 限制**：需用 `cmd /c "..."` 才能執行 npm/npx（`Set-ExecutionPolicy` 問題，見條目 16）
- **tsconfig.test.json**：使用 `"module": "commonjs"` + `"types": ["node"]`，與主 tsconfig.json 完全獨立

---
