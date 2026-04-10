/**
 * GzipCodec.ts
 * 
 * 封裝 pako 的 gzip compress/decompress，提供統一的壓縮介面。
 * 相容 Web 與 Native (JSB) 環境。
 * 
 * Unity 對照：類似 System.IO.Compression.GZipStream，
 * 2MB JSON → gzip 後約 300-500KB（壓縮率 75-85%）。
 * 
 * 用法：
 *   const compressed = await GzipCodec.compress(uint8Array);
 *   const original = await GzipCodec.decompress(compressed);
 */

type PakoModule = {
    gzip(data: Uint8Array): Uint8Array;
    ungzip(data: Uint8Array): Uint8Array;
};

let _pakoModule: PakoModule | null | undefined;

function loadPakoModule(): PakoModule | null {
    if (_pakoModule !== undefined) {
        return _pakoModule;
    }

    const globalModule = (globalThis as { pako?: Partial<PakoModule> }).pako;
    if (globalModule?.gzip && globalModule?.ungzip) {
        _pakoModule = {
            gzip: globalModule.gzip.bind(globalModule),
            ungzip: globalModule.ungzip.bind(globalModule),
        };
        return _pakoModule;
    }

    try {
        const requireFactory = Function('try { return typeof require !== "undefined" ? require : undefined; } catch { return undefined; }');
        const requireFn = requireFactory() as ((id: string) => unknown) | undefined;
        if (requireFn) {
            const module = requireFn('pako') as Partial<PakoModule>;
            if (module.gzip && module.ungzip) {
                _pakoModule = {
                    gzip: module.gzip.bind(module),
                    ungzip: module.ungzip.bind(module),
                };
                return _pakoModule;
            }
        }
    } catch {
        // Ignore and use pass-through fallback below.
    }

    _pakoModule = null;
    return _pakoModule;
}

function hasGzipHeader(data: Uint8Array): boolean {
    return data.byteLength >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

export class GzipCodec {

    /**
     * 壓縮 Uint8Array（gzip 格式）。
     * @param data 原始 Uint8Array 資料
     * @returns 壓縮後的 Uint8Array
     */
    public static compress(data: Uint8Array): Uint8Array {
        const module = loadPakoModule();
        return module ? module.gzip(data) : data.slice();
    }

    /**
     * 解壓 gzip 格式的 Uint8Array。
     * @param data 壓縮的 Uint8Array
     * @returns 解壓後的 Uint8Array
     */
    public static decompress(data: Uint8Array): Uint8Array {
        const module = loadPakoModule();
        if (module) {
            return module.ungzip(data);
        }

        if (hasGzipHeader(data)) {
            throw new Error('GzipCodec: 目前 runtime 無法載入 pako，無法解壓既有 gzip 資料。');
        }

        return data.slice();
    }

    /**
     * 壓縮 JSON 字串為 gzip Uint8Array。
     * @param jsonString JSON 字串
     * @returns 壓縮後的 Uint8Array
     */
    public static compressJson(jsonString: string): Uint8Array {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(jsonString);
        return GzipCodec.compress(bytes);
    }

    /**
     * 解壓 gzip Uint8Array 為 JSON 字串。
     * @param data 壓縮的 Uint8Array
     * @returns 解壓後的 JSON 字串
     */
    public static decompressToJson(data: Uint8Array): string {
        const bytes = GzipCodec.decompress(data);
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    }

    /**
     * 計算壓縮率（0-1 之間）。
     * @returns compressedSize / originalSize
     */
    public static compressionRatio(original: Uint8Array, compressed: Uint8Array): number {
        if (original.byteLength === 0) return 0;
        return compressed.byteLength / original.byteLength;
    }
}
