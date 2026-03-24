# VFX Core — 特效積木庫 (Effect Building Blocks)

> **來源**: 3DEffectController 專案 → 拆解為可共用積木
> **最後更新**: 2026-03-18
> **總計**: 47 張貼圖 + 3 Shader + 4 Mesh + 2 Animation

---

## 核心理念

所有從外部專案搬入的技能特效素材，統一拆解為**最小可共用單位（積木）**，依視覺功能分類歸檔。
未來組合新技能時，只需從各分類中挑選積木，透過 `EffectSystem` / `BuffGainEffectPool` 等引擎組件組裝即可。

> **Unity 對照**：這就像在 Unity 中把所有 Particle Sub-emitter 用到的 Texture Sheet、Mesh 與 Shader 獨立管理，
> 而非每個技能 Prefab 都內嵌一份重複資源。以 Addressable Group 分類，Runtime 時按名稱載入組合。

---

## 積木分類與清單

### 🔆 1. 發光/光線 (Glow & Light) — `textures/glow/`
用途：光環、光柱、光線掃描、聚焦發光。可用於技能蓄力、觸發瞬間閃光、Buff 光環底層。

| 積木名稱 | 檔案 | 視覺描述 | 可組合用途 |
|----------|------|---------|-----------|
| 柔光圓 | `tex_glow_soft.png` | 柔和的圓形發光 | Buff 底光、蓄力光暈 |
| 強光圓 | `tex_glow_bright.png` | 高對比圓形發光 | 爆擊閃光、技能觸發高光 |
| 直線光線 | `tex_ray_straight.png` | 筆直的光線條 | 光柱、天降神光 |
| 衰減光柱 | `tex_lightbeam_falloff.png` | 頂亮底暗的光柱 | 治癒光柱、召喚柱 |
| 銳利圓光 | `tex_glow_circle_sharp.png` | 邊緣銳利的環形光 | 選中標記、法陣外圈 |

### 🔥 2. 火焰/爆燃 (Fire & Flame) — `textures/fire/`
用途：火焰粒子、火球表面、火環爆發。武將技能「烈焰封鎖」等火系技能的核心積木。

| 積木名稱 | 檔案 | 視覺描述 | 可組合用途 |
|----------|------|---------|-----------|
| 火焰光暈半球 | `tex_fire_glow_half.png` | 半球型火焰光暈 | 火球核心、爆炸中心光 |
| 火焰粒子表 | `tex_fire_particles_sheet4.png` | 4 格動畫序列幀 | 火焰粒子系統 (flipbook) |
| 光環尾焰 | `tex_fire_aura_tail.png` | 彎曲的尾焰圖 | 角色身體光環、旋轉火圈 |
| 瞬間爆發 | `tex_fire_burst.png` | 爆破閃光 | 技能爆炸瞬間 |
| 火焰魔球 | `tex_fire_magic_orb.png` | 球形火焰紋理 | 飛彈表面、蓄力球 |
| 藍焰波動 | `tex_fire_wavering_blue.png` | 藍色火焰波動 | 冰火混合技、幽靈火 |
| 火環波 | `tex_fire_ringwave.png` | 環狀擴散波 | 地面衝擊波、爆炸擴散環 |

### ⚡ 3. 閃電/能量 (Lightning & Energy) — `textures/lightning/`
用途：閃電鏈、能量爆發環。雷系技能的底圖積木。

| 積木名稱 | 檔案 | 視覺描述 | 可組合用途 |
|----------|------|---------|-----------|
| 紫電動畫表 | `tex_lightning_purple_sheet.png` | 紫色閃電序列幀 | 閃電鏈、雷擊粒子 (flipbook) |
| 能量波 | `tex_energy_wave.png` | 橫向擴散的能量波 | 衝擊波、技能釋放波動 |
| 能量爆環 | `tex_energy_blast_ring.png` | 大型爆炸環 | 範圍技地面擴散、Boss 技能 |

### ⚔️ 4. 刀光/武器軌跡 (Weapon Trails) — `textures/trails/`
用途：近戰揮砍的刀光、武器拖尾。攻擊動畫的視覺反饋核心積木。

| 積木名稱 | 檔案 | 視覺描述 | 可組合用途 |
|----------|------|---------|-----------|
| 大劍刀光 A | `tex_trail_bigsword_01.png` | 寬弧形刀光 | 重擊、大範圍斬擊 |
| 大劍刀光 B | `tex_trail_bigsword_02.png` | 窄弧形刀光 | 快速斬擊 |
| 弧線斬 | `tex_trail_slash_curved.png` | 彎曲的斬擊軌跡 | 橫斬、弧線攻擊 |
| 寬幅斬 | `tex_trail_slash_wide.png` | 寬闊的斬擊效果 | 群攻橫掃 |
| 銳利斬 | `tex_trail_slash_sharp.png` | 細窄銳利的斬擊 | 精準一刀、暴擊斬 |
| 武器軌跡 | `tex_trail_weapon_dao.png` | 刀兵器專用拖尾 | 普攻軌跡 |
| 分裂光 | `tex_trail_split.png` | 分裂/散射光線 | 分裂箭、技能分支 |
| 球形擴散 | `tex_trail_sphere.png` | 球狀光擴散 | 能量球爆炸、護盾碎裂 |
| 火焰粒子表2 | `tex_trail_fire_sheet2.png` | 2 格火焰序列幀 | 火焰拖尾 (flipbook) |

### 💥 5. 衝擊/爆炸 (Impact & Explosion) — `textures/impact/`
用途：碰撞瞬間、地面衝擊、岩石碎裂。適用於受擊與技能命中反饋。

| 積木名稱 | 檔案 | 視覺描述 | 可組合用途 |
|----------|------|---------|-----------|
| 尖銳衝擊波 | `tex_impact_sharpshock.png` | 放射狀衝擊紋理 | 落地衝擊、拳擊波 |
| 衝擊環 | `tex_impact_ring.png` | 環狀擴散 | 技能命中環、爆炸環 |
| 飛行軌跡 | `tex_impact_flying.png` | 飛行物拖影 | 投射物尾焰 |
| 岩石碎片 | `tex_impact_rock_01.png` | 碎裂岩石 | 地面破裂、土系技能 |
| 閃耀星光 | `tex_impact_sparkle.png` | 星型亮點 | 暴擊火花、命中閃光 |

### 💨 6. 煙霧/陰影 (Smoke & Shadow) — `textures/smoke/`
用途：出場煙霧、地面陰影、消散效果。

| 積木名稱 | 檔案 | 視覺描述 | 可組合用途 |
|----------|------|---------|-----------|
| 煙霧光環 | `tex_smoke_aura.png` | 柔和的煙霧擴散 | 出場煙、技能蓄力煙 |
| 地面陰影 | `tex_smoke_ground_shadow.png` | 圓形地面投影 | 角色腳底陰影、飛行單位投影 |
| 拉伸煙霧 | `tex_smoke_stretched.png` | 延伸方向的煙跡 | 衝刺殘影、快速移動煙塵 |

### 🎯 7. 投射物 (Projectile) — `textures/projectile/`
用途：遠程攻擊彈體、飛劍、箭矢等飛行物件的表面貼圖。

| 積木名稱 | 檔案 | 視覺描述 | 可組合用途 |
|----------|------|---------|-----------|
| 飛劍 A | `tex_proj_sword_01.png` | 劍形飛行物 | 劍氣技能 |
| 飛劍 B | `tex_proj_sword_03.png` | 另一款劍形飛行物 | 連續劍氣 |
| 箭矢 | `tex_proj_arrow.png` | 箭矢形狀 | 弓箭技能 |
| 警告線 | `tex_proj_warn_line.png` | 瞄準/預警線 | 技能預警、激光瞄準 |
| 蝙蝠 | `tex_proj_bat.png` | 蝙蝠剪影 | 暗黑系飛彈 |
| 魔法陣 | `tex_proj_magic_circle.png` | 圓形魔法陣 | 召喚陣、傳送門 |

### 🌀 8. 狀態特效 (Status Effects) — `textures/rings/`, `textures/icons/`, `textures/shapes/`
用途：已封裝好的 Buff/Debuff 狀態特效積木（由先前首次搬入時已分類）。

| 子分類 | 積木 | 用途 |
|--------|------|------|
| `rings/` | `tex_ring_addatk.png`, `tex_ring_addlife.png` | 法陣底座 |
| `icons/` | `tex_icon_addatk.png`, `tex_icon_addlife.png` | 中心圖示 (劍/心) |
| `shapes/` | `tex_shape_arrow_addatk.png`, `tex_shape_arrow_addlife.png` | 動態箭頭 |

---

## Shader 積木 — `shaders/`

| 積木名稱 | 檔案 | 用途 | 可組合場景 |
|----------|------|------|-----------|
| Glow 發光 | `glow.effect` | 柔和外發光 | Buff 光環、選中高亮 |
| 2D VFX | `2d-vfx.effect` | 2D 特效渲染 | UI 特效、飄字底光 |
| 簡易卡通 | `simple-toon.effect` | 卡通描邊渲染 | 角色外觀、NPC 風格化 |
| 柏林噪聲圖 | `tex_noise_perlin.png` | Shader 輔助 | 溶解效果的噪聲來源 |
| 圓形遮罩 | `tex_shader_circle.png` | Shader 輔助 | 圓形裁切、光圈 |
| 線段遮罩 | `tex_shader_line.png` | Shader 輔助 | 掃描線、充能條 |

## Mesh 積木 — `meshes/`

| 積木名稱 | 檔案 | 用途 |
|----------|------|------|
| 半圓形 | `mesh_halfcircle.FBX` | 衝擊波前半、扇形範圍 |
| 卷軸/旋渦 | `mesh_scroll.FBX` | 旋渦特效、龍捲載體 |
| 條帶 | `mesh_strip.FBX` | 拖尾、軌跡渲染 |
| 箭矢模型 | `mesh_arrow.FBX` | 3D 投射物 |

## Animation 積木 — `animations/`

| 積木名稱 | 檔案 | 用途 |
|----------|------|------|
| 復活動畫 | `anim_revival.anim` | 復活光效序列 |
| 箭矢警告 | `anim_arrow_warning.anim` | 預警箭指示序列 |

---

## 已存在的程式化積木 (Code-based Blocks)

除了素材積木，以下已封裝好的程式模組也是隨時可用的「行為積木」：

| 積木名稱 | 模組 | API | 用途 |
|----------|------|-----|------|
| 受擊泛光 | `MaterialSystem` | `setRim(unitId, r,g,b,a)` | 被擊中瞬間閃白/閃紅 |
| 死亡溶解 | `MaterialSystem` | `setDissolve(unitId, val)` | 死亡化灰退場 |
| 傷害跳字 | `FloatTextSystem` | `showDamage(val, pos, crit)` | 拋物線飄字 |
| 狀態文字 | `FloatTextSystem` | `showStatus(text, pos)` | Buff/Debuff 提示 |
| 粒子播放 | `EffectSystem` | `playEffect(key, pos, dur)` | 通用粒子特效播放+回收 |
| 音效播放 | `AudioSystem` | `playSfx(name, vol)` | 50ms 防重複音效 |
| 狀態特效 | `BuffGainEffectPool` | `play(worldPos)` | 法陣+圖示+箭頭+火花 |

---

## 擴充 SOP (新特效積木的加入流程)

1. **拆解新素材** → 判斷它屬於哪個分類（glow? fire? trails?），若沒有對應分類就新建。
2. **統一命名** → `tex_{分類}_{描述}.png`，例如 `tex_fire_nova.png`。
3. **放入 vfx_core** → 對應的 `textures/{分類}/` 目錄。
4. **如果是 Shader** → 放入 `shaders/`，如果是 Mesh 放 `meshes/`。
5. **更新此 README** → 在對應表格中新增一行。
6. **封裝為行為積木（可選）** → 若需要專屬的播放邏輯，在 `EffectSystem` 或新建 Pool 組件中加入 API。
7. **登錄到 vfx-block-registry** → 在 `assets/scripts/tools/vfx-block-registry.ts` 的 `VFX_BLOCK_REGISTRY` 陣列中新增一條 `VfxBlockDef`，包含 `texPath`、`blendMode`、`audio` 與 `scale`。

---

## 音效對照表 (Audio Mapping)

> 完整的積木-音效映射定義於 `assets/scripts/tools/vfx-block-registry.ts` 的 `VFX_BLOCK_REGISTRY`（每個 `VfxBlockDef` 含 `audio?: string` 欄位）。

| 音效 clip 名稱 | 對應積木分類 | 典型使用場景 |
|---------------|-------------|------------|
| `light`       | glow (柔光圓、強光圓、衰減光柱) | 光環觸發、蓄力、Buff 閃光 |
| `laser`       | glow (直線光) | 光柱、激光掃射 |
| `fireball`    | fire (光暈、粒子、尾焰、魔球) | 火球飛行、火焰噴發 |
| `boom`        | fire (爆發)、lightning (爆環)、impact (衝擊/環) | 爆炸、重擊落地 |
| `wave`        | fire (藍焰波動/火環波)、lightning (能量波) | 範圍波浪擴散 |
| `thunder`     | lightning (紫電動畫) | 閃電劈下 |
| `weapon`      | trails (大劍/弧線/寬幅/銳利/武器軌跡)、proj (箭矢) | 揮砍、箭矢射出 |
| `skill1`      | trails (分裂光) | 技能 1 爆發 |
| `skill2`      | trails (球形擴散) | 技能 2 爆發 |
| `feijian`     | projectile (飛劍 A/B)、impact (飛行軌跡) | 飛劍投射 |
| `bat`         | projectile (蝙蝠) | 蝙蝠飛行 |
| `skill0`      | projectile (魔法陣) | 魔法陣召喚 |
| `buff`        | status (攻擊法陣) | 增益施加 |
| `heal`        | status (治癒法陣) | 回血觸發 |
| `hurt`        | impact (閃耀星光) | 被擊中反應 |
| `smoke/*`     | ─ (無對應音效) | 煙霧類通常靜音或搭配 boom |

---

## VfxComposerTool — 遊戲內視覺積木組合器

> 檔案：`assets/scripts/tools/VfxComposerTool.ts`

一個可在 Play Mode 中即時預覽特效積木疊加效果的 debug 工具。
**Unity 對照**：類似 Unity 的 Timeline Preview + Effect Inspector 合體版，在執行模式中以積木拼接的方式測試特效組合。

### 使用步驟

1. 將 `VfxComposerTool` Component 加入任一場景節點（建議直接加在 Canvas 下的子節點）。
2. 執行遊戲後，畫面**右側會出現 `🎨 VFX` 小按鈕**。
3. 點擊按鈕展開面板：
   - 上方 8 個分類頁籤切換積木種類。
   - 點選積木名稱加入「組合」清單（最多 6 個）。
   - **▶ 播放**：在世界座標 `(0, 0.6, 0)` 以平放 Quad，用 `builtin-unlit` 加算/透明混合模式渲染貼圖，持續 5 秒後自動清除。
   - **🔊 音效**：獨立播放組合中所有積木對應的音效（自動去重，先查 AudioSystem clipCache，若不存在則從 audio bundle 動態載入）。
   - **✕ 清空**：清除組合清單與場景中所有預覽 Quad。

### 預覽座標調整

若需要將預覽 Quad 移動到其他位置，修改 `VfxComposerTool.ts` 頂部的常數：

```typescript
const PREVIEW_POS = new Vec3(0, 0.6, 0);  // 自訂世界空間的預覽位置
const PREVIEW_DURATION = 5;               // 自動清除秒數
```
