import { EVENT_NAMES, GAME_CONFIG, TurnPhase } from "../config/Constants";
import { EventSystem } from "./EventSystem";

export interface TurnSnapshot {
  turn: number;
  phase: TurnPhase;
  playerDp: number;
}

export class BattleSystem {
  private turn = 1;
  private phase = TurnPhase.PlayerDeploy;
  private playerDp = GAME_CONFIG.INITIAL_DP;
  private eventSystem: EventSystem | null = null;

  /** 由 ServiceLoader 或外部注入 EventSystem */
  public setEventSystem(eventSystem: EventSystem): void {
    this.eventSystem = eventSystem;
  }

  public beginBattle(): void {
    this.turn = 1;
    this.phase = TurnPhase.PlayerDeploy;
    this.playerDp = GAME_CONFIG.INITIAL_DP;
    this.emitPhaseChange();
  }

  public getSnapshot(): TurnSnapshot {
    return {
      turn: this.turn,
      phase: this.phase,
      playerDp: this.playerDp,
    };
  }

  public getCurrentPhase(): TurnPhase {
    return this.phase;
  }

  public canSpendDp(cost: number): boolean {
    return this.playerDp >= cost;
  }

  public spendDp(cost: number): boolean {
    if (!this.canSpendDp(cost)) {
      return false;
    }

    this.playerDp -= cost;
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
      this.playerDp = Math.min(this.playerDp + GAME_CONFIG.DP_PER_TURN, GAME_CONFIG.MAX_DP);
    }

    this.emitPhaseChange();
    return this.getSnapshot();
  }

  public isTurnLimitReached(): boolean {
    return this.turn > GAME_CONFIG.TURN_LIMIT;
  }

  /**
   * BattleController 在跑完所有自動階段後呼叫此方法。
   * 推進回合計數、補充玩家 DP，並重置階段回 PlayerDeploy。
   */
  public nextTurn(): TurnSnapshot {
    this.turn += 1;
    this.playerDp = Math.min(this.playerDp + GAME_CONFIG.DP_PER_TURN, GAME_CONFIG.MAX_DP);
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