/**
 * SaveSerializer.ts
 *
 * 存檔序列化 + 壓縮管線：
 *   serialize:   欄位縮寫 → MsgpackCodec.encode → GzipCodec.compress → Uint8Array
 *   deserialize: GzipCodec.decompress → MsgpackCodec.decode → 欄位展開 → object
 *
 * 效能目標：2MB JSON → < 500KB；deserialize < 50ms（中期存檔）
 *
 * Unity 對照：類似 BinaryFormatter + GZipStream 管線，但輸出可跨平台驗證。
 *
 * 使用方式：
 *   // App 啟動時（一次性初始化）
 *   const mapJson = await loadAbbrevMap(); // 從 cc.resources 或 JSON import
 *   SaveSerializer.setAbbreviationMap(mapJson);
 *
 *   const bytes = SaveSerializer.serialize(saveData);
 *   const restored = SaveSerializer.deserialize<MySaveType>(bytes);
 */

import { MsgpackCodec } from '../serialization/MsgpackCodec';
import { GzipCodec } from '../serialization/GzipCodec';

// ─── 型別定義 ─────────────────────────────────────────────────────────────────

export interface FieldAbbreviationMap {
    /** 展開名 → 縮寫名，序列化時使用 */
    expand_to_abbr: Record<string, string>;
    /** 縮寫名 → 展開名，反序列化時使用 */
    abbr_to_expand: Record<string, string>;
}

export interface SerializeOptions {
    /**
     * 是否啟用欄位縮寫壓縮（預設 true）。
     * 設為 false 可暫時關閉，但會降低壓縮率約 10-20%。
     */
    useAbbreviation?: boolean;
}

export interface CompressionInfo {
    /** 原始 JSON 字串位元組數 */
    originalBytes: number;
    /** 序列化後位元組數 */
    serializedBytes: number;
    /** 壓縮率 0-1（越小越好） */
    ratio: number;
    /** 節省空間百分比 */
    savedPercent: number;
    /** msgpack 使用中（false 表示 JSON fallback） */
    msgpackActive: boolean;
    /** gzip 使用中（false 表示 passthrough fallback） */
    gzipActive: boolean;
}

// ─── 私有工具函式 ─────────────────────────────────────────────────────────────

/**
 * 深度遍歷物件，對所有 key 套用縮寫映射（expand → abbr）。
 * Array 元素與 object value 遞迴處理；primitive 直接回傳。
 */
function abbreviateObject(
    value: unknown,
    map: Record<string, string>,
): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => abbreviateObject(item, map));
    }
    if (value !== null && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(value as Record<string, unknown>)) {
            const newKey = map[key] ?? key;
            result[newKey] = abbreviateObject(
                (value as Record<string, unknown>)[key],
                map,
            );
        }
        return result;
    }
    return value;
}

/**
 * 深度遍歷物件，對所有 key 套用展開映射（abbr → expand）。
 */
function expandObject(
    value: unknown,
    map: Record<string, string>,
): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => expandObject(item, map));
    }
    if (value !== null && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(value as Record<string, unknown>)) {
            const newKey = map[key] ?? key;
            result[newKey] = expandObject(
                (value as Record<string, unknown>)[key],
                map,
            );
        }
        return result;
    }
    return value;
}

// ─── SaveSerializer ───────────────────────────────────────────────────────────

export class SaveSerializer {

    private static _abbreviationMap: FieldAbbreviationMap | null = null;

    // ─── 初始化 ──────────────────────────────────────────────────────────────

    /**
     * 注入欄位縮寫映射表。
     * 建議在 App 啟動時呼叫一次（讀取 field-abbreviation-map.json 之後）。
     *
     * @param map FieldAbbreviationMap（從 assets/resources/data/field-abbreviation-map.json 載入）
     */
    public static setAbbreviationMap(map: FieldAbbreviationMap): void {
        const hasExpand = map?.expand_to_abbr && typeof map.expand_to_abbr === 'object';
        const hasAbbr = map?.abbr_to_expand && typeof map.abbr_to_expand === 'object';
        if (!hasExpand || !hasAbbr) {
            console.warn('[SaveSerializer] setAbbreviationMap: 傳入的 map 格式不正確，已忽略。');
            return;
        }
        SaveSerializer._abbreviationMap = map;
    }

    /**
     * 清除已設定的縮寫映射表（測試或重設用）。
     */
    public static clearAbbreviationMap(): void {
        SaveSerializer._abbreviationMap = null;
    }

    /**
     * 回傳當前是否已注入縮寫映射表。
     */
    public static get hasAbbreviationMap(): boolean {
        return SaveSerializer._abbreviationMap !== null;
    }

    // ─── 序列化 ──────────────────────────────────────────────────────────────

    /**
     * 將存檔物件序列化為壓縮二進位（Uint8Array）。
     *
     * 管線：data → [欄位縮寫] → MsgpackCodec.encode → GzipCodec.compress → Uint8Array
     *
     * @param data 要序列化的存檔物件
     * @param options SerializeOptions（可省略）
     * @returns 壓縮後的 Uint8Array
     */
    public static serialize(data: object, options?: SerializeOptions): Uint8Array {
        const useAbbr = options?.useAbbreviation !== false;

        let processed: unknown = data;

        // Step 1: 欄位縮寫
        if (useAbbr && SaveSerializer._abbreviationMap) {
            processed = abbreviateObject(data, SaveSerializer._abbreviationMap.expand_to_abbr);
        }

        // Step 2: MsgPack 序列化
        const msgpackBytes = MsgpackCodec.encode(processed);

        // Step 3: Gzip 壓縮
        return GzipCodec.compress(msgpackBytes);
    }

    // ─── 反序列化 ─────────────────────────────────────────────────────────────

    /**
     * 將壓縮二進位還原為存檔物件。
     *
     * 管線：Uint8Array → GzipCodec.decompress → MsgpackCodec.decode → [欄位展開] → T
     *
     * @param bytes 壓縮的 Uint8Array
     * @param options SerializeOptions（可省略；需與 serialize 時一致）
     * @returns 還原後的物件
     */
    public static deserialize<T = unknown>(bytes: Uint8Array, options?: SerializeOptions): T {
        const useAbbr = options?.useAbbreviation !== false;

        // Step 1: Gzip 解壓
        const msgpackBytes = GzipCodec.decompress(bytes);

        // Step 2: MsgPack 反序列化
        const decoded = MsgpackCodec.decode<unknown>(msgpackBytes);

        // Step 3: 欄位展開
        if (useAbbr && SaveSerializer._abbreviationMap) {
            return expandObject(decoded, SaveSerializer._abbreviationMap.abbr_to_expand) as T;
        }

        return decoded as T;
    }

    // ─── 工具函式 ─────────────────────────────────────────────────────────────

    /**
     * 來回驗證（serialize → deserialize），確保無資料損失。
     * 僅限 dev 模式建議使用。
     *
     * @param data 要驗證的物件
     * @returns true 表示來回一致
     */
    public static roundTripCheck(data: object): boolean {
        try {
            const bytes = SaveSerializer.serialize(data);
            const restored = SaveSerializer.deserialize<unknown>(bytes);
            return JSON.stringify(data) === JSON.stringify(restored);
        } catch (e) {
            console.error('[SaveSerializer] roundTripCheck failed:', e);
            return false;
        }
    }

    /**
     * 計算並回傳壓縮資訊（用於 debug 或效能監控）。
     *
     * @param data 原始存檔物件
     * @returns CompressionInfo
     */
    public static compressionInfo(data: object): CompressionInfo {
        const originalJson = JSON.stringify(data);
        const originalBytes = new TextEncoder().encode(originalJson).byteLength;

        const serialized = SaveSerializer.serialize(data);
        const serializedBytes = serialized.byteLength;

        const ratio = originalBytes > 0 ? serializedBytes / originalBytes : 0;
        const savedPercent = Math.round((1 - ratio) * 100);

        // 偵測 msgpack / gzip 是否實際生效
        // 方法：序列化一個小物件，若無縮寫下序列化結果比 JSON 小，表示 msgpack 生效
        // 若結果含 gzip magic bytes (1f 8b)，表示 gzip 生效
        const msgpackActive = SaveSerializer._probeMsgpackActive();
        const gzipActive = serialized.length >= 2 && serialized[0] === 0x1f && serialized[1] === 0x8b;

        return { originalBytes, serializedBytes, ratio, savedPercent, msgpackActive, gzipActive };
    }

    /**
     * 不帶縮寫的純 JSON 序列化（安全降級，用於 debug dump 或 fallback export）。
     * 不使用 msgpack/gzip，輸出可直接用 JSON.parse 讀回。
     */
    public static serializeToJsonBytes(data: object): Uint8Array {
        return new TextEncoder().encode(JSON.stringify(data));
    }

    /**
     * 從純 JSON bytes 還原（配合 serializeToJsonBytes 使用）。
     */
    public static deserializeFromJsonBytes<T = unknown>(bytes: Uint8Array): T {
        return JSON.parse(new TextDecoder().decode(bytes)) as T;
    }

    // ─── Private helpers ───────────────────────────────────────────────────

    /** 探測 MsgpackCodec 是否真的使用 msgpack（而非 JSON fallback） */
    private static _probeMsgpackActive(): boolean {
        try {
            const probe = { x: 1 };
            const msgpackBytes = MsgpackCodec.encode(probe);
            // msgpack 的 fixmap(1) + fixstr("x") + 1 應為 3 bytes；JSON 是 7 bytes
            return msgpackBytes.byteLength < 7;
        } catch {
            return false;
        }
    }
}
