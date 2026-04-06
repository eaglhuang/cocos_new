/**
 * BattleLogArchiver.ts
 * 
 * 戰鬥日誌歸檔策略：
 *   - 最近 100 場：保留完整 BattleLog 物件
 *   - 第 101-200 場：壓縮為季度摘要（勝/敗/平 + 平均傷亡 + 關鍵事件計數）
 *   - 200 場以上且 2 年以前：可安全刪除
 * 
 * Unity 對照：類似自訂的 SaveData 歸檔機制，
 * 在 Unity 中通常用 ScriptableObject 或 PlayerPrefs 手動管理，
 * 這裡以純 TypeScript 服務類封裝所有歸檔邏輯。
 * 
 * 呼叫方式：
 *   - 每場戰鬥結束後呼叫 appendLog()
 *   - 定期（場景切換或每 10 分鐘）呼叫 archiveLogs()
 *   - App 啟動時呼叫 pruneLogs() 清除過期資料
 */

import { DataStorageAdapter } from '../storage/DataStorageAdapter';

export interface BattleLog {
    battleId: string;
    timestamp: number;  // Unix ms
    result: 'WIN' | 'LOSE' | 'DRAW';
    casualties: number;
    attackerId: string;
    defenderId: string;
    keyEvents?: string[];
}

export interface QuarterlySummary {
    season: number;     // 1-4
    year: number;
    wins: number;
    losses: number;
    draws: number;
    totalCasualties: number;
    keyEventCount: number;
    battleCount: number;
}

const STORE_RECENT_LOGS = 'battle_logs_recent';
const STORE_QUARTERLY = 'battle_logs_quarterly';
const RECENT_KEEP_COUNT = 100;
const ARCHIVE_THRESHOLD = 200;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export class BattleLogArchiver {
    private adapter: DataStorageAdapter;

    constructor(adapter: DataStorageAdapter) {
        this.adapter = adapter;
    }

    /**
     * 新增一場戰鬥記錄，並觸發自動歸檔檢查。
     */
    public async appendLog(log: BattleLog): Promise<void> {
        const recent: BattleLog[] = (await this.adapter.get<BattleLog[]>(STORE_RECENT_LOGS)) ?? [];
        recent.push(log);
        await this.adapter.set(STORE_RECENT_LOGS, recent);

        if (recent.length >= ARCHIVE_THRESHOLD) {
            await this.archiveLogs();
        }
    }

    /**
     * 執行歸檔：將 101-200 場轉為季度摘要，僅保留最近 100 場完整記錄。
     */
    public async archiveLogs(): Promise<void> {
        const recent: BattleLog[] = (await this.adapter.get<BattleLog[]>(STORE_RECENT_LOGS)) ?? [];
        if (recent.length <= RECENT_KEEP_COUNT) return;

        // 取出需要歸檔的批次（超出 100 的部分）
        const toArchive = recent.splice(0, recent.length - RECENT_KEEP_COUNT);

        // 依季度分組
        const summaryMap = new Map<string, QuarterlySummary>();
        for (const log of toArchive) {
            const date = new Date(log.timestamp);
            const year = date.getFullYear();
            const season = Math.floor(date.getMonth() / 3) + 1;
            const key = `${year}-Q${season}`;

            if (!summaryMap.has(key)) {
                summaryMap.set(key, { season, year, wins: 0, losses: 0, draws: 0, totalCasualties: 0, keyEventCount: 0, battleCount: 0 });
            }

            const s = summaryMap.get(key)!;
            s.battleCount++;
            s.totalCasualties += log.casualties;
            if (log.result === 'WIN') s.wins++;
            else if (log.result === 'LOSE') s.losses++;
            else s.draws++;
            s.keyEventCount += log.keyEvents?.length ?? 0;
        }

        // 存入季度摘要
        const existing: QuarterlySummary[] = (await this.adapter.get<QuarterlySummary[]>(STORE_QUARTERLY)) ?? [];
        for (const summary of summaryMap.values()) {
            const idx = existing.findIndex(e => e.year === summary.year && e.season === summary.season);
            if (idx >= 0) {
                // 合併
                existing[idx].battleCount += summary.battleCount;
                existing[idx].wins += summary.wins;
                existing[idx].losses += summary.losses;
                existing[idx].draws += summary.draws;
                existing[idx].totalCasualties += summary.totalCasualties;
                existing[idx].keyEventCount += summary.keyEventCount;
            } else {
                existing.push(summary);
            }
        }
        await this.adapter.set(STORE_QUARTERLY, existing);

        // 更新近期記錄（只保留最新 100 筆）
        await this.adapter.set(STORE_RECENT_LOGS, recent);
    }

    /**
     * 清除 2 年以前的季度摘要。
     */
    public async pruneLogs(): Promise<void> {
        const cutoff = Date.now() - TWO_YEARS_MS;
        const quarterly: QuarterlySummary[] = (await this.adapter.get<QuarterlySummary[]>(STORE_QUARTERLY)) ?? [];
        const pruned = quarterly.filter(s => {
            const approxMs = new Date(s.year, (s.season - 1) * 3).getTime();
            return approxMs >= cutoff;
        });
        if (pruned.length !== quarterly.length) {
            await this.adapter.set(STORE_QUARTERLY, pruned);
        }
    }

    /**
     * 取得最近 N 場完整記錄。
     */
    public async getRecentLogs(limit = RECENT_KEEP_COUNT): Promise<BattleLog[]> {
        const recent: BattleLog[] = (await this.adapter.get<BattleLog[]>(STORE_RECENT_LOGS)) ?? [];
        return recent.slice(-limit);
    }

    /**
     * 取得季度摘要清單。
     */
    public async getQuarterlySummaries(): Promise<QuarterlySummary[]> {
        return (await this.adapter.get<QuarterlySummary[]>(STORE_QUARTERLY)) ?? [];
    }
}
