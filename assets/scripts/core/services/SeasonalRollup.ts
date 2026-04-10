/**
 * SeasonalRollup.ts
 *
 * 季結 Rollup 服務：對 B 類（動態後裔，存活）進行 hot→cold 壓縮。
 * 每季結束時由 DataLifecycleScheduler 觸發，
 * 將存活 B 類後裔的非必要資料（故事、歷程、完整祖先快照）
 * 移至 cold archive，只保留 hot fields 在 L1 活躍層。
 *
 * §2.6 規格：
 *   - 每季做一次 rollup（摘要化）
 *   - B 類存活中：只保留目前玩法需要的 hot fields
 *   - story / 歷程 / 戰績 / 完整祖先快照 → cold archive / season rollup
 *
 * Unity 對照：類似在 Unity 中卸載已不需要的 Addressable Bundle，
 * 保留輕型 reference，重量型資料移到 Resources.UnloadUnusedAssets() 後的快取。
 */

import { DataStorageAdapter } from '../storage/DataStorageAdapter';

const STORE_COLD_ARCHIVE_PREFIX = 'cold_archive_season_';
const STORE_ROLLUP_HISTORY = 'rollup_history';

/**
 * B 類後裔的 hot fields（L1 常駐欄位）。
 * 只保留遊戲玩法即時需要的最小集合。
 */
export interface GeneralHotFields {
    uid: string;
    name: string;
    faction: string;
    stats: Record<string, number>;  // str/int/lea/pol/cha/luk
    gene_refs: string[];
    ep: number;
    rarityTier: string;
    characterCategory: string;
    parentUids: [string, string];
    isAlive: true;
}

/**
 * 一季的 rollup 結果摘要。
 */
export interface RollupResult {
    season: number;
    year: number;
    rolledUpCount: number;    // 本季執行 rollup 的武將數
    coldArchiveKey: string;   // cold archive 儲存鍵
    executedAt: number;       // Unix ms 時間戳
}

export class SeasonalRollup {
    private static _instance: SeasonalRollup | null = null;
    private readonly adapter: DataStorageAdapter;

    constructor(adapter: DataStorageAdapter) {
        this.adapter = adapter;
    }

    static getInstance(adapter: DataStorageAdapter): SeasonalRollup {
        if (!SeasonalRollup._instance) {
            SeasonalRollup._instance = new SeasonalRollup(adapter);
        }
        return SeasonalRollup._instance;
    }

    /**
     * 對所有 B 類（動態後裔，存活）執行季結 rollup。
     *
     * 流程：
     * 1. 讀取 L1 活躍 generals 列表（full objects）
     * 2. 找出非史實（非 isHistorical）的存活武將
     * 3. 擷取 hot fields，壓縮其餘欄位到 cold archive
     * 4. 將壓縮結果寫入 cold archive，更新 L1 為 hot-only
     * 5. 記錄 RollupResult
     *
     * @param currentSeason 當前遊戲季數 (1-4)
     * @param currentYear 當前遊戲年份
     * @returns RollupResult
     */
    public async rollupSeason(currentSeason: number, currentYear: number): Promise<RollupResult> {
        const STORE_ACTIVE = 'generals_active';
        const activeGenerals: Record<string, unknown>[] =
            (await this.adapter.get<Record<string, unknown>[]>(STORE_ACTIVE)) ?? [];

        const coldData: Record<string, unknown>[] = [];
        const hotList: Record<string, unknown>[] = [];

        for (const g of activeGenerals) {
            // 史實武將（isHistorical == true）不壓縮
            if (g['isHistorical'] === true) {
                hotList.push(g);
                continue;
            }
            // 提取 hot fields
            const hot = this._extractHotFields(g);
            hotList.push(hot);
            // 剩餘欄位放 cold（包含 story、歷程、完整祖先快照）
            const cold = { ...g };
            coldData.push(cold);
        }

        // 寫回 L1（hot-only）
        await this.adapter.set(STORE_ACTIVE, hotList);

        // 寫入 cold archive（按季存檔）
        const coldKey = `${STORE_COLD_ARCHIVE_PREFIX}${currentYear}_Q${currentSeason}`;
        const existingCold: Record<string, unknown>[] =
            (await this.adapter.get<Record<string, unknown>[]>(coldKey)) ?? [];
        // 避免重複：以 uid 為 key merge
        const coldMap = new Map(existingCold.map(c => [c['id'] ?? c['uid'], c]));
        for (const c of coldData) {
            coldMap.set(c['id'] ?? c['uid'], c);
        }
        await this.adapter.set(coldKey, Array.from(coldMap.values()));

        const result: RollupResult = {
            season: currentSeason,
            year: currentYear,
            rolledUpCount: coldData.length,
            coldArchiveKey: coldKey,
            executedAt: Date.now(),
        };

        // 記錄歷史
        await this._appendHistory(result);

        return result;
    }

    /**
     * 從 cold archive 還原某個武將的完整資料（如開啟人物詳情 L3 時）。
     */
    public async restoreFromCold(uid: string, season: number, year: number): Promise<Record<string, unknown> | null> {
        const coldKey = `${STORE_COLD_ARCHIVE_PREFIX}${year}_Q${season}`;
        const coldData: Record<string, unknown>[] =
            (await this.adapter.get<Record<string, unknown>[]>(coldKey)) ?? [];
        return coldData.find(c => c['id'] === uid || c['uid'] === uid) ?? null;
    }

    /**
     * 取得所有 rollup 歷史記錄。
     */
    public async getRollupHistory(): Promise<RollupResult[]> {
        return (await this.adapter.get<RollupResult[]>(STORE_ROLLUP_HISTORY)) ?? [];
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private _extractHotFields(g: Record<string, unknown>): Record<string, unknown> {
        // 只保留玩法必要欄位
        const HOT_KEYS = new Set([
            'id', 'uid', 'name', 'faction', 'stats', 'str', 'int', 'lea', 'pol', 'cha', 'luk',
            'gene_refs', 'ep', 'rarityTier', 'characterCategory',
            'parentUids', 'isAlive', 'isHistorical', 'age',
        ]);
        const hot: Record<string, unknown> = {};
        for (const key of HOT_KEYS) {
            if (key in g) hot[key] = g[key];
        }
        return hot;
    }

    private async _appendHistory(result: RollupResult): Promise<void> {
        const history = await this.getRollupHistory();
        history.push(result);
        // 只保留最近 20 季的歷史記錄
        const trimmed = history.slice(-20);
        await this.adapter.set(STORE_ROLLUP_HISTORY, trimmed);
    }
}
