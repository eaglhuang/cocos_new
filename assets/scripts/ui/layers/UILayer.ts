import { _decorator, Component, UIOpacity, tween } from "cc";

const { ccclass, property } = _decorator;

@ccclass("UILayer")
export class UILayer extends Component {
  @property
  public blocksInput = false;

  public show(): void {
    this.node.active = true;
    const opacity = this.getOrAddOpacity();
    opacity.opacity = 0;
    tween(opacity).to(0.12, { opacity: 255 }).start();
  }

  public hide(): void {
    const opacity = this.getOrAddOpacity();
    tween(opacity)
      .to(0.12, { opacity: 0 })
      .call(() => {
        this.node.active = false;
      })
      .start();
  }

  private getOrAddOpacity(): UIOpacity {
    return this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
  }
}