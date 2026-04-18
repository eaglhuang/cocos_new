// @spec-source → 見 docs/cross-reference-index.md (UCUF Wave 2)
/**
 * ToastMessageComposite — 全域吐司提示系統（Composite 版）
 * Wave 2 migration from ToastMessage - temporary floating notifications
 */
import { _decorator, Color, Label, Node, Tween, tween, UIOpacity } from 'cc';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';

const { ccclass, property } = _decorator;

export interface ToastOptions {
    text: string;
    duration?: number;
    yOffset?: number;
}

export interface LegacyToastOptions {
    color?: Color;
    duration?: number;
    key?: string;
    blocking?: boolean;
}

@ccclass('ToastMessageComposite')
export class ToastMessageComposite extends CompositePanel {
    @property
    defaultDuration = 2.0;

    private _binder: UITemplateBinder | null = null;
    private _isMounted = false;
    private _messageLabel: Label | null = null;
    private _hideTween: Tween<UIOpacity> | null = null;

    protected onDestroy(): void {
        if (this._hideTween) {
            this._hideTween.stop();
            this._hideTween = null;
        }
        this.unmount();
        this._isMounted = false;
    }

    public async show(options: ToastOptions): Promise<void>;
    public async show(message: string, duration?: number, options?: LegacyToastOptions): Promise<void>;
    public async show(
        optionsOrMessage: ToastOptions | string,
        duration = this.defaultDuration,
        legacyOptions?: LegacyToastOptions,
    ): Promise<void> {
        if (!this._isMounted) {
            await this.mount('toast-message-screen');
            this._isMounted = true;
        }

        const options: ToastOptions = typeof optionsOrMessage === 'string'
            ? {
                text: optionsOrMessage,
                duration: legacyOptions?.duration ?? duration,
            }
            : optionsOrMessage;

        const resolvedDuration = options.duration ?? this.defaultDuration;
        if (this._messageLabel) {
            this._messageLabel.string = options.text;
            if (typeof optionsOrMessage === 'string' && legacyOptions?.color) {
                this._messageLabel.color = legacyOptions.color;
            }
        }

        this.node.active = true;
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);

        if (this._hideTween) {
            this._hideTween.stop();
            this._hideTween = null;
        }

        opacity.opacity = 0;

        this._hideTween = tween(opacity)
            .to(0.15, { opacity: 255 })
            .delay(Math.max(0.5, resolvedDuration - 0.3))
            .to(0.3, { opacity: 0 })
            .call(() => {
                this._hideTween = null;
                this.node.active = false;
            })
            .start();
    }

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._binder = binder;
        this._messageLabel = binder.getLabel('Message');
    }
}
