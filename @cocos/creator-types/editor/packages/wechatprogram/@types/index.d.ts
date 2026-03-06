/// <reference path='../../../@types/index'/>
export * from '@cocos/creator-types/editor/packages/builder/@types/protected';
export * from '../../../@types/editor';

import { IInternalBuildOptions } from '@cocos/creator-types/editor/packages/builder/@types/protected';
import { IDisplayModuleItem, IDisplayModuleCache } from '@cocos/creator-types/editor/packages/engine/@types/module';

export type IOrientation = 'auto' | 'landscape' | 'portrait';

export interface IOptions {
    appid: string;
    orientation: IOrientation;
    globalVariable: string;
}

export interface ITaskOption extends IInternalBuildOptions {
    packages: {
        wechatprogram: IOptions;
    };
}