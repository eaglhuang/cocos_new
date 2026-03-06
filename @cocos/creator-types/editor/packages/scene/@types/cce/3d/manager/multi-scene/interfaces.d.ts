import { ISceneUndoManager, SceneUndoCommandID } from '../../../export/undo';
import { ISceneUndoOptions } from '../../../../../@types/public';
export interface IMultiUndoManager {
    /**
     * 为指定场景生成撤销管理器
     * @param sceneId 场景ID
     */
    generateUndoManager(sceneId: string): void;
    /**
     * 获取指定场景的撤销管理器
     * @param sceneId 场景ID
     * @returns 撤销管理器实例
     */
    getUndoManager(sceneId: string): ISceneUndoManager;
    /**
     * 删除指定场景的撤销管理器
     * @param sceneId 场景ID
     */
    delete(sceneId: string): void;
    /**
     * 开始记录撤销操作
     * @param sceneId 场景ID
     * @param uuids 操作的UUID或UUID数组
     * @param options 撤销选项
     * @returns 撤销命令ID
     */
    beginRecording(sceneId: string, uuids: string | string[], options?: ISceneUndoOptions): SceneUndoCommandID;
    /**
     * 取消记录撤销操作
     * @param sceneId 场景ID
     * @param commandId 撤销命令ID
     * @returns 是否成功取消
     */
    cancelRecording(sceneId: string, commandId: SceneUndoCommandID): boolean;
    /**
     * 结束记录撤销操作
     * @param sceneId 场景ID
     * @param commandId 撤销命令ID
     * @returns 是否成功结束
     */
    endRecording(sceneId: string, commandId: SceneUndoCommandID): boolean;
    /**
     * 更新场景转储状态
     * @param sceneId 场景ID
     * @param uuids 操作的UUID数组
     * @param force 是否强制更新
     */
    updateDump(sceneId: string, uuids: string[], force: boolean): void;
    /**
     * 查询场景是否有未保存的更改
     * @param sceneId 场景ID
     * @returns 场景是否有未保存的更改
     */
    querySceneDirty(sceneId: string): boolean;
    /**
     * 撤销操作
     * @param sceneId 场景ID
     */
    undo(sceneId: string): void;
    /**
     * 重做操作
     * @param sceneId 场景ID
     */
    redo(sceneId: string): void;
    /**
     * 记录操作
     * @param sceneId 场景ID
     * @param uuid 操作的UUID
     */
    record(sceneId: string, uuid: string): void;
    snapshot(sceneId: string, command: any): void;
    abortSnapshot(sceneId: string): void;
}
export interface IMultiSelection {
    /**
     * 暂存场景选择
     * @param sceneId 场景ID
     * @param selectId 选择的ID数组
     */
    stashSelection(sceneId: string, selectId: string[]): void;
    /**
     * 获取场景选择
     * @param sceneId 场景ID
     * @returns 选择的ID数组或undefined
     */
    getSelection(sceneId: string): string[] | undefined;
    /**
     * 清除场景选择
     * @param sceneId 场景ID
     */
    clearSelection(sceneId: string): void;
}
/**
 * 主要给 UI 那边展示用的字段
 */
export interface ISceneDisplayInfo {
    name: string;
    uuid: string;
    dirty: boolean;
    type: string;
    url: string;
}
export interface IMultiAssets {
    /**
     * 查询资产信息
     * @param uuid 资产UUID数组
     * @returns 资产显示信息数组的Promise
     */
    queryAssetsInfo(uuid: string[]): Promise<ISceneDisplayInfo[]>;
    queryAssetInfo(uuid: string): Promise<ISceneDisplayInfo | null>;
}
/**
 * 每个场景信息记录
 */
export interface PrefabSceneMap {
    scene: any;
    rootNode: any;
    uuid: string;
    persisted: boolean;
    loaded: boolean;
    reloadCount: number;
}
