import { TestSuite, assert } from './TestRunner';
import { GeneralListPanel } from '../../ui/components/GeneralListPanel';
import { Node, Layout, UITransform, Label } from './cc.mock';

export function createGeneralListPanelSuite() {
    const suite = new TestSuite("GeneralListPanel (Responsive UI)");

    suite.test("自動建立 CardContainer 且正確配置其 Layout", () => {
        const root = new Node('UIRoot');
        const panel = root.addComponent(GeneralListPanel) as any;
        
        const fakeGenerals = [
            { id: '1', name: '曹操', faction: 'enemy', hp: 1000, maxSp: 80, attackBonus: 0.2, skillId: '', preferredTerrain: '', terrainDefenseBonus: 0 },
            { id: '2', name: '劉備', faction: 'player', hp: 1200, maxSp: 100, attackBonus: 0.15, skillId: '', preferredTerrain: '', terrainDefenseBonus: 0 }
        ];
        
        panel.show(fakeGenerals as any);

        const container = root.getChildByName('CardContainer');
        assert.isDefined(container, "應自動建立 CardContainer");
        
        const layout = container!.getComponent(Layout) as any;
        assert.isDefined(layout, "CardContainer 應有 Layout 組件");
        assert.equals(Layout.Type.VERTICAL, layout.type, "佈局應為垂直");
        assert.equals(Layout.ResizeMode.CONTAINER, layout.resizeMode, "應啟用容器自動撐大 (CONTAINER)");
    });

    suite.test("產生的子節點數量正確 (表頭 + 資料列，無重複文字)", () => {
        const root = new Node('UIRoot');
        const panel = root.addComponent(GeneralListPanel) as any;
        const count = 3;
        const fakeGenerals = Array(count).fill(0).map((_, i) => ({
            id: i.toString(), name: 'Test', faction: 'player', hp: 100, maxSp: 50, attackBonus: 0, skillId: '', preferredTerrain: '', terrainDefenseBonus: 0
        }));

        panel.show(fakeGenerals as any);
        const container = root.getChildByName('CardContainer');
        
        // 新架構：Title 與 Hint 已由場景提供，不在程式碼中重複生成
        // 子節點 = Header (1) + Rows (count)
        const expectedCount = 1 + count;
        assert.lengthEquals(expectedCount, container!.children, `應有 ${expectedCount} 個子節點（移除重複內容後）`);
    });

    suite.test("HeaderRow 節點應正確建立且無重複 Hint", () => {
        const root = new Node('UIRoot');
        const panel = root.addComponent(GeneralListPanel) as any;
        panel.show([]);

        const container = root.getChildByName('CardContainer');
        
        const titleNode = container!.getChildByName('Title');
        assert.isFalse(!!titleNode, "Title 不應由程式碼自動產生");

        const hintNode = container!.getChildByName('Hint');
        assert.isFalse(!!hintNode, "Hint 不應由程式碼自動產（場景已有）");

        const headerNode = container!.getChildByName('HeaderRow');
        assert.isDefined(headerNode, "應存在 HeaderRow 節點");
    });

    return suite;
}
