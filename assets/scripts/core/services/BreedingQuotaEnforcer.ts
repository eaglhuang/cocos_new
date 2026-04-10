/**
 * BreedingQuotaEnforcer.ts
 *
 * AI 繁殖配額強制執行服務（Phase 3）：
 *   - 執行 AIPopulationConfig 中定義的人口上限策略
 *   - 提供 IBreedingGate hook 供繁殖系統呼叫
 *   - 追蹤支系與全局人口預算
 *
 * §2.6 規格：
 *   - AI 族群勢力人口控管
 *   - 以 AIPopulationConfig（JSON 載入）作為設定依據
 *   - 超過 globalPopulationBudget 時禁止新的 breeding
 *   - breedingCap = min(baseBreedingCap + floor(vitality / vitalityPerCapBonus), 5)
 *
 * Unity 對照：類似 NavMesh Spawner 的 maxInstanceCount 邏輯，
 * 但這裡是跨服務的 Gate pattern，讓繁殖系統在呼叫前先詢問 Gate。
 *
 * IBreedingGate 使用方式：
 *   const gate: IBreedingGate = BreedingQuotaEnforcer.getInstance(adapter);
 *   if (await gate.canBreed(factionUid)) { ... await gate.recordBreeding(factionUid); }
 */

import { DataStorageAdapter } from '../storage/DataStorageAdapter';
import { AIPopulationConfig, getBreedingCap, DEFAULT_AI_POPULATION_CONFIG } from '../models/AIPopulationConfig';

const STORE_BREEDING_RECORDS = 'breeding_quota_records';
const STORE_POPULATION_STATS = 'population_stats_cache';

/**
 * 繁殖閘道介面（Hook），供繁殖系統在產生新武將前呼叫。
 * 獨立於具體實作，方便測試替換。
 */
export interface IBreedingGate {
    /**
     * 詢問該勢力是否可進行一次繁殖。
     * 考量：全局人口預算 + 勢力本輪 breeding 配額
     */
    canBreed(factionUid: string): Promise<boolean>;

    /**
     * 記錄一次成功繁殖（呼叫 canBreed 返回 true 後必須呼叫此方法）。
     */
    recordBreeding(factionUid: string): Promise<void>;
}

export interface FactionBreedingRecord {
    factionUid: string;
    currentSeasonBreedCount: number;
    lastBreedSeason: number;
    lastBreedYear: number;
    vitality: number;  // 0-100，影響 breedingCap 計算
}

export interface PopulationStats {
    totalAlive: number;
    totalDead: number;
    totalPendingDelete: number;
    globalPopulationBudget: number;
    isOverBudget: boolean;
    factionBreakdown: Record<string, number>;
}

export class BreedingQuotaEnforcer implements IBreedingGate {
    private static _instance: BreedingQuotaEnforcer | null = null;
    private readonly adapter: DataStorageAdapter;
    private config: AIPopulationConfig;

    /** 當前季節上下文（由外部注入更新） */
    private currentSeason: number = 1;
    private currentYear: number = 220; // 三國起始年

    constructor(adapter: DataStorageAdapter, config?: AIPopulationConfig) {
        this.adapter = adapter;
        this.config = config ?? DEFAULT_AI_POPULATION_CONFIG;
    }

    static getInstance(adapter: DataStorageAdapter, config?: AIPopulationConfig): BreedingQuotaEnforcer {
        if (!BreedingQuotaEnforcer._instance) {
            BreedingQuotaEnforcer._instance = new BreedingQuotaEnforcer(adapter, config);
        }
        return BreedingQuotaEnforcer._instance;
    }

    /**
     * 注入當前季節上下文（由 DataLifecycleScheduler 每季更新）。
     */
    public setSeasonContext(season: number, year: number): void {
        this.currentSeason = season;
        this.currentYear = year;
    }

    /**
     * 更新 AIPopulationConfig（如從 JSON 重新載入後）。
     */
    public setConfig(config: AIPopulationConfig): void {
        this.config = config;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IBreedingGate 實作
    // ═══════════════════════════════════════════════════════════════════════════

    public async canBreed(factionUid: string): Promise<boolean> {
        // 1. 全局人口預算檢查
        if (await this.isOverBudget()) return false;

        // 2. 勢力本季配額檢查
        const record = await this._getOrCreateRecord(factionUid);
        const cap = getBreedingCap(this.config, record.vitality);

        // 如果是新的一季，重置計數
        const isNewSeason =
            record.lastBreedSeason !== this.currentSeason ||
            record.lastBreedYear !== this.currentYear;

        if (isNewSeason) return true; // 新季度：允許（之後 recordBreeding 會更新計數）

        return record.currentSeasonBreedCount < cap;
    }

    public async recordBreeding(factionUid: string): Promise<void> {
        const records: FactionBreedingRecord[] =
            (await this.adapter.get<FactionBreedingRecord[]>(STORE_BREEDING_RECORDS)) ?? [];

        const idx = records.findIndex(r => r.factionUid === factionUid);
        const existing = records[idx];

        const isNewSeason =
            !existing ||
            existing.lastBreedSeason !== this.currentSeason ||
            existing.lastBreedYear !== this.currentYear;

        if (isNewSeason) {
            const newRecord: FactionBreedingRecord = {
                factionUid,
                currentSeasonBreedCount: 1,
                lastBreedSeason: this.currentSeason,
                lastBreedYear: this.currentYear,
                vitality: existing?.vitality ?? 50,
            };
            if (idx >= 0) records[idx] = newRecord; else records.push(newRecord);
        } else {
            existing.currentSeasonBreedCount += 1;
            existing.lastBreedSeason = this.currentSeason;
            existing.lastBreedYear = this.currentYear;
        }

        await this.adapter.set(STORE_BREEDING_RECORDS, records);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Public utilities
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * 更新勢力活力值（0-100），影響本季可繁殖配額上限。
     */
    public async updateVitality(factionUid: string, vitality: number): Promise<void> {
        const records: FactionBreedingRecord[] =
            (await this.adapter.get<FactionBreedingRecord[]>(STORE_BREEDING_RECORDS)) ?? [];

        const idx = records.findIndex(r => r.factionUid === factionUid);
        if (idx >= 0) {
            records[idx].vitality = Math.max(0, Math.min(100, vitality));
        } else {
            records.push({
                factionUid,
                currentSeasonBreedCount: 0,
                lastBreedSeason: 0,
                lastBreedYear: 0,
                vitality: Math.max(0, Math.min(100, vitality)),
            });
        }
        await this.adapter.set(STORE_BREEDING_RECORDS, records);
    }

    /**
     * 全局人口是否已超出預算。
     */
    public async isOverBudget(): Promise<boolean> {
        const stats = await this.getPopulationStats();
        return stats.isOverBudget;
    }

    /**
     * 取得全局人口統計快照。
     */
    public async getPopulationStats(): Promise<PopulationStats> {
        // 從 store 讀取活躍人口計數（簡化：讀 active_ids 計數）
        const activeIds: string[] = (await this.adapter.get<string[]>('generals_active_ids')) ?? [];
        const archived: unknown[] = (await this.adapter.get<unknown[]>('generals_archive_l5')) ?? [];
        const pendingDelete: unknown[] = (await this.adapter.get<unknown[]>('pending_delete_queue')) ?? [];

        const stats: PopulationStats = {
            totalAlive: activeIds.length,
            totalDead: archived.length,
            totalPendingDelete: pendingDelete.length,
            globalPopulationBudget: this.config.globalPopulationBudget,
            isOverBudget: activeIds.length >= this.config.globalPopulationBudget,
            factionBreakdown: {},
        };

        return stats;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private async _getOrCreateRecord(factionUid: string): Promise<FactionBreedingRecord> {
        const records: FactionBreedingRecord[] =
            (await this.adapter.get<FactionBreedingRecord[]>(STORE_BREEDING_RECORDS)) ?? [];
        return records.find(r => r.factionUid === factionUid) ?? {
            factionUid,
            currentSeasonBreedCount: 0,
            lastBreedSeason: 0,
            lastBreedYear: 0,
            vitality: 50,
        };
    }
}
