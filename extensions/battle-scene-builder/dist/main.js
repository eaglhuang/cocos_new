"use strict";
/**
 * Cocos Creator 編輯器擴展 — 戰鬥場景自動生成器
 *
 * 架構說明：
 * - main.ts        : Editor Main Process，僅負責接收選單事件並轉發給 Scene Renderer
 * - scene-script.ts : Scene Renderer Process，才能使用 cc API 操作節點
 *
 * 使用方式：
 * 1. 在編輯器中開啟 demo.scene
 * 2. 點擊選單：「開發者 → 戰鬥場景生成器 → 生成戰鬥場景」
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
exports.methods = {
    /** 選單觸發點 — 轉發到 Scene Renderer 執行 */
    async buildBattleScene() {
        console.log('[BattleSceneBuilder] 觸發生成，轉發至 Scene Renderer...');
        try {
            // @ts-ignore
            await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'battle-scene-builder',
                method: 'buildBattleScene',
                args: [],
            });
        }
        catch (err) {
            console.error('[BattleSceneBuilder] 執行失敗：', err);
        }
    },
};
function load() {
    console.log('[BattleSceneBuilder] 擴展已載入');
}
function unload() {
    console.log('[BattleSceneBuilder] 擴展已卸載');
}
