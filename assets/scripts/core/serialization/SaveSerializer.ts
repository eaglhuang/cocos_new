/**
 * SaveSerializer.ts
 * 
 * 整合 MsgpackCodec + GzipCodec 的存檔序列化管線。
 * 提供 serialize(data) → Uint8Array 與 deserialize(bytes) → object。
 * 同時實作 JSON 欄位縮寫映射（壓縮模式/展開模式雙向轉換）。
 * 
 * Unity 對照：類似 PlayerPrefs + BinaryFormatter 的組合，
 * 但採用 MessagePack + gzip 雙層壓縮，達到更高壓縮率。
 * 
 * 壓縮管線：
 *   object → 欄位縮寫 → MsgpackCodec.encode → GzipCodec.compress → Uint8Array
 * 解壓管線：
 *   Uint8Array → GzipCodec.decompress → MsgpackCodec.decode → 欄位展開 → object
 * 
 * 目標：2MB JSON → serialize → < 500KB
 */

import { MsgpackCodec } from './MsgpackCodec';
import { GzipCodec } from './GzipCodec';

// 欄位縮寫映射表（由 field-abbreviation-map.json 載入，此處為快取）
let _expandToAbbr: Record<string, string> = {};
let _abbrToExpand: Record<string, string> = {};
let _mapLoaded = false;

export class SaveSerializer {

    /**
     * 初始化縮寫映射表（需在 App 啟動時呼叫一次）。
     * @param expandToAbbr 展開名 → 縮寫 映射
     * @param abbrToExpand 縮寫 → 展開名 映射
     */
    public static initAbbreviationMap(
        expandToAbbr: Record<string, string>,
        abbrToExpand: Record<string, string>
    ): void {
        _expandToAbbr = expandToAbbr;
        _abbrToExpand = abbrToExpand;
        _mapLoaded = true;
    }

    /**
     * 序列化：object → 欄位縮寫 → MessagePack → gzip → Uint8Array
     * @param data 要序列化的資料
     * @returns 壓縮後的 Uint8Array
     */
    public static serialize(data: unknown): Uint8Array {
        const abbreviated = _mapLoaded ? SaveSerializer._abbreviateKeys(data) : data;
        const packed = MsgpackCodec.encode(abbreviated);
        return GzipCodec.compress(packed);
    }

    /**
     * 反序列化：Uint8Array → gzip 解壓 → MessagePack 解碼 → 欄位展開 → object
     * @param bytes 壓縮的 Uint8Array
     * @returns 解壓後的物件
     */
    public static deserialize<T = unknown>(bytes: Uint8Array): T {
        const unpacked = GzipCodec.decompress(bytes);
        const decoded = MsgpackCodec.decode<unknown>(unpacked);
        return (_mapLoaded ? SaveSerializer._expandKeys(decoded) : decoded) as T;
    }

    /**
     * 計算壓縮效率報告（dev 用）。
     */
    public static compressionReport(data: unknown): {
        originalJsonBytes: number;
        serializedBytes: number;
        ratio: number;
    } {
        const jsonStr = JSON.stringify(data);
        const encoder = new TextEncoder();
        const originalBytes = encoder.encode(jsonStr).byteLength;
        const serializedBytes = SaveSerializer.serialize(data).byteLength;
        return {
            originalJsonBytes: originalBytes,
            serializedBytes: serializedBytes,
            ratio: serializedBytes / originalBytes,
        };
    }

    // ---- 私有輔助方法 ----

    /** 遞迴將所有物件 key 替換為縮寫 */
    private static _abbreviateKeys(data: unknown): unknown {
        if (Array.isArray(data)) {
            return data.map(item => SaveSerializer._abbreviateKeys(item));
        }
        if (data !== null && typeof data === 'object') {
            const result: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
                const abbr = _expandToAbbr[key] ?? key;
                result[abbr] = SaveSerializer._abbreviateKeys(val);
            }
            return result;
        }
        return data;
    }

    /** 遞迴將所有縮寫 key 展開為完整名稱 */
    private static _expandKeys(data: unknown): unknown {
        if (Array.isArray(data)) {
            return data.map(item => SaveSerializer._expandKeys(item));
        }
        if (data !== null && typeof data === 'object') {
            const result: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
                const expanded = _abbrToExpand[key] ?? key;
                result[expanded] = SaveSerializer._expandKeys(val);
            }
            return result;
        }
        return data;
    }
}
