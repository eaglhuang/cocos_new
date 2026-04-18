/**
 * DeployDragDebug — 拖曳 debug 薄 shim
 *
 * 已遷移至 UCUFLogger 系統（UCUF M5）。
 * 使用方式與 UCUFLogger 一致：
 *   browser console: __ucuf_debug()   → 開啟所有 DEBUG 輸出（含拖曳）
 *                    __ucuf_quiet()   → 靜音
 *                    __ucuf_level(0)  → 手動設 DEBUG
 *
 * Unity 對照：Conditional("BATTLE_DRAG_DEBUG") + Debug.Log。
 */
import { UCUFLogger, LogCategory, LogLevel } from '../core/UCUFLogger';

/**
 * 輸出拖曳 debug 訊息（DEBUG 級別 / DRAG 分類）。
 * 已委派給 UCUFLogger；開關由 __ucuf_debug() / __ucuf_level() 控制。
 */
export function emitDeployDragDebug(source: string, event: string, payload?: unknown): void {
    if (payload !== undefined) {
        UCUFLogger.debug(LogCategory.DRAG, `[${source}] ${event}`, payload);
    } else {
        UCUFLogger.debug(LogCategory.DRAG, `[${source}] ${event}`);
    }
}

/**
 * touch-move throttle 工具：距離上次輸出是否已超過 throttleMs。
 * 與 UCUFLogger 無關，純粹避免 move 事件造成 log 爆炸。
 */
export function shouldLogDeployDragMove(
    nowMs: number,
    lastLoggedMs: number,
    throttleMs: number,
): boolean {
    if (lastLoggedMs <= 0) return true;
    return nowMs - lastLoggedMs >= Math.max(0, throttleMs);
}

