// @spec-source → 見 docs/cross-reference-index.md
/**
 * GeneralQuickViewPanel — 主將屬性戰法快覽彈窗 (v3-5)
 *
 * 職責：
 *   1. 顯示武將的名稱、稱號、所屬陣營、HP（現值/上限）、攻/防
 *   2. 顯示最多 3 個戰法技能名稱
 *   3. 敵方武將：HP/攻/防顯示為「???」（資訊遮蔽）
 *   4. 點擊 GQCloseBtn 或 BgOverlay → 關閉彈窗（active = false）
 *   5. 透過 show(data) 公開方法由 BattleHUD 驅動開啟
 *
 * 觸發鏈：BattleHUD.PlayerPortrait / EnemyPortrait Click
 *   → services().event.emit(ShowGeneralQuickView, data)
 *   → GeneralQuickViewPanel.show(data)
 *
 * Unity 對照：GeneralInfoPopup（HeroInfoPanel.cs — 浮現 Panel, 填入 Text/Image 後 SetActive(true)）
 *
 * 設計規格：docs/主戰場UI規格補充_v3.md §v3-5
 * Layout JSON：assets/resources/ui-spec/layouts/general-quickview-main.json
 * Skin   JSON：assets/resources/ui-spec/skins/general-quickview-default.json
 */
import { _decorator, Button, Label, Node } from 'cc';
import { EVENT_NAMES, Faction } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { UITemplateBinder } from '../core/UITemplateBinder';

const { ccclass } = _decorator;

/** 快覽彈窗所需的資料結構 */
export interface GeneralQuickViewData {
    /** 武將姓名（如：關羽） */
    name:    string;
    /** 武將稱號（如：武聖） */
    title:   string;
    /** 陣營（如：蜀、魏、吳） */
    faction: string;
    /** 當前 HP */
    hp:      number;
    /** HP 上限 */
    maxHp:   number;
    /** 攻擊 */
    atk:     number;
    /** 防禦 */
    def:     number;
    /** 速度 */
    spd?:    number;
    /** 智力 */
    int?:    number;
    /** 戰法列表（最多顯示 3 個） */
    skills?: string[];
    /** true = 敵方武將（HP/攻/防遮蔽顯示為 ???） */
    isEnemy?: boolean;
}

@ccclass('GeneralQuickViewPanel')
export class GeneralQuickViewPanel extends UIPreviewBuilder {

    private get _specLoader() { return services().specLoader; }
    private _initialized = false;

    // ── 節點 / 組件引用 ────────────────────────────────────────
    private _root:       Node  | null = null;
    private _gqName:     Label | null = null;
    private _gqTitle:    Label | null = null;
    private _gqFaction:  Label | null = null;
    private _gqHpRow:    Label | null = null;
    private _gqAtk:      Label | null = null;
    private _gqDef:      Label | null = null;
    private _gqSpd:      Label | null = null;
    private _gqInt:      Label | null = null;
    private _gqSkill1:   Label | null = null;
    private _gqSkill2:   Label | null = null;
    private _gqSkill3:   Label | null = null;

    private readonly _unsubs: (() => void)[] = [];

    // ── 生命週期 ──────────────────────────────────────────────

    async onLoad(): Promise<void> {
        services().initialize(this.node);
        await this._initialize();
        this._subscribeEvents();
    }

    private async _initialize(): Promise<void> {
        if (this._initialized) return;
        try {
            const [fullScreen, i18n] = await Promise.all([
                this._specLoader.loadFullScreen('general-quickview-screen'),
                this._specLoader.loadI18n(services().i18n.currentLocale),
            ]);
            await this.buildScreen(fullScreen.layout, fullScreen.skin, i18n);
            this._initialized = true;
        } catch (e) {
            console.warn('[GeneralQuickViewPanel] 規格載入失敗，退回白模', e);
            this._initialized = true;
        }
    }

    onDestroy(): void {
        this._unsubs.forEach(fn => fn());
        this._unsubs.length = 0;
    }

    // ── 覆寫建構點：綁定節點引用與事件 ─────────────────────────

    protected onReady(binder: UITemplateBinder): void {
        this._root = binder.getNode('QuickViewRoot') ?? binder.getNode('Root') ?? this.node;

        this._gqName    = binder.getLabel('GQName');
        this._gqTitle   = binder.getLabel('GQTitle');
        this._gqFaction = binder.getLabel('GQFaction');
        this._gqHpRow   = binder.getLabel('GQHpRow');
        this._gqAtk     = binder.getLabel('GQAtk');
        this._gqDef     = binder.getLabel('GQDef');
        this._gqSpd     = binder.getLabel('GQSpd');
        this._gqInt     = binder.getLabel('GQInt');
        this._gqSkill1  = binder.getLabel('GQSkill1');
        this._gqSkill2  = binder.getLabel('GQSkill2');
        this._gqSkill3  = binder.getLabel('GQSkill3');

        binder.getNode('GQCloseBtn')?.on(Button.EventType.CLICK, this.hide, this);
        binder.getNode('BgOverlay')?.on(Button.EventType.CLICK,  this.hide, this);

        if (this._root) this._root.active = false;

        console.log(
            `[GeneralQuickViewPanel] 綁定完成 — name:${!!this._gqName}` +
            ` hp:${!!this._gqHpRow} skill1:${!!this._gqSkill1}`
        );
    }

    // ── 事件訂閱 ─────────────────────────────────────────────

    private _subscribeEvents(): void {
        this._unsubs.push(
            services().event.on(
                EVENT_NAMES.ShowGeneralQuickView,
                (data: GeneralQuickViewData) => this.show(data),
            ),
        );
    }

    // ── 公開 API ──────────────────────────────────────────────

    /**
     * 填入資料並顯示彈窗。
     * @param data 武將快覽資料；isEnemy=true 時遮蔽數值。
     *
     * Unity 對照：GeneralInfoPopup.Show(HeroData data)
     */
    public show(data: GeneralQuickViewData): void {
        const mask = data.isEnemy ? '???' : null;

        if (this._gqName)    this._gqName.string    = data.name;
        if (this._gqTitle)   this._gqTitle.string   = data.title;
        if (this._gqFaction) this._gqFaction.string = data.faction;

        // HP 行：自方顯示實際值，敵方遮蔽
        if (this._gqHpRow) {
            this._gqHpRow.string = mask
                ? `❤ HP：${mask}`
                : `❤ HP：${data.hp.toLocaleString()} / ${data.maxHp.toLocaleString()}`;
        }

        if (this._gqAtk) {
            this._gqAtk.string = `⚔ 攻：${mask ?? data.atk}`;
        }
        if (this._gqDef) {
            this._gqDef.string = `🛡 防：${mask ?? data.def}`;
        }
        if (this._gqSpd) {
            this._gqSpd.string = data.spd != null ? `🐎 速：${mask ?? data.spd}` : '';
        }
        if (this._gqInt) {
            this._gqInt.string = data.int != null ? `🧠 智：${mask ?? data.int}` : '';
        }

        // 戰法列表（最多 3 條，不足補 ——）
        const skills = data.skills ?? [];
        const getSkill = (i: number) => skills[i] ?? '——';
        if (this._gqSkill1) this._gqSkill1.string = getSkill(0);
        if (this._gqSkill2) this._gqSkill2.string = getSkill(1);
        if (this._gqSkill3) this._gqSkill3.string = getSkill(2);

        // 顯示
        if (this._root) this._root.active = true;

        console.log(`[GeneralQuickViewPanel] show — ${data.name} isEnemy:${!!data.isEnemy}`);
    }

    /**
     * 關閉彈窗。
     * Unity 對照：GeneralInfoPopup.Hide() → gameObject.SetActive(false)
     */
    public hide(): void {
        if (this._root) this._root.active = false;
    }

}
