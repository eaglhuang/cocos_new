// @spec-source → docs/UCUF規範文件.md  (UCUF M5)
/**
 * UCUFLogger — UCUF 統一日誌系統
 *
 * UCUF M5：取代分散在各處的 console.log/warn/error 呼叫，
 * 提供分級（LogLevel）+ 分類（LogCategory）的集中輸出管道。
 *
 * runtime 開關（Browser Console）：
 *   __ucuf_debug()  → 開啟 DEBUG 最高冗余模式（輸出所有級別）
 *   __ucuf_quiet()  → 靜音（僅保留 ERROR）
 *   __ucuf_level(n) → 手動設定級別 0=DEBUG 1=INFO 2=WARN 3=ERROR
 *
 * Unity 對照：Debug.Log namespace + Conditional compile symbol 的組合。
 */

// ─── 列舉定義 ──────────────────────────────────────────────────────────────────

export const enum LogLevel {
    DEBUG = 0,
    INFO  = 1,
    WARN  = 2,
    ERROR = 3,
}

export const enum LogCategory {
    LIFECYCLE   = 'lifecycle',
    SKIN        = 'skin',
    DATA        = 'data',
    PERFORMANCE = 'performance',
    RULE        = 'rule',
    DRAG        = 'drag',
}

// ─── 主類別 ────────────────────────────────────────────────────────────────────

export class UCUFLogger {

    /** 目前的最低輸出級別，低於此級別的訊息會被靜默過濾 */
    private static _minLevel: LogLevel = LogLevel.INFO;

    /** 是否記錄 Category 前綴（測試環境中可設為 false 簡化輸出） */
    static showCategory = true;

    // ── 公開日誌 API ───────────────────────────────────────────────────────────

    static debug(category: LogCategory, msg: string, ...args: unknown[]): void {
        UCUFLogger._emit(LogLevel.DEBUG, category, msg, args);
    }

    static info(category: LogCategory, msg: string, ...args: unknown[]): void {
        UCUFLogger._emit(LogLevel.INFO, category, msg, args);
    }

    static warn(category: LogCategory, msg: string, ...args: unknown[]): void {
        UCUFLogger._emit(LogLevel.WARN, category, msg, args);
    }

    static error(category: LogCategory, msg: string, ...args: unknown[]): void {
        UCUFLogger._emit(LogLevel.ERROR, category, msg, args);
    }

    // ── 效能計時 API ───────────────────────────────────────────────────────────

    static perfBegin(label: string): number {
        return (typeof performance !== 'undefined') ? performance.now() : Date.now();
    }

    static perfEnd(label: string, startTime: number): void {
        const elapsed = ((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime;
        UCUFLogger._emit(LogLevel.DEBUG, LogCategory.PERFORMANCE, `[perf] ${label} = ${elapsed.toFixed(2)}ms`, []);
    }

    // ── 級別 / 開關 控制 ──────────────────────────────────────────────────────

    static setLevel(level: LogLevel): void {
        UCUFLogger._minLevel = level;
    }

    static getLevel(): LogLevel {
        return UCUFLogger._minLevel;
    }

    /**
     * 掛載全局 runtime 開關到 globalThis（僅在 Browser/Electron 環境中生效）。
     * 在 Node.js 測試環境中呼叫此方法無副作用。
     */
    static installGlobalHooks(): void {
        if (typeof globalThis === 'undefined') { return; }
        (globalThis as Record<string, unknown>).__ucuf_debug  = () => UCUFLogger.setLevel(LogLevel.DEBUG);
        (globalThis as Record<string, unknown>).__ucuf_quiet  = () => UCUFLogger.setLevel(LogLevel.ERROR);
        (globalThis as Record<string, unknown>).__ucuf_level  = (n: number) => UCUFLogger.setLevel(n as LogLevel);
        (globalThis as Record<string, unknown>).__ucuf_logger = UCUFLogger;
    }

    // ── 內部實作 ───────────────────────────────────────────────────────────────

    private static _emit(level: LogLevel, category: LogCategory, msg: string, args: unknown[]): void {
        if (level < UCUFLogger._minLevel) { return; }

        const prefix = UCUFLogger.showCategory ? `[UCUF:${category}] ` : '[UCUF] ';
        const full   = prefix + msg;

        switch (level) {
            case LogLevel.DEBUG:
            case LogLevel.INFO:
                console.log(full, ...args);
                break;
            case LogLevel.WARN:
                console.warn(full, ...args);
                break;
            case LogLevel.ERROR:
                console.error(full, ...args);
                break;
        }
    }
}

// 自動安裝全局鉤子（Cocos Browser/Electron 環境下生效）
UCUFLogger.installGlobalHooks();
