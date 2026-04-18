/**
 * assetEvictionClosedLoop.test.ts — UCUF M8-P2 closed-loop unit tests
 *
 * 目的：驗證 ServiceLoader.initialize() 中的 LRU 逐出閉環接線：
 *   MemoryManager.onAssetEvicted → ResourceManager.forceRelease(key)
 *
 * 設計說明：
 *   - 使用純 Node.js stub，不需要 Cocos runtime
 *   - StubMemoryManager 模擬 MemoryManager，提供 simulateEviction(key, bundle)
 *   - StubResourceManager 記錄 forceRelease(path) 呼叫
 *   - wireEvictionClosure() 鏡像 ServiceLoader.initialize() 的接線方式
 *
 * 對應 ServiceLoader.ts line 101-103：
 *   this.memory.onAssetEvicted = (key: string) => {
 *       this.resource.forceRelease(key);
 *   };
 *
 * Unity 對照：Addressables.Release(handle) 在 OnAssetUnloaded 回呼中執行
 */

import { TestSuite, assert } from '../TestRunner';

// ─── Stubs ────────────────────────────────────────────────────────────────────

class StubMemoryManager {
    public onAssetEvicted: ((key: string, bundle: string) => void) | null = null;

    /** 模擬 LRU 触發逐出，調用已註冊的 onAssetEvicted hook */
    public simulateEviction(key: string, bundle: string = 'resources'): void {
        this.onAssetEvicted?.(key, bundle);
    }
}

class StubResourceManager {
    public forcedReleases: string[] = [];

    public forceRelease(path: string): void {
        this.forcedReleases.push(path);
    }
}

/**
 * 鏡像 ServiceLoader.initialize() 中的接線邏輯。
 * 注意：實際 ServiceLoader 的 closure 只使用 key，忽略 bundle 參數。
 */
function wireEvictionClosure(
    memory: StubMemoryManager,
    resource: StubResourceManager,
): void {
    memory.onAssetEvicted = (key: string) => {
        resource.forceRelease(key);
    };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

export function createAssetEvictionClosedLoopSuite(): TestSuite {
    const suite = new TestSuite('UCUF-M8-AssetEvictionClosedLoop');

    suite.test('T01: 接線前 onAssetEvicted 為 null', () => {
        const memory = new StubMemoryManager();
        assert.equals(null, memory.onAssetEvicted, 'wireEvictionClosure 前應為 null');
    });

    suite.test('T02: 接線後 onAssetEvicted 不為 null', () => {
        const memory = new StubMemoryManager();
        const resource = new StubResourceManager();
        wireEvictionClosure(memory, resource);
        assert.isTrue(memory.onAssetEvicted !== null, 'wireEvictionClosure 後應為 function');
    });

    suite.test('T03: 單次 eviction 應呼叫 forceRelease 一次', () => {
        const memory = new StubMemoryManager();
        const resource = new StubResourceManager();
        wireEvictionClosure(memory, resource);

        memory.simulateEviction('sprites/hero.png');

        assert.equals(1, resource.forcedReleases.length, 'forceRelease 應被呼叫 1 次');
        assert.equals('sprites/hero.png', resource.forcedReleases[0], 'key 應正確轉送');
    });

    suite.test('T04: 多次 eviction 應依序轉送所有 key', () => {
        const memory = new StubMemoryManager();
        const resource = new StubResourceManager();
        wireEvictionClosure(memory, resource);

        const keys = ['atlas/ui.plist', 'audio/bgm.mp3', 'scene/battle.json'];
        keys.forEach(k => memory.simulateEviction(k));

        assert.equals(3, resource.forcedReleases.length, 'forceRelease 應被呼叫 3 次');
        assert.equals(keys[0], resource.forcedReleases[0]);
        assert.equals(keys[1], resource.forcedReleases[1]);
        assert.equals(keys[2], resource.forcedReleases[2]);
    });

    suite.test('T05: bundle 參數不影響 forceRelease 收到的 key', () => {
        const memory = new StubMemoryManager();
        const resource = new StubResourceManager();
        wireEvictionClosure(memory, resource);

        memory.simulateEviction('prefabs/panel.prefab', 'ui-bundle');

        assert.equals('prefabs/panel.prefab', resource.forcedReleases[0],
            'forceRelease 只應收到 key，不含 bundle');
    });

    suite.test('T06: 接線前 simulateEviction 不應拋出例外', () => {
        const memory = new StubMemoryManager();
        // onAssetEvicted 為 null，使用 ?. 呼叫應靜默
        assert.doesNotThrow(() => {
            memory.simulateEviction('some/path.png');
        }, '未接線時 simulateEviction 應靜默不拋出');
    });

    suite.test('T07: 將 onAssetEvicted 設為 null 後 simulateEviction 不應拋出', () => {
        const memory = new StubMemoryManager();
        const resource = new StubResourceManager();
        wireEvictionClosure(memory, resource);
        memory.onAssetEvicted = null;

        assert.doesNotThrow(() => {
            memory.simulateEviction('sprites/icon.png');
        }, '取消接線後 simulateEviction 應靜默不拋出');
        assert.equals(0, resource.forcedReleases.length, '取消後 forceRelease 不應被呼叫');
    });

    return suite;
}
