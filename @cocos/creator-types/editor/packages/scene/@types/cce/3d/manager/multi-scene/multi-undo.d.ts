import { ISceneUndoManager, SceneUndoCommandID } from '../../../export/undo';
import { ISceneUndoOptions } from '../../../../../@types/public';
import { IMultiUndoManager } from './interfaces';
/**
 * 多场景 undo 管理
 */
export declare class MultiUndoManager implements IMultiUndoManager {
    private undoManager;
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
    abortSnapshot(sceneId: string): void;
    snapshot(sceneId: string, command: SceneUndoCommandID): void;
}
