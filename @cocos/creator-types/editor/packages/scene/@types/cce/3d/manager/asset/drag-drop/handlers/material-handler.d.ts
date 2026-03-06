import { Node } from 'cc';
import { DragInfo, IDragEvent } from '../../../../../../../@types/private';
import { BaseHandler } from './base-handler';
/**
 * 处理拖动 Material 资源到带有 MeshRenderer 的节点上进行赋值
 */
export declare class MaterialHandler extends BaseHandler {
    acceptedTypes: string[];
    dragNode: Node[];
    private _highlightedNodes;
    private _lastDragNode;
    get firstDragNode(): Node | null;
    private getSharedMaterialPathByNode;
    private setMaterial;
    private showHighlightNode;
    private restoreAllHighlights;
    onDragLeave(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
    onDragOver(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
    onDrop(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
}
