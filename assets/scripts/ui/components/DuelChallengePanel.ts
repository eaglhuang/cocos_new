// @spec-source → 見 docs/cross-reference-index.md
import {
  _decorator,
  Button,
  Color,
  Graphics,
  Label,
  Node,
  Sprite,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
} from "cc";
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';

const { ccclass } = _decorator;

/**
 * DuelChallengePanel — 武將單挑確認 UI
 *
 * 當敵方武將推進到我方武將面前並發起單挑時，彈出此面板讓玩家選擇「接受」或「拒絕」。
 * 整個 UI 節點以程式碼動態建立，不需在 Inspector 中額外綁定子節點。
 *
 * 【使用方式】
 *   1. 建立一個空的 Node，掛載此元件
 *   2. 在 BattleScene 的 @property 中綁定此元件引用
 *   3. 呼叫 show() 顯示面板，監聽 node 事件取得玩家決定
 *
 * 【事件】
 *   "duelAccepted" — 玩家點擊「接受單挑」
 *   "duelRejected" — 玩家點擊「拒絕挑戰」
 *
 * Unity 對照：類似 Unity 的 ConfirmDialog + UnityEvent，
 * 但 Cocos 用 Node.emit() 做一次性事件回調，避免緊耦合。
 */
@ccclass("DuelChallengePanel")
export class DuelChallengePanel extends UIPreviewBuilder {
  private titleLabel: Label | null = null;
  private scoreLabel: Label | null = null;

  onLoad(): void {
    this.buildUI();
    this.node.active = false;
  }

  /**
   * 顯示單挑確認面板。
   *
   * @param challengerName  發起單挑的武將名稱（敵方）
   * @param defenderName    受挑戰的武將名稱（我方）
   * @param score           我方戰力評估分數（0~1，越高越有把握）
   */
  show(challengerName: string, defenderName: string, score: number): void {
    if (this.titleLabel) {
      this.titleLabel.string = `⚔  敵將 ${challengerName} 向 ${defenderName} 發起單挑！`;
    }
    if (this.scoreLabel) {
      const level = score >= 0.6 ? "我方佔優" : score >= 0.4 ? "勢均力敵" : "我方劣勢";
      this.scoreLabel.string = `我方武將評估：${level}（評分 ${(score * 100).toFixed(0)}）`;
    }

    // 推到父節點最頂層確保顯示在最上方
    if (this.node.parent) {
      this.node.setSiblingIndex(this.node.parent.children.length - 1);
    }

    this.node.active = true;
    const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    opacity.opacity = 0;
    tween(opacity).to(0.15, { opacity: 255 }).start();
  }

  hide(): void {
    const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    tween(opacity)
      .to(0.12, { opacity: 0 })
      .call(() => { this.node.active = false; })
      .start();
  }

  // ── 按鈕回調 ───────────────────────────────────────────────────────────────

  private onAcceptClick(): void {
    this.hide();
    // 讓 BattleScene 監聽此事件做後續結算
    this.node.emit("duelAccepted");
  }

  private onRejectClick(): void {
    this.hide();
    this.node.emit("duelRejected");
  }

  // ── UI 自建 ────────────────────────────────────────────────────────────────

  private buildUI(): void {
    // 1. 讓根節點填滿畫面（攔截點擊，避免玩家誤點底層 UI）
    this.ensureRect(this.node, 1920, 1024);
    this.paintRect(this.node, 1920, 1024, new Color(0, 0, 0, 140));

    // 2. 中央卡片底板
    const card = this.getOrCreateChild(this.node, "_Card");
    this.ensureRect(card, 640, 320);
    this.paintRect(card, 640, 320, new Color(15, 15, 35, 245));
    card.setPosition(new Vec3(0, 30, 0));

    // 3. 裝飾：頂部橫條（金色）
    const topBar = this.getOrCreateChild(card, "_TopBar");
    this.ensureRect(topBar, 640, 6);
    this.paintRect(topBar, 640, 6, new Color(200, 160, 50, 255));
    topBar.setPosition(new Vec3(0, 157, 0));

    // 4. 標題 Label
    const titleNode = this.getOrCreateChild(card, "_Title");
    titleNode.setPosition(new Vec3(0, 90, 0));
    this.ensureRect(titleNode, 600, 60);
    const titleLbl = titleNode.getComponent(Label) ?? titleNode.addComponent(Label);
    titleLbl.fontSize = 26;
    titleLbl.lineHeight = 38;
    titleLbl.color = new Color(255, 215, 80, 255); // 金黃色
    this.titleLabel = titleLbl;

    // 5. 評估分數 Label
    const scoreNode = this.getOrCreateChild(card, "_Score");
    scoreNode.setPosition(new Vec3(0, 20, 0));
    this.ensureRect(scoreNode, 560, 48);
    const scoreLbl = scoreNode.getComponent(Label) ?? scoreNode.addComponent(Label);
    scoreLbl.fontSize = 22;
    scoreLbl.color = new Color(200, 200, 200, 255);
    this.scoreLabel = scoreLbl;

    // 6. 提示文字
    const hintNode = this.getOrCreateChild(card, "_Hint");
    hintNode.setPosition(new Vec3(0, -30, 0));
    this.ensureRect(hintNode, 560, 40);
    const hintLbl = hintNode.getComponent(Label) ?? hintNode.addComponent(Label);
    hintLbl.fontSize = 18;
    hintLbl.color = new Color(160, 160, 180, 255);
    hintLbl.string = "接受單挑可一決雌雄；拒絕則我方全軍攻防減半。";

    // 7. 接受按鈕（左側，綠色系）
    const btnAcceptNode = this.getOrCreateChild(card, "_BtnAccept");
    btnAcceptNode.setPosition(new Vec3(-145, -115, 0));
    this.ensureRect(btnAcceptNode, 230, 58);
    this.paintRect(btnAcceptNode, 230, 58, new Color(35, 100, 40, 245));
    this.addLabelToNode(btnAcceptNode, "✔  接受單挑", 23, new Color(200, 255, 200, 255));
    const btnAccept = btnAcceptNode.getComponent(Button) ?? btnAcceptNode.addComponent(Button);
    btnAccept.node.on(Button.EventType.CLICK, this.onAcceptClick, this);

    // 8. 拒絕按鈕（右側，紅色系）
    const btnRejectNode = this.getOrCreateChild(card, "_BtnReject");
    btnRejectNode.setPosition(new Vec3(145, -115, 0));
    this.ensureRect(btnRejectNode, 230, 58);
    this.paintRect(btnRejectNode, 230, 58, new Color(110, 35, 35, 245));
    this.addLabelToNode(btnRejectNode, "✘  拒絕挑戰", 23, new Color(255, 200, 200, 255));
    const btnReject = btnRejectNode.getComponent(Button) ?? btnRejectNode.addComponent(Button);
    btnReject.node.on(Button.EventType.CLICK, this.onRejectClick, this);
  }

  private getOrCreateChild(parent: Node, name: string): Node {
    return parent.getChildByName(name) ?? (() => {
      const n = new Node(name);
      n.layer = parent.layer;
      parent.addChild(n);
      return n;
    })();
  }

  private ensureRect(node: Node, w: number, h: number): void {
    (node.getComponent(UITransform) ?? node.addComponent(UITransform)).setContentSize(w, h);
  }

  private paintRect(node: Node, w: number, h: number, color: Color): void {
    // 先移除 Sprite 避免干擾 Graphics 繪製
    node.getComponent(Sprite)?.destroy();
    const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
    g.clear();
    g.fillColor = color;
    g.roundRect(-w * 0.5, -h * 0.5, w, h, 14);
    g.fill();
  }

  private addLabelToNode(parent: Node, text: string, fontSize: number, color: Color): void {
    const lblNode = this.getOrCreateChild(parent, "_Lbl");
    lblNode.setPosition(Vec3.ZERO);
    this.ensureRect(lblNode, 220, 58);
    const lbl = lblNode.getComponent(Label) ?? lblNode.addComponent(Label);
    lbl.string = text;
    lbl.fontSize = fontSize;
    lbl.color = color;
  }
}
