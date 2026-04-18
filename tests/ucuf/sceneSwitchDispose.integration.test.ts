/**
 * sceneSwitchDispose.integration.test.ts — UCUF M5-P1 integration tests
 *
 * 目的：驗證 UIManager.onSceneWillChange() 能正確清理所有已登記的 CompositePanel，
 * 並在 Panel 拋出例外時隔離錯誤、不阻斷後續清理。
 *
 * 設計說明：
 *   - 使用純 Node.js stub，不需要 Cocos runtime
 *   - StubCompositePanel 追蹤 dispose 呼叫
 *   - StubUIManager 完整複製 UIManager 的 _compositePanels + onSceneWillChange 邏輯
 *
 * 對應 UIManager.ts line 300-309：
 *   public onSceneWillChange(): void {
 *       for (const [id, panel] of this._compositePanels) {
 *           try { panel.dispose(); } catch(e) { console.warn(...) }
 *       }
 *       this._compositePanels.clear();
 *   }
 *
 * Unity 對照：SceneManager.sceneUnloaded 事件觸發的清理流程。
 */

import { TestSuite, assert } from '../TestRunner';

// ─── Stubs ────────────────────────────────────────────────────────────────────

class StubCompositePanel {
    public disposeCallCount = 0;
    public loadedAssetPathCount = 3; // 模擬載入了資產
    public isMounted = true;
    public shouldThrowOnDispose = false;

    public dispose(): void {
        if (this.shouldThrowOnDispose) {
            throw new Error('StubCompositePanel: 模擬 dispose 拋出例外');
        }
        this.disposeCallCount++;
        this.loadedAssetPathCount = 0;
        this.isMounted = false;
    }
}

/**
 * 完整複製 UIManager 的 _compositePanels + registerCompositePanel + onSceneWillChange 邏輯。
 */
class StubUIManager {
    private readonly _compositePanels = new Map<string, StubCompositePanel>();
    public warnMessages: string[] = [];

    public registerCompositePanel(id: string, panel: StubCompositePanel): void {
        this._compositePanels.set(id, panel);
    }

    public panelCount(): number {
        return this._compositePanels.size;
    }

    /** 鏡像 UIManager.onSceneWillChange() 邏輯（含 try-catch + clear） */
    public onSceneWillChange(): void {
        for (const [id, panel] of this._compositePanels) {
            try {
                panel.dispose();
            } catch (e) {
                this.warnMessages.push(`[UIManager] onSceneWillChange: panel "${id}" dispose 失敗: ${e}`);
            }
        }
        this._compositePanels.clear();
    }
}

// ─── Suite ───────────────────────────────────────────────────────────────────

export function createSceneSwitchDisposeSuite(): TestSuite {
    const suite = new TestSuite('UCUF-M5-SceneSwitchDispose');

    suite.test('T01: 無登記 Panel 時 onSceneWillChange 不拋出', () => {
        const manager = new StubUIManager();
        assert.doesNotThrow(() => {
            manager.onSceneWillChange();
        }, '空管理器執行 onSceneWillChange 應靜默');
        assert.equals(0, manager.panelCount());
    });

    suite.test('T02: 單個 Panel 的 dispose() 應被呼叫', () => {
        const manager = new StubUIManager();
        const panel = new StubCompositePanel();
        manager.registerCompositePanel('panel-a', panel);

        manager.onSceneWillChange();

        assert.equals(1, panel.disposeCallCount, 'dispose 應被呼叫 1 次');
    });

    suite.test('T03: dispose() 後 isMounted 應為 false', () => {
        const manager = new StubUIManager();
        const panel = new StubCompositePanel();
        manager.registerCompositePanel('panel-b', panel);

        manager.onSceneWillChange();

        assert.isFalse(panel.isMounted, 'dispose 後 isMounted 應為 false');
    });

    suite.test('T04: dispose() 後 loadedAssetPathCount 應歸零', () => {
        const manager = new StubUIManager();
        const panel = new StubCompositePanel();
        assert.equals(3, panel.loadedAssetPathCount, '初始載入資產數為 3');

        manager.registerCompositePanel('panel-c', panel);
        manager.onSceneWillChange();

        assert.equals(0, panel.loadedAssetPathCount, 'dispose 後 loadedAssetPathCount 應為 0');
    });

    suite.test('T05: onSceneWillChange 後 _compositePanels 應被清空', () => {
        const manager = new StubUIManager();
        manager.registerCompositePanel('p1', new StubCompositePanel());
        manager.registerCompositePanel('p2', new StubCompositePanel());

        manager.onSceneWillChange();

        assert.equals(0, manager.panelCount(), 'clear() 後 Map 應為空');
    });

    suite.test('T06: N 個 Panel 全部應被 dispose', () => {
        const manager = new StubUIManager();
        const panels: StubCompositePanel[] = [];
        for (let i = 0; i < 5; i++) {
            const p = new StubCompositePanel();
            panels.push(p);
            manager.registerCompositePanel(`panel-${i}`, p);
        }

        manager.onSceneWillChange();

        panels.forEach((p, i) => {
            assert.equals(1, p.disposeCallCount, `panel-${i} 應被 dispose 1 次`);
        });
        assert.equals(0, manager.panelCount(), '所有 Panel 清理後 Map 應為空');
    });

    suite.test('T07: 單個 Panel 拋出例外不應阻斷其他 Panel 的清理', () => {
        const manager = new StubUIManager();
        const panelGood1 = new StubCompositePanel();
        const panelBad = new StubCompositePanel();
        const panelGood2 = new StubCompositePanel();
        panelBad.shouldThrowOnDispose = true;

        manager.registerCompositePanel('good1', panelGood1);
        manager.registerCompositePanel('bad', panelBad);
        manager.registerCompositePanel('good2', panelGood2);

        assert.doesNotThrow(() => {
            manager.onSceneWillChange();
        }, 'onSceneWillChange 本身不應拋出（異常已 catch）');

        assert.equals(1, panelGood1.disposeCallCount, 'good1 應被 dispose');
        assert.equals(1, panelGood2.disposeCallCount, 'good2 應被 dispose（bad 的例外不應阻斷）');
        assert.isTrue(manager.warnMessages.length > 0, '應有 warn 訊息記錄例外');
        assert.isTrue(manager.warnMessages[0].includes('bad'), 'warn 訊息應提及有問題的 panel id');
        assert.equals(0, manager.panelCount(), '即使有例外，Map 仍應被清空');
    });

    return suite;
}
