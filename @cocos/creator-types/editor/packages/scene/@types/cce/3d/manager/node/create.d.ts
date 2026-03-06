import type { Asset } from 'cc';
import { Node, Scene } from 'cc';
/**
 * 根据资源 uuid 加载资源
 * @param uuid
 */
export declare function loadAny<TAsset extends Asset>(uuid: string): Promise<TAsset>;
export declare function createNodeByAsset(info: {
    uuid: string;
    canvasRequired?: boolean;
    type?: string;
    autoAdaptToCreate?: boolean;
}): Promise<{
    node: any;
    canvasRequired: boolean | undefined;
}>;
/**
 * 创建一个隐藏与层级结构的 Canvas 节点
 * @param scene
 */
export declare function createShouldHideInHierarchyCanvasNode(scene: Scene): Promise<Node>;
