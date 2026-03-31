// @spec-source → 見 docs/cross-reference-index.md
import {
  EVENT_NAMES,
  Faction,
  GAME_CONFIG,
  SP_PER_KILL,
  StatusEffect,
  TerrainType,
  TroopType,
  TROOP_DEPLOY_COST,
} from "../../core/config/Constants";
import { services } from "../../core/managers/ServiceLoader";
import { GeneralUnit } from "../../core/models/GeneralUnit";
import { TroopUnit, TroopStats } from "../../core/models/TroopUnit";
import { BattleState, TerrainGrid, TileBuff } from "../models/BattleState";
import { EnemyAI } from "./EnemyAI";

export type BattleResult = "player-win" | "enemy-win" | "draw" | "ongoing";
export type DeployFailReason = "dp" | "occupied" | "limit";

export interface DeployOutcome {
  ok: boolean;
  unit: TroopUnit | null;
  reason?: DeployFailReason;
}

/** troops.json 的 key 是 TroopType 字串，value 是 TroopStats */
type TroopDataTable = Partial<Record<TroopType, TroopStats>>;

/** 各陣營的前進方向（depth 增量） */
const FORWARD_DIR: Record<Faction, number> = {
  [Faction.Player]: 1,   // 玩家向 depth 增加方向前進（0 → 7）
  [Faction.Enemy]:  -1,  // 敵方向 depth 減少方向前進（7 → 0）
};

/** 可以對敵將發動攻擊的最前線 depth */
const FRONT_DEPTH: Record<Faction, number> = {
  [Faction.Player]: GAME_CONFIG.GRID_DEPTH - 1,  // depth 7
  [Faction.Enemy]:  0,
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

// ─── 攻擊行動描述（BattleResolve 內部使用，避免在迭代 Map 時修改 Map） ────────────
interface AttackAction {
  attackerId: string;
  targetId: string | null; // null = 攻擊敵方武將
}

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

export class BattleController {
  private static readonly MIN_EMPTY_CELLS_FOR_BUFF_SPAWN = 10;

  public readonly state = new BattleState();
  private serial = 0;
  private enemyDp = GAME_CONFIG.INITIAL_DP;
  private playerDeployCountThisTurn = 0;
  private readonly enemyAi = new EnemyAI();
  private troopData: TroopDataTable = {};
  private tileBuffConfig: TileBuffConfig = DEFAULT_TILE_BUFF_CONFIG;
  /** 上一回合是否有 buff 被消耗；為 true 時才允許本回合生成新 buff */
  private buffConsumedSinceLastSpawn = true; // 開局預設 true，允許第一回合生成
  /** 被吃掉的 buff 格子：下一次生成時不可回填到原位 */
  private readonly blockedBuffSpawnCells = new Set<string>();

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
  /** 武將本回合是否已使用過與友軍換位推進 */
  private generalSwapUsedThisTurn: Record<Faction, boolean> = {
    [Faction.Player]: false,
    [Faction.Enemy]: false,
  };

  // ─── 初始化 ────────────────────────────────────────────────────────────────

  /**
   * 開始新一局戰鬥。
   * 應在呼叫此方法之前完成 loadData()。
   */
  public initBattle(
    playerGeneral: GeneralUnit,
    enemyGeneral: GeneralUnit,
    terrainGrid?: TerrainGrid,
  ): void {
    this.state.reset(playerGeneral, enemyGeneral, terrainGrid);
    this.serial  = 0;
    this.enemyDp = GAME_CONFIG.INITIAL_DP;
    this.playerDeployCountThisTurn = 0;
    this.playerGeneralUnitId = null;
    this.enemyGeneralUnitId = null;
    this.isWaitingDuelPlacement = false;
    this.duelRejectedFaction = null;
    this.duelChallengeResolved = false;
    this.generalSwapUsedThisTurn[Faction.Player] = false;
    this.generalSwapUsedThisTurn[Faction.Enemy] = false;
    services().buff.clearAll(); // 清除上一場的狀態效果
    this.buffConsumedSinceLastSpawn = true; // 開局允許第一回合生成 buff
    this.blockedBuffSpawnCells.clear();
    services().battle.beginBattle();
    this.spawnTileBuffsForTurn();
  }

  /** 從 resources/data/troops.json 載入兵種數值表 */
  public async loadData(): Promise<void> {
    try {
      this.troopData = await services().resource.loadJson<TroopDataTable>("data/troops");
    } catch {
      // 載入失敗時回退至 DEFAULT_TROOP_STATS，不影響可玩性
    }

    try {
      this.tileBuffConfig = await services().resource.loadJson<TileBuffConfig>("data/tile-buffs");
    } catch {
      this.tileBuffConfig = DEFAULT_TILE_BUFF_CONFIG;
    }
  }

  // ─── 玩家行動（由 UI 層呼叫）─────────────────────────────────────────────

  /**
   * 玩家部署兵種到指定路線。
   * 回傳 null 代表 DP 不足或部署格已佔用。
   */
  public deployTroop(type: TroopType, lane: number): TroopUnit | null {
    return this.tryDeployTroop(type, lane).unit;
  }

  /**
   * 玩家部署兵種到指定路線，並回傳成功/失敗原因供 UI 提示。
   */
  public tryDeployTroop(type: TroopType, lane: number): DeployOutcome {
    if (this.playerDeployCountThisTurn >= GAME_CONFIG.MAX_PLAYER_DEPLOY_PER_TURN) {
      return { ok: false, unit: null, reason: "limit" };
    }

    const deployDepth = 0;
    if (this.state.getCell(lane, deployDepth)?.occupantId) {
      return { ok: false, unit: null, reason: "occupied" };
    }

    const unit = this.spawnUnit(type, Faction.Player, lane, deployDepth);
    this.playerDeployCountThisTurn += 1;
    return { ok: true, unit };
  }

  /**
   * 玩家發動武將技能（需 SP 滿能量）。
   * 回傳 true 代表技能成功發動。
   */
  public triggerGeneralSkill(): boolean {
    const general = this.state.playerGeneral;
    if (!general?.canUseSkill()) return false;

    general.currentSp = 0;
    this.dispatchGeneralSkill(general.skillId, Faction.Player);
    services().event.emit(EVENT_NAMES.GeneralSkillUsed, { faction: Faction.Player });
    return true;
  }

  // ─── 回合推進（玩家部署完畢後由 UI 呼叫）────────────────────────────────

  /**
   * 執行一個完整的回合自動流程：
   *   敵方部署 → 自動移動 → 戰鬥結算 → 特殊行動 → 勝敗判定
   *
   * 若結果為 "ongoing"，自動推進至下一回合（補充玩家 DP）。
   */
  public advanceTurn(): BattleResult {
    this.runEnemyDeploy();
    this.runAutoMove();
    this.runBattleResolve();
    this.runSpecialResolve();

    const result = this.checkVictory();

    if (result === "ongoing") {
      const svc   = services();
      svc.buff.tickBuff(); // 狀態效果倒計時（在換回合時結算）
      svc.battle.nextTurn(); // 推進回合（內部已 emit TurnPhaseChanged）
      this.enemyDp = Math.min(this.enemyDp + GAME_CONFIG.DP_PER_TURN, GAME_CONFIG.MAX_DP);
      this.playerDeployCountThisTurn = 0;
      this.generalSwapUsedThisTurn[Faction.Player] = false;
      this.generalSwapUsedThisTurn[Faction.Enemy] = false;
      this.spawnTileBuffsForTurn();
    }

    return result;
  }

  // ─── 階段：敵方部署 ───────────────────────────────────────────────────────

  private runEnemyDeploy(): void {
    const decisions = this.enemyAi.decideDeploy(this.state, this.enemyDp);
    const deployDepth = GAME_CONFIG.GRID_DEPTH - 1;

    for (const d of decisions) {
      if (this.state.getCell(d.lane, deployDepth)?.occupantId) continue;

      this.spawnUnit(d.type, Faction.Enemy, d.lane, deployDepth);
    }
  }

  // ─── 階段：自動移動 ───────────────────────────────────────────────────────

  private runAutoMove(): void {
    const svc = services();

    // 玩家：從最前線開始（depth 最高），避免鏈式阻擋
    const playerUnits = this.getFactionUnits(Faction.Player);
    playerUnits.sort((a, b) => b.depth - a.depth);
    for (const unit of playerUnits) this.stepMoveUnit(unit, svc);

    // 敵方：從最前線開始（depth 最低）
    const enemyUnits = this.getFactionUnits(Faction.Enemy);
    enemyUnits.sort((a, b) => a.depth - b.depth);
    for (const unit of enemyUnits) this.stepMoveUnit(unit, svc);
  }

  private stepMoveUnit(unit: TroopUnit, svc: ReturnType<typeof services>): void {
    // 暈眩狀態：本回合無法移動，同時強制解除盾牆
    if (svc.buff.hasBuff(unit.id, StatusEffect.Stun)) {
      unit.isShieldWallActive = false;
      return;
    }

    const dir = FORWARD_DIR[unit.faction];

    for (let step = 0; step < unit.moveRange; step++) {
      const nextDepth = unit.depth + dir;
      const nextCell  = this.state.getCell(unit.lane, nextDepth);
      if (!nextCell) break; // 到達棋盤邊界

      if (nextCell.occupantId) {
        const blocker = this.state.units.get(nextCell.occupantId)!;

        if (
          blocker.faction === unit.faction
          && this.isGeneralUnit(unit.id)
          && !this.isGeneralUnit(blocker.id)
          && !this.generalSwapUsedThisTurn[unit.faction]
        ) {
          const previousLane = unit.lane;
          const previousDepth = unit.depth;

          this.state.getCell(previousLane, previousDepth)!.occupantId = blocker.id;
          nextCell.occupantId = unit.id;

          blocker.moveTo(previousLane, previousDepth);
          unit.moveTo(unit.lane, nextDepth);
          this.generalSwapUsedThisTurn[unit.faction] = true;

          svc.event.emit(EVENT_NAMES.UnitMoved, {
            unitId: blocker.id,
            lane: blocker.lane,
            depth: blocker.depth,
            fromLane: unit.lane,
            fromDepth: nextDepth,
            isSwapPassenger: true,
            swapPartnerId: unit.id,
          });
          svc.event.emit(EVENT_NAMES.UnitMoved, {
            unitId: unit.id,
            lane: unit.lane,
            depth: unit.depth,
            fromLane: previousLane,
            fromDepth: previousDepth,
            swapWithUnitId: blocker.id,
            swapDuration: 2.0,
            swapPassengerFromLane: blocker.lane,
            swapPassengerFromDepth: nextDepth,
            swapPassengerToLane: previousLane,
            swapPassengerToDepth: previousDepth,
          });

          this.tryConsumeTileBuff(unit, svc);
          continue;
        }

        // 遇到敵方單位：盾兵觸發盾牆
        if (blocker.faction !== unit.faction && unit.type === TroopType.Shield) {
          unit.isShieldWallActive = true;
        }
        break; // 被阻擋，停止移動
      }

      // 移動一格
      const prevLane = unit.lane;
      const prevDepth = unit.depth;
      this.state.getCell(unit.lane, unit.depth)!.occupantId = null;
      unit.moveTo(unit.lane, nextDepth);
      nextCell.occupantId = unit.id;
      svc.event.emit(EVENT_NAMES.UnitMoved, {
        unitId: unit.id,
        lane: unit.lane,
        depth: nextDepth,
        fromLane: prevLane,
        fromDepth: prevDepth,
      });
      this.tryConsumeTileBuff(unit, svc);
    }
  }

  // ─── 階段：戰鬥結算 ───────────────────────────────────────────────────────

  private runBattleResolve(): void {
    const svc = services();

    // 先收集所有攻擊行動，再統一結算（同步解析，無先後優勢）
    const actions: AttackAction[] = [];

    for (const [, unit] of this.state.units) {
      if (unit.attackRange === 0) continue; // 非戰鬥單位（醫護兵）
      if (svc.buff.hasBuff(unit.id, StatusEffect.Stun)) continue; // 暈眩：本回合無法攻擊

      const dir    = FORWARD_DIR[unit.faction];
      let target: TroopUnit | null = null;

      // ── 武將單挑特殊規則：敵方小兵優先攻擊出陣中的武將 ──────────────
      const enemyGeneralId = unit.faction === Faction.Player
        ? this.enemyGeneralUnitId
        : this.playerGeneralUnitId;
      if (enemyGeneralId) {
        const generalUnit = this.state.units.get(enemyGeneralId);
        if (generalUnit && !generalUnit.isDead()) {
          // 計算歐幾里得距離，無條件進位（斜對角算一格）
          const dist = Math.max(
            Math.abs(unit.lane - generalUnit.lane),
            Math.abs(unit.depth - generalUnit.depth),
          );
          if (dist <= unit.attackRange) {
            target = generalUnit;
          }
        }
      }

      // ── 武將化身特殊規則：可攻擊相鄰（含斜對角）的敵方單位 ──────────
      if (!target && this.isGeneralUnit(unit.id)) {
        target = this.findAdjacentEnemy(unit);
      }

      // ── 標準攻擊邏輯：掃描正前方攻擊範圍內第一個敵方 ─────────────────
      if (!target) {
        for (let r = 1; r <= unit.attackRange; r++) {
          const cell = this.state.getCell(unit.lane, unit.depth + dir * r);
          if (!cell) break;
          if (cell.occupantId) {
            const occ = this.state.units.get(cell.occupantId)!;
            if (occ.faction !== unit.faction) target = occ;
            break; // 無論友敵都阻擋繼續掃描
          }
        }
      }

      if (target) {
        actions.push({ attackerId: unit.id, targetId: target.id });
      } else if (this.canAttackGeneral(unit)) {
        actions.push({ attackerId: unit.id, targetId: null });
      }
    }

    // 套用所有攻擊行動
    const killed: TroopUnit[] = [];
    const killedIds = new Set<string>();

    for (const { attackerId, targetId } of actions) {
      const attacker = this.state.units.get(attackerId);
      if (!attacker) continue; // 此攻擊者已陣亡

      if (targetId === null) {
        this.damageEnemyGeneral(attacker, svc);
      } else {
        const defender = this.state.units.get(targetId);
        if (!defender || defender.isDead()) continue; // 目標已陣亡

        this.resolveCombat(attacker, defender, svc);

        if (defender.isDead() && !killedIds.has(defender.id)) {
          killedIds.add(defender.id);
          killed.push(defender);
        }
      }
    }

    // 移除陣亡單位並發放 SP
    for (const dead of killed) {
      const action   = actions.find(a => a.targetId === dead.id);
      const killer   = action ? this.state.units.get(action.attackerId) : undefined;

      // 武將化身陣亡時，同步回武將本體
      if (dead.id === this.playerGeneralUnitId) {
        this.onGeneralUnitKilled(Faction.Player, svc);
      } else if (dead.id === this.enemyGeneralUnitId) {
        this.onGeneralUnitKilled(Faction.Enemy, svc);
      }

      this.onUnitKilled(dead, killer ?? null, svc);
    }

    // 重置盾牆狀態（只持續一個戰鬥階段）
    for (const [, unit] of this.state.units) {
      unit.isShieldWallActive = false;
    }
  }

  /** 找出武將單位周圍（含斜對角一格以內）的敵方目標 */
  private findAdjacentEnemy(unit: TroopUnit): TroopUnit | null {
    const dir = FORWARD_DIR[unit.faction];
    // 優先正前方，其次斜前方，再其次側面
    const offsets = [
      { dl: 0, dd: dir },       // 正前方
      { dl: -1, dd: dir },      // 左前方（斜對角）
      { dl: 1, dd: dir },       // 右前方（斜對角）
      { dl: -1, dd: 0 },        // 左側
      { dl: 1, dd: 0 },         // 右側
    ];
    for (const { dl, dd } of offsets) {
      const cell = this.state.getCell(unit.lane + dl, unit.depth + dd);
      if (!cell?.occupantId) continue;
      const occ = this.state.units.get(cell.occupantId);
      if (occ && occ.faction !== unit.faction) return occ;
    }
    return null;
  }

  /** 武將化身陣亡 → 同步至武將本體，標記武將死亡 */
  private onGeneralUnitKilled(faction: Faction, svc: ReturnType<typeof services>): void {
    const general = this.state.getGeneral(faction);
    if (general) {
      general.currentHp = 0; // 聯動武將本體死亡
      svc.event.emit(EVENT_NAMES.GeneralDamaged, {
        faction,
        hp: 0,
        damage: 0,
        attackerId: null,
      });
    }
    if (faction === Faction.Player) {
      this.playerGeneralUnitId = null;
    } else {
      this.enemyGeneralUnitId = null;
    }
  }

  private resolveCombat(attacker: TroopUnit, defender: TroopUnit, svc: ReturnType<typeof services>): void {
    const attackerGeneral = this.state.getGeneral(attacker.faction);
    const aCell = this.state.getCell(attacker.lane, attacker.depth);
    const dCell = this.state.getCell(defender.lane, defender.depth);

    // 盾牆：防禦力加倍
    const effectiveDef = defender.defense * (defender.isShieldWallActive ? 2 : 1);

    const damage = svc.formula.calculateDamage({
      attackerAttack:  attacker.getEffectiveAttack(),
      defenderDefense: effectiveDef,
      attackerType:    attacker.type,
      defenderType:    defender.type,
      attackerTerrain: aCell?.terrain ?? TerrainType.Plain,
      defenderTerrain: dCell?.terrain ?? TerrainType.Plain,
      attackBonus:     attackerGeneral?.attackBonus,
    });

    defender.takeDamage(damage);
    svc.event.emit(EVENT_NAMES.UnitDamaged, {
      unitId: defender.id,
      damage,
      hp: defender.currentHp,
      attackerId: attacker.id,
      attackerLane: attacker.lane,
      attackerDepth: attacker.depth,
      defenderLane: defender.lane,
      defenderDepth: defender.depth,
      attackerFaction: attacker.faction,
    });
  }

  private damageEnemyGeneral(attacker: TroopUnit, svc: ReturnType<typeof services>): void {
    const enemyFaction = attacker.faction === Faction.Player ? Faction.Enemy : Faction.Player;
    const general = this.state.getGeneral(enemyFaction);
    if (!general || general.isDead()) return;

    // 武將可以閃躲兵硬攻擊（對應 E-14 閃躲機率）
    const wasDodged = svc.formula.rollDodge(general.luk);
    if (wasDodged) {
      svc.event.emit(EVENT_NAMES.GeneralDamaged, {
        faction: enemyFaction,
        hp: general.currentHp,
        damage: 0,
        attackerId: attacker.id,
        wasDodged: true,
        isCrit: false,
      });
      return;
    }

    const atk = attacker.getEffectiveAttack();
    general.takeDamage(atk);
    svc.event.emit(EVENT_NAMES.GeneralDamaged, {
      faction: enemyFaction,
      hp: general.currentHp,
      damage: atk,
      attackerId: attacker.id,
      wasDodged: false,
      isCrit: false,
    });
  }

  private canAttackGeneral(unit: TroopUnit): boolean {
    const generalDepth = unit.faction === Faction.Player ? GAME_CONFIG.GRID_DEPTH : -1;
    const distanceToGeneral = Math.abs(generalDepth - unit.depth);
    return distanceToGeneral <= unit.attackRange;
  }

  // ─── 階段：特殊行動 ───────────────────────────────────────────────────────

  private runSpecialResolve(): void {
    const svc = services();

    for (const [, unit] of this.state.units) {
      if (unit.type === TroopType.Medic)    this.resolveMedic(unit, svc);
      if (unit.type === TroopType.Engineer) this.resolveEngineer(unit, svc);
    }

    // 敵方 AI 自動發動武將技能（SP 滿時）
    const eg = this.state.enemyGeneral;
    if (eg?.canUseSkill()) {
      eg.currentSp = 0;
      this.dispatchGeneralSkill(eg.skillId, Faction.Enemy);
      svc.event.emit(EVENT_NAMES.GeneralSkillUsed, { faction: Faction.Enemy });
    }
  }

  private resolveMedic(medic: TroopUnit, svc: ReturnType<typeof services>): void {
    const dir = FORWARD_DIR[medic.faction];
    // 治療後方與側方的友軍（不包含前方，醫護兵主要支援後排）
    const checkDepths = [medic.depth + 1, medic.depth - 1, medic.depth - dir];

    for (const d of checkDepths) {
      const cell = this.state.getCell(medic.lane, d);
      if (!cell?.occupantId) continue;

      const ally = this.state.units.get(cell.occupantId);
      if (!ally || ally.faction !== medic.faction || ally.currentHp >= ally.getEffectiveMaxHp()) continue;

      const amount = svc.formula.calculateHeal(ally.getEffectiveMaxHp());
      ally.heal(amount);
      svc.event.emit(EVENT_NAMES.UnitHealed, {
        unitId: ally.id,
        amount,
        hp: ally.currentHp,
        sourceId: medic.id,
        lane: ally.lane,
        depth: ally.depth,
      });
    }
  }

  private resolveEngineer(engineer: TroopUnit, svc: ReturnType<typeof services>): void {
    if (engineer.depth !== FRONT_DEPTH[engineer.faction]) return;

    const FORTRESS_DMG = 30;
    if (engineer.faction === Faction.Player) {
      this.state.enemyFortressHp = Math.max(0, this.state.enemyFortressHp - FORTRESS_DMG);
      svc.event.emit(EVENT_NAMES.FortressDamaged, { faction: Faction.Enemy, hp: this.state.enemyFortressHp });
    } else {
      this.state.playerFortressHp = Math.max(0, this.state.playerFortressHp - FORTRESS_DMG);
      svc.event.emit(EVENT_NAMES.FortressDamaged, { faction: Faction.Player, hp: this.state.playerFortressHp });
    }
  }

  // ─── 武將技能分發 ──────────────────────────────────────────────────────────

  /**
   * 根據武將的 skillId 分發至具體技能實作。
   * 未知技能 ID 預設使用範圍 50 傷害兜底。
   */
  private dispatchGeneralSkill(skillId: string | null, casterFaction: Faction): void {
    switch (skillId) {
      case "zhang-fei-roar":
        this.applyZhangFeiRoar();
        break;
      case "guan-yu-slash":
        // 關羽：月牙刀斬，對所有敵方造成高傷害
        this.applyAreaSkill(casterFaction, 70);
        break;
      case "lu-bu-rampage":
        // 呂布：天下無雙，對所有敵方造成極高傷害
        this.applyAreaSkill(casterFaction, 80);
        break;
      case "cao-cao-tactics":
        // 曹操：兵不厭詐，範圍傷害
        this.applyAreaSkill(casterFaction, 50);
        break;
      default:
        this.applyAreaSkill(casterFaction, 50);
        break;
    }
  }

  /**
   * 張飛技能「震吼」：
   * 使所有敵方小兵進入暈眩狀態 1 回合（無法移動、無法攻擊、解除盾牆）。
   */
  private applyZhangFeiRoar(): void {
    const svc = services();

    this.state.units.forEach(unit => {
      if (unit.faction !== Faction.Enemy) return;

      // 施加暈眩 1 回合
      svc.buff.applyBuff(unit.id, StatusEffect.Stun, 1);
      // 震吼衝擊波破壞盾牆陣型
      unit.isShieldWallActive = false;

      svc.event.emit(EVENT_NAMES.BuffApplied, {
        unitId: unit.id,
        effect: StatusEffect.Stun,
        turns:  1,
      });
    });

    svc.event.emit(EVENT_NAMES.GeneralSkillEffect, {
      skillId: "zhang-fei-roar",
      faction: Faction.Player,
    });
  }

  // ─── 武將技能（範圍傷害：對所有敵方單位造成固定傷害）─────────────────────

  private applyAreaSkill(casterFaction: Faction, damage: number): void {
    const svc           = services();
    const targetFaction = casterFaction === Faction.Player ? Faction.Enemy : Faction.Player;
    const killed: TroopUnit[] = [];

    this.state.units.forEach(unit => {
      if (unit.faction !== targetFaction) return;
      unit.takeDamage(damage);
      svc.event.emit(EVENT_NAMES.UnitDamaged, {
        unitId: unit.id,
        damage,
        hp: unit.currentHp,
        attackerId: null,
        attackerLane: null,
        attackerDepth: null,
        defenderLane: unit.lane,
        defenderDepth: unit.depth,
        attackerFaction: casterFaction,
      });
      if (unit.isDead()) killed.push(unit);
    });

    killed.forEach(u => this.onUnitKilled(u, null, svc));
  }

  // ─── 勝敗判定 ─────────────────────────────────────────────────────────────

  private checkVictory(): BattleResult {
    const svc = services();
    const pg  = this.state.playerGeneral;
    const eg  = this.state.enemyGeneral;

    const playerLost = (pg?.isDead() ?? false)
      || svc.battle.isTurnLimitReached();

    const enemyLost  = (eg?.isDead() ?? false);

    let result: BattleResult = "ongoing";
    if      (playerLost && enemyLost) result = "draw";
    else if (playerLost)              result = "enemy-win";
    else if (enemyLost)               result = "player-win";

    if (result !== "ongoing") {
      svc.event.emit(EVENT_NAMES.BattleEnded, { result });
    }

    return result;
  }

  // ─── 共用工具 ─────────────────────────────────────────────────────────────

  private onUnitKilled(
    unit:   TroopUnit,
    killer: TroopUnit | null,
    svc:    ReturnType<typeof services>,
  ): void {
    if (!this.state.units.has(unit.id)) return; // 防止重複移除

    const { lane, depth, faction, type } = unit;
    this.state.removeUnit(unit.id);
    svc.buff.clearUnit(unit.id); // 陣亡時清除所有狀態效果
    svc.event.emit(EVENT_NAMES.UnitDied, { unitId: unit.id, lane, depth, faction, type });

    // 擊殺者的武將獲得 SP
    if (killer) {
      const general = this.state.getGeneral(killer.faction);
      if (general) {
        general.addSp(SP_PER_KILL);
        svc.event.emit(EVENT_NAMES.GeneralSpChanged, {
          faction: killer.faction,
          sp:      general.currentSp,
          maxSp:   general.maxSp,
        });
      }
    }
  }

  private spawnUnit(type: TroopType, faction: Faction, lane: number, depth: number): TroopUnit {
    const stats = this.troopData[type] ?? DEFAULT_TROOP_STATS[type];
    const unit  = new TroopUnit(`${faction}-${type}-${++this.serial}`, type, faction, stats);
    unit.moveTo(lane, depth);

    // 拒絕單挑懲罰：新部署的小兵也要減半
    if (this.duelRejectedFaction === faction) {
      const atkLoss = -Math.floor(unit.getEffectiveAttack() / 2);
      unit.attackBonus += atkLoss;
      const hpLoss = -Math.floor(unit.getEffectiveMaxHp() / 2);
      unit.maxHpBonus += hpLoss;
      unit.currentHp = Math.max(1, Math.floor(unit.currentHp / 2));
    }

    // 武將出陣期間，新部署的我方小兵也享受攻擊加倍
    if (faction === Faction.Player && this.playerGeneralUnitId) {
      unit.attackBonus += unit.attack;
    }

    this.state.addUnit(unit);
    services().event.emit(EVENT_NAMES.UnitDeployed, { unitId: unit.id, lane, depth, faction, type });
    this.tryConsumeTileBuff(unit, services());
    return unit;
  }

  private spawnTileBuffsForTurn(): void {
    // 必須上一回合有 buff 被消耗，才允許本回合生成新 buff
    if (!this.buffConsumedSinceLastSpawn) return;
    this.buffConsumedSinceLastSpawn = false; // 預先重置，等下一次消耗之後才再解鎖

    const cfg = this.tileBuffConfig.spawn;
    const count = this.randomInt(cfg.minPerTurn, cfg.maxPerTurn);
    const available: Array<{ lane: number; depth: number }> = [];

    for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
      // 避免主將前方第一排（depth 0 和 depth GRID_DEPTH-1），從 1 跑到 GRID_DEPTH - 2
      for (let depth = 1; depth < GAME_CONFIG.GRID_DEPTH - 1; depth++) {
        const cell = this.state.getCell(lane, depth);
        if (!cell || cell.occupantId) continue;
        if (this.state.getTileBuff(lane, depth)) continue;
        if (this.blockedBuffSpawnCells.has(`${lane},${depth}`)) continue;
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

    this.blockedBuffSpawnCells.clear();
  }

  private tryConsumeTileBuff(unit: TroopUnit, svc: ReturnType<typeof services>): void {
    const buff = this.state.getTileBuff(unit.lane, unit.depth);
    if (!buff) return;

    let attackDelta = 0;
    let hpDelta = 0;
    if (buff.stat === "attack") {
      attackDelta = buff.op === "mul"
        ? unit.applyAttackMultiply(buff.factor)
        : unit.applyAttackDivide(buff.factor);
    } else {
      hpDelta = buff.op === "mul"
        ? unit.applyHpMultiply(buff.factor)
        : unit.applyHpDivide(buff.factor);
    }

    this.state.removeTileBuff(unit.lane, unit.depth);
    this.blockedBuffSpawnCells.add(`${unit.lane},${unit.depth}`);
    this.buffConsumedSinceLastSpawn = true; // 消耗後解鎖下回合的生成權
    svc.event.emit(EVENT_NAMES.TileBuffConsumed, {
      unitId: unit.id,
      faction: unit.faction,
      lane: unit.lane,
      depth: unit.depth,
      buffText: buff.text,
      attackDelta,
      hpDelta,
    });
  }

  private randomInt(min: number, max: number): number {
    if (max <= min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getFactionUnits(faction: Faction): TroopUnit[] {
    const result: TroopUnit[] = [];
    this.state.units.forEach(u => { if (u.faction === faction) result.push(u); });
    return result;
  }

  // ─── 武將單挑系統 ─────────────────────────────────────────────────────────

  /**
   * 檢查玩家武將是否可以出陣（前排 depth=0 沒有我方小兵）。
   */
  public canPlayerGeneralDuel(): boolean {
    if (this.playerGeneralUnitId) return false; // 已出陣
    const pg = this.state.playerGeneral;
    if (!pg || pg.isDead()) return false;
    // 檢查 depth=0 的所有路線是否沒有我方小兵
    for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
      const cell = this.state.getCell(lane, 0);
      if (cell?.occupantId) {
        const unit = this.state.units.get(cell.occupantId);
        if (unit && unit.faction === Faction.Player) return false;
      }
    }
    return true;
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
    if (!this.canPlayerGeneralDuel()) return "front-blocked";

    this.isWaitingDuelPlacement = true;
    return "ok";
  }

  /**
   * 玩家武將放置到指定格子（點擊棋盤後調用）。
   * @returns 成功回傳武將化身的 TroopUnit，失敗回傳 null
   */
  public placeGeneralOnBoard(lane: number, depth: number): TroopUnit | null {
    const cell = this.state.getCell(lane, depth);
    if (!cell || cell.occupantId) return null;

    const pg = this.state.playerGeneral;
    if (!pg || pg.isDead()) return null; // 防禦：從 startGeneralDuel() 到玩家選格期間武將可能死亡
    // 建立武將化身小兵：使用將軍的 HP、高攻擊、1 格攻擊距離、2 格移動
    const stats: TroopStats = {
      hp: pg.currentHp,
      attack: services().formula.calculateGeneralAttack({ str: pg.str, int: pg.int, lea: pg.lea, maxHp: pg.maxHp }),
      defense: 30,
      moveRange: 2,
      attackRange: 1,
    };
    const id = `player-general-${++this.serial}`;
    const unit = new TroopUnit(id, TroopType.Infantry, Faction.Player, stats);
    unit.currentHp = pg.currentHp; // 同步武將當前HP
    unit.moveTo(lane, depth);
    this.state.addUnit(unit);
    this.playerGeneralUnitId = id;
    this.isWaitingDuelPlacement = false;

    // 所有我方小兵攻擊力加倍
    this.state.units.forEach(u => {
      if (u.faction === Faction.Player && u.id !== id) {
        u.attackBonus += u.attack; // 攻擊力翻倍 = 加上自身基礎攻擊
      }
    });

    services().event.emit(EVENT_NAMES.GeneralDuelStart, {
      faction: Faction.Player,
      unitId: id,
      lane,
      depth,
    });
    services().event.emit(EVENT_NAMES.UnitDeployed, {
      unitId: id,
      faction: Faction.Player,
      type: TroopType.Infantry,
      lane,
    });

    return unit;
  }

  /**
   * 判斷武將是否已到達敵將面前（可觸發單挑邀請）。
   */
  public isGeneralFacingEnemyGeneral(faction: Faction): boolean {
    const unitId = faction === Faction.Player ? this.playerGeneralUnitId : this.enemyGeneralUnitId;
    if (!unitId) return false;
    const unit = this.state.units.get(unitId);
    if (!unit) return false;
    const frontDepth = FRONT_DEPTH[faction];
    return unit.depth === frontDepth;
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
      return this.resolveAcceptedGeneralDuel(challengerFaction, defenderFaction, svc);
    } else {
      // 拒絕單挑：拒絕方全體受懲罰
      this.duelRejectedFaction = defenderFaction;
      this.applyDuelPenalty(defenderFaction);
      svc.event.emit(EVENT_NAMES.GeneralDuelRejected, {
        rejectedFaction: defenderFaction,
      });
      return this.checkVictory();
    }
  }

  private resolveAcceptedGeneralDuel(
    challengerFaction: Faction,
    defenderFaction: Faction,
    svc: ReturnType<typeof services>,
  ): BattleResult {
    const challengerGeneral = this.state.getGeneral(challengerFaction);
    const defenderGeneral = this.state.getGeneral(defenderFaction);
    if (!challengerGeneral || !defenderGeneral) return this.checkVictory();

    const challengerUnitId = challengerFaction === Faction.Player ? this.playerGeneralUnitId : this.enemyGeneralUnitId;
    const defenderUnitId = defenderFaction === Faction.Player ? this.playerGeneralUnitId : this.enemyGeneralUnitId;
    const challengerUnit = challengerUnitId ? this.state.units.get(challengerUnitId) ?? null : null;
    const defenderUnit = defenderUnitId ? this.state.units.get(defenderUnitId) ?? null : null;

    const getAttack = (general: GeneralUnit, unit: TroopUnit | null): number => {
      if (unit) return unit.getEffectiveAttack();
      return services().formula.calculateGeneralAttack({ str: general.str, int: general.int, lea: general.lea, maxHp: general.maxHp });
    };

    const challengerAttack = getAttack(challengerGeneral, challengerUnit);
    const defenderAttack = getAttack(defenderGeneral, defenderUnit);

    while (!challengerGeneral.isDead() && !defenderGeneral.isDead()) {
      // 對手閃躲判定（使用守方 LUK）
      const defenderDodged = svc.formula.rollDodge(defenderGeneral.luk);
      let attackDmg = challengerAttack;
      let challengerCrit = false;
      if (defenderDodged) {
        attackDmg = 0;
      } else {
        // 暴擊判定（使用攻方 LUK）
        challengerCrit = svc.formula.rollCrit(challengerGeneral.luk);
        if (challengerCrit) {
          attackDmg = Math.floor(attackDmg * GAME_CONFIG.GENERAL_CRIT_DAMAGE_MULTIPLIER);
        }
        defenderGeneral.takeDamage(attackDmg);
      }
      svc.event.emit(EVENT_NAMES.GeneralDamaged, {
        faction: defenderFaction,
        hp: defenderGeneral.currentHp,
        damage: attackDmg,
        attackerId: challengerUnit?.id ?? null,
        isCrit: challengerCrit,
        wasDodged: defenderDodged,
      });

      if (defenderUnit) {
        defenderUnit.currentHp = defenderGeneral.currentHp;
      }

      if (defenderGeneral.isDead()) break;

      // 正方閃躲判定（使用挑戰方的 LUK）
      const challengerDodged = svc.formula.rollDodge(challengerGeneral.luk);
      let defenseDmg = defenderAttack;
      let defenderCrit = false;
      if (challengerDodged) {
        defenseDmg = 0;
      } else {
        defenderCrit = svc.formula.rollCrit(defenderGeneral.luk);
        if (defenderCrit) {
          defenseDmg = Math.floor(defenseDmg * GAME_CONFIG.GENERAL_CRIT_DAMAGE_MULTIPLIER);
        }
        challengerGeneral.takeDamage(defenseDmg);
      }
      svc.event.emit(EVENT_NAMES.GeneralDamaged, {
        faction: challengerFaction,
        hp: challengerGeneral.currentHp,
        damage: defenseDmg,
        attackerId: defenderUnit?.id ?? null,
        isCrit: defenderCrit,
        wasDodged: challengerDodged,
      });

      if (challengerUnit) {
        challengerUnit.currentHp = challengerGeneral.currentHp;
      }
    }

    if (challengerGeneral.isDead() && challengerUnit) {
      this.onGeneralUnitKilled(challengerFaction, svc);
      this.onUnitKilled(challengerUnit, null, svc);
    }

    if (defenderGeneral.isDead() && defenderUnit) {
      this.onGeneralUnitKilled(defenderFaction, svc);
      this.onUnitKilled(defenderUnit, null, svc);
    }

    return this.checkVictory();
  }

  /**
   * 拒絕單挑懲罰：攻擊力和生命力都直接下降一半（現有+未來小兵）。
   */
  private applyDuelPenalty(faction: Faction): void {
    this.state.units.forEach(unit => {
      if (unit.faction !== faction) return;
      // 攻擊力減半
      const atkLoss = -Math.floor(unit.getEffectiveAttack() / 2);
      unit.attackBonus += atkLoss;
      // 生命力減半
      const hpLoss = -Math.floor(unit.getEffectiveMaxHp() / 2);
      unit.maxHpBonus += hpLoss;
      unit.currentHp = Math.max(1, Math.floor(unit.currentHp / 2));
      unit.currentHp = Math.min(unit.currentHp, unit.getEffectiveMaxHp());
      unit.currentHp = Math.max(1, unit.currentHp);
    });

    // 被拒絕方的武將本體也受懲罰
    const general = this.state.getGeneral(faction);
    if (general) {
      general.currentHp = Math.max(1, Math.floor(general.currentHp / 2));
    }

    services().event.emit(EVENT_NAMES.DuelPenaltyApplied, { faction });
  }

  /**
   * 取得拒絕單挑的陣營（用於新部署小兵時自動施加懲罰減半）。
   */
  public getDuelRejectedFaction(): Faction | null {
    return this.duelRejectedFaction;
  }

  public isDuelChallengeResolved(): boolean {
    return this.duelChallengeResolved;
  }

  /**
   * 判斷指定單位是否為出陣中的武將化身。
   */
  public isGeneralUnit(unitId: string): boolean {
    return unitId === this.playerGeneralUnitId || unitId === this.enemyGeneralUnitId;
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
    const defenderFaction = challengerFaction === Faction.Player ? Faction.Enemy : Faction.Player;
    const challengerGeneral = this.state.getGeneral(challengerFaction);
    const defenderGeneral = this.state.getGeneral(defenderFaction);

    if (!challengerGeneral || !defenderGeneral) {
      return { accepted: false, score: 0, defenderFaction };
    }

    const challengerHpPct = Math.max(0, challengerGeneral.currentHp) / Math.max(1, challengerGeneral.maxHp);
    const defenderHpPct = Math.max(0, defenderGeneral.currentHp) / Math.max(1, defenderGeneral.maxHp);
    const hpAdvantage = defenderHpPct / Math.max(0.0001, challengerHpPct + defenderHpPct);

    const challengerUnits = this.getFactionUnits(challengerFaction);
    const defenderUnits = this.getFactionUnits(defenderFaction);
    const unitCountAdvantage = defenderUnits.length / Math.max(1, challengerUnits.length + defenderUnits.length);

    const calcPower = (units: TroopUnit[], general: GeneralUnit | null): number => {
      const unitPower = units.reduce((sum, u) => {
        return sum + u.getEffectiveAttack() + u.getEffectiveMaxHp() * 0.1;
      }, 0);
      const generalPower = general
        ? (Math.max(0, general.currentHp) * 0.12 + general.attackBonus * 120)
        : 0;
      return unitPower + generalPower;
    };

    const challengerPower = calcPower(challengerUnits, challengerGeneral);
    const defenderPower = calcPower(defenderUnits, defenderGeneral);
    const powerAdvantage = defenderPower / Math.max(0.0001, challengerPower + defenderPower);

    const score = 0.45 * hpAdvantage + 0.35 * unitCountAdvantage + 0.2 * powerAdvantage;
    const accepted = score >= 0.58;

    return {
      accepted,
      score,
      defenderFaction,
    };
  }
}
