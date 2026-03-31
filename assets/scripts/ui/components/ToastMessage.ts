// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Color, Label, Node, Tween, tween, UITransform, UIOpacity } from "cc";
import { services } from "../../core/managers/ServiceLoader";
import { UIPreviewBuilder } from "../core/UIPreviewBuilder";
import { UISpecLoader } from "../core/UISpecLoader";

const { ccclass } = _decorator;

export interface ToastOptions {
  color?: Color;
  duration?: number;
}

@ccclass("ToastMessage")
export class ToastMessage extends UIPreviewBuilder {
  
  private _specLoader = new UISpecLoader();
  private hideTween: Tween<UIOpacity> | null = null;
  private _isBuilt = false;

  start(): void {
    this.node.active = false;
    // 監聽全域事件以便讓 SyncManager 等非 UI 腳本可以發送提示
    services().event.onBind('SHOW_TOAST', (payload: { message: string, duration?: number }) => {
        this.show(payload.message, payload.duration);
    }, this);
  }

  public async show(message: string, duration = 1.2, options?: ToastOptions): Promise<void> {
    if (!this._isBuilt) {
        // 1. 動態載入三層結構契約與 Design Tokens v2.2
        const layout = await this._specLoader.loadLayout('toast-message-main');
        const skin = await this._specLoader.loadSkin('toast-message-default');
        const i18n = await this._specLoader.loadI18n('zh-TW');
        const tokens = await this._specLoader.loadDesignTokens();
        
        // 2. 透過 UI 建構引擎產生節點樹
        await this.buildScreen(layout, skin, i18n, tokens);
        this._isBuilt = true;
    }

    this.node.active = true;

    const rootNode = this.node.getChildByName('ToastRoot');
    if (!rootNode) return;

    // 3. 更新動態文字內容
    const lblNode = rootNode.getChildByName('Message');
    if (lblNode) {
        const lbl = lblNode.getComponent(Label);
        if (lbl) {
            lbl.string = message;
            if (options?.color) lbl.color = options.color;
        }
    }

    // 4. 動態顯示與自動隱藏 (取代舊版的 node-level tween)
    const opacity = rootNode.getComponent(UIOpacity) ?? rootNode.addComponent(UIOpacity);
    opacity.opacity = 255; // 每次顯示直接重設為不透明，避免快速點擊產生的閃爍

    if (this.hideTween) {
      this.hideTween.stop();
      this.hideTween = null;
    }

    this.hideTween = tween(opacity)
      .delay(Math.max(0.2, duration))
      .to(0.3, { opacity: 0 })
      .call(() => {
        this.node.active = false;
      })
      .start();
  }
}
