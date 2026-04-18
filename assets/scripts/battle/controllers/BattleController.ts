// @spec-source → 見 docs/cross-reference-index.md
import {
  EVENT_NAMES,
  Faction,
  GAME_CONFIG,
  StatusEffect,
  TerrainType,
  TroopType,
  Weather,
  type BattleTactic,
} from "../../core/config/Constants";
import type { Color } from "cc";
import { services } from "../../core/managers/ServiceLoader";
import { GeneralUnit } from "../../core/models/GeneralUnit";
import { TroopUnit, TroopStats } from "../../core/models/TroopUnit";
import { BattleState, TerrainGrid, TileBuff, type TileEffect } from "../models/BattleState";
import { EnemyAI } from "./EnemyAI";
import { createDefaultBattleSkillExecutor } from '../skills/BattleSkillResolverFactory';
import { resolveBattleSkillTargetMode } from '../skills/BattleSkillProfiles';
import { BattleSkillSourceTranslator } from '../skills/adapters/BattleSkillSourceTranslator';
import { BattleRuntimeOrchestrator } from '../orchestrators/BattleRuntimeOrchestrator';
import { executeBattleCombatPhase } from '../runtime/phases/BattleCombatPhase';
import { executeBattleAutoMovePhase } from '../runtime/phases/BattleAutoMovePhase';
import { executeBattleEnemyDeployPhase } from '../runtime/phases/BattleEnemyDeployPhase';
import { BattleDuelResolver } from '../runtime/BattleDuelResolver';
import { executeBattleSpecialResolvePhase } from '../runtime/phases/BattleSpecialResolvePhase';
import { executeBattleTileEffectPhase } from '../runtime/phases/BattleTileEffectPhase';
import { BattleCombatResolver } from '../runtime/BattleCombatResolver';
import { resolveBattleVictory } from '../runtime/BattleVictoryResolver';
import { consumeBattleTileBuff } from '../runtime/BattleTileBuffSystem';
import { resolveBattleTacticBehavior } from '../shared/BattleTacticBehavior';
import type { BattleRuntimeContext } from '../runtime/BattleRuntimeContext';
import type { BattleRuntimePhaseName, BattleRuntimePhaseOutcome, BattleResult as RuntimeBattleResult } from '../runtime/BattleRuntimeContract';
import { createBattlePhaseExecutor, type BattlePhaseExecutor } from '../runtime/phases/BattlePhaseExecutor';
import { TurnBasedTempoController } from '../runtime/tempo/TurnBasedTempoController';
import { BattleTurnManager } from '../runtime/BattleTurnManager';
import type { TigerTallySkillCarrier, TigerTallyTacticRequestOptions } from '../skills/adapters/TigerTallyTacticAdapter';
import type { BattleSkillExecutionContext } from '../skills/BattleSkillResolver';
import {
  BattleSkillTargetMode,
  BattleSkillTiming,
  SkillSourceType,
  buildIdMap,
  type CanonicalTacticDefinition,
  type JsonListEnvelope,
  type SkillExecutionResult,
} from '../../shared/SkillRuntimeContract';

export type BattleResult = RuntimeBattleResult;
/** [P2-N3] 部署失敗原因：food = 糧草不足（原 dp） */
export type DeployFailReason = "food" | "occupied" | "limit";

export interface DeployOutcome {
  ok: boolean;
  unit: TroopUnit | null;
  reason?: DeployFailReason;
}

export interface GeneralSkillCastOptions {
  tacticId?: string | null;
  battleSkillId?: string | null;
  targetMode?: BattleSkillTargetMode;
  targetUnitUid?: string | null;
  targetTileId?: string | null;
}

/** troops.json 的 key 是 TroopType 字串，value 是 TroopStats */
type TroopDataTable = Partial<Record<TroopType, TroopStats>>;

/** 各陣營的前進方向（depth 增量） */
const FORWARD_DIR: Record<Faction, number> = {
  [Faction.Player]: 1,   // 玩家向 depth 增加方向前進（0 → 7）
  [Faction.Enemy]:  -1,  // 敵方向 depth 減少方向前進（7 → 0）
};

/** 各兵種預設數值（JSON 載入失敗時的後備） */
const DEFAULT_TROOP_STATS: Record<TroopType, TroopStats> = {
  [TroopType.Cavalry]:  { hp: 100, attack: 40, defense: 20, moveRange: 2, attackRange: 1 },
  [TroopType.Infantry]: { hp: 120, attack: 35, defense: 25, moveRange: 1, attackRange: 1 },
  [TroopType.Shield]:   { hp: 150, attack: 20, defense: 35, moveRange: 1, attackRange: 1 },
  [TroopType.Archer]:   { hp:  80, attack: 30, defense: 15, moveRange: 1, attackRange: 2 },
  [TroopType.Pikeman]:  { hp: 110, attack: 32, defense: 22, moveRange: 1, attackRange: 1 },
  [TroopType.Engineer]: { hp:  80, attack: 15, defense: 10, moveRange: 1, attackRange: 1 },
  [TroopType.Medic]:    { hp:  90, attack:  0, defense: 15, moveRange: 1, attackRange: 0 },
  [TroopType.Navy]:     { hp: 100, attack: 30, defense: 20, moveRange: 1, attackRange: 1 },
};

interface TileBuffRule {
  id: string;
  stat: "attack" | "hp";
  op: "mul" | "div";
  text: string;
}

interface TileBuffConfig {
  spawn: {
    minPerTurn: number;
    maxPerTurn: number;
    factorMin: number;
    factorMax: number;
    rareFactorThreshold: number;
  };
  rules: TileBuffRule[];
}

const DEFAULT_TILE_BUFF_CONFIG: TileBuffConfig = {
  spawn: {
    minPerTurn: 1,
    maxPerTurn: 3,
    factorMin: 2,
    factorMax: 5,
    rareFactorThreshold: 5,
  },
  rules: [
    { id: "atk-mul", stat: "attack", op: "mul", text: "攻擊 x {factor}" },
    { id: "hp-mul", stat: "hp", op: "mul", text: "生命 x {factor}" },
    { id: "atk-div", stat: "attack", op: "div", text: "攻擊 / {factor}" },
    { id: "hp-div", stat: "hp", op: "div", text: "生命 / {factor}" },
  ],
};

type RuntimeColorCtor = new (r: number, g: number, b: number, a: number) => Color;

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

function getRuntimeColorCtor(): RuntimeColorCtor | null {
  try {
    return (require('cc') as { Color?: RuntimeColorCtor }).Color ?? null;
  } catch {
    return null;
  }
}

export class BattleController {
  private static readonly MIN_EMPTY_CELLS_FOR_BUFF_SPAWN = 10;
  private readonly runtimeOrchestrator = new BattleRuntimeOrchestrator(new TurnBasedTempoController());
  private readonly turnManager = new BattleTurnManager();
  private readonly skillExecutor = createDefaultBattleSkillExecutor();
  private readonly skillSourceTranslator = new BattleSkillSourceTranslator(() => this.tacticDefinitionMap);

  public readonly state = new BattleState();
  private serial = 0;
  private readonly enemyAi = new EnemyAI();
  private troopData: TroopDataTable = {};
  private tileBuffConfig: TileBuffConfig = DEFAULT_TILE_BUFF_CONFIG;
  private tacticDefinitionMap = new Map<string, CanonicalTacticDefinition>();

  // ─── 武將單挑系統狀態 ──────────────────────────────────────────────────
  /** 玩家武將化身的小兵單位 ID（null = 武將尚未出陣） */
  public playerGeneralUnitId: string | null = null;
  /** 敵方武將化身的小兵單位 ID */
  public enemyGeneralUnitId: string | null = null;
  /** 是否正在等待玩家選擇出陣格子 */
  public isWaitingDuelPlacement = false;
  /** 拒絕單挑的一方（施加懲罰用） */
  private duelRejectedFaction: Faction | null = null;
  /** 單挑挑戰是否已經結算過，避免每回合重複觸發 */
  private duelChallengeResolved = false;
  private readonly combatResolver = new BattleCombatResolver({
    state: this.state,
    getPlayerGeneralUnitId: () => this.playerGeneralUnitId,
    getEnemyGeneralUnitId: () => this.enemyGeneralUnitId,
    setPlayerGeneralUnitId: (unitId) => {
      this.playerGeneralUnitId = unitId;
    },
    setEnemyGeneralUnitId: (unitId) => {
      this.enemyGeneralUnitId = unitId;
    },
  });
  private readonly duelResolver = new BattleDuelResolver({
    state: this.state,
    combatResolver: this.combatResolver,
    getPlayerGeneralUnitId: () => this.playerGeneralUnitId,
    getEnemyGeneralUnitId: () => this.enemyGeneralUnitId,
    setPlayerGeneralUnitId: (unitId) => {
      this.playerGeneralUnitId = unitId;
    },
    setEnemyGeneralUnitId: (unitId) => {
      this.enemyGeneralUnitId = unitId;
    },
    checkVictory: () => this.checkVictory(),
  });

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
    this.serial  = 0;
    this.playerGeneralUnitId = null;
    this.enemyGeneralUnitId = null;
    this.isWaitingDuelPlacement = false;
    this.duelRejectedFaction = null;
    this.duelChallengeResolved = false;
    this.turnManager.resetForBattle();
    services().buff.clearAll(); // 清除上一場的狀態效果
    // this.stopVfxTestLoop(); // [Vibe-QA] 重置舊的測試循環（已暫時停用）
    services().battle.beginBattle();
    this.applyStartOfBattleSceneGambit();
    this.spawnTileBuffsForTurn();
    // this.startVfxTestLoop(); // [Vibe-QA] 暫時停用，避免干擾測試 log
  }

  private vfxTestTimerId: any = null;
  /**
   * [TEMP-QA] 自動化 VFX 測試循環
   * 每 3 秒於棋盤 (0,0) 播放一次 zhen_ji_nova 特效。
   * 此方法為臨時穩定性測試，正式環境應移除或改由 VfxComposerTool 管理。
   */
  private startVfxTestLoop(): void {
    // [Vibe-QA] 已暫時停用整個測試循環，避免 log 干擾
    return;
    if (this.vfxTestTimerId !== null) return;

    const testEffect = () => {
        const board = services().scene.getBoardRenderer();
        if (board) {
            const pos = board.getCellWorldPosition(0, 0, 0.1);
            const ColorCtor = getRuntimeColorCtor();
            // [LOG-DIAGNOSTIC] 合理的日誌輸出供後續追蹤
            console.log(`[BattleController:Vibe-QA] 預覽特效: zhen_ji_nova at ${pos.toString()}`);
            // [TEMP-QA] 套用冰藍色覆寫，大幅調整參數使粒子在 3D 場景中可見
            // 原因：原始 Prefab 是 additive 白色 + Cone 向上高速噴射，在明亮場景中完全不可見
            services().effect.playFullEffect('zhen_ji_nova', pos, {
                ...(ColorCtor ? { startColor: new ColorCtor(80, 180, 255, 255) } : {}),
                startSpeed: 0.3,          // 極低速度，讓粒子停留在發射點附近
                startSize: 5.0,           // 大顆粒子（5 world units）
                rateOverTime: 50,         // 高發射率
                startLifetime: 2.0,       // 生命週期 2 秒
                gravityModifier: -0.5,    // 微弱向上漂浮
                shapeAngle: 0.1,          // 極小發射角度，近乎垂直向上
            });
        } else {
            console.warn("[BattleController:Vibe-QA] BoardRenderer 尚未就緒，跳過本次 VFX 預覽");
        }
    };

    // 延遲啟動，確保場景預熱完成
    this.vfxTestTimerId = setInterval(testEffect, 3000);
    setTimeout(testEffect, 1500);
  }

  /** [TEMP-QA] 停止 VFX 測試循環 */
  public stopVfxTestLoop(): void {
    if (this.vfxTestTimerId !== null) {
        clearInterval(this.vfxTestTimerId);
        this.vfxTestTimerId = null;
    }
  }

  /** 從 resources/data/troops.json 載入兵種數值表 */
  public async loadData(): Promise<void> {
    const troopData = await loadJsonWithFileFallback<TroopDataTable>('data/troops', 'assets/resources/data/troops.json');
    if (troopData) {
      this.troopData = troopData;
    } else {
      // 載入失敗時回退至 DEFAULT_TROOP_STATS，不影響可玩性
      this.troopData = {};
    }

    const tileBuffConfig = await loadJsonWithFileFallback<TileBuffConfig>('data/tile-buffs', 'assets/resources/data/tile-buffs.json');
    if (tileBuffConfig) {
      this.tileBuffConfig = tileBuffConfig;
    } else {
      this.tileBuffConfig = DEFAULT_TILE_BUFF_CONFIG;
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

  // ─── 玩家行動（由 UI 層呼叫）─────────────────────────────────────────────

  /**
   * 玩家部署兵種到指定路線。
   * 回傳 null 代表糧草不足或部署格已佔用。
   */
  public deployTroop(type: TroopType, lane: number): TroopUnit | null {
    return this.tryDeployTroop(type, lane).unit;
  }

  /**
   * 玩家部署兵種到指定路線，並回傳成功/失敗原因供 UI 提示。
   */
  public tryDeployTroop(type: TroopType, lane: number): DeployOutcome {
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

    const unit = this.spawnUnit(type, Faction.Player, lane, deployDepth);
    this.turnManager.notePlayerDeployment();
    return { ok: true, unit };
  }

  /**
   * 玩家發動武將技能（需 SP 滿能量）。
   * 回傳 true 代表技能成功發動。
   */
  public triggerGeneralSkill(options: GeneralSkillCastOptions = {}): boolean {
    return this.triggerPlayerSeedTactic(options);
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
    const general = this.state.playerGeneral;
    if (!general?.canUseSkill()) return false;

    const descriptor = this.getPlayerSeedTacticDescriptor();
    const result = this.dispatchSeedTactic(Faction.Player, {
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
    if (sourceType === SkillSourceType.SeedTactic) {
      return this.triggerPlayerSeedTactic({
        ...options,
        battleSkillId: options.battleSkillId ?? skillId,
      });
    }

    const general = this.state.playerGeneral;
    if (!general?.canUseSkill() || !skillId) return false;

    const result = this.dispatchDirectBattleSkill(skillId, sourceType, Faction.Player, options);
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
    return this.executeBattleSkillRequest(request);
  }

  // ─── 回合推進（玩家部署完畢後由 UI 呼叫）────────────────────────────────

  /**
   * 執行一個完整的回合自動流程：
   *   敵方部署 → 自動移動 → 戰鬥結算 → 特殊行動 → 勝敗判定
   *
   * 若結果為 "ongoing"，自動推進至下一回合（補充玩家糧草）。
   */
  public advanceTurn(): BattleResult {
    return this.runtimeOrchestrator.executeTurnCycle(
      this.createBattleRuntimeContext(),
      this.buildTurnPhaseExecutors(),
    );
  }

  private createBattleRuntimeContext(): BattleRuntimeContext {
    return {
      state: this.state,
      battleTactic: this.state.battleTactic,
      executePhase: (phaseName) => this.executeRuntimePhase(phaseName),
      finalizeTurnCycle: () => this.finalizeRuntimeTurnCycle(),
    };
  }

  private buildTurnPhaseExecutors(): readonly BattlePhaseExecutor[] {
    return [
      createBattlePhaseExecutor('enemy-deploy', (context) => context.executePhase('enemy-deploy')),
      createBattlePhaseExecutor('auto-move', (context) => context.executePhase('auto-move')),
      createBattlePhaseExecutor('tile-effect', (context) => context.executePhase('tile-effect')),
      createBattlePhaseExecutor('combat-resolve', (context) => context.executePhase('combat-resolve')),
      createBattlePhaseExecutor('special-resolve', (context) => context.executePhase('special-resolve')),
      createBattlePhaseExecutor('victory-check', (context) => context.executePhase('victory-check')),
    ];
  }

  private executeRuntimePhase(phaseName: BattleRuntimePhaseName): BattleRuntimePhaseOutcome {
    switch (phaseName) {
      case 'enemy-deploy':
        executeBattleEnemyDeployPhase({
          state: this.state,
          enemyAi: this.enemyAi,
          turnManager: this.turnManager,
          spawnEnemyUnit: (type, lane, depth) => this.spawnUnit(type, Faction.Enemy, lane, depth),
          isCellMovementBlocked: (lane, depth) => this.combatResolver.isCellMovementBlocked(lane, depth),
        });
        return {};
      case 'auto-move':
        executeBattleAutoMovePhase({
          state: this.state,
          turnManager: this.turnManager,
          getFactionUnits: (faction) => this.combatResolver.getFactionUnits(faction),
          isCellMovementBlocked: (lane, depth) => this.combatResolver.isCellMovementBlocked(lane, depth),
          isGeneralUnit: (unitId) => this.combatResolver.isGeneralUnit(unitId),
        });
        return {};
      case 'tile-effect':
        executeBattleTileEffectPhase({
          state: this.state,
          playerGeneralUnitId: this.playerGeneralUnitId,
          enemyGeneralUnitId: this.enemyGeneralUnitId,
          applyUnitDamage: (unit, damage, attackerFaction, options) => this.combatResolver.applyUnitDamage(unit, damage, attackerFaction, options),
          onGeneralUnitKilled: (faction, svc) => this.combatResolver.onGeneralUnitKilled(faction, svc),
          onUnitKilled: (unit, killer, svc) => this.combatResolver.onUnitKilled(unit, killer, svc),
        });
        return {};
      case 'combat-resolve':
        executeBattleCombatPhase({
          state: this.state,
          playerGeneralUnitId: this.playerGeneralUnitId,
          enemyGeneralUnitId: this.enemyGeneralUnitId,
          buildAttackAction: (unit, options) => this.combatResolver.buildAttackAction(unit, options),
          damageEnemyGeneral: (attacker, svc) => this.combatResolver.damageEnemyGeneral(attacker, svc),
          resolveCombat: (attacker, defender, svc) => this.combatResolver.resolveCombat(attacker, defender, svc),
          resolveActionResetAfterAttack: (attacker, didKill, actions) => this.combatResolver.resolveActionResetAfterAttack(attacker, didKill, actions),
          onGeneralUnitKilled: (faction, svc) => this.combatResolver.onGeneralUnitKilled(faction, svc),
          onUnitKilled: (unit, killer, svc) => this.combatResolver.onUnitKilled(unit, killer, svc),
        });
        return {};
      case 'special-resolve':
        executeBattleSpecialResolvePhase({
          state: this.state,
          turnManager: this.turnManager,
          castEnemySeedTactic: (battleSkillId) => this.dispatchSeedTactic(Faction.Enemy, { battleSkillId }),
        });
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
    svc.battle.nextTurn();
    resolveBattleTacticBehavior(this.state.battleTactic).advanceTurn(this.state);
    this.turnManager.refreshForNextTurn();
    this.spawnTileBuffsForTurn();
  }

  // ─── 階段：敵方部署 ───────────────────────────────────────────────────────

  private applyStartOfBattleSceneGambit(): void {
    resolveBattleTacticBehavior(this.state.battleTactic).applyStartOfBattle(this.state);
  }

  // ─── 階段：特殊行動 ───────────────────────────────────────────────────────

  // ─── 武將技能分發 ──────────────────────────────────────────────────────────

  /**
   * 根據武將的 skillId 分發至具體技能實作。
   * 若 resolver 判定沒有合法 target，回傳 applied=false，呼叫端不可先扣 SP。
   */
  private dispatchDirectBattleSkill(
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
    const general = this.state.getGeneral(casterFaction);
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

  private dispatchSeedTactic(
    casterFaction: Faction,
    options: GeneralSkillCastOptions = {},
  ): SkillExecutionResult {
    const general = this.state.getGeneral(casterFaction);
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

  private executeBattleSkillRequest(request: import('../../shared/SkillRuntimeContract').BattleSkillRequest): SkillExecutionResult {
    return this.skillExecutor.execute(request, this.createBattleSkillExecutionContext());
  }

  private createBattleSkillExecutionContext(): BattleSkillExecutionContext {
    return {
      getFactionUnits: (faction: Faction) => this.combatResolver.getFactionUnits(faction),
      getOpposingUnits: (casterFaction: Faction) => {
        const targetFaction = casterFaction === Faction.Player ? Faction.Enemy : Faction.Player;
        return this.combatResolver.getFactionUnits(targetFaction);
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
      getUnit: (unitId: string) => this.state.units.get(unitId) ?? null,
      getCasterGeneral: (casterFaction: Faction) => this.state.getGeneral(casterFaction),
      getTerrain: (lane: number, depth: number) => this.state.getCell(lane, depth)?.terrain ?? TerrainType.Plain,
      applyDamage: (unit: TroopUnit, damage: number, casterFaction: Faction) => {
        const svc = services();
        this.combatResolver.applyUnitDamage(unit, damage, casterFaction, {
          attackerId: null,
          attackerLane: null,
          attackerDepth: null,
          allowDamageLink: true,
        });
        if (unit.isDead()) {
          if (unit.id === this.playerGeneralUnitId) {
            this.combatResolver.onGeneralUnitKilled(Faction.Player, svc);
          } else if (unit.id === this.enemyGeneralUnitId) {
            this.combatResolver.onGeneralUnitKilled(Faction.Enemy, svc);
          }
          this.combatResolver.onUnitKilled(unit, null, svc);
        }
      },
      healUnit: (unit: TroopUnit, amount: number, casterFaction: Faction) => {
        const svc = services();
        unit.heal(amount);
        svc.event.emit(EVENT_NAMES.UnitHealed, {
          unitId: unit.id,
          amount,
          hp: unit.currentHp,
          sourceId: this.state.getGeneral(casterFaction)?.id ?? 'unknown',
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
        this.state.setDamageLink({
          primaryUnitUid: primaryUnit.id,
          linkedUnitUids: linkedUnits.map((unit) => unit.id),
          shareRatio,
          battleSkillId,
        });
      },
      registerCounterReaction: (targetUnit: TroopUnit, battleSkillId: string, counterRatio: number, statusTurns: number, triggers: number, meleeOnly: boolean) => {
        this.state.setCounterReaction({
          unitUid: targetUnit.id,
          battleSkillId,
          counterRatio,
          statusTurns,
          remainingTriggers: triggers,
          meleeOnly,
        });
      },
      registerActionReset: (targetUnit: TroopUnit, battleSkillId: string, firstHitMultiplier: number, extraActions: number) => {
        this.state.setActionReset({
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

  // ─── 勝敗判定 ─────────────────────────────────────────────────────────────

  private checkVictory(): BattleResult {
    return resolveBattleVictory(this.state);
  }

  private spawnUnit(type: TroopType, faction: Faction, lane: number, depth: number): TroopUnit {
    const stats = this.troopData[type] ?? DEFAULT_TROOP_STATS[type];
    const unit  = new TroopUnit(`${faction}-${type}-${++this.serial}`, type, faction, stats);
    unit.moveTo(lane, depth);

    // 拒絕單挑懲罰：新部署的小兵也要減半
    if (this.duelFlow.duelRejectedFaction === faction) {
      const atkLoss = -Math.floor(unit.getEffectiveAttack() / 2);
      unit.attackBonus += atkLoss;
      const hpLoss = -Math.floor(unit.getEffectiveMaxHp() / 2);
      unit.maxHpBonus += hpLoss;
      unit.currentHp = Math.max(1, Math.floor(unit.currentHp / 2));
    }

    // 武將出陣期間，新部署的我方小兵也享受攻擊加倍
    if (faction === Faction.Player && this.duelFlow.playerGeneralUnitId) {
      unit.attackBonus += unit.attack;
    }

    this.state.addUnit(unit);
    services().event.emit(EVENT_NAMES.UnitDeployed, { unitId: unit.id, lane, depth, faction, type });
    consumeBattleTileBuff(unit, this.state, this.turnManager, services());
    return unit;
  }

  private spawnTileBuffsForTurn(): void {
    // 必須上一回合有 buff 被消耗，才允許本回合生成新 buff
    if (!this.turnManager.canSpawnTileBuffs()) return;
    this.turnManager.beginTileBuffSpawnCycle(); // 預先重置，等下一次消耗之後才再解鎖

    const cfg = this.tileBuffConfig.spawn;
    const count = this.randomInt(cfg.minPerTurn, cfg.maxPerTurn);
    const available: Array<{ lane: number; depth: number }> = [];

    for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
      // 避免主將前方第一排（depth 0 和 depth GRID_DEPTH-1），從 1 跑到 GRID_DEPTH - 2
      for (let depth = 1; depth < GAME_CONFIG.GRID_DEPTH - 1; depth++) {
        const cell = this.state.getCell(lane, depth);
        if (!cell || cell.occupantId) continue;
        if (this.state.getTileBuff(lane, depth)) continue;
        if (this.turnManager.blockedBuffSpawnCells.has(`${lane},${depth}`)) continue;
        available.push({ lane, depth });
      }
    }

    if (available.length < BattleController.MIN_EMPTY_CELLS_FOR_BUFF_SPAWN) {
      return;
    }

    const spawnCount = Math.min(count, available.length);
    for (let i = 0; i < spawnCount; i++) {
      const pick = this.randomInt(0, available.length - 1);
      const cell = available.splice(pick, 1)[0];
      const rule = this.tileBuffConfig.rules[this.randomInt(0, this.tileBuffConfig.rules.length - 1)];
      const factor = this.randomInt(cfg.factorMin, cfg.factorMax);
      const text = rule.text.replace("{factor}", `${factor}`);
      const buff: TileBuff = {
        id: `${rule.id}-${Date.now()}-${i}`,
        lane: cell.lane,
        depth: cell.depth,
        stat: rule.stat,
        op: rule.op,
        factor,
        text,
        rarity: factor >= cfg.rareFactorThreshold ? "rare" : "normal",
      };
      this.state.setTileBuff(buff);
      services().event.emit(EVENT_NAMES.TileBuffSpawned, buff);
    }

    this.turnManager.clearBlockedBuffSpawnCells();
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
    return this.duelResolver.canPlayerGeneralDuel();
  }

  /**
   * 開始武將出陣流程：進入等待玩家選擇棋盤空格的狀態。
   * @returns "ok" | "already-deployed" | "front-blocked" | "general-dead"
   */
  public startGeneralDuel(): string {
    const pg = this.state.playerGeneral;
    if (!pg || pg.isDead()) return "general-dead";
    if (this.playerGeneralUnitId) return "already-deployed";
    if (this.isWaitingDuelPlacement) return "ok";
    if (!this.duelResolver.canPlayerGeneralDuel()) return "front-blocked";

    this.isWaitingDuelPlacement = true;
    return "ok";
  }

  /**
   * 玩家武將放置到指定格子（點擊棋盤後調用）。
   * @returns 成功回傳武將化身的 TroopUnit，失敗回傳 null
   */
  public placeGeneralOnBoard(lane: number, depth: number): TroopUnit | null {
    return this.duelFlow.placeGeneralOnBoard(lane, depth);
  }

  /**
   * 判斷武將是否已到達敵將面前（可觸發單挑邀請）。
   */
  public isGeneralFacingEnemyGeneral(faction: Faction): boolean {
    return this.duelResolver.isGeneralFacingEnemyGeneral(faction);
  }

  /**
   * 處理單挑邀請結果。
   * @param challengerFaction 發起單挑的一方
   * @param accepted 對方是否接受
   */
  public resolveDuelChallenge(challengerFaction: Faction, accepted: boolean): BattleResult {
    const svc = services();
    const defenderFaction = challengerFaction === Faction.Player ? Faction.Enemy : Faction.Player;
    this.duelChallengeResolved = true;

    svc.event.emit(EVENT_NAMES.GeneralDuelChallenge, {
      challengerFaction,
      defenderFaction,
    });

    if (accepted) {
      svc.event.emit(EVENT_NAMES.GeneralDuelAccepted, {
        challengerFaction,
        defenderFaction,
      });
      return this.duelResolver.resolveAcceptedGeneralDuel(challengerFaction, defenderFaction, svc);
    } else {
      // 拒絕單挑：拒絕方全體受懲罰
      this.duelRejectedFaction = defenderFaction;
      this.duelResolver.applyDuelPenalty(defenderFaction);
      svc.event.emit(EVENT_NAMES.GeneralDuelRejected, {
        rejectedFaction: defenderFaction,
      });
      return this.checkVictory();
    }
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
    return this.duelResolver.evaluateDuelAcceptance(challengerFaction);
  }
}
