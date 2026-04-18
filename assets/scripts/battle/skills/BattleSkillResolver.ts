import { Faction, StatusEffect, TerrainType } from '../../core/config/Constants';
import { GeneralUnit } from '../../core/models/GeneralUnit';
import { TroopUnit } from '../../core/models/TroopUnit';
import type { BattleSkillRequest, SkillExecutionResult } from '../../shared/SkillRuntimeContract';
import type { BattleSkillCellRef } from './BattleSkillTargetSelector';

export interface BattleSkillExecutionContext {
  getFactionUnits(faction: Faction): TroopUnit[];
  getOpposingUnits(casterFaction: Faction): TroopUnit[];
  getBoardCells(): BattleSkillCellRef[];
  getUnit(unitId: string): TroopUnit | null;
  getCasterGeneral(casterFaction: Faction): GeneralUnit | null;
  getTerrain(lane: number, depth: number): TerrainType;
  applyDamage(unit: TroopUnit, damage: number, casterFaction: Faction): void;
  healUnit(unit: TroopUnit, amount: number, casterFaction: Faction): void;
  applyBuff(unit: TroopUnit, effect: StatusEffect, turns: number): void;
  registerDamageLink(primaryUnit: TroopUnit, linkedUnits: TroopUnit[], shareRatio: number, battleSkillId: string): void;
  registerCounterReaction(targetUnit: TroopUnit, battleSkillId: string, counterRatio: number, statusTurns: number, triggers: number, meleeOnly: boolean): void;
  registerActionReset(targetUnit: TroopUnit, battleSkillId: string, firstHitMultiplier: number, extraActions: number): void;
  emitSkillEffect(skillId: string, casterFaction: Faction): void;
}

export interface BattleSkillResolver {
  canResolve(request: BattleSkillRequest): boolean;
  execute(request: BattleSkillRequest, context: BattleSkillExecutionContext): SkillExecutionResult;
}
