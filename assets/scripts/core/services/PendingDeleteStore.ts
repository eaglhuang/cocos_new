/**
 * PendingDeleteStore.ts
 *
 * 待刪除隔離層服務。
 * 對應 §2.6 長局單機生命周期策略「C 類：動態後裔（已故）」流程。
 *
 * 工作流：
 *   1. GeneralArchiver 判定死亡武將為 C 類 → enqueue()
 *   2. 每季結束時 DataLifecycleScheduler 呼叫 sweep()
 *   3. sweep() 找出已超過保留期且仍符合 D 條件的 SpiritCard
 *   4. 符合條件者標記為可 GC，通知上層移除完整主體
 *
 * Unity 對照：類似 Unity 的 Object.Destroy(obj, delay)，
 * 但用「季數」為延遲單位，並加入條件檢查才真正執行刪除。
 */

import { DataStorageAdapter } from '../storage/DataStorageAdapter';
import { SpiritCard } from '../models/SpiritCard';
import { GeneralLifecycleClass } from '../models/GeneralLifecycle';

const STORE_PENDING_DELETE = 'pending_delete_queue';

export interface PendingDeleteEntry {
    spiritCard: SpiritCard;
    /** 進入隔離區的季數（遊戲內） */
    enqueuedSeason: number;
    /** 進入隔離區的年份（遊戲內） */
    enqueuedYear: number;
    /** 允許 GC 的最早季數（enqueuedSeason + retentionSeasons） */
    eligibleAfterSeason: number;
    /** 允許 GC 的最早年份 */
    eligibleAfterYear: number;
}

export interface SweepResult {
    /** 本次掃除中移除的 SpiritCard uid 列表 */
    removedUids: string[];
    /** 保留中（尚未到期）的條目數 */
    retainedCount: number;
}

export class PendingDeleteStore {
    private static _instance: PendingDeleteStore | null = null;
    private readonly adapter: DataStorageAdapter;

    constructor(adapter: DataStorageAdapter) {
        this.adapter = adapter;
    }

    static getInstance(adapter: DataStorageAdapter): PendingDeleteStore {
        if (!PendingDeleteStore._instance) {
            PendingDeleteStore._instance = new PendingDeleteStore(adapter);
        }
        return PendingDeleteStore._instance;
    }

    /**
     * 將 C 類已故武將的 SpiritCard 加入待刪隔離區。
     * @param spiritCard 已建立的 SpiritCard（lifecycleClass 應為 C or D）
     * @param currentSeason 當前遊戲季數
     * @param currentYear 當前遊戲年份
     * @param retentionSeasons 保留期（季數），預設 2
     */
    public async enqueue(
        spiritCard: SpiritCard,
        currentSeason: number,
        currentYear: number,
        retentionSeasons: number = 2,
    ): Promise<void> {
        const queue = await this._load();
        // 避免重複代入
        if (queue.some(e => e.spiritCard.uid === spiritCard.uid)) return;

        // 計算到期時間（簡單季數加法，year 在 season = 4 → +1年 時進位）
        let eligibleYear = currentYear;
        let eligibleSeason = currentSeason + retentionSeasons;
        while (eligibleSeason > 4) {
            eligibleSeason -= 4;
            eligibleYear += 1;
        }

        queue.push({
            spiritCard,
            enqueuedSeason: currentSeason,
            enqueuedYear: currentYear,
            eligibleAfterSeason: eligibleSeason,
            eligibleAfterYear: eligibleYear,
        });
        await this._save(queue);
    }

    /**
     * 取得目前隔離區中的所有條目。
     */
    public async getAll(): Promise<PendingDeleteEntry[]> {
        return this._load();
    }

    /**
     * 提前將某個 uid 升格為可 GC（如手動確認無後代依賴）。
     * 使其在下一次 sweep 時被清理。
     */
    public async promoteToDelete(uid: string): Promise<void> {
        const queue = await this._load();
        const entry = queue.find(e => e.spiritCard.uid === uid);
        if (entry) {
            // 將到期時間設為已過
            entry.eligibleAfterSeason = 0;
            entry.eligibleAfterYear = 0;
            // 升格 lifecycleClass 為 D
            entry.spiritCard.lifecycleClass = GeneralLifecycleClass.Unrecoverable;
            entry.spiritCard.resurrectionEligible = false;
            await this._save(queue);
        }
    }

    /**
     * 批次掃除已到期且仍符合 D 條件的條目。
     * @param currentSeason 當前遊戲季數
     * @param currentYear 當前遊戲年份
     * @returns SweepResult（被移除的 uid + 保留數量）
     */
    public async sweep(currentSeason: number, currentYear: number): Promise<SweepResult> {
        const queue = await this._load();
        const toRemove: PendingDeleteEntry[] = [];
        const toKeep: PendingDeleteEntry[] = [];

        for (const entry of queue) {
            const isExpired = this._isExpired(entry, currentSeason, currentYear);
            const isDClass = entry.spiritCard.lifecycleClass === GeneralLifecycleClass.Unrecoverable;
            const noResFlag = !entry.spiritCard.resurrectionEligible;

            if (isExpired && isDClass && noResFlag) {
                toRemove.push(entry);
            } else {
                toKeep.push(entry);
            }
        }

        if (toRemove.length > 0) {
            await this._save(toKeep);
        }

        return {
            removedUids: toRemove.map(e => e.spiritCard.uid),
            retainedCount: toKeep.length,
        };
    }

    /**
     * 強制清掃所有已超過到期時間的條目（不論 lifecycle class）。
     * 用於 4 季一次強制 GC。
     */
    public async forceSweep(currentSeason: number, currentYear: number): Promise<SweepResult> {
        const queue = await this._load();
        const toRemove = queue.filter(e => this._isExpired(e, currentSeason, currentYear));
        const toKeep = queue.filter(e => !this._isExpired(e, currentSeason, currentYear));

        if (toRemove.length > 0) {
            await this._save(toKeep);
        }

        return {
            removedUids: toRemove.map(e => e.spiritCard.uid),
            retainedCount: toKeep.length,
        };
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private async _load(): Promise<PendingDeleteEntry[]> {
        return (await this.adapter.get<PendingDeleteEntry[]>(STORE_PENDING_DELETE)) ?? [];
    }

    private async _save(queue: PendingDeleteEntry[]): Promise<void> {
        await this.adapter.set(STORE_PENDING_DELETE, queue);
    }

    private _isExpired(entry: PendingDeleteEntry, currentSeason: number, currentYear: number): boolean {
        if (currentYear > entry.eligibleAfterYear) return true;
        if (currentYear === entry.eligibleAfterYear && currentSeason >= entry.eligibleAfterSeason) return true;
        return false;
    }
}
