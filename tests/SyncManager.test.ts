import { TestSuite, assert } from './TestRunner';
import { SyncManager, SyncActionType, EVENT_SYNC_COMPLETE } from '../../core/systems/SyncManager';
import { NetworkService } from '../../core/systems/NetworkService';
import { EventSystem } from '../../core/systems/EventSystem';
import { sys } from './cc.mock';

// ★ mock fetch 工廠函式（不在頂層執行，避免 Cocos 打包後在瀏覽器崩潰）
function installMockFetch(): void {
    (globalThis as any).fetch = async (_url: string, _options: any) => ({
        json: async () => ({
            Success: true,
            New_Session_Secret: 'NEW_SECRET_FROM_MOCK_SERVER',
            New_Hash: 'NEW_HASH_ANCHOR',
            Server_Time: Date.now()
        })
    });
}

export function createSyncManagerSuite() {
    const suite = new TestSuite("SyncManager (Offline Sync & Anti-Cheat)");

    const setup = () => {
        installMockFetch(); // ← 在每個 test setup 時才安裝 mock，不在 module 頂層
        sys.localStorage.clear();
        const ev = new EventSystem();
        const net = new NetworkService();
        const sync = new SyncManager();
        
        net.setup(ev);
        sync.setup(ev, net);
        
        return { ev, net, sync };
    };

    suite.test("離線狀態下 Deferrable Action 應被記錄進佇列且持久化", async () => {
        const { net, sync } = setup();
        
        // 模擬斷線
        (sys as any).getNetworkType = () => sys.NetworkType.NONE;
        (net as any).checkNativeNetwork ? (net as any).checkNativeNetwork() : null; // 強制更新狀態
        
        assert.isFalse(net.isOnline, "應處於離線狀態");

        const success = sync.pushAction("BATTLE_WIN", { gold: 50 }, SyncActionType.DEFERRABLE);
        assert.isTrue(success, "離線推入可延遲動作應成功");

        // 檢查本地儲存
        const stored = sys.localStorage.getItem('OFFLINE_ACTION_LOGS');
        assert.isDefined(stored, "localStorage 應含有離線日誌");
        const logs = JSON.parse(stored!);
        assert.lengthEquals(1, logs);
        assert.equals("BATTLE_WIN", logs[0].Action);
        assert.isDefined(logs[0].Tx_Hash, "應產生 HMAC 雜湊");
    });

    suite.test("離線狀態下 Immediate Action 應被攔截且不記錄", async () => {
        const { net, sync, ev } = setup();
        
        let toastShown = false;
        ev.on('SHOW_TOAST', () => toastShown = true);

        // 模擬斷線
        (sys as any).getNetworkType = () => sys.NetworkType.NONE;

        const success = sync.pushAction("PAYMENT_BUY", { itemId: 'gold_pack' }, SyncActionType.IMMEDIATE_REQUIRED);
        
        assert.isFalse(success, "斷線時即時動作應失敗");
        assert.isTrue(toastShown, "應顯示 Toast 警告");
        
        const stored = sys.localStorage.getItem('OFFLINE_ACTION_LOGS');
        assert.isTrue(stored === null || JSON.parse(stored).length === 0, "不應存入離線日誌");
    });

    suite.test("恢復連線時應自動上傳並更新金鑰", async () => {
        const { net, sync, ev } = setup();
        
        let syncFinished = false;
        ev.on(EVENT_SYNC_COMPLETE, () => syncFinished = true);

        // 1. 離線產生一條紀錄
        (sys as any).getNetworkType = () => sys.NetworkType.NONE;
        sync.pushAction("TEST_MOVE", { x: 10 });

        // 2. 恢復連線
        (sys as any).getNetworkType = () => sys.NetworkType.LAN;
        (net as any).checkNativeNetwork ? (net as any).checkNativeNetwork() : null;

        // 等待同步 (SyncManager.syncNow 內部有 1.5s 延遲，我們需要等它)
        // 為了測試快速，我們在 implementation 已經把 setTimeout 改為 await fetch 了
        // 由於我們 mock 了 fetch，應該是立即完成
        await new Promise(resolve => setTimeout(resolve, 50)); // 緩衝一下 async 流程

        assert.isTrue(syncFinished, "應完成同步流程");
        assert.equals(0, (sync as any).actionRecords.length, "同步後佇列應清空");
        const stored = sys.localStorage.getItem('OFFLINE_ACTION_LOGS');
        assert.isTrue(!stored, "同步後應移除本地快取");
    });

    suite.test("裝置 ID 不符時應阻斷任何離線寫入", async () => {
        const { sync } = setup();
        
        // 模擬換了裝置 (修改本機儲存的 ID，但 SyncManager 實例裡存的是舊的)
        sys.localStorage.setItem('CLIENT_DEVICE_ID', 'ANOTHER_DEVICE_FAKE_ID');
        
        const success = sync.pushAction("HACK_ATTEMPT", {});
        assert.isFalse(success, "裝置 ID 不符應阻斷 Action");
    });

    return suite;
}
