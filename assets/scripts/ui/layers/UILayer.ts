import { _decorator, Component, UIOpacity, tween } from "cc";

const { ccclass, property } = _decorator;

/**
 * UILayer — UI 層基底元件（M-1 分層架構基礎，M-2 快取協定）
 *
 * 所有 UI 面板元件應繼承此類並覆寫 resetState() 清除殘留資料。
 *
 * Unity 對照：類似 Unity 中 UI Panel 基底類別搭配 OnEnable/OnDisable，
 * 但 resetState() 明確對應「從快取取出前的重置」語義，
 * 避免 OnEnable 被太多系統呼叫而產生副作用。
 */
@ccclass("UILayer")
export class UILayer extends Component {
  @property
  public blocksInput = false;

  /** 顯示面板（淡入動畫） */
  public show(): void {
    this.node.active = true;
    const opacity = this.getOrAddOpacity();
    opacity.opacity = 0;
    tween(opacity).to(0.12, { opacity: 255 }).start();
  }

  /** 隱藏面板（淡出動畫 → active=false） */
  public hide(): void {
    const opacity = this.getOrAddOpacity();
    tween(opacity)
      .to(0.12, { opacity: 0 })
      .call(() => {
        this.node.active = false;
      })
      .start();
  }

  /**
   * 快取重置鉤子（M-2）— 從快取取出並重新顯示前呼叫。
   *
   * 子類應覆寫此方法清除面板的殘留狀態（例：結算數據、輸入欄位、選中項目）。
   * 預設為 no-op，不需強制實作。
   *
   * Unity 對照：類似 Unity Pooling 中 IPoolable.OnSpawn()，
   * 在節點被取出時重置狀態，而非依賴 OnEnable 的副作用。
   */
  public resetState(): void {
    // 子類視需要覆寫
  }

  private getOrAddOpacity(): UIOpacity {
    return this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
  }
}