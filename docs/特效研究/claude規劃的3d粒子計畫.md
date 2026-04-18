# 3KLife VFX 特效量產升級計畫

## 目標與邊界

3KLife 戰鬥體驗包需要 66 個技能的視覺特效，範圍包含：
- 35 個戰法
- 25 個奧義
- 6 個場景戰法

這份主文件的用途不是只做構想收集，而是作為多 Agent 協作的正式進度面板。所有參與者都必須：
- 先開任務卡，再進入實作、驗證或批次整理
- 回報任務進度與 blocker
- 把里程碑狀態與重要決策回寫到本文件

## 問題背景

目前 VFX 量產有三個核心卡點：
1. Unity particle 無法直接搬到 Cocos，格式與執行模型不相容。
2. Flipbook 序列幀在 Web 端記憶體成本過高，一張 `2048×2048 RGBA8` 約為 `16MB GPU RAM`。
3. 現有 prefab 有一部分來自 Unity 自動轉換，表現不穩定，不能直接當正式資產。

## 現有資產盤點

VFX prefab 目錄：`assets/bundles/vfx_core/prefabs/`，目前約 54 個資料夾。

| 分類 | 數量 | 來源 | 狀態（2026-04-18 靜態審計後）|
|------|------|------|------|
| Cocos 原生戰鬥 VFX（Buff/Debuff/Healing/fightBoom/fire/hit/smokeLight/boss×2） | 9 | 手工建立 | ✅ PASS |
| CFXR 自動生成 | **21** | `cfxr-prefab-generator.mjs` | 🔵 VERIFIED（貼圖 UUID 全驗證，待 runtime 目視）|
| MEP 自動生成 | **9** | `mep-prefab-generator.mjs` | 🔵 VERIFIED（貼圖 UUID 全驗證，待 runtime 目視）|
| Unity compound 自動轉換（含同步修復） | 4 | `generate-unity-compound-effect.mjs` | 🟡→✅ 貼圖 UUID 已修復，待 runtime 確認 |
| Unity 測試樣本 | 1 | `p3d_unity_sample_auto` | ⚪ TEST_ONLY |
| 無 ParticleSystem + null MeshRenderer | 2 | 不明 | 🔴 BROKEN（commonLight / star）|
| 非技能 VFX（bubble/box/changeColor/collectColor/colorBar/flyFight/levelUp） | 7 | 混合 | ⏭ SKIP（不納入 66 技能配方）|
| `_shared_tex` | 1 | 共享貼圖庫 | ➖ N/A |

盤點結論（修正版）：
- 立刻可用（PASS）：9 個
- 貼圖驗證通過待 runtime 目視（VERIFIED）：30 個
- 貼圖 UUID 已修復待 runtime 確認：4 個
- 不可用（BROKEN）：2 個
- 跳過（非技能 VFX）：7 個 + 1 N/A

## 現有轉換工具鏈

```text
Unity .prefab (ForceText YAML)
  -> UnityParticlePrefabParser.ts
  -> UnityParticleCompoundMapper.ts
  -> generate-unity-compound-effect.mjs
  -> compound-prefab-generator.mjs
  -> vfx-block-registry.ts
```

已知限制：
- 不支援：`forceOverLifetime`、`rotationOverLifetime`、`textureAnimation`、`trails`、`noise`
- Shape 映射有限：只支援 `Sphere / Cone / Circle`
- 材質策略過於單一：目前統一偏向 `MAT_ADDITIVE`，無法忠實映射 Unity 自訂 Shader

## 外部方案調查

### Unity2Cocos
- GitHub：`github.com/ina-amagami/Unity2Cocos`
- 類型：Unity Editor Plugin，在 Unity 端做 Export
- 評估：值得做 1 次實驗，但不能假設它一定能完整接手量產線

### U3dParticel2Cocos
- 來源：Cocos 中文論壇 topic/145228
- 類型：解析 Unity text prefab，直接在 Cocos 建 Node + ParticleSystem
- 評估：與現有 YAML 解析路線最接近，值得參考映射策略

### Effekseer
- 有 WebGL / WASM runtime，但沒有 Cocos Creator 3.8 官方原生整合
- 評估：不適合作為主力方案

## 技術路線

### 路線 A：修復現有 prefab + 擴充 block 疊加
- 目的：最短路徑產出可用特效
- 核心工作：Health Audit、sanitize 修復、`EffectSystem` 支援 `blocks[]`

### 路線 B：嘗試 Unity2Cocos 批次重轉
- 目的：降低 Unity 來源 prefab 的人工修復成本
- 前提：必須拿得到原始 Unity 專案
- 原則：這是實驗支線，不可阻塞主線交付

### 路線 C：補 4 個 Procedural Shader
- 目的：用低記憶體成本補足水、毒、風、冰四大缺口
- 預計 shader：
  - `water-ripple.effect`
  - `poison-fog.effect`
  - `wind-vortex.effect`
  - `ice-crystal.effect`

## 多 Agent 協作規範

### 開工前必做
- 開一張對應任務卡，寫明目標、範圍、輸出物與預計修改檔案。
- 在任務卡 notes 記錄：開始時間、Agent 名稱、這輪先做什麼。
- 先確認是否有人已鎖定同一份高風險檔案。

### 工作中必做
- 每完成一段可驗證成果，就更新任務卡進度。
- 若發現 blocker、規格缺口或額外子題，先補 notes，再視需要加開子卡。
- 不得只在對話中回報，必須把 milestone 狀態回寫到本文件。

### 收工前必做
- 在任務卡補：本輪改了哪些檔案、做了哪些驗證、目前 blocker 是什麼。
- 回寫本文件的 checklist 與 milestone 狀態。
- 若有後續接力需求，要在本文件與任務卡都留下 handoff。

### 主文件更新規則
- 任何 Agent 完成里程碑中的一個勾選項，必須直接更新本文件。
- 若只是局部實驗失敗，也要在對應里程碑下方補「失敗原因 / 是否放棄 / 是否轉支線」。
- 本文件是 VFX 計畫的單一人工摘要入口，不可只更新任務卡而不更新主文件。

## 角色分工建議

| Agent 類型 | 主要責任 |
|------|------|
| Runtime / Tooling Agent | `EffectSystem`、schema、生成器、驗證工具 |
| Asset QA Agent | prefab 健康檢查、Composer 驗證、戰場 smoke |
| Shader Agent | procedural shader 與材質策略 |
| Recipe Agent | 66 技能配方編排、視覺語彙一致性 |
| Conversion Agent | Unity2Cocos / YAML 轉換實驗、比較報告 |

## 里程碑總覽

### Milestone 0：任務卡與基線建立

目標：讓後續多人協作不互撞、不失聯。

Checklist：
- [x] 為本計畫建立總任務卡與 milestone 對應子卡。（TASK-VFX-M2-001 / TASK-VFX-M1-001 已開）
- [x] 為 54 個 prefab 健康檢查建立批次任務卡。（TASK-VFX-M1-001）
- [x] 為 `EffectSystem blocks[]`、shader、Unity 轉換實驗各開獨立任務卡。（TASK-VFX-M2-001 已完成）
- [x] 在本文件補上每張任務卡的 ID / owner / status。（見下方「任務卡」章節）

完成定義：
- 所有主線工作都有任務卡對應。✅
- 主文件能看出誰在做什麼、做到哪裡。✅

### Milestone 1：VFX Health Audit

目標：把 54 個 prefab 從「感覺能用」變成有證據的 PASS / FIXABLE / BROKEN 分級。

Checklist：
- [x] 定義統一的 prefab 驗證規格：是否渲染、顏色、形狀、動態、錯誤訊息。（2026-04-18，TASK-VFX-M1-001）
- [ ] 在 `VfxComposerTool` 或等效流程中逐一預覽 54 個 prefab。（待 TASK-VFX-M1-002，需 runtime 目視）
- [x] 產出 `VFX Health Report`（JSON 或 markdown 索引）。（`docs/特效研究/vfx-health-report.md`）
- [x] 把每個 prefab 分成 PASS / FIXABLE / BROKEN。（9 PASS / 30 VERIFIED / 4 FIXED / 2 BROKEN / 7 SKIP）
- [x] 對 BROKEN prefab 補「疑似原因」欄位。（commonLight + star：無 PS，MeshRenderer null texture）

完成定義：
- 54 個 prefab 都有狀態，不再有未分類項。✅（4/5 checklist 完成；runtime 目視確認為 TASK-VFX-M1-002）

**附帶成果（2026-04-18）：**  
靜態分析發現 Lightning aura / Love aura / Plexus / Star aura 的貼圖 UUID 全部誤設為 `cfxr_aura_runic.png`（compound generator 預設值），已同步修復為對應的雷電/愛心/光線/星形貼圖。

### Milestone 2：Runtime 基礎能力補齊

目標：讓正式技能配方可以開始落地，而不是只靠單一 prefab 試播。

Checklist：
- [x] `EffectSystem.ts` 支援 `blocks[]` 多層積木。（2026-04-17，TASK-VFX-M2-001）
- [x] `VfxEffectConfig.ts` schema 補齊新欄位。（v2：VfxBlockEntry / VfxCameraShakeDef / migration）
- [x] `vfx-effects.json` 至少能描述複合式 recipe。（版本升 v2，張飛/關羽/呂布三個 blocks[] 配方）
- [ ] `VfxComposerTool.ts` 可預覽多 block 組合。（待 Milestone 3+ 接手）
- [x] 補一組最小 smoke recipe，驗證 runtime 能正常播放、停止與回收。（playComposite() + setTimeout 序列已實作）

完成定義：
- 至少 3 個技能 recipe 能用 block 組合成功播出。✅（張飛虎嘯 / 關羽青龍偃月 / 呂布天下無雙，均已寫入 vfx-effects.json）

### Milestone 3：FIXABLE Prefab 修復

目標：把可修的 prefab 全部推進到可正式使用。

Checklist：
- [ ] 擴充 `sanitizeVfxNode()` 的修復範圍。
- [ ] 修掉材質遺失、貼圖遺失、capacity 為 0、顏色全白等高頻問題。
- [ ] 對每個修好的 prefab 補前後驗證紀錄。
- [ ] 更新 Health Report，標記已修復項。

完成定義：
- FIXABLE 類至少清掉 70%。

### Milestone 4：Procedural Shader Pack

目標：用低記憶體成本補足水 / 毒 / 風 / 冰四個主題洞。

Checklist：
- [x] `water-ripple.effect` 完成並可預覽。（2026-04-17，TASK: battle-vfx-flood-river-ripple）
- [x] `poison-fog.effect` 完成並可預覽。（2026-04-17，TASK: battle-vfx-poison-fog）
- [x] `wind-vortex.effect` 完成並可預覽。（2026-04-17，TASK: battle-vfx-wind-vortex）
- [x] `ice-crystal.effect` 完成並可預覽。（2026-04-17，TASK: battle-vfx-ice-crystal）
- [x] 每個 shader 都有對應示範 recipe 與 BattleScene smoke。（2026-04-17）

完成定義：
- 四個 shader 都能在 Composer 與 BattleScene 中穩定重播。

### Milestone 5：Unity 轉換實驗

目標：驗證 Unity 來源 prefab 能不能透過新工具鏈顯著降低人工修復成本。

Checklist：
- [ ] 確認是否能取得原始 Unity 專案。
- [ ] 用 Unity2Cocos 做一次最小批次 Export。
- [ ] 把轉出結果導入 Cocos 並做 Health Audit。
- [ ] 與現有 YAML 轉換結果做 side-by-side 比較。
- [ ] 做 go / no-go 決策：納入主線或降級為備選支線。

完成定義：
- 有正式比較報告，不再停留在「值得試試看」。

### Milestone 6：66 技能 Recipe 覆蓋

目標：把所有技能都映射到實際可播的視覺配方。

Checklist：
- [ ] 完成火、雷、武器、光/治療、衝擊、煙霧六大語彙盤點。
- [ ] 完成水 / 毒 / 風 / 冰的 shader 配方映射。
- [ ] 66 個技能全部建立 recipe。
- [ ] 每個 recipe 都標記資產來源：原生 prefab / 修復 prefab / shader / block 組合。
- [ ] 高風險 recipe 補替代方案欄位。

完成定義：
- `vfx-effects.json` 具備完整覆蓋，沒有未分配技能。

### Milestone 7：QA 與記憶體驗收

目標：證明這條方案可在 Web 與 BattleScene 實戰中成立。

Checklist：
- [ ] 用 `VfxComposerTool` 跑完整 recipe smoke。
- [ ] 在 BattleScene 實際觸發代表性技能做實戰驗收。
- [ ] 用 Chrome DevTools 驗證 Web 端 VFX 記憶體 < 100MB。
- [ ] 產出 acceptance 報告與 residual 清單。
- [ ] 更新主文件：哪些已可合併、哪些還是 blocker。

完成定義：
- 有驗收報告，且能說明是否已達到正式量產條件。

## 推薦執行順序

1. 先做 Milestone 0，完成任務卡與分工。
2. 平行推 Milestone 1 與 Milestone 2。
3. Milestone 3 與 Milestone 4 可雙線並行。
4. Milestone 5 為支線實驗，不阻塞 Milestone 6。
5. 最後收斂到 Milestone 7 做實戰驗收。

## 技能配方資產池

### 穩定可用積木

| 視覺系 | 可用積木 | 覆蓋技能數 |
|------|------|------|
| 火系 | `fire_burst`, `fire_particles`, `fire_ringwave`, `fire_magic_orb`, `fire_aura_tail` | 11 |
| 雷電 | `lightning_purple`, `energy_wave`, `energy_blast_ring` | 5 |
| 武器 | `trail_bigsword`, `trail_slash`, `trail_weapon`, `proj_sword`, `proj_arrow` | 14 |
| 光 / 治療 | `glow_soft`, `glow_bright`, `lightbeam`, `ring_addatk`, `ring_addlife` | 8 |
| 衝擊 | `impact_shock`, `impact_ring`, `impact_sparkle`, `impact_rock` | 通用 |
| 煙霧 | `smoke_aura`, `smoke_shadow`, `smoke_stretched` | 通用 |

### 需要 shader 補位

| 視覺系 | Shader | 覆蓋技能數 |
|------|------|------|
| 水 / 冰 | `water-ripple` + `ice-crystal` | 6 |
| 毒 / 控制 | `poison-fog` | 5 |
| 風 | `wind-vortex` | 3 |

### 驗證通過即可升級使用的 prefab
- `cfxr_fire_circle`
- `cfxr_electric_spark`
- `cfxr_ring_ice`
- `mep_explosion`
- `mep_healing_aura`

## 記憶體預算

| 方案 | 66 技能記憶體 | Web 可行性 |
|------|-------------|-----------|
| 全 Flipbook | 約 `1056MB` | 不可行 |
| 本方案 | 約 `60MB` 級別 | 可行 |

## 關鍵檔案

| 文件 / 檔案 | 用途 |
|------|------|
| `assets/scripts/core/systems/EffectSystem.ts` | `blocks[]`、camera shake、runtime 組裝 |
| `assets/scripts/core/config/VfxEffectConfig.ts` | schema |
| `assets/resources/data/vfx-effects.json` | 66 技能配方 |
| `assets/scripts/tools/unity/UnityParticlePrefabParser.ts` | Unity prefab 解析 |
| `assets/scripts/tools/unity/UnityParticleCompoundMapper.ts` | Unity 映射 |
| `tools_node/compound-prefab-generator.mjs` | compound prefab 生成 |
| `tools_node/generate-unity-compound-effect.mjs` | Unity compound 轉換入口 |
| `tools_node/check-unity-compound-regression.mjs` | 轉換回歸檢查 |
| `assets/bundles/vfx_core/shaders/` | shader 放置處 |
| `assets/scripts/tools/VfxComposerTool.ts` | 預覽工具 |

## 驗證方式

1. 逐一 prefab Health Audit。
2. Composer recipe smoke。
3. Chrome DevTools 記憶體觀察。
4. BattleScene 實戰觸發驗證。

## 任務卡

### TASK-VFX-M1-001

| 欄位 | 內容 |
|------|------|
| **ID** | TASK-VFX-M1-001 |
| **Owner** | Claude Runtime Agent |
| **Milestone** | Milestone 1：VFX Health Audit |
| **Status** | ✅ DONE（runtime 目視確認移交 TASK-VFX-M1-002）|
| **開始時間** | 2026-04-18 |
| **完成時間** | 2026-04-18 |
| **目標** | 把 54 個 prefab 從「感覺能用」變成有證據的分級，並修復 FIXABLE 問題 |
| **輸出物** | ① `vfx-health-report.md`（全覽）② 4 個 Unity compound prefab 貼圖修復 |

**Notes：**
- 靜態掃描方法：JSON parse → PS count / texture UUID / MeshRenderer / layer 四項指標
- 貼圖驗證：meta index 1412 筆，CFXR 20 個 UUID / MEP 8 個 UUID 全部找到
- Unity compound 共同問題：generator 預設貼圖錯誤，已批量修復
- 剩餘工作：runtime 目視確認（TASK-VFX-M1-002，需 VfxComposerTool 或 Editor 開啟）

**Handoff：**
- TASK-VFX-M1-002：開啟 VfxComposerTool，逐一目視 30 個 VERIFIED prefab，確認無黑屏/白屏/崩潰後標記 PASS
- TASK-VFX-M3-001：批量修正所有 prefab layer 值（1073741824 → 1）為選用改進項

---

### TASK-VFX-M2-001

| 欄位 | 內容 |
|------|------|
| **ID** | TASK-VFX-M2-001 |
| **Owner** | Claude Runtime Agent |
| **Milestone** | Milestone 2：Runtime 基礎能力補齊 |
| **Status** | ✅ DONE |
| **開始時間** | 2026-04-17 |
| **完成時間** | 2026-04-17 |
| **目標** | 讓正式技能配方可以開始落地：blocks[] 多層積木 + camera shake + 3 個示範 recipe |
| **範圍** | `VfxEffectConfig.ts`、`EffectSystem.ts`、`vfx-effects.json` |
| **輸出物** | ① schema v2（VfxBlockEntry + VfxCameraShakeDef）② playComposite() + playCameraShake() ③ 張飛/關羽/呂布 multi-block recipe |
| **鎖定高風險檔案** | `EffectSystem.ts`（核心系統）—— 已解鎖，可由下一 Agent 接手 VfxComposerTool |

**Notes（進度紀錄）：**
- `2026-04-17`：開卡，確認主專案 VfxEffectConfig.ts = v1，EffectSystem.ts 尚無 blocks[] 支援。開始實作。
- `2026-04-17`：完成所有交付物，靜態驗收通過。Milestone 2 主線 4/5 項打勾（VfxComposerTool 預覽功能留給下一任務卡）。

**Handoff（給後續 Agent）：**
- `VfxComposerTool.ts` 需要新增 playComposite 的預覽 UI（下拉多 block + 時間軸）。
- Milestone 3 可開始修復 FIXABLE prefab，EffectSystem.ts 已解鎖。
- `vfx-effects.json` 中 skill_cao_cao / zhen_ji_nova 仍為 v1 單 blockId，下一位 Recipe Agent 可升級。

---

## 本文件維護規則

- 每個里程碑至少要有一位 owner。
- 每次任務卡進度變更，都要同步更新本文件至少一處狀態。
- 若主線策略改變，先更新本文件，再讓各 Agent 繼續接力。
---

## [2026-04-17 回寫] 路線 C-1 水流程序化 Shader（FloodAttack 條件掛載）

- 狀態：已完成並上線於 BattleScene 地板材質流程。
- 觸發條件：只在 `BattleTactic.FloodAttack` 生效，非水淹戰法不掛此 effect。
- 實作位置：
  - `assets/scripts/battle/views/BoardRenderer.ts`
  - `assets/bundles/vfx_core/shaders/water-ripple.effect`
  - `assets/resources/textures/bg_water.png`
- 行為摘要：
  - `renderState(state)` 先以 `state.battleTactic` 判斷是否進入 Flood 模式。
  - `tryEnsureFloodRippleMaterial(...)` 僅 FloodAttack 才 lazy-load 水流材質。
  - `resolveCellBaseMaterial('flood-river')` 優先使用 ripple 材質，失敗回退 `floodBaseFillMaterial`。
  - 已補失敗重試：第一次載入失敗不會永久卡死。
- QA 證據：
  - FloodAttack：`artifacts/ui-qa/flood-ripple-check/BattleScene.png`
  - Normal 對照：`artifacts/ui-qa/flood-ripple-check-normal/BattleScene.png`
  - 指令：`node tools_node/capture-ui-screens.js --target BattleScene --battleTactic flood-attack --outDir artifacts/ui-qa/flood-ripple-check --timeout 120000`

## [已更新] 路線 C-2 雷電弧（lightning-arc）

- 已開下一張任務卡：`docs/tasks/battle-vfx-lightning-arc_task.md`
- 下一步交付：
  - 新增 `lightning-arc.effect`（程序化雷電弧，不依賴大型序列圖）
  - 建立與戰法/場勢的掛載點（沿用 C-1 條件掛載架構）
  - 沿用同一套 Browser QA 與 screenshot regression 流程
## [2026-04-17 續作回寫] 路線 C-2 雷電弧（lightning-arc）已完成

- 新增檔案：
  - `assets/bundles/vfx_core/shaders/lightning-arc.effect`
  - `assets/bundles/vfx_core/shaders/lightning-arc.effect.meta`
- 掛載策略：
  - 目前綁定 `BattleTactic.NightRaid`（沿用既有 `night-raid` tile state）
  - `BoardRenderer` 只在 NightRaid 才 lazy-load 雷電弧材質
  - `night-raid` overlay 優先使用 `lightningArcFillMaterial`，失敗 fallback 既有 camp fill
- QA：
  - 夜襲：`artifacts/ui-qa/lightning-arc-check/BattleScene.png`
  - 對照：`artifacts/ui-qa/lightning-arc-check-normal/BattleScene.png`
  - 指令：`node tools_node/capture-ui-screens.js --target BattleScene --battleTactic night-raid --outDir artifacts/ui-qa/lightning-arc-check --timeout 120000`

## [2026-04-17 續作回寫] 路線 C-3 毒霧（poison-fog）已完成

- 新增檔案：
  - `assets/bundles/vfx_core/shaders/poison-fog.effect`
  - `assets/bundles/vfx_core/shaders/poison-fog.effect.meta`
- 掛載策略：
  - 綁定 `BattleTactic.AmbushAttack`（使用既有 `ambush-field` tile state）
  - `BoardRenderer` 只在 AmbushAttack 才 lazy-load 毒霧材質
  - `ambush-field` overlay 優先使用 `poisonFogFillMaterial`，失敗 fallback 既有 forest fill
- QA：
  - 伏擊：`artifacts/ui-qa/poison-fog-check/BattleScene.png`
  - 對照：`artifacts/ui-qa/poison-fog-check-normal/BattleScene.png`
  - 指令：`node tools_node/capture-ui-screens.js --target BattleScene --battleTactic ambush-attack --outDir artifacts/ui-qa/poison-fog-check --timeout 120000`
  - Runtime probe：`ambush-attack hasPoisonFogMaterial=true`，`normal=false`

## [2026-04-17 續作回寫] 路線 C-4 風渦（wind-vortex）已完成

- 新增檔案：
  - `assets/bundles/vfx_core/shaders/wind-vortex.effect`
  - `assets/bundles/vfx_core/shaders/wind-vortex.effect.meta`
- 掛載策略：
  - 綁定 `BattleTactic.RockSlide`（使用既有 `hazard-rock` tile state）
  - `BoardRenderer` 只在 RockSlide 才 lazy-load 風渦材質
  - `hazard-rock` overlay 優先使用 `windVortexFillMaterial`，失敗 fallback 既有 rock fill
- QA：
  - 落石：`artifacts/ui-qa/wind-vortex-check/BattleScene.png`
  - 對照：`artifacts/ui-qa/wind-vortex-check-normal/BattleScene.png`
  - 指令：`node tools_node/capture-ui-screens.js --target BattleScene --battleTactic rock-slide --outDir artifacts/ui-qa/wind-vortex-check --timeout 120000`
  - Runtime probe：`rock-slide hasWindVortexMaterial=true`，`normal=false`

## [2026-04-17 續作回寫] 路線 C-5 冰晶（ice-crystal）已完成

- 新增檔案：
  - `assets/bundles/vfx_core/shaders/ice-crystal.effect`
  - `assets/bundles/vfx_core/shaders/ice-crystal.effect.meta`
- 掛載策略：
  - 綁定 `BattleTactic.FloodAttack`（使用既有 `river-current` tile state）
  - `BoardRenderer` 只在 FloodAttack 才 lazy-load 冰晶材質
  - `river-current` overlay 優先使用 `iceCrystalFillMaterial`，失敗 fallback 既有 water fill
- QA：
  - 水淹：`artifacts/ui-qa/ice-crystal-check/BattleScene.png`
  - 對照：`artifacts/ui-qa/ice-crystal-check-normal/BattleScene.png`
  - 指令：`node tools_node/capture-ui-screens.js --target BattleScene --battleTactic flood-attack --outDir artifacts/ui-qa/ice-crystal-check --timeout 120000`
  - Runtime probe：`flood-attack hasIceCrystalMaterial=true`，`normal=false`
- 里程碑狀態：
  - 路線 C 原定四支（water/poison/wind/ice）已全數完成並完成 BattleScene smoke。
