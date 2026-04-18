import { BattleTactic } from '../../../core/config/Constants';
import {
  BattleSkillTargetMode,
  BattleSkillTiming,
  SkillSourceType,
  type BattleSkillRequest,
} from '../../../shared/SkillRuntimeContract';

const SCENE_GAMBIT_PROFILE: Partial<Record<BattleTactic, { battleSkillId: string; notes: string }>> = {
  [BattleTactic.FireAttack]: { battleSkillId: 'scene-fire-attack', notes: 'scene:fire-attack' },
  [BattleTactic.FloodAttack]: { battleSkillId: 'scene-flood-attack', notes: 'scene:flood-attack' },
  [BattleTactic.RockSlide]: { battleSkillId: 'scene-rock-slide', notes: 'scene:rock-slide' },
  [BattleTactic.AmbushAttack]: { battleSkillId: 'scene-ambush-attack', notes: 'scene:ambush-attack' },
  [BattleTactic.NightRaid]: { battleSkillId: 'scene-night-raid', notes: 'scene:night-raid' },
};

export class SceneGambitAdapter {
  public buildRequest(battleTactic: BattleTactic, ownerUid = SkillSourceType.SceneGambit): BattleSkillRequest | null {
    const mapped = SCENE_GAMBIT_PROFILE[battleTactic];
    if (!mapped) {
      return null;
    }

    return {
      sourceType: SkillSourceType.SceneGambit,
      ownerUid,
      battleSkillId: mapped.battleSkillId,
      targetMode: BattleSkillTargetMode.GlobalStage,
      timing: BattleSkillTiming.StartOfBattle,
      notes: mapped.notes,
    };
  }
}