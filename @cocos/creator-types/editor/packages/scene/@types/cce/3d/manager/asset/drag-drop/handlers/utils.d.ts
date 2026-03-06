/**
 * 转换坐标
 * @param x
 * @param y
 */
import { Node, Vec3 } from 'cc';
export declare function adjustXY(x: number, y: number): {
    x: number;
    y: number;
};
/**
 * 通过屏幕坐标转 2D 坐标
 * @param x
 * @param y
 */
export declare function screenPointToWorldPosition2D(x: number, y: number): Vec3;
/**
 * 通过屏幕坐标点，转 3D 世界坐标点
 * @param x
 * @param y
 * @param target
 * @param raycastNode
 */
export declare function screenPointToWorldPosition3D(x: number, y: number, target: Node, raycastNode: Node | null): Vec3;
/**
 * 设置节点 Flags 为编辑器节点（不存储，不显示在层级管理器中）
 * @param node
 * @private
 */
export declare function setNodeEditorFlag(node: Node): void;
/**
 * 查询普通 Canvas
 * @private
 */
export declare function findCanvas(): Node | null;
/**
 * 鼠标坐标转世界坐标，并设置给节点，如果是 2D 视图的话，并且有 Canvas 计算 Canvas 的坐标
 * @param x
 * @param y
 * @param nodes
 * @param raycastNode
 * @param canvasNode
 */
export declare function setPositionInNode(x: number, y: number, nodes: Node[], raycastNode: Node | null, canvasNode?: Node | null): void;
