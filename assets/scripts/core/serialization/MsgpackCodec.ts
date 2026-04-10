/**
 * MsgpackCodec.ts
 * 
 * 封裝 @msgpack/msgpack 的 encode/decode，提供統一的序列化介面。
 * 相容 Cocos Creator 3.8 Web Preview（純 JS，無 WASM，無 Node.js built-in）。
 * 
 * Unity 對照：類似 Unity JsonUtility 或 BinaryFormatter，但效能更佳，
 * 輸出為 Uint8Array 二進位格式，比 JSON 約省 40-60% 體積。
 * 
 * 用法：
 *   const bytes = MsgpackCodec.encode({ uid: 'cao-cao', str: 95 });
 *   const obj = MsgpackCodec.decode<MyType>(bytes);
 */

type MsgpackModule = {
    encode(data: unknown): Uint8Array;
    decode<T = unknown>(bytes: Uint8Array): T;
};

let _msgpackModule: MsgpackModule | null | undefined;

function loadMsgpackModule(): MsgpackModule | null {
    if (_msgpackModule !== undefined) {
        return _msgpackModule;
    }

    const globalModule = (globalThis as { msgpack?: MsgpackModule }).msgpack;
    if (globalModule?.encode && globalModule?.decode) {
        _msgpackModule = globalModule;
        return _msgpackModule;
    }

    try {
        const requireFactory = Function('try { return typeof require !== "undefined" ? require : undefined; } catch { return undefined; }');
        const requireFn = requireFactory() as ((id: string) => unknown) | undefined;
        if (requireFn) {
            const module = requireFn('@msgpack/msgpack') as Partial<MsgpackModule>;
            if (module.encode && module.decode) {
                _msgpackModule = {
                    encode: module.encode.bind(module),
                    decode: module.decode.bind(module),
                };
                return _msgpackModule;
            }
        }
    } catch {
        // Ignore and use JSON fallback below.
    }

    _msgpackModule = null;
    return _msgpackModule;
}

function encodeJsonFallback(data: unknown): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(data));
}

function decodeJsonFallback<T>(bytes: Uint8Array): T {
    try {
        const json = new TextDecoder().decode(bytes);
        return JSON.parse(json) as T;
    } catch (error) {
        throw new Error(`MsgpackCodec: 目前 runtime 無法載入 @msgpack/msgpack，且 JSON fallback 解碼失敗。${String(error)}`);
    }
}

export class MsgpackCodec {

    /**
     * 將任意 JavaScript 物件序列化為 MessagePack 二進位格式。
     * @param data 要序列化的資料（plain object / array / primitive）
     * @returns Uint8Array 二進位位元組
     */
    public static encode(data: unknown): Uint8Array {
        const module = loadMsgpackModule();
        return module ? module.encode(data) : encodeJsonFallback(data);
    }

    /**
     * 將 MessagePack 二進位位元組解碼為 JavaScript 物件。
     * @param bytes 要解碼的 Uint8Array
     * @returns 解碼後的物件（型別不保證，需外部校驗）
     */
    public static decode<T = unknown>(bytes: Uint8Array): T {
        const module = loadMsgpackModule();
        return module ? module.decode<T>(bytes) : decodeJsonFallback<T>(bytes);
    }

    /**
     * 來回測試（encode → decode）是否無資料損失。
     * 僅限 dev 模式使用，production 請勿呼叫。
     */
    public static roundTripCheck(data: unknown): boolean {
        try {
            const encoded = MsgpackCodec.encode(data);
            const decoded = MsgpackCodec.decode(encoded);
            return JSON.stringify(data) === JSON.stringify(decoded);
        } catch {
            return false;
        }
    }
}
