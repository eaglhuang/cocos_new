import {
  BattleSkillTargetMode,
  BattleSkillTiming,
  SkillSourceType,
  type BattleSkillRequest,
} from '../../../shared/SkillRuntimeContract';

export interface TigerTallySkillCarrier {
  tacticId?: string | null;
  battleSkillId?: string | null;
  targetMode?: BattleSkillTargetMode;
  timing?: BattleSkillTiming;
  unitType?: string;
  unitName?: string;
  abilities?: string[];
  source?: {
    sourceType?: string;
    origin?: string;
  };
}

export interface TigerTallyTacticRequestOptions {
  battleSkillId?: string;
  tacticId?: string | null;
  targetMode?: BattleSkillTargetMode;
  timing?: BattleSkillTiming;
  targetUnitUid?: string | null;
  targetTileId?: string | null;
}

export class TigerTallyTacticAdapter {
  public buildRequest(
    tallyCard: TigerTallySkillCarrier,
    ownerUid: string,
    options: TigerTallyTacticRequestOptions,
  ): BattleSkillRequest | null {
    const battleSkillId = options.battleSkillId ?? tallyCard.battleSkillId ?? null;
    if (!battleSkillId) {
      return null;
    }

    return {
      sourceType: SkillSourceType.TigerTally,
      ownerUid,
      tacticId: options.tacticId ?? tallyCard.tacticId ?? null,
      battleSkillId,
      targetMode: options.targetMode ?? tallyCard.targetMode ?? BattleSkillTargetMode.EnemySingle,
      timing: options.timing ?? tallyCard.timing ?? BattleSkillTiming.ActiveCast,
      targetUnitUid: options.targetUnitUid ?? null,
      targetTileId: options.targetTileId ?? null,
      notes: [
        tallyCard.unitName ?? 'tiger-tally',
        tallyCard.unitType ?? 'unknown-unit',
        tallyCard.source?.sourceType ?? '',
      ].filter(Boolean).join('|'),
    };
  }
}