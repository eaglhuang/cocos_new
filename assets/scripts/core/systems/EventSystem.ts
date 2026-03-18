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

  public clear(): void {
    this.listeners.clear();
  }
}