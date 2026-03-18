import {
  _decorator,
  Button,
  Component,
  EventMouse,
  EventTouch,
  Graphics,
  input,
  Input,
  Label,
  Node,
  Sprite,
  SpriteFrame,
  UIOpacity,
  UITransform,
  Color,
  Vec3,
  tween,
  Tween,
  resources,
} from "cc";
import { GAME_CONFIG, TroopType, TROOP_DEPLOY_COST } from "../../core/config/Constants";
import { BattleController, DeployFailReason } from "../../battle/controllers/BattleController";
import { ToastMessage, ToastOptions } from "./ToastMessage";

const { ccclass, property } = _decorator;

/**
 * DeployPanel — 玩家部署操作面板。
 *
 * 【隨機兵種池】每次成功部署後，從 5 個兵種中隨機抽出 4 個槽位，最多允許一個兵種重複。
 *   - 對照 Unity：類似 Hearthstone 的手牌洗牌邏輯，驅動 4 個卡槽 UI。
 *
 * 【拖曳部署】玩家長按槽位按鈕後拖曳到戰場格子，並在放手時部署。
 *   - BattleScene.onTouchEnd 負責 3D 格子偵測（Camera Raycast），呼叫 selectLane()。
 *   - DeployPanel 負責顯示跟手的幽靈節點（Ghost Image）。
 *
 * 【有效格子驗證】
 *   1. 格子必須空著（BattleController.tryDeployTroop 內部判斷）。
 *   2. 必須是武將前方第一排（BattleScene.onTouchEnd 限制 depth === 0 才呼叫 selectLane）。
 */
@ccclass("DeployPanel")
export class DeployPanel extends Component {
  // ─── 兵種按鈕（5 個對應 Inspector 綁定，實際只顯示 4 個隨機槽位） ──────────
  @property(Button)
  btnCavalry: Button = null!;

  @property(Button)
  btnInfantry: Button = null!;

  @property(Button)
  btnShield: Button = null!;

  @property(Button)
  btnArcher: Button = null!;

  @property(Button)
  btnPikeman: Button = null!;

  // 路線按鈕已淘汰，改為 3D 點擊地板部署。保留欄位僅為相容舊場景。
  @property([Button])
  laneButtons: Button[] = [];

  // ─── 功能按鈕 ─────────────────────────────────────────────────────────────
  @property(Button)
  btnSkill: Button = null!;

  @property(Button)
  btnDuel: Button = null!;

  @property(Button)
  btnTactics: Button = null!;

  @property(Button)
  btnEndTurn: Button = null!;

  // ─── 狀態標籤 ─────────────────────────────────────────────────────────────
  @property(Label)
  selectionLabel: Label = null!;

  @property(ToastMessage)
  toast: ToastMessage = null!;

  // ─── 運行時狀態 ───────────────────────────────────────────────────────────
  private ctrl: BattleController | null = null;
  private selectedType: TroopType = TroopType.Infantry;
  private selectedSlotIndex = 0;
  private selectedLane: number = 0;
  private currentDp = GAME_CONFIG.INITIAL_DP;

  // ─── 隨機兵種槽位 ─────────────────────────────────────────────────────────
  /** 目前 4 個槽位各自對應的兵種（每次成功部署後重新抽） */
  private deploySlots: TroopType[] = [];

  /**
   * 4 個槽位按鈕：使用 btnInfantry / btnArcher / btnShield / btnCavalry 作為顯示容器。
   * btnPikeman 在 onLoad 時隱藏，以騰出空間給 4 槽設計。
   */
  private slotButtons: Array<Button | null> = [];

  // ─── 拖曳狀態 ─────────────────────────────────────────────────────────────
  private isDragging = false;
  private ghostNode: Node | null = null;
  /** BattleScene 登記的回調：當拖曳放手時，通知 BattleScene 用放手座標做射線偵測 */
  private dragDropCallback: ((screenX: number, screenY: number) => void) | null = null;

  /** 公開 isDragging 狀態，供 BattleScene 判斷是否正在拖曳 */
  public get dragging(): boolean { return this.isDragging; }

  // ─── Tween 狀態 ──────────────────────────────────────────────────────────
  private skillTween: Tween<Node> | null = null;
  private troopSelectTween: Tween<Node> | null = null;
  private activeSelectionFrame: Node | null = null;
  private isSkillReady = false;

  // ─── 公開 API（供 BattleScene 呼叫） ─────────────────────────────────────

  public setController(ctrl: BattleController): void {
    this.ctrl = ctrl;
  }

  /** BattleScene 呼叫此方法登記回調，拖曳放手時收到放手的螢幕座標 */
  public registerDragDropCallback(cb: (screenX: number, screenY: number) => void): void {
    this.dragDropCallback = cb;
  }

  public updateDp(dp: number): void {
    this.currentDp = dp;
    this.refreshButtonStates();
  }

  public updateSkillStatus(isReady: boolean): void {
    if (this.isSkillReady === isReady) return;
    this.isSkillReady = isReady;
    if (!this.btnSkill) return;

    if (isReady) {
      this.btnSkill.node.getComponent(Sprite)!.color = new Color(255, 180, 50, 255);
      this.skillTween = tween(this.btnSkill.node)
        .by(0.1, { position: new Vec3(0, 5, 0) })
        .by(0.1, { position: new Vec3(0, -5, 0) })
        .union()
        .repeatForever()
        .start();
    } else {
      if (this.skillTween) {
        this.skillTween.stop();
        this.skillTween = null;
      }
      this.btnSkill.node.getComponent(Sprite)!.color = new Color(60, 60, 180, 200);
      this.btnSkill.node.setPosition(new Vec3(810, -360, 0));
    }
  }

  /**
   * BattleScene.onTouchEnd 偵測到有效格子後呼叫此方法。
   * 會結束拖曳並執行部署。
   */
  public selectLane(lane: number): void {
    this.selectedLane = lane;
    this.endDrag();
    this.onDeployClick();
  }

  public deploySelected(): void {
    this.onDeployClick();
  }

  public showToast(message: string, duration = 1.2, options?: ToastOptions): void {
    this.toast?.show(message, duration, options);
  }

  // ─── 生命週期 ─────────────────────────────────────────────────────────────

  onLoad(): void {
    console.log("[DeployPanel] onLoad 開始");
    this.ensureBindings();

    // 設定 4 個槽位按鈕（使用前 4 個既有按鈕作為顯示容器）
    this.slotButtons = [
      this.btnInfantry,
      this.btnArcher,
      this.btnShield,
      this.btnCavalry,
    ];

    // 第 5 個（btnPikeman）暫時隱藏，改由隨機池決定是否出現
    if (this.btnPikeman?.node) {
      this.btnPikeman.node.active = false;
    }

    // 功能按鈕
    this.btnSkill?.node.on(Button.EventType.CLICK, this.onSkillClick, this);
    this.btnDuel?.node.on(Button.EventType.CLICK, this.onDuelClick, this);
    this.btnTactics?.node.on(Button.EventType.CLICK, this.onTacticsClick, this);
    this.btnEndTurn?.node.on(Button.EventType.CLICK, this.onEndTurnClick, this);

    // 路線按鈕已廢棄
    this.laneButtons.forEach(btn => btn.node.destroy());
    this.laneButtons = [];

    this.applyReferenceLayout();

    // 初始化隨機兵種池並更新槽位顯示
    this.randomizeDeployPool();
    this.refreshSlotDisplay();
    if (this.deploySlots.length > 0) {
      this.selectTroop(this.deploySlots[0], 0);
    }
    this.bindSlotButtons();

    // 全域拖曳事件（跟手移動幽靈節點）
    // 同時監聽 TOUCH_END（行動／瀏覽器）與 MOUSE_UP（Editor Preview 滑鼠模式）
    input.on(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchEnd, this);
    input.on(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
  }

  onDestroy(): void {
    input.off(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchEnd, this);
    input.off(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
    this.endDrag();
  }

  // ─── 隨機兵種池 ───────────────────────────────────────────────────────────

  /**
   * 從 5 個兵種中隨機抽出 4 個槽位，最多允許一個兵種重複。
   * 規則：
   *   1. Fisher-Yates 洗牌取前 3 個（保證不重複）。
   *   2. 第 4 個以 50% 機率複製前 3 個之一（重複），否則取第 4 個不同兵種。
   *   3. 再次洗牌確保重複的位置隨機。
   *
   * 對照 Unity：類似 List.Shuffle() 搭配手牌池抽牌邏輯。
   */
  private randomizeDeployPool(): void {
    const all: TroopType[] = [
      TroopType.Cavalry,
      TroopType.Infantry,
      TroopType.Shield,
      TroopType.Archer,
      TroopType.Pikeman,
    ];

    // Fisher-Yates 洗牌
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }

    const pool: TroopType[] = [all[0], all[1], all[2]];

    // 第 4 個：50% 機率複製、50% 取下一個不同兵種
    if (Math.random() < 0.5) {
      pool.push(pool[Math.floor(Math.random() * 3)]);
    } else {
      pool.push(all[3]);
    }

    // 最終洗牌
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    this.deploySlots = pool;
  }

  /**
   * 根據 deploySlots 更新 4 個槽位按鈕的文字標籤與圖示。
   */
  private refreshSlotDisplay(): void {
    for (let i = 0; i < this.slotButtons.length; i++) {
      const btn = this.slotButtons[i];
      if (!btn) continue;

      const type = this.deploySlots[i];
      const name = this.toTroopDisplayName(type);
      const iconName = this.toIconName(type);

      // 更新文字標籤
      const labelNode = btn.node.getChildByName("Label") ?? btn.node.getComponentInChildren(Label)?.node;
      if (labelNode) {
        const lbl = labelNode.getComponent(Label);
        if (lbl) lbl.string = name;
      }

      // 更新背景圖示（動態載入，失敗時顯示預設底色）
      const bg = btn.node.getComponent(Sprite);
      if (bg) {
        resources.load(`icons/${iconName}/spriteFrame`, SpriteFrame, (err, sf) => {
          if (!err && sf) {
            bg.spriteFrame = sf;
            bg.color = new Color(255, 255, 255, 255);
          } else {
            bg.spriteFrame = null;
            bg.color = new Color(50, 50, 60, 240);
          }
        });
      }

      // 根據當前 DP 啟用/禁用按鈕
      btn.interactable = this.currentDp >= TROOP_DEPLOY_COST[type];
    }
  }

  /**
   * 為 4 個槽位按鈕綁定觸控事件。
   * - CLICK：選中該槽的兵種（讓玩家再點棋盤格子部署，沿用舊流程）。
   * - TOUCH_START：選中兵種 + 啟動拖曳幽靈跟手。
   *
   * 注意：事件處理器閉包讀取 deploySlots[idx]，下次 randomizeDeployPool() 後
   * 無需重新綁定，新類型會自動生效。
   */
  private bindSlotButtons(): void {
    for (let i = 0; i < this.slotButtons.length; i++) {
      const idx = i;
      const btn = this.slotButtons[idx];
      if (!btn) continue;

      // 移除舊監聽器，避免重複註冊
      btn.node.off(Button.EventType.CLICK);
      btn.node.off(Node.EventType.TOUCH_START);

      btn.node.on(Button.EventType.CLICK, () => {
        const type = this.deploySlots[idx];
        if (!type) return;
        this.selectTroop(type, idx);
      }, this);

      btn.node.on(Node.EventType.TOUCH_START, (ev: EventTouch) => {
        const type = this.deploySlots[idx];
        if (!type) return;
        if (this.currentDp < TROOP_DEPLOY_COST[type]) {
          this.showToast("DP 不足，無法拖曳部署");
          return;
        }
        this.selectTroop(type, idx);
        this.beginDrag(ev, type);
      }, this);
    }
  }

  // ─── 拖曳邏輯（Ghost Image） ──────────────────────────────────────────────

  /**
   * 開始拖曳：建立半透明幽靈節點跟著手指移動。
   * 對照 Unity：類似 CanvasGroup + 拖曳時 monoBehaviour.OnDrag。
   */
  private beginDrag(ev: EventTouch, type: TroopType): void {
    if (this.isDragging) this.endDrag(); // 避免重複
    this.isDragging = true;

    // 把幽靈加到 Canvas（this.node.parent）
    const canvas = this.node.parent;
    if (!canvas) return;

    this.ghostNode = new Node("DragGhost");
    this.ghostNode.layer = this.node.layer;
    canvas.addChild(this.ghostNode);

    const tf = this.ghostNode.addComponent(UITransform);
    tf.setContentSize(120, 60);

    // 用 Graphics 畫圓角矩形背景（Sprite 沒有 spriteFrame 時無法顯示純色）
    const gfx = this.ghostNode.addComponent(Graphics);
    gfx.clear();
    gfx.fillColor = new Color(255, 220, 80, 210);
    gfx.roundRect(-60, -30, 120, 60, 8);
    gfx.fill();

    // 半透明效果
    const op = this.ghostNode.addComponent(UIOpacity);
    op.opacity = 200;

    const lblNode = new Node("GhostLabel");
    lblNode.layer = this.node.layer;
    this.ghostNode.addChild(lblNode);
    lblNode.addComponent(UITransform).setContentSize(120, 60);
    const lbl = lblNode.addComponent(Label);
    lbl.string = this.toTroopDisplayName(type);
    lbl.fontSize = 24;
    lbl.isBold = true;
    lbl.color = new Color(20, 20, 20, 255);

    this.moveGhostToTouch(ev);
  }

  private moveGhostToTouch(ev: EventTouch): void {
    if (!this.ghostNode) return;
    const canvas = this.node.parent;
    if (!canvas) return;
    const canvasTf = canvas.getComponent(UITransform);
    if (!canvasTf) return;
    const loc = ev.getUILocation();
    this.ghostNode.setPosition(new Vec3(
      loc.x - canvasTf.width  * 0.5,
      loc.y - canvasTf.height * 0.5,
      0,
    ));
  }

  private endDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.ghostNode) {
      this.ghostNode.destroy();
      this.ghostNode = null;
    }
  }

  private onGlobalTouchMove(ev: EventTouch): void {
    if (this.isDragging) this.moveGhostToTouch(ev);
  }

  private onGlobalTouchEnd(ev: EventTouch): void {
    if (!this.isDragging) return;
    const loc = ev.getLocation();
    this.processDragEnd(loc.x, loc.y);
  }

  private onGlobalMouseUp(ev: EventMouse): void {
    if (!this.isDragging) return;
    const loc = ev.getLocation();
    this.processDragEnd(loc.x, loc.y);
  }

  /** 放手後的共用邏輯：通知 BattleScene 做 Raycast，0.1s 後若未成功則顯示失敗提示 */
  private processDragEnd(screenX: number, screenY: number): void {
    if (this.dragDropCallback) {
      this.dragDropCallback(screenX, screenY);
    }

    // 若 0.1 秒後 isDragging 仍為 true，表示未落在有效格子，顯示提示
    this.scheduleOnce(() => {
      if (!this.isDragging) return; // 已由 selectLane → endDrag 處理完畢
      this.showToast("請拖曳到最前排（第一列）部署");
      this.endDrag();
    }, 0.1);
  }

  // ─── 兵種選擇 ─────────────────────────────────────────────────────────────

  private selectTroop(type: TroopType, slotIndex = 0): void {
    this.selectedType = type;
    this.selectedSlotIndex = slotIndex;
    this.updateSelectionLabel();
    this.updateTroopSelectionVisuals();
    this.refreshButtonStates();
  }

  private updateSelectionLabel(): void {
    const cost = TROOP_DEPLOY_COST[this.selectedType];
    if (!this.selectionLabel) return;

    this.selectionLabel.string = [
      `兵種：${this.toTroopDisplayName(this.selectedType)}`,
      `路線：${this.selectedLane + 1}`,
      `費用：${cost} DP`,
    ].join("\n");

    const button = this.getButtonBySlotIndex(this.selectedSlotIndex);
    const buttonTf = button?.node.getComponent(UITransform);
    const labelTf = this.selectionLabel.getComponent(UITransform) ?? this.selectionLabel.addComponent(UITransform);
    labelTf.setContentSize(320, 100);
    if (button && buttonTf) {
      this.selectionLabel.node.setPosition(new Vec3(
        button.node.position.x + buttonTf.width * 0.5 + labelTf.width * 0.5 + 28,
        button.node.position.y,
        0,
      ));
    }
  }

  private updateTroopSelectionVisuals(): void {
    for (let i = 0; i < this.slotButtons.length; i++) {
      const btn = this.slotButtons[i];
      if (!btn) continue;
      const frameNode = btn.node.getChildByName("SelectionFrame");
      if (!frameNode) continue;
      const opacity = frameNode.getComponent(UIOpacity);
      const isSelected = i === this.selectedSlotIndex;

      if (!isSelected) {
        if (this.activeSelectionFrame === frameNode) {
          this.troopSelectTween?.stop();
          this.troopSelectTween = null;
          this.activeSelectionFrame = null;
        }
        frameNode.setScale(Vec3.ONE);
        if (opacity) opacity.opacity = 0;
        continue;
      }

      this.activeSelectionFrame = frameNode;
      frameNode.setScale(Vec3.ONE);
      if (opacity) opacity.opacity = 255;
      this.troopSelectTween?.stop();
      this.troopSelectTween = tween(frameNode)
        .repeatForever(
          tween(frameNode)
            .to(0.72, { scale: new Vec3(1.04, 1.04, 1) })
            .call(() => { const op = frameNode.getComponent(UIOpacity); if (op) op.opacity = 180; })
            .to(0.72, { scale: Vec3.ONE })
            .call(() => { const op = frameNode.getComponent(UIOpacity); if (op) op.opacity = 255; })
        )
        .start();
    }
  }

  private refreshButtonStates(): void {
    for (let i = 0; i < this.slotButtons.length; i++) {
      const btn = this.slotButtons[i];
      if (!btn) continue;
      btn.interactable = this.currentDp >= TROOP_DEPLOY_COST[this.deploySlots[i]];
    }
  }

  // ─── 按鈕事件 ─────────────────────────────────────────────────────────────

  private onDeployClick(): void {
    if (!this.ctrl) return;
    const outcome = this.ctrl.tryDeployTroop(this.selectedType, this.selectedLane);
    if (outcome.ok) {
      this.endDrag();
      this.refillDeploySlot(this.selectedSlotIndex);
      this.refreshSlotDisplay();
      if (this.deploySlots.length > 0) {
        const nextIndex = Math.max(0, Math.min(this.selectedSlotIndex, this.deploySlots.length - 1));
        this.selectTroop(this.deploySlots[nextIndex], nextIndex);
      }
      this.node.emit("playerDeployed");
      return;
    }
    this.showToast(this.getDeployFailMessage(outcome.reason));
  }

  private refillDeploySlot(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= this.deploySlots.length) {
      return;
    }

    const all: TroopType[] = [
      TroopType.Cavalry,
      TroopType.Infantry,
      TroopType.Shield,
      TroopType.Archer,
      TroopType.Pikeman,
    ];
    const pick = Math.floor(Math.random() * all.length);
    this.deploySlots[slotIndex] = all[pick];
  }

  private onSkillClick(): void {
    if (!this.ctrl) return;
    const success = this.ctrl.triggerGeneralSkill();
    if (!success) {
      this.showToast("技能能量不足！");
    }
  }

  private onDuelClick(): void {
    if (!this.ctrl) return;
    this.node.emit("generalDuel");
  }

  private onTacticsClick(): void {
    if (!this.ctrl) return;
    this.showToast("計謀策略功能開發中");
  }

  private onEndTurnClick(): void {
    if (!this.ctrl) return;
    this.showToast("手動結束回合");
    this.node.emit("endTurn");
  }

  // ─── UI 佈局 ──────────────────────────────────────────────────────────────

  private applyReferenceLayout(): void {
    const DESIGN_W = 1920, DESIGN_H = 1024;
    const panelTf = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    panelTf.setContentSize(DESIGN_W, DESIGN_H);
    this.node.setPosition(new Vec3(0, 0, 0));

    // 4 個槽位按鈕，由上至下排列於左側
    const btnW = 240, btnH = 120, gapY = 20, startX = -820;
    const yPositions = [
      252,
      252 - (btnH + gapY),
      252 - 2 * (btnH + gapY),
      252 - 3 * (btnH + gapY),
    ];
    for (let i = 0; i < this.slotButtons.length; i++) {
      const btn = this.slotButtons[i];
      if (btn) this.layoutIconTextButton(btn, startX, yPositions[i], btnW, btnH);
    }

    if (this.selectionLabel) {
      const tf = this.selectionLabel.getComponent(UITransform) ?? this.selectionLabel.addComponent(UITransform);
      tf.setContentSize(360, 100);
      this.selectionLabel.node.setPosition(new Vec3(-500, 238, 0));
      this.selectionLabel.fontSize = 24;
      this.selectionLabel.lineHeight = 32;
    }

    const funcBtnW = 200, funcBtnH = 70, funcBtnX = 810, funcGapY = 14, funcStartY = -240;
    this.layoutButton(this.btnSkill,   funcBtnX, funcStartY,                            funcBtnW, funcBtnH);
    this.layoutButton(this.btnDuel,    funcBtnX, funcStartY - (funcBtnH + funcGapY),    funcBtnW, funcBtnH);
    this.layoutButton(this.btnTactics, funcBtnX, funcStartY - 2 * (funcBtnH + funcGapY), funcBtnW, funcBtnH);
    this.layoutButton(this.btnEndTurn, funcBtnX, funcStartY - 3 * (funcBtnH + funcGapY), funcBtnW, funcBtnH);

    if (this.toast?.node) {
      this.toast.node.setPosition(new Vec3(0, -280, 0));
    }
  }

  private layoutIconTextButton(btn: Button, x: number, y: number, w: number, h: number): void {
    const tf = btn.node.getComponent(UITransform) ?? btn.node.addComponent(UITransform);
    tf.setContentSize(w, h);
    btn.node.setPosition(new Vec3(x, y, 0));

    const bg = btn.node.getComponent(Sprite) ?? btn.node.addComponent(Sprite);
    bg.type = Sprite.Type.SIMPLE;
    bg.sizeMode = Sprite.SizeMode.CUSTOM;
    bg.color = new Color(50, 50, 60, 240);

    let labelNode = btn.node.getChildByName("Label") ?? btn.node.getComponentInChildren(Label)?.node;
    if (!labelNode) {
      labelNode = new Node("Label");
      labelNode.layer = btn.node.layer;
      btn.node.addChild(labelNode);
      labelNode.addComponent(Label).string = "";
    }
    const label = labelNode.getComponent(Label);
    if (label) {
      label.fontSize = Math.floor(h * 0.25);
      label.lineHeight = Math.floor(h * 0.3);
      label.isBold = true;
      label.color = new Color(255, 255, 255, 220);
    }
    const labelTf = labelNode.getComponent(UITransform) ?? labelNode.addComponent(UITransform);
    labelTf.setContentSize(w, h * 0.35);
    labelNode.setPosition(new Vec3(0, -h * 0.3, 0));

    const oldIcon = btn.node.getChildByName("Icon");
    if (oldIcon) oldIcon.destroy();

    this.ensureSelectionFrame(btn, w, h);
  }

  private ensureSelectionFrame(btn: Button, width: number, height: number): void {
    let frameNode = btn.node.getChildByName("SelectionFrame");
    if (!frameNode) {
      frameNode = new Node("SelectionFrame");
      frameNode.layer = btn.node.layer;
      btn.node.addChild(frameNode);
    }
    frameNode.setSiblingIndex(btn.node.children.length - 1);
    const tf = frameNode.getComponent(UITransform) ?? frameNode.addComponent(UITransform);
    tf.setContentSize(width, height);
    frameNode.setPosition(Vec3.ZERO);

    const opacity = frameNode.getComponent(UIOpacity) ?? frameNode.addComponent(UIOpacity);
    opacity.opacity = 0;

    const g = frameNode.getComponent(Graphics) ?? frameNode.addComponent(Graphics);
    g.clear();
    g.lineWidth = 12;
    g.strokeColor = new Color(90, 220, 255, 90);
    g.roundRect(-width * 0.5 + 8, -height * 0.5 + 8, width - 16, height - 16, 20);
    g.stroke();
    g.lineWidth = 5;
    g.strokeColor = new Color(180, 245, 255, 255);
    g.roundRect(-width * 0.5 + 10, -height * 0.5 + 10, width - 20, height - 20, 18);
    g.stroke();
  }

  private layoutButton(btn: Button | null, x: number, y: number, w: number, h: number): void {
    if (!btn) return;
    const tf = btn.node.getComponent(UITransform) ?? btn.node.addComponent(UITransform);
    tf.setContentSize(w, h);
    btn.node.setPosition(new Vec3(x, y, 0));
    const label = btn.node.getComponent(Label);
    if (label) { label.fontSize = 20; label.lineHeight = 24; }
  }

  // ─── 輔助方法 ─────────────────────────────────────────────────────────────

  /**
   * Inspector 若漏綁時，自動從子節點名稱補綁，降低場景搭建失誤成本。
   * 若節點完全不存在，則動態建立以避免 crash。
   */
  private ensureBindings(): void {
    const getBtn = (name: string): Button | null => {
      const n = this.node.getChildByName(name);
      if (!n) return null;
      if (!n.getComponent(UITransform)) n.addComponent(UITransform).setContentSize(120, 50);
      if (!n.getComponent(Sprite) && !n.getComponent(Label)) {
        n.addComponent(Sprite).color = new Color(60, 60, 180, 200);
      }
      return n.getComponent(Button) ?? n.addComponent(Button);
    };

    const createBtn = (name: string, label: string): Button => {
      const n = new Node(name);
      n.layer = this.node.layer;
      n.addComponent(UITransform).setContentSize(120, 50);
      n.addComponent(Sprite).color = new Color(60, 60, 180, 200);
      const btn = n.addComponent(Button);
      const lblNode = new Node("Label");
      lblNode.layer = n.layer;
      lblNode.addComponent(UITransform);
      const lbl = lblNode.addComponent(Label);
      lbl.string = label;
      lbl.fontSize = 20;
      lbl.color = new Color(255, 255, 255);
      n.addChild(lblNode);
      this.node.addChild(n);
      console.log(`[DeployPanel] 動態建立按鈕節點: ${name}`);
      return btn;
    };

    if (!this.btnCavalry)  this.btnCavalry  = getBtn("BtnCavalry")  ?? createBtn("BtnCavalry",  "騎兵");
    if (!this.btnInfantry) this.btnInfantry = getBtn("BtnInfantry") ?? createBtn("BtnInfantry", "步兵");
    if (!this.btnShield)   this.btnShield   = getBtn("BtnShield")   ?? createBtn("BtnShield",   "盾兵");
    if (!this.btnArcher)   this.btnArcher   = getBtn("BtnArcher")   ?? createBtn("BtnArcher",   "弓兵");
    if (!this.btnPikeman)  this.btnPikeman  = getBtn("BtnPikeman")  ?? createBtn("BtnPikeman",  "槍兵");
    if (!this.btnSkill)    this.btnSkill    = getBtn("BtnSkill")    ?? createBtn("BtnSkill",    "發動技能");
    if (!this.btnDuel)     this.btnDuel     = getBtn("BtnDuel")     ?? createBtn("BtnDuel",     "武將單挑");
    if (!this.btnTactics)  this.btnTactics  = getBtn("BtnTactics")  ?? createBtn("BtnTactics",  "計謀策略");
    if (!this.btnEndTurn)  this.btnEndTurn  = getBtn("BtnEndTurn")  ?? createBtn("BtnEndTurn",  "結束回合");

    if (!this.selectionLabel) {
      const n = this.node.getChildByName("SelectionLabel");
      this.selectionLabel = n?.getComponent(Label) ?? null!;
    }

    if (!this.toast) {
      const toastNode = this.node.getChildByName("Toast");
      if (toastNode) {
        this.toast = toastNode.getComponent(ToastMessage) ?? toastNode.addComponent(ToastMessage);
      } else {
        const n = new Node("Toast");
        this.node.addChild(n);
        this.toast = n.addComponent(ToastMessage);
      }
    }

    this.laneButtons = [];
    for (let i = 1; i <= 5; i++) {
      const btn = getBtn(`LaneButton${i}`);
      if (btn) {
        btn.node.active = false;
        this.laneButtons.push(btn);
      }
    }
  }

  private toTroopDisplayName(type: TroopType): string {
    const map: Partial<Record<TroopType, string>> = {
      [TroopType.Cavalry]:  "騎兵",
      [TroopType.Infantry]: "步兵",
      [TroopType.Shield]:   "盾兵",
      [TroopType.Archer]:   "弓兵",
      [TroopType.Pikeman]:  "槍兵",
    };
    return map[type] ?? type;
  }

  private toIconName(type: TroopType): string {
    const map: Partial<Record<TroopType, string>> = {
      [TroopType.Cavalry]:  "cavalry",
      [TroopType.Infantry]: "infantry",
      [TroopType.Shield]:   "shield",
      [TroopType.Archer]:   "archer",
      [TroopType.Pikeman]:  "pikeman",
    };
    return map[type] ?? "infantry";
  }

  /** 依照當前選中的槽位索引取得按鈕，用來定位 selectionLabel */
  private getButtonBySlotIndex(slotIndex: number): Button | null {
    if (slotIndex < 0 || slotIndex >= this.slotButtons.length) {
      return null;
    }
    return this.slotButtons[slotIndex];
  }

  private getDeployFailMessage(reason?: DeployFailReason): string {
    if (reason === "limit")    return "本回合已部署，請等待下一回合";
    if (reason === "occupied") return "目標格已有單位，請改放其他格子";
    return "DP 不足，無法部署";
  }
}

