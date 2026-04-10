/**
 * BranchCompactor.ts
 *
 * 已滅絕支系壓縮服務（Phase 3）：
 *   - 偵測已全滅（所有後裔均為 D 類或 D 類且無存活後代）的支系
 *   - 對已滅絕支系進行壓縮：保留 FamilyBranchSummary 摘要，清除個體 full body
 *   - 年底時由 DataLifecycleScheduler 觸發
 *
 * Unity 對照：類似批次清除 Instance pool，只留輕型摘要，
 * 釋放大量 heavy instance 的 memory footprint。
 *
 * §2.6 規格：
 *   - 已滅絕支系只保留 FamilyBranchSummary 摘要
 *   - 清除個體 full body（L5 archive 中的資料）
 *   - lineageNodes 僅保留必要的譜系節點
 */

import { DataStorageAdapter } from '../storage/DataStorageAdapter';
import { FamilyBranchSummary, LineageNode } from '../models/FamilyBranchSummary';
import { GeneralLifecycleClass } from '../models/GeneralLifecycle';
import { SpiritCard } from '../models/SpiritCard';

const STORE_ARCHIVE_L5 = 'generals_archive_l5';
const STORE_SPIRIT_CARDS = 'spirit_cards';
const STORE_BRANCH_SUMMARIES = 'branch_summaries';
const STORE_COMPACTION_LOG = 'compaction_log';

export interface CompactionResult {
    compactedBranchCount: number;
    removedFullBodyCount: number;
    summariesWritten: number;
    executedAt: number;
}

export class BranchCompactor {
    private static _instance: BranchCompactor | null = null;
    private readonly adapter: DataStorageAdapter;

    constructor(adapter: DataStorageAdapter) {
        this.adapter = adapter;
    }

    static getInstance(adapter: DataStorageAdapter): BranchCompactor {
        if (!BranchCompactor._instance) {
            BranchCompactor._instance = new BranchCompactor(adapter);
        }
        return BranchCompactor._instance;
    }

    /**
     * 偵測所有已全滅支系（所有成員均為 D 類或全為死亡且無存活後裔）。
     * @returns 已滅絕支系的根 uid 列表
     */
    public async detectExtinctBranches(): Promise<string[]> {
        const archive: Record<string, unknown>[] =
            (await this.adapter.get<Record<string, unknown>[]>(STORE_ARCHIVE_L5)) ?? [];

        const spiritCards: SpiritCard[] =
            (await this.adapter.get<SpiritCard[]>(STORE_SPIRIT_CARDS)) ?? [];

        const cardsByUid = new Map(spiritCards.map(c => [c.uid, c as unknown as Record<string, unknown>]));

        // 找出所有 parentUids 為空（即根人物）的死亡武將 uid
        const rootUids: string[] = [];
        for (const g of archive) {
            const pUids = (g['parentUids'] as [string, string] | undefined) ?? ['', ''];
            if (!pUids[0] && !pUids[1]) {
                rootUids.push(g['id'] as string ?? g['uid'] as string);
            }
        }

        const extinctRoots: string[] = [];
        for (const rootUid of rootUids) {
            if (await this._isBranchExtinct(rootUid, archive, cardsByUid)) {
                extinctRoots.push(rootUid);
            }
        }

        return extinctRoots;
    }

    /**
     * 壓縮一個已滅絕的支系：建立 FamilyBranchSummary，清除 L5 full body。
     */
    public async compactBranch(rootUid: string): Promise<FamilyBranchSummary> {
        const archive: Record<string, unknown>[] =
            (await this.adapter.get<Record<string, unknown>[]>(STORE_ARCHIVE_L5)) ?? [];

        const spiritCards: SpiritCard[] =
            (await this.adapter.get<SpiritCard[]>(STORE_SPIRIT_CARDS)) ?? [];

        const cardsByUid = new Map(spiritCards.map(c => [c.uid, c as unknown as Record<string, unknown>]));

        // 收集支系全部成員 uid
        const memberUids = this._collectBranchMembers(rootUid, archive);

        // 找出最高稀有度成員
        const highestRarityUid = this._findHighestRarity(memberUids, cardsByUid, archive);

        // 建立 lineageNodes（只保留譜系必要欄位）
        const lineageNodes: LineageNode[] = memberUids.map(uid => ({
            uid,
            parentUids: this._getParentUids(uid, archive),
            birthYear: this._getField<number>(uid, 'birthYear', archive),
            deathYear: this._getField<number>(uid, 'deathYear', archive),
            rarityTier: (this._getRarityTier(uid, cardsByUid, archive) ?? 'common') as LineageNode['rarityTier'],
        }));

        // 計算世代深度
        const generationCount = this._calcGenerationDepth(rootUid, archive);

        // 找出消滅年份
        const extinctAt = Math.max(
            ...memberUids
                .map(uid => this._getField<number>(uid, 'deathYear', archive) ?? 0)
        );

        const rootCard = cardsByUid.get(rootUid);
        const summary: FamilyBranchSummary = {
            branchRootUid: rootUid,
            branchName: this._getField<string>(rootUid, 'name', archive) ?? rootUid,
            extinctAt: extinctAt > 0 ? String(extinctAt) : '0',
            generationCount,
            memberCount: memberUids.length,
            highestRarityUid,
            geneHighlights: rootCard ? (rootCard['gene_refs'] as string[] ?? []).slice(0, 3) : [],
            representativeEvents: [],
            lineageNodes,
            compactedAt: Date.now(),
        };

        // 儲存 summary
        const summaries: FamilyBranchSummary[] =
            (await this.adapter.get<FamilyBranchSummary[]>(STORE_BRANCH_SUMMARIES)) ?? [];
        const existIdx = summaries.findIndex(s => s.branchRootUid === rootUid);
        if (existIdx >= 0) summaries[existIdx] = summary; else summaries.push(summary);
        await this.adapter.set(STORE_BRANCH_SUMMARIES, summaries);

        // 清除 L5 full body（保留 SpiritCard，只清 L5 原始資料）
        const remaining = archive.filter(g => !memberUids.includes(g['id'] as string ?? g['uid'] as string));
        await this.adapter.set(STORE_ARCHIVE_L5, remaining);

        return summary;
    }

    /**
     * 偵測所有滅絕支系並批次壓縮。
     */
    public async compactAll(): Promise<CompactionResult> {
        const extinctRoots = await this.detectExtinctBranches();
        let removedFullBodyCount = 0;

        for (const rootUid of extinctRoots) {
            const summary = await this.compactBranch(rootUid);
            removedFullBodyCount += summary.memberCount;
        }

        const result: CompactionResult = {
            compactedBranchCount: extinctRoots.length,
            removedFullBodyCount,
            summariesWritten: extinctRoots.length,
            executedAt: Date.now(),
        };

        await this._appendLog(result);
        return result;
    }

    /**
     * 取得所有已壓縮支系的 FamilyBranchSummary。
     */
    public async getAllSummaries(): Promise<FamilyBranchSummary[]> {
        return (await this.adapter.get<FamilyBranchSummary[]>(STORE_BRANCH_SUMMARIES)) ?? [];
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private async _isBranchExtinct(
        rootUid: string,
        archive: Record<string, unknown>[],
        cardsByUid: Map<string, Record<string, unknown>>,
    ): Promise<boolean> {
        const memberUids = this._collectBranchMembers(rootUid, archive);
        // 有任何一個 SpiritCard 的 lifecycleClass 不是 D 就不算滅絕
        for (const uid of memberUids) {
            const card = cardsByUid.get(uid);
            if (!card) continue;
            const cls = card['lifecycleClass'] as GeneralLifecycleClass | undefined;
            if (cls !== GeneralLifecycleClass.Unrecoverable && cls !== undefined) return false;
        }
        return memberUids.length > 0;
    }

    private _collectBranchMembers(rootUid: string, archive: Record<string, unknown>[]): string[] {
        const result: string[] = [];
        const queue = [rootUid];
        const seen = new Set<string>();
        while (queue.length > 0) {
            const uid = queue.shift()!;
            if (seen.has(uid)) continue;
            seen.add(uid);
            result.push(uid);
            // 找所有 parentUids 包含此 uid 的後代
            for (const g of archive) {
                const pUids = (g['parentUids'] as [string, string] | undefined) ?? ['', ''];
                if (pUids.includes(uid)) {
                    const childUid = (g['id'] ?? g['uid']) as string;
                    if (childUid) queue.push(childUid);
                }
            }
        }
        return result;
    }

    private _findHighestRarity(
        uids: string[],
        cardsByUid: Map<string, Record<string, unknown>>,
        archive: Record<string, unknown>[],
    ): string {
        const rarityOrder = ['mythic', 'legendary', 'epic', 'rare', 'common'];
        let best = uids[0] ?? '';
        let bestRank = rarityOrder.length;
        for (const uid of uids) {
            const tier = this._getRarityTier(uid, cardsByUid, archive) ?? 'common';
            const rank = rarityOrder.indexOf(tier);
            if (rank < bestRank) { bestRank = rank; best = uid; }
        }
        return best;
    }

    private _getRarityTier(
        uid: string,
        cardsByUid: Map<string, Record<string, unknown>>,
        archive: Record<string, unknown>[],
    ): string | undefined {
        return (cardsByUid.get(uid)?.['rarityTier'] ??
            archive.find(g => (g['id'] ?? g['uid']) === uid)?.['rarityTier']) as string | undefined;
    }

    private _getParentUids(uid: string, archive: Record<string, unknown>[]): [string, string] {
        const g = archive.find(r => (r['id'] ?? r['uid']) === uid);
        return (g?.['parentUids'] as [string, string]) ?? ['', ''];
    }

    private _getField<T>(uid: string, field: string, archive: Record<string, unknown>[]): T | undefined {
        const g = archive.find(r => (r['id'] ?? r['uid']) === uid);
        return g?.[field] as T | undefined;
    }

    private _calcGenerationDepth(rootUid: string, archive: Record<string, unknown>[]): number {
        let maxDepth = 0;
        const queue: Array<{ uid: string; depth: number }> = [{ uid: rootUid, depth: 1 }];
        const seen = new Set<string>();
        while (queue.length > 0) {
            const { uid, depth } = queue.shift()!;
            if (seen.has(uid)) continue;
            seen.add(uid);
            if (depth > maxDepth) maxDepth = depth;
            for (const g of archive) {
                const pUids = (g['parentUids'] as [string, string] | undefined) ?? ['', ''];
                if (pUids.includes(uid)) {
                    const childUid = (g['id'] ?? g['uid']) as string;
                    if (childUid) queue.push({ uid: childUid, depth: depth + 1 });
                }
            }
        }
        return maxDepth;
    }

    private async _appendLog(result: CompactionResult): Promise<void> {
        const log: CompactionResult[] = (await this.adapter.get<CompactionResult[]>(STORE_COMPACTION_LOG)) ?? [];
        log.push(result);
        await this.adapter.set(STORE_COMPACTION_LOG, log.slice(-12));
    }
}
