// @spec-source → 見 docs/cross-reference-index.md
// M5：全面委託 UCUFLogger 輸出，保留原 static API 不變以維持向後相容。
import { UCUFLogger, LogCategory } from './UCUFLogger';

/**
 * UIPreviewDiagnostics
 * 集中管理 UIPreviewBuilder 的診斷與日誌輸出
 *
 * M5 更新：所有 console 呼叫改為委託 UCUFLogger，
 * 可透過 __ucuf_debug() / __ucuf_quiet() 全域開關控制輸出。
 */

export class UIPreviewDiagnostics {
    /**
     * 建立 layout 時的一般日誌
     */
    static buildScreenSuccess(layoutId: string, rootChildrenCount: number): void {
        UCUFLogger.info(LogCategory.LIFECYCLE, `[UIPreviewBuilder] buildScreen 完成 (layout: ${layoutId ?? '?'}) root.children=${rootChildrenCount}`);
    }

    /**
     * 建立 layout 時的錯誤
     */
    static buildScreenError(layoutId: string, error: Error): void {
        UCUFLogger.error(LogCategory.LIFECYCLE, `[UIPreviewBuilder] buildScreen 構建根節點失敗? (layout: ${layoutId ?? '?'})`, error);
    }

    /**
     * 字型預加載警告
     */
    static fontLoadWarning(fontPath: string): void {
        UCUFLogger.warn(LogCategory.SKIN, `[UIPreviewBuilder] 字型加載失敗: ${fontPath}`);
    }

    /**
     * Label 無綁定來源的警告
     */
    static labelFallbackWarning(labelName: string): void {
        UCUFLogger.debug(LogCategory.DATA, '[UIPreviewBuilder] label "' + labelName + '" has no textKey/text/bind - defaulting to empty string');
    }

    /**
     * Label 皮膚應用錯誤
     */
    static labelSkinApplyError(labelName: string, skinSlotId: string, error: Error): void {
        UCUFLogger.error(LogCategory.SKIN, `[UIPreviewBuilder] _buildLabel 應用皮膚失敗 node="${labelName}" skinSlot="${skinSlotId}"`, error);
    }

    /**
     * Noise 混合模式不支援警告
     */
    static noiseBlendModeWarning(blendMode: string, slotId: string): void {
        UCUFLogger.debug(LogCategory.SKIN, `[UIPreviewBuilder] noise blend "${blendMode}" 回退至 alpha 混合: ${slotId}`);
    }

    /**
     * populateList 目標節點未找到
     */
    static populateListNodeNotFound(listPath: string, availableChildren: string[]): void {
        UCUFLogger.error(LogCategory.DATA, `[UIPreviewBuilder] populateList 無法找到 listNode: "${listPath}"，this.node 子節點:`, availableChildren);
    }

    /**
     * populateList 模板未定義
     */
    static populateListTemplateNotFound(listPath: string, availableChildren: string[]): void {
        UCUFLogger.error(LogCategory.DATA, `[UIPreviewBuilder] populateList listNode "${listPath}" 缺少 _itemTemplate，node children:`, availableChildren);
    }

    /**
     * populateList Content 未找到
     */
    static populateListContentNotFound(listPath: string, availableChildren: string[]): void {
        UCUFLogger.error(LogCategory.DATA, `[UIPreviewBuilder] populateList listNode "${listPath}" 無法找到 Content 子節點，node children:`, availableChildren);
    }

    /**
     * populateList 開始執行
     */
    static populateListStart(listPath: string, dataLength: number): void {
        UCUFLogger.debug(LogCategory.DATA, `[UIPreviewBuilder] populateList 開始填充 listPath="${listPath}" 項目數=${dataLength}`);
    }

    /**
     * populateList 單列構建錯誤
     */
    static populateListRowError(rowIndex: number, error: Error): void {
        UCUFLogger.error(LogCategory.DATA, `[UIPreviewBuilder] populateList 焰7b${rowIndex} 列構建失敗？`, error);
    }

    /**
     * populateList 完成
     */
    static populateListComplete(rowCount: number): void {
        UCUFLogger.debug(LogCategory.DATA, '[UIPreviewBuilder] populateList done, rows=' + rowCount);
    }
}
