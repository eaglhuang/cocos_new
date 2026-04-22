// @spec-source → 見 docs/cross-reference-index.md
import {
  EVENT_NAMES,
  Faction,
  TroopType,
  Weather,
  BattleTactic,
} from "../../core/config/Constants";
import { GeneralUnit } from "../../core/models/GeneralUnit";
import { TroopUnit } from "../../core/models/TroopUnit";
import { BattleUnitSpawner, type TroopDataTable } from '../runtime/BattleUnitSpawner';
import { BattleState, TerrainGrid } from "../models/BattleState";
import { EnemyAI } from "./EnemyAI";
import { resolveBattleSkillTargetMode } from '../skills/BattleSkillProfiles';
import { BattleSkillSourceTranslator } from '../skills/adapters/BattleSkillSourceTranslator';
import { BattleSkillDispatcher, type GeneralSkillCastOptions } from '../runtime/BattleSkillDispatcher';
import { BattleFlowStateMachine } from './BattleFlowStateMachine';
import { BattleRuntimeOrchestrator } from '../orchestrators/BattleRuntimeOrchestrator';
import { executeBattleCombatPhase } from '../runtime/phases/BattleCombatPhase';
import { executeBattleAutoMovePhase } from '../runtime/phases/BattleAutoMovePhase';
import { executeBattleEnemyDeployPhase } from '../runtime/phases/BattleEnemyDeployPhase';
import { executeBattleSpecialResolvePhase } from '../runtime/phases/BattleSpecialResolvePhase';
import { executeBattleTileEffectPhase } from '../runtime/phases/BattleTileEffectPhase';
import { BattleCombatResolver } from '../runtime/BattleCombatResolver';
import { BattleGeneralDuelFlow } from '../runtime/BattleGeneralDuelFlow';
import { BattleTileBuffLifecycleManager, DEFAULT_BATTLE_TILE_BUFF_CONFIG, type BattleTileBuffConfig } from '../runtime/BattleTileBuffLifecycleManager';
import { resolveBattleVictory } from '../runtime/BattleVictoryResolver';
import { resolveBattleTacticBehavior } from '../shared/BattleTacticBehavior';
import { services } from "../../core/managers/ServiceLoader";
import type { BattleRuntimeContext } from '../runtime/BattleRuntimeContext';
import type { BattleRuntimePhaseName, BattleRuntimePhaseOutcome, BattleResult as RuntimeBattleResult } from '../runtime/BattleRuntimeContract';
import { createBattlePhaseExecutor, type BattlePhaseExecutor } from '../runtime/phases/BattlePhaseExecutor';
import { TurnBasedTempoController } from '../runtime/tempo/TurnBasedTempoController';
import { BattleTurnManager } from '../runtime/BattleTurnManager';
import type { TigerTallySkillCarrier, TigerTallyTacticRequestOptions } from '../skills/adapters/TigerTallyTacticAdapter';
import {
  BattleSkillTargetMode,
  SkillSourceType,
  buildIdMap,
  type CanonicalTacticDefinition,
  type JsonListEnvelope,
  type SkillExecutionResult,
} from '../../shared/SkillRuntimeContract';

export type BattleResult = RuntimeBattleResult;
/** [P2-N3] 部署失敗原因：food = 糧草不足（原 dp） */
export type DeployFailReason = "food" | "occupied" | "limit" | "battle-locked";

export interface DeployOutcome {
  ok: boolean;
  unit: TroopUnit | null;
  reason?: DeployFailReason;
}

export type { GeneralSkillCastOptions };



async function loadJsonWithFileFallback<T>(resourcePath: string, relativeFilePath: string): Promise<T | null> {
  try {
    return await services().resource.loadJson<T>(resourcePath);
  } catch {
    try {
      const fs = require('fs');
      const path = require('path');
      const absolutePath = path.resolve(__dirname, '../../../../', relativeFilePath);
      return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
    } catch {
      return null;
    }
  }
}

export class BattleController {
  private readonly runtimeOrchestrator = new BattleRuntimeOrchestrator(new TurnBasedTempoController());
  private readonly turnManager = new BattleTurnManager();
  private readonly flowStateMachine = new BattleFlowStateMachine();
  private readonly skillSourceTranslator = new BattleSkillSourceTranslator(() => this.tacticDefinitionMap);
  public readonly state = new BattleState();
  private readonly enemyAi = new EnemyAI();
  private pendingAdvanceTurnResult: BattleResult | null = null;
  private pendingEnemyTurnResult: BattleResult | null = null;
  private tileBuffConfig: BattleTileBuffConfig = DEFAULT_BATTLE_TILE_BUFF_CONFIG;
  private readonly tileBuffLifecycleManager = new BattleTileBuffLifecycleManager({
    state: this.state,
    getTileBuffConfig: () => this.tileBuffConfig,
    getBuffConsumedSinceLastSpawn: () => this.turnManager.buffConsumedSinceLastSpawn,
    setBuffConsumedSinceLastSpawn: (value) => {
      this.turnManager.buffConsumedSinceLastSpawn = value;
    },
    getBlockedBuffSpawnCells: () => this.turnManager.blockedBuffSpawnCells,
    randomInt: (min, max) => this.randomInt(min, max),
  });
  private readonly unitSpawner = new BattleUnitSpawner({
    state: this.state,
    getDuelRejectedFaction: () => this.duelRejectedFaction,
    getPlayerGeneralUnitId: () => this.playerGeneralUnitId,
    consumeTileBuff: (unit) => this.tileBuffLifecycleManager.consumeTileBuff(unit),
  });
  private tacticDefinitionMap = new Map<string, CanonicalTacticDefinition>();

  // ─── 武將單挑系統狀態 ──────────────────────────────────────────────────
  private readonly combatResolver = new BattleCombatResolver({
    state: this.state,
    turnManager: this.turnManager,
    getPlayerGeneralUnitId: () => this.playerGeneralUnitId,
    getEnemyGeneralUnitId: () => this.enemyGeneralUnitId,
    setPlayerGeneralUnitId: (unitId) => {
      this.playerGeneralUnitId = unitId;
    },
    setEnemyGeneralUnitId: (unitId) => {
      this.enemyGeneralUnitId = unitId;
    },
  });
  private readonly duelFlow = new BattleGeneralDuelFlow({
    state: this.state,
    onUnitKilled: (unit, killer, svc) => this.combatResolver.onUnitKilled(unit, killer, svc),
  });
  private readonly skillDispatcher = new BattleSkillDispatcher(
    {
      state: this.state,
      combatResolver: this.combatResolver,
      getPlayerGeneralUnitId: () => this.playerGeneralUnitId,
      getEnemyGeneralUnitId: () => this.enemyGeneralUnitId,
    },
    this.skillSourceTranslator,
  );

  /** 玩家武將化身的小兵單位 ID（null = 武將尚未出陣） */
  public get playerGeneralUnitId(): string | null {
    return this.duelFlow.playerGeneralUnitId;
  }
  public set playerGeneralUnitId(unitId: string | null) {
    this.duelFlow.playerGeneralUnitId = unitId;
  }
  /** 敵方武將化身的小兵單位 ID */
  public get enemyGeneralUnitId(): string | null {
    return this.duelFlow.enemyGeneralUnitId;
  }
  public set enemyGeneralUnitId(unitId: string | null) {
    this.duelFlow.enemyGeneralUnitId = unitId;
  }
  /** 是否正在等待玩家選擇出陣格子 */
  public get isWaitingDuelPlacement(): boolean {
    return this.duelFlow.isWaitingDuelPlacement;
  }
  public set isWaitingDuelPlacement(value: boolean) {
    this.duelFlow.isWaitingDuelPlacement = value;
  }
  /** 拒絕單挑的一方（施加懲罰用） */
  private get duelRejectedFaction(): Faction | null {
    return this.duelFlow.duelRejectedFaction;
  }
  private set duelRejectedFaction(faction: Faction | null) {
    this.duelFlow.duelRejectedFaction = faction;
  }
  /** 單挑挑戰是否已經結算過，避免每回合重複觸發 */
  private get duelChallengeResolved(): boolean {
    return this.duelFlow.duelChallengeResolved;
  }
  private set duelChallengeResolved(value: boolean) {
    this.duelFlow.duelChallengeResolved = value;
  }

  // ─── 初始化 ────────────────────────────────────────────────────────────────

  /**
   * 開始新一局戰鬥。
   * 應在呼叫此方法之前完成 loadData()。
   */
  public initBattle(
    playerGeneral: GeneralUnit,
    enemyGeneral: GeneralUnit,
    terrainGrid?: TerrainGrid,
    weather?: Weather,
    battleTactic?: BattleTactic,
  ): void {
    this.state.reset(playerGeneral, enemyGeneral, terrainGrid, weather, battleTactic);
    this.duelFlow.resetForBattle();
    this.flowStateMachine.reset();
    this.flowStateMachine.startBattle();
    this.turnManager.resetForBattle();
    this.tileBuffLifecycleManager.resetForBattle();
    this.unitSpawner.resetForBattle();
    this.pendingAdvanceTurnResult = null;
    this.pendingEnemyTurnResult = null;
    services().buff.clearAll(); // 清除上一場的狀態效果
    services().battle.beginBattle();
    this.applyStartOfBattleSceneGambit();
    this.tileBuffLifecycleManager.spawnTileBuffsForTurn();
  }

  /** 從 resources/data/troops.json 載入兵種數值表 */
  public async loadData(): Promise<void> {
    const troopData = await loadJsonWithFileFallback<TroopDataTable>('data/troops', 'assets/resources/data/troops.json');
    if (troopData) {
      this.unitSpawner.setTroopData(troopData);
    } else {
      this.unitSpawner.setTroopData({});
    }

    const tileBuffConfig = await loadJsonWithFileFallback<BattleTileBuffConfig>('data/tile-buffs', 'assets/resources/data/tile-buffs.json');
    if (tileBuffConfig) {
      this.tileBuffConfig = tileBuffConfig;
    }

    const tacticLibrary = await loadJsonWithFileFallback<JsonListEnvelope<CanonicalTacticDefinition>>(
      'data/master/tactic-library',
      'assets/resources/data/master/tactic-library.json',
    );
    if (tacticLibrary) {
      this.tacticDefinitionMap = buildIdMap(tacticLibrary.data);
    } else {
      this.tacticDefinitionMap = new Map();
    }
  }

  public deployTroop(type: TroopType, lane: number, unitName?: string): TroopUnit | null {
    return this.tryDeployTroop(type, lane, unitName).unit;
  }

  public tryDeployTroop(type: TroopType, lane: number, unitName?: string): DeployOutcome {
    if (!this.flowStateMachine.canDeployTroop()) {
      return { ok: false, unit: null, reason: "battle-locked" };
    }
    if (!this.turnManager.canDeployPlayer()) {
      return { ok: false, unit: null, reason: "limit" };
    }

    const deployDepth = 0;
    if (this.state.getCell(lane, deployDepth)?.occupantId) {
      return { ok: false, unit: null, reason: "occupied" };
    }
    if (this.combatResolver.isCellMovementBlocked(lane, deployDepth)) {
      return { ok: false, unit: null, reason: "occupied" };
    }

    const unit = this.unitSpawner.spawnUnit(type, Faction.Player, lane, deployDepth, unitName);
    this.turnManager.notePlayerDeployment();
    return { ok: true, unit };
  }

  /**
   * 玩家發動武將技能（需 SP 滿能量）。
   * 回傳 true 代表技能成功發動。
   */
  public triggerGeneralSkill(options: GeneralSkillCastOptions = {}): boolean {
    if (!this.canUsePlayerSkills()) return false;
    return this.triggerPlayerSeedTactic(options);
  }

  public canAdvanceBattleTurn(): boolean {
    return this.flowStateMachine.canAdvanceTurn();
  }

  public getPlayerSeedTacticDescriptor(): { skillId: string; tacticId: string | null; targetMode: BattleSkillTargetMode } | null {
    const general = this.state.playerGeneral;
    if (!general) {
      return null;
    }

    const translated = this.skillSourceTranslator.resolvePrimarySeedTacticDescriptor(general);
    if (translated) {
      return {
        skillId: translated.battleSkillId,
        tacticId: translated.tacticId,
        targetMode: translated.targetMode,
      };
    }

    const fallbackSkillId = general.skillId ?? general.battlePrimarySkillId ?? null;
    if (!fallbackSkillId) {
      return null;
    }

    return {
      skillId: fallbackSkillId,
      tacticId: null,
      targetMode: resolveBattleSkillTargetMode(fallbackSkillId, BattleSkillTargetMode.EnemyAll),
    };
  }

  public triggerPlayerSeedTactic(options: GeneralSkillCastOptions = {}): boolean {
    if (!this.canUsePlayerSkills()) return false;

    const general = this.state.playerGeneral;
    if (!general?.canUseSkill()) return false;

    const descriptor = this.getPlayerSeedTacticDescriptor();
    const result = this.skillDispatcher.dispatchSeedTactic(Faction.Player, {
      ...options,
      battleSkillId: options.battleSkillId ?? descriptor?.skillId ?? null,
      tacticId: options.tacticId ?? descriptor?.tacticId ?? null,
    });
    if (!result.applied) return false;

    general.currentSp = 0;
    services().event.emit(EVENT_NAMES.GeneralSpChanged, {
      faction: Faction.Player,
      sp: general.currentSp,
      maxSp: general.maxSp,
    });
    services().event.emit(EVENT_NAMES.GeneralSkillUsed, {
      faction: Faction.Player,
      skillName: result.battleSkillId,
      skillId: result.battleSkillId,
      sourceType: SkillSourceType.SeedTactic,
    });
    return true;
  }

  public triggerPlayerBattleSkill(
    skillId: string,
    sourceType: SkillSourceType,
    options: GeneralSkillCastOptions = {},
  ): boolean {
    if (!this.canUsePlayerSkills()) return false;

    if (sourceType === SkillSourceType.SeedTactic) {
      return this.triggerPlayerSeedTactic({
        ...options,
        battleSkillId: options.battleSkillId ?? skillId,
      });
    }

    const general = this.state.playerGeneral;
    if (!general?.canUseSkill() || !skillId) return false;

    const result = this.skillDispatcher.dispatchDirectBattleSkill(skillId, sourceType, Faction.Player, options);
    if (!result.applied) return false;

    general.currentSp = 0;
    services().event.emit(EVENT_NAMES.GeneralSpChanged, {
      faction: Faction.Player,
      sp: general.currentSp,
      maxSp: general.maxSp,
    });
    services().event.emit(EVENT_NAMES.GeneralSkillUsed, {
      faction: Faction.Player,
      skillName: skillId,
      skillId,
      sourceType,
    });
    return true;
  }

  /**
   * 觸發虎符來源的戰法技能（G-1 Tiger Tally）。
   * 路徑：TigerTallyTacticAdapter → BattleSkillSourceTranslator → executeBattleSkillRequest
   * 不消耗 SP；skill profile 決定傷害、穿甲或爆擊加成。
   */
  public triggerTigerTallySkill(
    tallyCard: TigerTallySkillCarrier,
    ownerUid: string,
    options: TigerTallyTacticRequestOptions,
  ): SkillExecutionResult {
    if (!this.canUsePlayerSkills()) {
      return {
        requestId: `${ownerUid}:tiger-tally-locked`,
        battleSkillId: options.battleSkillId ?? 'unknown',
        applied: false,
        blockedReason: 'battle-locked',
        deltas: [],
        battleLogLines: ['Battle flow locked: cannot cast tiger tally skill in the current phase'],
      };
    }

    const request = this.skillSourceTranslator.buildTigerTallyRequest(tallyCard, ownerUid, options);
    if (!request) {
      return {
        requestId: `${ownerUid}:tiger-tally-invalid`,
        battleSkillId: options.battleSkillId ?? 'unknown',
        applied: false,
        blockedReason: 'invalid-tally-request',
        deltas: [],
        battleLogLines: ['TigerTally: invalid carrier or missing battleSkillId'],
      };
    }
    return this.skillDispatcher.executeBattleSkillRequest(request);
  }

  // ─── 回合推進（玩家部署完畢後由 UI 呼叫）────────────────────────────────

  /**
   * 執行一個完整的回合自動流程：
   *   敵方部署 → 自動移動 → 戰鬥結算 → 特殊行動 → 勝敗判定
   *
   * 若結果為 "ongoing"，自動推進至下一回合（補充玩家糧草）。
   */
  public advanceTurn(): BattleResult {
    if (!this.flowStateMachine.beginTurnResolution()) {
      return this.flowStateMachine.result ?? 'ongoing';
    }

    const result = this.executeRuntimeTurnPlan(this.buildTurnPhaseExecutors(), false);
    this.pendingAdvanceTurnResult = result;
    return result;
  }

  public resolvePlayerTurn(): BattleResult {
    if (!this.flowStateMachine.beginTurnResolution()) {
      return this.flowStateMachine.result ?? 'ongoing';
    }

    const result = this.executeRuntimeTurnPlan(this.buildPlayerTurnPhaseExecutors(), false);
    if (result !== 'ongoing') {
      return this.commitBattleResult(result);
    }
    return result;
  }

  public resolveEnemyTurn(): BattleResult {
    const result = this.executeRuntimeTurnPlan(this.buildEnemyTurnPhaseExecutors(), false);
    this.pendingEnemyTurnResult = result;
    return result;
  }

  public finalizeEnemyTurn(): BattleResult {
    const result = this.pendingEnemyTurnResult;
    if (result === null) {
      return this.flowStateMachine.result ?? 'ongoing';
    }

    this.pendingEnemyTurnResult = null;
    if (result === 'ongoing') {
      this.finalizeRuntimeTurnCycle();
    }
    return this.commitBattleResult(result);
  }

  public finalizeAdvanceTurn(): BattleResult {
    const result = this.pendingAdvanceTurnResult;
    if (result === null) {
      return this.flowStateMachine.result ?? 'ongoing';
    }

    this.pendingAdvanceTurnResult = null;
    if (result === 'ongoing') {
      this.finalizeRuntimeTurnCycle();
    }
    return this.commitBattleResult(result);
  }

  private createBattleRuntimeContext(): BattleRuntimeContext {
    return this.createBattleRuntimeContextWithFinalize(true);
  }

  private createBattleRuntimeContextWithFinalize(finalizeTurnCycle: boolean): BattleRuntimeContext {
    return {
      state: this.state,
      battleTactic: this.state.battleTactic,
      executePhase: (phaseName) => this.executeRuntimePhase(phaseName),
      finalizeTurnCycle: () => {
        if (finalizeTurnCycle) {
          this.finalizeRuntimeTurnCycle();
        }
      },
    };
  }

  private buildTurnPhaseExecutors(): readonly BattlePhaseExecutor[] {
    return [
      ...this.buildPlayerTurnPhaseExecutors(),
      ...this.buildEnemyTurnPhaseExecutors(),
    ];
  }

  private buildPlayerTurnPhaseExecutors(): readonly BattlePhaseExecutor[] {
    return [
      createBattlePhaseExecutor('player-auto-move', (context) => context.executePhase('player-auto-move')),
      createBattlePhaseExecutor('player-tile-effect', (context) => context.executePhase('player-tile-effect')),
      createBattlePhaseExecutor('player-combat-resolve', (context) => context.executePhase('player-combat-resolve')),
      createBattlePhaseExecutor('player-special-resolve', (context) => context.executePhase('player-special-resolve')),
      createBattlePhaseExecutor('victory-check', (context) => context.executePhase('victory-check')),
    ];
  }

  private buildEnemyTurnPhaseExecutors(): readonly BattlePhaseExecutor[] {
    return [
      createBattlePhaseExecutor('enemy-deploy', (context) => context.executePhase('enemy-deploy')),
      createBattlePhaseExecutor('enemy-auto-move', (context) => context.executePhase('enemy-auto-move')),
      createBattlePhaseExecutor('enemy-tile-effect', (context) => context.executePhase('enemy-tile-effect')),
      createBattlePhaseExecutor('enemy-combat-resolve', (context) => context.executePhase('enemy-combat-resolve')),
      createBattlePhaseExecutor('enemy-special-resolve', (context) => context.executePhase('enemy-special-resolve')),
      createBattlePhaseExecutor('victory-check', (context) => context.executePhase('victory-check')),
    ];
  }

  private executeRuntimeTurnPlan(
    phaseExecutors: readonly BattlePhaseExecutor[],
    finalizeTurnCycle: boolean,
  ): BattleResult {
    return this.runtimeOrchestrator.executeTurnCycle(
      this.createBattleRuntimeContextWithFinalize(finalizeTurnCycle),
      phaseExecutors,
    );
  }

  private executeRuntimePhase(phaseName: BattleRuntimePhaseName): BattleRuntimePhaseOutcome {
    switch (phaseName) {
      case 'enemy-deploy':
        executeBattleEnemyDeployPhase({
          state: this.state,
          enemyAi: this.enemyAi,
          turnManager: this.turnManager,
          spawnEnemyUnit: (type, lane, depth) => this.unitSpawner.spawnUnit(type, Faction.Enemy, lane, depth),
          isCellMovementBlocked: (lane, depth) => this.combatResolver.isCellMovementBlocked(lane, depth),
        });
        return {};
      case 'player-auto-move':
      case 'auto-move':
        executeBattleAutoMovePhase({
          state: this.state,
          actingFaction: Faction.Player,
          turnManager: this.turnManager,
          consumeTileBuff: (unit) => this.tileBuffLifecycleManager.consumeTileBuff(unit),
          getFactionUnits: (faction) => this.combatResolver.getFactionUnits(faction),
          isCellMovementBlocked: (lane, depth) => this.combatResolver.isCellMovementBlocked(lane, depth),
          isGeneralUnit: (unitId) => this.combatResolver.isGeneralUnit(unitId),
        });
        return {};
      case 'enemy-auto-move':
        executeBattleAutoMovePhase({
          state: this.state,
          actingFaction: Faction.Enemy,
          turnManager: this.turnManager,
          consumeTileBuff: (unit) => this.tileBuffLifecycleManager.consumeTileBuff(unit),
          getFactionUnits: (faction) => this.combatResolver.getFactionUnits(faction),
          isCellMovementBlocked: (lane, depth) => this.combatResolver.isCellMovementBlocked(lane, depth),
          isGeneralUnit: (unitId) => this.combatResolver.isGeneralUnit(unitId),
        });
        return {};
      case 'player-tile-effect':
      case 'tile-effect':
        executeBattleTileEffectPhase({
          state: this.state,
          actingFaction: Faction.Player,
          playerGeneralUnitId: this.playerGeneralUnitId,
          enemyGeneralUnitId: this.enemyGeneralUnitId,
          applyUnitDamage: (unit, damage, attackerFaction, options) => this.combatResolver.applyUnitDamage(unit, damage, attackerFaction, options),
          onGeneralUnitKilled: (faction, svc) => this.combatResolver.onGeneralUnitKilled(faction, svc),
          onUnitKilled: (unit, killer, svc) => this.combatResolver.onUnitKilled(unit, killer, svc),
        });
        return {};
      case 'enemy-tile-effect':
        executeBattleTileEffectPhase({
          state: this.state,
          actingFaction: Faction.Enemy,
          playerGeneralUnitId: this.playerGeneralUnitId,
          enemyGeneralUnitId: this.enemyGeneralUnitId,
          applyUnitDamage: (unit, damage, attackerFaction, options) => this.combatResolver.applyUnitDamage(unit, damage, attackerFaction, options),
          onGeneralUnitKilled: (faction, svc) => this.combatResolver.onGeneralUnitKilled(faction, svc),
          onUnitKilled: (unit, killer, svc) => this.combatResolver.onUnitKilled(unit, killer, svc),
        });
        return {};
      case 'player-combat-resolve':
      case 'combat-resolve':
        executeBattleCombatPhase({
          state: this.state,
          actingFaction: Faction.Player,
          playerGeneralUnitId: this.playerGeneralUnitId,
          enemyGeneralUnitId: this.enemyGeneralUnitId,
          buildAttackAction: (unit, options) => this.combatResolver.buildAttackAction(unit, options),
          damageEnemyGeneral: (attacker, svc) => this.combatResolver.damageEnemyGeneral(attacker, svc),
          resolveCombat: (attacker, defender, svc) => this.combatResolver.resolveCombat(attacker, defender, svc),
          advanceAfterKill: (attacker, svc) => this.combatResolver.advanceAfterKill(attacker, svc),
          resolveActionResetAfterAttack: (attacker, didKill, actions) => this.combatResolver.resolveActionResetAfterAttack(attacker, didKill, actions),
          onGeneralUnitKilled: (faction, svc) => this.combatResolver.onGeneralUnitKilled(faction, svc),
          onUnitKilled: (unit, killer, svc) => this.combatResolver.onUnitKilled(unit, killer, svc),
        });
        return {};
      case 'enemy-combat-resolve':
        executeBattleCombatPhase({
          state: this.state,
          actingFaction: Faction.Enemy,
          playerGeneralUnitId: this.playerGeneralUnitId,
          enemyGeneralUnitId: this.enemyGeneralUnitId,
          buildAttackAction: (unit, options) => this.combatResolver.buildAttackAction(unit, options),
          damageEnemyGeneral: (attacker, svc) => this.combatResolver.damageEnemyGeneral(attacker, svc),
          resolveCombat: (attacker, defender, svc) => this.combatResolver.resolveCombat(attacker, defender, svc),
          advanceAfterKill: (attacker, svc) => this.combatResolver.advanceAfterKill(attacker, svc),
          resolveActionResetAfterAttack: (attacker, didKill, actions) => this.combatResolver.resolveActionResetAfterAttack(attacker, didKill, actions),
          onGeneralUnitKilled: (faction, svc) => this.combatResolver.onGeneralUnitKilled(faction, svc),
          onUnitKilled: (unit, killer, svc) => this.combatResolver.onUnitKilled(unit, killer, svc),
        });
        return {};
      case 'player-special-resolve':
        executeBattleSpecialResolvePhase({
          state: this.state,
          actingFaction: Faction.Player,
          turnManager: this.turnManager,
          castEnemySeedTactic: (battleSkillId) => this.skillDispatcher.dispatchSeedTactic(Faction.Enemy, { battleSkillId }),
        });
        return {};
      case 'enemy-special-resolve':
      case 'special-resolve':
        executeBattleSpecialResolvePhase({
          state: this.state,
          actingFaction: Faction.Enemy,
          turnManager: this.turnManager,
          castEnemySeedTactic: (battleSkillId) => this.skillDispatcher.dispatchSeedTactic(Faction.Enemy, { battleSkillId }),
        });
        if (phaseName === 'enemy-special-resolve' && this.state.battleTactic === BattleTactic.FloodAttack) {
          resolveBattleTacticBehavior(this.state.battleTactic).advanceTurn(this.state, {
            turnManager: this.turnManager,
            applyUnitDamage: (unit, damage, attackerFaction, options) => this.combatResolver.applyUnitDamage(unit, damage, attackerFaction, options),
            onGeneralUnitKilled: (faction, combatSvc) => this.combatResolver.onGeneralUnitKilled(faction, combatSvc),
            onUnitKilled: (unit, killer, combatSvc) => this.combatResolver.onUnitKilled(unit, killer, combatSvc),
          });
        }
        return {};
      case 'victory-check': {
        const result = this.checkVictory();
        return { result };
      }
      default:
        return {};
    }
  }

  private finalizeRuntimeTurnCycle(): void {
    const svc = services();
    svc.buff.tickBuff();
    if (this.state.battleTactic !== BattleTactic.FloodAttack) {
      resolveBattleTacticBehavior(this.state.battleTactic).advanceTurn(this.state, {
        turnManager: this.turnManager,
        applyUnitDamage: (unit, damage, attackerFaction, options) => this.combatResolver.applyUnitDamage(unit, damage, attackerFaction, options),
        onGeneralUnitKilled: (faction, combatSvc) => this.combatResolver.onGeneralUnitKilled(faction, combatSvc),
        onUnitKilled: (unit, killer, combatSvc) => this.combatResolver.onUnitKilled(unit, killer, combatSvc),
      });
    }
    svc.battle.nextTurn();
    this.turnManager.refreshForNextTurn();
    this.tileBuffLifecycleManager.spawnTileBuffsForTurn();
  }

  private commitBattleResult(result: BattleResult): BattleResult {
    this.flowStateMachine.commitBattleResult(result);
    return result;
  }

  // ─── 階段：敵方部署 ───────────────────────────────────────────────────────

  private applyStartOfBattleSceneGambit(): void {
    resolveBattleTacticBehavior(this.state.battleTactic).applyStartOfBattle(this.state);
  }

  // ─── 階段：特殊行動 ───────────────────────────────────────────────────────

  // ─── 勝敗判定 ─────────────────────────────────────────────────────────────

  private canUsePlayerSkills(): boolean {
    return this.flowStateMachine.canUsePlayerSkills();
  }

  private canRequestGeneralDuel(): boolean {
    return this.flowStateMachine.canRequestGeneralDuel();
  }

  private checkVictory(): BattleResult {
    return resolveBattleVictory(this.state);
  }

  private randomInt(min: number, max: number): number {
    if (max <= min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ─── 武將單挑系統 ─────────────────────────────────────────────────────────

  /**
   * 檢查玩家武將是否可以出陣（前排 depth=0 沒有我方小兵）。
   */
  public canPlayerGeneralDuel(): boolean {
    return this.duelFlow.canPlayerGeneralDuel();
  }

  /**
   * 開始武將出陣流程：進入等待玩家選擇棋盤空格的狀態。
   * @returns "ok" | "already-deployed" | "front-blocked" | "general-dead"
   */
  public startGeneralDuel(): string {
    if (this.flowStateMachine.isFinished()) {
      return 'battle-ended';
    }
    if (!this.canRequestGeneralDuel()) {
      return 'battle-locked';
    }

    const result = this.duelFlow.startGeneralDuel();
    if (result === 'ok') {
      this.flowStateMachine.beginGeneralDuelPlacement();
    }
    return result;
  }

  /**
   * 玩家武將放置到指定格子（點擊棋盤後調用）。
   * @returns 成功回傳武將化身的 TroopUnit，失敗回傳 null
   */
  public placeGeneralOnBoard(lane: number, depth: number): TroopUnit | null {
    if (!this.flowStateMachine.isGeneralDuelPlacement()) {
      return null;
    }

    const unit = this.duelFlow.placeGeneralOnBoard(lane, depth);
    if (unit) {
      this.flowStateMachine.completeGeneralDuelPlacement();
    }
    return unit;
  }

  /**
   * 判斷武將是否已到達敵將面前（可觸發單挑邀請）。
   */
  public isGeneralFacingEnemyGeneral(faction: Faction): boolean {
    return this.duelFlow.isGeneralFacingEnemyGeneral(faction);
  }

  /**
   * 處理單挑邀請結果。
   * @param challengerFaction 發起單挑的一方
   * @param accepted 對方是否接受
   */
  public resolveDuelChallenge(challengerFaction: Faction, accepted: boolean): BattleResult {
    this.duelFlow.resolveDuelChallenge(challengerFaction, accepted);
    return this.commitBattleResult(this.checkVictory());
  }

  /**
   * 取得拒絕單挑的陣營（用於新部署小兵時自動施加懲罰減半）。
   */
  public getDuelRejectedFaction(): Faction | null {
    return this.duelFlow.getDuelRejectedFaction();
  }

  public isDuelChallengeResolved(): boolean {
    return this.duelFlow.isDuelChallengeResolved();
  }

  /**
   * 單挑接受決策（由防守方視角評估）：
   * score = 0.45 * 主將血量優勢 + 0.35 * 場上兵力優勢 + 0.2 * 總戰力優勢
   */
  public evaluateDuelAcceptance(challengerFaction: Faction): {
    accepted: boolean;
    score: number;
    defenderFaction: Faction;
  } {
    return this.duelFlow.evaluateDuelAcceptance(challengerFaction);
  }
}
