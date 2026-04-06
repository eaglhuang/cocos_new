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
     * 歸檔一位死亡武將。
     * @param general 武將資料
     * @param deathContext 死亡情境
     * @returns 建立的 SpiritCard
     */
    public async archive(general: GeneralUnitMinimal, deathContext: DeathContext): Promise<SpiritCard> {
        // 1. 建立 SpiritCard 快照
        const card: SpiritCard = {
            uid: general.id,
            name: general.name,
            faction: general.faction,
            characterCategory: (general.characterCategory as SpiritCard['characterCategory']) ?? 'other',
            rarityTier: (general.rarityTier as SpiritCard['rarityTier']) ?? 'C',
            gene_refs: (general.genes ?? []).map(g => g.id).filter(Boolean),
            ep_snapshot: general.ep ?? 0,
            ageAtDeath: general.age,
            deathContext,
            archivedAt: Date.now(),
        };

        // 2. 儲存 SpiritCard
        const cards: SpiritCard[] = (await this.adapter.get<SpiritCard[]>(STORE_SPIRIT_CARDS)) ?? [];
        const existIdx = cards.findIndex(c => c.uid === card.uid);
        if (existIdx >= 0) {
            cards[existIdx] = card;
        } else {
            cards.push(card);
        }
        await this.adapter.set(STORE_SPIRIT_CARDS, cards);

        // 3. 將完整武將資料移至 L5 歸檔
        const archive: Record<string, unknown>[] = (await this.adapter.get<Record<string, unknown>[]>(STORE_ARCHIVE_L5)) ?? [];
        const archiveIdx = archive.findIndex(g => g['id'] === general.id);
        if (archiveIdx >= 0) {
            archive[archiveIdx] = general as Record<string, unknown>;
        } else {
            archive.push(general as Record<string, unknown>);
        }
        await this.adapter.set(STORE_ARCHIVE_L5, archive);

        // 4. 從 L1 活躍清單移除
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
