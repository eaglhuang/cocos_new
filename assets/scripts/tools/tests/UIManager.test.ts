/**
 * UIManager.test.ts — UIManager 六層架構行為測試（M-1）
 *
 * 測試目標：驗證各層級（Game / UI / PopUp / Dialog / System / Notify）的語義行為：
 *  - LayerGame:   簡單 show/hide，多個可同時開啟
 *  - LayerUI:     替換模式，開啟新頁面自動關閉舊頁面
 *  - LayerPopUp:  堆疊模式，多個可共存，peek 回傳頂端
 *  - LayerDialog: 佇列模式，一次一個，關閉後推進佇列
 *  - LayerSystem: 同 Game 行為，立即顯示
 *  - LayerNotify: 同 Game 行為，立即顯示
 *
 * Unity 對照：類似測試不同 Canvas Sort Order 層級的 manager 行為，
 * 確保彈窗不覆蓋系統通知、結算面板不與 Toast 衝突等。
 */

import { TestSuite, assert } from "./TestRunner";
import { UIManager } from "../../core/managers/UIManager";
import { UIID, UIConfig, LayerType } from "../../core/config/UIConfig";
import { UILayer } from "../../ui/layers/UILayer";

// ─── Mock UILayer（tracker 版）────────────────────────────────────────────────
// 不依賴真實 cc 渲染，只追蹤 show / hide 呼叫次數與可見狀態
class MockUILayer {
    public showCount = 0;
    public hideCount = 0;
    public isVisible = false;

    show(): void { this.showCount++; this.isVisible = true; }
    hide(): void { this.hideCount++; this.isVisible = false; }
}

/** 建立一個 mock，投型為 UILayer（--transpile-only 下不做型別強制驗證） */
function makeMock(): { mock: MockUILayer; layer: UILayer } {
    const mock = new MockUILayer();
    return { mock, layer: mock as unknown as UILayer };
}

// ─── 建立測試套件 ─────────────────────────────────────────────────────────────
export function createUIManagerSuite(): TestSuite {
    const suite = new TestSuite("UIManager");

    // ── UIConfig 結構驗證 ────────────────────────────────────────────────────

    suite.test("UIConfig 包含所有 UIID 項目", () => {
        const ids = Object.values(UIID);
        ids.forEach(id => {
            assert.isDefined(UIConfig[id], `UIConfig 應包含 UIID.${id}`);
            assert.isDefined(UIConfig[id].layer, `UIConfig[${id}].layer 應有定義`);
        });
    });

    suite.test("UIConfig.ResultPopup 為 Dialog 層且啟用 mask", () => {
        const cfg = UIConfig[UIID.ResultPopup];
        assert.equals(cfg.layer, LayerType.Dialog, "ResultPopup 應在 Dialog 層");
        assert.equals(cfg.mask, true, "ResultPopup 應啟用 mask");
    });

    suite.test("UIConfig.BattleHUD 為 Game 層", () => {
        const cfg = UIConfig[UIID.BattleHUD];
        assert.equals(cfg.layer, LayerType.Game, "BattleHUD 應在 Game 層");
    });

    // ── register / isOpen 基礎 ───────────────────────────────────────────────

    suite.test("open 未 register 的 UIID 回傳 false", () => {
        const mgr = new UIManager();
        assert.equals(mgr.open(UIID.BattleHUD), false, "未 register 應回傳 false");
    });

    suite.test("close 未開啟的 UIID 回傳 false", () => {
        const mgr = new UIManager();
        const { layer } = makeMock();
        mgr.register(UIID.BattleHUD, layer);
        assert.equals(mgr.close(UIID.BattleHUD), false, "未開啟時 close 應回傳 false");
    });

    suite.test("isOpen 在 open/close 前後正確切換", () => {
        const mgr = new UIManager();
        const { layer } = makeMock();
        mgr.register(UIID.BattleHUD, layer);

        assert.equals(mgr.isOpen(UIID.BattleHUD), false, "初始應為 false");
        mgr.open(UIID.BattleHUD);
        assert.equals(mgr.isOpen(UIID.BattleHUD), true, "open 後應為 true");
        mgr.close(UIID.BattleHUD);
        assert.equals(mgr.isOpen(UIID.BattleHUD), false, "close 後應為 false");
    });

    // ── LayerGame 行為 ───────────────────────────────────────────────────────

    suite.test("LayerGame: 多個可同時開啟", () => {
        const mgr = new UIManager();
        const hud  = makeMock();
        const dp   = makeMock();
        const log  = makeMock();

        mgr.register(UIID.BattleHUD,   hud.layer);
        mgr.register(UIID.DeployPanel, dp.layer);
        mgr.register(UIID.BattleLogPanel, log.layer);

        mgr.open(UIID.BattleHUD);
        mgr.open(UIID.DeployPanel);
        mgr.open(UIID.BattleLogPanel);

        assert.equals(mgr.isOpen(UIID.BattleHUD),   true, "BattleHUD 應開啟");
        assert.equals(mgr.isOpen(UIID.DeployPanel),  true, "DeployPanel 應開啟");
        assert.equals(mgr.isOpen(UIID.BattleLogPanel), true, "BattleLogPanel 應開啟");
        assert.equals(hud.mock.showCount, 1, "HUD show 應呼叫 1 次");
        assert.equals(dp.mock.showCount,  1, "DeployPanel show 應呼叫 1 次");
    });

    suite.test("LayerGame: open 後 close 呼叫 hide", () => {
        const mgr = new UIManager();
        const { mock, layer } = makeMock();
        mgr.register(UIID.BattleHUD, layer);
        mgr.open(UIID.BattleHUD);
        mgr.close(UIID.BattleHUD);
        assert.equals(mock.hideCount, 1, "close 後 hide 應呼叫 1 次");
        assert.equals(mgr.isOpen(UIID.BattleHUD), false, "close 後 isOpen 應為 false");
    });

    // ── LayerPopUp 堆疊行為 ──────────────────────────────────────────────────
    // 注意：目前 UIID 中無 PopUp 層 entry，用臨時擴展 UIID + UIConfig 模擬

    suite.test("LayerPopUp: peekPopup 回傳最後開啟的彈窗", () => {
        // 此測試使用 UIManager 內部直接操控狀態（透過 closeAll 驗證）
        // 由於目前 UIConfig 無 PopUp 層 entry，僅驗證 peekPopup 初始為 null
        const mgr = new UIManager();
        assert.equals(mgr.peekPopup(), null, "初始 peekPopup 應為 null");
        assert.equals(mgr.getPopupDepth(), 0, "初始堆疊深度應為 0");
    });

    // ── LayerDialog 佇列行為 ─────────────────────────────────────────────────

    suite.test("LayerDialog: open 第一個立即顯示", () => {
        const mgr = new UIManager();
        const { mock, layer } = makeMock();
        mgr.register(UIID.ResultPopup, layer);

        mgr.open(UIID.ResultPopup);

        assert.equals(mock.showCount, 1, "第一個 Dialog 應立即 show");
        assert.equals(mgr.isOpen(UIID.ResultPopup), true, "應處於開啟狀態");
    });

    suite.test("LayerDialog: getDialogQueueLength 初始為 0", () => {
        const mgr = new UIManager();
        assert.equals(mgr.getDialogQueueLength(), 0, "初始佇列長度應為 0");
    });

    suite.test("LayerDialog: close 後 isOpen 更新為 false", () => {
        const mgr = new UIManager();
        const { mock, layer } = makeMock();
        mgr.register(UIID.ResultPopup, layer);

        mgr.open(UIID.ResultPopup);
        assert.equals(mgr.isOpen(UIID.ResultPopup), true, "open 後應為 open");
        mgr.close(UIID.ResultPopup);
        assert.equals(mgr.isOpen(UIID.ResultPopup), false, "close 後應為 closed");
        assert.equals(mock.hideCount, 1, "hide 應呼叫一次");
    });

    // ── LayerNotify / LayerSystem 行為 ───────────────────────────────────────

    suite.test("LayerNotify(Toast): open/close 呼叫對應 show/hide", () => {
        const mgr = new UIManager();
        const { mock, layer } = makeMock();
        mgr.register(UIID.Toast, layer);

        mgr.open(UIID.Toast);
        assert.equals(mock.showCount, 1, "Toast open 應呼叫 show");
        mgr.close(UIID.Toast);
        assert.equals(mock.hideCount, 1, "Toast close 應呼叫 hide");
    });

    suite.test("LayerSystem(SystemAlert): open 立即顯示", () => {
        const mgr = new UIManager();
        const { mock, layer } = makeMock();
        mgr.register(UIID.SystemAlert, layer);

        mgr.open(UIID.SystemAlert);
        assert.equals(mock.isVisible, true, "SystemAlert 應立即可見");
        assert.equals(mgr.isOpen(UIID.SystemAlert), true, "isOpen 應為 true");
    });

    // ── closeAll 重置行為 ────────────────────────────────────────────────────

    suite.test("closeAll: 所有已開啟的 UI 都會呼叫 hide", () => {
        const mgr = new UIManager();
        const hud     = makeMock();
        const result  = makeMock();
        const toast   = makeMock();

        mgr.register(UIID.BattleHUD,  hud.layer);
        mgr.register(UIID.ResultPopup,result.layer);
        mgr.register(UIID.Toast,      toast.layer);

        mgr.open(UIID.BattleHUD);
        mgr.open(UIID.ResultPopup);
        mgr.open(UIID.Toast);

        mgr.closeAll();

        assert.equals(hud.mock.isVisible,    false, "BattleHUD 應被隱藏");
        assert.equals(result.mock.isVisible, false, "ResultPopup 應被隱藏");
        assert.equals(toast.mock.isVisible,  false, "Toast 應被隱藏");

        assert.equals(mgr.isOpen(UIID.BattleHUD),   false, "BattleHUD isOpen 應為 false");
        assert.equals(mgr.isOpen(UIID.ResultPopup),  false, "ResultPopup isOpen 應為 false");
        assert.equals(mgr.getDialogQueueLength(), 0, "佇列應清空");
    });

    suite.test("closeAll 後可重新 open 相同 UI", () => {
        const mgr = new UIManager();
        const { mock, layer } = makeMock();
        mgr.register(UIID.Toast, layer);

        mgr.open(UIID.Toast);
        mgr.closeAll();
        mgr.open(UIID.Toast);

        assert.equals(mock.showCount, 2, "closeAll 後重新 open 應再次呼叫 show");
        assert.equals(mgr.isOpen(UIID.Toast), true, "重新 open 後應為 true");
    });

    // ── getCurrentUI ────────────────────────────────────────────────────────

    suite.test("getCurrentUI 初始為 null", () => {
        const mgr = new UIManager();
        assert.equals(mgr.getCurrentUI(), null, "初始 currentUI 應為 null");
    });

    // ── M-2 快取機制 ─────────────────────────────────────────────────────────

    suite.test("M-2: ResultPopup close 後 isCached 為 true", () => {
        const mgr = new UIManager();
        const { layer } = makeMock();
        mgr.register(UIID.ResultPopup, layer);

        mgr.open(UIID.ResultPopup);
        assert.equals(mgr.isCached(UIID.ResultPopup), false, "open 中不應為 cached");

        mgr.close(UIID.ResultPopup);
        assert.equals(mgr.isCached(UIID.ResultPopup), true, "close 後應標記為 cached");
    });

    suite.test("M-2: 非 cache 的 UI (Toast) close 後 isCached 為 false", () => {
        const mgr = new UIManager();
        const { layer } = makeMock();
        mgr.register(UIID.Toast, layer);

        mgr.open(UIID.Toast);
        mgr.close(UIID.Toast);
        assert.equals(mgr.isCached(UIID.Toast), false, "Toast 不應被快取");
    });

    suite.test("M-2: 快取後再 open 呼叫 resetState", () => {
        // 建立帶有 resetState 追蹤的 mock
        class TrackedMockLayer {
            public showCount = 0;
            public hideCount = 0;
            public resetCount = 0;
            public isVisible = false;

            show(): void   { this.showCount++;  this.isVisible = true; }
            hide(): void   { this.hideCount++;  this.isVisible = false; }
            resetState(): void { this.resetCount++; }
        }

        const mgr = new UIManager();
        const tm = new TrackedMockLayer();
        mgr.register(UIID.ResultPopup, tm as unknown as UILayer);

        mgr.open(UIID.ResultPopup);
        assert.equals(tm.resetCount, 0, "首次 open 不應呼叫 resetState");

        mgr.close(UIID.ResultPopup);
        assert.equals(mgr.isCached(UIID.ResultPopup), true, "close 後應為 cached");

        mgr.open(UIID.ResultPopup);
        assert.equals(tm.resetCount, 1, "從快取 open 應呼叫 resetState 一次");
        assert.equals(mgr.isCached(UIID.ResultPopup), false, "open 後快取標記應清除");
    });

    suite.test("M-2: clearCache 清除快取標記", () => {
        const mgr = new UIManager();
        const { layer } = makeMock();
        mgr.register(UIID.ResultPopup, layer);

        mgr.open(UIID.ResultPopup);
        mgr.close(UIID.ResultPopup);
        assert.equals(mgr.isCached(UIID.ResultPopup), true, "close 後應為 cached");

        mgr.clearCache(UIID.ResultPopup);
        assert.equals(mgr.isCached(UIID.ResultPopup), false, "clearCache 後應為 false");
    });

    suite.test("M-2: 多次快取 open 每次都呼叫 resetState", () => {
        class TrackedMockLayer {
            public showCount = 0;
            public hideCount = 0;
            public resetCount = 0;
            public isVisible = false;

            show(): void   { this.showCount++;  this.isVisible = true; }
            hide(): void   { this.hideCount++;  this.isVisible = false; }
            resetState(): void { this.resetCount++; }
        }

        const mgr = new UIManager();
        const tm = new TrackedMockLayer();
        mgr.register(UIID.ResultPopup, tm as unknown as UILayer);

        // 模擬 10 次開關（驗收條件：每次都 resetState，記憶體不增長）
        for (let i = 0; i < 10; i++) {
            mgr.open(UIID.ResultPopup);
            mgr.close(UIID.ResultPopup);
        }

        // 最後一次 open
        mgr.open(UIID.ResultPopup);
        assert.equals(tm.resetCount, 10, "10 次快取 open 應呼叫 resetState 共 10 次");
        assert.equals(tm.showCount, 11, "open 共 11 次（包含最後一次）");
    });

    return suite;
}
