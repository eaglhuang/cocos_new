// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, Node, Label, Button } from 'cc';
import type { GeneralConfig } from '../../core/models/GeneralUnit';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

@ccclass('GeneralListPanel')
export class GeneralListPanel extends UIPreviewBuilder {

    private get _specLoader() { return services().specLoader; }
    public onSelectGeneral: ((config: GeneralConfig) => void) | null = null;
    private _isBuilt = false;

    /** 由 buildScreen 完成後自動呼叫，負責靜態事件綁定 */
    protected onReady(binder: UITemplateBinder): void {
        // Unity 對照：button.onClick.AddListener(OnBack) in Start()
        binder.getButton('BtnBack')?.node.on(Button.EventType.CLICK, this.hide, this);
    }

    public async show(generals: GeneralConfig[]): Promise<void> {
        this.node.active = true;
        
        if (!this._isBuilt) {
            // 1. 動態載入三層結構契約與 Design Tokens v2.2
            const layout = await this._specLoader.loadLayout('general-list-main');
            const skin = await this._specLoader.loadSkin('general-list-default');
            const i18n = await this._specLoader.loadI18n(services().i18n.currentLocale);
            const tokens = await this._specLoader.loadDesignTokens();
            
            // 2. 透過 UI 建構引擎產生節點樹
            try {
                await this.buildScreen(layout, skin, i18n, tokens);
                console.log('[GeneralListPanel] buildScreen 完成，this.node children:', this.node.children.map(c => c.name));
            } catch (e) {
                console.error('[GeneralListPanel] buildScreen 拋出例外，list 將無法填入:', e);
                return;
            }
            this._isBuilt = true;
        }

        // 4. 清空舊資料並填入新資料 (populateList)
        const listPath = 'GeneralListRoot/MainContainer/DataList';
        console.log(`[GeneralListPanel] 即將取 listNode path="${listPath}"，generals 數量=${generals.length}`);
        const listNode = this.node.getChildByPath(listPath);
        console.log(`[GeneralListPanel] listNode=${listNode ? listNode.name : 'null'}，_itemTemplate=${(listNode as any)?._itemTemplate ? 'OK' : 'MISSING'}`);
        if (listNode) {
            const content = listNode.getChildByName('Content');
            console.log(`[GeneralListPanel] content=${content ? 'OK' : 'MISSING'}`);
            if (content) content.removeAllChildren();
            
            await this.populateList(listPath, generals, (item, row) => {
                // 依據 bind 名稱塞入資料
                row.getChildByName('Name')!.getComponent(Label)!.string = item.name;
                
                const factionLbl = row.getChildByName('Faction')!.getComponent(Label)!;
                if (item.faction === 'player') {
                    factionLbl.string = '我方';
                    factionLbl.color = this.resolveColor('textPositive');
                } else {
                    factionLbl.string = '敵方';
                    factionLbl.color = this.resolveColor('textNegative');
                }

                // 診斷日誌：確保 Name 節點名稱正確指派
                const nameNode = row.getChildByName('Name');
                const nameLbl = nameNode?.getComponent(Label);
                if (nameLbl) {
                    nameLbl.string = item.name;
                    console.log(`[GeneralListPanel] Row populated: ${item.name} (${item.id})`);
                } else {
                    console.warn(`[GeneralListPanel] Name node not found for item: ${item.id}`, row.children.map(c => c.name));
                }

                row.getChildByName('Hp')!.getComponent(Label)!.string = item.hp.toString();
                row.getChildByName('Sp')!.getComponent(Label)!.string = item.maxSp.toString();
                
                const atkStr = `+${Math.floor(item.attackBonus * 100)}%`;
                const atkNode = row.getChildByName('Atk');
                if (atkNode) atkNode.getComponent(Label)!.string = atkStr;

                // 註冊列點擊回呼
                const btn = row.getComponent(Button) || row.addComponent(Button);
                btn.node.off(Button.EventType.CLICK);
                btn.node.on(Button.EventType.CLICK, () => {
                    console.log(`[GeneralListPanel] Selected general: ${item.name} (${item.id})`);
                    if (this.onSelectGeneral) {
                        this.onSelectGeneral(item);
                    }
                }, this);
            });
        }
        
        this.playEnterTransition(this.node);
    }

    public hide(): void {
        this.playExitTransition(this.node, undefined, () => {
            this.node.active = false;
        });
    }
}
