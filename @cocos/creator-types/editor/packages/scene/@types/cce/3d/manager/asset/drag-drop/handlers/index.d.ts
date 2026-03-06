import { IDropHandler } from './base-handler';
/**
 * 存储拖拽处理器列表
 */
export declare const dropHandlers: IDropHandler[];
/**
 * 注册拖拽处理器
 * @param handler
 */
export declare function registerHandler(handler: IDropHandler): void;
