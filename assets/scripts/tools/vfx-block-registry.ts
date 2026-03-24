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
    /** 貼圖路徑，相對 vfx_core bundle root，不含副檔名 */
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
