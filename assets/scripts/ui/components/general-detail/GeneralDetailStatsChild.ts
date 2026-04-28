/**
 * GeneralDetailStatsChild
 *
 * UCUF M4 ChildPanel — 屬性 Tab（Stats）。
 * 對應 fragment: gd-tab-stats.json
 * dataSource: 'config'
 */
import { Color, Label, Node, Sprite, UITransform } from 'cc';
import { ChildPanelBase } from '../../core/ChildPanelBase';
import { SolidBackground } from '../../components/SolidBackground';
import type { UISkinResolver } from '../../core/UISkinResolver';
import type { UITemplateBinder } from '../../core/UITemplateBinder';
import type { GeneralConfig, GeneralStatsConfig } from '../../../core/models/GeneralUnit';
import { resolveStat } from './GeneralDetailFormatters';
import { UCUFLogger, LogCategory } from '../../core/UCUFLogger';
import { services } from '../../../core/managers/ServiceLoader';

type StatKey = keyof GeneralStatsConfig;

interface StatRowDefinition {
    key: StatKey;
    rowName: string;
    chineseLabel: string;
    englishLabel: string;
    colorToken: string;
}

interface StatRowBinding {
    label: Label;
    english: Label;
    talent: Label;
    arrow: Label;
    prowess: Label;
    barFill: Node;
}

interface VitalBinding {
    value: Label;
    max: Label;
    barFill: Node;
}

const STAT_DEFS: StatRowDefinition[] = [
    { key: 'str', rowName: 'StrRow', chineseLabel: '武力', englishLabel: 'STR', colorToken: 'gdv3StatStr' },
    { key: 'int', rowName: 'IntRow', chineseLabel: '智力', englishLabel: 'INT', colorToken: 'gdv3StatInt' },
    { key: 'lea', rowName: 'LeaRow', chineseLabel: '統率', englishLabel: 'LEA', colorToken: 'gdv3StatLea' },
    { key: 'pol', rowName: 'PolRow', chineseLabel: '政治', englishLabel: 'POL', colorToken: 'gdv3StatPol' },
    { key: 'cha', rowName: 'ChaRow', chineseLabel: '魅力', englishLabel: 'CHA', colorToken: 'gdv3StatCha' },
    { key: 'luk', rowName: 'LukRow', chineseLabel: '運氣', englishLabel: 'LUK', colorToken: 'gdv3StatLuk' },
];

export class GeneralDetailStatsChild extends ChildPanelBase {
    override dataSource = 'config';
    private static readonly ROOT_PATH = 'TabStatsContent';

    private _radarChartNode: Node | null = null;
    private _statRows: StatRowBinding[] = [];
    private _hp!: VitalBinding;
    private _sp!: VitalBinding;
    private _vitality!: VitalBinding;
    private _lProfileAge!: Label;
    private _lProfileLevel!: Label;
    private _lProfileStatus!: Label;
    private _lProfileVitality!: Label;
    private _lTotalRankBadge!: Label;
    private _lTotalRankText!: Label;
    private _tokenColors: Record<string, string> = {};
    private _metrics = {
        radarSize: 90,
        radarAxisLabelRadiusOffset: 22,
        radarAxisLabelOffsetY: 5,
        radarGridRings: 4,
        radarGridLineWidth: 0.7,
        radarAxisLineWidth: 0.7,
        radarOutlineWidth: 2,
        radarMarkerRadius: 4,
        radarFillOpacity: 0.18,
        statBarMaxWidth: 260,
        statBarHeight: 8,
        statBarFillAlpha: 232,
        vitalBarMaxWidth: 149,
        vitalBarHeight: 10,
        prowessScaleFactor: 17,
    };

    _lastData: GeneralConfig | null = null;

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    async onMount(_spec: Record<string, unknown>): Promise<void> {
        const h = this.hostNode;
        await this._loadTokenColors();
        this._radarChartNode = this._node(h, 'StatsOverviewRow/RadarSummaryCard/RadarGlyphFrame');
        this._disableLegacyRadarGlyphLabels(h);
        this._statRows = STAT_DEFS.map((def) => this._bindStatRow(h, def.rowName));
        this._hp = this._bindVital(h, 'HpCard', 'Hp');
        this._sp = this._bindVital(h, 'SpCard', 'Sp');
        this._vitality = this._bindVital(h, 'VitalityCard', 'Vitality');
        this._lProfileAge = this._label(h, 'ProfileRowTop/ProfileAgeCard/ProfileAgeValue');
        this._lProfileLevel = this._label(h, 'ProfileRowTop/ProfileLevelCard/ProfileLevelValue');
        this._lProfileStatus = this._label(h, 'ProfileRowBottom/ProfileStatusCard/ProfileStatusValue');
        this._lProfileVitality = this._label(h, 'ProfileRowBottom/ProfileVitalityCard/ProfileVitalityValue');
        this._lTotalRankBadge = this._label(h, 'StatsOverviewRow/StatsValueCard/TotalRankRow/RankBadge/RankBadgeValue');
        this._lTotalRankText = this._label(h, 'StatsOverviewRow/StatsValueCard/TotalRankRow/RankText');
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    onDataUpdate(data: unknown): void {
        this._lastData = data as GeneralConfig;
        const cfg = this._lastData;
        this._syncRadar(cfg);
        this._syncStatsRows(cfg);
        const currentHp = cfg.currentHp ?? cfg.hp;
        const maxHp = cfg.hp;
        const currentSp = cfg.currentSp ?? cfg.initialSp ?? cfg.maxSp ?? 0;
        const maxSp = cfg.maxSp ?? currentSp;
        const vitality = cfg.vitality ?? cfg.maxVitality ?? 0;
        const maxVitality = cfg.maxVitality ?? cfg.vitality ?? 0;
        const levelValue = typeof (cfg as { level?: unknown }).level === 'number'
            ? (cfg as { level?: number }).level ?? null
            : null;
        const maxLevelValue = typeof (cfg as { maxLevel?: unknown }).maxLevel === 'number'
            ? (cfg as { maxLevel?: number }).maxLevel ?? null
            : null;
        const unlocked = this.t('ui.general.basics.unlocked');
        const ageUnit = this.t('ui.general.basics.age_unit');

        this._syncVital(this._hp, currentHp, maxHp, this._tokenColor('gdv3StatLea'));
        this._syncVital(this._sp, currentSp, maxSp, this._tokenColor('gdv3StatStr'));
        this._syncVital(this._vitality, vitality, maxVitality, this._tokenColor('accent.gold.light'));
        this._set(this._lProfileAge, cfg.age != null ? `${cfg.age}${ageUnit}` : unlocked);
        this._set(this._lProfileLevel, levelValue != null
            ? `${levelValue}${maxLevelValue != null ? ` / ${maxLevelValue}` : ''}`
            : unlocked);
        this._set(this._lProfileStatus, cfg.status?.trim() ? cfg.status : unlocked);
        this._set(this._lProfileVitality, this._formatPair(vitality, maxVitality));
        this._syncTotalRank(cfg);
    }

    protected override _refreshLabels(): void {
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    validateDataFormat(data: unknown): string | null {
        if (!data || typeof data !== 'object') return 'data must be a GeneralConfig object';
        return null;
    }

    private _bindStatRow(root: Node, rowName: string): StatRowBinding {
        const basePath = `StatsOverviewRow/StatsValueCard/${rowName}`;
        return {
            label: this._label(root, `${basePath}/StatLabel`),
            english: this._label(root, `${basePath}/StatEn`),
            talent: this._label(root, `${basePath}/StatTalentBadge/StatTalentValue`),
            arrow: this._label(root, `${basePath}/StatArrow`),
            prowess: this._label(root, `${basePath}/StatProwess`),
            barFill: this._node(root, `${basePath}/StatBarFill`),
        };
    }

    private _bindVital(root: Node, cardName: string, prefix: string): VitalBinding {
        const basePath = `VitalsRow/${cardName}`;
        return {
            value: this._label(root, `${basePath}/${prefix}Value`),
            max: this._label(root, `${basePath}/${prefix}MaxValue`),
            barFill: this._node(root, `${basePath}/${prefix}BarFill`),
        };
    }

    private async _syncRadar(cfg: GeneralConfig): Promise<void> {
        if (!this._radarChartNode || !this._services.renderer) {
            return;
        }

        const axes = STAT_DEFS.map((def) => def.chineseLabel);
        const values = STAT_DEFS.map((def) => {
            const stat = cfg.dualLayerStats?.[def.key];
            const talentCurrent = stat?.current ?? stat?.base ?? resolveStat(cfg, def.key) ?? 0;
            return Math.max(0, Math.min(1, talentCurrent / 100));
        });

        const chartConfig = {
            axes,
            layers: [
                {
                    values,
                    label: '資質',
                    color: this._tokenColor('accent.jade.crest'),
                    opacity: this._metrics.radarFillOpacity,
                },
            ],
            size: this._metrics.radarSize,
            gridColor: this._tokenColor('gdv3RadarGrid'),
            labelFontSize: 13,
            axisLabelColors: STAT_DEFS.map((def) => this._tokenColor(def.colorToken)),
            axisLabelRadius: this._metrics.radarSize + this._metrics.radarAxisLabelRadiusOffset,
            axisLabelOffsetY: this._metrics.radarAxisLabelOffsetY,
            showAxisLabels: true,
            gridRings: this._metrics.radarGridRings,
            gridLineWidth: this._metrics.radarGridLineWidth,
            axisLineWidth: this._metrics.radarAxisLineWidth,
            outlineWidth: this._metrics.radarOutlineWidth,
            markerColors: STAT_DEFS.map((def) => this._tokenColor(def.colorToken)),
            markerRadius: this._metrics.radarMarkerRadius,
        };

        this._normalizeRadarChartNode();

        if ((this._radarChartNode as Node & { __statsRadar?: boolean }).__statsRadar) {
            this._services.renderer.updateRadarChart(this._radarChartNode, chartConfig);
            this._placeRadarLayer();
            return;
        }

        const chartNode = await this._services.renderer.drawRadarChart(this._radarChartNode, chartConfig);
        this._radarChartNode = chartNode as Node;
        (this._radarChartNode as Node & { __statsRadar?: boolean }).__statsRadar = true;
        this._placeRadarLayer();
    }

    private _normalizeRadarChartNode(): void {
        const node = this._radarChartNode;
        if (!node) return;

        if ((node as Node & { __statsRadar?: boolean }).__statsRadar) {
            return;
        }

        const charts = node.children.filter((child) => child.name === 'RadarChart');
        if (charts.length === 0) {
            return;
        }

        const keep = charts[0];
        for (let i = 1; i < charts.length; i++) {
            charts[i].destroy();
        }

        this._radarChartNode = keep;
        (this._radarChartNode as Node & { __statsRadar?: boolean }).__statsRadar = true;
    }

    private _placeRadarLayer(): void {
        const radar = this._radarChartNode;
        const parent = radar?.parent;
        if (!radar || !parent) return;

        // Keep radar behind label texts to preserve readability while staying above panel background.
        radar.setSiblingIndex(0);
    }

    private _disableLegacyRadarGlyphLabels(root: Node): void {
        const legacyNames = [
            'RadarGlyphTop',
            'RadarGlyphLeftTop',
            'RadarGlyphRightTop',
            'RadarGlyphCenter',
            'RadarGlyphLeftBottom',
            'RadarGlyphRightBottom',
            'RadarGlyphBottom',
        ];

        const candidateBases = [
            `${GeneralDetailStatsChild.ROOT_PATH}/StatsOverviewRow/RadarSummaryCard/RadarGlyphFrame`,
            'StatsOverviewRow/RadarSummaryCard/RadarGlyphFrame',
        ];

        for (const name of legacyNames) {
            let node: Node | null = null;
            for (const basePath of candidateBases) {
                node = root.getChildByPath(`${basePath}/${name}`);
                if (node) break;
            }
            if (node) {
                node.active = false;
            }
        }
    }

    private _syncStatsRows(cfg: GeneralConfig): void {
        STAT_DEFS.forEach((def, index) => {
            const row = this._statRows[index];
            if (!row) return;

            const stat = cfg.dualLayerStats?.[def.key];
            const talentCurrent = stat?.current ?? stat?.base ?? resolveStat(cfg, def.key) ?? 0;
            // When no explicit prowess (dualLayerStats not populated), scale raw 0-100 stat to
            // the 0-2000 prowess range expected by the bar formula (HTML: prowess/20 as %).
            const prowess = stat?.prowess != null ? stat.prowess : Math.round(talentCurrent * this._metrics.prowessScaleFactor);

            this._setLabel(row.label, def.chineseLabel, this._tokenColor(def.colorToken));
            this._setLabel(row.english, def.englishLabel, this._tokenColor('gdv3TextMetaDim'));
            this._setLabel(row.talent, `${Math.round(talentCurrent)}`, this._tokenColor('accent.gold.light'));
            this._setLabel(row.arrow, '→', this._tokenColor('outline'));
            this._setLabel(row.prowess, prowess.toLocaleString(), this._tokenColor('gdv3NumProwess'));
            this._setBarWidth(
                row.barFill,
                Math.min(this._metrics.statBarMaxWidth, prowess / 20 * this._metrics.statBarMaxWidth / 100),
                this._tokenColor(def.colorToken),
                this._metrics.statBarHeight,
                this._metrics.statBarFillAlpha,
            );
        });
    }

    private _syncVital(binding: VitalBinding, value: number, max: number, colorHex: string): void {
        const safeValue = Math.max(0, Math.round(value));
        const safeMax = Math.max(0, Math.round(max));
        const ratio = safeMax > 0 ? Math.min(1, safeValue / safeMax) : 0;
        this._set(binding.value, safeValue.toLocaleString());
        this._set(binding.max, `/ ${safeMax.toLocaleString()}`);
        binding.value.color = this._hexToColor(this._tokenColor('accent.gold.light'));
        binding.max.color = this._hexToColor(this._tokenColor('gdv3TextMetaDim'));
        this._setBarWidth(binding.barFill, ratio * this._metrics.vitalBarMaxWidth, colorHex, this._metrics.vitalBarHeight);
    }

    private async _loadTokenColors(): Promise<void> {
        const designTokens = await services().specLoader.loadDesignTokens() as {
            colors?: Record<string, string>;
            generalDetailStats?: Partial<typeof this._metrics>;
        };
        const colors = designTokens?.colors;
        if (!colors || typeof colors !== 'object') {
            UCUFLogger.error(LogCategory.DATA, '[StatsChild] design tokens 缺少 colors 區段');
            throw new Error('[StatsChild] design tokens 缺少 colors 區段');
        }
        this._tokenColors = colors;

        const statsMetrics = designTokens?.generalDetailStats;
        if (!statsMetrics || typeof statsMetrics !== 'object') {
            UCUFLogger.error(LogCategory.DATA, '[StatsChild] design tokens 缺少 generalDetailStats 區段');
            throw new Error('[StatsChild] design tokens 缺少 generalDetailStats 區段');
        }
        this._metrics = { ...this._metrics, ...statsMetrics };
    }

    private _tokenColor(tokenKey: string): string {
        const color = this._tokenColors[tokenKey];
        if (!color) {
            UCUFLogger.error(LogCategory.DATA, `[StatsChild] design token 缺失 color=${tokenKey}`);
            throw new Error(`[StatsChild] design token 缺失 color=${tokenKey}`);
        }
        return color;
    }

    private _syncTotalRank(cfg: GeneralConfig): void {
        const rankRaw = (cfg as { prowessRank?: unknown }).prowessRank;
        const rank = typeof rankRaw === 'string' && rankRaw.trim().length > 0
            ? rankRaw.trim().toUpperCase()
            : typeof rankRaw === 'number'
                ? `${Math.round(rankRaw)}`
                : 'A';

        this._set(this._lTotalRankBadge, rank);
        this._set(this._lTotalRankText, '良才美質');
    }

    private _setLabel(label: Label, text: string, colorHex?: string): void {
        label.string = text;
        if (colorHex) {
            label.color = this._hexToColor(colorHex);
        }
    }

    private _setBarWidth(node: Node, width: number, colorHex: string, height = 8, alpha = 255): void {
        const ut = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        ut.setContentSize(Math.max(0, Math.round(width)), height);
        const color = this._hexToColor(colorHex);
        color.a = Math.max(0, Math.min(255, Math.round(alpha)));

        const sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.color = color;
            return;
        }

        const solidBackground = node.getComponent(SolidBackground);
        if (solidBackground) {
            solidBackground.color = color;
        }
    }

    private _node(root: Node, name: string): Node {
        const fullPath = `${GeneralDetailStatsChild.ROOT_PATH}/${name}`;
        const node = root.getChildByPath(fullPath);
        if (!node) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[StatsChild] 必要 Node 缺失 ${fullPath}`);
            throw new Error(`[StatsChild] 必要 Node 缺失 ${fullPath}`);
        }
        return node;
    }

    private _hexToColor(hex: string): Color {
        const raw = hex.replace('#', '');
        const r = parseInt(raw.slice(0, 2), 16);
        const g = parseInt(raw.slice(2, 4), 16);
        const b = parseInt(raw.slice(4, 6), 16);
        const a = raw.length >= 8 ? parseInt(raw.slice(6, 8), 16) : 255;
        return new Color(r, g, b, a);
    }

    private _label(root: Node, name: string): Label {
        const fullPath = `${GeneralDetailStatsChild.ROOT_PATH}/${name}`;
        const label = root.getChildByPath(fullPath)?.getComponent(Label);
        if (!label) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[StatsChild] 必要 Label 缺失 ${fullPath}`);
            throw new Error(`[StatsChild] 必要 Label 缺失 ${fullPath}`);
        }
        return label;
    }

    private _set(label: Label | null, text: string): void {
        if (label) label.string = text;
    }

    private _formatPair(value: number | null | undefined, max: number | null | undefined): string {
        if (value == null && max == null) return this.t('ui.general.basics.unlocked');
        const resolvedValue = value ?? max ?? 0;
        const resolvedMax = max ?? value ?? 0;
        return `${resolvedValue} / ${resolvedMax}`;
    }
}
