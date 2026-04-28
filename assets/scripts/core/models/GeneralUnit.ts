export type GeneralTacticSlotSource =
  | 'inborn'
  | 'bloodline'
  | 'awakened'
  | 'locked';

export interface GeneralTacticSlotConfig {
  slotId: string;
  tacticId: string;
  category?: string;
  source?: GeneralTacticSlotSource;
  unlockCondition?: string;
  notes?: string;
}

export interface GeneralUltimateSlotConfig {
  slot: number;
  ultimateId: string;
  unlockReincarnation: number;
  vitalityCostPct?: number;
  isExclusive?: boolean;
  inheritedFromGeneId?: string | null;
  notes?: string;
}

export interface GeneralGeneratorProfileConfig {
  coreTags?: string[];
  tacticAffinity?: string[];
  ultimateArchetype?: string;
  factionBias?: string[];
  aptitudeBias?: string[];
  generationFlags?: string[];
}

export interface GeneralBloodlineProfileConfig {
  hometownRegion?: string;
  paternalSurnamePolicy?: 'fixed' | 'historical-if-known' | 'generated';
  maternalSurnamePoolId?: string;
  heritageTags?: string[];
  ancestorTemplateId?: string;
}
// @spec-source → 見 docs/cross-reference-index.md
import { Faction, TerrainType } from "../config/Constants";

/**
 * 武將資料模型 — 純資料，不依賴 Cocos 節點。
 * 武將的攻擊加成會透過 FormulaSystem 的 attackBonus 參數生效。
 * 六色屬性（str/int/lea）用於單挑攻擊力公式，對應 E-12/E-14。
 */
export class GeneralUnit {
  public readonly id: string;
  public readonly name: string;
  public readonly faction: Faction;
  public readonly maxHp: number;
  public currentHp: number;
  
  // 新增屬性：能量 (SP) 系統
  public readonly maxSp: number;
  public currentSp: number;

  /** 六色屬性：武力（物理型單挑攻擊力首選）*/
  public readonly str: number;
  /** 六色屬性：智力（謀略型單挗首選）*/
  public readonly int: number;
  /** 六色屬性：統率（任意型皮使用）*/
  public readonly lea: number;
  /** 六色屬性：政治（內政產出公式使用）*/
  public readonly pol: number;
  /** 六色屬性：魅力（外交/商業產出公式使用）*/
  public readonly cha: number;
  /** 六色屬性：運氣（影響暴擊與閃躲機率，對應 E-11）*/
  public readonly luk: number;

  /** 技能識別字，用於 BattleController 分派對應技能邏輯 */
  public readonly skillId: string | null;
  /** 戰場主技能識別字，供新舊 schema 過渡使用 */
  public readonly battlePrimarySkillId: string | null;
  /** 正式天賦戰法槽位，供 Battle HUD / 詳情頁共用 */
  public readonly tacticSlots: GeneralTacticSlotConfig[];
  /** 正式奧義槽位，供 Battle HUD / 詳情頁共用 */
  public readonly ultimateSlots: GeneralUltimateSlotConfig[];

  /** 該武將提供給同陣營兵種的攻擊加成比例（例如 0.1 = +10%） */
  public readonly attackBonus: number;
  /** 該武將擅長的地形，在此地形上額外提供防禦加成 */
  public readonly preferredTerrain: TerrainType;
  /** 擅長地形上的額外防禦加成比例 */
  public readonly terrainDefenseBonus: number;

  constructor(config: GeneralConfig) {
    this.id = config.id;
    this.name = config.name;
    this.faction = config.faction;
    this.maxHp = config.hp;
    this.currentHp = config.hp;
    this.maxSp = config.maxSp ?? 100;
    this.currentSp = config.initialSp ?? 0;
    this.battlePrimarySkillId = config.battlePrimarySkillId ?? config.skillId ?? null;
    this.skillId = this.battlePrimarySkillId;
    this.tacticSlots = [...(config.tacticSlots ?? [])];
    this.ultimateSlots = [...(config.ultimateSlots ?? [])];
    this.str = config.str ?? config.stats?.str ?? 0;
    this.int = config.int ?? config.stats?.int ?? 0;
    this.lea = config.lea ?? config.stats?.lea ?? 0;
    this.pol = config.pol ?? config.stats?.pol ?? 0;
    this.cha = config.cha ?? config.stats?.cha ?? 0;
    this.luk = config.luk ?? config.stats?.luk ?? 0;
    this.attackBonus = config.attackBonus ?? 0;
    this.preferredTerrain = config.preferredTerrain ?? TerrainType.Plain;
    this.terrainDefenseBonus = config.terrainDefenseBonus ?? 0;
  }

  public takeDamage(value: number): void {
    this.currentHp = Math.max(0, this.currentHp - value);
  }

  public heal(value: number): void {
    this.currentHp = Math.min(this.maxHp, this.currentHp + value);
  }

  public addSp(value: number): void {
    this.currentSp = Math.min(this.maxSp, this.currentSp + value);
  }

  public isDead(): boolean {
    return this.currentHp <= 0;
  }

  public canUseSkill(): boolean {
    return this.currentSp >= this.maxSp;
  }
}

export interface GeneralGeneConfig {
  type?: string;
  id?: string;
  level?: number;
  isLocked?: boolean;
  discoveryLevel?: number;
  displayName?: string;
  description?: string;
}

export interface GeneralStatsConfig {
  str?: number;
  int?: number;
  lea?: number;
  pol?: number;
  cha?: number;
  luk?: number;
}

export type GeneralTalentRevealLevel =
  | 'HIDDEN'
  | 'TENDENCY'
  | 'RANGE'
  | 'EXACT';

export interface GeneralDualLayerStatConfig {
  base?: number;
  current?: number;
  maxPotential?: number;
  revelationLevel?: GeneralTalentRevealLevel;
  prowess?: number;
}

export type GeneralDetailStorySlot =
  | 'origin'
  | 'faction'
  | 'role'
  | 'awakening'
  | 'bloodline'
  | 'future';

export interface GeneralDetailStoryCellConfig {
  slot: GeneralDetailStorySlot;
  text: string;
}

export type GeneralDetailCrestState =
  | 'placeholder'
  | 'rumored'
  | 'revealed'
  | 'awakened';

export type GeneralDetailRarityTier =
  | 'common'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export type GeneralDetailDefaultTab =
  | 'Overview'
  | 'Basics'
  | 'Stats'
  | 'Bloodline'
  | 'Skills'
  | 'Aptitude'
  | 'Extended';

export interface GeneralProfilePresentationConfig {
  defaultTab?: GeneralDetailDefaultTab;
  crestState?: GeneralDetailCrestState;
  storyStripCells?: GeneralDetailStoryCellConfig[];
  portraitCarrierShiftX?: number;
}

export interface GeneralTrainingProfileConfig {
  sourceSessionId?: string;
  phaseBlock?: string;
  mentorModeLabel?: string;
  recommendedFocus?: string[];
  graduationTags?: string[];
}

export interface SpiritFamilyStateConfig {
  hasFamilyBranch?: boolean;
  activeBranchUid?: string;
  entryLabel?: string;
}

/** 角色分類（世界觀標籤，與 rarityTier 獨立）*/
export type CharacterCategory =
  | 'civilian'
  | 'general'
  | 'famed'
  | 'mythical'
  | 'titled';

export interface GeneralConfig {
  id: string;
  name: string;
  alias?: string[];
  faction: Faction;
  hp: number;
  maxSp?: number;
  initialSp?: number;
  skillId?: string;
  battlePrimarySkillId?: string;
  /** 武力（物理型單挑攻擊力首選）*/
  str?: number;
  /** 智力（謀略型單挑攻擊力首選）*/
  int?: number;
  /** 統率（任意型皆使用）*/
  lea?: number;
  /** 運氣（影響暴擊與閃躲機率）*/
  luk?: number;
  attackBonus?: number;
  preferredTerrain?: TerrainType;
  terrainDefenseBonus?: number;

  templateId?: string;
  title?: string;
  gender?: string;
  age?: number;
  vitality?: number;
  maxVitality?: number;
  role?: string;
  status?: string;
  currentHp?: number;
  currentSp?: number;
  source?: string;
  notes?: string;
  devNote?: string;
  hiddenFlags?: string[];

  ep?: number;
  epRating?: string;
  bloodlineId?: string;
  parentsSummary?: string;
  ancestorsSummary?: string;
  awakeningTitle?: string;
  historicalAnecdote?: string;
  bloodlineRumor?: string;
  crestHint?: string;
  crestState?: GeneralDetailCrestState;
  rarityTier?: GeneralDetailRarityTier;
  rarityLabel?: string;
  /** 角色分類：civilian 民間 / general 一般武將 / famed 名將 / mythical 神話 / titled 稱號特殊 */
  characterCategory?: CharacterCategory;
  storyStripCells?: GeneralDetailStoryCellConfig[];
  dualLayerStats?: Partial<Record<keyof GeneralStatsConfig, GeneralDualLayerStatConfig>>;
  profilePresentation?: GeneralProfilePresentationConfig;
  trainingProfile?: GeneralTrainingProfileConfig;
  spiritFamilyState?: SpiritFamilyStateConfig;
  coreTags?: string[];
  generatorProfile?: GeneralGeneratorProfileConfig;
  bloodlineProfile?: GeneralBloodlineProfileConfig;
  genes?: GeneralGeneConfig[];

  learnedTactics?: string[];
  inspiredTactics?: string[];
  lockedTactics?: string[];
  tacticSlots?: GeneralTacticSlotConfig[];
  ultimateSlots?: GeneralUltimateSlotConfig[];

  troopAptitude?: Record<string, string>;
  terrainAptitude?: Record<string, string>;
  weatherAptitude?: Record<string, string>;
  ancestor_chain?: string[];

  stats?: GeneralStatsConfig;
  pol?: number;
  cha?: number;
}
