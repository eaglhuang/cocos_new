import { _decorator, Component, Label, Node, ProgressBar, UITransform, Vec3 } from "cc";
import { EVENT_NAMES, Faction } from "../../core/config/Constants";
import { ServiceLoader, services } from "../../core/managers/ServiceLoader";

const { ccclass, property } = _decorator;

/**
 * BattleHUD — 戰鬥介面抬頭顯示器。
 * 顯示：回合數、DP（部署點數）、SP（武將能量條）、雙方主將血量。
 * 
 * 使用方式：掛載至 Canvas 下的 HUD 節點，在 Inspector 中綁定各個子節點。
 */
@ccclass("BattleHUD")
export class BattleHUD extends Component {
  // ─── 回合 & DP ───────────────────────────────────────────────────────────
  @property(Label)
  turnLabel: Label = null!;

  @property(Label)
  dpLabel: Label = null!;

  // ─── 武將 SP 能量條 ───────────────────────────────────────────────────────
  @property(ProgressBar)
  playerSpBar: ProgressBar = null!;

  @property(Label)
  playerSpLabel: Label = null!;

  // 右側顯示敵方 SP
  @property(ProgressBar)
  enemySpBar: ProgressBar = null!;

  @property(Label)
  enemySpLabel: Label = null!;

  // ─── 主將血量（沿用既有 UI 節點） ─────────────────────────────────────────
  @property(ProgressBar)
  playerFortressBar: ProgressBar = null!;

  @property(Label)
  playerFortressLabel: Label = null!;

  @property(ProgressBar)
  enemyFortressBar: ProgressBar = null!;

  @property(Label)
  enemyFortressLabel: Label = null!;

  // ─── 狀態訊息（顯示技能提示、暈眩等） ─────────────────────────────────────
  @property(Label)
  statusLabel: Label = null!;

  private playerGeneralMaxHp = 1;
  private enemyGeneralMaxHp  = 1;
  private readonly unsubs: Array<() => void> = [];

  onLoad(): void {
    this.ensureBindings();
    this.applyReferenceLayout();
    // 確保 ServiceLoader 已初始化（避免 onLoad 早於 BattleScene.start 但需要事件系統）
    // 傳入 this.node 作為 AudioSystem 的 hostNode
    ServiceLoader.getInstance().initialize(this.node);
    const svc = services();
    this.unsubs.push(
      svc.event.on(EVENT_NAMES.TurnPhaseChanged,   this.onTurnPhaseChanged.bind(this)),
      svc.event.on(EVENT_NAMES.GeneralSpChanged,   this.onGeneralSpChanged.bind(this)),
      svc.event.on(EVENT_NAMES.GeneralDamaged,     this.onGeneralDamaged.bind(this)),
      svc.event.on(EVENT_NAMES.GeneralSkillUsed,   this.onGeneralSkillUsed.bind(this)),
      svc.event.on(EVENT_NAMES.GeneralSkillEffect, this.onSkillEffect.bind(this)),
    );
    console.log("[BattleHUD] onLoad 完成，事件已訂閱");
  }

  private applyReferenceLayout(): void {
    // ── HUD node 設為全畫面容器，使子節點可用 Canvas 座標定位 ────────────────
    // 對照 Unity：把 HUD Panel RectTransform 拉滿全畫面的透明容器層
    const DESIGN_W = 1920, DESIGN_H = 1024;
    const hudTf = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    hudTf.setContentSize(DESIGN_W, DESIGN_H);
    this.node.setPosition(new Vec3(0, 0, 0));

    // ── 頂部狀態列（y ≈ +440 ~ +480）────────────────────────────────────────
    // 左側：回合 / DP / SP 條
    this.layoutNode(this.turnLabel?.node ?? null,          -860, +475, 140, 30);
    this.layoutNode(this.dpLabel?.node ?? null,            -700, +475, 120, 30);
    this.layoutNode(this.playerSpBar?.node ?? null,        -520, +477, 160, 18);
    // 我方 SP 數字移到技能按鈕上方，強化可見性
    this.layoutNode(this.playerSpLabel?.node ?? null,      +810, -320, 120, 30);
    // 右側：敵方 SP 條（靠近血量欄）
    this.layoutNode(this.enemySpBar?.node ?? null,         +520, +477, 160, 18);
    this.layoutNode(this.enemySpLabel?.node ?? null,       +860, +475, 120, 30);
    // 左側：我方 HP 條（第二層）
    this.layoutNode(this.playerFortressLabel?.node ?? null, -800, +447, 150, 26);
    this.layoutNode(this.playerFortressBar?.node ?? null,   -630, +443, 180, 18);
    // 右側：敵方 HP 條
    this.layoutNode(this.enemyFortressLabel?.node ?? null,  +715, +475, 145, 26);
    this.layoutNode(this.enemyFortressBar?.node ?? null,    +545, +443, 180, 18);
    // 畫面中上：狀態訊息（技能提示、暈眩等）
    this.layoutNode(this.statusLabel?.node ?? null,          +50, +475, 400, 30);
  }

  private layoutNode(node: Node | null, x: number, y: number, width: number, height: number): void {
    if (!node) return;
    const tf = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    tf.setContentSize(width, height);
    node.setPosition(new Vec3(x, y, 0));
  }

  /**
   * 自動從子節點名稱補綁 Inspector 可能遺漏的引用。
   */
  private ensureBindings(): void {
    const findLabel = (name: string): Label | null => {
      const n = this.node.getChildByName(name);
      return n?.getComponent(Label) ?? null;
    };
    const findBar = (name: string): ProgressBar | null => {
      const n = this.node.getChildByName(name);
      return n?.getComponent(ProgressBar) ?? null;
    };
    
    if (!this.enemySpBar)   this.enemySpBar   = findBar("EnemySpBar")!;
    if (!this.enemySpLabel) this.enemySpLabel = findLabel("EnemySpLabel")!;

    if (!this.turnLabel)          this.turnLabel          = findLabel("TurnLabel")!;
    if (!this.dpLabel)            this.dpLabel            = findLabel("DpLabel")!;
    if (!this.playerSpBar)        this.playerSpBar        = findBar("PlayerSpBar")!;
    if (!this.playerSpLabel)      this.playerSpLabel      = findLabel("PlayerSpLabel")!;
    if (!this.playerFortressBar)  this.playerFortressBar  = findBar("PlayerFortressBar")!;
    if (!this.playerFortressLabel) this.playerFortressLabel = findLabel("PlayerFortressLabel")!;
    if (!this.enemyFortressBar)   this.enemyFortressBar   = findBar("EnemyFortressBar")!;
    if (!this.enemyFortressLabel) this.enemyFortressLabel = findLabel("EnemyFortressLabel")!;
    if (!this.statusLabel)        this.statusLabel        = findLabel("StatusLabel")!;

    console.log(`[BattleHUD] 綁定狀態 — turn:${!!this.turnLabel} dp:${!!this.dpLabel} sp:${!!this.playerSpBar} status:${!!this.statusLabel}`);
  }

  onDestroy(): void {
    this.unsubs.forEach(fn => fn());
    this.unsubs.length = 0;
  }

  /** 初始化顯示（由 BattleScene 在開戰後呼叫） */
  public refresh(
    turn: number,
    dp: number,
    playerSp: number,
    playerMaxSp: number,
    enemySp: number,
    enemyMaxSp: number,
    playerGeneralHp: number,
    playerGeneralMaxHp: number,
    enemyGeneralHp: number,
    enemyGeneralMaxHp: number,
  ): void {
    this.setTurn(turn);
    this.setDp(dp);
    this.setPlayerSp(playerSp, playerMaxSp);
    this.setEnemySp(enemySp, enemyMaxSp);
    this.playerGeneralMaxHp = Math.max(1, playerGeneralMaxHp);
    this.enemyGeneralMaxHp  = Math.max(1, enemyGeneralMaxHp);
    this.setGeneralHealth(Faction.Player, playerGeneralHp);
    this.setGeneralHealth(Faction.Enemy, enemyGeneralHp);
    this.clearStatus();
  }

  private onTurnPhaseChanged(snap: { turn: number; playerDp: number }): void {
    this.setTurn(snap.turn);
    this.setDp(snap.playerDp);
    this.clearStatus();
  }

  private onGeneralSpChanged(data: { faction: Faction; sp: number; maxSp: number }): void {
    if (data.faction === Faction.Player) {
      this.setPlayerSp(data.sp, data.maxSp);
    } else {
      this.setEnemySp(data.sp, data.maxSp);
    }
  }

  private onGeneralDamaged(data: { faction: Faction; hp: number }): void {
    this.setGeneralHealth(data.faction, data.hp);
  }

  private onGeneralSkillUsed(data: { faction: Faction }): void {
    if (data.faction === Faction.Player) {
      this.showStatus("張飛發動技能！");
    }
  }

  private onSkillEffect(data: { skillId: string; faction: Faction }): void {
    if (data.skillId === "zhang-fei-roar") {
      this.showStatus("⚡ 震吼！敵方全體暈眩 1 回合！盾牆瓦解！");
    }
  }

  // ─── 內部更新方法 ──────────────────────────────────────────────────────────

  private setTurn(turn: number): void {
    if (this.turnLabel) this.turnLabel.string = `第 ${turn} 回合`;
  }

  public setDp(dp: number): void {
    if (this.dpLabel) this.dpLabel.string = `DP: ${dp}`;
  }

  private setPlayerSp(sp: number, maxSp: number): void {
    if (this.playerSpBar)   this.playerSpBar.progress   = maxSp > 0 ? sp / maxSp : 0;
    if (this.playerSpLabel) this.playerSpLabel.string    = `${sp}/${maxSp}`;
  }

  private setEnemySp(sp: number, maxSp: number): void {
    if (this.enemySpBar)   this.enemySpBar.progress   = maxSp > 0 ? sp / maxSp : 0;
    if (this.enemySpLabel) this.enemySpLabel.string    = `${sp}/${maxSp}`;
  }

  private setGeneralHealth(faction: Faction, hp: number): void {
    const max = faction === Faction.Player ? this.playerGeneralMaxHp : this.enemyGeneralMaxHp;
    const ratio = max > 0 ? hp / max : 0;

    if (faction === Faction.Player) {
      if (this.playerFortressBar)   this.playerFortressBar.progress   = ratio;
      if (this.playerFortressLabel) this.playerFortressLabel.string    = `我將 ${hp}`;
    } else {
      if (this.enemyFortressBar)    this.enemyFortressBar.progress     = ratio;
      if (this.enemyFortressLabel)  this.enemyFortressLabel.string     = `敵將 ${hp}`;
    }
  }

  private showStatus(msg: string): void {
    if (this.statusLabel) this.statusLabel.string = msg;
  }

  private clearStatus(): void {
    if (this.statusLabel) this.statusLabel.string = "";
  }
}
