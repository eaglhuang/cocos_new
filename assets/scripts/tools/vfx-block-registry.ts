// @spec-source → 見 docs/cross-reference-index.md
/**
 * VFX 積木登錄表 (VFX Block Registry)
 *
 * 每一個 VfxBlockDef 代表一塊「最小視覺積木」，包含：
 *  - 視覺資源路徑（vfx_core bundle 相對路徑）
 *  - 混合模式（加算 / 透明）
 *  - 對應音效（audio bundle clip 名稱）
 *
 * Unity 對照：類似把每一個 Particle System 的 Texture Sheet 與 Shader
 * 獨立成一個 Addressable Group 內的 Asset Reference，Runtime 時按名稱組合。
 */

export interface VfxBlockDef {
    /** 積木唯一識別 ID */
    readonly id: string;
    /** 面板顯示名稱（中文） */
    readonly label: string;
    /** 所屬分類 ID */
    readonly category: string;
    /** 貼圖路徑，相對 vfx_core bundle root，不含副檔名（Quad 預覽用） */
    readonly texPath: string;
    /** 渲染混合模式 */
    readonly blendMode: 'additive' | 'transparent';
    /** 對應音效 clip 名稱（audio bundle），undefined = 無音效 */
    readonly audio?: string;
    /** 世界空間預覽的 scale 係數 */
    readonly scale: number;
    /**
     * 粒子渲染模式：
     *   cpu  = 必須用 CPU 渲染（含 TrailModule / LimitVelocityModule，GPU 不支援）
     *   gpu  = 適合 GPU 渲染（大量大氣粒子、flipbook 序列幀）
     *   auto = 無限制，EffectSystem 可依情境自動選擇
     *
     * Unity 對照：CPU ≈ Built-in Particle System；GPU ≈ VFX Graph
     */
    readonly renderMode: 'cpu' | 'gpu' | 'auto';
    /** GPU 渲染不相容的模組清單（renderMode='cpu' 時填寫原因） */
    readonly gpuIncompatibleModules?: ('trail' | 'limitVelocity')[];
    /**
     * 特效空間：
     *   3d   = 遊戲世界空間（World Space），具備透視縮放、深度感，跟隨 3D 座標
     *   2d   = UI Canvas 層（Screen Space），平面顯示，不受世界座標影響
     *   both = 兩者皆可（純貼圖型特效，可依場景決定使用方式）
     *
     * Unity 對照：3d ≈ World Space Particle；2d ≈ UI Canvas 下的 Particle
     */
    readonly space: '2d' | '3d' | 'both';
    /**
     * 3D 粒子 Prefab 路徑（相對 vfx_core bundle root，不含副檔名）。
     * 設定此欄位後，Particle Prefab 預覽模式會優先從 vfx_core bundle 載入此 prefab。
     * Unity 對照：Addressable Asset Reference 指向一個完整的 ParticleSystem Prefab。
     */
    readonly prefabPath?: string;
}

export const VFX_CATEGORIES: { id: string; label: string }[] = [
    { id: 'glow',       label: '發光'   },
    { id: 'fire',       label: '火焰'   },
    { id: 'lightning',  label: '閃電'   },
    { id: 'trails',     label: '刀光'   },
    { id: 'impact',     label: '衝擊'   },
    { id: 'smoke',      label: '煙霧'   },
    { id: 'projectile', label: '投射物' },
    { id: 'status',     label: '狀態'   },
    { id: 'shapes',     label: '形狀'   },  // MEP: 通用粒子形狀貼圖
    { id: 'rings',      label: '法陣環' },  // MEP: 魔法陣 / 科技環
    { id: 'particle3d', label: '3D粒子' },
];

export const VFX_BLOCK_REGISTRY: VfxBlockDef[] = [

    // ─── 發光/光線 (Glow & Light) ──────────────────────────────────────────
    // 音效映射: 柔光類 → light.mp3, 光線類 → laser.mp3
    { id: 'glow_soft',       label: '柔光圓',   category: 'glow',       texPath: 'textures/glow/tex_glow_soft',                    blendMode: 'additive',    audio: 'light',    scale: 1.5, renderMode: 'auto', space: 'both' },
    { id: 'glow_bright',     label: '強光圓',   category: 'glow',       texPath: 'textures/glow/tex_glow_bright',                  blendMode: 'additive',    audio: 'light',    scale: 1.5, renderMode: 'auto', space: 'both' },
    { id: 'ray_straight',    label: '直線光',   category: 'glow',       texPath: 'textures/glow/tex_ray_straight',                 blendMode: 'additive',    audio: 'laser',    scale: 1.2, renderMode: 'auto', space: '3d'   },
    { id: 'lightbeam',       label: '衰減光柱', category: 'glow',       texPath: 'textures/glow/tex_lightbeam_falloff',            blendMode: 'additive',    audio: 'light',    scale: 2.0, renderMode: 'auto', space: '3d'   },
    { id: 'glow_circle',     label: '銳利圓光', category: 'glow',       texPath: 'textures/glow/tex_glow_circle_sharp',            blendMode: 'additive',    audio: undefined,  scale: 1.5, renderMode: 'auto', space: 'both' },

    // ─── 火焰/爆燃 (Fire & Flame) ──────────────────────────────────────────
    // 音效映射: 火焰系 → fireball.mp3, 爆炸系 → boom.mp3, 波動系 → wave.mp3
    // GPU 標記: fire_particles / fire_wavering 為大量粒子 flipbook，適合 GPU 渲染
    { id: 'fire_glow_half',  label: '火焰光暈', category: 'fire',       texPath: 'textures/fire/tex_fire_glow_half',               blendMode: 'additive',    audio: 'fireball', scale: 1.5, renderMode: 'auto', space: '3d'   },
    { id: 'fire_particles',  label: '火焰粒子', category: 'fire',       texPath: 'textures/fire/tex_fire_particles_sheet4',        blendMode: 'additive',    audio: 'fireball', scale: 1.2, renderMode: 'gpu',  space: '3d'   },
    { id: 'fire_aura_tail',  label: '光環尾焰', category: 'fire',       texPath: 'textures/fire/tex_fire_aura_tail',               blendMode: 'additive',    audio: 'fireball', scale: 1.5, renderMode: 'auto', space: '3d'   },
    { id: 'fire_burst',      label: '瞬間爆發', category: 'fire',       texPath: 'textures/fire/tex_fire_burst',                   blendMode: 'additive',    audio: 'boom',     scale: 2.0, renderMode: 'auto', space: '3d'   },
    { id: 'fire_magic_orb',  label: '火焰魔球', category: 'fire',       texPath: 'textures/fire/tex_fire_magic_orb',               blendMode: 'additive',    audio: 'fireball', scale: 1.0, renderMode: 'auto', space: '3d'   },
    { id: 'fire_wavering',   label: '藍焰波動', category: 'fire',       texPath: 'textures/fire/tex_fire_wavering_blue',           blendMode: 'additive',    audio: 'wave',     scale: 1.5, renderMode: 'gpu',  space: '3d'   },
    { id: 'fire_ringwave',   label: '火環波',   category: 'fire',       texPath: 'textures/fire/tex_fire_ringwave',                blendMode: 'additive',    audio: 'wave',     scale: 2.0, renderMode: 'auto', space: '3d'   },

    // ─── 閃電/能量 (Lightning & Energy) ────────────────────────────────────
    // 音效映射: 閃電 → thunder.mp3, 能量波 → wave.mp3, 爆炸環 → boom.mp3
    // GPU 標記: lightning_purple 為 flipbook 序列幀，大量粒子情境適合 GPU 渲染
    { id: 'lightning_purple',label: '紫電動畫', category: 'lightning',  texPath: 'textures/lightning/tex_lightning_purple_sheet',  blendMode: 'additive',    audio: 'thunder',  scale: 2.0, renderMode: 'gpu',  space: '3d'   },
    { id: 'energy_wave',     label: '能量波',   category: 'lightning',  texPath: 'textures/lightning/tex_energy_wave',             blendMode: 'additive',    audio: 'wave',     scale: 2.5, renderMode: 'auto', space: '3d'   },
    { id: 'energy_blast',    label: '能量爆環', category: 'lightning',  texPath: 'textures/lightning/tex_energy_blast_ring',       blendMode: 'additive',    audio: 'boom',     scale: 3.0, renderMode: 'auto', space: '3d'   },

    // ─── 刀光/武器軌跡 (Weapon Trails) ─────────────────────────────────────
    // 音效映射: 所有斬擊/武器 → weapon.mp3; 分裂/技能 → skill1/skill2.mp3
    // CPU 標記: bigsword/slash/dao 系列用於 TrailModule（刀光拖尾），GPU 不支援 TrailModule
    { id: 'trail_bigsword1', label: '大劍刀光A',category: 'trails',     texPath: 'textures/trails/tex_trail_bigsword_01',          blendMode: 'additive',    audio: 'weapon',   scale: 2.0, renderMode: 'cpu',  gpuIncompatibleModules: ['trail'], space: '3d'   },
    { id: 'trail_bigsword2', label: '大劍刀光B',category: 'trails',     texPath: 'textures/trails/tex_trail_bigsword_02',          blendMode: 'additive',    audio: 'weapon',   scale: 2.0, renderMode: 'cpu',  gpuIncompatibleModules: ['trail'], space: '3d'   },
    { id: 'trail_slash_c',   label: '弧線斬',   category: 'trails',     texPath: 'textures/trails/tex_trail_slash_curved',         blendMode: 'additive',    audio: 'weapon',   scale: 2.0, renderMode: 'cpu',  gpuIncompatibleModules: ['trail'], space: '3d'   },
    { id: 'trail_slash_w',   label: '寬幅橫斬', category: 'trails',     texPath: 'textures/trails/tex_trail_slash_wide',           blendMode: 'additive',    audio: 'weapon',   scale: 2.5, renderMode: 'cpu',  gpuIncompatibleModules: ['trail'], space: '3d'   },
    { id: 'trail_slash_s',   label: '銳利斬',   category: 'trails',     texPath: 'textures/trails/tex_trail_slash_sharp',          blendMode: 'additive',    audio: 'weapon',   scale: 2.0, renderMode: 'cpu',  gpuIncompatibleModules: ['trail'], space: '3d'   },
    { id: 'trail_dao',       label: '武器拖尾', category: 'trails',     texPath: 'textures/trails/tex_trail_weapon_dao',           blendMode: 'additive',    audio: 'weapon',   scale: 1.5, renderMode: 'cpu',  gpuIncompatibleModules: ['trail'], space: '3d'   },
    { id: 'trail_split',     label: '分裂光',   category: 'trails',     texPath: 'textures/trails/tex_trail_split',                blendMode: 'additive',    audio: 'skill1',   scale: 2.0, renderMode: 'auto', space: '3d'   },
    { id: 'trail_sphere',    label: '球形擴散', category: 'trails',     texPath: 'textures/trails/tex_trail_sphere',               blendMode: 'additive',    audio: 'skill2',   scale: 1.5, renderMode: 'auto', space: '3d'   },

    // ─── 衝擊/爆炸 (Impact & Explosion) ────────────────────────────────────
    // 音效映射: 爆炸類 → boom.mp3, 受擊類 → hurt.mp3, 飛行 → feijian.mp3
    { id: 'impact_shock',    label: '尖銳衝擊', category: 'impact',     texPath: 'textures/impact/tex_impact_sharpshock',          blendMode: 'additive',    audio: 'boom',     scale: 2.5, renderMode: 'auto', space: '3d'   },
    { id: 'impact_ring',     label: '衝擊環',   category: 'impact',     texPath: 'textures/impact/tex_impact_ring',                blendMode: 'additive',    audio: 'boom',     scale: 2.5, renderMode: 'auto', space: '3d'   },
    { id: 'impact_flying',   label: '飛行軌跡', category: 'impact',     texPath: 'textures/impact/tex_impact_flying',              blendMode: 'additive',    audio: 'feijian',  scale: 1.5, renderMode: 'auto', space: '3d'   },
    { id: 'impact_rock',     label: '岩石碎片', category: 'impact',     texPath: 'textures/impact/tex_impact_rock_01',             blendMode: 'transparent', audio: 'boom',     scale: 1.5, renderMode: 'auto', space: '3d'   },
    { id: 'impact_sparkle',  label: '閃耀星光', category: 'impact',     texPath: 'textures/impact/tex_impact_sparkle',             blendMode: 'additive',    audio: 'hurt',     scale: 1.5, renderMode: 'auto', space: 'both' },

    // ─── 煙霧/陰影 (Smoke & Shadow) ─────────────────────────────────────────
    // 音效映射: 煙霧通常無聲，或用 teleport / skill0
    // GPU 標記: 煙霧為大量大氣粒子，無需 Trail/LimitVelocity，GPU 渲染效能最佳
    { id: 'smoke_aura',      label: '煙霧光環', category: 'smoke',      texPath: 'textures/smoke/tex_smoke_aura',                  blendMode: 'transparent', audio: undefined,  scale: 2.0, renderMode: 'gpu',  space: '3d'   },
    { id: 'smoke_shadow',    label: '地面陰影', category: 'smoke',      texPath: 'textures/smoke/tex_smoke_ground_shadow',         blendMode: 'transparent', audio: undefined,  scale: 2.5, renderMode: 'gpu',  space: '3d'   },
    { id: 'smoke_stretched', label: '拉伸煙霧', category: 'smoke',      texPath: 'textures/smoke/tex_smoke_stretched',             blendMode: 'transparent', audio: undefined,  scale: 2.0, renderMode: 'gpu',  space: '3d'   },

    // ─── 投射物 (Projectile) ――――――――――――――――――――――――――――――――――――――――――――――
    // 音效映射: 飛劍 → feijian.mp3, 箭 → weapon.mp3, 蝙蝠 → bat.mp3
    { id: 'proj_sword01',    label: '飛劍A',    category: 'projectile', texPath: 'textures/projectile/tex_proj_sword_01',          blendMode: 'additive',    audio: 'feijian',  scale: 1.0, renderMode: 'auto', space: '3d'   },
    { id: 'proj_sword03',    label: '飛劍B',    category: 'projectile', texPath: 'textures/projectile/tex_proj_sword_03',          blendMode: 'additive',    audio: 'feijian',  scale: 1.0, renderMode: 'auto', space: '3d'   },
    { id: 'proj_arrow',      label: '箭矢',     category: 'projectile', texPath: 'textures/projectile/tex_proj_arrow',             blendMode: 'transparent', audio: 'weapon',   scale: 1.0, renderMode: 'auto', space: '3d'   },
    { id: 'proj_warn_line',  label: '警告線',   category: 'projectile', texPath: 'textures/projectile/tex_proj_warn_line',         blendMode: 'additive',    audio: undefined,  scale: 2.0, renderMode: 'auto', space: 'both' },
    { id: 'proj_bat',        label: '蝙蝠',     category: 'projectile', texPath: 'textures/projectile/tex_proj_bat',               blendMode: 'transparent', audio: 'bat',      scale: 1.0, renderMode: 'auto', space: '3d'   },
    { id: 'proj_magic_circ', label: '魔法陣',   category: 'projectile', texPath: 'textures/projectile/tex_proj_magic_circle',      blendMode: 'additive',    audio: 'skill0',   scale: 2.5, renderMode: 'auto', space: '3d'   },

    // ─── 狀態 (Status Effects) ──────────────────────────────────────────────
    // 音效映射: 增益 → buff.mp3, 治癒 → heal.mp3
    { id: 'ring_addatk',     label: '攻擊法陣', category: 'status',     texPath: 'textures/rings/tex_ring_addatk',                 blendMode: 'additive',    audio: 'buff',     scale: 1.5, renderMode: 'auto', space: '3d'   },
    { id: 'ring_addlife',    label: '治癒法陣', category: 'status',     texPath: 'textures/rings/tex_ring_addlife',                blendMode: 'additive',    audio: 'heal',     scale: 1.5, renderMode: 'auto', space: '3d'   },
    { id: 'icon_addatk',     label: '劍圖示',   category: 'status',     texPath: 'textures/icons/tex_icon_addatk',                 blendMode: 'transparent', audio: undefined,  scale: 0.8, renderMode: 'auto', space: 'both' },
    { id: 'icon_addlife',    label: '心圖示',   category: 'status',     texPath: 'textures/icons/tex_icon_addlife',                blendMode: 'transparent', audio: undefined,  scale: 0.8, renderMode: 'auto', space: 'both' },
    // ─── 3D 粒子特效 (Particle 3D — 來源：Cocos 3D Particle Effects Pack) ──
    // 這些積木 prefabPath 指向 vfx_core bundle 中的完整粒子 Prefab，
    // Particle Prefab 模式會直接實例化、播放所有子粒子系統。
    // texPath 保留空字串，Quad 預覽不適用，選擇此分類時會自動切換為 Particle Prefab 模式。
    { id: 'p3d_boss_anger',      label: 'Boss怒氣',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/bossAnger/bossAnger',             blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_boss_smoke',      label: 'Boss煙霧',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/bossAttackSmoke/attckSmoke',      blendMode: 'transparent', audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_box_hit',         label: '箱子受擊',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/box/boxHit',                      blendMode: 'additive',    audio: 'hurt',    scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_box_open',        label: '開箱光效',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/box/boxOpen',                     blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_bubble_green',    label: '綠泡泡',      category: 'particle3d', texPath: '', prefabPath: 'prefabs/bubble/bubbleG',                   blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_bubble_red',      label: '紅泡泡',      category: 'particle3d', texPath: '', prefabPath: 'prefabs/bubble/bubbleR',                   blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_bubble_yellow',   label: '黃泡泡',      category: 'particle3d', texPath: '', prefabPath: 'prefabs/bubble/bubbleY',                   blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_change_color',    label: '變色光柱',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/changeColor/changeColor',          blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_change_green',    label: '綠光變換',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/changeColor/changeGreen',          blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_change_red',      label: '紅光變換',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/changeColor/changeRed',            blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_change_yellow',   label: '黃光變換',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/changeColor/changeYellow',         blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_collect_purple',  label: '紫色收集',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/collectColor/collectPurple',        blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_collect_yellow',  label: '黃色收集',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/collectColor/collectYellow',        blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_color_bar',       label: '彩虹光條',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/colorBar/colorBar',                blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_common_light',    label: '通用光效',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/commonLight/commonLight',          blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_fight_boom',      label: '戰鬥爆炸',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/fightBoom/fightBoom',              blendMode: 'additive',    audio: 'boom',    scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_fire',            label: '火焰粒子',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/fire/fire01',                      blendMode: 'additive',    audio: 'fireball',scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_fly_light',       label: '飛行光線',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/flyFight/flyLight',                blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_hit',             label: '打擊特效',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/hit/hit',                          blendMode: 'additive',    audio: 'hurt',    scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_hit_box',         label: '方塊打擊',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/hit/boxHit',                      blendMode: 'additive',    audio: 'hurt',    scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_level_up',        label: '升級光效',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/levelUp/leveUp',                   blendMode: 'additive',    audio: 'buff',    scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_smoke_light',     label: '煙光特效',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/smokeLight/smokeLight01',           blendMode: 'transparent', audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },
    { id: 'p3d_star',            label: '星星特效',    category: 'particle3d', texPath: '', prefabPath: 'prefabs/star/star01',                      blendMode: 'additive',    audio: undefined, scale: 1.0, renderMode: 'auto', space: '3d' },

    // ─── [MEP] 粒子特效 (Magic Effects Pack — Particle Prefabs) ────────────────
    // 來源: tools/mep-prefab-generator.mjs 批次生成，基於 bubbleG.prefab 模板
    // 適合: 各類戰鬥/技能/狀態場景
    { id: 'p3d_mep_buff_aura',     label: 'MEP增益光環',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/mep_buff_aura/mep_buff_aura',         blendMode: 'additive',    audio: 'buff',    scale: 2.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_mep_debuff_aura',   label: 'MEP負面光環',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/mep_debuff_aura/mep_debuff_aura',     blendMode: 'additive',    audio: undefined, scale: 2.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_mep_healing_aura',  label: 'MEP治癒光環',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/mep_healing_aura/mep_healing_aura',   blendMode: 'additive',    audio: 'heal',    scale: 2.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_mep_sparks_orange', label: 'MEP橘色星火',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/mep_sparks_orange/mep_sparks_orange', blendMode: 'additive',    audio: 'hurt',    scale: 1.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_mep_sparks_blue',   label: 'MEP藍色星火',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/mep_sparks_blue/mep_sparks_blue',     blendMode: 'additive',    audio: 'hurt',    scale: 1.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_mep_explosion',     label: 'MEP爆炸效果',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/mep_explosion/mep_explosion',         blendMode: 'additive',    audio: 'boom',    scale: 3.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_mep_electro_hit',   label: 'MEP雷擊命中',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/mep_electro_hit/mep_electro_hit',     blendMode: 'additive',    audio: 'thunder', scale: 2.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_mep_charge_slash',  label: 'MEP蓄力斬擊',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/mep_charge_slash/mep_charge_slash',   blendMode: 'additive',    audio: 'weapon',  scale: 2.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_mep_magic_ring',    label: 'MEP魔法粒子環',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/mep_magic_ring/mep_magic_ring',       blendMode: 'additive',    audio: 'skill0',  scale: 3.0, renderMode: 'cpu', space: '3d' },

    // ─── [CFXR] Cartoon FX Remaster FREE 粒子特效 (偏卡通/2D風格) ──────────
    // 來源: tools/JMO Assets/Cartoon FX Remaster/ → 貼圖複製到 textures/cfxr/
    // 說明: 需先在 Cocos Creator 做 asset-db refresh，再執行 tools/cfxr-prefab-generator.mjs
    { id: 'p3d_cfxr_hit_red',       label: 'CFXR紅色打擊',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_hit_red/cfxr_hit_red',             blendMode: 'additive',    audio: 'hurt',    scale: 1.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_hit_yellow',    label: 'CFXR黃色打擊',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_hit_yellow/cfxr_hit_yellow',         blendMode: 'additive',    audio: 'hurt',    scale: 1.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_spikes_impact', label: 'CFXR尖刺衝擊',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_spikes_impact/cfxr_spikes_impact',   blendMode: 'additive',    audio: 'hurt',    scale: 2.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_electric_spark',label: 'CFXR電火花',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_electric_spark/cfxr_electric_spark', blendMode: 'additive',    audio: 'thunder', scale: 1.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_electric_ring', label: 'CFXR電氣環',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_electric_ring/cfxr_electric_ring',   blendMode: 'additive',    audio: 'thunder', scale: 2.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_star_gold',     label: 'CFXR金色星星',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_star_gold/cfxr_star_gold',           blendMode: 'additive',    audio: undefined, scale: 2.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_star_blurred',  label: 'CFXR星光散射',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_star_blurred/cfxr_star_blurred',     blendMode: 'additive',    audio: undefined, scale: 2.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_flare_heal',    label: 'CFXR治癒光暈',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_flare_heal/cfxr_flare_heal',         blendMode: 'additive',    audio: 'heal',    scale: 2.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_fire_crisp',    label: 'CFXR清晰火焰',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_fire_crisp/cfxr_fire_crisp',         blendMode: 'additive',    audio: 'fireball',scale: 2.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_fire_circle',   label: 'CFXR火圈',       category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_fire_circle/cfxr_fire_circle',       blendMode: 'additive',    audio: 'fireball',scale: 2.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_smoke',         label: 'CFXR煙霧',       category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_smoke/cfxr_smoke',                   blendMode: 'transparent', audio: undefined, scale: 2.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_smoke_white',   label: 'CFXR白煙',       category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_smoke_white/cfxr_smoke_white',       blendMode: 'transparent', audio: undefined, scale: 2.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_bubble',        label: 'CFXR泡泡',       category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_bubble/cfxr_bubble',                 blendMode: 'additive',    audio: undefined, scale: 1.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_aura_runic',    label: 'CFXR符文光環',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_aura_runic/cfxr_aura_runic',         blendMode: 'additive',    audio: 'skill0',  scale: 2.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_runic_aura',   label: 'CFXR符文光環(複合)', category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_runic_aura_compound/cfxr_runic_aura_compound', blendMode: 'additive', audio: 'skill0', scale: 1.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_aura_rays',     label: 'CFXR射線光環',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_aura_rays/cfxr_aura_rays',           blendMode: 'additive',    audio: 'buff',    scale: 2.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_heart',         label: 'CFXR愛心',       category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_heart/cfxr_heart',                   blendMode: 'additive',    audio: 'heal',    scale: 2.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_skull',         label: 'CFXR骷髏頭',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_skull/cfxr_skull',                   blendMode: 'additive',    audio: undefined, scale: 2.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_ring_ice',      label: 'CFXR冰其環',     category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_ring_ice/cfxr_ring_ice',             blendMode: 'additive',    audio: undefined, scale: 3.0, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_ember',         label: 'CFXR火星飛濺',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_ember/cfxr_ember',                   blendMode: 'additive',    audio: undefined, scale: 1.5, renderMode: 'cpu', space: '3d' },
    { id: 'p3d_cfxr_slash_ray',     label: 'CFXR斬擊射線',   category: 'particle3d', texPath: '', prefabPath: 'prefabs/cfxr_slash_ray/cfxr_slash_ray',           blendMode: 'additive',    audio: 'weapon',  scale: 2.0, renderMode: 'cpu', space: '3d' },

    // ─── [MEP] 發光/漸層 (Magic Effects Pack — Glow) ────────────────────────
    // 來源: tools/Magic effects pack/Textures/ → 複製為 mep_glow_*.png
    // 適合: 命中閃光、技能爆光、光源強調
    { id: 'mep_glow_flash',       label: 'MEP閃爍光',  category: 'glow',       texPath: 'textures/glow/mep_glow_flash',             blendMode: 'additive',    audio: 'light',    scale: 2.0, renderMode: 'auto', space: 'both' },
    { id: 'mep_glow_flash_free1', label: 'MEP閃光A',   category: 'glow',       texPath: 'textures/glow/mep_glow_flash_free1',       blendMode: 'additive',    audio: 'light',    scale: 2.0, renderMode: 'auto', space: 'both' },
    { id: 'mep_glow_flash_free2', label: 'MEP閃光B',   category: 'glow',       texPath: 'textures/glow/mep_glow_flash_free2',       blendMode: 'additive',    audio: 'light',    scale: 2.0, renderMode: 'auto', space: 'both' },
    { id: 'mep_glow_flash_free3', label: 'MEP閃光C',   category: 'glow',       texPath: 'textures/glow/mep_glow_flash_free3',       blendMode: 'additive',    audio: 'boom',     scale: 3.0, renderMode: 'auto', space: 'both' },
    { id: 'mep_glow_soft_alt',    label: 'MEP柔光',    category: 'glow',       texPath: 'textures/glow/mep_glow_soft_alt',          blendMode: 'additive',    audio: 'light',    scale: 1.5, renderMode: 'auto', space: 'both' },
    { id: 'mep_glow_flare',       label: 'MEP炫光',    category: 'glow',       texPath: 'textures/glow/mep_glow_flare',             blendMode: 'additive',    audio: undefined,  scale: 1.5, renderMode: 'auto', space: 'both' },
    { id: 'mep_glow_point',       label: 'MEP點光',    category: 'glow',       texPath: 'textures/glow/mep_glow_point',             blendMode: 'additive',    audio: undefined,  scale: 1.0, renderMode: 'auto', space: 'both' },
    { id: 'mep_glow_gradient',    label: 'MEP線性漸層',category: 'glow',       texPath: 'textures/glow/mep_glow_gradient',          blendMode: 'additive',    audio: undefined,  scale: 2.0, renderMode: 'auto', space: 'both' },
    { id: 'mep_glow_gradient_r',  label: 'MEP徑向漸層',category: 'glow',       texPath: 'textures/glow/mep_glow_gradient_radial',   blendMode: 'additive',    audio: undefined,  scale: 2.0, renderMode: 'auto', space: 'both' },

    // ─── [MEP] 衝擊/地面效果 (Magic Effects Pack — Impact) ──────────────────
    { id: 'mep_impact_crack',     label: 'MEP地裂',    category: 'impact',     texPath: 'textures/impact/mep_impact_crack',          blendMode: 'transparent', audio: 'boom',     scale: 3.0, renderMode: 'auto', space: '3d' },
    { id: 'mep_impact_crater',    label: 'MEP彈坑',    category: 'impact',     texPath: 'textures/impact/mep_impact_crater',         blendMode: 'transparent', audio: 'boom',     scale: 2.5, renderMode: 'auto', space: '3d' },
    { id: 'mep_impact_splat',     label: 'MEP濺射',    category: 'impact',     texPath: 'textures/impact/mep_impact_splat',          blendMode: 'transparent', audio: 'hurt',     scale: 2.0, renderMode: 'auto', space: '3d' },
    { id: 'mep_impact_stone',     label: 'MEP石塊',    category: 'impact',     texPath: 'textures/impact/mep_impact_stone',          blendMode: 'transparent', audio: 'boom',     scale: 1.5, renderMode: 'auto', space: '3d' },

    // ─── [MEP] 煙霧 (Magic Effects Pack — Smoke) ────────────────────────────
    { id: 'mep_smoke_puff',       label: 'MEP飄散煙',  category: 'smoke',      texPath: 'textures/smoke/mep_smoke_puff',             blendMode: 'transparent', audio: undefined,  scale: 2.0, renderMode: 'gpu',  space: '3d' },
    { id: 'mep_smoke_cloud',      label: 'MEP雲狀煙',  category: 'smoke',      texPath: 'textures/smoke/mep_smoke_cloud',            blendMode: 'transparent', audio: undefined,  scale: 2.5, renderMode: 'gpu',  space: '3d' },

    // ─── [MEP] 刀光軌跡 (Magic Effects Pack — Trails) ───────────────────────
    { id: 'mep_trail_soft',       label: 'MEP柔光軌跡',category: 'trails',     texPath: 'textures/trails/mep_trail_soft',            blendMode: 'additive',    audio: undefined,  scale: 1.5, renderMode: 'cpu',  gpuIncompatibleModules: ['trail'], space: '3d' },

    // ─── [MEP] 投射物 (Magic Effects Pack — Projectile) ─────────────────────
    { id: 'mep_proj_bolt',        label: 'MEP能量箭',  category: 'projectile', texPath: 'textures/projectile/mep_proj_bolt',         blendMode: 'additive',    audio: 'feijian',  scale: 1.0, renderMode: 'auto', space: '3d' },

    // ─── [MEP] 形狀 (Magic Effects Pack — Shapes) ───────────────────────────
    // 適合: 粒子形狀貼圖 (Unity: Particle System → Renderer → Billboard)
    { id: 'mep_shape_arrow',      label: 'MEP箭頭',    category: 'shapes',     texPath: 'textures/shapes/mep_shape_arrow',           blendMode: 'additive',    audio: undefined,  scale: 1.0, renderMode: 'auto', space: 'both' },
    { id: 'mep_shape_circle',     label: 'MEP圓形A',   category: 'shapes',     texPath: 'textures/shapes/mep_shape_circle',          blendMode: 'additive',    audio: undefined,  scale: 1.5, renderMode: 'auto', space: 'both' },
    { id: 'mep_shape_circle2',    label: 'MEP圓形B',   category: 'shapes',     texPath: 'textures/shapes/mep_shape_circle2',         blendMode: 'additive',    audio: undefined,  scale: 1.5, renderMode: 'auto', space: 'both' },
    { id: 'mep_shape_star',       label: 'MEP星形',    category: 'shapes',     texPath: 'textures/shapes/mep_shape_star',            blendMode: 'additive',    audio: undefined,  scale: 1.0, renderMode: 'auto', space: 'both' },
    { id: 'mep_shape_heart',      label: 'MEP愛心',    category: 'shapes',     texPath: 'textures/shapes/mep_shape_heart',           blendMode: 'transparent', audio: undefined,  scale: 1.0, renderMode: 'auto', space: 'both' },
    { id: 'mep_shape_snowflake',  label: 'MEP雪花',    category: 'shapes',     texPath: 'textures/shapes/mep_shape_snowflake',       blendMode: 'transparent', audio: undefined,  scale: 1.0, renderMode: 'auto', space: 'both' },
    { id: 'mep_shape_slash',      label: 'MEP斬擊形',  category: 'shapes',     texPath: 'textures/shapes/mep_shape_slash',           blendMode: 'additive',    audio: 'weapon',   scale: 2.0, renderMode: 'auto', space: '3d'   },
    { id: 'mep_shape_electro',    label: 'MEP閃電形',  category: 'shapes',     texPath: 'textures/shapes/mep_shape_electro',         blendMode: 'additive',    audio: 'thunder',  scale: 2.0, renderMode: 'auto', space: '3d'   },
    { id: 'mep_shape_mask',       label: 'MEP遮罩圓',  category: 'shapes',     texPath: 'textures/shapes/mep_shape_mask',            blendMode: 'transparent', audio: undefined,  scale: 1.5, renderMode: 'auto', space: 'both' },
    { id: 'mep_shape_crystal',    label: 'MEP晶體形',  category: 'shapes',     texPath: 'textures/shapes/mep_shape_crystal',         blendMode: 'transparent', audio: undefined,  scale: 1.0, renderMode: 'auto', space: '3d'   },

    // ─── [MEP] 魔法陣/科技環 (Magic Effects Pack — Rings) ──────────────────
    // 適合: 地面施法法陣、角色光環底盤、傳送門效果
    { id: 'mep_ring_magic_circle', label: 'MEP魔法陣A',category: 'rings',      texPath: 'textures/rings/mep_ring_magic_circle',      blendMode: 'additive',    audio: 'skill0',   scale: 2.5, renderMode: 'auto', space: '3d' },
    { id: 'mep_ring_magic_circle2',label: 'MEP魔法陣B',category: 'rings',      texPath: 'textures/rings/mep_ring_magic_circle2',     blendMode: 'additive',    audio: 'skill0',   scale: 2.5, renderMode: 'auto', space: '3d' },
    { id: 'mep_ring_tech_circle',  label: 'MEP科技環A',category: 'rings',      texPath: 'textures/rings/mep_ring_tech_circle',       blendMode: 'additive',    audio: undefined,  scale: 2.5, renderMode: 'auto', space: '3d' },
    { id: 'mep_ring_tech_circle2', label: 'MEP科技環B',category: 'rings',      texPath: 'textures/rings/mep_ring_tech_circle2',      blendMode: 'additive',    audio: undefined,  scale: 2.5, renderMode: 'auto', space: '3d' },
    { id: 'zhen_ji_ice_nova',      label: '甄姬冰晶漩渦', category: 'rings',      texPath: 'textures/Frost_Nova_Atlas',                blendMode: 'additive',    audio: 'heal',     scale: 3.0, renderMode: 'auto', space: '3d', prefabPath: 'prefabs/fx/zhen_ji_ice_nova' },
];

/** 全部音效 clip 名稱與積木的對應說明 (文檔用) */
export const VFX_AUDIO_MAPPING: Record<string, string> = {
    'bat':      '蝙蝠投射物 (proj_bat)',
    'bite':     '普通攻擊命中',
    'biteskill':'技能攻擊命中',
    'boom':     '爆炸/衝擊爆發 (fire_burst, impact_shock, impact_ring, energy_blast)',
    'buff':     '正向Buff獲得 (ring_addatk)',
    'die':      '單位死亡',
    'feijian':  '飛劍/飛行投射 (proj_sword01, proj_sword03, impact_flying)',
    'fireball': '火焰類 (fire_glow_half, fire_particles, fire_aura_tail, fire_magic_orb)',
    'footstep': '腳步移動',
    'heal':     '治癒回血 (ring_addlife)',
    'hurt':     '受擊反應 (impact_sparkle)',
    'laser':    '光線/雷射 (ray_straight)',
    'light':    '發光/光暈 (glow_soft, glow_bright, lightbeam)',
    'shield':   '護盾/防禦',
    'skill0':   '技能0 / 魔法陣 (proj_magic_circ)',
    'skill1':   '技能1 / 分裂光 (trail_split)',
    'skill2':   '技能2 / 球形擴散 (trail_sphere)',
    'skill3':   '技能3',
    'skill7':   '技能7',
    'start':    '戰鬥開始',
    'teleport': '傳送/瞬移',
    'thunder':  '閃電/雷擊 (lightning_purple)',
    'wave':     '能量波/火環波 (fire_wavering, fire_ringwave, energy_wave)',
    'weapon':   '武器揮砍/斬擊 (trail_bigsword, trail_slash, trail_dao, proj_arrow)',
};
