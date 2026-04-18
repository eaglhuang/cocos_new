/**
 * GeneralDetailAptitudeChild
 *
 * UCUF M4 ChildPanel — 適性 Tab（Aptitude）。
 * 對應 fragment: gd-tab-aptitude.json
 * dataSource: 'config'
 */
import { Label } from 'cc';
import type { Node } from 'cc';
import { ChildPanelBase } from '../../core/ChildPanelBase';
import type { UISkinResolver } from '../../core/UISkinResolver';
import type { UITemplateBinder } from '../../core/UITemplateBinder';
import type { GeneralConfig } from '../../../core/models/GeneralUnit';
import { formatAptitudeMap, TERRAIN_DISPLAY, mask } from './GeneralDetailFormatters';
import { UCUFLogger, LogCategory } from '../../core/UCUFLogger';

export class GeneralDetailAptitudeChild extends ChildPanelBase {
    override dataSource = 'config';
    private static readonly ROOT_PATH = 'TabAptitudeContent';

    private _lTroop!:    Label;
    private _lTerrain!:  Label;
    private _lWeather!:  Label;
    private _lPrefTerr!: Label;
    private _lBonus!:    Label;

    _lastData: GeneralConfig | null = null;

    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {
        super(hostNode, skinResolver, binder);
    }

    async onMount(_spec: Record<string, unknown>): Promise<void> {
        const h = this.hostNode;
        this._lTroop    = this._label(h, 'TroopCard/TroopValue');
        this._lTerrain  = this._label(h, 'TerrainCard/TerrainValue');
        this._lWeather  = this._label(h, 'WeatherCard/WeatherValue');
        this._lPrefTerr = this._label(h, 'TerrainSummaryCard/PreferredTerrainValue');
        this._lBonus    = this._label(h, 'TerrainSummaryCard/TerrainBonusValue');
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    onDataUpdate(data: unknown): void {
        this._lastData = data as GeneralConfig;
        const cfg = this._lastData;

        this._set(this._lTroop,
            `${this.t('ui.general.aptitude.troop')}\n${formatAptitudeMap(cfg.troopAptitude, ['CAVALRY', 'INFANTRY', 'ARCHER', 'SIEGE'], {
                CAVALRY:  this.t('ui.general.aptitude.troop_cavalry'),
                INFANTRY: this.t('ui.general.aptitude.troop_infantry'),
                ARCHER:   this.t('ui.general.aptitude.troop_archer'),
                SIEGE:    this.t('ui.general.aptitude.troop_siege'),
            })}`
        );
        this._set(this._lTerrain,
            `${this.t('ui.general.aptitude.terrain')}\n${formatAptitudeMap(cfg.terrainAptitude, ['PLAIN', 'MOUNTAIN', 'WATER', 'FOREST', 'DESERT'], {
                PLAIN:    this.t('ui.general.aptitude.terrain_plain'),
                MOUNTAIN: this.t('ui.general.aptitude.terrain_mountain'),
                WATER:    this.t('ui.general.aptitude.terrain_water'),
                FOREST:   this.t('ui.general.aptitude.terrain_forest'),
                DESERT:   this.t('ui.general.aptitude.terrain_desert'),
            })}`
        );
        this._set(this._lWeather,
            `${this.t('ui.general.aptitude.weather')}\n${formatAptitudeMap(cfg.weatherAptitude, ['SUNNY', 'RAINY', 'FOG', 'WINDY', 'NIGHT', 'THUNDER'], {
                SUNNY:   this.t('ui.general.aptitude.weather_sunny'),
                RAINY:   this.t('ui.general.aptitude.weather_rainy'),
                FOG:     this.t('ui.general.aptitude.weather_fog'),
                WINDY:   this.t('ui.general.aptitude.weather_windy'),
                NIGHT:   this.t('ui.general.aptitude.weather_night'),
                THUNDER: this.t('ui.general.aptitude.weather_thunder'),
            })}`
        );
        this._set(this._lPrefTerr,
            `${this.t('ui.general.aptitude.pref_terrain')}${cfg.preferredTerrain ? (TERRAIN_DISPLAY[cfg.preferredTerrain] ?? mask(cfg.preferredTerrain)) : this.t('ui.general.basics.unlocked')}`
        );
        this._set(this._lBonus,
            `${this.t('ui.general.aptitude.terrain_defense')}+${Math.floor((cfg.terrainDefenseBonus ?? 0) * 100)}%`
        );
    }

    protected override _refreshLabels(): void {
        if (this._lastData) this.onDataUpdate(this._lastData);
    }

    validateDataFormat(data: unknown): string | null {
        if (!data || typeof data !== 'object') return 'data must be a GeneralConfig object';
        return null;
    }

    private _label(root: Node, path: string): Label {
        const fullPath = `${GeneralDetailAptitudeChild.ROOT_PATH}/${path}`;
        const label = root.getChildByPath(fullPath)?.getComponent(Label);
        if (!label) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[AptitudeChild] 必要 Label 缺失 ${fullPath}`);
            throw new Error(`[AptitudeChild] 必要 Label 缺失 ${fullPath}`);
        }
        return label;
    }

    private _set(label: Label | null, text: string): void {
        if (label) label.string = text;
    }
}
