// @spec-source → 見 docs/cross-reference-index.md
import { TroopType } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { UCUFLogger, LogCategory } from '../../ui/core/UCUFLogger';

/**
 * 戰鬥音效邏輯鍵。
 *
 * 這一層只表達「戰鬥語意」，不直接綁實體檔名；實體 clip 名稱統一在下方映射。
 * 之後只要換掉對應 clip，就能整批替換同類戰鬥音效。
 */
export const BATTLE_AUDIO_CUE = {
  unitHitPrimary: 'unit-hit-primary',
  unitHitSecondary: 'unit-hit-secondary',
  unitHitCommon: 'unit-hit-common',
  unitAttackPrimary: 'unit-attack-primary',
  unitAttackSecondary: 'unit-attack-secondary',
  unitAttackCommon: 'unit-attack-common',
  generalHitCommon: 'general-hit-common',
  generalAttackCommon: 'general-attack-common',
} as const;

export type BattleAudioCue = typeof BATTLE_AUDIO_CUE[keyof typeof BATTLE_AUDIO_CUE];

// 邏輯鍵 → 具體 AudioClip 名稱。
// 目前先以既有 audio bundle 的 clip 為主，未來若新增 hit/attack 變體，只要改這裡。
const BATTLE_AUDIO_CLIP_MAP: Record<BattleAudioCue, string> = {
  [BATTLE_AUDIO_CUE.unitHitPrimary]: 'hurt',
  [BATTLE_AUDIO_CUE.unitHitSecondary]: 'thunder',
  [BATTLE_AUDIO_CUE.unitHitCommon]: 'hurt',
  [BATTLE_AUDIO_CUE.unitAttackPrimary]: 'weapon',
  [BATTLE_AUDIO_CUE.unitAttackSecondary]: 'weapon',
  [BATTLE_AUDIO_CUE.unitAttackCommon]: 'weapon',
  [BATTLE_AUDIO_CUE.generalHitCommon]: 'hurt',
  [BATTLE_AUDIO_CUE.generalAttackCommon]: 'weapon',
};

export function resolveBattleUnitAttackSfxKey(unitType: TroopType): BattleAudioCue {
  return unitType === TroopType.Cavalry
    ? BATTLE_AUDIO_CUE.unitAttackPrimary
    : BATTLE_AUDIO_CUE.unitAttackCommon;
}

export function resolveBattleUnitHitSfxKey(damageSource?: string): BattleAudioCue {
  return damageSource === 'night-raid-opening-strike'
    ? BATTLE_AUDIO_CUE.unitHitSecondary
    : BATTLE_AUDIO_CUE.unitHitCommon;
}

export function resolveBattleGeneralAttackSfxKey(): BattleAudioCue {
  return BATTLE_AUDIO_CUE.generalAttackCommon;
}

export function resolveBattleGeneralHitSfxKey(): BattleAudioCue {
  return BATTLE_AUDIO_CUE.generalHitCommon;
}

export function playBattleAudio(cue: BattleAudioCue, volume = 1.0): void {
  const clipName = BATTLE_AUDIO_CLIP_MAP[cue];
  if (!clipName) {
    UCUFLogger.warn(LogCategory.LIFECYCLE, `[BattleAudio] 音效 cue 缺少 clip 對應 cue=${cue}`);
    return;
  }

  services().audio.playSfx(clipName, volume);
}