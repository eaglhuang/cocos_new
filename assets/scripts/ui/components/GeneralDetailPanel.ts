// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Label, Button, Color, Node, Sprite, SpriteFrame, Texture2D, resources, UITransform, BlockInputEvents, Widget } from 'cc';
import type { GeneralConfig, GeneralGeneConfig, GeneralStatsConfig } from '../../core/models/GeneralUnit';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { SolidBackground } from './SolidBackground';
import { buildGeneralDetailOverview } from './GeneralDetailOverviewMapper';
import { GeneralDetailOverviewShell } from './GeneralDetailOverviewShell';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

type TabKey = 'Basics' | 'Stats' | 'Bloodline' | 'Skills' | 'Aptitude' | 'Extended';

const ACTIVE_TAB_COLOR = new Color(184, 215, 201, 255);
const INACTIVE_TAB_COLOR = new Color(233, 225, 209, 255);
const ACTIVE_TAB_TEXT = new Color(45, 41, 38, 255);
const INACTIVE_TAB_TEXT = new Color(107, 94, 78, 255);

const TAB_ORDER: TabKey[] = ['Basics', 'Stats', 'Bloodline', 'Skills', 'Aptitude', 'Extended'];
const RESERVED_FOOTER_ACTIONS = ['BtnFavorite', 'BtnLock', 'BtnCompare', 'BtnShare'] as const;

const SKILL_DISPLAY_NAME: Record<string, string> = {
    'zhang-fei-roar': '震吼（全體暈眩 1 回合）',
    'guan-yu-slash': '月牙刀斬（全體 70 固傷）',
    'lu-bu-rampage': '天下無雙（全體 80 固傷）',
    'cao-cao-tactics': '兵不厭詐（全體 50 固傷）',
    'zhao-yun-pierce': '龍魂突刺（單體 2.5 倍傷）',
};

const TERRAIN_DISPLAY: Record<string, string> = {
    plain: '平原',
    river: '河流',
    mountain: '山地',
    fortress: '城池',
    desert: '沙漠',
    forest: '林地',
    water: '水域',
};

const FACTION_DISPLAY: Record<string, string> = {
    player: '玩家',
    enemy: '敵方',
};

const ROLE_DISPLAY: Record<string, string> = {
    Combat: '戰鬥武將',
    Support: '支援武將',
    Hybrid: '複合武將',
};

const STATUS_DISPLAY: Record<string, string> = {
    'Active': '壯年',
    'Young': '未成年',
    'Retired': '隱居',
    'Injured': '重傷',
};

import { BloodlineGenerator } from '../../core/systems/BloodlineGenerator';

@ccclass('GeneralDetailPanel')
export class GeneralDetailPanel extends UIPreviewBuilder {

    public onClose: (() => void) | null = null;

    private get _specLoader() { return services().specLoader; }
    private _isBuilt = false;
    private _activeTab: TabKey = 'Basics';
    private _currentConfig: GeneralConfig | null = null;
    private _overviewShell: GeneralDetailOverviewShell | null = null;

    /** 由 buildScreen 完成後自動呼叫，收集 binder 並設定静態事件 */
    protected onReady(_binder: UITemplateBinder): void {
        // 靜態按鈕事件綁定（只需執行一次）
        // Unity 對照：Start() 中的 button.onClick.AddListener()
        this._bindStaticEvents();
        this._setupClickBlocker();
        this._ensureOverviewShell();
    }

    public async show(config: GeneralConfig): Promise<void> {
        this.node.active = true;

        // 【資料補全】如果沒有血統資料，自動生成
        this._currentConfig = BloodlineGenerator.fillBloodline(config);

        if (!this._isBuilt) {
            const { screen, layout, skin } = await this._specLoader.loadFullScreen('general-detail-screen');
            const i18n = await this._specLoader.loadI18n(services().i18n.currentLocale);
            const tokens = await this._specLoader.loadDesignTokens();

            if (screen.uiId !== 'GeneralDetail') {
                console.warn(`[GeneralDetailPanel] screen uiId mismatch: ${screen.uiId}`);
            }

            await this.buildScreen(layout, skin, i18n, tokens);
            this._isBuilt = true;
        }

        this._populateUI(this._currentConfig);
        if (this._overviewShell) {
            await this._overviewShell.show(this._currentConfig);
        }
        this._activateTab('Basics');
        this.playEnterTransition(this.node.getChildByName('GeneralDetailRoot')!);
    }

    public hide(): void {
        this._overviewShell?.hide();
        this.playExitTransition(this.node.getChildByName('GeneralDetailRoot')!, undefined, () => {
            this.node.active = false;
            this.onClose?.();
        });
    }

    private _bindStaticEvents(): void {
        this._syncReservedFooterActions();
        this._bindClick('RightTabBar/BtnClose', () => this.hide());
        this._bindClick('ClickBlocker', () => this.hide());

        for (const tab of TAB_ORDER) {
            this._bindClick(`RightTabBar/BtnTab${tab}`, () => this._activateTab(tab));
        }
    }

    private _setupClickBlocker(): void {
        const blocker = this._getNode('ClickBlocker');
        if (blocker) {
            // 強制掛載 BlockInputEvents 組件，防止所有事件穿透
            let comp = blocker.getComponent(BlockInputEvents);
            if (!comp) {
                comp = blocker.addComponent(BlockInputEvents);
            }
        }
    }

    private _activateTab(tab: TabKey): void {
        this._activeTab = tab;
        const isOverviewTab = tab === 'Basics';

        this._setOverviewMode(isOverviewTab);

        for (const entry of TAB_ORDER) {
            const panel = this._getNode(`RightContentArea/Tab${entry}`);
            if (panel) {
                panel.active = !isOverviewTab && entry === tab;
            }

            // 【特殊處理】血統分頁時，隱藏左側大立繪
            const portrait = this._getNode('PortraitImage');
            if (portrait) {
                portrait.active = !isOverviewTab && this._activeTab !== 'Bloodline';
            }

            const buttonNode = this._getNode(`RightTabBar/BtnTab${entry}`);
            if (!buttonNode) continue;

            const background = buttonNode.getComponent(SolidBackground);
            if (background) {
                background.color = entry === tab ? ACTIVE_TAB_COLOR : INACTIVE_TAB_COLOR;
            }

            const sprite = buttonNode.getComponent(Sprite);
            if (sprite) {
                sprite.color = entry === tab ? ACTIVE_TAB_COLOR : INACTIVE_TAB_COLOR;
            }

            buttonNode.setScale(entry === tab ? 1.03 : 1, entry === tab ? 1.03 : 1, 1);

            const labelNode = buttonNode.getChildByName('Label');
            const label = labelNode?.getComponent(Label);
            if (label) {
                label.color = entry === tab ? ACTIVE_TAB_TEXT : INACTIVE_TAB_TEXT;
            }
        }
    }

    private _ensureOverviewShell(): void {
        if (this._overviewShell) {
            return;
        }

        const root = this.node.getChildByName('GeneralDetailRoot');
        if (!root) {
            return;
        }

        let host = root.getChildByName('GeneralDetailOverviewShellHost');
        if (!host) {
            host = new Node('GeneralDetailOverviewShellHost');
            host.layer = root.layer;
            host.parent = root;
        }

        const transform = host.getComponent(UITransform) || host.addComponent(UITransform);
        transform.setContentSize(1920, 1080);

        const widget = host.getComponent(Widget) || host.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        const tabBarFill = root.getChildByName('RightTabBarFill');
        if (tabBarFill) {
            host.setSiblingIndex(tabBarFill.getSiblingIndex());
        }

        this._overviewShell = host.getComponent(GeneralDetailOverviewShell) || host.addComponent(GeneralDetailOverviewShell);
        host.active = false;
    }

    private _setOverviewMode(enabled: boolean): void {
        const classicNodes = [
            'BackgroundFull',
            'PortraitImage',
            'TopLeftInfo',
            'BottomLeftInfo',
            'RightContentAreaFill',
            'RightContentAreaBleed',
            'RightContentAreaFrame',
            'RightContentArea',
        ];

        for (const nodeName of classicNodes) {
            const node = this._getNode(nodeName);
            if (node) {
                node.active = !enabled;
            }
        }

        if (this._overviewShell) {
            this._overviewShell.node.active = enabled;
        }
    }

    private _populateUI(config: GeneralConfig): void {
        const overview = buildGeneralDetailOverview(config);
        // 設定左上角標題與基本資料 (TopLeftInfo)
        this._setLabel('TopLeftInfo/Content/TitleLabel', overview.header.title);
        this._setLabel('TopLeftInfo/Content/NameLabel', overview.header.name);
        this._setLabel(
            'TopLeftInfo/Content/MetaLabel',
            overview.header.meta
        );

        // 設定左下角戰鬥評級與精力 (BottomLeftInfo)
        const epSummary = config.ep !== undefined
            ? `${config.ep}${config.epRating ? ` · ${config.epRating}` : ''}`
            : '🔒 未揭露';
        const vitalityText = config.vitality !== undefined && config.maxVitality !== undefined
            ? `${config.vitality} / ${config.maxVitality}`
            : '🔒 未知';

        this._setLabel('BottomLeftInfo/Content/EpCard/EpLabel', "戰場潛力評估");
        this._setLabel('BottomLeftInfo/Content/EpCard/EpValue', overview.summary.epValue);
        this._setLabel('BottomLeftInfo/Content/VitCard/VitLabel', "目前精力狀態");
        this._setLabel('BottomLeftInfo/Content/VitCard/VitValue', overview.summary.vitalityValue);

        // 分頁填值
        this._populateBasics(config);
        this._populateStats(config);
        this._populateBloodline(config);
        this._populateSkills(config);
        this._populateAptitude(config);
        this._populateExtended(config, config.currentHp ?? config.hp, config.currentSp ?? 0);
        this._populateAncestorTree(config);

        // 載入立繪
        const resId = config.id.replace(/-/g, '_');
        const portraitPath = `sprites/generals/${resId}_portrait`;
        this._loadPortrait(portraitPath);
    }

    private async _loadPortrait(path: string): Promise<void> {
        const fullPath = `PortraitImage`;
        const n = this._getNode(fullPath);
        if (!n) return;

        try {
            // 先嘗試透過資源服務載入
            let spriteFrame = await services().resource.loadSpriteFrame(path).catch(() => null);
            
            // 如果失敗，嘗試手動載入 Texture 並包裝成 SpriteFrame
            if (!spriteFrame) {
                const texPath = path.replace('/spriteFrame', '');
                spriteFrame = await new Promise<SpriteFrame>((resolve) => {
                    resources.load(texPath, Texture2D, (err, tex) => {
                        if (tex) {
                            const sf = new SpriteFrame();
                            sf.texture = tex;
                            resolve(sf);
                        } else {
                            resolve(null as any);
                        }
                    });
                });
            }

            if (spriteFrame) {
                const sprite = n.getComponent(Sprite) || n.addComponent(Sprite);
                sprite.spriteFrame = spriteFrame;
                sprite.color = Color.WHITE;
                sprite.sizeMode = Sprite.SizeMode.RAW; 
                
                const trans = n.getComponent(UITransform)!;
                trans.setAnchorPoint(0.5, 0); // 腳踩底部
            } else {
                console.warn(`[GeneralDetailPanel] 無法載入立繪: ${path}`);
            }
        } catch (e) {
            console.warn('[GeneralDetailPanel] 載入立繪發生例外:', e);
        }
    }

    private _populateBasics(config: GeneralConfig): void {
        this._setLabel('RightContentArea/TabBasics/UidValue', `UID：${config.id}`);
        this._setLabel('RightContentArea/TabBasics/NameValue', `名稱：${config.name}`);
        this._setLabel('RightContentArea/TabBasics/TitleValue', `稱號：${this._mask(config.title, '🔒 未定稱號')}`);
        this._setLabel('RightContentArea/TabBasics/TemplateValue', `模板 ID：${this._mask(config.templateId)}`);
        this._setLabel('RightContentArea/TabBasics/FactionValue', `陣營：${this._formatFaction(config.faction)}`);
        this._setLabel('RightContentArea/TabBasics/GenderValue', `性別：${this._mask(config.gender)}`);
        this._setLabel('RightContentArea/TabBasics/AgeValue', `年齡：${config.age !== undefined ? `${config.age} 歲` : '🔒 未公開'}`);
        this._setLabel('RightContentArea/TabBasics/RoleValue', `職能：${this._formatRole(config.role)}`);
        this._setLabel('RightContentArea/TabBasics/StatusValue', `狀態：${this._formatStatus(config.status)}`);
        this._setLabel('RightContentArea/TabBasics/LifespanValue', '天命值：🔒 未揭露');
        this._setLabel(
            'RightContentArea/TabBasics/VitalityValue',
            `精力：${config.vitality !== undefined && config.maxVitality !== undefined ? `${config.vitality}/${config.maxVitality}` : '🔒 未公開'}`
        );
        this._setLabel('RightContentArea/TabBasics/SourceValue', `來源：${this._mask(config.source, '未登錄')}`);
    }

    private _populateStats(config: GeneralConfig): void {
        const str = this._resolveStat(config, 'str');
        const int = this._resolveStat(config, 'int');
        const lea = this._resolveStat(config, 'lea');
        const pol = this._resolveStat(config, 'pol');
        const cha = this._resolveStat(config, 'cha');
        const luk = this._resolveStat(config, 'luk');

        this._setLabel('RightContentArea/TabStats/StrValue', `武力 STR：${this._formatStatValue(str)}`);
        this._setLabel('RightContentArea/TabStats/IntValue', `智力 INT：${this._formatStatValue(int)}`);
        this._setLabel('RightContentArea/TabStats/LeaValue', `統率 LEA：${this._formatStatValue(lea)}`);
        this._setLabel('RightContentArea/TabStats/PolValue', `政治 POL：${this._formatStatValue(pol)}`);
        this._setLabel('RightContentArea/TabStats/ChaValue', `魅力 CHA：${this._formatStatValue(cha)}`);
        this._setLabel('RightContentArea/TabStats/LukValue', `運氣 LUK：${this._formatStatValue(luk)}`);
        this._setLabel('RightContentArea/TabStats/StatsRoleValue', `定位評語：${this._buildRoleSummary(str, int, lea)}`);
    }

    private _populateBloodline(config: GeneralConfig): void {
        this._setLabel(
            'RightContentArea/TabBloodline/BloodlineSummaryCard/EpRatingValue',
            `爆發力評級：${config.ep !== undefined ? `${config.ep}${config.epRating ? ` · ${config.epRating}` : ''}` : '🔒 未公開'}`
        );
        this._setLabel('RightContentArea/TabBloodline/BloodlineSummaryCard/BloodlineValue', `血統 ID：${this._mask(config.bloodlineId)}`);
        this._setLabel('RightContentArea/TabBloodline/BloodlineSummaryCard/ParentsValue', `父母摘要：${this._mask(config.parentsSummary, '🔒 尚未展開父母資料')}`);
        this._setLabel('RightContentArea/TabBloodline/BloodlineSummaryCard/AncestorsValue', `14 人矩陣：${this._mask(config.ancestorsSummary, '🔒 點擊展開後顯示完整血統矩陣')}`);

        for (let index = 0; index < 5; index++) {
            const gene = config.genes?.[index];
            this._setLabel(
                `RightContentArea/TabBloodline/GeneListCard/Gene${index + 1}Value`,
                this._formatGene(index + 1, gene)
            );
        }

        this._setLabel('RightContentArea/TabBloodline/AwakeningCard/AwakeningValue', `覺醒名號：${this._mask(config.awakeningTitle, '🔒 待覺醒')}`);
    }

    private _populateAncestorTree(config: GeneralConfig): void {
        const tree = (config as any).ancestorTree;
        if (!tree) return;

        const basePath = 'RightContentArea/TabBloodline/AncestorTree/';

        // Gen 1 (8人)
        for (let i = 0; i < 8; i++) {
            const node = tree.gen1[i];
            this._setLabel(`${basePath}Gen1Container/G1_${i}/Txt`, node ? `${node.name}\n(${node.gene.displayName})` : '—');
        }

        // Gen 2 (4人)
        for (let i = 0; i < 4; i++) {
            const node = tree.gen2[i];
            this._setLabel(`${basePath}Gen2Container/G2_${i}/Txt`, node ? `${node.name}\n(${node.gene.displayName})` : '—');
        }

        // Gen 3 (2人)
        for (let i = 0; i < 2; i++) {
            const node = tree.gen3[i];
            this._setLabel(`${basePath}Gen3Container/G3_${i}/Txt`, node ? `${node.name}\n(${node.gene.displayName})` : '—');
        }
    }

    private _populateSkills(config: GeneralConfig): void {
        this._setLabel(
            'RightContentArea/TabSkills/PrimarySkillCard/PrimarySkillValue',
            `主戰法：${SKILL_DISPLAY_NAME[config.skillId!] ?? config.skillId ?? '🔒 未配置'}`
        );
        this._setLabel(
            'RightContentArea/TabSkills/LearnedSkillsCard/LearnedSkillsValue',
            `已習得戰法：\n${this._formatList(config.learnedTactics, '🔒 尚無已登錄戰法')}`
        );
        this._setLabel(
            'RightContentArea/TabSkills/InspiredSkillsCard/InspiredSkillsValue',
            `可啟發戰法：\n${this._formatList(config.inspiredTactics, '🔒 需教官啟發')}`
        );
        this._setLabel(
            'RightContentArea/TabSkills/LockedSkillsCard/LockedSkillsValue',
            `未公開戰法：\n${this._formatList(config.lockedTactics, '🔒 因子不符或條件未滿')}`
        );
        if (config.id === 'zhao-yun') {
            this._setLabel(
                'RightContentArea/TabSkills/SkillNoteCard/SkillNoteValue',
                '【趙雲演示】點擊此處演示技能「龍魂突刺」！'
            );
            this._bindClick('RightContentArea/TabSkills/SkillNoteCard/SkillNoteValue', () => {
                console.log(`[GeneralDetailPanel] Playing skill action: zhao-yun-pierce`);
                services().action.playSkill('zhao-yun-pierce', {
                    casterUnitId: config.id,
                    casterPos: { x: 0, y: 0, z: 0 },
                    casterNode: this.node,
                    targetUnitIds: ['dummy-target'],
                    targetPositions: [{ x: 500, y: 0, z: 0 }]
                });
            });
        } else {
            this._setLabel(
                'RightContentArea/TabSkills/SkillNoteCard/SkillNoteValue',
                '狀態規則：已習得 = 彩色卡、可啟發 = 半透明鎖定、未公開 = 灰階鎖定。'
            );
        }
    }

    private _populateAptitude(config: GeneralConfig): void {
        this._setLabel(
            'RightContentArea/TabAptitude/TroopCard/TroopValue',
            `兵種適性：\n${this._formatAptitudeMap(config.troopAptitude, ['CAVALRY', 'INFANTRY', 'ARCHER', 'SIEGE'], {
                CAVALRY: '騎兵',
                INFANTRY: '步兵',
                ARCHER: '弓兵',
                SIEGE: '機械',
            })}`
        );
        this._setLabel(
            'RightContentArea/TabAptitude/TerrainCard/TerrainValue',
            `地形適性：\n${this._formatAptitudeMap(config.terrainAptitude, ['PLAIN', 'MOUNTAIN', 'WATER', 'FOREST', 'DESERT'], {
                PLAIN: '平原',
                MOUNTAIN: '山地',
                WATER: '水域',
                FOREST: '林地',
                DESERT: '沙漠',
            })}`
        );
        this._setLabel(
            'RightContentArea/TabAptitude/WeatherCard/WeatherValue',
            `天氣適性：\n${this._formatAptitudeMap(config.weatherAptitude, ['SUNNY', 'RAINY', 'FOG', 'WINDY', 'NIGHT', 'THUNDER'], {
                SUNNY: '晴天',
                RAINY: '雨天',
                FOG: '大霧',
                WINDY: '大風',
                NIGHT: '夜戰',
                THUNDER: '雷暴',
            })}`
        );
        this._setLabel(
            'RightContentArea/TabAptitude/TerrainSummaryCard/PreferredTerrainValue',
            `擅長地形：${config.preferredTerrain ? (TERRAIN_DISPLAY[config.preferredTerrain] ?? this._mask(config.preferredTerrain)) : '🔒 未公開'}`
        );
        this._setLabel(
            'RightContentArea/TabAptitude/TerrainSummaryCard/TerrainBonusValue',
            `地形防禦加成：+${Math.floor((config.terrainDefenseBonus ?? 0) * 100)}%`
        );
    }

    private _populateExtended(config: GeneralConfig, currentHp: number, currentSp: number): void {
        this._setLabel('RightContentArea/TabExtended/CurrentHpValue', `目前 HP：${currentHp}/${config.hp}`);
        this._setLabel('RightContentArea/TabExtended/CurrentSpValue', `目前 SP：${currentSp}/${config.maxSp}`);
        this._setLabel('RightContentArea/TabExtended/AttackBonusValue', `攻擊加成：+${Math.floor((config.attackBonus ?? 0) * 100)}%`);
        this._setLabel(
            'RightContentArea/TabExtended/HiddenFlagsValue',
            `隱藏欄位：\n${this._formatList(config.hiddenFlags, '🔒 天命值 / 完整祖譜 / 隱藏戰法')}`
        );
        this._setLabel('RightContentArea/TabExtended/NotesValue', `備註：${this._mask(config.notes, '尚無額外備註')}`);
        this._setLabel('RightContentArea/TabExtended/DevNoteValue', `開發備註：${this._mask(config.devNote, '此頁目前為可直接接線的 UI 草案')}`);
    }

    private _resolveStat(config: GeneralConfig, key: keyof GeneralStatsConfig): number | undefined {
        const nestedValue = config.stats?.[key];
        if (nestedValue !== undefined) {
            return nestedValue;
        }
        return config[key as keyof GeneralConfig] as number | undefined;
    }

    private _formatStatValue(value: number | undefined): string {
        return value !== undefined ? `${value}` : '🔒 未公開';
    }

    private _buildRoleSummary(str?: number, int?: number, lea?: number): string {
        const values = [
            { key: '武力型', value: str ?? -1 },
            { key: '謀略型', value: int ?? -1 },
            { key: '統率型', value: lea ?? -1 },
        ].sort((left, right) => right.value - left.value);

        return values[0].value >= 0 ? values[0].key : '🔒 尚未判定';
    }

    private _formatGene(slotIndex: number, gene?: GeneralGeneConfig): string {
        if (!gene) {
            return `因子槽 ${slotIndex}：🔒 未知因子`;
        }
        if (gene.isLocked) {
            const discoveryLevel = gene.discoveryLevel !== undefined ? `（發現等級 ${gene.discoveryLevel}）` : '';
            return `因子槽 ${slotIndex}：🔒 ${gene.displayName ?? gene.id ?? '未知因子'}${discoveryLevel}`;
        }

        const parts = [
            gene.displayName ?? gene.id ?? `因子 ${slotIndex}`,
            gene.type ? `[${gene.type}]` : '',
            gene.level !== undefined ? `★${gene.level}` : '',
            gene.description ?? '',
        ].filter(Boolean);

        return `因子槽 ${slotIndex}：${parts.join(' ')}`;
    }

    private _formatList(values: string[] | undefined, fallback: string): string {
        if (!values || values.length === 0) {
            return fallback;
        }
        return values.map((value) => `• ${value}`).join('\n');
    }

    private _formatAptitudeMap(
        values: Record<string, string> | undefined,
        keys: string[],
        labels: Record<string, string>
    ): string {
        if (!values) {
            return '🔒 尚未建立適性資料';
        }

        return keys.map((key) => `${labels[key]}：${values[key] ?? '🔒'}`).join('\n');
    }

    private _formatFaction(faction: string | undefined): string {
        if (!faction) return '🔒 未公開';
        return FACTION_DISPLAY[faction] ?? faction;
    }

    private _formatRole(role: string | undefined): string {
        if (!role) return '🔒 未分流';
        return ROLE_DISPLAY[role] ?? role;
    }

    private _formatStatus(status: string | undefined): string {
        if (!status) return '🔒 未公開';
        return STATUS_DISPLAY[status] ?? status;
    }

    private _mask(value: string | number | undefined, fallback = '🔒 未公開'): string {
        return value !== undefined && value !== '' ? `${value}` : fallback;
    }

    private _buildSkillSummary(config: GeneralConfig, currentSp: number): string {
        if (!config.skillId) {
            return '未配置';
        }

        if (currentSp >= config.maxSp) {
            return '可發動';
        }

        return `未就緒 ${currentSp}/${config.maxSp}`;
    }

    private _syncReservedFooterActions(): void {
        for (const actionName of RESERVED_FOOTER_ACTIONS) {
            const node = this._getNode(`RightContentArea/FooterPanel/${actionName}`);
            if (!node) continue;

            const button = node.getComponent(Button) || node.addComponent(Button);
            button.interactable = false;
            node.active = false;
        }
    }

    private _bindClick(path: string, handler: () => void): void {
        const node = this._getNode(path);
        if (!node) return;

        const button = node.getComponent(Button) || node.addComponent(Button);
        button.node.off(Button.EventType.CLICK);
        button.node.on(Button.EventType.CLICK, handler, this);
    }

    private _getNode(path: string): Node | null {
        return this.node.getChildByPath(`GeneralDetailRoot/${path}`);
    }

    private _setLabel(path: string, text: string): void {
        const node = this._getNode(path);
        if (!node) return;
        const label = node.getComponent(Label);
        if (label) {
            label.string = text;
        }
    }
}
