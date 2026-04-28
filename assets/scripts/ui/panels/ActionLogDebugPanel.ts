import { _decorator, BlockInputEvents, Button, Color, Component, Label, Layout, Mask, Node, ScrollView, UITransform, Widget } from 'cc';
import { DEV } from 'cc/env';
import { services } from '../../core/managers/ServiceLoader';
import { ActionLogStore, type ActionLogDebugSnapshot } from '../../core/services/ActionLogStore';
import { SolidBackground } from '../components/SolidBackground';

const { ccclass } = _decorator;

interface ButtonHandle {
    node: Node;
    label: Label;
}

function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    const seconds = `${date.getSeconds()}`.padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

function truncateJson(value: unknown, limit = 180): string {
    try {
        const text = JSON.stringify(value);
        if (!text) {
            return 'null';
        }
        return text.length > limit ? `${text.slice(0, limit)}...` : text;
    } catch {
        return String(value);
    }
}

function createTextNode(parent: Node, name: string, width: number, height: number, text: string, fontSize = 20): Label {
    const node = new Node(name);
    node.parent = parent;
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(width, height);
    const label = node.getComponent(Label) ?? node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.max(fontSize + 4, fontSize);
    label.horizontalAlign = Label.HorizontalAlign.LEFT;
    label.verticalAlign = Label.VerticalAlign.TOP;
    label.overflow = Label.Overflow.RESIZE_HEIGHT;
    return label;
}

function bindPointerFallback(node: Node, onClick: () => void): void {
    let lastInvokeAt = 0;
    const invoke = (): void => {
        const now = Date.now();
        if (now - lastInvokeAt < 80) {
            return;
        }
        lastInvokeAt = now;
        onClick();
    };
    node.on(Node.EventType.TOUCH_END, invoke);
    node.on(Node.EventType.MOUSE_UP, invoke);
}

function createButton(
    parent: Node,
    name: string,
    text: string,
    width: number,
    height: number,
    color: Color,
    onClick: () => void,
    options?: { pointerFallback?: boolean },
): ButtonHandle {
    const node = new Node(name);
    node.parent = parent;
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(width, height);
    const background = node.getComponent(SolidBackground) ?? node.addComponent(SolidBackground);
    background.color = color;
    const button = node.getComponent(Button) ?? node.addComponent(Button);
    button.transition = Button.Transition.NONE;
    button.node.on(Button.EventType.CLICK, onClick, button);
    if (options?.pointerFallback) {
        bindPointerFallback(button.node, onClick);
    }
    const label = createTextNode(node, 'Label', width - 16, height - 8, text, 18);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    return { node, label };
}

function createLogRow(parent: Node, name: string, width: number, text: string, accent: Color, height = 104): void {
    const row = new Node(name);
    row.parent = parent;
    const transform = row.getComponent(UITransform) ?? row.addComponent(UITransform);
    transform.setContentSize(width, height);
    const background = row.getComponent(SolidBackground) ?? row.addComponent(SolidBackground);
    background.color = accent;
    const label = createTextNode(row, 'Label', width - 24, height - 16, text, 18);
    label.node.setPosition(-((width / 2) - 12), (height / 2) - 12, 0);
}

@ccclass('ActionLogDebugPanel')
export class ActionLogDebugPanel extends Component {
    public maxRecords = 120;
    public onVisibilityChanged: (() => void) | null = null;

    private readonly _store = ActionLogStore.getInstance();
    private _isBuilt = false;
    private _scrollView: ScrollView | null = null;
    private _contentNode: Node | null = null;
    private _summaryLabel: Label | null = null;

    onLoad(): void {
        if (!DEV) {
            this.node.active = false;
            this.node.destroy();
            return;
        }

        services().initialize(this.node);
        this._buildUi();
        this.node.active = false;
    }

    public async open(limit = this.maxRecords): Promise<void> {
        if (!DEV) {
            return;
        }

        this.maxRecords = limit;
        this.node.active = true;
        this.onVisibilityChanged?.();
        await this.refresh(limit);
    }

    public close(): void {
        if (!this.node.isValid) {
            return;
        }
        this.node.active = false;
        this.onVisibilityChanged?.();
    }

    public async refresh(limit = this.maxRecords): Promise<void> {
        if (!DEV || !this._isBuilt) {
            return;
        }

        this.maxRecords = limit;
        const snapshot = await this._store.getDebugSnapshot(limit);
        this.applySnapshot(snapshot);
    }

    public applySnapshot(snapshot: ActionLogDebugSnapshot): void {
        if (!this._summaryLabel || !this._contentNode) {
            return;
        }

        this._summaryLabel.string = `Storage: ${snapshot.storageMode} | Pending: ${snapshot.pendingCount} | Seq: ${snapshot.currentSeq} | Total: ${snapshot.total} | Device: ${snapshot.deviceId || 'n/a'}`;

        for (const child of [...this._contentNode.children]) {
            child.destroy();
        }

        const contentWidth = this._contentNode.getComponent(UITransform)?.width ?? 1100;
        const records = snapshot.records;
        if (records.length === 0) {
            createLogRow(
                this._contentNode,
                'EmptyRow',
                contentWidth,
                '目前沒有任何 Action_Records。\n請先進行一次轉蛋，或重新整理後再查看。',
                new Color(45, 52, 60, 220),
                92,
            );
        } else {
            records.forEach((record, index) => {
                const payloadText = truncateJson(record.Payload);
                const resultsText = record.Payload && typeof record.Payload === 'object'
                    ? truncateJson((record.Payload as Record<string, unknown>).results ?? null)
                    : 'null';
                const body = [
                    `#${record.Seq} | ${formatTimestamp(record.Timestamp)} | ${record.Action}`,
                    `Tx: ${record.Tx_Hash.slice(0, 16)}...`,
                    `Payload: ${payloadText}`,
                    `Results: ${resultsText}`,
                ].join('\n');

                createLogRow(
                    this._contentNode!,
                    `ActionRow_${index}`,
                    contentWidth,
                    body,
                    index % 2 === 0 ? new Color(26, 32, 42, 220) : new Color(32, 40, 52, 220),
                    128,
                );
            });
        }

        const layout = this._contentNode.getComponent(Layout);
        layout?.updateLayout();
        const contentTransform = this._contentNode.getComponent(UITransform);
        if (contentTransform) {
            contentTransform.setContentSize(contentTransform.width, Math.max(120, records.length * 136 + 24));
        }

        this._scrollView?.scrollToTop(0);
    }

    private _buildUi(): void {
        if (this._isBuilt) {
            return;
        }

        this._isBuilt = true;

        const rootTransform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        rootTransform.setContentSize(1920, 1080);
        const widget = this.node.getComponent(Widget) ?? this.node.addComponent(Widget);
        widget.isAlignTop = true;
        widget.top = 0;
        widget.isAlignBottom = true;
        widget.bottom = 0;
        widget.isAlignLeft = true;
        widget.left = 0;
        widget.isAlignRight = true;
        widget.right = 0;
        widget.isAlignHorizontalCenter = true;
        widget.horizontalCenter = 0;
        widget.isAlignVerticalCenter = true;
        widget.verticalCenter = 0;
        this.node.getComponent(BlockInputEvents) ?? this.node.addComponent(BlockInputEvents);
        const rootBackground = this.node.getComponent(SolidBackground) ?? this.node.addComponent(SolidBackground);
        rootBackground.color = new Color(10, 14, 22, 208);

        const panelNode = this.node.getChildByName('Panel') ?? new Node('Panel');
        if (!panelNode.parent) {
            panelNode.parent = this.node;
        }
        const panelTransform = panelNode.getComponent(UITransform) ?? panelNode.addComponent(UITransform);
        panelTransform.setContentSize(1320, 820);
        const panelWidget = panelNode.getComponent(Widget) ?? panelNode.addComponent(Widget);
        panelWidget.isAlignHorizontalCenter = true;
        panelWidget.horizontalCenter = 0;
        panelWidget.isAlignVerticalCenter = true;
        panelWidget.verticalCenter = 0;
        const panelBackground = panelNode.getComponent(SolidBackground) ?? panelNode.addComponent(SolidBackground);
        panelBackground.color = new Color(12, 18, 28, 235);

        const headerNode = new Node('Header');
        headerNode.parent = panelNode;
        const headerTransform = headerNode.getComponent(UITransform) ?? headerNode.addComponent(UITransform);
        headerTransform.setContentSize(1280, 56);
        headerNode.setPosition(0, 372, 0);
        const headerBg = headerNode.getComponent(SolidBackground) ?? headerNode.addComponent(SolidBackground);
        headerBg.color = new Color(20, 28, 40, 240);

        const titleLabel = createTextNode(headerNode, 'Title', 480, 44, '事件日誌 / Action Records', 24);
        titleLabel.node.setPosition(-410, 0, 0);

        createButton(
            headerNode,
            'RefreshButton',
            '重新整理',
            132,
            36,
            new Color(48, 78, 104, 240),
            () => { void this.refresh(); },
        ).node.setPosition(500, 0, 0);

        createButton(
            headerNode,
            'CloseButton',
            '關閉',
            110,
            36,
            new Color(110, 52, 52, 240),
            () => { this.close(); },
            { pointerFallback: true },
        ).node.setPosition(620, 0, 0);

        this._summaryLabel = createTextNode(panelNode, 'Summary', 1240, 32, 'Loading...', 18);
        this._summaryLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._summaryLabel.node.setPosition(0, 316, 0);

        const scrollNode = new Node('ScrollView');
        scrollNode.parent = panelNode;
        const scrollTransform = scrollNode.getComponent(UITransform) ?? scrollNode.addComponent(UITransform);
        scrollTransform.setContentSize(1280, 680);
        scrollNode.setPosition(0, -30, 0);
        this._scrollView = scrollNode.getComponent(ScrollView) ?? scrollNode.addComponent(ScrollView);
        this._scrollView.horizontal = false;
        this._scrollView.vertical = true;

        const viewNode = new Node('view');
        viewNode.parent = scrollNode;
        const viewTransform = viewNode.getComponent(UITransform) ?? viewNode.addComponent(UITransform);
        viewTransform.setContentSize(1240, 640);
        viewNode.setPosition(0, 0, 0);
        const viewMask = viewNode.getComponent(Mask) ?? viewNode.addComponent(Mask);
        viewMask.type = Mask.Type.GRAPHICS_RECT;

        const contentNode = new Node('Content');
        contentNode.parent = viewNode;
        const contentTransform = contentNode.getComponent(UITransform) ?? contentNode.addComponent(UITransform);
        contentTransform.setContentSize(1240, 100);
        contentNode.setPosition(0, 0, 0);
        const layout = contentNode.getComponent(Layout) ?? contentNode.addComponent(Layout);
        layout.type = Layout.Type.VERTICAL;
        layout.spacingY = 10;
        layout.paddingTop = 12;
        layout.paddingBottom = 12;
        layout.paddingLeft = 12;
        layout.paddingRight = 12;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;

        this._contentNode = contentNode;
        this._scrollView.content = contentNode;
    }
}