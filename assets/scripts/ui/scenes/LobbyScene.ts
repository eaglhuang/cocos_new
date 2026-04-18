// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Button, Color, Component, Node, UITransform, Widget } from 'cc';
import type { GeneralConfig, GeneralDetailDefaultTab } from '../../core/models/GeneralUnit';
import { services } from '../../core/managers/ServiceLoader';
import { SceneName } from '../../core/config/Constants';
import type { BattleEntryParams } from '../../battle/models/BattleEntryParams';
import { DEFAULT_BATTLE_ENTRY_PARAMS } from '../../battle/models/BattleEntryParams';
import type { EncounterConfig } from '../../battle/views/BattleSceneLoader';
import { GeneralListPanel } from '../components/GeneralListPanel';
import { GeneralDetailComposite } from '../components/GeneralDetailComposite';
import { UIScreenPreviewHost } from '../components/UIScreenPreviewHost';
import { SolidBackground } from '../components/SolidBackground';
import { ToastMessage } from '../components/ToastMessage';

const { ccclass } = _decorator;

@ccclass('LobbyScene')
export class LobbyScene extends Component {

    private _generals: GeneralConfig[] = [];
    private _encounters: EncounterConfig[] = [];
    private _listPanel: GeneralListPanel | null = null;
    private _detailPanel: GeneralDetailComposite | null = null;
    private _lobbyMainHost: UIScreenPreviewHost | null = null;
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

        const detailNode = this.node.getChildByName('GeneralDetailComposite');
        this._detailPanel = detailNode?.getComponent(GeneralDetailComposite) || detailNode?.addComponent(GeneralDetailComposite) || null;
        this._ensureWidget(detailNode);

        await this._mountLobbyMainHub();

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
            const encounterEnvelope = await services().resource.loadJson<{ encounters: EncounterConfig[] }>(
                'data/encounters', { tags: ['LobbyScene'] }
            );
            this._encounters = encounterEnvelope.encounters ?? [];
        } catch (error) {
            console.error('[LobbyScene] 載入資料失敗:', error);
        }

        // 測試 Toast
        this.scheduleOnce(() => {
            services().event.emit('SHOW_TOAST', { message: '系統：水墨金屬 UI 已啟動 (v2.2)' });
        }, 1);

        this._ready = true;
    }

    private async _mountLobbyMainHub(): Promise<void> {
        const hostNode = this.node.getChildByName('LobbyMainHost') ?? new Node('LobbyMainHost');
        hostNode.layer = this.node.layer;
        if (!hostNode.parent) {
            hostNode.parent = this.node;
        }

        this._ensureWidget(hostNode);
        const backgroundIndex = this.node.getChildByName('Background')?.getSiblingIndex() ?? -1;
        hostNode.setSiblingIndex(Math.max(backgroundIndex + 1, 0));

        this._lobbyMainHost = hostNode.getComponent(UIScreenPreviewHost) ?? hostNode.addComponent(UIScreenPreviewHost);
        await this._lobbyMainHost.showScreen('lobby-main-screen');

        const binder = this._lobbyMainHost.binder;
        const generalsButton = binder?.getButton('btnGenerals');
        const battleButton = binder?.getButton('btnBattle');

        if (!generalsButton || !battleButton) {
            throw new Error('[LobbyScene] lobby-main-screen 缺少 btnGenerals 或 btnBattle 綁定');
        }

        generalsButton.node.off(Button.EventType.CLICK, this.onClickGeneralList, this);
        generalsButton.node.on(Button.EventType.CLICK, this.onClickGeneralList, this);

        battleButton.node.off(Button.EventType.CLICK, this.onClickEnterBattle, this);
        battleButton.node.on(Button.EventType.CLICK, this.onClickEnterBattle, this);
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

    private async _showGeneralListWithHandler(
        onSelectGeneral: (config: GeneralConfig) => void | Promise<void>,
    ): Promise<void> {
        if (!this._listPanel) return;

        this._listPanel.onSelectGeneral = onSelectGeneral;
        await this._listPanel.show(this._generals);
    }

    /** 「武將列表」按鈕 */
    public onClickGeneralList() {
        void this._showGeneralListWithHandler((config: GeneralConfig) => {
            if (this._detailPanel) {
                void this._detailPanel.show(config);
            }
        });
    }

    /** 「進入戰鬥」按鈕 */
    /** 最小 smoke route：走既有武將列表 callback 鏈，驗證 General Detail 指定 tab。 */
    public async onClickGeneralDetailOverviewSmoke(previewVariant = '') {
        await this._openGeneralDetailSmoke('Overview', previewVariant);
    }

    public async onClickGeneralDetailSkillsSmoke(previewVariant = '') {
        await this._openGeneralDetailSmoke('Skills', previewVariant);
    }

    private async _openGeneralDetailSmoke(defaultTab: GeneralDetailDefaultTab, previewVariant = '') {
        if (!this._listPanel || !this._detailPanel) {
            console.warn('[LobbyScene] GeneralDetailOverview smoke 失敗：list/detail panel 未就緒');
            return;
        }
        if (this._generals.length === 0) {
            console.warn('[LobbyScene] GeneralDetailOverview smoke 失敗：尚未載入武將資料');
            return;
        }

        const smokeGeneral = this._resolveGeneralDetailSmokeGeneral(previewVariant);
        if (!smokeGeneral) {
            console.warn(`[LobbyScene] GeneralDetailOverview smoke 失敗：找不到對應武將 variant=${previewVariant || '(default)'}`);
            return;
        }

        // smoke route 與正式產品流共用同一段 list-open controller path，避免繞過 LobbyMain → GeneralList 的入口邏輯
        await this._showGeneralListWithHandler(async (config: GeneralConfig) => {
            await this._detailPanel!.show({
                ...config,
                profilePresentation: {
                    ...config.profilePresentation,
                    defaultTab,
                },
            });
        });

        await this._listPanel.onSelectGeneral(smokeGeneral);
        this._listPanel.node.active = false;
    }

    private _resolveGeneralDetailSmokeGeneral(previewVariant: string): GeneralConfig | null {
        const requested = previewVariant.trim().toLowerCase();
        let preferredId = 'zhang-fei';

        if (requested === 'zhen-ji' || requested === 'zhenji' || requested === 'smoke-zhen-ji') {
            preferredId = 'zhen-ji';
        } else if (requested === 'zhao-yun' || requested === 'zhaoyun') {
            preferredId = 'zhao-yun';
        } else if (requested && requested !== 'default' && requested !== 'zhang-fei' && requested !== 'zhangfei' && requested !== 'smoke-zhang-fei') {
            preferredId = requested;
        }

        return this._generals.find((item) => item.id === preferredId)
            ?? this._generals.find((item) => item.id === 'zhang-fei')
            ?? this._generals[0]
            ?? null;
    }

    public onClickEnterBattle() {
        services().scene.switchScene(SceneName.Battle, this._buildBattleEntryParams());
    }

    /** 「退出」按鈕 */
    public onClickExit() {
        services().scene.switchScene(SceneName.Login);
    }

    private _buildBattleEntryParams(): BattleEntryParams {
        const encounter = this._encounters[0];
        if (!encounter) {
            return {
                ...DEFAULT_BATTLE_ENTRY_PARAMS,
                entrySource: 'lobby',
            };
        }

        return {
            entrySource: 'lobby',
            encounterId: encounter.id,
            playerGeneralId: encounter.playerGeneralId,
            enemyGeneralId: encounter.enemyGeneralId,
            playerEquipment: [...(encounter.playerEquipment ?? [])],
            enemyEquipment: [...(encounter.enemyEquipment ?? [])],
            selectedCardIds: [],
            weather: encounter.weather ?? DEFAULT_BATTLE_ENTRY_PARAMS.weather,
            battleTactic: encounter.battleTactic ?? DEFAULT_BATTLE_ENTRY_PARAMS.battleTactic,
            backgroundId: encounter.backgroundId,
        };
    }
}
