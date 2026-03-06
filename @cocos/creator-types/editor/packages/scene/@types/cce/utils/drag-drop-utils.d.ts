import type { DragInfo } from '../../../@types/private';
export declare class DragDropUtils {
    /**
     * Tips 元素
     */
    tipsElement: HTMLDivElement | null;
    droppableAssetTypes: string[];
    /**
     * 是否可拖拽
     * @param type
     */
    canDrop(type: string): boolean;
    /**
     * 更新可拖拽的类型
     * @private
     */
    private updateDroppableAssetTypes;
    init(): Promise<void>;
    /**
     * 拖拽的元素数组中是否都是同一个类型
     * @param items
     */
    isSameType(items: DragInfo[]): boolean;
    /**
     * 筛选符合的 Asset
     * todo: 因为去除了拖拽资源重定向的排序的功能，之前的过滤算法有问题依赖重定向的顺序，会导致拖拽 fbx 会创建多个资源，所以做了如下改动
     * todo: 此处代码跟 app/modules/editor-extensions/extensions/hierarchy/source/components/tree.ts 里面的 ipcDrop 过滤逻辑是重复的，后续需要整合成一个
     * 0. 先过滤掉不能拖拽生成的资源
     * 1. 先把资源根据不同的主 uuid 进行分组
     * 2. 如果某个分组里面有 excludeOthers 资源，那么其他子资源都忽略，只过滤这个资源当中所有的 excludeOthers 类型的资源进行创建
     * 3. 如果分组里面没有 excludeOthers 资源，就直接创建可以拖拽（canDrop）的资源
     */
    filterAssets(items: DragInfo[], skipTypes?: string[]): DragInfo[];
    /**
     * 关闭提示
     */
    closeTips(): void;
    /**
     * 显示在鼠标的位置显示提示
     * @param message
     * @param x
     * @param y
     */
    showTips(message: string, x: number, y: number): void;
}
declare const _default: DragDropUtils;
export default _default;
