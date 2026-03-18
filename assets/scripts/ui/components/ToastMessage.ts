import { _decorator, Color, Component, Label, Node, Tween, tween, UITransform, Vec3 } from "cc";

const { ccclass, property } = _decorator;

export interface ToastOptions {
  color?: Color;
  position?: Vec3;
  fontSize?: number;
  width?: number;
}

@ccclass("ToastMessage")
export class ToastMessage extends Component {
  @property(Label)
  messageLabel: Label = null!;

  private hideTween: Tween<Node> | null = null;
  private readonly defaultPosition = new Vec3(0, 120, 0);
  private defaultFontSize = 26;
  private defaultWidth = 520;

  onLoad(): void {
    this.ensureBindings();
    this.node.active = false;
  }

  public show(message: string, duration = 1.2, options?: ToastOptions): void {
    if (!this.messageLabel) return;

    this.messageLabel.string = message;
    this.messageLabel.fontSize = options?.fontSize ?? this.defaultFontSize;
    this.messageLabel.lineHeight = this.messageLabel.fontSize + 6;
    this.messageLabel.color = options?.color ?? new Color(255, 255, 255, 255);

    const tf = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    tf.setContentSize(options?.width ?? this.defaultWidth, Math.max(40, this.messageLabel.lineHeight + 10));
    this.node.setPosition(options?.position ?? this.defaultPosition);
    this.node.active = true;

    const current = this.messageLabel.color;
    this.messageLabel.color = new Color(current.r, current.g, current.b, 255);

    if (this.hideTween) {
      this.hideTween.stop();
      this.hideTween = null;
    }

    this.hideTween = tween(this.node)
      .delay(Math.max(0.2, duration))
      .call(() => {
        const c = this.messageLabel.color;
        this.messageLabel.color = new Color(c.r, c.g, c.b, 0);
        this.node.active = false;
      })
      .start();
  }

  private ensureBindings(): void {
    if (!this.messageLabel) {
      this.messageLabel = this.node.getComponent(Label) ?? this.node.addComponent(Label);
    }

    const tf = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    tf.setContentSize(this.defaultWidth, 40);

    this.defaultFontSize = this.messageLabel.fontSize || 26;

    if (!this.node.parent) return;
    this.node.setPosition(this.defaultPosition);
  }
}
