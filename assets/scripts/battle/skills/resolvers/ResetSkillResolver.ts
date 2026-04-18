import { Faction } from '../../../core/config/Constants';
import type { BattleSkillRequest, SkillExecutionResult } from '../../../shared/SkillRuntimeContract';
import { resolveBattleSkillProfile } from '../BattleSkillProfiles';
import type { BattleSkillExecutionContext, BattleSkillResolver } from '../BattleSkillResolver';
import { BattleSkillTargetSelector } from '../BattleSkillTargetSelector';

export class ResetSkillResolver implements BattleSkillResolver {
  constructor(private readonly targetSelector = new BattleSkillTargetSelector()) {}

  public canResolve(request: BattleSkillRequest): boolean {
    return resolveBattleSkillProfile(request.battleSkillId)?.effectKind === 'reset';
  }

  public execute(
    request: BattleSkillRequest,
    context: BattleSkillExecutionContext,
  ): SkillExecutionResult {
    const profile = resolveBattleSkillProfile(request.battleSkillId);
    if (!profile || profile.effectKind !== 'reset') {
      return {
        requestId: `${request.ownerUid}:${request.battleSkillId}`,
        battleSkillId: request.battleSkillId,
        applied: false,
        blockedReason: 'missing-skill-profile',
        deltas: [],
        battleLogLines: [`Missing reset skill profile for ${request.battleSkillId}`],
      };
    }

    const casterFaction = request.ownerUid === Faction.Enemy ? Faction.Enemy : Faction.Player;
    const targets = this.targetSelector.selectTargets(request, profile, context);
    if (!targets.length) {
      return {
        requestId: `${request.ownerUid}:${request.battleSkillId}`,
        battleSkillId: request.battleSkillId,
        applied: false,
        blockedReason: 'no-target',
        deltas: [],
        battleLogLines: [`${request.battleSkillId} found no target`],
      };
    }

    const deltas: SkillExecutionResult['deltas'] = [];
    const battleLogLines: string[] = [];
    for (const unit of targets) {
      context.registerActionReset(
        unit,
        request.battleSkillId,
        profile.resetFirstHitMultiplier ?? 2,
        profile.resetExtraActions ?? 1,
      );
      deltas.push({ unitUid: unit.id, notes: `reset:${request.battleSkillId}` });
      battleLogLines.push(`${profile.battleLogKey ?? request.battleSkillId}:${unit.id}:${profile.resetFirstHitMultiplier ?? 2}`);
    }

    context.emitSkillEffect(request.battleSkillId, casterFaction);

    return {
      requestId: `${request.ownerUid}:${request.battleSkillId}`,
      battleSkillId: request.battleSkillId,
      applied: true,
      deltas,
      battleLogLines,
    };
  }
}