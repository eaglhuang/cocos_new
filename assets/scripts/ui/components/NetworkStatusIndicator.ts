// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, Node, Sprite, Color, tween, UIOpacity, Tween, Vec3 } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { EVENT_NETWORK_OFFLINE, EVENT_NETWORK_ONLINE } from '../../core/systems/NetworkService';
import { EVENT_SYNCING, EVENT_SYNC_COMPLETE, EVENT_OFFLINE_REMINDER } from '../../core/systems/SyncManager';

const { ccclass, requireComponent } = _decorator;

/**
 * 網路狀態指示器 (視覺化元件)
 * 掛載於包含 UI_2D 的節點，自帶 Sprite 用於顯示斷線或同步狀態。
 * 支援漸入漸隱效果與轉圈圈動畫，不打斷玩家在單機模式下的沉浸感。
 */
@ccclass('NetworkStatusIndicator')
@requireComponent(Sprite)
@requireComponent(UIOpacity)
export class NetworkStatusIndicator extends Component {
    private sprite: Sprite | null = null;
    private uiOpacity: UIOpacity | null = null;
    private spinTween: Tween<Node> | null = null;

    protected onLoad(): void {
        this.sprite = this.getComponent(Sprite);
        this.uiOpacity = this.getComponent(UIOpacity);
        
        // 預設為全透明隱藏狀態，平時不干擾畫面
        if (this.uiOpacity) this.uiOpacity.opacity = 0;
    }

    protected start(): void {
        const ev = services().event;
        // 使用 EventSystem 的 onBind 來將監聽器的生命週期綁死在這個 Component 上
        ev.onBind(EVENT_NETWORK_OFFLINE, this.onOffline, this);
        ev.onBind(EVENT_NETWORK_ONLINE, this.onOnline, this);
        ev.onBind(EVENT_SYNCING, this.onSyncing, this);
        ev.onBind(EVENT_SYNC_COMPLETE, this.onSyncComplete, this);
        ev.onBind(EVENT_OFFLINE_REMINDER, this.onOfflineReminder, this);

        // 若 UI 啟動瞬間剛好是沒網路的狀態，補償觸發一次 UI
        if (!services().network.isOnline) {
            this.onOffline();
        }
    }

    private onOffline(): void {
        this.stopSpin();
        if (this.sprite) {
            this.sprite.color = new Color(255, 50, 50, 255); // 斷線顯示警示紅
        }
        this.showIcon();
    }

    private onOnline(): void {
        if (this.sprite) {
             this.sprite.color = new Color(50, 255, 50, 255); // 連線恢復顯示通行綠
        }
        // 若有待傳資料，SyncManager 會馬上派發 SYNCING 事件蓋過去，避免 UI 閃閃爍爍
        // 若無待傳資料，1秒後自動淡出隱藏
        this.scheduleOnce(() => this.hideIcon(), 1.0);
    }

    private onSyncing(): void {
        if (this.sprite) {
            this.sprite.color = new Color(255, 200, 50, 255); // 同步中轉為上傳黃
        }
        this.showIcon();
        this.startSpin();
    }

    private onSyncComplete(): void {
        this.stopSpin();
        if (this.sprite) {
            this.sprite.color = new Color(50, 255, 50, 255); // 完成後亮綠燈
        }
        this.scheduleOnce(() => this.hideIcon(), 1.0);
    }

    private onOfflineReminder(payload: { message: string }): void {
        // 當收到週期性提醒時，閃爍一下圖示並發送 Toast
        this.showIcon();
        tween(this.node)
            .to(0.1, { scale: new Vec3(1.2, 1.2, 1.2) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .to(0.1, { scale: new Vec3(1.2, 1.2, 1.2) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start();
        
        services().event.emit('SHOW_TOAST', { message: payload.message, duration: 3.0 });
    }

    /* 以下為動畫效果副程式 */

    private showIcon(): void {
        if (this.uiOpacity && this.uiOpacity.opacity === 0) {
            tween(this.uiOpacity).to(0.3, { opacity: 255 }).start();
        }
    }

    private hideIcon(): void {
        if (this.uiOpacity && this.uiOpacity.opacity === 255) {
            tween(this.uiOpacity).to(0.5, { opacity: 0 }).start();
        }
    }

    private startSpin(): void {
        this.stopSpin();
        this.spinTween = tween(this.node)
            .by(1.0, { angle: -360 })
            .repeatForever()
            .start();
    }

    private stopSpin(): void {
        if (this.spinTween) {
            this.spinTween.stop();
            this.spinTween = null;
            this.node.angle = 0; // 重置旋轉角度
        }
    }
}
