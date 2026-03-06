/// <reference path='../../../@types/index'/>
export * from '@cocos/creator-types/editor/packages/builder/@types/protected';
import { IInternalBuildOptions } from '@cocos/creator-types/editor/packages/builder/@types/protected';

export type IOrientation = 'landscape' | 'portrait';

export interface IOptions {
    package: string;
    icon: string;
    versionName: string;
    versionCode: string;
    minPlatformVersion: string;
    deviceOrientation: IOrientation;
    useDebugKey: boolean;
    logLevel: string;
    privatePemPath: string;
    certificatePemPath: string;
    separateEngine: boolean;

    subpackages?: { name: string, root: string }[];
    wasmSubpackage: boolean;
}

export interface ITaskOption extends IInternalBuildOptions {
    packages: {
        'honor-mini-game': IOptions;
    };
}