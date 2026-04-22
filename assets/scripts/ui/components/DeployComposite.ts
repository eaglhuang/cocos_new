// @spec-source → 見 docs/cross-reference-index.md (UCUF Wave 2 - Final Gap)
/**
 * DeployComposite — 玩家部署操作面板（CompositePanel 版）
 *
 * 以 `deploy-panel-screen` 三層 spec 為底，保留 DeployPanel 對 BattleScene 的公開 API：
 *   - setController / registerDragDropCallback / updateDp / updateSkillStatus
 *   - selectLane / deploySelected / showToast / dragging
 *
 * Unity 對照：等同 MonoBehaviour 完整搬進 CompositePanel 容器，spec 已覆蓋全部 UI 節點。
 */
import {
  _decorator,
  Color,
  EventMouse,
  EventTouch,
  Graphics,
  input,
  Input,
  Label,
  Node,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { GAME_CONFIG, TROOP_DEPLOY_COST, TroopType } from '../../core/config/Constants';
import { BattleController, DeployFailReason } from '../../battle/controllers/BattleController';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { services } from '../../core/managers/ServiceLoader';
import { UI_EVENTS } from '../core/UIEvents';
import type { TallyCardData } from './TigerTallyComposite';
import type { DeployRuntimeApi } from './DeployRuntimeApi';
import type { ToastOptions } from './ToastMessage';
import { emitDeployDragDebug, shouldLogDeployDragMove } from './DeployDragDebug';
import { UCUFLogger, LogLevel } from '../core/UCUFLogger';

const { ccclass } = _decorator;

interface ToastMessageLike {
  node: Node;
  show: (message: string, duration?: number, options?: ToastOptions) => void | Promise<void>;
  hide?: (key?: string) => void;
}

export enum DeployDragState {
  Idle,
  Dragging,
  Validating,
  Deployed,
  Cancelled,
}

@ccclass('DeployComposite')
export class DeployComposite extends CompositePanel implements DeployRuntimeApi {
  private ctrl: BattleController | null = null;
  private selectedType: TroopType = TroopType.Infantry;
  private selectedUnitName = '';
  private selectedLane = 0;
  private currentDp = GAME_CONFIG.INITIAL_FOOD;

  private infoRow: Node | null = null;
  private costLabel: Label | null = null;
  private hintLabel: Label | null = null;
  private toast: ToastMessageLike | null = null;

  private _dragState: DeployDragState = DeployDragState.Idle;
  private ghostNode: Node | null = null;
  private dragDropCallback: ((screenX: number, screenY: number) => void) | null = null;
  private _cardSelectedUnsub: (() => void) | null = null;
  private _cardDragUnsub: (() => void) | null = null;
  private _lastDragMoveLogAt = 0;

  private isMounted = false;
  public get dragging(): boolean {
    return this._dragState !== DeployDragState.Idle;
  }

  public setController(ctrl: BattleController): void {
    this.ctrl = ctrl;
  }

  public registerDragDropCallback(cb: (screenX: number, screenY: number) => void): void {
    this.dragDropCallback = cb;
  }

  public updateDp(dp: number): void {
    this.currentDp = dp;
    this.updateSelectionLabels();
  }

  /**
   * TigerTallyComposite 已接手卡槽主視覺，Composite 路徑下此 API 保留為相容 stub。
   */
  public setTroopSlotButtonsVisible(_visible: boolean): void {
    // noop
  }

  /** @deprecated SkillButton 已遷移至 ActionCommandComposite，此方法保留為空 stub 供舊呼叫者兼容 */
  public updateSkillStatus(_isReady: boolean): void {
    // noop — skill button is now owned by ActionCommandComposite
  }

  public selectLane(lane: number): void {
    this.selectedLane = lane;
    this.endDrag();
    this.onDeployClick();
  }

  public deploySelected(): void {
    this.onDeployClick();
  }

  public showToast(message: string, duration = 1.2, options?: ToastOptions): void {
    void this.toast?.show(message, duration, options);
  }

  public async mount(): Promise<void> {
    if (this.isMounted) return;
    emitDeployDragDebug('DeployComposite', 'mount-start', { node: this.node.name });
    const legacyChildren = [...this.node.children];
    await super.mount('deploy-panel-screen');
    for (const child of legacyChildren) {
      if (child?.isValid && child.parent === this.node) {
        child.destroy();
      }
    }
    this.isMounted = true;
    input.on(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchEnd, this);
    input.on(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
    emitDeployDragDebug('DeployComposite', 'mount-complete', {
      legacyFallback: false,
    });
  }

  protected onDestroy(): void {
    emitDeployDragDebug('DeployComposite', 'on-destroy');
    input.off(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchEnd, this);
    input.off(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
    this._cardSelectedUnsub?.();
    this._cardSelectedUnsub = null;
    this._cardDragUnsub?.();
    this._cardDragUnsub = null;
    this.endDrag();
    this.unmount();
  }

  protected override _onAfterBuildReady(binder: UITemplateBinder): void {
    emitDeployDragDebug('DeployComposite', 'on-after-build-ready');
    this.infoRow = binder.getNode('InfoRow') ?? binder.getNodeByPath('InfoRow');
    if (this.infoRow) {
      this.infoRow.active = false;
    }
    this.costLabel = binder.getLabel('costLabel');
    this.hintLabel = binder.getLabel('hintLabel');

    const toastNode = binder.getNode('toastContainer') ?? this.node.getChildByName('Toast');
    if (toastNode) {
      this.toast = ((
        toastNode.getComponent('ToastMessageComposite')
        ?? toastNode.getComponent('ToastMessage')
        ?? toastNode.addComponent('ToastMessageComposite')
      ) as unknown) as ToastMessageLike | null;
    }

    // [UCUF Wave 2] 兵種選擇已委由 TigerTallyComposite / CardSelected 事件驅動
    this._cardSelectedUnsub?.();
    this._cardSelectedUnsub = services().event.on(
      UI_EVENTS.CardSelected,
      (payload: { index: number; data: TallyCardData }) => {
        emitDeployDragDebug('DeployComposite', 'event-card-selected', {
          index: payload.index,
          unitType: payload.data.unitType,
        });
        this.selectedType = payload.data.unitType as TroopType;
        this.selectedUnitName = payload.data.unitName?.trim() || this.toTroopDisplayName(this.selectedType);
        this.updateSelectionLabels();
      },
    );

    // [UCUF Wave 2] 接收 TigerTallyComposite 的 CardDragStart → 啟動 ghost drag
    this._cardDragUnsub?.();
    this._cardDragUnsub = services().event.on(
      UI_EVENTS.CardDragStart,
      (payload: { ev: import('cc').EventTouch; data: TallyCardData }) => {
        emitDeployDragDebug('DeployComposite', 'event-card-drag-start', {
          unitType: payload.data.unitType,
          dragState: this._dragState,
        });
        this.selectedType = payload.data.unitType as TroopType;
        this.selectedUnitName = payload.data.unitName?.trim() || this.toTroopDisplayName(this.selectedType);
        this.updateSelectionLabels();
        this.beginDrag(payload.ev, this.selectedType);
      },
    );

    this.updateSelectionLabels();
  }

  private beginDrag(ev: EventTouch, type: TroopType): void {
    if (this._dragState !== DeployDragState.Idle) this.endDrag();
    this._dragState = DeployDragState.Dragging;
    emitDeployDragDebug('DeployComposite', 'begin-drag', { type, state: this._dragState });

    const canvas = this.node.parent;
    if (!canvas) return;

    this.ghostNode = new Node('DragGhost');
    this.ghostNode.layer = this.node.layer;
    canvas.addChild(this.ghostNode);

    const transform = this.ghostNode.addComponent(UITransform);
    transform.setContentSize(120, 60);

    const graphics = this.ghostNode.addComponent(Graphics);
    graphics.clear();
    graphics.fillColor = new Color(255, 220, 80, 210);
    graphics.roundRect(-60, -30, 120, 60, 8);
    graphics.fill();

    const opacity = this.ghostNode.addComponent(UIOpacity);
    opacity.opacity = 200;

    const labelNode = new Node('GhostLabel');
    labelNode.layer = this.node.layer;
    this.ghostNode.addChild(labelNode);
    const labelTf = labelNode.addComponent(UITransform);
    labelTf.setContentSize(120, 60);
    const label = labelNode.addComponent(Label);
    label.string = this.selectedUnitName || this.toTroopDisplayName(type);
    label.fontSize = 24;
    label.lineHeight = 28;
    label.color = new Color(20, 20, 20, 255);

    this.moveGhostToTouch(ev);
  }

  private moveGhostToTouch(ev: EventTouch): void {
    if (!this.ghostNode) return;
    const canvas = this.node.parent;
    const canvasTf = canvas?.getComponent(UITransform);
    if (!canvasTf) return;
    const loc = ev.getUILocation();
    this.ghostNode.setPosition(new Vec3(
      loc.x - canvasTf.width * 0.5,
      loc.y - canvasTf.height * 0.5,
      0,
    ));
  }

  private endDrag(): void {
    if (this._dragState === DeployDragState.Idle) return;
    emitDeployDragDebug('DeployComposite', 'end-drag', {
      state: this._dragState,
      hadGhost: !!this.ghostNode,
    });
    this._dragState = DeployDragState.Idle;
    this.ghostNode?.destroy();
    this.ghostNode = null;
  }

  private onGlobalTouchMove(ev: EventTouch): void {
    if (this._dragState === DeployDragState.Dragging) {
      this.moveGhostToTouch(ev);
      if (UCUFLogger.getLevel() <= LogLevel.DEBUG) {
        const now = Date.now();
        if (shouldLogDeployDragMove(now, this._lastDragMoveLogAt, 120)) {
          this._lastDragMoveLogAt = now;
          const loc = ev.getLocation();
          emitDeployDragDebug('DeployComposite', 'touch-move', { x: loc.x, y: loc.y });
        }
      }
    }
  }

  private onGlobalTouchEnd(ev: EventTouch): void {
    if (this._dragState === DeployDragState.Idle) return;
    const loc = ev.getLocation();
    emitDeployDragDebug('DeployComposite', 'touch-end', { x: loc.x, y: loc.y, state: this._dragState });
    this.processDragEnd(loc.x, loc.y);
  }

  private onGlobalMouseUp(ev: EventMouse): void {
    if (this._dragState === DeployDragState.Idle) return;
    const loc = ev.getLocation();
    emitDeployDragDebug('DeployComposite', 'mouse-up', { x: loc.x, y: loc.y, state: this._dragState });
    this.processDragEnd(loc.x, loc.y);
  }

  private processDragEnd(screenX: number, screenY: number): void {
    this._dragState = DeployDragState.Validating;
    emitDeployDragDebug('DeployComposite', 'process-drag-end', {
      x: screenX,
      y: screenY,
      hasCallback: !!this.dragDropCallback,
    });
    this.dragDropCallback?.(screenX, screenY);
    emitDeployDragDebug('DeployComposite', 'process-drag-end-after-callback', {
      state: this._dragState,
    });
    if (this._dragState === DeployDragState.Validating) {
      this._dragState = DeployDragState.Cancelled;
      emitDeployDragDebug('DeployComposite', 'process-drag-end-cancelled', {
        x: screenX,
        y: screenY,
      });
      this.showToast('請拖曳到最前排（第一列）部署');
      this.endDrag();
    }
  }

  private updateSelectionLabels(): void {
    if (this.infoRow && !this.infoRow.active) {
      return;
    }
    const cost = TROOP_DEPLOY_COST[this.selectedType];
    if (this.costLabel) {
      this.costLabel.string = `費用：${cost} 糧草`;
    }
    if (this.hintLabel) {
      this.hintLabel.string = `兵種：${this.toTroopDisplayName(this.selectedType)} / 路線：${this.selectedLane + 1}`;
    }
  }

  private onDeployClick(): void {
    if (!this.ctrl) {
      emitDeployDragDebug('DeployComposite', 'deploy-click-without-controller', {
        type: this.selectedType,
        lane: this.selectedLane,
      });
      return;
    }
    const outcome = this.ctrl.tryDeployTroop(this.selectedType, this.selectedLane, this.selectedUnitName || undefined);
    emitDeployDragDebug('DeployComposite', 'deploy-click-result', {
      ok: outcome.ok,
      reason: outcome.reason,
      type: this.selectedType,
      lane: this.selectedLane,
    });
    if (outcome.ok) {
      this.endDrag();
      this.node.emit('playerDeployed');
      return;
    }
    this.showToast(this.getDeployFailMessage(outcome.reason));
  }

  private toTroopDisplayName(type: TroopType): string {
    const map: Partial<Record<TroopType, string>> = {
      [TroopType.Cavalry]: '騎兵',
      [TroopType.Infantry]: '步兵',
      [TroopType.Shield]: '盾兵',
      [TroopType.Archer]: '弓兵',
      [TroopType.Pikeman]: '槍兵',
    };
    return map[type] ?? String(type);
  }

  private getDeployFailMessage(reason?: DeployFailReason): string {
    if (reason === 'battle-locked') return '目前流程鎖定，暫時無法部署';
    if (reason === 'limit') return '本回合已部署，請等待下一回合';
    if (reason === 'occupied') return '目標格已有單位，請改放其他格子';
    return '糧草不足，無法部署';
  }
}
