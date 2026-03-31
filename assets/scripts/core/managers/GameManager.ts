// @spec-source → 見 docs/cross-reference-index.md
import { EVENT_NAMES } from "../config/Constants";
import { EventSystem } from "../systems/EventSystem";

export enum GameMode {
  None = "none",
  Encounter = "encounter",
  Advance = "advance",
}

export class GameManager {
  private currentMode = GameMode.None;
  private eventSystem: EventSystem | null = null;

  public setEventSystem(eventSystem: EventSystem): void {
    this.eventSystem = eventSystem;
  }

  public enterMode(mode: GameMode): void {
    const prev = this.currentMode;
    this.currentMode = mode;
    if (this.eventSystem) {
      this.eventSystem.emit(EVENT_NAMES.GameModeChanged, { prev, next: mode });
    }
  }

  public getCurrentMode(): GameMode {
    return this.currentMode;
  }
}