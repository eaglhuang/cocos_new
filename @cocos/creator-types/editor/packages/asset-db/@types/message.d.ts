import { AssetInfo, QueryAssetsOption, AssetOperationOption, IAssetMeta, IAssetInfo } from './public';
import { MissingAssetInfo } from '@editor/asset-db/libs/info';

export interface message extends EditorMessageMap {
    'query-ready': {
        params: [],
        result: boolean,
    },
    'create-asset': {
        params: [
            string,
            string | Buffer | null,
        ] | [
            string,
            string | Buffer | null, 
            AssetOperationOption,
        ],
        result: AssetInfo | null,
    },
    'import-asset': {
        params: [
            string,
            string,
        ] | [
            string,
            string,
            AssetOperationOption,
        ],
        result: AssetInfo | null,
    },
    'copy-asset': {
        params: [
            string,
            string,
        ] | [
            string,
            string,
            AssetOperationOption,
        ],
        result: AssetInfo | null,
    },
    'move-asset': {
        params: [
            string,
            string,
        ] | [
            string,
            string,
            AssetOperationOption,
        ],
        result: AssetInfo | null,
    },
    'delete-asset': {
        params: [
            string,
        ],
        result: AssetInfo | null,
    },
    'open-asset': {
        params: [
            string,
        ],
        result: void,
    },
    'save-asset': {
        params: [
            string,
            string | Buffer,
        ],
        result: AssetInfo | null,
    },
    'save-asset-meta': {
        params: [
            string,
            string,
        ],
        result: AssetInfo | null,
    },
    'reimport-asset': {
        params: [
            string,
        ],
        result: void,
    },
    'refresh-asset': {
        params: [
            string
        ],
        result: void,
    },
    'query-asset-info': {
        params: [
            urlOrUUIDOrPath: string, // uuid | url | path
            dataKeys?: string[],
        ],
        result: AssetInfo | null,
    },
    'query-missing-asset-info': {
        params: [
            urlOrPath: string, // uuid | path
        ],
        result: MissingAssetInfo | null,
    },
    'query-asset-meta': {
        params: [
            string,
        ],
        result: IAssetMeta | null,
    },
    /**
     * 查询资源被哪些资源或脚本直接使用到
     * @param uuidOrURL 资源的 uuid 或者 url
     * @param type 可选，指定查询的资源类型，默认 asset, 可选值：asset, script, all
     */
    'query-asset-users': {
        params: [
            string,
            QueryAssetType?
        ],
        result: string[],
    },
    /**
     * 查询资源依赖的资源或脚本 uuid 数组
     * @param uuidOrURL 资源的 uuid 或者 url
     * @param type 可选，指定查询的资源类型，默认 asset, 可选值：asset, script, all
     */
    'query-asset-dependencies': {
        params: [
            string,
            QueryAssetType?
        ],
        result: string[],
    },
    'query-path': {
        params: [
            string,
        ],
        result: string | null,
    },
    'query-url': {
        params: [
            string
        ],
        result: string | null,
    },
    'query-uuid': {
        params: [
            string
        ],
        result: string | null,
    },
    'query-assets': {
        params: [
            options?: QueryAssetsOption,
            dataKeys?: (keyof IAssetInfo)[]
        ],
        result: AssetInfo[],
    },
    'generate-available-url': {
        params: [
            string,
        ],
        result: string,
    },
}
