import { TestSuite, assert } from './TestRunner';
import { NetworkService, EVENT_NETWORK_OFFLINE, EVENT_NETWORK_ONLINE } from '../../core/systems/NetworkService';
import { EventSystem } from '../../core/systems/EventSystem';
import { sys } from './cc.mock';

export function createNetworkServiceSuite() {
    const suite = new TestSuite("NetworkService (Cross-platform Detection)");

    const setup = () => {
        const ev = new EventSystem();
        const net = new NetworkService();
        net.setup(ev);
        return { ev, net };
    };

    suite.test("當 sys 報告無網路時應發送 OFFLINE 事件", () => {
        const { net, ev } = setup();
        let eventFired = false;
        ev.on(EVENT_NETWORK_OFFLINE, () => eventFired = true);

        // 模擬斷線 (Cocos sys API 回傳 NONE)
        (sys as any).getNetworkType = () => sys.NetworkType.NONE;
        
        // 觸發輪詢檢查
        (net as any).checkNativeNetwork();

        assert.isTrue(eventFired, "應觸發 EVENT_NETWORK_OFFLINE");
        assert.isFalse(net.isOnline, "isOnline 屬性應同步變更");
    });

    suite.test("當網路恢復時應發送 ONLINE 事件", () => {
        const { net, ev } = setup();
        
        // 先設為斷線
        (sys as any).getNetworkType = () => sys.NetworkType.NONE;
        (net as any).checkNativeNetwork();

        let eventFired = false;
        ev.on(EVENT_NETWORK_ONLINE, () => eventFired = true);

        // 模擬恢復
        (sys as any).getNetworkType = () => sys.NetworkType.LAN;
        (net as any).checkNativeNetwork();

        assert.isTrue(eventFired, "應觸發 EVENT_NETWORK_ONLINE");
        assert.isTrue(net.isOnline, "isOnline 應恢復為 true");
    });

    return suite;
}
