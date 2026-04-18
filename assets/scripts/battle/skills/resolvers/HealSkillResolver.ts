import { Faction } from '../../../core/config/Constants';
import { FormulaSystem } from '../../../core/systems/FormulaSystem';
import type { BattleSkillRequest, SkillExecutionResult } from '../../../shared/SkillRuntimeContract';
import { resolveBattleSkillProfile } from '../BattleSkillProfiles';
import type { BattleSkillExecutionContext, BattleSkillResolver } from '../BattleSkillResolver';
import { BattleSkillTargetSelector } from '../BattleSkillTargetSelector';

export class HealSkillResolver implements BattleSkillResolver {
  constructor(
    private readonly targetSelector = new BattleSkillTargetSelector(),
    private readonly formulaSystem = new FormulaSystem(),
  ) {}

  public canResolve(request: BattleSkillRequest): boolean {
    return resolveBattleSkillProfile(request.battleSkillId)?.effectKind === 'heal';
  }

  public execute(
    request: BattleSkillRequest,
    context: BattleSkillExecutionContext,
  ): SkillExecutionResult {
    const profile = resolveBattleSkillProfile(request.battleSkillId);
    if (!profile || profile.effectKind !== 'heal') {
      return {
        requestId: `${request.ownerUid}:${request.battleSkillId}`,
        battleSkillId: request.battleSkillId,
        applied: false,
        blockedReason: 'missing-skill-profile',
        deltas: [],
        battleLogLines: [`Missing heal skill profile for ${request.battleSkillId}`],
      };
    }

    const casterFaction = request.ownerUid === Faction.Enemy ? Faction.Enemy : Faction.Player;
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

    const healAmount = this.formulaSystem.calculateHeal(caster.maxHp, profile.healRatio ?? 0.12, profile.healFloor ?? 20);
    const deltas: SkillExecutionResult['deltas'] = [];
    const battleLogLines: string[] = [];

    for (const unit of targets) {
      if (unit.isDead()) {
        continue;
      }
      context.healUnit(unit, healAmount, casterFaction);
      deltas.push({ unitUid: unit.id, deltaHp: healAmount });
      battleLogLines.push(`${profile.battleLogKey ?? request.battleSkillId}:${unit.id}:${healAmount}`);
    }

    if (!deltas.length) {
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
}