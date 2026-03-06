import { ModuleRenderConfig, IFeatureItem, IFeatureGroup, BaseItem, IModuleItem, CategoryInfo } from '@cocos/creator-types/engine/features';
export { IFeatureItem, BaseItem, IFeatureGroup, IModuleItem } from '@cocos/creator-types/engine/features';

export type IModules = Record<string, IModuleItem>;
export interface IDisplayModuleItem extends IModuleItem {
    _value: boolean;
    _option?: string;
    options?: Record<string, IDisplayModuleItem>;
}

export type IFlags = Record<string, boolean | number>;

export interface IDisplayModuleCache {
    _value: boolean;
    _option?: string; // 保存下拉选项的值
    _flags?: IFlags; // 保存下拉选项的值的联动开关
}

export interface CategoryDetail extends CategoryInfo {
    modules: IModules;
}

export interface IModuleConfig {
    moduleTreeDump: {
        default: IModules;
        categories : Record<string, CategoryDetail>;
    },
    nativeCodeModules: string[];
    moduleCmakeConfig: Record<string, { native?: string; }>;
    moduleDependMap: Record<string, string[]>;
    moduleDependedMap: Record<string, string[]>;
    features: IModules,
    ignoreModules: string[],
    envLimitModule: Record<string, {
        envList: string[];
        fallback?: string;
    }>;
}

export type IDefaultConfigKeys = 'defaultConfig' | 'default2d' | 'default3d' | 'defaultNative' | 'defaultSmallGames'

export type IDefaultConfig = {
    key: IDefaultConfigKeys;
    name: string;
    diyConfig: (cache: Record<string, IDisplayModuleCache>, flags: IFlags, includeModules: string[]) => void;
}


export type ICroppingConfigDeprecatedFeature =  {
    value: boolean,
    version: string
  };

export type ICroppingConfig = {
    name: string;
    cache: Record<string, IDisplayModuleCache>,
    flags: IFlags,
    includeModules: string[],
    noDeprecatedFeatures: ICroppingConfigDeprecatedFeature;
    moduleToFallBack?: Record<string, string>;
}