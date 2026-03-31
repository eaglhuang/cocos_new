// @spec-source → 見 docs/cross-reference-index.md
import { Component, Node } from "cc";

type EventHandler<T = any> = (payload?: T) => void;

export class EventSystem {
  private listeners = new Map<string, EventHandler[]>();

  public on<T = any>(eventName: string, handler: EventHandler<T>): () => void {
    const handlers = this.listeners.get(eventName) || [];
    handlers.push(handler as EventHandler);
    this.listeners.set(eventName, handlers);
    return () => this.off(eventName, handler);
  }

  public off<T = any>(eventName: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(eventName);
    if (!handlers) {
      return;
    }

    const nextHandlers = handlers.filter((item) => item !== handler);
    if (nextHandlers.length === 0) {
      this.listeners.delete(eventName);
      return;
    }

    this.listeners.set(eventName, nextHandlers);
  }

  public emit<T = any>(eventName: string, payload?: T): void {
    const handlers = this.listeners.get(eventName);
    if (!handlers) {
      return;
    }

    handlers.slice().forEach((handler) => handler(payload));
  }

  /**
   * 單次監聽：handler 被呼叫一次後自動解除監聽。
   * 適用於「等待某個一次性事件」的場景，例如等待單位死亡後播放動畫。
   *
   * Unity 對照：類似 UniRx 的 First() operator，或 C# Action 的 once 包裝器。
   *
   * @returns 取消監聽的函式（若需提前取消）
   */
  public once<T = any>(eventName: string, handler: EventHandler<T>): () => void {
    const wrapper: EventHandler = (payload) => {
      handler(payload);
      this.off(eventName, wrapper);
    };
    return this.on(eventName, wrapper);
  }

  /**
   * 綁定監聽並在 Component 的節點被銷毀時自動解除。
   * 解決 View Component 忘記在 onDestroy 呼叫 off 導致的幽靈監聽問題。
   *
   * Unity 對照：類似 UniRx 的 .AddTo(this)，確保訂閱隨物件生命週期結束。
   *
   * 使用範例：
   *   services().event.onBind(EVENT_NAMES.UnitDied, this.onUnitDied, this);
   *   // 不再需要 onDestroy 中手動 off
   *
   * @param target  持有此監聽的 Component，節點銷毀時自動 off
   */
  public onBind<T = any>(
    eventName: string,
    handler: EventHandler<T>,
    target: Component
  ): void {
    this.on(eventName, handler);
    // 監聽 Cocos 節點的 NODE_DESTROYED 系統事件，確保元件銷毀後自動清理
    target.node.once(Node.EventType.NODE_DESTROYED, () => {
      this.off(eventName, handler);
    });
  }

  public clear(): void {
    this.listeners.clear();
  }
}