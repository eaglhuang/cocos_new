import { sys } from 'cc';
import type { GeneralConfig, GeneralDetailRarityTier } from '../models/GeneralUnit';
import { Faction } from '../config/Constants';
import { services } from '../managers/ServiceLoader';
import { SyncActionType } from '../systems/SyncManager';
import { ActionLogStore, type GachaActionType, type GachaCurrencyKey, type GachaHistoryRecord } from './ActionLogStore';

export interface LocalGachaRollOptions {
    factionFilter?: 'all' | 'player' | 'enemy';
}

export interface LocalGachaResultEntry {
    general: GeneralConfig;
    rarityTier: GeneralDetailRarityTier;
    drawIndex: number;
    displayText: string;
    poolId: string;
    actionType: GachaActionType;
    currencyKey: GachaCurrencyKey;
}

export interface LocalGachaWalletSnapshot {
    gems: number;
    gold: number;
    tickets: number;
}

interface PerformGachaRequest {
    actionType: GachaActionType;
    poolId: string;
    drawCount: number;
    cost: number;
    currencyKey: GachaCurrencyKey;
    generals: GeneralConfig[];
    options?: LocalGachaRollOptions;
}

const SINGLE_PLAYER_MODE_KEY = 'ucuf.gacha.single-player-mode';
const WALLET_STORAGE_KEY = 'ucuf.gacha.wallet.v1';
const DEFAULT_WALLET: LocalGachaWalletSnapshot = {
    gems: 1280,
    gold: 128450,
    tickets: 12,
};

function cloneGeneral(general: GeneralConfig): GeneralConfig {
    try {
        return JSON.parse(JSON.stringify(general)) as GeneralConfig;
    } catch {
        return { ...general };
    }
}

function normalizeCount(value: number): number {
    return Math.max(1, Math.floor(Number.isFinite(value) ? value : 1));
}

function normalizeCost(value: number): number {
    const resolved = Math.floor(Number.isFinite(value) ? value : 0);
    return Math.max(0, resolved);
}

function normalizeWalletValue(value: unknown, fallback: number): number {
    const resolved = Math.floor(Number(value));
    if (!Number.isFinite(resolved)) {
        return fallback;
    }
    return Math.max(0, resolved);
}

function inferRarityTier(general: GeneralConfig): GeneralDetailRarityTier {
    const explicit = general.rarityTier;
    if (explicit) {
        return explicit;
    }

    switch (general.characterCategory) {
        case 'mythical':
            return 'mythic';
        case 'titled':
            return 'legendary';
        case 'famed':
            return 'epic';
        case 'general':
            return 'rare';
        case 'civilian':
        default:
            return 'common';
    }
}

function formatDrawResultText(index: number, general: GeneralConfig, rarityTier: GeneralDetailRarityTier): string {
    return `#${index + 1} [${rarityTier}] ${general.name}`;
}

function compareWeight(left: { weight: number }, right: { weight: number }): number {
    return right.weight - left.weight;
}

export class LocalGachaService {
    private readonly _actionLogStore = ActionLogStore.getInstance();
    private _singlePlayerModeEnabled = this._loadSinglePlayerModeEnabled();
    private _wallet = this._loadWalletSnapshot();

    public isSinglePlayerModeEnabled(): boolean {
        return this._singlePlayerModeEnabled;
    }

    public toggleSinglePlayerModeEnabled(): boolean {
        this._singlePlayerModeEnabled = !this._singlePlayerModeEnabled;
        this._persistSinglePlayerModeEnabled();
        return this._singlePlayerModeEnabled;
    }

    public setSinglePlayerModeEnabled(enabled: boolean): void {
        this._singlePlayerModeEnabled = !!enabled;
        this._persistSinglePlayerModeEnabled();
    }

    public getWalletSnapshot(): LocalGachaWalletSnapshot {
        return { ...this._wallet };
    }

    public getCurrencyAmount(currencyKey: GachaCurrencyKey): number {
        return this._wallet[currencyKey];
    }

    public grantCurrency(currencyKey: GachaCurrencyKey, amount: number): number {
        const resolvedAmount = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
        if (resolvedAmount <= 0) {
            return this._wallet[currencyKey];
        }

        this._wallet[currencyKey] = Math.max(0, this._wallet[currencyKey] + resolvedAmount);
        this._persistWalletSnapshot();
        return this._wallet[currencyKey];
    }

    public async getRecentPullHistory(limit: number): Promise<{ total: number; records: GachaHistoryRecord[] }> {
        return this._actionLogStore.getRecentGachaHistory(limit);
    }

    public async performLocalGacha(
        poolId: string,
        drawCount: number,
        cost: number,
        generals: GeneralConfig[],
        options: LocalGachaRollOptions = {},
    ): Promise<LocalGachaResultEntry[]> {
        return this._performGacha({
            actionType: 'LOCAL_GACHA_PULL',
            poolId,
            drawCount,
            cost,
            currencyKey: 'gems',
            generals,
            options,
        });
    }

    public async performGoldSummon(
        drawCount: number,
        generals: GeneralConfig[],
        options: LocalGachaRollOptions = {},
    ): Promise<LocalGachaResultEntry[]> {
        const resolvedCount = normalizeCount(drawCount);
        return this._performGacha({
            actionType: 'LOCAL_GOLD_SUMMON',
            poolId: 'GENERAL_STANDARD_01',
            drawCount: resolvedCount,
            cost: 500 * resolvedCount,
            currencyKey: 'gold',
            generals,
            options,
        });
    }

    public async performTicketSummon(
        drawCount: number,
        generals: GeneralConfig[],
        options: LocalGachaRollOptions = {},
    ): Promise<LocalGachaResultEntry[]> {
        const resolvedCount = normalizeCount(drawCount);
        return this._performGacha({
            actionType: 'LOCAL_TICKET_SUMMON',
            poolId: 'GENERAL_STANDARD_01',
            drawCount: resolvedCount,
            cost: resolvedCount,
            currencyKey: 'tickets',
            generals,
            options,
        });
    }

    private async _performGacha(request: PerformGachaRequest): Promise<LocalGachaResultEntry[]> {
        const drawCount = normalizeCount(request.drawCount);
        const cost = normalizeCost(request.cost);
        const candidates = this._filterCandidates(request.generals, request.options?.factionFilter);

        if (candidates.length === 0) {
            throw new Error('[LocalGachaService] 沒有可用的武將資料。');
        }

        this._assertSufficientCurrency(request.currencyKey, cost);

        const weightedCandidates = candidates.map((general) => ({
            general,
            weight: this._estimateWeight(general),
        })).sort(compareWeight);

        const results: LocalGachaResultEntry[] = [];
        for (let index = 0; index < drawCount; index++) {
            const picked = this._pickCandidate(weightedCandidates).general;
            const clonedGeneral = cloneGeneral(picked);
            const rarityTier = inferRarityTier(clonedGeneral);

            results.push({
                general: clonedGeneral,
                rarityTier,
                drawIndex: index + 1,
                displayText: formatDrawResultText(index, clonedGeneral, rarityTier),
                poolId: request.poolId,
                actionType: request.actionType,
                currencyKey: request.currencyKey,
            });
        }

        const logged = services().sync.pushAction(
            request.actionType,
            {
                poolId: request.poolId,
                drawCount,
                cost,
                currencyKey: request.currencyKey,
                localOnly: true,
                results: results.map((entry) => ({
                    id: entry.general.id,
                    name: entry.general.name,
                    rarityTier: entry.rarityTier,
                    displayText: entry.displayText,
                })),
            },
            SyncActionType.DEFERRABLE,
        );

        if (!logged) {
            throw new Error(`[LocalGachaService] ${request.currencyKey} 召喚紀錄寫入失敗。`);
        }

        this._spendCurrency(request.currencyKey, cost);

        return results;
    }

    private _filterCandidates(generals: GeneralConfig[], factionFilter: 'all' | 'player' | 'enemy' = 'all'): GeneralConfig[] {
        const list = Array.isArray(generals) ? generals.filter((general): general is GeneralConfig => !!general) : [];

        switch (factionFilter) {
            case 'player':
                return list.filter((general) => general.faction === Faction.Player);
            case 'enemy':
                return list.filter((general) => general.faction === Faction.Enemy);
            case 'all':
            default:
                return list;
        }
    }

    private _estimateWeight(general: GeneralConfig): number {
        const rarityTier = inferRarityTier(general);
        switch (rarityTier) {
            case 'mythic':
                return 1;
            case 'legendary':
                return 3;
            case 'epic':
                return 8;
            case 'rare':
                return 22;
            case 'common':
            default:
                return 60;
        }
    }

    private _pickCandidate(weightedCandidates: Array<{ general: GeneralConfig; weight: number }>): { general: GeneralConfig; weight: number } {
        const totalWeight = weightedCandidates.reduce((total, entry) => total + Math.max(1, entry.weight), 0);
        let cursor = Math.random() * totalWeight;

        for (const entry of weightedCandidates) {
            cursor -= Math.max(1, entry.weight);
            if (cursor <= 0) {
                return entry;
            }
        }

        return weightedCandidates[weightedCandidates.length - 1];
    }

    private _loadSinglePlayerModeEnabled(): boolean {
        const stored = sys.localStorage.getItem(SINGLE_PLAYER_MODE_KEY);
        if (stored === 'false') {
            return false;
        }
        if (stored === 'true') {
            return true;
        }
        return true;
    }

    private _persistSinglePlayerModeEnabled(): void {
        sys.localStorage.setItem(SINGLE_PLAYER_MODE_KEY, this._singlePlayerModeEnabled ? 'true' : 'false');
    }

    private _assertSufficientCurrency(currencyKey: GachaCurrencyKey, cost: number): void {
        if (cost <= 0) {
            return;
        }

        const current = this._wallet[currencyKey];
        if (current < cost) {
            // Dev preview: auto-top-up so pulls never hard-fail.
            const topUp = cost - current + DEFAULT_WALLET[currencyKey];
            this._wallet[currencyKey] = current + topUp;
            this._persistWalletSnapshot();
        }
    }

    private _spendCurrency(currencyKey: GachaCurrencyKey, cost: number): void {
        if (cost <= 0) {
            return;
        }

        this._wallet[currencyKey] = Math.max(0, this._wallet[currencyKey] - cost);
        this._persistWalletSnapshot();
    }

    private _loadWalletSnapshot(): LocalGachaWalletSnapshot {
        const stored = sys.localStorage.getItem(WALLET_STORAGE_KEY);
        if (!stored) {
            return { ...DEFAULT_WALLET };
        }

        try {
            const parsed = JSON.parse(stored) as Partial<LocalGachaWalletSnapshot> | null;
            return {
                gems: normalizeWalletValue(parsed?.gems, DEFAULT_WALLET.gems),
                gold: normalizeWalletValue(parsed?.gold, DEFAULT_WALLET.gold),
                tickets: normalizeWalletValue(parsed?.tickets, DEFAULT_WALLET.tickets),
            };
        } catch {
            return { ...DEFAULT_WALLET };
        }
    }

    private _persistWalletSnapshot(): void {
        sys.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(this._wallet));
    }
}