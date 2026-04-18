import { Faction } from '../../../core/config/Constants';
import type { BattleSkillRequest, SkillExecutionResult } from '../../../shared/SkillRuntimeContract';
import { resolveBattleSkillProfile } from '../BattleSkillProfiles';
import type { BattleSkillExecutionContext, BattleSkillResolver } from '../BattleSkillResolver';
import { BattleSkillTargetSelector } from '../BattleSkillTargetSelector';

export class LinkSkillResolver implements BattleSkillResolver {
  constructor(private readonly targetSelector = new BattleSkillTargetSelector()) {}

  public canResolve(request: BattleSkillRequest): boolean {
    return resolveBattleSkillProfile(request.battleSkillId)?.effectKind === 'link';
  }

  public execute(
    request: BattleSkillRequest,
    context: BattleSkillExecutionContext,
  ): SkillExecutionResult {
    const profile = resolveBattleSkillProfile(request.battleSkillId);
    if (!profile || profile.effectKind !== 'link') {
      return {
        requestId: `${request.ownerUid}:${request.battleSkillId}`,
        battleSkillId: request.battleSkillId,
        applied: false,
        blockedReason: 'missing-skill-profile',
        deltas: [],
        battleLogLines: [`Missing link skill profile for ${request.battleSkillId}`],
      };
    }

    const casterFaction = request.ownerUid === Faction.Enemy ? Faction.Enemy : Faction.Player;
    const primaryTarget = this.targetSelector.selectTargets(request, profile, context)[0] ?? null;
    if (!primaryTarget) {
      return {
        requestId: `${request.ownerUid}:${request.battleSkillId}`,
        battleSkillId: request.battleSkillId,
        applied: false,
        blockedReason: 'no-target',
        deltas: [],
        battleLogLines: [`${request.battleSkillId} found no target`],
      };
    }

    const linkedUnits = context
      .getOpposingUnits(casterFaction)
      .filter((unit) => unit.id !== primaryTarget.id && !unit.isDead())
      .filter((unit) => {
        const laneDelta = Math.abs(unit.lane - primaryTarget.lane);
        const depthDelta = Math.abs(unit.depth - primaryTarget.depth);
        return Math.max(laneDelta, depthDelta) <= (profile.linkRadius ?? 1);
      })
      .sort((left, right) => {
        const leftDistance = Math.max(Math.abs(left.lane - primaryTarget.lane), Math.abs(left.depth - primaryTarget.depth));
        const rightDistance = Math.max(Math.abs(right.lane - primaryTarget.lane), Math.abs(right.depth - primaryTarget.depth));
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }
        if (left.depth !== right.depth) {
          return left.depth - right.depth;
        }
        if (left.lane !== right.lane) {
          return left.lane - right.lane;
        }
        return left.id.localeCompare(right.id);
      })
      .slice(0, profile.linkMaxTargets ?? Number.MAX_SAFE_INTEGER);

    if (!linkedUnits.length) {
      return {
        requestId: `${request.ownerUid}:${request.battleSkillId}`,
        battleSkillId: request.battleSkillId,
        applied: false,
        blockedReason: 'no-link-target',
        deltas: [],
        battleLogLines: [`${request.battleSkillId} found no linked target`],
      };
    }

    context.registerDamageLink(primaryTarget, linkedUnits, profile.linkShareRatio ?? 0.5, request.battleSkillId);
    context.emitSkillEffect(request.battleSkillId, casterFaction);

    return {
      requestId: `${request.ownerUid}:${request.battleSkillId}`,
      battleSkillId: request.battleSkillId,
      applied: true,
      deltas: [
        {
          unitUid: primaryTarget.id,
          notes: `link:${linkedUnits.map((unit) => unit.id).join(',')}`,
        },
      ],
      battleLogLines: linkedUnits.map((unit) => `${profile.battleLogKey ?? request.battleSkillId}:${primaryTarget.id}->${unit.id}:${profile.linkShareRatio ?? 0.5}`),
    };
  }
}