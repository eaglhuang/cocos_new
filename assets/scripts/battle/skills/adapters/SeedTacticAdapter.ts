import type { GeneralTacticSlotConfig, GeneralUnit } from '../../../core/models/GeneralUnit';
import {
  BattleSkillTargetMode,
  BattleSkillTiming,
  SkillSourceType,
  type BattleSkillRequest,
  type CanonicalTacticDefinition,
} from '../../../shared/SkillRuntimeContract';
import { resolveBattleSkillTargetMode } from '../BattleSkillProfiles';

export interface SeedTacticRequestOptions {
  tacticId?: string | null;
  battleSkillId?: string | null;
  targetMode?: BattleSkillTargetMode;
  targetUnitUid?: string | null;
  targetTileId?: string | null;
  triggeredByUnitUid?: string | null;
}

interface ResolvedSeedTacticSlot {
  slot: GeneralTacticSlotConfig;
  tactic: CanonicalTacticDefinition;
  battleSkillId: string;
}

export class SeedTacticAdapter {
  constructor(private readonly tacticDefinitionsById: Map<string, CanonicalTacticDefinition>) {}

  public buildRequest(
    general: GeneralUnit,
    ownerUid: string,
    options: SeedTacticRequestOptions = {},
  ): BattleSkillRequest | null {
    const resolved = this.resolveSlot(general, options);
    if (!resolved) {
      return null;
    }

    return {
      sourceType: resolved.tactic.sourceType ?? SkillSourceType.SeedTactic,
      ownerUid,
      generalTemplateId: general.id,
      tacticId: resolved.tactic.id,
      battleSkillId: resolved.battleSkillId,
      targetMode: options.targetMode
        ?? resolved.tactic.targetMode
        ?? resolveBattleSkillTargetMode(resolved.battleSkillId, BattleSkillTargetMode.EnemyAll),
      timing: resolved.tactic.timing ?? BattleSkillTiming.ActiveCast,
      targetUnitUid: options.targetUnitUid ?? null,
      targetTileId: options.targetTileId ?? null,
      triggeredByUnitUid: options.triggeredByUnitUid ?? null,
      notes: resolved.slot.slotId,
    };
  }

  public resolvePrimaryBattleSkillId(general: GeneralUnit): string | null {
    return this.resolveSlot(general)?.battleSkillId ?? null;
  }

  private resolveSlot(
    general: GeneralUnit,
    options: SeedTacticRequestOptions = {},
  ): ResolvedSeedTacticSlot | null {
    const candidates = (general.tacticSlots ?? [])
      .map((slot) => this.resolveCandidate(slot))
      .filter((candidate): candidate is ResolvedSeedTacticSlot => candidate !== null);

    if (candidates.length === 0) {
      return null;
    }

    if (options.tacticId) {
      return candidates.find((candidate) => candidate.tactic.id === options.tacticId) ?? null;
    }

    if (options.battleSkillId) {
      return candidates.find((candidate) => candidate.battleSkillId === options.battleSkillId) ?? null;
    }

    return candidates[0] ?? null;
  }

  private resolveCandidate(slot: GeneralTacticSlotConfig): ResolvedSeedTacticSlot | null {
    const tactic = this.tacticDefinitionsById.get(slot.tacticId);
    const battleSkillId = tactic?.battleSkillId ?? null;
    if (!tactic || !battleSkillId) {
      return null;
    }

    return {
      slot,
      tactic,
      battleSkillId,
    };
  }
}