// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, Node, Canvas, UITransform, Label, Button, ProgressBar, Sprite, Color, Widget, Vec3 } from "cc";
import { EDITOR } from "cc/env";

const { ccclass, property, executeInEditMode } = _decorator;

/**
 * SceneAutoBuilder — 自動生成戰鬥場景節點。
 * 
 * 使用方式：
 * 1. 掛載到 Canvas 節點（或任意節點）
 * 2. 勾選 autoGenerate 屬性
 * 3. 在編輯模式下會立即生成並保留在場景中
 * 4. 保存場景（Ctrl+S）
 * 
 * 注意：仍建議優先使用 battle-scene-builder 編輯器擴展。
 */
@ccclass("SceneAutoBuilder")
@executeInEditMode(true)
export class SceneAutoBuilder extends Component {
  @property({ tooltip: "勾選後自動生成戰鬥場景節點；編輯模式下生成完成會自動取消勾選" })
  autoGenerate = true;

  @property({ tooltip: "是否清除已存在的同名節點" })
  clearExisting = false;

  onLoad(): void {
    if (EDITOR) {
      this.tryGenerate("editor");
    }
  }

  start(): void {
    if (!EDITOR) {
      this.tryGenerate("play");
    }
  }

  private tryGenerate(mode: "editor" | "play"): void {
    if (!this.autoGenerate) return;

    console.log(`[SceneAutoBuilder] 開始生成戰鬥場景（${mode === "editor" ? "編輯模式" : "執行模式"}）...`);

    const canvas = this.node.getComponent(Canvas) 
      ? this.node 
      : this.node.getParent()?.getComponent(Canvas)?.node;

    if (!canvas) {
      console.error("[SceneAutoBuilder] 找不到 Canvas 節點！");
      return;
    }

    console.log("[SceneAutoBuilder] Canvas 節點確認：", canvas.name);

    try {
      this.generateBattleScene(canvas);
      console.log("[SceneAutoBuilder] ✅ 場景生成完成！");
      if (mode === "editor") {
        this.autoGenerate = false;
        console.log("[SceneAutoBuilder] 💡 這次生成已直接寫入場景；請按 Ctrl+S 保存。autoGenerate 已自動取消勾選，避免重複生成。");
      } else {
        console.warn("[SceneAutoBuilder] 目前是在執行模式生成；停止遊戲後節點仍會回滾。若要持久保留，請在編輯模式使用本元件或 battle-scene-builder 擴展。");
      }
    } catch (error) {
      console.error("[SceneAutoBuilder] ❌ 生成失敗：", error);
    }
  }

  private generateBattleScene(canvas: Node): void {
    // 1. BattleScene 控制器節點
    this.createBattleSceneNode(canvas);

    // 2. HUD host（內容由 BattleHUDComposite 執行期建構）
    this.createHUDNode(canvas);

    // 3. DeployPanel 部署面板
    this.createDeployPanelNode(canvas);

    // 4. Popup host（內容由 ResultPopupComposite 執行期建構）
    this.createResultPopupNode(canvas);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BattleScene 節點
  // ═══════════════════════════════════════════════════════════════════════════

  private createBattleSceneNode(parent: Node): void {
    const node = this.getOrCreateNode(parent, "BattleScene");
    console.log("  ✓ BattleScene 節點");
    console.log("    → 請添加 BattleScene 元件");
    console.log("    → 綁定：hud(BattleHUDComposite), deployPanel, resultPopup(ResultPopupComposite)");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HUD 節點
  // ═══════════════════════════════════════════════════════════════════════════

  private createHUDNode(parent: Node): void {
    const hud = this.getOrCreateNode(parent, "HUD");
    hud.getComponent(UITransform) || hud.addComponent(UITransform);
    
    const widget = hud.getComponent(Widget) || hud.addComponent(Widget);
    widget.isAlignTop = true;
    widget.isAlignLeft = true;
    widget.top = 10;
    widget.left = 10;

    console.log("  ✓ HUD 節點");
    console.log("    → 請添加 BattleHUDComposite 元件");
    console.log("    → HUD 內容由 battle-hud-screen 執行期自動建構");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DeployPanel 節點
  // ═══════════════════════════════════════════════════════════════════════════

  private createDeployPanelNode(parent: Node): void {
    const panel = this.getOrCreateNode(parent, "Panel");
    panel.addComponent(UITransform);
    
    const widget = panel.getComponent(Widget) || panel.addComponent(Widget);
    widget.isAlignBottom = true;
    widget.bottom = 20;

    // 兵種按鈕
    this.createButton(panel, "BtnCavalry", "騎兵", -300, -250);
    this.createButton(panel, "BtnInfantry", "步兵", -200, -250);
    this.createButton(panel, "BtnShield", "盾兵", -100, -250);
    this.createButton(panel, "BtnArcher", "弓兵", 0, -250);

    // 路線按鈕
    for (let i = 0; i < 5; i++) {
      this.createButton(panel, `LaneButton${i + 1}`, `路${i + 1}`, -300 + i * 80, -200);
    }

    // 功能按鈕
    this.createButton(panel, "BtnSkill", "發動技能", 200, -250);
    this.createButton(panel, "BtnEndTurn", "結束回合", 350, -250);

    // 選擇標籤
    this.createLabel(panel, "SelectionLabel", "選擇兵種與路線", 18, new Color(255, 255, 255), 0, -150);

    console.log("  ✓ Panel 節點");
    console.log("    → 請添加 DeployPanel 元件");
    console.log("    → 綁定：所有按鈕 + selectionLabel");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ResultPopup 節點
  // ═══════════════════════════════════════════════════════════════════════════

  private createResultPopupNode(parent: Node): void {
    const popup = this.getOrCreateNode(parent, "Popup");
    popup.getComponent(UITransform) || popup.addComponent(UITransform);
    
    const widget = popup.getComponent(Widget) || popup.addComponent(Widget);
    widget.isAlignHorizontalCenter = true;
    widget.isAlignVerticalCenter = true;

    console.log("  ✓ Popup 節點");
    console.log("    → 請添加 ResultPopupComposite 元件");
    console.log("    → Popup 內容由 result-popup-screen 執行期自動建構");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 輔助方法
  // ═══════════════════════════════════════════════════════════════════════════

  private getOrCreateNode(parent: Node, name: string): Node {
    let node = parent.getChildByName(name);
    
    if (node && this.clearExisting) {
      node.destroy();
      node = null;
    }

    if (!node) {
      node = new Node(name);
      node.layer = parent.layer; // 重點修正：繼承父節點的 Layer (UI_2D)，否則 Camera 照不到
      parent.addChild(node);
    }

    return node;
  }

  private createLabel(
    parent: Node,
    name: string,
    text: string,
    fontSize: number,
    color: Color,
    x: number,
    y: number
  ): Node {
    const node = this.getOrCreateNode(parent, name);
    node.addComponent(UITransform);
    
    const label = node.getComponent(Label) || node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.color = color;
    
    node.setPosition(new Vec3(x, y, 0));
    return node;
  }

  private createButton(
    parent: Node,
    name: string,
    labelText: string,
    x: number,
    y: number
  ): Node {
    const node = this.getOrCreateNode(parent, name);
    
    const transform = node.getComponent(UITransform) || node.addComponent(UITransform);
    transform.setContentSize(120, 50);
    
    const sprite = node.getComponent(Sprite) || node.addComponent(Sprite);
    sprite.color = new Color(50, 50, 200);
    
    node.getComponent(Button) || node.addComponent(Button);
    
    // 按鈕文字
    let labelNode = node.getChildByName("Label");
    if (!labelNode) {
      labelNode = new Node("Label");
      labelNode.layer = node.layer; // 繼承 Layer
      labelNode.addComponent(UITransform);
      const label = labelNode.addComponent(Label);
      label.string = labelText;
      label.fontSize = 20;
      label.color = new Color(255, 255, 255);
      node.addChild(labelNode);
    }
    
    node.setPosition(new Vec3(x, y, 0));
    return node;
  }

  private createProgressBar(
    parent: Node,
    name: string,
    progress: number,
    x: number,
    y: number
  ): Node {
    const node = this.getOrCreateNode(parent, name);
    
    const transform = node.getComponent(UITransform) || node.addComponent(UITransform);
    transform.setContentSize(200, 20);
    
    const bar = node.getComponent(ProgressBar) || node.addComponent(ProgressBar);
    bar.progress = progress;
    
    // 背景
    let bg = node.getChildByName("Background");
    if (!bg) {
      bg = new Node("Background");
      bg.layer = node.layer;
      bg.addComponent(UITransform).setContentSize(200, 20);
      const bgSprite = bg.addComponent(Sprite);
      bgSprite.color = new Color(50, 50, 50);
      node.addChild(bg);
    }
    
    // 前景
    let fg = node.getChildByName("Bar");
    if (!fg) {
      fg = new Node("Bar");
      fg.layer = node.layer;
      fg.addComponent(UITransform).setContentSize(200, 20);
      const fgSprite = fg.addComponent(Sprite);
      fgSprite.color = new Color(0, 200, 0);
      node.addChild(fg);
      bar.barSprite = fgSprite;
    }
    
    node.setPosition(new Vec3(x, y, 0));
    return node;
  }
}
