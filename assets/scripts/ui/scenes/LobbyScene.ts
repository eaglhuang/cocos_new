// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, Color, Node, UITransform, Widget } from 'cc';
import type { GeneralConfig } from '../../core/models/GeneralUnit';
import { services } from '../../core/managers/ServiceLoader';
import { SceneName } from '../../core/config/Constants';
import { GeneralListPanel } from '../components/GeneralListPanel';
import { GeneralDetailPanel } from '../components/GeneralDetailPanel';
import { GeneralPortraitPanel, GeneralPortraitConfig } from '../components/GeneralPortraitPanel';
import { SolidBackground } from '../components/SolidBackground';
import { ToastMessage } from '../components/ToastMessage';

const { ccclass } = _decorator;

@ccclass('LobbyScene')
export class LobbyScene extends Component {

    private _generals: GeneralConfig[] = [];
    private _listPanel: GeneralListPanel | null = null;
    private _detailPanel: GeneralDetailPanel | null = null;
    private _portraitPanel: GeneralPortraitPanel | null = null;
    private _ready = false;

    /** 等待 LobbyScene 資料初始化完成（供 headless smoke route 使用） */
    public async waitForReady(timeoutMs = 8000): Promise<boolean> {
        const start = Date.now();
        while (!this._ready && Date.now() - start < timeoutMs) {
            await new Promise<void>((r) => setTimeout(r, 80));
        }
        return this._ready;
    }

    async start() {
        // 為 LobbyScene 大背板生成穩定的組件背景
        const bgNode = this.node.getChildByName('Background');
        if (bgNode) {
            let bg = bgNode.getComponent(SolidBackground) || bgNode.addComponent(SolidBackground);
            bg.color = new Color(15, 20, 25, 255);
        }

        // 初始化子系統（列表與彈窗）
        const listNode = this.node.getChildByName('GeneralListPanel');
        this._listPanel = listNode?.getComponent(GeneralListPanel) || listNode?.addComponent(GeneralListPanel) || null;

        this._ensureWidget(listNode);

        const detailNode = this.node.getChildByName('GeneralDetailPanel');
        this._detailPanel = detailNode?.getComponent(GeneralDetailPanel) || detailNode?.addComponent(GeneralDetailPanel) || null;
        this._ensureWidget(detailNode);

        // 初始化 Portrait 面板
        let portraitNode = this.node.getChildByName('GeneralPortraitPanel');
        if (!portraitNode) {
            portraitNode = new Node('GeneralPortraitPanel');
            portraitNode.layer = this.node.layer;
            portraitNode.parent = this.node;
        }
        this._portraitPanel = portraitNode.getComponent(GeneralPortraitPanel) || portraitNode.addComponent(GeneralPortraitPanel);
        this._ensureWidget(portraitNode);

        // 動態注入輕提示系統 (Toast)
        const toastNode = new Node('ToastContainer');
        toastNode.layer = this.node.layer;
        toastNode.parent = this.node;
        this._ensureWidget(toastNode);
        toastNode.addComponent(ToastMessage);

        // 載入武將、技能與特效資料
        try {
            await Promise.all([
                services().loadSkills(),
                services().loadVfxEffects()
            ]);
            
            this._generals = await services().resource.loadJson<GeneralConfig[]>(
                'data/generals', { tags: ['LobbyScene'] }
            );
        } catch (error) {
            console.error('[LobbyScene] 載入資料失敗:', error);
        }

        // 測試 Toast
        this.scheduleOnce(() => {
            services().event.emit('SHOW_TOAST', { message: '系統：水墨金屬 UI 已啟動 (v2.2)' });
        }, 1);

        this._ready = true;
    }

    private _ensureWidget(node: Node | null | undefined) {
        if (!node) return;
        node.layer = this.node.layer;
        const ut = node.getComponent(UITransform) || node.addComponent(UITransform);
        ut.setContentSize(1920, 1080);
        const widget = node.getComponent(Widget) || node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;
    }

    // ──────────────────────────────────────────
    // Button Click Event 回呼（由 scene-flow-builder 或 Inspector 綁定）
    // ──────────────────────────────────────────

    /** 「武將列表」按鈕 */
    public onClickGeneralList() {
        if (!this._listPanel) return;
        
        // 綁定選擇回呼
        this._listPanel.onSelectGeneral = (config: GeneralConfig) => {
            if (this._detailPanel) {
                this._detailPanel.show(config);
            }
        };

        this._listPanel.show(this._generals);
    }

    /** 「進入戰鬥」按鈕 */
    /** 最小 smoke route：走既有武將列表 callback 鏈，驗證 Basics -> overview shell */
    public async onClickGeneralDetailOverviewSmoke() {
        if (!this._listPanel || !this._detailPanel) {
            console.warn('[LobbyScene] GeneralDetailOverview smoke 失敗：list/detail panel 未就緒');
            return;
        }
        if (this._generals.length === 0) {
            console.warn('[LobbyScene] GeneralDetailOverview smoke 失敗：尚未載入武將資料');
            return;
        }

        this._listPanel.onSelectGeneral = async (config: GeneralConfig) => {
            await this._detailPanel!.show(config);
        };

        await this._listPanel.show(this._generals);
        await this._listPanel.onSelectGeneral(this._generals[0]);
    }

    public onClickEnterBattle() {
        services().scene.switchScene(SceneName.Battle);
    }

    /** 「退出」按鈕 */
    public onClickExit() {
        services().scene.switchScene(SceneName.Login);
    }
}
