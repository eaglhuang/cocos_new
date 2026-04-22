import type { BattleResult as RuntimeBattleResult } from '../runtime/BattleRuntimeContract';

type BattleResult = RuntimeBattleResult;

export enum BattleFlowState {
  Idle = 'idle',
  Planning = 'planning',
  GeneralDuelPlacement = 'general-duel-placement',
  ResolvingTurn = 'resolving-turn',
  Finished = 'finished',
}

export class BattleFlowStateMachine {
  private _state: BattleFlowState = BattleFlowState.Idle;
  private _result: BattleResult | null = null;

  public get result(): BattleResult | null {
    return this._result;
  }

  public reset(): void {
    this._state = BattleFlowState.Idle;
    this._result = null;
  }

  public startBattle(): void {
    this._state = BattleFlowState.Planning;
    this._result = null;
  }

  public canDeployTroop(): boolean {
    return this._state === BattleFlowState.Planning;
  }

  public canUsePlayerSkills(): boolean {
    return this._state === BattleFlowState.Planning;
  }

  public canAdvanceTurn(): boolean {
    return this._state === BattleFlowState.Planning;
  }

  public canRequestGeneralDuel(): boolean {
    return this._state === BattleFlowState.Planning || this._state === BattleFlowState.GeneralDuelPlacement;
  }

  public isFinished(): boolean {
    return this._state === BattleFlowState.Finished;
  }

  public isGeneralDuelPlacement(): boolean {
    return this._state === BattleFlowState.GeneralDuelPlacement;
  }

  public beginTurnResolution(): boolean {
    if (!this.canAdvanceTurn()) {
      return false;
    }
    this._state = BattleFlowState.ResolvingTurn;
    return true;
  }

  public beginGeneralDuelPlacement(): boolean {
    if (this._state === BattleFlowState.Finished || this._state === BattleFlowState.ResolvingTurn) {
      return false;
    }
    this._state = BattleFlowState.GeneralDuelPlacement;
    return true;
  }

  public completeGeneralDuelPlacement(): void {
    if (this._state === BattleFlowState.GeneralDuelPlacement) {
      this._state = BattleFlowState.Planning;
    }
  }

  public commitBattleResult(result: BattleResult): void {
    this._result = result;
    if (result === 'ongoing') {
      if (this._state !== BattleFlowState.Idle && this._state !== BattleFlowState.Finished) {
        this._state = BattleFlowState.Planning;
      }
      return;
    }

    this._state = BattleFlowState.Finished;
  }
}
