import { _decorator, Button, Color, Graphics, Label, Node, Sprite, UITransform, Vec3 } from "cc";
import { UILayer } from "../layers/UILayer";

const { ccclass, property } = _decorator;

/**
 * ResultPopup — 戰鬥結果彈出層。
 * 顯示勝/負/平局文字，提供「再來一場」按鈕。
 * 
 * 繼承自 UILayer，可透過 show() / hide() 淡入淡出。
 * 開啟時自動建立半透明遮罩 + 有色底板，且節點層級會被推到最頂層。
 */
@ccclass("ResultPopup")
export class ResultPopup extends UILayer {
  @property(Label)
  titleLabel: Label = null!;

  @property(Label)
  descLabel: Label = null!;

  @property(Button)
  btnReplay: Button = null!;

  onLoad(): void {
    super.onLoad?.();
    this.btnReplay?.node.on(Button.EventType.CLICK, this.onReplayClick, this);
    // 預設隱藏
    this.node.active = false;

    this.ensureBackground();
  }

  /**
   * 確保底板存在：建立全螢幕半透明遮罩 + 中央有色底板。
   * 只建立一次，後續 showResult 直接顯示。
   */
  private ensureBackground(): void {
    // 1. 讓 Popup 節點本身填滿全畫面（方便攔截觸控事件）
    const rootTf = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    rootTf.setContentSize(1920, 1024);

    // 2. 半透明黑色遮罩（全螢幕）
    const mask = this.node.getChildByName("_Mask") ?? new Node("_Mask");
    if (!mask.parent) {
      mask.layer = this.node.layer;
      this.node.insertChild(mask, 0); // 最底層
    }
    (mask.getComponent(UITransform) ?? mask.addComponent(UITransform)).setContentSize(1920, 1024);
    mask.setPosition(Vec3.ZERO);
    this.paintSolidRect(mask, 1920, 1024, new Color(0, 0, 0, 160));

    // 3. 中央有色底板
    const card = this.node.getChildByName("_CardBg") ?? new Node("_CardBg");
    if (!card.parent) {
      card.layer = this.node.layer;
      // 置於 Mask 後面、文字+按鈕前面
      this.node.insertChild(card, 1);
    }
    (card.getComponent(UITransform) ?? card.addComponent(UITransform)).setContentSize(600, 340);
    card.setPosition(Vec3.ZERO);
    this.paintSolidRect(card, 600, 340, new Color(30, 30, 50, 230));

    // 4. 確保文字與按鈕在底板上方
    this.titleLabel?.node && this.ensureChildOnTop(this.titleLabel.node);
    this.descLabel?.node  && this.ensureChildOnTop(this.descLabel.node);
    this.btnReplay?.node  && this.ensureChildOnTop(this.btnReplay.node);
  }

  private ensureChildOnTop(child: Node): void {
    if (child.parent === this.node) {
      child.setSiblingIndex(this.node.children.length - 1);
    }
  }

  /**
   * 顯示結果彈窗。
   * @param result "player-win" | "enemy-win" | "draw"
   */
  public showResult(result: string): void {
    let title = "";
    let desc  = "";
    let cardColor = new Color(30, 30, 50, 230);

    switch (result) {
      case "player-win":
        title = "🎉 勝利！";
        desc  = "我方成功擊敗敵軍，取得大勝！";
        cardColor = new Color(20, 60, 30, 230);
        break;
      case "enemy-win":
        title = "💀 落敗";
        desc  = "敵方突破防線，再接再厲！";
        cardColor = new Color(70, 20, 20, 230);
        break;
      case "draw":
        title = "⚔️ 平局";
        desc  = "雙方勢均力敵，不分勝負。";
        break;
      default:
        title = "戰鬥結束";
        desc  = "";
    }

    if (this.titleLabel) this.titleLabel.string = title;
    if (this.descLabel)  this.descLabel.string  = desc;

    // 更新底板顏色
    const cardBg = this.node.getChildByName("_CardBg");
    if (cardBg) {
      this.paintSolidRect(cardBg, 600, 340, cardColor);
    }

    // 推到父節點的最頂層，確保 UI 層級最高
    if (this.node.parent) {
      this.node.setSiblingIndex(this.node.parent.children.length - 1);
    }

    this.node.active = true;
    this.show();
  }

  private onReplayClick(): void {
    this.hide();
    // 通知父節點重新開局
    this.node.emit("replay");
  }

  private paintSolidRect(node: Node, width: number, height: number, color: Color): void {
    // 若節點上存在 Sprite，先移除，避免與 Graphics 行為互相干擾。
    const sprite = node.getComponent(Sprite);
    if (sprite) {
      sprite.destroy();
    }

    const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
    g.clear();
    g.fillColor = color;
    g.roundRect(-width * 0.5, -height * 0.5, width, height, 18);
    g.fill();
  }
}
