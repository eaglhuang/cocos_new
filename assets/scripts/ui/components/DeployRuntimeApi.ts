import { Color, Node } from 'cc';
import type { BattleController } from '../../battle/controllers/BattleController';
import type { ToastOptions } from './ToastMessage';

export interface DeployRuntimeApi {
  readonly node: Node;
  setController(ctrl: BattleController): void;
  registerDragDropCallback(cb: (screenX: number, screenY: number) => void): void;
  updateDp(dp: number): void;
  setTroopSlotButtonsVisible(visible: boolean): void;
  updateSkillStatus(isReady: boolean): void;
  selectLane(lane: number): void;
  deploySelected(): void;
  showToast(message: string, duration?: number, options?: ToastOptions): void;
}

export interface DeployRuntimeLike extends DeployRuntimeApi {
  mount?: () => Promise<void>;
  showToast?: (message: string, duration?: number, options?: { color?: Color }) => void;
}