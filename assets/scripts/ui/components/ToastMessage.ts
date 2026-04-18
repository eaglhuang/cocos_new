// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Color, Label, Node, Tween, tween, UITransform, UIOpacity, Widget } from "cc";
import { services } from "../../core/managers/ServiceLoader";
import { UIPreviewBuilder } from "../core/UIPreviewBuilder";
import { UISpecLoader } from "../core/UISpecLoader";
import { SolidBackground } from './SolidBackground';

const { ccclass } = _decorator;

export interface ToastOptions {
  color?: Color;
  duration?: number;
  /** 可選識別鍵；搭配 HIDE_TOAST(key) 可只收起指定 toast */
  key?: string;
  /** true 時顯示全螢幕半透明擋板 + 置中文字，需配合 HIDE_TOAST 事件收起 */
  blocking?: boolean;
}

@ccclass("ToastMessage")
export class ToastMessage extends UIPreviewBuilder {
  
  private get _specLoader() { return services().specLoader; }
  private hideTween: Tween<UIOpacity> | null = null;
  private _isBuilt = false;
  private _blockingOverlay: Node | null = null;
  private _activeToastKey: string | null = null;

  /** 建立（或複用）全螢幕排序擋板 */
  private _ensureBlockingOverlay(): Node {
    if (this._blockingOverlay) return this._blockingOverlay;

    const overlay = new Node('BlockingOverlay');
    overlay.layer = this.node.layer;
    // 全螢幕半透明深色底
    overlay.addComponent(UITransform).setContentSize(1920, 1080);
    overlay.addComponent(SolidBackground).color = new Color(18, 14, 10, 210);
    const w = overlay.addComponent(Widget);
    w.isAlignTop = true;    w.top    = 0;
    w.isAlignBottom = true; w.bottom = 0;
    w.isAlignLeft = true;   w.left   = 0;
    w.isAlignRight = true;  w.right  = 0;

    // 置中提示文字
    const lblNode = new Node('BlockingLabel');
    lblNode.layer = this.node.layer;
    lblNode.addComponent(UITransform).setContentSize(400, 60);
    const lbl = lblNode.addComponent(Label);
    lbl.string = '【 排序中 】';
    lbl.fontSize = 28;
    lbl.color = new Color(255, 220, 80, 255);
    lbl.lineHeight = 40;
    lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
    lbl.verticalAlign   = Label.VerticalAlign.CENTER;
    const lw = lblNode.addComponent(Widget);
    lw.isAlignHorizontalCenter = true; lw.horizontalCenter = 0;
    lw.isAlignVerticalCenter   = true; lw.verticalCenter   = 0;
    lblNode.parent = overlay;

    overlay.active = false;
    this._blockingOverlay = overlay;
    overlay.parent = this.node;  // 掛在 this.node（全螢幕 ToastContainer）下
    return overlay;
  }

  /** 立即收起 toast（含擋板）；由 HIDE_TOAST 事件觸發 */
  public hide(key?: string): void {
    if (key && this._activeToastKey && key !== this._activeToastKey) return;
    if (this._blockingOverlay) this._blockingOverlay.active = false;
    if (this.hideTween) { this.hideTween.stop(); this.hideTween = null; }
    this._activeToastKey = null;
    this.node.active = false;
  }

  start(): void {
    this.node.active = false;
    // 監聽全域事件以便讓 SyncManager 等非 UI 腳本可以發送提示
    services().event.onBind('SHOW_TOAST', (payload: { message: string, duration?: number, blocking?: boolean, key?: string }) => {
      void this.show(payload.message, payload.duration, { blocking: payload.blocking, key: payload.key });
    }, this);
    services().event.onBind('HIDE_TOAST', (payload?: { key?: string }) => this.hide(payload?.key), this);
  }

  public async show(message: string, duration = 1.2, options?: ToastOptions): Promise<void> {
    this._activeToastKey = options?.key ?? null;

    // blocking 模式：顯示全螢幕擋板 + 置中文字，跳過一般 toast 流程
    if (options?.blocking) {
      this.node.active = true;
      this._ensureBlockingOverlay().active = true;
      return;
    }

    if (!this._isBuilt) {
        // 1. 動態載入三層結構契約與 Design Tokens v2.2
        const layout = await this._specLoader.loadLayout('toast-message-main');
        const skin = await this._specLoader.loadSkin('toast-message-default');
        const i18n = await this._specLoader.loadI18n(services().i18n.currentLocale);
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
        this._activeToastKey = null;
        this.node.active = false;
      })
      .start();
  }
}
