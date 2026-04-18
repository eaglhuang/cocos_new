# VFX Prefab Health Report

> **產出時間：** 2026-04-18  
> **負責人：** Claude Runtime Agent（TASK-VFX-M1-001）  
> **掃描範圍：** `assets/bundles/vfx_core/prefabs/`（54 個目錄，59 個 .prefab 檔案）  
> **方法：** 靜態 JSON 分析 + texture UUID meta 檔案查找驗證

---

## 摘要統計

| 分類 | 目錄數 | 說明 |
|------|--------|------|
| ✅ PASS | 9 | Cocos 原生戰鬥特效，結構健全 |
| 🔵 VERIFIED | 30 | 貼圖 UUID 全部驗證成功（CFXR×21 + MEP×9），Layer 由 sanitizeVfxNode() 自動修正 |
| 🟡 FIXABLE | 4 | Unity compound 來源，貼圖 UUID 全部指向同一錯誤貼圖（cfxr_aura_runic.png），需更換 |
| 🔴 BROKEN | 2 | 無 ParticleSystem，MeshRenderer 貼圖為 null |
| ⚪ TEST_ONLY | 1 | Unity 轉換測試樣本，不進入正式用途 |
| ⏭ SKIP | 7 | 非技能 VFX（UI / gameplay 特效），不在 66 技能配方範圍 |
| ➖ N/A | 1 | 共享貼圖庫目錄，無 prefab |
| **合計** | **54** | |

---

## 通用問題說明

**Layer = 1073741824（UI_2D）**  
ALL 59 個 prefab 的根節點及子節點 `_layer` 都是 `1073741824`（`cc.Layers.Enum.UI_2D = 1<<30`）。  
此問題**已由 `sanitizeVfxNode()` 自動修正**（強制設為 DEFAULT = `1<<0`），不影響戰鬥播放。  
Milestone 3 可考慮批量修正 prefab 本體（選用，非必要）。

---

## ✅ PASS — 立刻可用（9 個）

| 目錄 | Prefab | PS 數 | 備注 |
|------|--------|--------|------|
| Buff | Buff.prefab | 4 | 手工建立，多層粒子，穩定 |
| Debuff | Debuff.prefab | 4 | 手工建立，多層粒子，穩定 |
| Healing | Healing.prefab | 3 | 手工建立，治療光效，穩定 |
| bossAnger | bossAnger.prefab | 3 | Boss 憤怒特效，可在技能配方複用 |
| bossAttackSmoke | attckSmoke.prefab | 1 | Boss 攻擊煙霧 |
| fightBoom | fightBoom.prefab | 2 | 戰鬥爆炸，通用衝擊特效 |
| fire | fire01.prefab | 1 | 基礎火焰 |
| hit | hit.prefab（2PS）+ boxHit.prefab（1PS） | 2+1 | 受擊特效，重複使用率高 |
| smokeLight | smokeLight01.prefab | 1 | 輕煙光效 |

---

## 🔵 VERIFIED — 貼圖驗證通過，需 runtime 視覺確認（30 個）

> 所有 UUID 均在 `assets/` meta index 中找到，Layer 問題由 sanitizeVfxNode() runtime 修正。  
> 建議以 VfxComposerTool 逐一目視後標記 PASS。

### CFXR 自動生成（21 個）

| 目錄 | PS 數 | 貼圖來源 |
|------|--------|---------|
| cfxr_aura_rays | 1 | cfxr_aura_rays.png ✓ |
| cfxr_aura_runic | 1 | cfxr_aura_runic.png ✓ |
| cfxr_bubble | 1 | cfxr_bubble.png ✓ |
| cfxr_electric_ring | 1 | cfxr_electric_ring.png ✓ |
| cfxr_electric_spark | 1 | cfxr_electric_spark.png ✓ |
| cfxr_ember | 1 | cfxr_ember.png ✓ |
| cfxr_fire_circle | 1 | cfxr_fire_circle_crisp.png ✓ |
| cfxr_fire_crisp | 1 | cfxr 系貼圖 ✓ |
| cfxr_flare_heal | 1 | cfxr 系貼圖 ✓ |
| cfxr_heart | 1 | cfxr_heart.png ✓ |
| cfxr_hit_red | 1 | cfxr 系貼圖 ✓ |
| cfxr_hit_yellow | 1 | cfxr 系貼圖 ✓ |
| cfxr_ring_ice | 1 | cfxr 系貼圖 ✓ |
| cfxr_runic_aura_compound | 1 | cfxr_aura_runic.png ✓ |
| cfxr_skull | 1 | cfxr 系貼圖 ✓ |
| cfxr_slash_ray | 1 | cfxr 系貼圖 ✓ |
| cfxr_smoke | 1 | cfxr 系貼圖 ✓ |
| cfxr_smoke_white | 1 | cfxr 系貼圖 ✓ |
| cfxr_spikes_impact | 1 | cfxr 系貼圖 ✓ |
| cfxr_star_blurred | 1 | cfxr_star_blurred.png ✓ |
| cfxr_star_gold | 1 | cfxr 系貼圖 ✓ |

### MEP 自動生成（9 個）

| 目錄 | PS 數 | 貼圖來源 |
|------|--------|---------|
| mep_buff_aura | 1 | mep_shape_star.png ✓ |
| mep_charge_slash | 1 | mep 系貼圖 ✓ |
| mep_debuff_aura | 1 | mep 系貼圖 ✓ |
| mep_electro_hit | 1 | mep 系貼圖 ✓ |
| mep_explosion | 1 | mep 系貼圖 ✓ |
| mep_healing_aura | 1 | mep_shape_heart.png ✓ |
| mep_magic_ring | 1 | mep 系貼圖 ✓ |
| mep_sparks_blue | 1 | mep 系貼圖 ✓ |
| mep_sparks_orange | 1 | mep 系貼圖 ✓ |

---

## ✅ FIXED — 貼圖 UUID 已修復（原 FIXABLE，4 個）

> **問題根因：** `compound-prefab-generator.mjs` 預設所有 sub-particle 貼圖為 `cfxr_aura_runic.png`（UUID: `c0a5b0be-e2ca-4d16-ae10-d93e1480449a`），造成視覺表現錯誤（全部顯示同一符文圓環）。  
> **修復方法：** 更換 renderer._mainTexture.__uuid__ 到對應的正確貼圖。

| 目錄 | PS 數 | 原貼圖（錯誤） | 修正後貼圖 | 修正 UUID | 狀態 |
|------|--------|--------------|-----------|-----------|------|
| Lightning aura | 3 | cfxr_aura_runic.png | **ex_thunder_01.png** | `a9a93145-c379-4781-9bcf-e345b9f17852` | ✅ 已修復 |
| Love aura | 3 | cfxr_aura_runic.png | **cfxr_heart.png** | `cd74eaff-4d32-4f70-b6b9-fe4be6fd12e0` | ✅ 已修復 |
| Plexus | 2 | cfxr_aura_runic.png | **cfxr_aura_rays.png** | `04ab4357-97f4-4ed0-b297-eb55142eaef9` | ✅ 已修復 |
| Star aura | 3 | cfxr_aura_runic.png | **cfxr_magic_star.png** | `03b2b64c-d902-4f40-b6a1-85a588759359` | ✅ 已修復 |

---

## 🔴 BROKEN — 結構缺陷，無法用於技能特效（2 個）

| 目錄 | 問題 | 處置建議 |
|------|------|---------|
| commonLight | 無 ParticleSystem，MeshRenderer 貼圖為 null | 不納入技能 VFX 資產庫 |
| star | 無 ParticleSystem，MeshRenderer 貼圖為 null | 不納入技能 VFX 資產庫 |

---

## ⚪ TEST_ONLY（1 個）

| 目錄 | 說明 |
|------|------|
| p3d_unity_sample_auto | Unity 轉換測試樣本，同樣使用 cfxr_aura_runic.png 錯誤貼圖，僅供開發測試 |

---

## ⏭ SKIP — 非技能 VFX，不納入配方（7 個）

| 目錄 | 用途 |
|------|------|
| bubble | 泡泡 gameplay 特效（bubbleG/R/Y） |
| box | 寶箱開啟 / 擊中特效 |
| changeColor | UI 色彩切換動畫 |
| collectColor | 收集物收取特效 |
| colorBar | UI 顏色條 |
| flyFight | 飛行光效（非戰鬥技能） |
| levelUp | 升級特效（有 MeshRenderer null tex，PS 可用，但不屬技能 VFX） |

---

## 下一步行動

| 優先 | 工作 | 任務卡 |
|------|------|--------|
| P1 | 用 VfxComposerTool 逐一目視 VERIFIED 30 個，標記最終 PASS | TASK-VFX-M1-002（待開）|
| P2 | **立即可修**：更換 Lightning aura / Love aura / Plexus / Star aura 貼圖 UUID | TASK-VFX-M3-001 |
| P3 | 批量修正所有 prefab 的 Layer（由 1073741824 改為 1） | 選用，sanitizeVfxNode 已暫代 |
| P4 | 產出 Milestone 3 修復後的更新版 Health Report | TASK-VFX-M3-001 |

---

## 修改記錄

| 日期 | 修改人 | 說明 |
|------|--------|------|
| 2026-04-18 | Claude Runtime Agent | 初版，基於靜態 JSON 分析 + UUID meta 驗證 |
| 2026-04-18 | Claude Runtime Agent | 同步修復 4 個 Unity compound prefab 錯誤貼圖（Lightning aura / Love aura / Plexus / Star aura） |
