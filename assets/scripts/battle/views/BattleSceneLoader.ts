// @spec-source → 見 docs/cross-reference-index.md
// [UCUF M9] 從 BattleScene.ts 提取的純載入 / 資料建構函數。
// 本模組所有函數均無 BattleScene 實例依賴（不使用 this）。
// Unity 對照：BattleDataLoader + BattleHandBuilder 靜態工具類別

import { assetManager, AudioClip } from "cc";
import { services } from "../../core/managers/ServiceLoader";
import { GeneralUnit, GeneralConfig } from "../../core/models/GeneralUnit";
import { Faction, TroopType, TROOP_DEPLOY_COST, Weather, BattleTactic } from "../../core/config/Constants";
import { TallyCardData } from "../../ui/components/TigerTallyComposite";
import { UltimateSkillItem } from "../../ui/components/UltimateSelectPopup";
import { VFX_BLOCK_REGISTRY } from "../../tools/vfx-block-registry";
import { TerrainGrid } from "../models/BattleState";
import { buildIdMap } from "../../shared/SkillRuntimeContract";
import type {
  JsonListEnvelope,
  BattleSkillTargetMode,
  BattleSkillTiming,
  CanonicalTacticDefinition,
  CanonicalUltimateDefinition,
  SkillSourceType,
} from "../../shared/SkillRuntimeContract";

export interface BattleTacticSummary {
  count: number;
  label: string;
  message: string;
  names: string[];
}

let tacticDefinitionMap = new Map<string, CanonicalTacticDefinition>();
let ultimateDefinitionMap = new Map<string, CanonicalUltimateDefinition>();
let battleSkillMetadataPromise: Promise<void> | null = null;

// ─── 型別定義 ───────────────────────────────────────────────────────────────

/** encounters.json 中單一遭遇戰的設定結構 */
export interface EncounterConfig {
  id: string;
  name: string;
  playerGeneralId: string;
  enemyGeneralId: string;
  terrain?: TerrainGrid;
  /** 對應 scene-backgrounds.json 中的 id，決定要顯示的背景圖 */
  backgroundId?: string;
  /** 天氣條件（可選，預設 Clear） */
  weather?: Weather;
  /** 場景戰法（可選，預設 Normal） */
  battleTactic?: BattleTactic;
  /** 我軍裝備 ID 列表（預留） */
  playerEquipment?: string[];
  /** 敵軍裝備 ID 列表（預留） */
  enemyEquipment?: string[];
}

// ─── 資源載入 ───────────────────────────────────────────────────────────────

/**
 * 載入傷害數字 BMFont 並註冊至 FloatTextSystem。
 * Unity 對照：DamageNumberManager.LoadFonts()
 */
export async function loadDamageFonts(): Promise<void> {
  try {
    const res = services().resource;
    const [fontBao, fontJia, fontMiss, fontPu] = await Promise.all([
      res.loadFont("dmgFont/bmfont/bao"),
      res.loadFont("dmgFont/bmfont/jia"),
      res.loadFont("dmgFont/bmfont/miss"),
      res.loadFont("dmgFont/bmfont/pu"),
    ]);

    const floatText = services().floatText;
    if (floatText) {
      floatText.registerFont('dmg_crit', fontBao);
      floatText.registerFont('heal', fontJia);
      floatText.registerFont('dmg_player', fontPu);
      floatText.registerFont('dmg_enemy', fontPu);
      floatText.registerFont('dmg_miss', fontMiss);
    }
    console.log("[BattleSceneLoader] BMFonts 載入並註冊完成");
  } catch (e) {
    console.warn("[BattleSceneLoader] BMFonts 載入失敗, 退回使用預設字型:", e);
  }
}

export async function loadBattleSkillMetadata(): Promise<void> {
  if (!battleSkillMetadataPromise) {
    battleSkillMetadataPromise = Promise.all([
      services().resource.loadJson<JsonListEnvelope<CanonicalTacticDefinition>>('data/master/tactic-library', { tags: ['battle'] }),
      services().resource.loadJson<JsonListEnvelope<CanonicalUltimateDefinition>>('data/master/ultimate-definitions', { tags: ['battle'] }),
    ]).then(([tacticJson, ultimateJson]) => {
      tacticDefinitionMap = buildIdMap(tacticJson.data);
      ultimateDefinitionMap = buildIdMap(ultimateJson.data);
    });
  }
  await battleSkillMetadataPromise;
}

function loadAudioBundleClips(bundleName: string): Promise<Record<string, AudioClip>> {
  return new Promise((resolve, reject) => {
    const addClipAliases = (clipMap: Record<string, AudioClip>, rawName: string | undefined, clip: AudioClip) => {
      const normalizedName = (rawName ?? '').trim();
      if (!normalizedName) {
        return;
      }

      clipMap[normalizedName] = clip;

      const stem = normalizedName.replace(/\.[^.]+$/u, '');
      if (stem && stem !== normalizedName) {
        clipMap[stem] = clip;
      }
    };

    const collectClips = (bundle: any) => {
      bundle.loadDir('clips', AudioClip, (error: any, assets: AudioClip[]) => {
        if (error || !assets) {
          reject(error || new Error(`load audio clips failed: ${bundleName}`));
          return;
        }

        const clipMap: Record<string, AudioClip> = {};
        for (const clip of assets) {
          addClipAliases(clipMap, clip?.name, clip);
          const nativeUrl = (clip as any)?.nativeUrl ?? (clip as any)?.url ?? '';
          const fileName = nativeUrl ? nativeUrl.split('/').pop() : '';
          addClipAliases(clipMap, fileName, clip);
        }
        resolve(clipMap);
      });
    };

    const existing = assetManager.getBundle(bundleName);
    if (existing) {
      collectClips(existing);
      return;
    }

    assetManager.loadBundle(bundleName, (error, bundle) => {
      if (error || !bundle) {
        reject(error || new Error(`loadBundle failed: ${bundleName}`));
        return;
      }
      collectClips(bundle);
    });
  });
}

/**
 * 依 VFX_BLOCK_REGISTRY 預熱所有 VFX Prefab 至 PoolSystem。
 * 確保 EffectSystem.playBlock 呼叫時資源已就緒，避免即時載入卡頓。
 * Unity 對照：VfxPoolManager.Prewarm()
 */
export async function prewarmVfxPools(): Promise<void> {
  const registry = VFX_BLOCK_REGISTRY.filter(block => !!block.prefabPath);
  if (registry.length === 0) return;

  const res = services().resource;
  const pool = services().pool;

  const missing: string[] = [];
  const promises = registry.map(async (block) => {
    try {
      const prefab = await res.loadBundlePrefab('vfx_core', block.prefabPath!);
      if (prefab) {
        pool.register(block.id, prefab, 1);
      }
    } catch (bundleError) {
      try {
        const prefab = await res.loadPrefab(block.prefabPath!);
        if (prefab) {
          pool.register(block.id, prefab, 1);
        }
      } catch (resourceError) {
        missing.push(block.id);
        UCUFLogger.warn(LogCategory.LIFECYCLE, `[BattleSceneLoader] VFX prefab 預熱失敗: ${block.id} (${block.prefabPath})`, resourceError ?? bundleError);
      }
    }
  });

  await Promise.all(promises);

  if (missing.length > 0) {
    UCUFLogger.warn(LogCategory.LIFECYCLE, `[BattleSceneLoader] 仍有 VFX prefab 未預熱: ${missing.join(', ')}`);
  }
}

/**
 * 預熱戰鬥音效 bundle 中的 clips，避免 BattleScene preview 先播才臨時載入。
 * Unity 對照：AudioManager 預載 SFX clip
 */
export async function prewarmBattleAudioClips(): Promise<void> {
  try {
    const clips = await loadAudioBundleClips('audio');
    if (Object.keys(clips).length === 0) {
      UCUFLogger.warn(LogCategory.LIFECYCLE, '[BattleSceneLoader] audio bundle 沒有可預熱的 clips');
      return;
    }

    services().audio.registerClips(clips);
  } catch (error) {
    UCUFLogger.warn(LogCategory.LIFECYCLE, '[BattleSceneLoader] battle audio clips 預熱失敗', error);
  }
}

// ─── 遭遇戰 / 武將讀取 ──────────────────────────────────────────────────────

/**
 * 從 encounters.json 讀取指定遭遇戰設定。
 * Unity 對照：EncounterRepository.GetById(id)
 */
export async function loadEncounter(encounterId: string): Promise<EncounterConfig | null> {
  try {
    const data = await services().resource.loadJson<{ encounters: EncounterConfig[] }>("data/encounters");
    return data.encounters.find(e => e.id === encounterId) ?? null;
  } catch {
    return null;
  }
}

/**
 * 從 generals.json 或內建預設值建立 GeneralUnit。
 * Unity 對照：GeneralFactory.Create(id, faction)
 */
export async function createGeneral(id: string, faction: Faction): Promise<GeneralUnit> {
  const DEFAULT: Record<string, GeneralConfig> = {
    "zhang-fei": { id: "zhang-fei", name: "張飛", faction: Faction.Player, hp: 1000, maxSp: 100, str:  90, lea: 85, luk: 40, attackBonus: 0.10, skillId: "zhang-fei-roar" },
    "guan-yu":   { id: "guan-yu",   name: "關羽", faction: Faction.Player, hp: 1200, maxSp: 100, str: 100, lea: 90, luk: 50, attackBonus: 0.15, skillId: "guan-yu-slash"  },
    "lu-bu":     { id: "lu-bu",     name: "呂布", faction: Faction.Enemy,  hp: 1500, maxSp: 100, str: 130, lea: 95, luk: 30, attackBonus: 0.20, skillId: "lu-bu-rampage"  },
    "cao-cao":   { id: "cao-cao",   name: "曹操", faction: Faction.Enemy,  hp: 1000, maxSp: 80,  int: 110, lea: 80, luk: 70, attackBonus: 0.08, skillId: "cao-cao-tactics" },
  };

  try {
    type GeneralsJson = GeneralConfig[];
    const list = await services().resource.loadJson<GeneralsJson>("data/generals");
    const cfg  = list.find(g => g.id === id);
    if (cfg) {
      return new GeneralUnit({ ...cfg, faction });
    }
  } catch {
    // 靜默失敗，使用預設值
  }

  return new GeneralUnit(DEFAULT[id]);
}

export function buildTacticSummary(general: GeneralUnit): BattleTacticSummary {
  const names = (general.tacticSlots ?? [])
    .map((slot) => tacticDefinitionMap.get(slot.tacticId)?.displayName ?? slot.tacticId)
    .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);

  if (names.length === 0) {
    return {
      count: 0,
      label: '計謀',
      message: '尚未配置天賦戰法',
      names: [],
    };
  }

  return {
    count: names.length,
    label: `計謀 ${names.length}`,
    message: `可用戰法（${names.length}）：${names.join('、')}`,
    names,
  };
}

// ─── 資料建構 ───────────────────────────────────────────────────────────────

/**
 * 根據兵種資料（troops.json + Constants）建立虎符卡片初始資料。
 * 若 selectedCardIds 有值，未來可從卡組資料查出對應卡片；目前為空時使用 demo 預設 4 張手牌。
 * Unity 對照：BattleHandManager.BuildInitialHand() → List<CardData>
 */
const TALLY_CARD_ART_RESOURCE_FALLBACK = 'ui/tiger-tally/card-art/troops';
const TALLY_CARD_ART_RESOURCE_BY_TYPE: Record<TroopType, string> = {
  [TroopType.Cavalry]: 'ui/tiger-tally/card-art/troops_cavalry',
  [TroopType.Infantry]: 'ui/tiger-tally/card-art/troops_infantry',
  [TroopType.Shield]: 'ui/tiger-tally/card-art/troops_shield',
  [TroopType.Archer]: 'ui/tiger-tally/card-art/troops_archer',
  [TroopType.Pikeman]: 'ui/tiger-tally/card-art/troops_pikeman',
  [TroopType.Engineer]: 'ui/tiger-tally/card-art/troops_engineer',
  [TroopType.Medic]: 'ui/tiger-tally/card-art/troops_medic',
  [TroopType.Navy]: 'ui/tiger-tally/card-art/troops_navy',
};

function resolveTallyCardArtResource(type: TroopType): string {
  return TALLY_CARD_ART_RESOURCE_BY_TYPE[type] ?? TALLY_CARD_ART_RESOURCE_FALLBACK;
}

export function buildTallyCards(_selectedCardIds?: string[]): TallyCardData[] {
  // TODO: 當 _selectedCardIds 有值時，從卡組資料庫查出對應卡片
  // 目前一律使用 demo 預設卡組
  const slots: Array<{
    type: TroopType;
    name: string;
    sub: string;
    rarity: 'normal' | 'rare' | 'epic' | 'legendary' | 'mythic';
    rarityLabel: string;
    stars: string;
    artResource: string;
    traits: string[];
    traitDetails: Array<{ label: string; detail?: string }>;
    abilities: string[];
    abilityDetails: Array<{ name: string; detail?: string }>;
    source: {
      faction: string;
      origin: string;
      sourceType: string;
      obtainHint: string;
    };
    lore: {
      title: string;
      summary: string;
      body: string;
    };
    desc: string;
    tacticMeta: {
      tacticId: string;
      battleSkillId: string;
      sourceType: SkillSourceType;
      targetMode: BattleSkillTargetMode;
      timing: BattleSkillTiming;
    };
  }> = [
    {
      type: TroopType.Cavalry,
      name: '虎豹騎',
      sub: '重騎兵',
      rarity: 'normal',
      rarityLabel: 'R',
      stars: '★',
      artResource: resolveTallyCardArtResource(TroopType.Cavalry),
      traits: ['衝鋒', '剋步兵'],
      traitDetails: [
        { label: '衝鋒', detail: '先手突進時提高第一擊輸出。' },
        { label: '剋步兵', detail: '對步兵陣列有額外壓制效果。' },
      ],
      abilities: ['奔襲突破', '鐵騎威懾'],
      abilityDetails: [
        { name: '奔襲突破', detail: '部署後第一輪若未受阻，可獲得額外位移與傷害。' },
        { name: '鐵騎威懾', detail: '逼近敵前排時降低其陣型穩定度。' },
      ],
      source: {
        faction: '魏',
        origin: '曹魏禁軍系重騎',
        sourceType: '名將遺贈虎符',
        obtainHint: '完成魏系名將戰役或高階戰場掉落。',
      },
      lore: {
        title: '曹魏鐵騎之牙',
        summary: '以高速衝鋒與破陣聞名的魏軍精銳重騎。',
        body: '虎豹騎象徵曹魏對精兵速決的信仰，虎符持有者可在戰場上快速投入最具衝擊力的騎兵集群。',
      },
      desc: '機動性最強的精銳鐵騎，能快速突破敵陣。',
      tacticMeta: {
        tacticId: 'tiger-tally-cavalry-shock',
        battleSkillId: 'tiger-charge',
        sourceType: 'tiger-tally' as SkillSourceType,
        targetMode: 'enemy-single' as BattleSkillTargetMode,
        timing: 'active-cast' as BattleSkillTiming,
      },
    },
    {
      type: TroopType.Infantry,
      name: '陷陣營',
      sub: '重步兵',
      rarity: 'rare',
      rarityLabel: 'SR',
      stars: '★★',
      artResource: resolveTallyCardArtResource(TroopType.Infantry),
      traits: ['盾牆', '韌性'],
      traitDetails: [
        { label: '盾牆', detail: '受擊時優先形成正面減傷陣列。' },
        { label: '韌性', detail: '長時間纏戰時維持穩定戰力。' },
      ],
      abilities: ['堅陣不退', '戰線錨定'],
      abilityDetails: [
        { name: '堅陣不退', detail: '被迫迎擊時仍維持防線與反擊效率。' },
        { name: '戰線錨定', detail: '部署於關鍵地塊時提高整排防守穩定度。' },
      ],
      source: {
        faction: '群雄',
        origin: '高順麾下陷陣營',
        sourceType: '名將遺贈虎符',
        obtainHint: '擊敗對應名將後於軍功結算取得。',
      },
      lore: {
        title: '陷陣之鋒',
        summary: '以紀律與裝備完整度著稱的重步方陣。',
        body: '陷陣營的虎符不靠華麗權柄，而靠戰場紀律與持久壓力取勝，是最標準的高階步兵軍令。',
      },
      desc: '堅若磐石的步兵方陣，擅長穩守要地。',
      tacticMeta: {
        tacticId: 'tiger-tally-infantry-wall',
        battleSkillId: 'shield-wall-slam',
        sourceType: 'tiger-tally' as SkillSourceType,
        targetMode: 'enemy-single' as BattleSkillTargetMode,
        timing: 'active-cast' as BattleSkillTiming,
      },
    },
    {
      type: TroopType.Shield,
      name: '大戟士',
      sub: '防禦盾兵',
      rarity: 'legendary',
      rarityLabel: 'UR',
      stars: '★★★★',
      artResource: resolveTallyCardArtResource(TroopType.Shield),
      traits: ['重甲', '剋弓兵'],
      traitDetails: [
        { label: '重甲', detail: '承受遠程與正面斬擊時傷害更低。' },
        { label: '剋弓兵', detail: '面對遠程單位時能有效逼迫其換位。' },
      ],
      abilities: ['盾陣推進', '拒止火力'],
      abilityDetails: [
        { name: '盾陣推進', detail: '維持盾牆形態前進，壓縮敵方射擊空間。' },
        { name: '拒止火力', detail: '抵近後可顯著削弱弓兵輸出節奏。' },
      ],
      source: {
        faction: '魏',
        origin: '重裝近衛步陣',
        sourceType: '軍政工坊鍛造虎符',
        obtainHint: '透過高階軍備鍛造與資源兌換解鎖。',
      },
      lore: {
        title: '重盾拒馬線',
        summary: '以防守與阻滯為核心的重裝大盾兵。',
        body: '大戟士的虎符適合掌控陣線節奏，讓敵軍在正面推進時付出昂貴代價。',
      },
      desc: '以大盾與重甲著稱的防禦核心。',
      tacticMeta: {
        tacticId: 'tiger-tally-shield-line',
        battleSkillId: 'fortress-line',
        sourceType: 'tiger-tally' as SkillSourceType,
        targetMode: 'line' as BattleSkillTargetMode,
        timing: 'active-cast' as BattleSkillTiming,
      },
    },
    {
      type: TroopType.Archer,
      name: '連弩手',
      sub: '遠程弓兵',
      rarity: 'mythic',
      rarityLabel: 'LR',
      stars: '★★★★★',
      artResource: resolveTallyCardArtResource(TroopType.Archer),
      traits: ['穿透', '遠程'],
      traitDetails: [
        { label: '穿透', detail: '集中火力時可持續削減前排耐久。' },
        { label: '遠程', detail: '能在相對安全距離維持穩定輸出。' },
      ],
      abilities: ['弩陣齊射', '壓制掩護'],
      abilityDetails: [
        { name: '弩陣齊射', detail: '短時間內輸出高密度箭雨，迅速壓低血線。' },
        { name: '壓制掩護', detail: '為前排創造安全推進窗口。' },
      ],
      source: {
        faction: '蜀',
        origin: '改良連弩營',
        sourceType: '戰役獎勵虎符',
        obtainHint: '完成蜀系遠征關卡後於結算獲得。',
      },
      lore: {
        title: '連弩連發令',
        summary: '以連續齊射製造壓制區域的高效率遠程兵。',
        body: '連弩手的虎符象徵精密機械與紀律裝填，是在中後排維持輸出節奏的關鍵軍令。',
      },
      desc: '善用強弩齊射的遠程打擊兵種。',
      tacticMeta: {
        tacticId: 'tiger-tally-archer-volley',
        battleSkillId: 'volley-barrage',
        sourceType: 'tiger-tally' as SkillSourceType,
        targetMode: 'area' as BattleSkillTargetMode,
        timing: 'active-cast' as BattleSkillTiming,
      },
    },
  ];

  const TROOP_DEFAULTS: Record<string, { hp: number; attack: number; defense: number; moveRange: number }> = {
    cavalry:  { hp: 100, attack: 40, defense: 20, moveRange: 2 },
    infantry: { hp: 120, attack: 35, defense: 25, moveRange: 1 },
    shield:   { hp: 150, attack: 20, defense: 35, moveRange: 1 },
    archer:   { hp:  80, attack: 30, defense: 15, moveRange: 1 },
  };
  const troopData: Record<string, any> = TROOP_DEFAULTS;

  return slots.map(s => {
    const stats = troopData[s.type as string] || {};
    return {
      unitType:    s.type as string,
      unitName:    s.name,
      unitSub:     s.sub,
      atk:         stats.attack    ?? 0,
      def:         stats.defense   ?? 0,
      hp:          stats.hp        ?? 0,
      spd:         stats.moveRange ?? 1,
      cost:        TROOP_DEPLOY_COST[s.type],
      rarity:      s.rarity,
      rarityLabel: s.rarityLabel,
      stars:       s.stars,
      artResource: s.artResource,
      traits:      s.traits,
      traitDetails: s.traitDetails,
      abilities:   s.abilities,
      abilityDetails: s.abilityDetails,
      source:      s.source,
      lore:        s.lore,
      tacticId:    s.tacticMeta.tacticId,
      battleSkillId: s.tacticMeta.battleSkillId,
      battleSkillSourceType: s.tacticMeta.sourceType,
      targetMode: s.tacticMeta.targetMode,
      timing: s.tacticMeta.timing,
      desc:        s.desc,
      isDisabled:  false,
    } as TallyCardData;
  });
}

/**
 * 由武將資料建立必殺技選擇清單。
 * Unity 對照：UltimateSkillBuilder.Build(general)
 */
export function buildUltimateSkills(general: GeneralUnit): UltimateSkillItem[] {
  const slotSkills = [...(general.ultimateSlots ?? [])]
    .sort((left, right) => left.slot - right.slot)
    .map((slot) => {
      const ultimateDef = ultimateDefinitionMap.get(slot.ultimateId);
      const resolvedSkillId = ultimateDef?.battleSkillId ?? general.battlePrimarySkillId ?? general.skillId ?? null;
      if (!resolvedSkillId) {
        return null;
      }

      const skillDef = services().action.getSkill(resolvedSkillId);
      return {
        skillId: resolvedSkillId,
        label: ultimateDef?.name ?? skillDef?.label ?? slot.ultimateId,
        costSp: skillDef?.costSp ?? general.maxSp,
      } as UltimateSkillItem;
    })
    .filter((item): item is UltimateSkillItem => item !== null);

  if (slotSkills.length > 0) {
    return slotSkills;
  }

  if (!general.skillId) {
    return [];
  }
  const skillDef = services().action.getSkill(general.skillId);
  return [{
    skillId: general.skillId,
    label:   skillDef?.label ?? general.skillId,
    costSp:  skillDef?.costSp ?? general.maxSp,
  }];
}
