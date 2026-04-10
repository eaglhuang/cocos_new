/**
 * DataLifecycleScheduler.ts
 *
 * 資料生命周期排程器（Phase 4）：整合所有子服務，
 * 集中管理季結、年底、四季強制清掃的觸發時機。
 *
 * 依賴鏈（所有服務由外部注入，便於測試與解耦）：
 *   - SeasonalRollup   → 季結 hot→cold 壓縮
 *   - BattleLogArchiver → 戰報 rolling archive
 *   - PendingDeleteStore → 待刪隔離掃除
 *   - BranchCompactor   → 年底支系壓縮
 *   - DataGrowthMonitor → 儲存量監控 + 降級回調
 *   - BreedingQuotaEnforcer → 季節上下文更新
 *
 * Unity 對照：類似 GameManager 的 Update/FixedUpdate 路由，
 * 但觸發單位是遊戲季節，而非幀率。
 *
 * §2.6 規格：
 *   - 每季結束 → rollupSeason + archive + sweep
 *   - 每年底 → compactAll (支系壓縮)
 *   - 每 4 季 → forceSweep（強制刪除到期條目）
 *   - 儲存量超限 → monitor callbacks 觸發
 */

import { DataStorageAdapter } from '../storage/DataStorageAdapter';
import { SeasonalRollup, RollupResult } from './SeasonalRollup';
import { PendingDeleteStore, SweepResult } from './PendingDeleteStore';
import { BranchCompactor, CompactionResult } from './BranchCompactor';
import { DataGrowthMonitor, StorageCheckResult } from './DataGrowthMonitor';
import { BreedingQuotaEnforcer } from './BreedingQuotaEnforcer';

export interface SeasonEndResult {
    season: number;
    year: number;
    rollup: RollupResult | null;
    sweep: SweepResult | null;
    storageCheck: StorageCheckResult | null;
    executedAt: number;
}

export interface YearEndResult {
    year: number;
    compaction: CompactionResult | null;
    executedAt: number;
}

export class DataLifecycleScheduler {
    private static _instance: DataLifecycleScheduler | null = null;

    private readonly rollup: SeasonalRollup;
    private readonly pendingDelete: PendingDeleteStore;
    private readonly compactor: BranchCompactor;
    private readonly monitor: DataGrowthMonitor;
    private readonly breedingEnforcer: BreedingQuotaEnforcer;

    private _seasonEndLog: SeasonEndResult[] = [];
    private _yearEndLog: YearEndResult[] = [];

    constructor(
        adapter: DataStorageAdapter,
        rollup?: SeasonalRollup,
        pendingDelete?: PendingDeleteStore,
        compactor?: BranchCompactor,
        monitor?: DataGrowthMonitor,
        breedingEnforcer?: BreedingQuotaEnforcer,
    ) {
        this.rollup = rollup ?? SeasonalRollup.getInstance(adapter);
        this.pendingDelete = pendingDelete ?? PendingDeleteStore.getInstance(adapter);
        this.compactor = compactor ?? BranchCompactor.getInstance(adapter);
        this.monitor = monitor ?? new DataGrowthMonitor(adapter);
        this.breedingEnforcer = breedingEnforcer ?? BreedingQuotaEnforcer.getInstance(adapter);

        // 注入降級回調
        this.monitor
            .onRollupNeeded(async (result) => {
                // 非同步觸發，不阻塞監控回調
                void this.rollup.rollupSeason(1, 0); // fallback：無法得知當前季節時的 best-effort
            })
            .onSweepNeeded(async (result) => {
                void this.pendingDelete.forceSweep(1, 0);
            });
    }

    static getInstance(adapter: DataStorageAdapter): DataLifecycleScheduler {
        if (!DataLifecycleScheduler._instance) {
            DataLifecycleScheduler._instance = new DataLifecycleScheduler(adapter);
        }
        return DataLifecycleScheduler._instance;
    }

    /**
     * 季結觸發點（每季結束時呼叫）。
     * 1. 更新 BreedingQuotaEnforcer 的季節上下文
     * 2. 執行 SeasonalRollup（hot→cold 壓縮 B 類後裔）
     * 3. 執行 PendingDeleteStore.sweep（清除到期隔離條目）
     * 4. 若 (season % 4 == 0) 執行 forceSweep
     * 5. 呼叫 DataGrowthMonitor.checkNow()
     *
     * @param season 剛結束的遊戲季 (1-4)
     * @param year 遊戲年份
     */
    public async onSeasonEnd(season: number, year: number): Promise<SeasonEndResult> {
        // 更新季節上下文
        this.breedingEnforcer.setSeasonContext(season, year);

        let rollupResult: RollupResult | null = null;
        let sweepResult: SweepResult | null = null;
        let storageCheck: StorageCheckResult | null = null;

        try {
            rollupResult = await this.rollup.rollupSeason(season, year);
        } catch (e) {
            console.error('[DataLifecycleScheduler] rollupSeason failed:', e);
        }

        try {
            // 4 季一次強制清掃；其他季做一般 sweep
            if (season === 4) {
                sweepResult = await this.pendingDelete.forceSweep(season, year);
            } else {
                sweepResult = await this.pendingDelete.sweep(season, year);
            }
        } catch (e) {
            console.error('[DataLifecycleScheduler] sweep failed:', e);
        }

        try {
            storageCheck = await this.monitor.checkNow();
        } catch (e) {
            console.error('[DataLifecycleScheduler] monitor.checkNow failed:', e);
        }

        const result: SeasonEndResult = {
            season,
            year,
            rollup: rollupResult,
            sweep: sweepResult,
            storageCheck,
            executedAt: Date.now(),
        };

        this._seasonEndLog.push(result);
        if (this._seasonEndLog.length > 20) this._seasonEndLog = this._seasonEndLog.slice(-20);

        return result;
    }

    /**
     * 年底觸發點（每年第 4 季結束後呼叫）。
     * 1. 偵測並壓縮已滅絕支系（BranchCompactor.compactAll）
     *
     * @param year 剛結束的遊戲年份
     */
    public async onYearEnd(year: number): Promise<YearEndResult> {
        let compaction: CompactionResult | null = null;

        try {
            compaction = await this.compactor.compactAll();
        } catch (e) {
            console.error('[DataLifecycleScheduler] compactAll failed:', e);
        }

        const result: YearEndResult = {
            year,
            compaction,
            executedAt: Date.now(),
        };

        this._yearEndLog.push(result);
        if (this._yearEndLog.length > 10) this._yearEndLog = this._yearEndLog.slice(-10);

        return result;
    }

    /**
     * 取得近期季結日誌。
     */
    public getSeasonEndLog(): SeasonEndResult[] {
        return [...this._seasonEndLog];
    }

    /**
     * 取得近期年底日誌。
     */
    public getYearEndLog(): YearEndResult[] {
        return [...this._yearEndLog];
    }
}
