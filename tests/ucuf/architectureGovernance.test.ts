/**
 * architectureGovernance.test.ts — UCUF M9 架構治理單元測試
 *
 * 涵蓋：
 *  - ChildPanelBase._shallowDiff  淺比對合約（changedKeys 偵測 / 跳過unchanged / 全量）
 *  - ChildPanelBase.onDiffUpdate  向後相容合約（fallback to onDataUpdate）
 *  - ChildPanelBase._lastData     資料追蹤欄位合約
 *  - scope ID 格式驗證（`screen:{screenId}` 格式）
 *  - specVersion 介面合約（UIScreenSpec / UILayoutSpec 含可選欄位）
 *  - CURRENT_SPEC_VERSION 常數型別合約
 *  - EventSystem emit/on 觸發合約（event bus 代理）
 *
 * 不依賴 Cocos runtime；所有測試可在純 Node.js 環境（ts-node）執行。
 *
 * Unity 對照：unit test for ComponentState diff pipeline + event contract
 */

import { TestSuite, assert } from '../TestRunner';
import * as fs from 'fs';
import * as path from 'path';
import { CURRENT_SPEC_VERSION } from '../../assets/scripts/ui/core/UISpecTypes';
import type { UIScreenSpec, UILayoutSpec } from '../../assets/scripts/ui/core/UISpecTypes';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(...segments: string[]): string {
    return fs.readFileSync(path.join(PROJECT_ROOT, ...segments), 'utf8');
}

// ─── Minimal EventSystem stub（迴避 cc module 依賴）──────────────────────────
// EventSystem.ts imports 'cc' which is unavailable in Node.js CLI.
// This stub replicates the emit/on/off contract exactly.
class StubEventSystem {
    private _listeners = new Map<string, Array<(payload?: unknown) => void>>();
    on<T = unknown>(event: string, handler: (payload?: T) => void): () => void {
        const list = this._listeners.get(event) ?? [];
        list.push(handler as (payload?: unknown) => void);
        this._listeners.set(event, list);
        return () => {
            const l = this._listeners.get(event);
            if (l) this._listeners.set(event, l.filter(h => h !== handler));
        };
    }
    emit<T = unknown>(event: string, payload?: T): void {
        (this._listeners.get(event) ?? []).slice().forEach(h => h(payload as unknown));
    }
}

// ─── Minimal ChildPanelBase stub（不依賴 cc.Node）────────────────────────────

/**
 * 用於測試的最小 ChildPanelBase stub。
 * 複製 _shallowDiff / _lastData / onDiffUpdate 的邏輯以驗證合約，
 * 迴避 Cocos runtime 依賴（UISkinResolver / UITemplateBinder 無法在 Node.js 建立）。
 */
class StubPanel {
    dataSource: string = 'test';
    _lastData: unknown = null;
    onDataUpdateCalled = 0;
    onDiffUpdateCalled = 0;
    lastChangedKeys: string[] = [];

    _shallowDiff(prev: unknown, next: unknown): string[] {
        if (prev === null || typeof prev !== 'object' || Array.isArray(prev)) return [];
        if (next === null || typeof next !== 'object' || Array.isArray(next)) return [];
        const prevObj = prev as Record<string, unknown>;
        const nextObj = next as Record<string, unknown>;
        const changedKeys: string[] = [];
        const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
        for (const key of allKeys) {
            if (prevObj[key] !== nextObj[key]) changedKeys.push(key);
        }
        return changedKeys;
    }

    onDataUpdate(data: unknown): void {
        this.onDataUpdateCalled++;
    }

    onDiffUpdate(data: unknown, changedKeys: string[]): void {
        this.onDiffUpdateCalled++;
        this.lastChangedKeys = changedKeys;
        // default fallback
        this.onDataUpdate(data);
    }

    /** 模擬 CompositePanel.applyContentState 的分派邏輯 */
    applyData(data: unknown): void {
        const changedKeys = this._shallowDiff(this._lastData, data);
        if (this._lastData !== null && changedKeys.length === 0) return; // skip unchanged
        this._lastData = data;
        this.onDiffUpdate(data, changedKeys);
    }
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

export function createArchitectureGovernanceSuite(): TestSuite {
    const suite = new TestSuite('UCUF-M9-ArchitectureGovernance');

    // ── _shallowDiff 合約 ──────────────────────────────────────────────────

    suite.test('shallowDiff: 偵測到 changedKeys 正確', () => {
        const panel = new StubPanel();
        const prev = { hp: 100, atk: 50 };
        const next = { hp: 80, atk: 50 };
        const keys = panel._shallowDiff(prev, next);
        assert.isTrue(keys.length === 1, `應有 1 個 changedKey，got ${keys.length}`);
        assert.isTrue(keys[0] === 'hp', `changedKey 應為 'hp'，got '${keys[0]}'`);
    });

    suite.test('shallowDiff: 無變化時回傳空陣列', () => {
        const panel = new StubPanel();
        const obj = { hp: 100, atk: 50 };
        const keys = panel._shallowDiff(obj, { ...obj });
        assert.isTrue(keys.length === 0, `應無 changedKeys，got ${keys.length}`);
    });

    suite.test('shallowDiff: 新增 key 時偵測為 changed', () => {
        const panel = new StubPanel();
        const prev = { hp: 100 };
        const next = { hp: 100, mp: 200 };
        const keys = panel._shallowDiff(prev, next);
        assert.isTrue(keys.includes('mp'), `新增 key 'mp' 應出現在 changedKeys`);
    });

    suite.test('shallowDiff: prev 為 null 時回傳空陣列（全量更新 fallback）', () => {
        const panel = new StubPanel();
        const keys = panel._shallowDiff(null, { hp: 100 });
        assert.isTrue(keys.length === 0, `prev=null 應回傳 []`);
    });

    suite.test('shallowDiff: prev 為陣列時回傳空陣列', () => {
        const panel = new StubPanel();
        const keys = panel._shallowDiff([1, 2], { hp: 100 });
        assert.isTrue(keys.length === 0, `prev=Array 應回傳 []`);
    });

    // ── diff-update 分派合約 ───────────────────────────────────────────────

    suite.test('applyData: 首次呼叫（_lastData=null）一定執行 onDiffUpdate', () => {
        const panel = new StubPanel();
        panel.applyData({ hp: 100 });
        assert.isTrue(panel.onDiffUpdateCalled === 1, `首次應呼叫 onDiffUpdate once`);
        assert.isTrue(panel.onDataUpdateCalled === 1, `onDiffUpdate fallback 應呼叫 onDataUpdate`);
    });

    suite.test('applyData: 資料未變化時跳過更新', () => {
        const panel = new StubPanel();
        panel.applyData({ hp: 100 });
        panel.applyData({ hp: 100 }); // 同資料再次送入
        assert.isTrue(panel.onDiffUpdateCalled === 1, `相同資料不應重複呼叫 onDiffUpdate`);
    });

    suite.test('applyData: 資料有變化時繼續更新', () => {
        const panel = new StubPanel();
        panel.applyData({ hp: 100 });
        panel.applyData({ hp: 80 }); // hp 改變
        assert.isTrue(panel.onDiffUpdateCalled === 2, `資料改變應呼叫 onDiffUpdate 兩次`);
        assert.isTrue(panel.lastChangedKeys.includes('hp'), `changedKeys 應包含 'hp'`);
    });

    suite.test('applyData: _lastData 隨呼叫更新', () => {
        const panel = new StubPanel();
        const data1 = { hp: 100 };
        panel.applyData(data1);
        assert.isTrue(panel._lastData === data1, `_lastData 應指向最新傳入的資料`);
        const data2 = { hp: 80 };
        panel.applyData(data2);
        assert.isTrue(panel._lastData === data2, `_lastData 應更新為 data2`);
    });

    // ── scope ID 格式合約 ─────────────────────────────────────────────────

    suite.test('scope ID 格式應為 screen:{screenId}', () => {
        const screenId = 'general-detail-v3';
        const scopeId = `screen:${screenId}`;
        assert.isTrue(scopeId === 'screen:general-detail-v3', `scopeId 格式不符，got "${scopeId}"`);
        assert.isTrue(scopeId.startsWith('screen:'), `scopeId 應以 'screen:' 開頭`);
    });

    // ── GeneralDetail canonical runtime 治理合約 ───────────────────────────

    suite.test('GeneralDetail canonical runtime: LobbyScene 只能直接依賴 GeneralDetailComposite', () => {
        const content = readProjectFile('assets', 'scripts', 'ui', 'scenes', 'LobbyScene.ts');
        assert.contains(content, "import { GeneralDetailComposite } from '../components/GeneralDetailComposite';");
        assert.notContains(content, "GeneralDetailPanel';");
        assert.contains(content, "private _detailPanel: GeneralDetailComposite | null = null;");
        assert.contains(content, "getChildByName('GeneralDetailComposite')");
        assert.notContains(content, "getChildByName('GeneralDetailPanel')");
    });

    suite.test('GeneralDetail canonical runtime: LobbyScene.scene 詳情宿主與 click event 都必須是 GeneralDetailComposite', () => {
        const content = readProjectFile('assets', 'scenes', 'LobbyScene.scene');
        assert.contains(content, '"_name": "GeneralDetailComposite"');
        assert.contains(content, '"component": "GeneralDetailComposite"');
        assert.notContains(content, '"_name": "GeneralDetailPanel"');
        assert.notContains(content, '"component": "GeneralDetailPanel"');
    });

    suite.test('GeneralDetail legacy host: GeneralDetailPanel.ts 與 .meta 都必須已從 live workspace 移除', () => {
        const panelPath = path.join(PROJECT_ROOT, 'assets', 'scripts', 'ui', 'components', 'GeneralDetailPanel.ts');
        const panelMetaPath = path.join(PROJECT_ROOT, 'assets', 'scripts', 'ui', 'components', 'GeneralDetailPanel.ts.meta');
        assert.isTrue(!fs.existsSync(panelPath), 'GeneralDetailPanel.ts 應已刪除');
        assert.isTrue(!fs.existsSync(panelMetaPath), 'GeneralDetailPanel.ts.meta 應已刪除');
    });

    // ── Migration Phase Tag ──────────────────────────────────────────────
    // unified-only 收斂完成：OverviewShell 相容層已移除，全走 OverviewSlot + fragment 路徑。
    const MIGRATION_PHASE = 'unified-only' as 'shell-compat' | 'unified-only';

    suite.test('GeneralDetail shell lifecycle: OverviewShell 存在性隨 migration phase 同步', () => {
        const shellPath = path.join(PROJECT_ROOT, 'assets', 'scripts', 'ui', 'components', 'GeneralDetailOverviewShell.ts');
        const shellResourcePath = path.join(PROJECT_ROOT, 'assets', 'scripts', 'ui', 'components', 'general-detail', 'GeneralDetailOverviewShellResources.ts');
        if (MIGRATION_PHASE === 'shell-compat') {
            assert.isTrue(fs.existsSync(shellPath), 'shell-compat 階段 GeneralDetailOverviewShell.ts 必須存在');
        } else {
            assert.isTrue(!fs.existsSync(shellPath), 'unified-only 階段 GeneralDetailOverviewShell.ts 應已刪除');
        }
        // ShellResources 在任何階段都不應存在（已合併進 Shell 本體）
        assert.isTrue(!fs.existsSync(shellResourcePath), 'GeneralDetailOverviewShellResources.ts 應已刪除');
    });

    // ── B 系列：spec 結構合約（JSON property 檢查，非字串比對）──────────

    suite.test('GeneralDetail spec wiring: screen tabRouting.Overview 有合法 slotId', () => {
        const screen = JSON.parse(readProjectFile('assets', 'resources', 'ui-spec', 'screens', 'general-detail-unified-screen.json'));
        assert.isTrue(screen.tabRouting != null, 'screen 應有 tabRouting');
        assert.isTrue(screen.tabRouting.Overview != null, 'tabRouting 應有 Overview entry');
        const overview = screen.tabRouting.Overview;
        assert.isTrue(typeof overview.slotId === 'string' && overview.slotId.length > 0, 'Overview.slotId 應為非空字串');
        assert.isTrue(typeof overview.fragment === 'string' && overview.fragment.length > 0, 'Overview.fragment 應為非空字串');
    });

    suite.test('GeneralDetail spec wiring: layout 中 tabRouting 引用的 slot name 存在於 node tree', () => {
        const screen = JSON.parse(readProjectFile('assets', 'resources', 'ui-spec', 'screens', 'general-detail-unified-screen.json'));
        const layout = JSON.parse(readProjectFile('assets', 'resources', 'ui-spec', 'layouts', 'general-detail-unified-main.json'));
        // 收集 layout tree 中所有 node name（遞迴）
        const nodeNames = new Set<string>();
        function walk(node: any) {
            if (node && node.name) nodeNames.add(node.name);
            if (Array.isArray(node?.children)) node.children.forEach(walk);
        }
        walk(layout.root);
        // 驗證 tabRouting 中每個 slotId 都能在 layout tree 中找到
        for (const [tab, route] of Object.entries(screen.tabRouting as Record<string, any>)) {
            assert.isTrue(nodeNames.has(route.slotId), `tabRouting['${tab}'].slotId '${route.slotId}' 在 layout tree 中找不到`);
        }
    });

    suite.test('GeneralDetail spec wiring: gd-tab-overview fragment 有正確的 root 與子結構', () => {
        const fragmentPath = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec', 'fragments', 'layouts', 'gd-tab-overview.json');
        assert.isTrue(fs.existsSync(fragmentPath), 'gd-tab-overview.json 應存在');
        const raw = fs.readFileSync(fragmentPath, 'utf8');
        const frag = JSON.parse(raw);
        assert.isTrue(frag.name === 'OverviewTabContent', 'fragment root 應為 OverviewTabContent');
        assert.isTrue(Array.isArray(frag.children) && frag.children.length >= 2, 'fragment 應有至少 2 個 children');
        // 檢查 $ref 或直接 name 包含預期的子結構
        const childRefs = frag.children.map((c: any) => c['$ref'] || c.name || '').join(' ');
        assert.isTrue(/header-row|HeaderRow/i.test(childRefs), 'fragment 應引用 header-row 相關 $ref 或 node');
        assert.isTrue(/summary-modules|OverviewSummaryModules/i.test(childRefs), 'fragment 應引用 summary-modules 相關 $ref 或 node');
        assert.isTrue(/BloodlineOverviewModules/.test(raw), 'fragment 應含 BloodlineOverviewModules');
    });

    // ── C 系列：runtime 結構合約（regex 驗 method 存在性，非精確字串）───

    suite.test('GeneralDetail overview regression guard: _switchToTab 有 Overview 專門分支', () => {
        const content = readProjectFile('assets', 'scripts', 'ui', 'components', 'GeneralDetailComposite.ts');
        assert.isTrue(/_switchToTab\s*\(/.test(content), 'GeneralDetailComposite 應有 _switchToTab method');
        // Overview 分支必須有明確的 overview mode 設定 + shell 或 slot 顯示
        assert.isTrue(/Overview/.test(content), '_switchToTab 應處理 Overview tab');
        assert.isTrue(/_setOverviewMode/.test(content), '應有 _setOverviewMode 方法');
        if (MIGRATION_PHASE === 'shell-compat') {
            assert.isTrue(/_showOverviewShell/.test(content), 'shell-compat 階段應有 _showOverviewShell');
            assert.isTrue(/_ensureOverviewShell/.test(content), 'shell-compat 階段應有 _ensureOverviewShell');
        }
    });

    suite.test('GeneralDetail overview regression guard: _setOverviewMode 管理 OverviewSlot active/opacity', () => {
        const content = readProjectFile('assets', 'scripts', 'ui', 'components', 'GeneralDetailComposite.ts');
        // 不比對完整程式碼行 — 只驗概念：method 內操作了 overviewSlot.active 和 UIOpacity
        assert.isTrue(/overviewSlot\.active\s*=/.test(content), '_setOverviewMode 應設定 overviewSlot.active');
        assert.isTrue(/UIOpacity/.test(content), '_setOverviewMode 應操作 UIOpacity');
    });

    suite.test('GeneralDetail overview regression guard: LoadingScene smoke 方法存在且驗證 content host', () => {
        const content = readProjectFile('assets', 'scripts', 'ui', 'scenes', 'LoadingScene.ts');
        assert.isTrue(/_assertGeneralDetailOverviewVisualReady/.test(content), 'LoadingScene 應有 _assertGeneralDetailOverviewVisualReady');
        assert.isTrue(/_assertGeneralDetailOverviewPortraitReady/.test(content), 'LoadingScene 應有 portrait ready 檢查');
        assert.isTrue(/OverviewSlot/.test(content), 'smoke guard 應檢查 OverviewSlot');
        if (MIGRATION_PHASE === 'shell-compat') {
            assert.isTrue(/GeneralDetailOverviewShellHost/.test(content), 'shell-compat 階段 smoke guard 應檢查 ShellHost');
        }
        // 無論哪個 phase，都必須驗 NameLabel + CoreStatsCard + BloodlineSummaryCard
        assert.isTrue(/NameLabel/.test(content), 'smoke guard 應驗證 NameLabel');
        assert.isTrue(/CoreStatsCard/.test(content), 'smoke guard 應驗證 CoreStatsCard');
        assert.isTrue(/BloodlineSummaryCard/.test(content), 'smoke guard 應驗證 BloodlineSummaryCard');
    });

    // ── specVersion 介面合約 ──────────────────────────────────────────────

    suite.test('CURRENT_SPEC_VERSION 應為正整數', () => {
        assert.isTrue(typeof CURRENT_SPEC_VERSION === 'number', `CURRENT_SPEC_VERSION 應為 number`);
        assert.isTrue(CURRENT_SPEC_VERSION >= 1, `CURRENT_SPEC_VERSION 應 >= 1，got ${CURRENT_SPEC_VERSION}`);
        assert.isTrue(Number.isInteger(CURRENT_SPEC_VERSION), `CURRENT_SPEC_VERSION 應為整數`);
    });

    suite.test('UIScreenSpec 可選 specVersion 欄位型別合約', () => {
        // 型別層面驗證（編譯時保證）：建構一個包含 specVersion 的 spec 物件
        const screen: UIScreenSpec = {
            id: 'test-screen',
            version: 1,
            uiId: 'TestUI',
            layer: 'UI_2D',
            bundle: 'resources',
            layout: 'test-layout',
            skin: 'test-skin',
            specVersion: 1, // M9 新增欄位
        };
        assert.isTrue(screen.specVersion === 1, `screen.specVersion 應為 1`);
    });

    suite.test('UILayoutSpec 可選 specVersion 欄位型別合約', () => {
        const layout: UILayoutSpec = {
            id: 'test-layout',
            version: 1,
            specVersion: 1, // M9 新增欄位
            canvas: {
                fitWidth: true,
                fitHeight: true,
                safeArea: true,
                designWidth: 1920,
                designHeight: 1024,
            },
            root: { type: 'container', name: 'Root' },
        };
        assert.isTrue(layout.specVersion === 1, `layout.specVersion 應為 1`);
    });

    suite.test('specVersion 未設定時型別合約允許 undefined', () => {
        const layout: UILayoutSpec = {
            id: 'test-minimal',
            version: 1,
            canvas: {
                fitWidth: true,
                fitHeight: true,
                safeArea: true,
                designWidth: 1920,
                designHeight: 1024,
            },
            root: { type: 'container', name: 'Root' },
        };
        assert.isTrue(layout.specVersion === undefined, `未設定 specVersion 應為 undefined`);
    });

    // ── EventSystem emit/on 合約 ──────────────────────────────────────────

    suite.test('EventSystem emit/on: slot:switched 事件正確觸發', () => {
        const bus = new StubEventSystem();
        let received: unknown = null;
        bus.on('slot:switched', (payload) => { received = payload; });
        bus.emit('slot:switched', { slotId: 'TabContentSlot', fragmentId: 'tab-basics' });
        assert.isTrue(
            received !== null &&
            (received as any).slotId === 'TabContentSlot' &&
            (received as any).fragmentId === 'tab-basics',
            `slot:switched payload 應包含 slotId 與 fragmentId，got ${JSON.stringify(received)}`
        );
    });

    suite.test('EventSystem emit/on: content:updated 事件正確觸發', () => {
        const bus = new StubEventSystem();
        let received: unknown = null;
        bus.on('content:updated', (payload) => { received = payload; });
        bus.emit('content:updated', { sources: ['attributes', 'skills'] });
        assert.isTrue(
            Array.isArray((received as any)?.sources) &&
            (received as any).sources.includes('attributes'),
            `content:updated payload 應含 sources 陣列，got ${JSON.stringify(received)}`
        );
    });

    suite.test('EventSystem on: 取消訂閱後不再觸發', () => {
        const bus = new StubEventSystem();
        let count = 0;
        const unsub = bus.on('slot:switched', () => { count++; });
        bus.emit('slot:switched', {});
        unsub();
        bus.emit('slot:switched', {});
        assert.isTrue(count === 1, `取消訂閱後應只觸發 1 次，got ${count}`);
    });

    return suite;
}
