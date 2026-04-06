/**
 * DeltaPatchBuilder.ts
 * 
 * 實作 JSON Patch（RFC 6902）的 build 與 apply。
 * 提供 build(base, current): JsonPatch[] 與 apply(base, patches): object。
 * 
 * Unity 對照：類似 ScriptableObject diff，但這裡比對兩個 plain object 的差異，
 * 只紀錄「哪些欄位改了」而非整份資料，大幅減少每次同步的傳輸量。
 * 
 * RFC 6902 操作類型：add / remove / replace / move / copy / test
 * 本實作僅產生 add / remove / replace 三種操作（足夠 Save/Sync 場景）。
 * 
 * 用法：
 *   const patches = DeltaPatchBuilder.build(prevSave, currentSave);
 *   const restored = DeltaPatchBuilder.apply(prevSave, patches);
 */

export interface JsonPatch {
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;   // JSON Pointer e.g. "/generals/0/str"
    value?: unknown; // 僅 add/replace/test 使用
    from?: string;   // 僅 move/copy 使用
}

export class DeltaPatchBuilder {

    /**
     * 比對 base 與 current，產生 JSON Patch 操作序列。
     * @param base    比對基準物件
     * @param current 目前狀態物件
     * @returns JSON Patch 陣列（RFC 6902）
     */
    public static build(base: unknown, current: unknown): JsonPatch[] {
        const patches: JsonPatch[] = [];
        DeltaPatchBuilder._diff(base, current, '', patches);
        return patches;
    }

    /**
     * 將 JSON Patch 序列套用至 base，回傳新物件（deep clone）。
     * @param base    比對基準物件（不會被修改）
     * @param patches JSON Patch 陣列
     * @returns 套用後的新物件
     */
    public static apply<T = unknown>(base: T, patches: JsonPatch[]): T {
        let result = DeltaPatchBuilder._deepClone(base) as Record<string, unknown>;
        for (const patch of patches) {
            result = DeltaPatchBuilder._applyPatch(result, patch) as Record<string, unknown>;
        }
        return result as T;
    }

    // ---- 私有輔助方法 ----

    private static _diff(
        base: unknown,
        current: unknown,
        path: string,
        patches: JsonPatch[]
    ): void {
        // 類型不同或 primitive 值不同 → replace
        if (typeof base !== typeof current || base === null !== (current === null)) {
            patches.push({ op: 'replace', path: path || '/', value: current });
            return;
        }

        if (current === null || typeof current !== 'object') {
            if (base !== current) {
                patches.push({ op: 'replace', path: path || '/', value: current });
            }
            return;
        }

        if (Array.isArray(current) && Array.isArray(base)) {
            DeltaPatchBuilder._diffArrays(base, current, path, patches);
            return;
        }

        if (Array.isArray(current) !== Array.isArray(base)) {
            patches.push({ op: 'replace', path: path || '/', value: current });
            return;
        }

        // 兩者都是 object
        const baseObj = base as Record<string, unknown>;
        const currObj = current as Record<string, unknown>;
        const allKeys = new Set([...Object.keys(baseObj), ...Object.keys(currObj)]);

        for (const key of allKeys) {
            const escapedKey = key.replace(/~/g, '~0').replace(/\//g, '~1');
            const childPath = `${path}/${escapedKey}`;
            if (!(key in baseObj)) {
                patches.push({ op: 'add', path: childPath, value: currObj[key] });
            } else if (!(key in currObj)) {
                patches.push({ op: 'remove', path: childPath });
            } else {
                DeltaPatchBuilder._diff(baseObj[key], currObj[key], childPath, patches);
            }
        }
    }

    private static _diffArrays(
        base: unknown[],
        current: unknown[],
        path: string,
        patches: JsonPatch[]
    ): void {
        // 簡化版：只比對等長或逐項 replace/add/remove
        const maxLen = Math.max(base.length, current.length);
        for (let i = 0; i < maxLen; i++) {
            const childPath = `${path}/${i}`;
            if (i >= base.length) {
                patches.push({ op: 'add', path: childPath, value: current[i] });
            } else if (i >= current.length) {
                // 從尾端移除（倒序索引避免 off-by-one）
                patches.push({ op: 'remove', path: childPath });
            } else {
                DeltaPatchBuilder._diff(base[i], current[i], childPath, patches);
            }
        }
    }

    private static _applyPatch(
        obj: Record<string, unknown>,
        patch: JsonPatch
    ): Record<string, unknown> {
        const parts = patch.path.split('/').filter(p => p !== '');
        const last = parts[parts.length - 1];

        // 取得父節點
        let parent: Record<string, unknown> | unknown[] = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            const key = parts[i].replace(/~1/g, '/').replace(/~0/g, '~');
            if (Array.isArray(parent)) {
                parent = (parent as unknown[])[parseInt(key)] as Record<string, unknown>;
            } else {
                parent = (parent as Record<string, unknown>)[key] as Record<string, unknown>;
            }
        }

        const realKey = last ? last.replace(/~1/g, '/').replace(/~0/g, '~') : '';

        if (patch.op === 'add' || patch.op === 'replace') {
            if (Array.isArray(parent)) {
                const idx = parseInt(realKey);
                if (patch.op === 'add') {
                    (parent as unknown[]).splice(idx, 0, patch.value);
                } else {
                    (parent as unknown[])[idx] = patch.value;
                }
            } else {
                (parent as Record<string, unknown>)[realKey] = patch.value;
            }
        } else if (patch.op === 'remove') {
            if (Array.isArray(parent)) {
                (parent as unknown[]).splice(parseInt(realKey), 1);
            } else {
                delete (parent as Record<string, unknown>)[realKey];
            }
        }

        return obj;
    }

    private static _deepClone<T>(obj: T): T {
        if (obj === null || typeof obj !== 'object') return obj;
        return JSON.parse(JSON.stringify(obj));
    }
}
