/**
 * scene-flow-builder — Scene Script（在 Scene Renderer Process 執行，可使用 cc API）
 *
 * 負責一鍵建立各場景的完整節點樹、掛好腳本元件、並綁定 Click Events。
 * 使用前請先在 Cocos Editor 中開啟對應的 .scene 檔，再從選單觸發。
 *
 * === Unity 對照 ===
 * 等同 Unity 的 [MenuItem] Editor Script，在 Edit Mode 下直接操作 Scene 層級，
 * 建立 GameObject、AddComponent、設定 Serialized Reference。
 */

import {
  director,
  Node,
  UITransform,
  Widget,
  Label,
  Sprite,
  Button,
  Color,
  Vec3,
  Camera,
  Canvas,
  EventHandler,
} from 'cc';

// ─── 共用輔助函式 ────────────────────────────────────────────────────────────

function getOrCreate(parent: Node, name: string): Node {
  const existing = parent.getChildByName(name);
  if (existing) return existing;
  const n = new Node(name);
  n.layer = parent.layer;
  parent.addChild(n);
  return n;
}

/** 建立一個全螢幕 Widget 容器（等同 Unity 的 StretchAll RectTransform） */
function makeFullscreenNode(parent: Node, name: string): Node {
  const n = getOrCreate(parent, name);
  const tf = n.getComponent(UITransform) ?? n.addComponent(UITransform);
  tf.setContentSize(1280, 720);
  const w = n.getComponent(Widget) ?? n.addComponent(Widget);
  w.isAlignTop = true; w.isAlignBottom = true;
  w.isAlignLeft = true; w.isAlignRight = true;
  w.top = 0; w.bottom = 0; w.left = 0; w.right = 0;
  return n;
}


/** 建立 Label 節點 */
function makeLabel(parent: Node, name: string, text: string, fontSize: number, color: Color, x: number, y: number): Node {
  const n = getOrCreate(parent, name);
  n.getComponent(UITransform) ?? n.addComponent(UITransform);
  const lbl = n.getComponent(Label) ?? n.addComponent(Label);
  lbl.string = text;
  lbl.fontSize = fontSize;
  lbl.color = color;
  n.setPosition(new Vec3(x, y, 0));
  return n;
}

/**
 * 建立 Button 節點並自動綁定 Click Event
 *
 * @param targetNode  掛有 callback 腳本的節點（Inspector 中的 Node 槽）
 * @param componentName  腳本的 @ccclass 名稱（例如 'LoginScene'）
 * @param handlerName    要呼叫的 public 方法名稱（例如 'onClickStart'）
 *
 * === Unity 對照 ===
 * 等同在 Editor Script 裡寫：
 *   button.onClick.AddListener(() => loginScene.onClickStart());
 * Cocos 則是透過 EventHandler 物件描述「誰的哪個 method」
 */
function makeButton(
  parent: Node, name: string, labelText: string,
  x: number, y: number, width: number, height: number,
  targetNode?: Node, componentName?: string, handlerName?: string,
): Node {
  const n = getOrCreate(parent, name);
  const tf = n.getComponent(UITransform) ?? n.addComponent(UITransform);
  tf.setContentSize(width, height);

  const spr = n.getComponent(Sprite) ?? n.addComponent(Sprite);
  spr.color = new Color(40, 60, 160, 220);

  const btn = n.getComponent(Button) ?? n.addComponent(Button);

  // 自動綁定 Click Event（等同 Unity Inspector 拖入 Button.onClick）
  if (targetNode && componentName && handlerName) {
    const handler = new EventHandler();
    handler.target = targetNode;
    handler.component = componentName;
    handler.handler = handlerName;
    handler.customEventData = '';
    btn.clickEvents = [handler];
  }

  // 子標籤
  let lblNode = n.getChildByName('Label');
  if (!lblNode) {
    lblNode = new Node('Label');
    lblNode.layer = n.layer;
    lblNode.addComponent(UITransform);
    const lbl = lblNode.addComponent(Label);
    lbl.string = labelText;
    lbl.fontSize = Math.floor(height * 0.45);
    lbl.color = new Color(255, 255, 255);
    n.addChild(lblNode);
  }

  n.setPosition(new Vec3(x, y, 0));
  return n;
}

// ─── Scene Script 方法（由 main.ts 透過 Editor.Message 呼叫） ────────────────

export const methods = {

  // ══════════════════════════════════════════════════════════════════════
  // ① LoginScene：一個全螢幕背景 + 遊戲標題 + 「開始」按鈕
  //   按鈕的 Click Event 自動綁定到 LoginScene 腳本的 onClickStart()
  // ══════════════════════════════════════════════════════════════════════
  buildLoginScene() {
    const scene = director.getScene();
    if (!scene) {
      console.error('[SceneFlowBuilder] 找不到開啟的場景，請先在 Editor 中開啟 LoginScene.scene');
      return;
    }
    const canvas = scene.getChildByName('Canvas');
    if (!canvas) {
      console.error('[SceneFlowBuilder] 找不到 Canvas 節點，請先確認場景有 Canvas');
      return;
    }

    // 找到掛有 LoginScene 腳本的節點（通常就是 Canvas 自身或其第一個子節點）
    // 這裡預設腳本掛在 Canvas 根節點上
    const scriptNode = canvas;

    // 全螢幕背景層
    const bg = makeFullscreenNode(canvas, 'Background');
    const bgSpr = bg.getComponent(Sprite) ?? bg.addComponent(Sprite);
    bgSpr.color = new Color(20, 25, 50, 255);   // 深藍底色（佔位，之後換圖）

    // 標題
    makeLabel(canvas, 'TitleLabel', '三國傳承', 72, new Color(220, 180, 60), 0, 120);
    makeLabel(canvas, 'SubtitleLabel', 'GLOBAL EXPEDITION', 28, new Color(180, 180, 180), 0, 50);

    // 開始按鈕 — Click Event 自動綁定 LoginScene.onClickStart
    makeButton(canvas, 'BtnStart', '開始遊戲', 0, -80, 320, 70,
      scriptNode, 'LoginScene', 'onClickStart');

    console.log('[SceneFlowBuilder] ✅ LoginScene 節點樹已建立！');
    console.log('  → 請在 Canvas 節點的 Inspector 中掛上 LoginScene 腳本（scripts/ui/scenes/LoginScene）');
    console.log('  → 存檔 Ctrl+S');
  },

  // ══════════════════════════════════════════════════════════════════════
  // ② LoadingScene：全螢幕背景（動態載入中）+ 進度文字 + LoadingScene 腳本
  //   LoadingScene.ts 已自行建立 UI，這裡只確保 Canvas 根節點結構乾淨
  // ══════════════════════════════════════════════════════════════════════
  buildLoadingScene() {
    const scene = director.getScene();
    if (!scene) {
      console.error('[SceneFlowBuilder] 找不到開啟的場景，請先在 Editor 中開啟 LoadingScene.scene');
      return;
    }
    const canvas = scene.getChildByName('Canvas');
    if (!canvas) {
      console.error('[SceneFlowBuilder] 找不到 Canvas 節點');
      return;
    }

    // LoadingScene.ts 內的 _buildUI() 已在 Runtime 動態建立 Sprite 背景
    // 此處只確保 Canvas 本身是乾淨的全螢幕容器，並提示腳本掛載位置
    canvas.setPosition(0, 0, 0);
    canvas.setRotationFromEuler(0, 0, 0);

    // 一個靜態 Loading 提示文字（Runtime 的圖片由腳本自行載入覆蓋）
    makeLabel(canvas, 'LoadingHintLabel', '載入中，請稍候...', 32,
      new Color(200, 200, 200), 0, -200);

    // 進度文字佔位（由 LoadingScene.ts 更新）
    makeLabel(canvas, 'ProgressLabel', '0%', 24, new Color(150, 220, 255), 0, -250);

    console.log('[SceneFlowBuilder] ✅ LoadingScene 節點樹已建立！');
    console.log('  → 請在 Canvas 節點的 Inspector 掛上 LoadingScene 腳本（scripts/ui/scenes/LoadingScene）');
    console.log('  → bgTexturePath 欄位預設為 textures/bg_normal_day，可在 Inspector 中修改');
    console.log('  → 存檔 Ctrl+S');
  },

  // ══════════════════════════════════════════════════════════════════════
  // ③ LobbyScene：大廳骨架（預留），現階段只建立佔位 UI
  //   之後再擴充選武將、選關卡的 UI
  // ══════════════════════════════════════════════════════════════════════
  buildLobbyScene() {
    const scene = director.getScene();
    if (!scene) {
      console.error('[SceneFlowBuilder] 找不到開啟的場景');
      return;
    }
    const canvas = scene.getChildByName('Canvas');
    if (!canvas) {
      console.error('[SceneFlowBuilder] 找不到 Canvas 節點');
      return;
    }
    const scriptNode = canvas;

    // ★ 強制清理舊節點（確保排版更新有效）
    ['Background', 'TitleLabel', 'BtnGeneralList', 'BtnEnterBattle', 'BtnExit', 'GeneralListPanel', 'GeneralDetailPanel'].forEach(name => {
      const old = canvas.getChildByName(name);
      if (old) old.destroy();
    });

    // ── 大廳背景 ──────────────────────────────────────────────────────────
    const bg = makeFullscreenNode(canvas, 'Background');
    const bgSpr = bg.getComponent(Sprite) ?? bg.addComponent(Sprite);
    bgSpr.color = new Color(15, 20, 25, 255);

    // 標題 (靠左偏)
    makeLabel(canvas, 'TitleLabel', '大廳主選單', 48, new Color(220, 180, 60), -450, 320);

    // ── 功能按鈕群 (左對齊) ────────────────────────────────────────────────
    makeButton(canvas, 'BtnGeneralList', '武將列表 (Tab)', -450, 200, 260, 65,
      scriptNode, 'LobbyScene', 'onClickGeneralList');

    makeButton(canvas, 'BtnEnterBattle', '進入戰鬥 (Demo)', -450,  -240, 260, 65,
      scriptNode, 'LobbyScene', 'onClickEnterBattle');
      
    makeButton(canvas, 'BtnExit',        '返回登入',     -450, -315, 200, 50,
      scriptNode, 'LobbyScene', 'onClickExit');

    // ════════════════════════════════════════════════════════════════
    // GeneralListPanel (表格面板)
    // ════════════════════════════════════════════════════════════════
    const listPanel = getOrCreate(canvas, 'GeneralListPanel');
    const listPanelTf = listPanel.getComponent(UITransform) ?? listPanel.addComponent(UITransform);
    listPanelTf.setContentSize(1280, 720);
    const listBg = listPanel.getComponent(Sprite) ?? listPanel.addComponent(Sprite);
    listBg.color = new Color(10, 10, 10, 220); 
    listPanel.active = false; 

    // 面板標題 (靠左)
    makeLabel(listPanel, 'PanelTitle', '武將資料總覽', 30, new Color(255, 220, 100), -300, 280);

    // 卡片容器 (靠左)
    const cardContainer = getOrCreate(listPanel, 'CardContainer');
    const ccTf = cardContainer.getComponent(UITransform) ?? cardContainer.addComponent(UITransform);
    ccTf.setAnchorPoint(0, 0.5);
    ccTf.setContentSize(600, 500); 
    cardContainer.setPosition(new Vec3(-450, 20, 0)); // ★ 與按鈕對齊

    const layout = cardContainer.getComponent('cc.Layout') as any ?? cardContainer.addComponent('cc.Layout' as any);
    if (layout) {
      layout.type = 2; // Vertical
      layout.spacingY = 5;
      layout.paddingTop = 10;
      layout.childAlignment = 0; // Left
    }

    // 關閉按鈕
    makeButton(listPanel, 'BtnCloseList', '✕ 關閉列表', 500, 300, 140, 55,
      listPanel, 'GeneralListPanel', 'hide');

    console.log('  ✓ GeneralListPanel（掛上 GeneralListPanel 腳本）');

    // ════════════════════════════════════════════════════════════════
    // GeneralDetailPanel（武將詳情彈窗）
    // ════════════════════════════════════════════════════════════════
    const detailPanel = getOrCreate(canvas, 'GeneralDetailPanel');
    const dpTf = detailPanel.getComponent(UITransform) ?? detailPanel.addComponent(UITransform);
    dpTf.setContentSize(620, 480);
    detailPanel.setPosition(new Vec3(0, 0, 0));
    const dpBg = detailPanel.getComponent(Sprite) ?? detailPanel.addComponent(Sprite);
    dpBg.color = new Color(20, 30, 70, 245);
    detailPanel.active = false;

    // 武將屬性 Label 們
    const labelDefs: [string, string, number, number][] = [
      ['NameLabel',        '武將名稱',   36, 160 ],
      ['FactionLabel',     '陣營：',     20, 100 ],
      ['HpLabel',          'HP：',       20,  50 ],
      ['SpLabel',          'SP：',       20,   5 ],
      ['AtkBonusLabel',    '攻擊加成：', 20, -40 ],
      ['SkillLabel',       '技能：',     18, -90 ],
      ['TerrainLabel',     '地形：',     18,-140 ],
      ['TerrainBonusLabel','地形防禦：', 18,-185 ],
    ];
    labelDefs.forEach(([name, placeholder, size, y]) => {
      makeLabel(detailPanel, name, placeholder, size, new Color(230, 230, 230), 0, y);
    });

    // 關閉按鈕
    makeButton(detailPanel, 'BtnClose', '✕ 關閉', 250, 200, 110, 46,
      detailPanel, 'GeneralDetailPanel', 'hide');

    console.log('  ✓ GeneralDetailPanel（掛上 GeneralDetailPanel 腳本）');

    console.log('[SceneFlowBuilder] ✅ LobbyScene 節點樹已建立！');
    console.log('  → Canvas 掛 LobbyScene 腳本');
    console.log('  → GeneralListPanel 節點掛 GeneralListPanel 腳本');
    console.log('  → GeneralDetailPanel 節點掛 GeneralDetailPanel 腳本');
    console.log('  → 存檔 Ctrl+S');
  },
};
