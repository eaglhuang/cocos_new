// @spec-source → 見 docs/cross-reference-index.md

/**
 * UIPreviewDiagnostics
 * 集中管理 UIPreviewBuilder 的診斷與日誌輸出
 * 
 * 目標：降低中文密集度，集中 console 調用
 * 使用原則：所有 log/warn/error 都通過此模組
 */

export class UIPreviewDiagnostics {
    /**
     * 建立 layout 時的一般日誌
     */
    static buildScreenSuccess(layoutId: string, rootChildrenCount: number): void {
        console.log(`[UIPreviewBuilder] buildScreen 完成 (layout: ${layoutId ?? '?'}) root.children=${rootChildrenCount}`);
    }

    /**
     * 建立 layout 時的錯誤
     */
    static buildScreenError(layoutId: string, error: Error): void {
        console.error(`[UIPreviewBuilder] buildScreen 構建根節點失敗? (layout: ${layoutId ?? '?'})`, error);
    }

    /**
     * 字型預加載警告
     */
    static fontLoadWarning(fontPath: string): void {
        console.warn(`[UIPreviewBuilder] 字型加載失敗: ${fontPath}`);
    }

    /**
     * Label 無綁定來源的警告
     */
    static labelFallbackWarning(labelName: string): void {
        console.log('[UIPreviewBuilder] label "' + labelName + '" has no textKey/text/bind - defaulting to empty string');
    }

    /**
     * Label 皮膚應用錯誤
     */
    static labelSkinApplyError(labelName: string, skinSlotId: string, error: Error): void {
        console.error(`[UIPreviewBuilder] _buildLabel 應用皮膚失敗 node="${labelName}" skinSlot="${skinSlotId}"`, error);
    }

    /**
     * Noise 混合模式不支援警告
     */
    static noiseBlendModeWarning(blendMode: string, slotId: string): void {
        console.log(`[UIPreviewBuilder] noise blend "${blendMode}" 回退至 alpha 混合: ${slotId}`);
    }

    /**
     * populateList 目標節點未找到
     */
    static populateListNodeNotFound(listPath: string, availableChildren: string[]): void {
        console.error(`[UIPreviewBuilder] populateList 無法找到 listNode: "${listPath}"，this.node 子節點:`, availableChildren);
    }

    /**
     * populateList 模板未定義
     */
    static populateListTemplateNotFound(listPath: string, availableChildren: string[]): void {
        console.error(`[UIPreviewBuilder] populateList listNode "${listPath}" 缺少 _itemTemplate，node children:`, availableChildren);
    }

    /**
     * populateList Content 未找到
     */
    static populateListContentNotFound(listPath: string, availableChildren: string[]): void {
        console.error(`[UIPreviewBuilder] populateList listNode "${listPath}" 無法找到 Content 子節點，node children:`, availableChildren);
    }

    /**
     * populateList 開始執行
     */
    static populateListStart(listPath: string, dataLength: number): void {
        console.log(`[UIPreviewBuilder] populateList 開始填充 listPath="${listPath}" 項目數=${dataLength}`);
    }

    /**
     * populateList 單列構建錯誤
     */
    static populateListRowError(rowIndex: number, error: Error): void {
        console.error(`[UIPreviewBuilder] populateList 第${rowIndex} 列構建失敗？`, error);
    }

    /**
     * populateList 完成
     */
    static populateListComplete(rowCount: number): void {
        console.log('[UIPreviewBuilder] populateList done, rows=' + rowCount);
    }
}
