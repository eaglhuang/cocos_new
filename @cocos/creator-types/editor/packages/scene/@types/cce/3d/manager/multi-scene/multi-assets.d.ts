import { IMultiAssets } from './interfaces';
export interface ISceneDisplayInfo {
    name: string;
    uuid: string;
    dirty: boolean;
    type: string;
    url: string;
}
export declare class MultiAssets implements IMultiAssets {
    /**
     * 查询资源信息并返回格式化数据
     * @param uuid 资源uuid
     * @returns 包含资源信息的数组
     */
    queryAssetsInfo(uuid: string[]): Promise<ISceneDisplayInfo[]>;
    /**
     * 查询单个资源信息并返回格式化数据
     * @param uuid
     */
    queryAssetInfo(uuid: string): Promise<ISceneDisplayInfo | null>;
    private _getType;
}
