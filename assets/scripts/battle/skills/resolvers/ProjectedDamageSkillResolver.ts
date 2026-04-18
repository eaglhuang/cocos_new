import { Faction } from '../../../core/config/Constants';
import { BattleSkillTargetMode, type BattleSkillRequest, type SkillExecutionResult } from '../../../shared/SkillRuntimeContract';
import { BattleSkillDamageResolver } from '../BattleSkillDamageResolver';
import { resolveBattleSkillProfile } from '../BattleSkillProfiles';
import type { BattleSkillExecutionContext, BattleSkillResolver } from '../BattleSkillResolver';
import { BattleSkillTargetSelector } from '../BattleSkillTargetSelector';

export class ProjectedDamageSkillResolver implements BattleSkillResolver {
  constructor(
    private readonly targetSelector = new BattleSkillTargetSelector(),
    private readonly damageResolver = new BattleSkillDamageResolver(),
  ) {}

  public canResolve(request: BattleSkillRequest): boolean {
    const profile = resolveBattleSkillProfile(request.battleSkillId);
    if (profile?.effectKind && profile.effectKind !== 'damage') {
      return false;
    }
    return profile != null && [
      BattleSkillTargetMode.EnemyAll,
      BattleSkillTargetMode.EnemySingle,
      BattleSkillTargetMode.Line,
      BattleSkillTargetMode.Fan,
      BattleSkillTargetMode.Tile,
      BattleSkillTargetMode.Area,
      BattleSkillTargetMode.AdjacentTiles,
    ].includes(profile.targetMode);
  }

  public execute(
    request: BattleSkillRequest,
    context: BattleSkillExecutionContext,
  ): SkillExecutionResult {
    const profile = resolveBattleSkillProfile(request.battleSkillId);
    if (!profile) {
      return {
        requestId: `${request.ownerUid}:${request.battleSkillId}`,
        battleSkillId: request.battleSkillId,
        applied: false,
        blockedReason: 'missing-skill-profile',
        deltas: [],
        battleLogLines: [`Missing battle skill profile for ${request.battleSkillId}`],
      };
    }

    const casterFaction = this.resolveCasterFaction(request);
    const caster = context.getCasterGeneral(casterFaction);
    if (!caster) {
      return {
        requestId: `${request.ownerUid}:${request.battleSkillId}`,
        battleSkillId: request.battleSkillId,
        applied: false,
        blockedReason: 'missing-caster-general',
        deltas: [],
        battleLogLines: [`Missing caster general for ${request.battleSkillId}`],
      };
    }

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
    let hitCount = 0;

    for (const unit of targets) {
      if (unit.isDead()) {
        continue;
      }

      const damage = this.damageResolver.resolveDamage(profile, caster, unit, context, hitCount);
      hitCount += 1;
      context.applyDamage(unit, damage, casterFaction);
      deltas.push({ unitUid: unit.id, deltaHp: -damage });
      battleLogLines.push(`${profile.battleLogKey ?? request.battleSkillId}:${unit.id}:${damage}`);
    }

    if (!hitCount) {
      return {
        requestId: `${request.ownerUid}:${request.battleSkillId}`,
        battleSkillId: request.battleSkillId,
        applied: false,
        blockedReason: 'all-targets-dead',
        deltas: [],
        battleLogLines: [`${request.battleSkillId} skipped because all targets were dead`],
      };
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

  private resolveCasterFaction(request: BattleSkillRequest): Faction {
    return request.ownerUid === Faction.Enemy ? Faction.Enemy : Faction.Player;
  }
}
