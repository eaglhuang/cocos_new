// @spec-source → 見 docs/cross-reference-index.md
import { EVENT_NAMES, GAME_CONFIG, TurnPhase } from "../config/Constants";
import { EventSystem } from "./EventSystem";

/** [P2-N2] TurnSnapshot 介面：playerDp 已更名為 playerFood，與 UI 層語意統一 */
export interface TurnSnapshot {
  turn: number;
  phase: TurnPhase;
  playerFood: number;
}

export class BattleSystem {
  private turn = 1;
  private phase = TurnPhase.PlayerDeploy;
  /** [P2-N2] 玩家糧草（原 playerDp） */
  private playerFood = GAME_CONFIG.INITIAL_FOOD;
  private eventSystem: EventSystem | null = null;

  /** 由 ServiceLoader 或外部注入 EventSystem */
  public setEventSystem(eventSystem: EventSystem): void {
    this.eventSystem = eventSystem;
  }

  public beginBattle(): void {
    this.turn = 1;
    this.phase = TurnPhase.PlayerDeploy;
    this.playerFood = GAME_CONFIG.INITIAL_FOOD;
    this.emitPhaseChange();
  }

  public getSnapshot(): TurnSnapshot {
    return {
      turn: this.turn,
      phase: this.phase,
      playerFood: this.playerFood,
    };
  }

  public getCurrentPhase(): TurnPhase {
    return this.phase;
  }

  /** [P2-N2] 原 canSpendDp()：判斷糧草是否足夠 */
  public canSpendFood(cost: number): boolean {
    return this.playerFood >= cost;
  }

  /** [P2-N2] 原 spendDp()：消耗糧草 */
  public spendFood(cost: number): boolean {
    if (!this.canSpendFood(cost)) {
      return false;
    }
    this.playerFood -= cost;
    return true;
  }

  public advancePhase(): TurnSnapshot {
    const orderedPhases = [
      TurnPhase.PlayerDeploy,
      TurnPhase.AutoMove,
      TurnPhase.BattleResolve,
      TurnPhase.SpecialResolve,
      TurnPhase.TurnEnd,
    ];

    const currentIndex = orderedPhases.indexOf(this.phase);
    const nextIndex = (currentIndex + 1) % orderedPhases.length;
    this.phase = orderedPhases[nextIndex];

    if (this.phase === TurnPhase.PlayerDeploy) {
      this.turn += 1;
      this.playerFood = Math.min(this.playerFood + GAME_CONFIG.FOOD_PER_TURN, GAME_CONFIG.MAX_FOOD);
    }

    this.emitPhaseChange();
    return this.getSnapshot();
  }

  public isTurnLimitReached(): boolean {
    return this.turn > GAME_CONFIG.TURN_LIMIT;
  }

  /**
   * BattleController 在跑完所有自動階段後呼叫此方法。
   * 推進回合計數、補充玩家糧草，並重置階段回 PlayerDeploy。
   */
  public nextTurn(): TurnSnapshot {
    this.turn += 1;
    this.playerFood = Math.min(this.playerFood + GAME_CONFIG.FOOD_PER_TURN, GAME_CONFIG.MAX_FOOD);
    this.phase = TurnPhase.PlayerDeploy;
    this.emitPhaseChange();
    return this.getSnapshot();
  }

  private emitPhaseChange(): void {
    if (this.eventSystem) {
      this.eventSystem.emit(EVENT_NAMES.TurnPhaseChanged, this.getSnapshot());
    }
  }
}