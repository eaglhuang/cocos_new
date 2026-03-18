import { _decorator, Button, Color, Component, Label, Mask, Node, ScrollBar, ScrollView, Sprite, UITransform, Vec3 } from "cc";

const { ccclass, property } = _decorator;

@ccclass("BattleLogPanel")
export class BattleLogPanel extends Component {
  @property(Label)
  logLabel: Label = null!;

  @property(ScrollView)
  scrollView: ScrollView = null!;

  @property
  maxLines = 80;

  private expanded = true;
  private headerNode: Node | null = null;
  private bodyNode: Node | null = null;
  private titleLabel: Label | null = null;
  private contentNode: Node | null = null;
  private readonly expandedSize = new Vec3(0, 0, 0);

  private readonly lines: string[] = [];

  onLoad(): void {
    this.ensureBindings();
    this.clear();
  }

  public clear(): void {
    this.lines.length = 0;
    this.flush();
  }

  public append(text: string): void {
    if (!text) return;
    this.lines.push(text);
    while (this.lines.length > Math.max(1, this.maxLines)) {
      this.lines.shift();
    }
    this.flush();
  }

  private flush(): void {
    if (!this.logLabel) return;
    this.logLabel.string = this.lines.join("\n");

    const contentTf = this.contentNode?.getComponent(UITransform);
    if (contentTf) {
      const estimatedHeight = Math.max(180, this.lines.length * (this.logLabel.lineHeight || 18) + 24);
      contentTf.setContentSize(308, estimatedHeight);
      this.contentNode!.setPosition(new Vec3(0, (estimatedHeight - 180) * 0.5, 0));
      this.scrollView?.scrollToBottom(0.05);
    }
  }

  private ensureBindings(): void {
    const rootTf = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    rootTf.setContentSize(360, 236);

    const rootSprite = this.node.getComponent(Sprite) ?? this.node.addComponent(Sprite);
    rootSprite.color = new Color(24, 28, 34, 205);

    if (this.node.position.equals(Vec3.ZERO)) {
      this.node.setPosition(new Vec3(760, 285, 0));
    }

    this.headerNode = this.node.getChildByName("Header") ?? new Node("Header");
    if (!this.headerNode.parent) this.node.addChild(this.headerNode);
    this.headerNode.addComponent(UITransform).setContentSize(360, 34);
    this.headerNode.setPosition(new Vec3(0, 96, 0));
    const headerSprite = this.headerNode.getComponent(Sprite) ?? this.headerNode.addComponent(Sprite);
    headerSprite.color = new Color(48, 58, 74, 235);
    const headerButton = this.headerNode.getComponent(Button) ?? this.headerNode.addComponent(Button);
    this.headerNode.off(Button.EventType.CLICK);
    this.headerNode.on(Button.EventType.CLICK, this.toggleOpen, this);

    const titleNode = this.headerNode.getChildByName("Title") ?? new Node("Title");
    if (!titleNode.parent) this.headerNode.addChild(titleNode);
    titleNode.addComponent(UITransform).setContentSize(320, 28);
    titleNode.setPosition(new Vec3(0, 0, 0));
    this.titleLabel = titleNode.getComponent(Label) ?? titleNode.addComponent(Label);
    this.titleLabel.string = "戰鬥紀錄 ▼";
    this.titleLabel.fontSize = 18;
    this.titleLabel.lineHeight = 20;
    this.titleLabel.color = new Color(230, 235, 242, 255);
    this.titleLabel.isBold = true;

    this.bodyNode = this.node.getChildByName("Body") ?? new Node("Body");
    if (!this.bodyNode.parent) this.node.addChild(this.bodyNode);
    this.bodyNode.addComponent(UITransform).setContentSize(344, 188);
    this.bodyNode.setPosition(new Vec3(0, -8, 0));

    const viewport = this.bodyNode.getChildByName("view") ?? new Node("view");
    if (!viewport.parent) this.bodyNode.addChild(viewport);
    (viewport.getComponent(UITransform) ?? viewport.addComponent(UITransform)).setContentSize(320, 180);
    viewport.setPosition(new Vec3(-8, 0, 0));
    const oldViewportSprite = viewport.getComponent(Sprite);
    if (oldViewportSprite) {
      oldViewportSprite.destroy();
    }
    // Mask 會使用 Graphics，不能與 Sprite 掛在同一節點，因此背景改放子節點。
    const viewportBg = viewport.getChildByName("Background") ?? new Node("Background");
    if (!viewportBg.parent) viewport.addChild(viewportBg);
    (viewportBg.getComponent(UITransform) ?? viewportBg.addComponent(UITransform)).setContentSize(320, 180);
    viewportBg.setPosition(Vec3.ZERO);
    const viewportSprite = viewportBg.getComponent(Sprite) ?? viewportBg.addComponent(Sprite);
    viewportSprite.color = new Color(12, 16, 24, 165);

    if (!viewport.getComponent(Mask)) viewport.addComponent(Mask);

    this.contentNode = viewport.getChildByName("Content") ?? new Node("Content");
    if (!this.contentNode.parent) viewport.addChild(this.contentNode);
    const contentTf = this.contentNode.getComponent(UITransform) ?? this.contentNode.addComponent(UITransform);
    contentTf.setContentSize(308, 180);
    this.contentNode.setPosition(new Vec3(0, 0, 0));

    if (!this.logLabel) {
      this.logLabel = this.contentNode.getComponent(Label) ?? this.contentNode.addComponent(Label);
    }
    this.logLabel.fontSize = 15;
    this.logLabel.lineHeight = 18;
    this.logLabel.color = new Color(238, 238, 238, 255);
    this.logLabel.overflow = Label.Overflow.RESIZE_HEIGHT;

    const scrollBarNode = this.bodyNode.getChildByName("VScroll") ?? new Node("VScroll");
    if (!scrollBarNode.parent) this.bodyNode.addChild(scrollBarNode);
    scrollBarNode.addComponent(UITransform).setContentSize(10, 180);
    scrollBarNode.setPosition(new Vec3(160, 0, 0));
    const scrollBarSprite = scrollBarNode.getComponent(Sprite) ?? scrollBarNode.addComponent(Sprite);
    scrollBarSprite.color = new Color(60, 72, 92, 180);

    const handleNode = scrollBarNode.getChildByName("Handle") ?? new Node("Handle");
    if (!handleNode.parent) scrollBarNode.addChild(handleNode);
    handleNode.addComponent(UITransform).setContentSize(10, 44);
    const handleSprite = handleNode.getComponent(Sprite) ?? handleNode.addComponent(Sprite);
    handleSprite.color = new Color(170, 190, 220, 235);

    const scrollBar = scrollBarNode.getComponent(ScrollBar) ?? scrollBarNode.addComponent(ScrollBar);
    scrollBar.handle = handleSprite;
    scrollBar.direction = ScrollBar.Direction.VERTICAL;

    this.scrollView = this.bodyNode.getComponent(ScrollView) ?? this.bodyNode.addComponent(ScrollView);
    this.scrollView.content = this.contentNode;
    this.scrollView.vertical = true;
    this.scrollView.horizontal = false;
    this.scrollView.verticalScrollBar = scrollBar;
    this.scrollView.brake = 0.55;

    if (!this.node.parent) return;
    this.applyExpandedState();
  }

  private toggleOpen(): void {
    this.expanded = !this.expanded;
    this.applyExpandedState();
  }

  private applyExpandedState(): void {
    const rootTf = this.node.getComponent(UITransform);
    if (!rootTf) return;

    if (this.expanded) {
      rootTf.setContentSize(360, 236);
      this.bodyNode && (this.bodyNode.active = true);
      this.headerNode?.setPosition(new Vec3(0, 96, 0));
      if (this.titleLabel) this.titleLabel.string = "戰鬥紀錄 ▼";
    } else {
      rootTf.setContentSize(152, 34);
      this.bodyNode && (this.bodyNode.active = false);
      this.headerNode?.setPosition(new Vec3(0, 0, 0));
      if (this.titleLabel) this.titleLabel.string = "戰鬥紀錄 ▶";
    }
  }
}
