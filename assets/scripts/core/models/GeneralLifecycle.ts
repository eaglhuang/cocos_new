/**
 * GeneralLifecycle.ts
 *
 * 武將資料生命周期分類系統（A/B/C/D）。
 * 依據 §2.6 長局單機資料生命周期策略規格（2026-04-08）。
 *
 * Unity 對照：類似 GameObject 的 ActiveSelf + tag 組合，
 * 決定一個物件應該保持 active、pooled、archived 還是 destroyed。
 *
 * A：史實武將 — 世界觀常駐資產，永不硬刪除
 * B：動態後裔（存活）— 可回收；只保留 hot fields，cold data 季結歸檔
 * C：動態後裔（已故）— 轉 SpiritCard + 進 pending-delete 隔離層
 * D：不可再復活的後裔 — 符合條件後批次 GC 清除完整主體
 */

/** 武將生命周期分類 */
export const enum GeneralLifecycleClass {
    /** A：史實名將（永久保留，只做熱資料釋放） */
    Historical = 'A',
    /** B：動態後裔，存活中（hot/cold 分層存儲） */
    DynamicAlive = 'B',
    /** C：動態後裔，已故（SpiritCard 快照 + pending-delete 隔離） */
    DynamicDead = 'C',
    /** D：不可復活後裔（批次 GC 候選，最終只保留血脈摘要） */
    Unrecoverable = 'D',
}

/**
 * 分類時需要的輔助資訊。
 * 呼叫端提供，不存進 SpiritCard（避免循環依賴 + 資料過時）。
 */
export interface ClassifyOptions {
    /** 是否為史實武將（由 master data 的 isHistorical 欄位決定） */
    isHistorical: boolean;
    /** 是否已死亡 */
    isDead: boolean;
    /** 是否有存活的直系後代（需要查 BloodlineGraph） */
    hasLivingDescendants: boolean;
    /** 是否在復活池候選名單 */
    isResurrectionCandidate: boolean;
    /** 是否有未結算的任務/事件/合約引用 */
    hasPendingReferences: boolean;
}

/**
 * 純函式：依據武將狀態判斷生命周期分類。
 *
 * 優先序：A > B > C > D
 * - A：isHistorical
 * - B：非史實 + 未死亡
 * - C：非史實 + 已死亡 + (有後代 OR 有復活資格 OR 有未結算引用)
 * - D：非史實 + 已死亡 + 所有 C 條件均不滿足
 */
export function classifyGeneral(opts: ClassifyOptions): GeneralLifecycleClass {
    if (opts.isHistorical) {
        return GeneralLifecycleClass.Historical;
    }
    if (!opts.isDead) {
        return GeneralLifecycleClass.DynamicAlive;
    }
    if (
        opts.hasLivingDescendants ||
        opts.isResurrectionCandidate ||
        opts.hasPendingReferences
    ) {
        return GeneralLifecycleClass.DynamicDead;
    }
    return GeneralLifecycleClass.Unrecoverable;
}

/**
 * 判斷武將死亡時是否應保留完整主體（不進 pending-delete）。
 * 史實武將（A 類）死亡後只做熱資料釋放，不進隔離層。
 */
export function shouldPreserveFullBody(cls: GeneralLifecycleClass): boolean {
    return cls === GeneralLifecycleClass.Historical;
}

/**
 * 判斷武將是否可立即進入 pending-delete 隔離層。
 */
export function canEnterPendingDelete(cls: GeneralLifecycleClass): boolean {
    return cls === GeneralLifecycleClass.DynamicDead || cls === GeneralLifecycleClass.Unrecoverable;
}
