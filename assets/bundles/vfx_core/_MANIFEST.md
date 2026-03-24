# VFX Core Bundle — 貼圖素材清單

> **規範版本**：2026-03-18  
> 本清單追蹤 `vfx_core/textures/` 下所有素材的來源、命名與使用狀態。  
> **每次搬入新素材或確認引用時，必須同步更新本清單。**

---

## S-6 Cyberpunk 遷移素材（`ex_` 前綴）

> S-6 任務：將 Cyberpunk Demo 的 18 個風格中性素材搬入本 Bundle，並以 `ex_` 前綴命名。  
> 自動化搬入工具：`tools/sprite-pipeline/import-cyberpunk-vfx.js`

| # | 原始檔名（Cyberpunk） | 目標檔名（`ex_` prefix） | 目標資料夾 | 使用狀態 | 用途 |
|---|---|---|---|---|---|
| 1 | `spark31.png` | `ex_hit_01.png` | `impact/` | ✅ Active | 受擊粒子主貼圖（以 CocosCyberpunk 現有素材映射） |
| 2 | `teleporting_lighting.png` | `ex_thunder_01.png` | `lightning/` | ✅ Active | 電系技能放電粒子（以 CocosCyberpunk 現有素材映射） |
| 3 | `flash11.png` | `ex_hit_flash.png` | `glow/` | ✅ Active | 打擊閃光（以 CocosCyberpunk 現有素材映射） |
| 4 | `laser002.png` | `ex_line_01a.png` | `lightning/` | ✅ Active | 雷擊線條（以 CocosCyberpunk 現有素材映射） |
| 5 | `explode001.png` | `ex_smoke_flipbook_4x4.png` | `smoke/` | ✅ Active | 爆散煙霧/爆裂 Flipbook（以 CocosCyberpunk 現有素材映射） |
| 6 | `AxeParticle001.png` | `ex_pieces_01.png` | `impact/` | ✅ Active | 環境煙塵碎片（以 CocosCyberpunk 現有素材映射） |
| 7 | `teleporting_circle.png` | `ex_energy_ring.png` | `rings/` | ✅ Active | 法陣補強環形光（以 CocosCyberpunk 現有素材映射） |
| 8 | `trail002.png` | `ex_trace_01.png` | `trails/` | ✅ Active | 路徑拖尾條紋（以 CocosCyberpunk 現有素材映射） |
| 9 | 待確認 | `ex_tbd_09.png` | 待確認 | ❓ 未確認 | — |
| 10 | 待確認 | `ex_tbd_10.png` | 待確認 | ❓ 未確認 | — |
| 11 | 待確認 | `ex_tbd_11.png` | 待確認 | ❓ 未確認 | — |
| 12 | 待確認 | `ex_tbd_12.png` | 待確認 | ❓ 未確認 | — |
| 13 | 待確認 | `ex_tbd_13.png` | 待確認 | ❓ 未確認 | — |
| 14 | 待確認 | `ex_tbd_14.png` | 待確認 | ❓ 未確認 | — |
| 15 | 待確認 | `ex_tbd_15.png` | 待確認 | ❓ 未確認 | — |
| 16 | 待確認 | `ex_tbd_16.png` | 待確認 | ❓ 未確認 | — |
| 17 | 待確認 | `ex_tbd_17.png` | 待確認 | ❓ 未確認 | — |
| 18 | 待確認 | `ex_tbd_18.png` | 待確認 | ❓ 未確認 | — |

> **第 9–18 項**：完整素材清單見〈美術素材規劃與使用說明 2〉§4。  
> 確認原始檔名後，請更新本表並補入 `cyberpunk-import.config.json`。

---

## 原生素材（專案自建，無外部來源前綴）

> 所有未帶 `ex_` 前綴的貼圖均為本專案自建，詳見 `README.md`。

| 資料夾 | 貼圖數量 | 說明 |
|--------|---------|------|
| `glow/` | 5 | 發光/光柱/光暈 |
| `fire/` | — | 火焰/火花（見 README.md） |
| `lightning/` | 3 | 電光/能量波 |
| `trails/` | — | 拖尾（見 README.md） |
| `impact/` | 5 | 受擊衝擊/岩石碎片 |
| `smoke/` | 3 | 煙/地面陰影 |
| `projectile/` | — | 拋射物（見 README.md） |
| `rings/` | 2 | 環形光（攻擊/回血） |
| `shapes/` | 2 | 箭頭形狀（攻擊/回血） |

---

## Buff Prefab 規格（2026-03-19）

> Buff 視覺採「2 個 base prefab + 4 個 runtime preset」策略，避免為每種 Buff 各自維護一份 prefab。

### Base Prefab

| Prefab | 用途 | 固定節點規格 |
|---|---|---|
| `assets/resources/fx/buff/buff_gain_3d.prefab` | 增益類 base（AtkGain / HpGain） | `RingRoot` / `IconRoot` / `SparkPS` / `AccentPS` |
| `assets/resources/fx/buff/buff_debuff_3d.prefab` | 減益類 base（AtkLoss / HpLoss） | `RingRoot` / `IconRoot` / `SparkPS` / `AccentPS` |

### Controller

- prefab root 必須掛 `BuffEffectPrefabController`
- controller 職責：
   - 固定節點命名
   - 接手舊版 `Particle-001` 並正規化成 `SparkPS`
   - 若 `AccentPS` 尚無 emitter，從 `SparkPS` 複製一份作為預設備援
   - 停用舊版掛在 prefab root 的 legacy 粒子

### Variant 對應表

| 變體 | Base Prefab | 視覺方向 | Runtime 覆寫重點 |
|---|---|---|---|
| `AtkGain` | `buff_gain_3d.prefab` | 金色、銳利、衝上去 | 粒子較快、burst 較強、上浮較高 |
| `HpGain` | `buff_gain_3d.prefab` | 綠青、柔和、治癒感 | 粒子較多、尺寸較大、漂浮更柔和 |
| `AtkLoss` | `buff_debuff_3d.prefab` | 暗紅褐、乾濁、受抑制 | 粒子較少、速度較慢、濁度較高 |
| `HpLoss` | `buff_debuff_3d.prefab` | 暗赭紅、散霧感、衰弱 | 粒子較散、壽命較長、濁霧更明顯 |

### 維護原則

1. 需要改材質、貼圖、emitter 拓樸時，改 base prefab。
2. 需要改四種 Buff 的數量、顏色、速度、上浮高度、濁度時，優先改 `assets/resources/data/buff-particle-profiles.json`。
3. 不要新增 `buff_atkgain_3d.prefab`、`buff_hpgain_3d.prefab` 這類變體 prefab，除非 base 結構已經無法承載。

### Buff 粒子資料表

- 粒子 preset JSON：`assets/resources/data/buff-particle-profiles.json`
- TypeScript fallback：`assets/scripts/battle/views/effects/BuffParticleProfileConfig.ts`
- 原則：JSON 是主來源，TS fallback 是保底相容層，避免熱更或手動編輯漏欄位時整個 Buff 特效失效。

---

## 狀態說明

| 圖示 | 含義 | 行動 |
|------|------|------|
| ✅ Active | 已被程式碼引用，會被打包進 Bundle | 維持 |
| 🚧 WIP | PNG 已放入，但程式碼尚未接入 | 等待 VFX JSON / EffectSystem 接入後改 Active |
| 📦 Archive | 準備廢棄，移至 `_archive/` | 待確認後整資料夾刪除 |
| ❓ 未確認 | 素材 ID 待從 Cyberpunk Demo 確認 | 找到原始檔名後補入本表 |

---

## 搬入 SOP（S-6 素材遷移標準流程）

1. **取得 PNG**：從 Cyberpunk Demo 匯出，解析度 ≤ 256×256
2. **放入輸入資料夾**：`tools/sprite-pipeline/input/cyberpunk/`（原始檔名，不改名）
3. **執行自動化腳本**：
   ```bash
   node tools/sprite-pipeline/import-cyberpunk-vfx.js
   ```
   腳本會依 `cyberpunk-import.config.json` 的映射表，自動重命名（`ex_` 前綴）並複製到正確子資料夾
4. **Cocos Editor 確認**：重新整理 Asset DB，確認 SpriteFrame 可正常預覽
5. **更新本清單**：狀態改為 🚧 WIP（程式接入後改 ✅ Active）
6. **程式接入**：在對應的 VFX JSON 條目或 EffectSystem block 中引用新 `ex_` 素材

---

## 清理流程

1. 確認未被任何 VFX JSON / 程式碼引用（VS Code 全域搜尋 `ex_` 檔名）
2. 移入 `_archive/[YYYY-MM-DD]-[原檔名]/`
3. 更新本清單狀態為 📦 Archive
4. Sprint Review 時確認可刪除後，整資料夾刪除並從本清單移除
5. **禁止**：只刪貼圖保留 `.meta`（Cocos meta 殘留會汙染 library/）
