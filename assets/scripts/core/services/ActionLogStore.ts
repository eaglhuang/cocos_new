import type { ActionRecord } from '../../../../shared/protocols';
import { services } from '../managers/ServiceLoader';

export type GachaActionType = 'LOCAL_GACHA_PULL' | 'LOCAL_GOLD_SUMMON' | 'LOCAL_TICKET_SUMMON';
export type GachaCurrencyKey = 'gems' | 'gold' | 'tickets';

export interface GachaResultSummary {
    id: string;
    name: string;
    rarityTier: string;
    displayText: string;
}

export interface GachaHistoryRecord {
    seq: number;
    timestamp: number;
    actionType: GachaActionType;
    poolId: string;
    drawCount: number;
    cost: number;
    currencyKey: GachaCurrencyKey;
    results: GachaResultSummary[];
}

export interface ActionLogDebugSnapshot {
    storageMode: string;
    deviceId: string;
    currentSeq: number;
    lastHash: string;
    pendingCount: number;
    total: number;
    isHydrated: boolean;
    records: ActionRecord[];
}

const GACHA_ACTION_SET = new Set<GachaActionType>([
    'LOCAL_GACHA_PULL',
    'LOCAL_GOLD_SUMMON',
    'LOCAL_TICKET_SUMMON',
]);

function toRecordMap(payload: unknown): Record<string, unknown> {
    return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
}

function toNumber(value: unknown, fallback = 0): number {
    const resolved = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(resolved) ? resolved : fallback;
}

function toStringValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function normalizeResults(rawResults: unknown): GachaResultSummary[] {
    if (!Array.isArray(rawResults)) {
        return [];
    }

    return rawResults.map((entry, index) => {
        const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        const general = item.general && typeof item.general === 'object'
            ? item.general as Record<string, unknown>
            : null;
        const id = toStringValue(item.id ?? general?.id, `unknown-${index + 1}`);
        const name = toStringValue(item.name ?? general?.name, '未知武將');
        const rarityTier = toStringValue(item.rarityTier ?? general?.rarityTier, 'common');
        const displayText = toStringValue(item.displayText, `#${index + 1} [${rarityTier}] ${name}`);

        return {
            id,
            name,
            rarityTier,
            displayText,
        };
    });
}

function inferCurrencyKey(actionType: GachaActionType, rawValue: unknown): GachaCurrencyKey {
    const resolved = toStringValue(rawValue, '');
    if (resolved === 'gems' || resolved === 'gold' || resolved === 'tickets') {
        return resolved;
    }

    switch (actionType) {
        case 'LOCAL_GOLD_SUMMON':
            return 'gold';
        case 'LOCAL_TICKET_SUMMON':
            return 'tickets';
        case 'LOCAL_GACHA_PULL':
        default:
            return 'gems';
    }
}

function inferActionType(action: string): GachaActionType | null {
    return GACHA_ACTION_SET.has(action as GachaActionType) ? action as GachaActionType : null;
}

function compareActionRecord(left: ActionRecord, right: ActionRecord): number {
    return right.Timestamp - left.Timestamp || right.Seq - left.Seq;
}

function mapToGachaHistoryRecord(record: ActionRecord): GachaHistoryRecord | null {
    const actionType = inferActionType(record.Action);
    if (!actionType) {
        return null;
    }

    const payload = toRecordMap(record.Payload);
    const results = normalizeResults(payload.results);

    return {
        seq: record.Seq,
        timestamp: record.Timestamp,
        actionType,
        poolId: toStringValue(payload.poolId ?? payload.Pool_ID, 'unknown-pool'),
        drawCount: toNumber(payload.drawCount ?? payload.DrawCount ?? results.length, results.length),
        cost: toNumber(payload.cost ?? payload.Cost, 0),
        currencyKey: inferCurrencyKey(actionType, payload.currencyKey ?? payload.CurrencyKey),
        results,
    };
}

export class ActionLogStore {
    private static instance: ActionLogStore | null = null;

    public static getInstance(): ActionLogStore {
        if (!this.instance) {
            this.instance = new ActionLogStore();
        }
        return this.instance;
    }

    public async getDebugSnapshot(limit = 200): Promise<ActionLogDebugSnapshot> {
        const sync = services().sync;
        const records = sync.getActionRecords().slice().sort(compareActionRecord);
        const boundedLimit = limit > 0 ? limit : records.length;

        return {
            ...sync.getActionLogSnapshot(),
            total: records.length,
            records: records.slice(0, boundedLimit),
        };
    }

    public async getRecentGachaHistory(limit = 100): Promise<{ total: number; records: GachaHistoryRecord[] }> {
        const sync = services().sync;
        const records = sync.getActionRecords()
            .filter((record) => GACHA_ACTION_SET.has(record.Action as GachaActionType))
            .sort(compareActionRecord);
        const boundedLimit = limit > 0 ? limit : records.length;

        return {
            total: records.length,
            records: records
                .slice(0, boundedLimit)
                .map((record) => mapToGachaHistoryRecord(record))
                .filter((record): record is GachaHistoryRecord => record !== null),
        };
    }
}