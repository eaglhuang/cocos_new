"use strict";

/**
 * Unity Particle Translator — Extension Entry Point
 *
 * 主功能在 static/panel.html 中以純前端方式執行，
 * 此 main.js 只負責開啟面板及處理選單訊息。
 *
 * Unity 對照：Editor Window (EditorWindow.GetWindow<MyTool>())
 */
module.exports = {
    load() {
        console.log("[UnityParticleTranslator] 載入完成");
    },

    unload() {
        console.log("[UnityParticleTranslator] 已卸載");
    },

    methods: {
        openPanel() {
            Editor.Panel.open("unity-particle-translator");
        },
    },
};
