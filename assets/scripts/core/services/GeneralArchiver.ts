/**
 * GeneralArchiver.ts
 * 
 * 武將歸檔服務：武將死亡時建立 SpiritCard 快照，
 * 主體資料移至 L5 歸檔層，並從 L1 活躍列表移除。
 * 
 * Unity 對照：類似自訂的 "PoolManager.Despawn()" + "RecordSystem.Archive()"，
 * 在 Unity 中通常手動管理，這裡以服務類封裝所有歸檔流程。
 * 
 * 歸檔流程：
 *   1. 接收 GeneralUnit 物件與 DeathContext
 *   2. 建立 SpiritCard 快照
 *   3. 將完整 GeneralUnit 存入 L5 歸檔儲存
 *   4. 從 L1 活躍列表移除
 *   5. 通知 MemoryManager 釋放相關記憶體
 */

import { DataStorageAdapter } from '../storage/DataStorageAdapter';
import { SpiritCard, DeathContext } from '../models/SpiritCard';
import {
    GeneralLifecycleClass,
    classifyGeneral,
    ClassifyOptions,
} from '../models/GeneralLifecycle';
import { PendingDeleteStore } from './PendingDeleteStore';

// 簡化的武將資料介面（避免循環依賴）
interface GeneralUnitMinimal {
    id: string;
    name: string;
    faction: string;
    characterCategory?: string;
    rarityTier?: string;
    genes?: Array<{ id: string }>;
    ep?: number;
    age?: number;
    parentUids?: [string, string];
    birthYear?: number;
    deathYear?: number;
    [key: string]: unknown;
}

const STORE_SPIRIT_CARDS = 'spirit_cards';
const STORE_ARCHIVE_L5 = 'generals_archive_l5';
const STORE_ACTIVE_IDS = 'generals_active_ids';

export class GeneralArchiver {
    private adapter: DataStorageAdapter;

    constructor(adapter: DataStorageAdapter) {
        this.adapter = adapter;
    }

    /**
     * 歸檔一位死亡武將（含 A/B/C/D 生命周期路由）。
     *
     * @param general 武將資料
     * @param deathContext 死亡情境
     * @param classifyOpts ABCD 分類選項；省略時根據 general 欄位自動推斷
     * @param seasonCtx 當前季節情境（C/D 類加入 PendingDeleteStore 所需）
     * @returns 建立的 SpiritCard
     */
    public async archive(
        general: GeneralUnitMinimal,
        deathContext: DeathContext,
        classifyOpts?: Partial<ClassifyOptions>,
        seasonCtx?: { season: number; year: number; retentionSeasons?: number },
    ): Promise<SpiritCard> {
        // ─── 1. 分類 ───────────────────────────────────────────────────────────
        const opts: ClassifyOptions = {
            isHistorical: Boolean(general['isHistorical']),
            isDead: true,
            hasLivingDescendants: Boolean(general['hasLivingDescendants']),
            isResurrectionCandidate: Boolean(general['isResurrectionCandidate']),
            hasPendingReferences: Boolean(general['hasPendingReferences']),
            ...classifyOpts,
        };
        const lifecycleClass = classifyGeneral(opts);

        // ─── 2. 建立 SpiritCard 快照 ──────────────────────────────────────────
        const card: SpiritCard = {
            uid: general.id,
            name: general.name,
            faction: general.faction,
            characterCategory: (general.characterCategory as SpiritCard['characterCategory']) ?? 'other',
            rarityTier: (general.rarityTier as SpiritCard['rarityTier']) ?? 'common',
            gene_refs: (general.genes ?? []).map(g => g.id).filter(Boolean),
            ep_snapshot: general.ep ?? 0,
            ageAtDeath: general.age,
            deathContext,
            archivedAt: Date.now(),
            lifecycleClass,
            resurrectionEligible: opts.isResurrectionCandidate,
            parentUids: general.parentUids ?? ['', ''],
            birthYear: general.birthYear,
            deathYear: general.deathYear,
        };

        // ─── 3. 儲存 SpiritCard ────────────────────────────────────────────────
        const cards: SpiritCard[] = (await this.adapter.get<SpiritCard[]>(STORE_SPIRIT_CARDS)) ?? [];
        const existIdx = cards.findIndex(c => c.uid === card.uid);
        if (existIdx >= 0) {
            cards[existIdx] = card;
        } else {
            cards.push(card);
        }
        await this.adapter.set(STORE_SPIRIT_CARDS, cards);

        // ─── 4. L5 歸檔（A 類史實只保留，B/C/D 類完整移入 L5）────────────────
        //   A 類：完整保留（`shouldPreserveFullBody` = true），但仍轉移至 L5
        //   C/D 類：送入 PendingDeleteStore 隔離
        const archive: Record<string, unknown>[] = (await this.adapter.get<Record<string, unknown>[]>(STORE_ARCHIVE_L5)) ?? [];
        const archiveIdx = archive.findIndex(g => g['id'] === general.id);
        if (archiveIdx >= 0) {
            archive[archiveIdx] = general as Record<string, unknown>;
        } else {
            archive.push(general as Record<string, unknown>);
        }
        await this.adapter.set(STORE_ARCHIVE_L5, archive);

        // ─── 5. C/D 類：送入 PendingDeleteStore 隔離 ─────────────────────────
        if (
            (lifecycleClass === GeneralLifecycleClass.DynamicDead ||
                lifecycleClass === GeneralLifecycleClass.Unrecoverable) &&
            seasonCtx
        ) {
            const pds = PendingDeleteStore.getInstance(this.adapter);
            await pds.enqueue(card, seasonCtx.season, seasonCtx.year, seasonCtx.retentionSeasons ?? 2);
        }

        // ─── 6. 從 L1 活躍清單移除 ───────────────────────────────────────────
        const activeIds: string[] = (await this.adapter.get<string[]>(STORE_ACTIVE_IDS)) ?? [];
        const filteredIds = activeIds.filter(id => id !== general.id);
        if (filteredIds.length !== activeIds.length) {
            await this.adapter.set(STORE_ACTIVE_IDS, filteredIds);
        }

        return card;
    }

    /**
     * 從 uid 反查完整歸檔武將資料。
     */
    public async getArchivedGeneral(uid: string): Promise<Record<string, unknown> | null> {
        const archive: Record<string, unknown>[] = (await this.adapter.get<Record<string, unknown>[]>(STORE_ARCHIVE_L5)) ?? [];
        return archive.find(g => g['id'] === uid) ?? null;
    }

    /**
     * 取得所有 SpiritCard。
     */
    public async getAllSpiritCards(): Promise<SpiritCard[]> {
        return (await this.adapter.get<SpiritCard[]>(STORE_SPIRIT_CARDS)) ?? [];
    }

    /**
     * 以 uid 取得 SpiritCard。
     */
    public async getSpiritCard(uid: string): Promise<SpiritCard | null> {
        const cards = await this.getAllSpiritCards();
        return cards.find(c => c.uid === uid) ?? null;
    }
}
