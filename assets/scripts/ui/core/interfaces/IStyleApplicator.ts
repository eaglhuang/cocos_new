/**
 * IStyleApplicator
 *
 * 引擎無關的視覺樣式套用介面。
 * 對應 UIPreviewStyleBuilder 的功能面分層抽象。
 *
 * 設計原則：
 *   - 接收節點句柄 NodeHandle（平台無關）
 *   - skinSlot 是字串鍵，由 IStyleApplicator 實作自行解析 skin data
 *   - 回傳 Promise（sprite frame 等需要非同步載入）
 *   - 不含佈局計算（由 ILayoutResolver 負責）
 *
 * Unity 對照：UIStyleApplier（Image.color / Image.sprite 設定層）
 */
import type { UILayoutNodeSpec } from '../UISpecTypes';
import type { NodeHandle } from './INodeFactory';

/** 視覺狀態（對照 Unity Selectable.SelectionState） */
export type ButtonVisualState = 'normal' | 'pressed' | 'hover' | 'disabled' | 'selected';

export interface IStyleApplicator {
    /**
     * 套用背景 skin（color-rect 或 sprite-frame）到節點。
     * 回傳 true 代表套用成功；false 代表找不到資源（呼叫端可做 fallback）。
     *
     * Unity 對照：Image.color / Image.sprite 分支邏輯
     */
    applyBackgroundSkin(node: NodeHandle, skinSlot: string): Promise<boolean>;

    /**
     * 套用按鈕多狀態 skin（normal / pressed / disabled 等）。
     * Unity 對照：Selectable transition SpriteState
     */
    applyButtonSkin(node: NodeHandle, skinSlot: string): Promise<void>;

    /**
     * 套用 Label 視覺樣式（font / fontSize / color / overflow / lineHeight）。
     * Unity 對照：TMP_Text.fontSize / TMP_Text.color 等屬性設定
     */
    applyLabelStyle(node: NodeHandle, spec: UILayoutNodeSpec): Promise<void>;

    /**
     * 套用 Sprite 類型與 9-slice inset。
     * Unity 對照：Image.type = Sliced + border 設定
     */
    applySpriteType(node: NodeHandle, skinSlot: string): Promise<void>;
}
