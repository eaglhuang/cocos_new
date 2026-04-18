import { StatusEffect } from '../../core/config/Constants';
import { BattleSkillAutoAimMode, BattleSkillTargetMode, type SkillScalingStat } from '../../shared/SkillRuntimeContract';

export type BattleSkillFalloffRule = 'none' | 'linear-step';
export type BattleSkillEffectKind = 'damage' | 'heal' | 'control' | 'link' | 'counter' | 'reset';

export interface BattleSkillProfile {
  battleSkillId: string;
  targetMode: BattleSkillTargetMode;
  manualTargeting?: boolean;
  autoAimMode?: BattleSkillAutoAimMode;
  effectKind?: BattleSkillEffectKind;
  coefficient: number;
  scalingStat?: SkillScalingStat;
  ignoreDefense?: boolean;
  /** 防禦穿透比例 0~1，無視目標該比例的防禦力（G-1 無視防禦：0.5） */
  defensePenetrationRatio?: number;
  /** 傷害爆擊加成倍率（flat 增益）：final = base * (1 + critBonus)（G-1 百步穿楊：0.5） */
  critBonus?: number;
  maxTargets?: number;
  falloffRule?: BattleSkillFalloffRule;
  lineLength?: number;
  fanDepth?: number;
  fanHalfWidth?: number;
  areaRadius?: number;
  excludeCenter?: boolean;
  healRatio?: number;
  healFloor?: number;
  statusEffect?: StatusEffect;
  statusTurns?: number;
  linkShareRatio?: number;
  linkRadius?: number;
  linkMaxTargets?: number;
  counterRatio?: number;
  counterStatusEffect?: StatusEffect;
  counterStatusTurns?: number;
  counterTriggers?: number;
  counterMeleeOnly?: boolean;
  resetFirstHitMultiplier?: number;
  resetExtraActions?: number;
  battleLogKey?: string;
}

const PROFILE_BY_SKILL_ID: Record<string, BattleSkillProfile> = {
  'zhang-fei-roar': {
    battleSkillId: 'zhang-fei-roar',
    targetMode: BattleSkillTargetMode.EnemyAll,
    manualTargeting: false,
    autoAimMode: 'all-enemies',
    effectKind: 'control',
    coefficient: 0,
    statusEffect: StatusEffect.Stun,
    statusTurns: 1,
    battleLogKey: 'skill.zhang_fei_roar.hit',
  },
  'cao-cao-tactics': {
    battleSkillId: 'cao-cao-tactics',
    targetMode: BattleSkillTargetMode.EnemySingle,
    manualTargeting: false,
    autoAimMode: 'frontmost-enemy',
    coefficient: 0.55,
    scalingStat: 'int',
    ignoreDefense: true,
    maxTargets: 1,
    falloffRule: 'none',
    battleLogKey: 'skill.cao_cao_tactics.hit',
  },
  'guan-yu-slash': {
    battleSkillId: 'guan-yu-slash',
    targetMode: BattleSkillTargetMode.Line,
    manualTargeting: false,
    autoAimMode: 'densest-line',
    coefficient: 0.85,
    scalingStat: 'str',
    maxTargets: 3,
    lineLength: 3,
    falloffRule: 'linear-step',
    battleLogKey: 'skill.guan_yu_slash.hit',
  },
  'lu-bu-rampage': {
    battleSkillId: 'lu-bu-rampage',
    targetMode: BattleSkillTargetMode.Fan,
    manualTargeting: false,
    autoAimMode: 'densest-fan',
    coefficient: 0.75,
    scalingStat: 'str',
    maxTargets: 4,
    fanDepth: 2,
    fanHalfWidth: 1,
    falloffRule: 'linear-step',
    battleLogKey: 'skill.lu_bu_rampage.hit',
  },
  'zhao-yun-pierce': {
    battleSkillId: 'zhao-yun-pierce',
    targetMode: BattleSkillTargetMode.Line,
    manualTargeting: false,
    autoAimMode: 'densest-line',
    coefficient: 0.8,
    scalingStat: 'str',
    maxTargets: 4,
    lineLength: 4,
    falloffRule: 'linear-step',
    battleLogKey: 'skill.zhao_yun_pierce.hit',
  },
  'zhuge-liang-storm': {
    battleSkillId: 'zhuge-liang-storm',
    targetMode: BattleSkillTargetMode.Area,
    manualTargeting: false,
    autoAimMode: 'densest-area',
    coefficient: 0.72,
    scalingStat: 'int',
    maxTargets: 5,
    areaRadius: 1,
    falloffRule: 'linear-step',
    battleLogKey: 'skill.zhuge_liang_storm.hit',
  },
  'zhou-yu-inferno': {
    battleSkillId: 'zhou-yu-inferno',
    targetMode: BattleSkillTargetMode.Tile,
    manualTargeting: false,
    autoAimMode: 'occupied-tile',
    coefficient: 0.95,
    scalingStat: 'int',
    maxTargets: 1,
    falloffRule: 'none',
    battleLogKey: 'skill.zhou_yu_inferno.hit',
  },
  'sun-quan-tide': {
    battleSkillId: 'sun-quan-tide',
    targetMode: BattleSkillTargetMode.AdjacentTiles,
    manualTargeting: false,
    autoAimMode: 'adjacent-ring',
    coefficient: 0.68,
    scalingStat: 'int',
    maxTargets: 4,
    areaRadius: 1,
    excludeCenter: true,
    falloffRule: 'linear-step',
    battleLogKey: 'skill.sun_quan_tide.hit',
  },
  'liu-bei-rally': {
    battleSkillId: 'liu-bei-rally',
    targetMode: BattleSkillTargetMode.AllyAll,
    manualTargeting: false,
    autoAimMode: 'all-allies',
    effectKind: 'heal',
    coefficient: 0,
    scalingStat: 'cha',
    healRatio: 0.18,
    healFloor: 30,
    battleLogKey: 'skill.liu_bei_rally.heal',
  },
  'diao-chan-charm': {
    battleSkillId: 'diao-chan-charm',
    targetMode: BattleSkillTargetMode.EnemyAll,
    manualTargeting: false,
    autoAimMode: 'all-enemies',
    effectKind: 'control',
    coefficient: 0,
    statusEffect: StatusEffect.Stun,
    statusTurns: 1,
    battleLogKey: 'skill.diao_chan_charm.control',
  },
  'lian-huan-chain': {
    battleSkillId: 'lian-huan-chain',
    targetMode: BattleSkillTargetMode.EnemySingle,
    manualTargeting: false,
    autoAimMode: 'frontmost-enemy',
    effectKind: 'link',
    coefficient: 0,
    linkShareRatio: 0.5,
    linkRadius: 1,
    linkMaxTargets: 2,
    battleLogKey: 'skill.lian_huan_chain.link',
  },
  'you-qi-counter': {
    battleSkillId: 'you-qi-counter',
    targetMode: BattleSkillTargetMode.AllySingle,
    manualTargeting: false,
    autoAimMode: 'all-allies',
    effectKind: 'counter',
    coefficient: 0,
    counterRatio: 2,
    counterStatusEffect: StatusEffect.Weak,
    counterStatusTurns: 2,
    counterTriggers: 1,
    counterMeleeOnly: true,
    battleLogKey: 'skill.you_qi_counter.reaction',
  },
  'wei-zhen-reset': {
    battleSkillId: 'wei-zhen-reset',
    targetMode: BattleSkillTargetMode.AllySingle,
    manualTargeting: false,
    autoAimMode: 'all-allies',
    effectKind: 'reset',
    coefficient: 0,
    resetFirstHitMultiplier: 2,
    resetExtraActions: 1,
    battleLogKey: 'skill.wei_zhen_reset.stance',
  },
  'cao-zhi-verse': {
    battleSkillId: 'cao-zhi-verse',
    targetMode: BattleSkillTargetMode.Fan,
    manualTargeting: false,
    autoAimMode: 'densest-fan',
    coefficient: 0.78,
    scalingStat: 'int',
    maxTargets: 4,
    fanDepth: 3,
    fanHalfWidth: 2,
    falloffRule: 'linear-step',
    battleLogKey: 'skill.cao_zhi_verse.hit',
  },
  'guo-jia-foresight': {
    battleSkillId: 'guo-jia-foresight',
    targetMode: BattleSkillTargetMode.Area,
    manualTargeting: false,
    autoAimMode: 'densest-area',
    coefficient: 0.66,
    scalingStat: 'int',
    maxTargets: 5,
    areaRadius: 1,
    falloffRule: 'linear-step',
    battleLogKey: 'skill.guo_jia_foresight.hit',
  },
  'sima-yi-shadow': {
    battleSkillId: 'sima-yi-shadow',
    targetMode: BattleSkillTargetMode.EnemyAll,
    manualTargeting: false,
    autoAimMode: 'all-enemies',
    coefficient: 0.62,
    scalingStat: 'int',
    maxTargets: 5,
    falloffRule: 'linear-step',
    battleLogKey: 'skill.sima_yi_shadow.hit',
  },
  // --- 虎符戰法（TigerTally） G-1 最低成本兩條 ---
  'tally-defense-pierce': {
    battleSkillId: 'tally-defense-pierce',
    targetMode: BattleSkillTargetMode.EnemySingle,
    manualTargeting: false,
    autoAimMode: 'frontmost-enemy',
    effectKind: 'damage',
    coefficient: 1.0,
    scalingStat: 'str',
    maxTargets: 1,
    defensePenetrationRatio: 0.5,
    battleLogKey: 'skill.tally_defense_pierce.hit',
  },
  'tally-hundred-steps': {
    battleSkillId: 'tally-hundred-steps',
    targetMode: BattleSkillTargetMode.EnemySingle,
    manualTargeting: false,
    autoAimMode: 'frontmost-enemy',
    effectKind: 'damage',
    coefficient: 1.2,
    scalingStat: 'str',
    maxTargets: 1,
    critBonus: 0.5,
    battleLogKey: 'skill.tally_hundred_steps.hit',
  },
};

export function resolveBattleSkillProfile(skillId: string): BattleSkillProfile | null {
  return PROFILE_BY_SKILL_ID[skillId] ?? null;
}

export function listBattleSkillProfiles(): BattleSkillProfile[] {
  return Object.values(PROFILE_BY_SKILL_ID);
}

export function resolveBattleSkillTargetMode(
  skillId: string,
  fallback: BattleSkillTargetMode,
): BattleSkillTargetMode {
  return resolveBattleSkillProfile(skillId)?.targetMode ?? fallback;
}

export function requiresBattleSkillManualTargeting(skillId: string): boolean {
  return resolveBattleSkillProfile(skillId)?.manualTargeting ?? false;
}
