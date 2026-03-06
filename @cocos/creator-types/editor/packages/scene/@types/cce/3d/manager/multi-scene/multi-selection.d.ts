import { IMultiSelection } from './interfaces';
export declare class MultiSelection implements IMultiSelection {
    selectionMap: Map<string, string[]>;
    stashSelection(sceneId: string, selectId: string[]): void;
    getSelection(sceneId: string): string[] | undefined;
    clearSelection(sceneId: string): void;
}
