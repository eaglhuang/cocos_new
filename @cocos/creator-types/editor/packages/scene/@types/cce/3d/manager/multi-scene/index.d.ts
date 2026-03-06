import { ISceneDisplayInfo } from './multi-assets';
import { IMultiAssets, IMultiSelection, IMultiUndoManager, PrefabSceneMap } from './interfaces';
import { ISceneUndoManager, SceneUndoCommandID } from '../../../export/undo';
import { ISceneUndoOptions } from '../../../../../@types/public';
import { Scene } from 'cc';
export type SCENE_TYPE = 'scene' | 'prefab';
export type MULTI_SCENE_MESSAGE = 'multi-open-scene' | 'multi-close-scene' | 'multi-scene-dirty' | 'multi-scene-focus';
/**
 * 多场景管理类
 * 用于管理多个场景的切换
 */
declare class MultiSceneManager implements IMultiUndoManager, IMultiSelection, IMultiAssets {
    useMultipleEdit: boolean;
    private sceneMap;
    private _maxSceneCount;
    private undoManager;
    private selection;
    private multiAssets;
    private _curFocus;
    _reloadCount: number;
    /**
     * 当前资源刷新次数，每次刷新都会加1，用于判断是否需要刷新场景
     */
    get reloadCount(): number;
    get curFocus(): string;
    set curFocus(curFocus: string);
    get maxSceneCount(): number;
    set maxSceneCount(value: number);
    constructor();
    onProfileChanged(protocol: string, file: string, key: string, value: any): Promise<void>;
    private _initData;
    /**
     * 暂存场景
     * @param uuid 场景 uuid
     * @param scene 场景实例
     * @param rootNode 根节点
     */
    protected stashScene(uuid: string, scene: any, rootNode: any): void;
    /**
     *
     * @param uuid scene uuid
     * @param scene scene instance
     * @param rootNode scene root node
     * @param type scene type
     */
    multiSceneOpen(uuid: string, scene: any, rootNode: any, type: SCENE_TYPE): void;
    updateSceneRef(uuid: string, scene: any, rootNode: any): void;
    /**
     * 专门用来处理空场景的情况
     * @param uuid
     * @param scene
     */
    multiEmptySceneOpen(uuid: string, scene: any): void;
    /**
     * 关闭场景
     * @param uuid 场景uuid
     * @param type 场景类型
     */
    multiSceneClose(uuid: string, type: SCENE_TYPE): void;
    /**
     * focus 到某个场景、prefab
     * @param uuid 场景 id
     * @returns
     */
    multiSceneFocus(uuid: string): Promise<void>;
    broadcastSceneFocus(uuid: string): void;
    multiSceneFocusQuery(): Promise<string>;
    multiSceneQuery(): Promise<ISceneDisplayInfo[]>;
    private _reduceScene;
    /**
     * 获取场景
     * @param uuid
     */
    getStashScene(uuid: string): PrefabSceneMap | undefined;
    /**
     * 清空场景
     */
    clearStashScene(): void;
    broadcastSceneOpen(uuid: string, type: SCENE_TYPE): void;
    broadcastSceneClose(uuid: string): void;
    broadcastSceneDirty(uuid: string, type?: SCENE_TYPE): void;
    protected broadcast(message: MULTI_SCENE_MESSAGE, uuid: string, type?: SCENE_TYPE): void;
    /**
     * 关闭场景前的检查，
     * todo:这部分逻辑跟 prefab-scene-proxy general-scene-proxy,很像，需要考虑后续如何处理
     * @param uuid
     * @returns true: 如果不需要保存或者保存完成就返回 true
     *          false: 如果要取消关闭就返回 false
     * @private
     */
    private _checkClose;
    /**
     * 关闭所有场景
     * @returns true: 所有场景都关闭成功
     *          false: 有场景关闭失败
     */
    closeAllScene(): Promise<boolean>;
    /**
     * 关闭多个场景
     * @param uuids 需要关闭的 uuid 列表
     * @private
     */
    private _closeByIds;
    /**
     * 保存所有的场景和 prefab（目前给构建的时候判断是否有没保存的场景的地方用）
     */
    saveAllScene(): Promise<void>;
    /**
     * 关闭当前场景外的其他场景
     * @param uuid
     * @returns true 被终止了，false 没有被终止
     */
    closeOthers(uuid: string): Promise<boolean>;
    /**
     * 关闭当前 uuid 右侧的场景
     * @param uuid
     */
    closeToTheRight(uuid: string): Promise<boolean>;
    /**
     * 把 curUuid 的场景移动到 toUuid 的场景之前
     * @param curUuid 当前选中的 uuid
     * @param toUuid 要插入到的 uuid（会插入这个 uuid 之前），如果为特殊字符 end 字符串，那就是挪到数组末尾
     */
    moveSceneTo(curUuid: string, toUuid: string): Promise<void>;
    /**
     * 关闭场景
     * @param uuid 关闭的场景 uuid
     * @param destroy 是否释放
     */
    closeScene(uuid: string, destroy?: boolean): Promise<boolean>;
    /**
     * 屏蔽默认的 destroy
     * @param scene 需要屏蔽的场景
     */
    overrideSceneDestroy(scene: Scene): void;
    /**
     * 获取所有场景
     */
    getAllScene(): PrefabSceneMap[];
    /**
     * 获取所有场景的uuid
     */
    getAllSceneUuid(): string[];
    remove(uuid: string, destroy?: boolean): void;
    /**
     * 目前只有删除scene 数据的操作，但是后续可能有别的东西要加
     * todo:这边跟下面的 updateSceneRef 理论上应该配套使用，避免有些因为 engine 的全局缓存没有删除的情况
     * @param uuid
     */
    beforeUpdateSceneRef(uuid: string): void;
    private _destroyScene;
    generateUndoManager(sceneId: string): void;
    getUndoManager(sceneId: string): ISceneUndoManager;
    delete(sceneId: string): void;
    beginRecording(sceneId: string, uuids: string | string[], options?: ISceneUndoOptions): SceneUndoCommandID;
    cancelRecording(sceneId: string, commandId: SceneUndoCommandID): boolean;
    endRecording(sceneId: string, commandId: SceneUndoCommandID): boolean;
    updateDump(sceneId: string, uuids: string[], force: boolean): void;
    querySceneDirty(sceneId: string): boolean;
    undo(sceneId: string): Promise<import("../../../export/undo").UndoCommand | undefined>;
    redo(sceneId: string): Promise<import("../../../export/undo").UndoCommand | undefined>;
    record(sceneId: string, uuid: string, dumpImmediately?: boolean): void;
    stashSelection(sceneId: string, selectId: string[]): void;
    getSelection(sceneId: string): string[] | undefined;
    clearSelection(sceneId: string): void;
    queryAssetsInfo(uuids: string[]): Promise<ISceneDisplayInfo[]>;
    queryAssetInfo(uuid: string): Promise<ISceneDisplayInfo | null>;
    private _generateEmptySceneInfo;
    queryScenesInfo(): Promise<ISceneDisplayInfo[]>;
    /**
     * 获取当前场景节点
     */
    getCurrentScene(): Scene | null;
    getSceneInfo(uuid: string): Promise<PrefabSceneMap | null>;
    saveScene(uuid: string): Promise<boolean>;
    abortSnapshot(sceneId: string): void;
    snapshot(sceneId: string, command: any): void;
    incReloadCount(uuid?: string): void;
    needReload(uuid: string): boolean;
    endReload(uuid: string): void;
}
declare const multiSceneManager: MultiSceneManager;
export default multiSceneManager;
