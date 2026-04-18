/**
 * editableTextPanel.test.ts — UCUF EditableTextPanel 邏輯測試
 *
 * M7-P3 驗收：≥ 8 個 test case，含 validateDataFormat 與 onDataUpdate 覆蓋。
 */

import { TestSuite, assert } from '../TestRunner';

class MockNode {
    name: string;
    children: MockChild[] = [];
    constructor(name = 'MockNode') { this.name = name; }
    addChild(child: MockChild): void { this.children.push(child); }
}

class MockChild {
    active = false;
}

class MockBinder {
    setLabelTextCalls: Array<{ key: string; text: string }> = [];
    setLabelText(key: string, text: string): void {
        this.setLabelTextCalls.push({ key, text });
    }
}

const mockSkinResolver = {} as any;

export function createEditableTextPanelSuite(): TestSuite {
    const suite = new TestSuite('UCUF-EditableTextPanel', 2);

    suite.test('dataSource 固定為 editableText', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const panel = new EditableTextPanel(new MockNode() as any, mockSkinResolver, {} as any);
        assert.equals('editableText', panel.dataSource);
    });

    suite.test('validateDataFormat：合法資料回傳 null', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const panel = new EditableTextPanel(new MockNode() as any, mockSkinResolver, {} as any);
        assert.equals(null, panel.validateDataFormat({ text: '武將介紹', editable: false }));
    });

    suite.test('validateDataFormat：null 回傳錯誤', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const panel = new EditableTextPanel(new MockNode() as any, mockSkinResolver, {} as any);
        assert.notEquals(null, panel.validateDataFormat(null));
    });

    suite.test('validateDataFormat：陣列回傳錯誤', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const panel = new EditableTextPanel(new MockNode() as any, mockSkinResolver, {} as any);
        assert.notEquals(null, panel.validateDataFormat([]));
    });

    suite.test('validateDataFormat：text 非 string 回傳錯誤', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const panel = new EditableTextPanel(new MockNode() as any, mockSkinResolver, {} as any);
        assert.notEquals(null, panel.validateDataFormat({ text: 42, editable: true }));
    });

    suite.test('validateDataFormat：editable 非 boolean 回傳錯誤', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const panel = new EditableTextPanel(new MockNode() as any, mockSkinResolver, {} as any);
        assert.notEquals(null, panel.validateDataFormat({ text: '文字', editable: 'yes' }));
    });

    suite.test('validateDataFormat：缺少 text 欄位回傳錯誤', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const panel = new EditableTextPanel(new MockNode() as any, mockSkinResolver, {} as any);
        assert.notEquals(null, panel.validateDataFormat({ editable: true }));
    });

    suite.test('validateDataFormat：缺少 editable 欄位回傳錯誤', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const panel = new EditableTextPanel(new MockNode() as any, mockSkinResolver, {} as any);
        assert.notEquals(null, panel.validateDataFormat({ text: '文字' }));
    });

    suite.test('onDataUpdate：合法資料更新 _lastData', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const panel = new EditableTextPanel(new MockNode() as any, mockSkinResolver, {} as any);
        panel.onDataUpdate({ text: '測試', editable: true });
        const last = panel._lastData as { text: string; editable: boolean } | null;
        assert.equals('測試', last?.text ?? null);
        assert.equals(true, last?.editable ?? false);
    });

    suite.test('onDataUpdate：非法資料不更新 _lastData', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const panel = new EditableTextPanel(new MockNode() as any, mockSkinResolver, {} as any);
        panel.onDataUpdate(null);
        assert.equals(null, panel._lastData);
    });

    suite.test('onDataUpdate：呼叫 binder.setLabelText 傳遞文字', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const binder = new MockBinder();
        const panel = new EditableTextPanel(new MockNode() as any, mockSkinResolver, binder as any);
        panel.onDataUpdate({ text: '劉備', editable: false });
        assert.equals(1, binder.setLabelTextCalls.length);
        assert.equals('TextLabel', binder.setLabelTextCalls[0].key);
        assert.equals('劉備', binder.setLabelTextCalls[0].text);
    });

    suite.test('onDataUpdate：editable=true 設定子節點 active=true', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const hostNode = new MockNode() as any;
        const child = new MockChild();
        hostNode.children = [child];
        const panel = new EditableTextPanel(hostNode, mockSkinResolver, {} as any);
        panel.onDataUpdate({ text: '關羽', editable: true });
        assert.isTrue(child.active);
    });

    suite.test('onDataUpdate：editable=false 設定子節點 active=false', async () => {
        const { EditableTextPanel } = await import('../../assets/scripts/ui/core/panels/EditableTextPanel');
        const hostNode = new MockNode() as any;
        const child = new MockChild();
        child.active = true;
        hostNode.children = [child];
        const panel = new EditableTextPanel(hostNode, mockSkinResolver, {} as any);
        panel.onDataUpdate({ text: '張飛', editable: false });
        assert.isFalse(child.active);
    });

    return suite;
}
