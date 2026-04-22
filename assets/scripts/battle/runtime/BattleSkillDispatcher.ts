import {
  EVENT_NAMES,
  Faction,
  GAME_CONFIG,
  StatusEffect,
  TerrainType,
} from '../../core/config/Constants';
import { TroopUnit } from '../../core/models/TroopUnit';
import { BattleState } from '../models/BattleState';
import { BattleCombatResolver } from './BattleCombatResolver';
import { resolveBattleSkillTargetMode } from '../skills/BattleSkillProfiles';
import { BattleSkillSourceTranslator } from '../skills/adapters/BattleSkillSourceTranslator';
import type { BattleSkillExecutionContext } from '../skills/BattleSkillResolver';
import { BattleSkillExecutor } from '../skills/BattleSkillExecutor';
import { createDefaultBattleSkillExecutor } from '../skills/BattleSkillResolverFactory';
import {
  BattleSkillTargetMode,
  BattleSkillTiming,
  SkillSourceType,
  type BattleSkillRequest,
  type SkillExecutionResult,
} from '../../shared/SkillRuntimeContract';
import { services } from '../../core/managers/ServiceLoader';

export interface GeneralSkillCastOptions {
  tacticId?: string | null;
  battleSkillId?: string | null;
  targetMode?: BattleSkillTargetMode;
  targetUnitUid?: string | null;
  targetTileId?: string | null;
}

export interface BattleSkillDispatcherContext {
  readonly state: BattleState;
  readonly combatResolver: BattleCombatResolver;
  getPlayerGeneralUnitId(): string | null;
  getEnemyGeneralUnitId(): string | null;
}

/** 負責技能分發與執行上下文建立（seed tactic、direct skill、skill request 執行、context builder） */
export class BattleSkillDispatcher {
  private readonly skillExecutor: BattleSkillExecutor = createDefaultBattleSkillExecutor();

  constructor(
    private readonly context: BattleSkillDispatcherContext,
    private readonly skillSourceTranslator: BattleSkillSourceTranslator,
  ) {}

  /**
   * 根據武將的 skillId 分發至具體技能實作。
   * 若 resolver 判定沒有合法 target，回傳 applied=false，呼叫端不可先扣 SP。
   */
  public dispatchDirectBattleSkill(
    skillId: string | null,
    sourceType: SkillSourceType,
    casterFaction: Faction,
    options: GeneralSkillCastOptions = {},
  ): SkillExecutionResult {
    if (!skillId) {
      return {
        requestId: `${casterFaction}:missing-skill`,
        battleSkillId: 'missing-skill',
        applied: false,
        blockedReason: 'missing-skill-id',
        deltas: [],
        battleLogLines: ['Missing general skill id'],
      };
    }
    const general = this.context.state.getGeneral(casterFaction);
    if (!general) {
      return {
        requestId: `${casterFaction}:${skillId}`,
        battleSkillId: skillId,
        applied: false,
        blockedReason: 'missing-caster-general',
        deltas: [],
        battleLogLines: [`Missing caster general for ${skillId}`],
      };
    }

    return this.executeBattleSkillRequest({
      sourceType,
      ownerUid: casterFaction,
      generalTemplateId: general.id,
      battleSkillId: skillId,
      targetMode: options.targetMode ?? resolveBattleSkillTargetMode(skillId, BattleSkillTargetMode.EnemyAll),
      timing: BattleSkillTiming.ActiveCast,
      targetUnitUid: options.targetUnitUid ?? null,
      targetTileId: options.targetTileId ?? null,
    });
  }

  public dispatchSeedTactic(
    casterFaction: Faction,
    options: GeneralSkillCastOptions = {},
  ): SkillExecutionResult {
    const general = this.context.state.getGeneral(casterFaction);
    if (!general) {
      return {
        requestId: `${casterFaction}:missing-seed-general`,
        battleSkillId: options.battleSkillId ?? 'missing-seed-skill',
        applied: false,
        blockedReason: 'missing-caster-general',
        deltas: [],
        battleLogLines: ['Missing caster general for seed tactic'],
      };
    }

    const request = this.skillSourceTranslator.buildSeedTacticRequest(general, casterFaction, {
      tacticId: options.tacticId ?? null,
      battleSkillId: options.battleSkillId ?? general.skillId ?? general.battlePrimarySkillId ?? null,
      targetMode: options.targetMode,
      targetUnitUid: options.targetUnitUid ?? null,
      targetTileId: options.targetTileId ?? null,
    });

    if (request) {
      return this.executeBattleSkillRequest(request);
    }

    return this.dispatchDirectBattleSkill(
      options.battleSkillId ?? general.skillId ?? general.battlePrimarySkillId ?? null,
      SkillSourceType.SeedTactic,
      casterFaction,
      options,
    );
  }

  public executeBattleSkillRequest(request: BattleSkillRequest): SkillExecutionResult {
    return this.skillExecutor.execute(request, this.buildBattleSkillExecutionContext());
  }

  public buildBattleSkillExecutionContext(): BattleSkillExecutionContext {
    const { state, combatResolver } = this.context;
    return {
      getFactionUnits: (faction: Faction) => combatResolver.getFactionUnits(faction),
      getOpposingUnits: (casterFaction: Faction) => {
        const targetFaction = casterFaction === Faction.Player ? Faction.Enemy : Faction.Player;
        return combatResolver.getFactionUnits(targetFaction);
      },
      getBoardCells: () => {
        const cells = [] as Array<{ lane: number; depth: number }>;
        for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
          for (let depth = 0; depth < GAME_CONFIG.GRID_DEPTH; depth++) {
            cells.push({ lane, depth });
          }
        }
        return cells;
      },
      getUnit: (unitId: string) => state.units.get(unitId) ?? null,
      getCasterGeneral: (casterFaction: Faction) => state.getGeneral(casterFaction),
      getTerrain: (lane: number, depth: number) => state.getCell(lane, depth)?.terrain ?? TerrainType.Plain,
      applyDamage: (unit: TroopUnit, damage: number, casterFaction: Faction) => {
        const svc = services();
        combatResolver.applyUnitDamage(unit, damage, casterFaction, {
          attackerId: null,
          attackerLane: null,
          attackerDepth: null,
          allowDamageLink: true,
        });
        if (unit.isDead()) {
          if (unit.id === this.context.getPlayerGeneralUnitId()) {
            combatResolver.onGeneralUnitKilled(Faction.Player, svc);
          } else if (unit.id === this.context.getEnemyGeneralUnitId()) {
            combatResolver.onGeneralUnitKilled(Faction.Enemy, svc);
          }
          combatResolver.onUnitKilled(unit, null, svc);
        }
      },
      healUnit: (unit: TroopUnit, amount: number, casterFaction: Faction) => {
        const svc = services();
        unit.heal(amount);
        svc.event.emit(EVENT_NAMES.UnitHealed, {
          unitId: unit.id,
          amount,
          hp: unit.currentHp,
          sourceId: state.getGeneral(casterFaction)?.id ?? 'unknown',
          lane: unit.lane,
          depth: unit.depth,
        });
      },
      applyBuff: (unit: TroopUnit, effect: StatusEffect, turns: number) => {
        const svc = services();
        svc.buff.applyBuff(unit.id, effect, turns);
        svc.event.emit(EVENT_NAMES.BuffApplied, {
          unitId: unit.id,
          effect,
          turns,
        });
      },
      registerDamageLink: (primaryUnit: TroopUnit, linkedUnits: TroopUnit[], shareRatio: number, battleSkillId: string) => {
        state.setDamageLink({
          primaryUnitUid: primaryUnit.id,
          linkedUnitUids: linkedUnits.map((unit) => unit.id),
          shareRatio,
          battleSkillId,
        });
      },
      registerCounterReaction: (targetUnit: TroopUnit, battleSkillId: string, counterRatio: number, statusTurns: number, triggers: number, meleeOnly: boolean) => {
        state.setCounterReaction({
          unitUid: targetUnit.id,
          battleSkillId,
          counterRatio,
          statusTurns,
          remainingTriggers: triggers,
          meleeOnly,
        });
      },
      registerActionReset: (targetUnit: TroopUnit, battleSkillId: string, firstHitMultiplier: number, extraActions: number) => {
        state.setActionReset({
          unitUid: targetUnit.id,
          battleSkillId,
          firstHitMultiplier,
          firstHitPending: true,
          remainingExtraActions: extraActions,
        });
      },
      emitSkillEffect: (resolvedSkillId: string, casterFaction: Faction) => {
        services().event.emit(EVENT_NAMES.GeneralSkillEffect, {
          skillId: resolvedSkillId,
          faction: casterFaction,
        });
      },
    };
  }
}
