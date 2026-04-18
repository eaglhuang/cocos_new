/**
 * attributePanel.test.ts — UCUF AttributePanel 邏輯測試
 *
 * 測試目標（純邏輯，不依賴 Cocos runtime）：
 *  - AttributeEntry 型別結構
 *  - validateDataFormat 各種輸入情境
 *  - onDataUpdate 渲染邏輯（透過 mock Node）
 *  - ChildPanelBase 基類合約（dataSource / setCustomProp / onCustomPropChanged）
 *
 * Unity 對照：UITableRow.Validate() 的獨立單元測試
 */

import { TestSuite, assert } from '../TestRunner';
import type { AttributeEntry } from '../../assets/scripts/ui/core/panels/AttributePanel';

// ─── Mock 基礎設施 ────────────────────────────────────────────────────────────

/** 模擬 cc.Label 元件 */
class MockLabel {
    string = '';
}

/** 模擬 cc.Node（提供 children 與 active 屬性以及 getComponent） */
class MockNode {
    active  = true;
    children: MockNode[] = [];
    private _components: Record<string, any> = {};

    addComponent(cls: any): any {
        const key = typeof cls === 'string' ? cls : cls.name;
        const instance = typeof cls === 'function' ? new cls() : new MockLabel();
        this._components[key] = instance;
        return instance;
    }

    getComponent(cls: any): any {
        const key = typeof cls === 'string' ? cls : (cls as any).name;
        return this._components[key] ?? null;
    }
}

/** 建立一個含有 N 行的 mock hostNode（每行有 label + value 兩個 Label 子節點） */
function makeHostNode(rowCount: number): MockNode {
    const host = new MockNode();
    for (let i = 0; i < rowCount; i++) {
        const row = new MockNode();
        const labelNode  = new MockNode();
        const valueNode  = new MockNode();
        // 使用字串 key 模擬 AttributePanel._setLabelText 內部的 getComponent('Label') 呼叫
        (labelNode as any)._components['cc.Label'] = new MockLabel();
        (valueNode as any)._components['cc.Label'] = new MockLabel();
        row.children.push(labelNode, valueNode);
        host.children.push(row);
    }
    return host;
}

/** 最簡 mock UISkinResolver / UITemplateBinder（AttributePanel 建構子需要） */
const mockSkinResolver  = {} as any;
const mockBinder        = {} as any;

// ─── 建立測試套件 ─────────────────────────────────────────────────────────────
export function createAttributePanelSuite(): TestSuite {
    const suite = new TestSuite('UCUF-AttributePanel', 2);

    // ── validateDataFormat ──────────────────────────────────────────────────

    suite.test('validateDataFormat：空陣列視為合法', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');
        const panel = new AttributePanel(makeHostNode(0) as any, mockSkinResolver, mockBinder);
        assert.equals(null, panel.validateDataFormat([]));
    });

    suite.test('validateDataFormat：正確結構陣列回傳 null', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');
        const panel = new AttributePanel(makeHostNode(0) as any, mockSkinResolver, mockBinder);
        const good: AttributeEntry[] = [
            { label: '攻擊力', value: '350' },
            { label: '防禦力', value: '200' },
        ];
        assert.equals(null, panel.validateDataFormat(good));
    });

    suite.test('validateDataFormat：非陣列輸入回傳錯誤訊息', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');
        const panel = new AttributePanel(makeHostNode(0) as any, mockSkinResolver, mockBinder);
        const result = panel.validateDataFormat({ label: 'x', value: 'y' });
        assert.notEquals(null, result);
    });

    suite.test('validateDataFormat：缺少 label 欄位回傳錯誤訊息', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');
        const panel = new AttributePanel(makeHostNode(0) as any, mockSkinResolver, mockBinder);
        const bad = [{ value: '350' }];
        const result = panel.validateDataFormat(bad);
        assert.notEquals(null, result);
    });

    suite.test('validateDataFormat：缺少 value 欄位回傳錯誤訊息', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');
        const panel = new AttributePanel(makeHostNode(0) as any, mockSkinResolver, mockBinder);
        const bad = [{ label: '攻擊力' }];
        const result = panel.validateDataFormat(bad);
        assert.notEquals(null, result);
    });

    suite.test('validateDataFormat：label 為數字型回傳錯誤訊息', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');
        const panel = new AttributePanel(makeHostNode(0) as any, mockSkinResolver, mockBinder);
        const bad = [{ label: 123, value: '350' }];
        const result = panel.validateDataFormat(bad);
        assert.notEquals(null, result);
    });

    // ── onDataUpdate 渲染行為 ───────────────────────────────────────────────

    suite.test('onDataUpdate：資料行 = 容器行，所有行 active=true 且文字正確', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');
        const host  = makeHostNode(2) as any;
        const panel = new AttributePanel(host, mockSkinResolver, mockBinder);
        const data: AttributeEntry[] = [
            { label: '攻擊力', value: '350' },
            { label: '防禦力', value: '200' },
        ];
        panel.onDataUpdate(data);

        const row0 = host.children[0];
        const row1 = host.children[1];
        assert.equals(true, row0.active);
        assert.equals(true, row1.active);
        assert.equals('攻擊力', row0.children[0]._components['cc.Label'].string);
        assert.equals('350',   row0.children[1]._components['cc.Label'].string);
        assert.equals('防禦力', row1.children[0]._components['cc.Label'].string);
        assert.equals('200',   row1.children[1]._components['cc.Label'].string);
    });

    suite.test('onDataUpdate：資料行 < 容器行，多餘行 active=false', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');
        const host  = makeHostNode(3) as any;
        const panel = new AttributePanel(host, mockSkinResolver, mockBinder);
        const data: AttributeEntry[] = [
            { label: '攻擊力', value: '350' },
        ];
        panel.onDataUpdate(data);

        assert.equals(true,  host.children[0].active);
        assert.equals(false, host.children[1].active);
        assert.equals(false, host.children[2].active);
    });

    suite.test('onDataUpdate：資料行 > 容器行，超出部分不寫入（不崩潰）', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');
        const host  = makeHostNode(1) as any;
        const panel = new AttributePanel(host, mockSkinResolver, mockBinder);
        const data: AttributeEntry[] = [
            { label: '攻擊力', value: '350' },
            { label: '防禦力', value: '200' },  // 超出，應被靜默忽略
        ];
        // 不應拋出任何 error
        let threw = false;
        try { panel.onDataUpdate(data); } catch (_) { threw = true; }
        assert.equals(false, threw);
        // 只有第 0 行寫入
        assert.equals('攻擊力', host.children[0].children[0]._components['cc.Label'].string);
    });

    suite.test('onDataUpdate：格式錯誤時不渲染也不崩潰', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');
        const host  = makeHostNode(2) as any;
        const panel = new AttributePanel(host, mockSkinResolver, mockBinder);
        // 傳入非法格式（字串而非陣列）
        let threw = false;
        try { panel.onDataUpdate('invalid'); } catch (_) { threw = true; }
        assert.equals(false, threw);
    });

    // ── dataSource 識別 ────────────────────────────────────────────────────

    suite.test('AttributePanel.dataSource 預設為 "attributes"', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');
        const panel = new AttributePanel(makeHostNode(0) as any, mockSkinResolver, mockBinder);
        assert.equals('attributes', panel.dataSource);
    });

    // ── setCustomProp / onCustomPropChanged ────────────────────────────────

    suite.test('setCustomProp 正確儲存值並觸發 onCustomPropChanged', async () => {
        const { AttributePanel } = await import('../../assets/scripts/ui/core/panels/AttributePanel');

        class TrackingPanel extends AttributePanel {
            lastChangedKey   = '';
            lastChangedValue: unknown = undefined;
            protected override onCustomPropChanged(key: string, value: unknown): void {
                this.lastChangedKey   = key;
                this.lastChangedValue = value;
            }
        }
        const panel = new TrackingPanel(makeHostNode(0) as any, mockSkinResolver, mockBinder);
        panel.setCustomProp('theme', 'dark');
        assert.equals('dark', panel.customProps['theme']);
        assert.equals('theme', panel.lastChangedKey);
        assert.equals('dark', panel.lastChangedValue);
    });

    return suite;
}
