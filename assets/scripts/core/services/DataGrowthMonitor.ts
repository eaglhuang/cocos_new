/**
 * DataGrowthMonitor.ts
 * 
 * 本地儲存使用量監控服務：
 *   - 正常：< 5MB
 *   - Warning：>= 5MB（觸發 warning 事件）
 *   - Error：>= 10MB（觸發 error 事件，建議玩家清理）
 * 
 * 定期評估策略：
 *   - 場景切換時呼叫 checkNow()
 *   - 也可以設定自動輪詢（startMonitor / stopMonitor）
 * 
 * Unity 對照：類似 Application.dataPath 大小監控，
 * 在 Unity 中通常要手動 DirectoryInfo.GetFiles() 統計，
 * 這裡透過 DataStorageAdapter.getStorageStats() 取得預估值。
 */

import { DataStorageAdapter, StorageStats } from '../storage/DataStorageAdapter';

export type StorageLevel = 'normal' | 'warning' | 'error';

export interface StorageCheckResult {
    level: StorageLevel;
    usedBytes: number;
    totalBytes: number;
    usageRatio: number;
    message: string;
}

type StorageLevelCallback = (result: StorageCheckResult) => void;

const MB = 1024 * 1024;
const WARNING_THRESHOLD_BYTES = 5 * MB;
const ERROR_THRESHOLD_BYTES = 10 * MB;
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000; // 10 分鐘

export class DataGrowthMonitor {
    private adapter: DataStorageAdapter;
    private _onWarning: StorageLevelCallback | null = null;
    private _onError: StorageLevelCallback | null = null;
    private _timer: ReturnType<typeof setInterval> | null = null;

    constructor(adapter: DataStorageAdapter) {
        this.adapter = adapter;
    }

    /**
     * 設定 warning 事件回調（>= 5MB）。
     */
    public onWarning(callback: StorageLevelCallback): this {
        this._onWarning = callback;
        return this;
    }

    /**
     * 設定 error 事件回調（>= 10MB）。
     */
    public onError(callback: StorageLevelCallback): this {
        this._onError = callback;
        return this;
    }

    /**
     * 立即執行一次儲存量檢查。
     */
    public async checkNow(): Promise<StorageCheckResult> {
        let stats: StorageStats;
        try {
            stats = await this.adapter.getStorageStats();
        } catch {
            stats = { usedBytes: 0, quotaBytes: 0, recordCount: 0 };
        }

        const result = DataGrowthMonitor._evaluate(stats);

        if (result.level === 'error' && this._onError) {
            this._onError(result);
        } else if (result.level === 'warning' && this._onWarning) {
            this._onWarning(result);
        }

        return result;
    }

    /**
     * 啟動定時監控（預設每 10 分鐘）。
     */
    public startMonitor(intervalMs = DEFAULT_INTERVAL_MS): void {
        if (this._timer !== null) return;
        this._timer = setInterval(() => { void this.checkNow(); }, intervalMs);
    }

    /**
     * 停止定時監控。
     */
    public stopMonitor(): void {
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    private static _evaluate(stats: StorageStats): StorageCheckResult {
        const { usedBytes, quotaBytes: totalBytes } = stats;
        const usageRatio = totalBytes > 0 ? usedBytes / totalBytes : 0;

        if (usedBytes >= ERROR_THRESHOLD_BYTES) {
            return {
                level: 'error',
                usedBytes,
                totalBytes,
                usageRatio,
                message: `本地儲存已達 ${(usedBytes / MB).toFixed(1)} MB，超過 10MB 警戒線，建議立即清理舊資料。`,
            };
        }
        if (usedBytes >= WARNING_THRESHOLD_BYTES) {
            return {
                level: 'warning',
                usedBytes,
                totalBytes,
                usageRatio,
                message: `本地儲存已達 ${(usedBytes / MB).toFixed(1)} MB，接近 10MB 上限，建議清理部分舊資料。`,
            };
        }
        return {
            level: 'normal',
            usedBytes,
            totalBytes,
            usageRatio,
            message: `儲存使用正常（${(usedBytes / MB).toFixed(2)} MB）`,
        };
    }
}
