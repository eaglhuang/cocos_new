"use strict";
/**
 * scene-flow-builder — Editor Main Process
 * 職責：接收選單事件，轉發給 Scene Renderer Process 執行
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
exports.methods = {
    async buildLoginScene() {
        console.log('[SceneFlowBuilder] 轉發 buildLoginScene → Scene Renderer');
        // @ts-ignore
        await Editor.Message.request('scene', 'execute-scene-script', {
            name: 'scene-flow-builder',
            method: 'buildLoginScene',
            args: [],
        });
    },
    async buildLoadingScene() {
        console.log('[SceneFlowBuilder] 轉發 buildLoadingScene → Scene Renderer');
        // @ts-ignore
        await Editor.Message.request('scene', 'execute-scene-script', {
            name: 'scene-flow-builder',
            method: 'buildLoadingScene',
            args: [],
        });
    },
    async buildLobbyScene() {
        console.log('[SceneFlowBuilder] 轉發 buildLobbyScene → Scene Renderer');
        // @ts-ignore
        await Editor.Message.request('scene', 'execute-scene-script', {
            name: 'scene-flow-builder',
            method: 'buildLobbyScene',
            args: [],
        });
    },
};
function load() { console.log('[SceneFlowBuilder] 擴展已載入'); }
function unload() { console.log('[SceneFlowBuilder] 擴展已卸載'); }
