/**
 * VFX 積木使用宣告表 (VFX Usage Table)
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║        等同 Unity Addressables 的「資源引用表 / Group 清單」       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * 【核心概念】
 *   此表是整個 VFX 積木系統的「需求說明書」：
 *   - 每個 effectId（技能/效果 ID）宣告它用了哪些積木 blockId。
 *   - 載入一個效果前先查此表，只預載需要的 Texture2D，不浪費記憶體。
 *   - build-time 稽核：任何積木若不在表中，代表沒人用它 → 可以從 bundle 資料夾移除。
 *
 * 【使用方法】
 *   // 1. 載入前查詢所需積木
 *   const blocks = getBlocksForEffect("skill_fireball");
 *   for (const b of blocks) {
 *       bundle.load(b.texPath, Texture2D, cb);
 *   }
 *
 *   // 2. 找出潛在死資源（build-time audit）
 *   const unused = findUnusedBlocks();
 *   console.log("可以移除的積木：", unused.map(b => b.texPath));
 *
 *   // 3. 動態擴充（VfxComposerTool 等工具才用，正式遊戲直接改常量表）
 *   declareEffect("skill_custom", ["glow_soft", "fire_burst"]);
 *
 * 【Unity 對照】
 *   effectId               ≈ Addressables Address（如 "Skills/FireballHit"）
 *   getBlocksForEffect()   ≈ Addressables.LoadAssetsAsync<Texture2D>(addresses, cb)
 *   getAllDeclaredBlockIds()≈ AddressableAssetSettings → 列出所有 Group 的 Address 清單
 *   findUnusedBlocks()     ≈ Addressables Analyze → Find Unreferenced Assets
 *   declareEffect()        ≈ 在 AddressableAssetSettings 中手動新增 Group Entry（執行期）
 */

import { VFX_BLOCK_REGISTRY, VfxBlockDef } from "./vfx-block-registry";

// ─── 使用宣告表（effectId → blockId[]）────────────────────────────────────────
//
// 維護規則：
//   ✅ 任何技能、Buff、場景觸發器要使用 VFX 積木，必須在此登錄。
//   ✅ 積木 ID 必須與 VFX_BLOCK_REGISTRY 中的 id 欄位完全吻合。
//   ❌ 不在此表中的積木，視為「已宣告但未使用」，打包時應從 vfx_core bundle 移除。
//
const VFX_EFFECT_TABLE: Record<string, string[]> = {

    // ─── 除錯 / 組合器工具（VfxComposerTool 使用，正式打包前可移除）──────────
    "debug_all_glow":       ["glow_soft", "glow_bright", "ray_straight", "lightbeam", "glow_circle"],
    "debug_all_fire":       ["fire_glow_half", "fire_particles", "fire_aura_tail", "fire_burst",
                             "fire_magic_orb", "fire_wavering", "fire_ringwave"],
    "debug_all_lightning":  ["lightning_purple", "energy_wave", "energy_blast"],
    "debug_all_trails":     ["trail_bigsword1", "trail_bigsword2", "trail_slash_c", "trail_slash_w",
                             "trail_slash_s", "trail_dao", "trail_split", "trail_sphere"],
    "debug_all_impact":     ["impact_shock", "impact_ring", "impact_flying", "impact_rock", "impact_sparkle"],
    "debug_all_smoke":      ["smoke_aura", "smoke_shadow", "smoke_stretched"],
    "debug_all_projectile": ["proj_sword01", "proj_sword03", "proj_arrow", "proj_warn_line",
                             "proj_bat", "proj_magic_circ"],
    "debug_all_status":     ["ring_addatk", "ring_addlife", "icon_addatk", "icon_addlife"],

    // ─── 戰鬥技能（正式版本在此填入，格式範例如下）────────────────────────────
    //
    // "skill_fireball": [
    //     "fire_magic_orb",    // 飛行中的火球主體
    //     "fire_burst",        // 命中爆炸
    //     "impact_ring",       // 命中衝擊環
    //     "glow_bright",       // 命中閃光
    // ],
    //
    // "skill_lightning": [
    //     "lightning_purple",  // 閃電動畫
    //     "energy_blast",      // 爆炸環
    //     "impact_shock",      // 衝擊
    // ],
    //
    // "buff_add_atk": [
    //     "ring_addatk",       // 法陣
    //     "icon_addatk",       // 圖示
    //     "glow_soft",         // 底層光暈
    // ],
    //
    // "buff_heal": [
    //     "ring_addlife",      // 治癒法陣
    //     "icon_addlife",      // 心型圖示
    // ],
};

// ─── 公開 API ─────────────────────────────────────────────────────────────────

/**
 * 取得指定 effectId 使用的所有 VfxBlockDef 定義清單（已解析，可直接用於 bundle.load）。
 * 若 effectId 未在表中，回傳空陣列並輸出 warning 提醒補登錄。
 *
 * @param effectId  技能/效果唯一識別（與戰鬥資料 JSON 中的 id 對應）
 */
export function getBlocksForEffect(effectId: string): VfxBlockDef[] {
    const ids = VFX_EFFECT_TABLE[effectId];
    if (!ids) {
        console.warn(`[VfxUsageTable] effectId 未登錄: "${effectId}"，請在 vfx-usage-table.ts 的 VFX_EFFECT_TABLE 中補充宣告`);
        return [];
    }

    return ids.reduce<VfxBlockDef[]>((acc, id) => {
        const block = VFX_BLOCK_REGISTRY.find(b => b.id === id);
        if (!block) {
            console.warn(`[VfxUsageTable] blockId "${id}" 在 VFX_BLOCK_REGISTRY 中找不到，請確認 ID 是否正確`);
        } else {
            acc.push(block);
        }
        return acc;
    }, []);
}

/**
 * 取得所有已在 VFX_EFFECT_TABLE 中被宣告使用過的積木 ID 集合（去重）。
 * Unity 對照：列出 Addressables 所有 Group 的 Address 清單。
 */
export function getAllDeclaredBlockIds(): Set<string> {
    const ids = new Set<string>();
    Object.values(VFX_EFFECT_TABLE).forEach(list => list.forEach(id => ids.add(id)));
    return ids;
}

/**
 * 稽核函式：找出在 VFX_BLOCK_REGISTRY 中有定義，但從未被任何 effectId 引用的積木。
 * 這些積木是潛在的「打包後死資源」，可以考慮從 vfx_core bundle 資料夾移除以縮小包體。
 *
 * Unity 對照：Addressables → Analyze → Find Unreferenced Assets
 *
 * 建議呼叫時機：開發期間偶爾在 console 執行，或整合到 CI build 檢查腳本。
 *
 * @returns 未被任何效果引用的 VfxBlockDef 陣列
 */
export function findUnusedBlocks(): VfxBlockDef[] {
    const declared = getAllDeclaredBlockIds();
    const unused = VFX_BLOCK_REGISTRY.filter(b => !declared.has(b.id));

    if (unused.length > 0) {
        console.warn(
            `[VfxUsageTable] 以下 ${unused.length} 個積木未被任何 effect 引用，` +
            `若確認不用可從 vfx_core bundle 移除：\n` +
            unused.map(b => `  - ${b.id}  (${b.texPath})`).join('\n')
        );
    } else {
        console.log('[VfxUsageTable] ✅ 所有積木都已被至少一個 effect 引用');
    }

    return unused;
}

/**
 * 取得指定 effectId 是否已登錄。
 * 可在技能載入前做快速檢查，避免 runtime 警告。
 */
export function hasEffect(effectId: string): boolean {
    return Object.prototype.hasOwnProperty.call(VFX_EFFECT_TABLE, effectId);
}

/**
 * 在執行期動態新增或覆蓋一個 effectId 的積木宣告。
 * 主要供 VfxComposerTool 等工具在 Play Mode 中建立自訂組合使用。
 * 正式遊戲技能邏輯應直接修改上方的 VFX_EFFECT_TABLE 常量表。
 *
 * @param effectId  宣告的效果 ID
 * @param blockIds  使用的積木 ID 陣列
 */
export function declareEffect(effectId: string, blockIds: string[]): void {
    (VFX_EFFECT_TABLE as Record<string, string[]>)[effectId] = [...blockIds];
}
