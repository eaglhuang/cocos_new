/**
 * 这个文件主要提取了 xxx-proxy.ts 中一些保存的逻辑来给多场景用
 * todo: 但是其实应该复用这部分代码，后续需要考虑如何处理整合
 */
import { Scene, Node } from 'cc';
export declare function checkClose(name: string): Promise<number>;
/**
 * 序列化某个 prefab 数据
 * todo:但是这部分有些逻辑跟 prefab-scene-proxy.ts 重复，后面要考虑如何融合
 * @param uuid
 * @param node
 */
export declare function serializePrefab(uuid: string, node: Node): Promise<void>;
/**
 * 序列化某个场景数据，
 * todo:但是这部分有些逻辑跟 general-scene-proxy.ts 重复，后面要考虑如何融合
 *
 * @param uuid
 * @param scene
 */
export declare function serializeScene(uuid: string, scene: Scene): Promise<void>;
