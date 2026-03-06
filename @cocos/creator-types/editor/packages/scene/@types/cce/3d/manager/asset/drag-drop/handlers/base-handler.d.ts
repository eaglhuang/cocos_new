/**
 * 处理器基类
 */
import { Node } from 'cc';
import type { DragInfo, IDragEvent } from '../../../../../../../@types/private';
/**
 * 处理器接口
 */
export interface IDropHandler {
    /**
     * 符合拖拽的类型。如果未定义 types 那表示不限制类型
     *
     * 用于定义当前处理器可以接收的拖拽数据类型。
     * 例如：['cc.Texture', 'cc.Material']。
     */
    acceptedTypes: string[];
    /**
     * 排除的拖拽类型。
     *
     * 定义当前处理器明确拒绝的拖拽数据类型。
     * 例如：['cc.Texture', 'cc.Material']。
     */
    excludedTypes: string[];
    /**
     * 检查是否可以接受当前拖拽数据。
     * 1。检查支持的类型
     * 2。检查是否包含排除类型
     * 3。检查是否拖拽是同类型
     * @returns 如果返回 `true`，表示可以接受拖拽的数据；否则不能。
     * @param dragItems
     */
    canDrop(dragItems: DragInfo[]): boolean;
    /**
     * 当拖拽操作离开目标区域时触发。
     *
     * @param event 拖拽事件。
     * @param dragItems
     */
    onDragLeave(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
    /**
     * 当拖拽操作在目标区域内移动时触发。
     *
     * @param event 拖拽事件。
     * @param dragItems
     */
    onDragOver(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
    /**
     * 当拖拽操作释放时触发。
     *
     * @param event 拖拽事件。
     * @param dragItems
     */
    onDrop(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
}
export declare abstract class BaseHandler implements IDropHandler {
    acceptedTypes: string[];
    excludedTypes: string[];
    canDrop(dragItems: DragInfo[]): boolean;
    /**
     * 根据屏幕坐标，进行射线检测，获取到节点列表
     * @param x
     * @param y
     * @protected
     */
    protected getRaycastResultNodes(x: number, y: number): Node[];
    abstract onDragLeave(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
    abstract onDragOver(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
    abstract onDrop(event: IDragEvent, dragItems: DragInfo[]): Promise<void>;
}
