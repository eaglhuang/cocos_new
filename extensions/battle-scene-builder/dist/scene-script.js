"use strict";
/**
 * Scene Script — 在 Scene Renderer 進程執行，可使用 cc API
 *
 * 注意：此檔案由 Cocos Creator 的 Scene Renderer 載入，
 *       不是 Editor Main Process，所以可以 import cc 模組。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
const cc_1 = require("cc");
// ─── 輔助函式 ────────────────────────────────────────────────────────────────
function getOrCreate(parent, name) {
    return parent.getChildByName(name) ?? (() => {
        const n = new cc_1.Node(name);
        n.layer = parent.layer; // 重點修正：繼承父節點的 Layer (UI_2D)，否則 Camera 照不到
        parent.addChild(n);
        return n;
    })();
}
function makeLabel(parent, name, text, fontSize, color, x, y) {
    const node = getOrCreate(parent, name);
    if (!node.getComponent(cc_1.UITransform))
        node.addComponent(cc_1.UITransform);
    const lbl = node.getComponent(cc_1.Label) ?? node.addComponent(cc_1.Label);
    lbl.string = text;
    lbl.fontSize = fontSize;
    lbl.color = color;
    node.setPosition(new cc_1.Vec3(x, y, 0));
    return node;
}
function makeButton(parent, name, labelText, x, y) {
    const node = getOrCreate(parent, name);
    const tf = node.getComponent(cc_1.UITransform) ?? node.addComponent(cc_1.UITransform);
    tf.setContentSize(120, 50);
    // 確保有 Sprite（Cocos 3.x 觸控 hit test 需要可渲染元件）
    if (!node.getComponent(cc_1.Sprite)) {
        const spr = node.addComponent(cc_1.Sprite);
        spr.color = new cc_1.Color(60, 60, 180, 200);
    }
    if (!node.getComponent(cc_1.Button))
        node.addComponent(cc_1.Button);
    let labelNode = node.getChildByName('Label');
    if (!labelNode) {
        labelNode = new cc_1.Node('Label');
        labelNode.layer = node.layer;
        labelNode.addComponent(cc_1.UITransform);
        const lbl = labelNode.addComponent(cc_1.Label);
        lbl.string = labelText;
        lbl.fontSize = 20;
        lbl.color = new cc_1.Color(255, 255, 255);
        node.addChild(labelNode);
    }
    node.setPosition(new cc_1.Vec3(x, y, 0));
    return node;
}
function makeProgressBar(parent, name, progress, x, y) {
    const node = getOrCreate(parent, name);
    const tf = node.getComponent(cc_1.UITransform) ?? node.addComponent(cc_1.UITransform);
    tf.setContentSize(200, 20);
    // 前景 Bar（ProgressBar 需要 barSprite）
    let barNode = node.getChildByName('Bar');
    if (!barNode) {
        barNode = new cc_1.Node('Bar');
        barNode.layer = node.layer;
        const bTf = barNode.addComponent(cc_1.UITransform);
        bTf.setContentSize(200, 20);
        const bSpr = barNode.addComponent(cc_1.Sprite);
        bSpr.color = new cc_1.Color(0, 200, 0);
        node.addChild(barNode);
    }
    const pb = node.getComponent(cc_1.ProgressBar) ?? node.addComponent(cc_1.ProgressBar);
    pb.progress = progress;
    const barSprite = barNode.getComponent(cc_1.Sprite);
    pb.barSprite = barSprite;
    node.setPosition(new cc_1.Vec3(x, y, 0));
    return node;
}
// ─── Scene Script 方法（由 main.ts 透過 Editor.Message 呼叫） ────────────────
exports.methods = {
    buildBattleScene() {
        const scene = cc_1.director.getScene();
        if (!scene) {
            console.error('[BattleSceneBuilder] 找不到場景，請先在編輯器中開啟 demo.scene');
            return;
        }
        // ── Canvas 必須是 Scene 的直接子節點，不能掛在 Main Camera 下 ────────────
        // 若 Canvas 是 Main Camera 的子節點，Canvas Camera 會繼承 Main Camera 的世界旋轉
        // (-35,-45,0)，導致 UITransform.hitTest 的 screenToWorld 映射歪斜，所有按鈕永遠
        // 無法被點擊（等同 Unity 把 UI Camera 掛在旋轉的 3D Camera 下）。
        const canvas = scene.getChildByName('Canvas');
        if (!canvas) {
            console.error('[BattleSceneBuilder] 找不到 Canvas 節點');
            return;
        }
        if (canvas.parent !== scene) {
            console.warn('[BattleSceneBuilder] ⚠️ Canvas 目前掛在「' + (canvas.parent?.name ?? '?') + '」下，' +
                '必須移到 Scene 根節點！\n' +
                '請在 Cocos Editor 的 Hierarchy 面板中，把 Canvas 拖曳到 Scene 根節點，再存檔（Ctrl+S）。');
        }
        // EventSystem 節點（UI 觸控事件的必要條件）
        const existingES = scene.getComponentInChildren(cc_1.director.getScene()?.constructor);
        const esNode = scene.getChildByName('EventSystem') ?? (() => {
            const n = new cc_1.Node('EventSystem');
            scene.addChild(n);
            return n;
        })();
        if (!esNode.getComponent('cc.EventSystem')) {
            // 用 addComponent 字串方式：editor script 可能無法直接 import EventSystem
            try {
                esNode.addComponent('cc.EventSystem');
            }
            catch (_) { }
        }
        console.log('[BattleSceneBuilder] 開始生成戰鬥場景...');
        // ══ 設計解析度常數（與 Project Settings → Design Resolution 一致）══════
        // 對照 Unity：等同 CanvasScaler 的 Reference Resolution
        const DESIGN_W = 1920;
        const DESIGN_H = 1024;
        const HALF_W = DESIGN_W / 2; // 960
        const HALF_H = DESIGN_H / 2; // 512
        // Canvas 歸零：移到 Scene 根節點後繼承舊 local position (640,360,316)，
        // 必須重置為 (0,0,0)。alignCanvasWithScreen 在 runtime 會自動調整位置。
        canvas.setPosition(0, 0, 0);
        canvas.setRotationFromEuler(0, 0, 0);
        // ── BattleScene ─────────────────────────────────────────────────────────
        getOrCreate(canvas, 'BattleScene');
        console.log('  ✓ BattleScene（請在 Inspector 添加 BattleScene 元件，綁定 hud/deployPanel/resultPopup）');
        // ── HUD（全畫面透明容器）──────────────────────────────────────────────────
        // 設計為全畫面容器（1920×1024 在 y=0），使子節點可用 Canvas 座標定位
        // 對照 Unity：ScreenSpace-Overlay Canvas 上的 HUD Layer
        const hud = getOrCreate(canvas, 'HUD');
        const hudTf = hud.getComponent(cc_1.UITransform) ?? hud.addComponent(cc_1.UITransform);
        hudTf.setContentSize(DESIGN_W, DESIGN_H);
        hud.setPosition(new cc_1.Vec3(0, 0, 0));
        const oldHudWidget = hud.getComponent(cc_1.Widget);
        if (oldHudWidget)
            hud.removeComponent(oldHudWidget);
        // HUD 子節點以 Canvas 座標系定位（頂部區域 y ≈ +450 ~ +490）
        // x 基準：-960 = 左邊界，+960 = 右邊界；y 基準：+512 = 頂邊界
        makeLabel(hud, 'TurnLabel', '第 1 回合', 24, new cc_1.Color(255, 255, 255), -860, +475);
        makeLabel(hud, 'DpLabel', 'DP: 30', 20, new cc_1.Color(255, 200, 0), -700, +475);
        makeProgressBar(hud, 'PlayerSpBar', 0, -520, +477);
        makeLabel(hud, 'PlayerSpLabel', '0/100', 18, new cc_1.Color(255, 255, 0), -380, +475);
        makeLabel(hud, 'PlayerFortressLabel', '我方 HP', 16, new cc_1.Color(0, 255, 0), -800, +447);
        makeProgressBar(hud, 'PlayerFortressBar', 1, -640, +443);
        makeLabel(hud, 'EnemyFortressLabel', '敵方 HP', 16, new cc_1.Color(255, 0, 0), +715, +475);
        makeProgressBar(hud, 'EnemyFortressBar', 1, +545, +443);
        makeLabel(hud, 'StatusLabel', '', 20, new cc_1.Color(255, 255, 0), +50, +475);
        console.log('  ✓ HUD（請添加 BattleHUD 元件並綁定各子節點）');
        // ── DeployPanel（全畫面透明容器）─────────────────────────────────────────
        // 設計為全畫面容器（1920×1024 在 y=0），子節點可自由定位到畫面左側、底部等區域
        // 對照 Unity：ScreenSpace-Overlay Canvas 上的 ActionBar Layer
        const panel = getOrCreate(canvas, 'Panel');
        const panelTf = panel.getComponent(cc_1.UITransform) ?? panel.addComponent(cc_1.UITransform);
        panelTf.setContentSize(DESIGN_W, DESIGN_H);
        panel.setPosition(new cc_1.Vec3(0, 0, 0));
        const oldPanelWidget = panel.getComponent(cc_1.Widget);
        if (oldPanelWidget)
            panel.removeComponent(oldPanelWidget);
        // ── 兵種選擇按鈕（左側，兩欄配置）──────────────────────────────────────
        // 欄1 x=-840（緊靠左邊界 60px + 半寬 60px = -840）；欄2 x=-700（間距 20px）
        makeButton(panel, 'BtnCavalry', '騎兵', -840, +255);
        makeButton(panel, 'BtnInfantry', '步兵', -700, +255);
        makeButton(panel, 'BtnShield', '盾兵', -840, +190);
        makeButton(panel, 'BtnArcher', '弓兵', -700, +190);
        // 兵種「槍兵」補丁：scene-script 建立後 DeployPanel.ensureBindings 會自動添加 Label
        makeButton(panel, 'BtnPikeman', '槍兵', -840, +125);
        // ── 路線選擇按鈕（底部中央）──────────────────────────────────────────────
        for (let i = 0; i < 5; i++) {
            makeButton(panel, `LaneButton${i + 1}`, `路${i + 1}`, -120 + i * 80, -400);
        }
        makeLabel(panel, 'SelectionLabel', '選擇兵種與路線', 18, new cc_1.Color(255, 255, 255), -770, +60);
        // ── 功能按鈕（右下角）────────────────────────────────────────────────────
        makeButton(panel, 'BtnSkill', '發動技能', +810, -360);
        makeButton(panel, 'BtnEndTurn', '結束回合', +810, -440);
        console.log('  ✓ Panel（請添加 DeployPanel 元件並綁定各按鈕）');
        // ── ResultPopup ──────────────────────────────────────────────────────────
        const popup = getOrCreate(canvas, 'Popup');
        if (!popup.getComponent(cc_1.UITransform))
            popup.addComponent(cc_1.UITransform);
        if (!popup.getComponent(cc_1.UIOpacity))
            popup.addComponent(cc_1.UIOpacity);
        // 背景遮罩
        const bg = getOrCreate(popup, 'Background');
        const bgTf = bg.getComponent(cc_1.UITransform) ?? bg.addComponent(cc_1.UITransform);
        bgTf.setContentSize(1280, 720);
        const bgSpr = bg.getComponent(cc_1.Sprite) ?? bg.addComponent(cc_1.Sprite);
        bgSpr.color = new cc_1.Color(0, 0, 0, 180);
        makeLabel(popup, 'TitleLabel', '🎉 勝利！', 48, new cc_1.Color(255, 255, 0), 0, 100);
        makeLabel(popup, 'DescLabel', '成功擊敗敵軍，取得大勝！', 24, new cc_1.Color(255, 255, 255), 0, 0);
        makeButton(popup, 'BtnReplay', '再來一場', 0, -100);
        popup.active = false; // 預設隱藏
        console.log('  ✓ Popup（請添加 ResultPopup 元件並綁定子節點，確認 Active = false）');
        console.log('[BattleSceneBuilder] ✅ 戰鬥場景生成完成！請手動綁定各元件引用後保存場景（Ctrl+S）。');
    },
};
