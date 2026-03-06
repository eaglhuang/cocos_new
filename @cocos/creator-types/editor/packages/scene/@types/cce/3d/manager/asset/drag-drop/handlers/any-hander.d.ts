import { DragInfo, IDragEvent } from '../../../../../../../@types/private';
import { BaseHandler } from './base-handler';
/**
 * 处理拖动资源到场景创建节点（目前支持所有类型的资源创建）
 */
export declare class AnyHandler extends BaseHandler {
    excludedTypes: string[];
    private dragItems;
    private temporaryNodes;
    private currentRaycastResultNodes;
    private editorCanvasNode;
    private isDragging;
    private clear;
    private clearDragItems;
    private clearEditorCanvas;
    private findEditorCanvas;
    private createNode;
    private drop;
    onDragLeave(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
    onDragOver(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
    onDrop(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
}
