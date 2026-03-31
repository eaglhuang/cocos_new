// @spec-source → 見 docs/cross-reference-index.md
import { sys } from 'cc';
import { EventSystem } from './EventSystem';

export const EVENT_NETWORK_ONLINE = 'EVENT_NETWORK_ONLINE';
export const EVENT_NETWORK_OFFLINE = 'EVENT_NETWORK_OFFLINE';

export class NetworkService {
    private eventSystem: EventSystem | null = null;
    private _isOnline: boolean = true;
    private pollInterval: any = null;

    public get isOnline(): boolean {
        return this._isOnline;
    }

    public setup(eventSystem: EventSystem): void {
        this.eventSystem = eventSystem;
        
        // 初次檢測
        this._isOnline = sys.getNetworkType() !== sys.NetworkType.NONE;

        if (sys.isBrowser) {
            // Web 端利用 DOM 事件，精確即時
            window.addEventListener('online', this.handleOnline.bind(this));
            window.addEventListener('offline', this.handleOffline.bind(this));
        } else {
            // Native 端利用 Cocos API 配合定時 Polling 偵測斷線
            this.pollInterval = setInterval(() => this.checkNativeNetwork(), 3000);
        }
    }

    private checkNativeNetwork(): void {
        const currentlyOnline = sys.getNetworkType() !== sys.NetworkType.NONE;
        if (currentlyOnline !== this._isOnline) {
            if (currentlyOnline) {
                this.handleOnline();
            } else {
                this.handleOffline();
            }
        }
    }

    private handleOnline(): void {
        if (this._isOnline) return;
        this._isOnline = true;
        console.log('[NetworkService] Network restored. Emitting ONLINE event.');
        this.eventSystem?.emit(EVENT_NETWORK_ONLINE);
    }

    private handleOffline(): void {
        if (!this._isOnline) return;
        this._isOnline = false;
        console.log('[NetworkService] Network lost. Emitting OFFLINE event.');
        this.eventSystem?.emit(EVENT_NETWORK_OFFLINE);
    }
}
