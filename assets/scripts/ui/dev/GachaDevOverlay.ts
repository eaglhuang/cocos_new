import { BlockInputEvents, Button, Canvas, Color, Director, director, Label, Layout, Mask, Node, ScrollView, UITransform, Widget } from 'cc';
import { DEV } from 'cc/env';
import { services } from '../../core/managers/ServiceLoader';
import { PlayerRosterService } from '../../core/services/PlayerRosterService';
import type { GachaHistoryRecord } from '../../core/services/ActionLogStore';
import type { LocalGachaResultEntry, LocalGachaService } from '../../core/services/LocalGachaService';
import { ActionLogDebugPanel } from '../panels/ActionLogDebugPanel';
import { SolidBackground } from '../components/SolidBackground';

interface OverlayState {
    launcherRoot: Node | null;
    launcherIconLabel: Label | null;
    root: Node | null;
    summaryLabel: Label | null;
    singlePlayerLabel: Label | null;
    singlePlayerButton: Node | null;
    clearRosterButton: Node | null;
    eventLogButton: Node | null;
    addGemsButton: Node | null;
    addGoldButton: Node | null;
    addTicketsButton: Node | null;
    actionLogPanel: ActionLogDebugPanel | null;
    gachaService: LocalGachaService | null;
    onSinglePlayerToggle: (() => void) | null;
    onClearRoster: (() => void) | null;
    onWalletChanged: (() => void) | null;
    isPanelVisible: boolean;
}

interface ModalWindow {
    root: Node;
}

interface ButtonHandle {
    node: Node;
    label: Label;
}

const overlayState: OverlayState = {
    launcherRoot: null,
    launcherIconLabel: null,
    root: null,
    summaryLabel: null,
    singlePlayerLabel: null,
    singlePlayerButton: null,
    clearRosterButton: null,
    eventLogButton: null,
    addGemsButton: null,
    addGoldButton: null,
    addTicketsButton: null,
    actionLogPanel: null,
    gachaService: null,
    onSinglePlayerToggle: null,
    onClearRoster: null,
    onWalletChanged: null,
    isPanelVisible: false,
};

let gachaResultsWindow: ModalWindow | null = null;
let gachaHistoryWindow: ModalWindow | null = null;
let gachaErrorWindow: ModalWindow | null = null;
let isSceneAutoMountInstalled = false;

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

function truncateText(value: unknown, limit = 180): string {
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

function resolveCanvasNode(): Node | null {
    const scene = director.getScene();
    if (!scene) {
        return null;
    }

    const canvas = scene.getComponentInChildren(Canvas);
    return canvas?.node ?? scene;
}

function inheritParentLayer(node: Node, parent: Node): void {
    node.layer = parent.layer;
}

function promoteToFront(node: Node | null, parent?: Node | null): void {
    if (!node?.isValid) {
        return;
    }

    const owner = parent ?? node.parent;
    if (!owner?.isValid || node.parent !== owner) {
        return;
    }

    const lastIndex = Math.max(owner.children.length - 1, 0);
    if (node.getSiblingIndex() !== lastIndex) {
        node.setSiblingIndex(lastIndex);
    }
}

function createTextNode(parent: Node, name: string, width: number, height: number, text: string, fontSize = 20): Label {
    const node = new Node(name);
    node.parent = parent;
    inheritParentLayer(node, parent);
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
    inheritParentLayer(node, parent);
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

function formatWalletValue(value: number): string {
    return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)).toLocaleString('zh-TW');
}

function createListRow(parent: Node, name: string, width: number, title: string, detail: string, accent: Color, height = 88): void {
    const row = new Node(name);
    row.parent = parent;
    inheritParentLayer(row, parent);
    const transform = row.getComponent(UITransform) ?? row.addComponent(UITransform);
    transform.setContentSize(width, height);
    const background = row.getComponent(SolidBackground) ?? row.addComponent(SolidBackground);
    background.color = accent;
    const label = createTextNode(row, 'Label', width - 24, height - 16, `${title}\n${detail}`, 18);
    label.node.setPosition(-((width / 2) - 12), (height / 2) - 12, 0);
}

function createModalRoot(name: string, width = 1180, height = 760): Node | null {
    const canvasNode = resolveCanvasNode();
    if (!canvasNode) {
        return null;
    }

    const root = new Node(name);
    root.parent = canvasNode;
    inheritParentLayer(root, canvasNode);
    const transform = root.getComponent(UITransform) ?? root.addComponent(UITransform);
    const canvasTransform = canvasNode.getComponent(UITransform);
    transform.setContentSize(canvasTransform?.width ?? 1920, canvasTransform?.height ?? 1080);
    const widget = root.getComponent(Widget) ?? root.addComponent(Widget);
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
    const background = root.getComponent(SolidBackground) ?? root.addComponent(SolidBackground);
    background.color = new Color(10, 14, 22, 208);
    root.getComponent(BlockInputEvents) ?? root.addComponent(BlockInputEvents);

    const panel = new Node('Panel');
    panel.parent = root;
    inheritParentLayer(panel, root);
    const panelTransform = panel.getComponent(UITransform) ?? panel.addComponent(UITransform);
    panelTransform.setContentSize(width, height);
    const panelWidget = panel.getComponent(Widget) ?? panel.addComponent(Widget);
    panelWidget.isAlignHorizontalCenter = true;
    panelWidget.horizontalCenter = 0;
    panelWidget.isAlignVerticalCenter = true;
    panelWidget.verticalCenter = 0;
    const panelBackground = panel.getComponent(SolidBackground) ?? panel.addComponent(SolidBackground);
    panelBackground.color = new Color(15, 20, 30, 238);
    promoteToFront(root, canvasNode);
    return root;
}

function destroyWindow(windowRef: ModalWindow | null): void {
    if (windowRef?.root?.isValid) {
        windowRef.root.active = false;
        windowRef.root.destroy();
    }
    syncDebugChromeVisibility();
}

function hasOpenModalWindow(windowRef: ModalWindow | null): boolean {
    return !!(windowRef?.root?.isValid && windowRef.root.activeInHierarchy);
}

function hasOpenDebugWindow(): boolean {
    return hasOpenModalWindow(gachaResultsWindow)
        || hasOpenModalWindow(gachaHistoryWindow)
        || hasOpenModalWindow(gachaErrorWindow)
        || !!(overlayState.actionLogPanel?.node?.isValid && overlayState.actionLogPanel.node.activeInHierarchy);
}

function syncDebugChromeVisibility(): void {
    const shouldHideChrome = hasOpenDebugWindow();

    if (overlayState.launcherRoot?.isValid) {
        overlayState.launcherRoot.active = !shouldHideChrome;
    }

    if (overlayState.root?.isValid) {
        overlayState.root.active = overlayState.isPanelVisible && !shouldHideChrome;
    }
}

function buildListModal(
    name: string,
    title: string,
    summary: string,
    items: Array<{ title: string; detail: string; accent?: Color }>,
    primaryButton?: { text: string; onClick: () => void },
): ModalWindow | null {
    const root = createModalRoot(name);
    if (!root) {
        return null;
    }

    const panel = root.getChildByName('Panel') ?? root;

    const closeModal = (): void => {
        if (!root.isValid) {
            syncDebugChromeVisibility();
            return;
        }
        root.active = false;
        root.destroy();
        syncDebugChromeVisibility();
    };

    const header = new Node('Header');
    header.parent = panel;
    inheritParentLayer(header, panel);
    const headerTransform = header.getComponent(UITransform) ?? header.addComponent(UITransform);
    headerTransform.setContentSize(1120, 56);
    header.setPosition(0, 342, 0);
    const headerBg = header.getComponent(SolidBackground) ?? header.addComponent(SolidBackground);
    headerBg.color = new Color(24, 30, 42, 240);

    const titleLabel = createTextNode(header, 'Title', 420, 40, title, 24);
    titleLabel.node.setPosition(-360, 0, 0);

    if (primaryButton) {
        createButton(
            header,
            'PrimaryButton',
            primaryButton.text,
            144,
            36,
            new Color(54, 84, 108, 240),
            primaryButton.onClick,
        ).node.setPosition(390, 0, 0);
    }

    createButton(
        header,
        'CloseButton',
        '關閉',
        110,
        36,
        new Color(108, 52, 52, 240),
        closeModal,
        { pointerFallback: true },
    ).node.setPosition(540, 0, 0);

    const summaryLabel = createTextNode(panel, 'Summary', 1100, 30, summary, 18);
    summaryLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    summaryLabel.node.setPosition(0, 304, 0);

    const scrollNode = new Node('ScrollView');
    scrollNode.parent = panel;
    inheritParentLayer(scrollNode, panel);
    const scrollTransform = scrollNode.getComponent(UITransform) ?? scrollNode.addComponent(UITransform);
    scrollTransform.setContentSize(1120, 620);
    scrollNode.setPosition(0, -28, 0);
    const scrollView = scrollNode.getComponent(ScrollView) ?? scrollNode.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;

    const viewNode = new Node('view');
    viewNode.parent = scrollNode;
    inheritParentLayer(viewNode, scrollNode);
    const viewTransform = viewNode.getComponent(UITransform) ?? viewNode.addComponent(UITransform);
    viewTransform.setContentSize(1080, 590);
    viewNode.setPosition(0, 0, 0);
    const viewMask = viewNode.getComponent(Mask) ?? viewNode.addComponent(Mask);
    viewMask.type = Mask.Type.GRAPHICS_RECT;

    const contentNode = new Node('Content');
    contentNode.parent = viewNode;
    inheritParentLayer(contentNode, viewNode);
    const contentTransform = contentNode.getComponent(UITransform) ?? contentNode.addComponent(UITransform);
    contentTransform.setContentSize(1080, 100);
    contentNode.setPosition(0, 0, 0);
    const layout = contentNode.getComponent(Layout) ?? contentNode.addComponent(Layout);
    layout.type = Layout.Type.VERTICAL;
    layout.spacingY = 8;
    layout.paddingTop = 12;
    layout.paddingBottom = 12;
    layout.paddingLeft = 12;
    layout.paddingRight = 12;
    layout.resizeMode = Layout.ResizeMode.CONTAINER;

    if (items.length === 0) {
        createListRow(
            contentNode,
            'EmptyRow',
            1050,
            '目前沒有資料。',
            '請先進行一次轉蛋，或重新整理後再查看。',
            new Color(46, 54, 66, 220),
            84,
        );
    } else {
        items.forEach((item, index) => {
            createListRow(
                contentNode,
                `Item_${index}`,
                1050,
                item.title,
                item.detail,
                item.accent ?? (index % 2 === 0 ? new Color(28, 34, 46, 220) : new Color(35, 42, 56, 220)),
                88,
            );
        });
    }

    layout.updateLayout();
    const contentHeight = Math.max(120, items.length * 96 + 24);
    contentTransform.setContentSize(contentTransform.width, contentHeight);
    scrollView.content = contentNode;
    scrollView.scrollToTop(0);

    syncDebugChromeVisibility();
    return { root };
}

function ensureToolbarRoot(): Node | null {
    const canvasNode = resolveCanvasNode();
    if (!canvasNode) {
        return null;
    }

    if (overlayState.root && overlayState.root.isValid) {
        if (overlayState.root.parent !== canvasNode) {
            overlayState.root.removeFromParent();
            overlayState.root.parent = canvasNode;
        }
        inheritParentLayer(overlayState.root, canvasNode);
        promoteToFront(overlayState.root, canvasNode);
        return overlayState.root;
    }

    const root = new Node('GachaDevOverlayRoot');
    root.parent = canvasNode;
    inheritParentLayer(root, canvasNode);
    const transform = root.getComponent(UITransform) ?? root.addComponent(UITransform);
    transform.setContentSize(288, 420);
    const widget = root.getComponent(Widget) ?? root.addComponent(Widget);
    widget.isAlignTop = true;
    widget.top = 76;
    widget.isAlignRight = true;
    widget.right = 18;
    const background = root.getComponent(SolidBackground) ?? root.addComponent(SolidBackground);
    background.color = new Color(12, 18, 28, 236);
    root.active = overlayState.isPanelVisible;

    const titleLabel = createTextNode(root, 'Title', 252, 24, '🛠 DEV 修改工具', 18);
    titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    titleLabel.node.setPosition(0, 168, 0);

    createButton(
        root,
        'CloseButton',
        '×',
        30,
        28,
        new Color(70, 78, 92, 240),
        () => { toggleDevToolPanel(false); },
        { pointerFallback: true },
    ).node.setPosition(122, 168, 0);

    overlayState.summaryLabel = createTextNode(root, 'Summary', 252, 78, 'loading...', 14);
    overlayState.summaryLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    overlayState.summaryLabel.node.setPosition(0, 116, 0);

    overlayState.eventLogButton = createButton(
        root,
        'EventLogButton',
        '事件日誌',
        220,
        34,
        new Color(52, 76, 102, 240),
        () => { void showActionLogWindow(); },
    ).node;
    overlayState.eventLogButton.setPosition(0, 52, 0);

    const singlePlayerButton = createButton(
        root,
        'SinglePlayerButton',
        '單機模式',
        220,
        34,
        new Color(54, 86, 58, 240),
        () => {
            if (overlayState.onSinglePlayerToggle) {
                overlayState.onSinglePlayerToggle();
            } else {
                overlayState.gachaService?.toggleSinglePlayerModeEnabled();
            }
            refreshCurrencyDisplay();
        },
    );
    overlayState.singlePlayerLabel = singlePlayerButton.label;
    overlayState.singlePlayerButton = singlePlayerButton.node;
    overlayState.singlePlayerButton.setPosition(0, 10, 0);

    overlayState.clearRosterButton = createButton(
        root,
        'ClearRosterButton',
        '清除名冊',
        220,
        34,
        new Color(102, 72, 44, 240),
        () => {
            if (overlayState.onClearRoster) {
                overlayState.onClearRoster();
            } else {
                PlayerRosterService.clear();
            }
            refreshCurrencyDisplay();
        },
    ).node;
    overlayState.clearRosterButton.setPosition(0, -32, 0);

    overlayState.addGemsButton = createButton(
        root,
        'AddGemsButton',
        '+1,000 鑽石',
        220,
        34,
        new Color(72, 62, 120, 240),
        () => {
            overlayState.gachaService?.grantCurrency('gems', 1000);
            refreshCurrencyDisplay();
        },
    ).node;
    overlayState.addGemsButton.setPosition(0, -74, 0);

    overlayState.addGoldButton = createButton(
        root,
        'AddGoldButton',
        '+50,000 金幣',
        220,
        34,
        new Color(128, 98, 42, 240),
        () => {
            overlayState.gachaService?.grantCurrency('gold', 50000);
            refreshCurrencyDisplay();
        },
    ).node;
    overlayState.addGoldButton.setPosition(0, -116, 0);

    overlayState.addTicketsButton = createButton(
        root,
        'AddTicketsButton',
        '+10 召喚券',
        220,
        34,
        new Color(64, 106, 86, 240),
        () => {
            overlayState.gachaService?.grantCurrency('tickets', 10);
            refreshCurrencyDisplay();
        },
    ).node;
    overlayState.addTicketsButton.setPosition(0, -158, 0);

    overlayState.root = root;
    promoteToFront(root, canvasNode);
    return root;
}

function ensureLauncherRoot(): Node | null {
    const canvasNode = resolveCanvasNode();
    if (!canvasNode) {
        return null;
    }

    if (overlayState.launcherRoot && overlayState.launcherRoot.isValid) {
        if (overlayState.launcherRoot.parent !== canvasNode) {
            overlayState.launcherRoot.removeFromParent();
            overlayState.launcherRoot.parent = canvasNode;
        }
        inheritParentLayer(overlayState.launcherRoot, canvasNode);
        promoteToFront(overlayState.launcherRoot, canvasNode);
        return overlayState.launcherRoot;
    }

    const launcherRoot = new Node('GachaDevOverlayLauncher');
    launcherRoot.parent = canvasNode;
    inheritParentLayer(launcherRoot, canvasNode);
    const transform = launcherRoot.getComponent(UITransform) ?? launcherRoot.addComponent(UITransform);
    transform.setContentSize(48, 48);
    const widget = launcherRoot.getComponent(Widget) ?? launcherRoot.addComponent(Widget);
    widget.isAlignTop = true;
    widget.top = 18;
    widget.isAlignRight = true;
    widget.right = 18;
    const background = launcherRoot.getComponent(SolidBackground) ?? launcherRoot.addComponent(SolidBackground);
    background.color = new Color(22, 28, 38, 238);

    const button = launcherRoot.getComponent(Button) ?? launcherRoot.addComponent(Button);
    button.transition = Button.Transition.NONE;
    button.node.on(Button.EventType.CLICK, () => { toggleDevToolPanel(); }, button);

    overlayState.launcherIconLabel = createTextNode(launcherRoot, 'LauncherLabel', 40, 40, '+', 28);
    overlayState.launcherIconLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    overlayState.launcherIconLabel.verticalAlign = Label.VerticalAlign.CENTER;
    overlayState.launcherIconLabel.node.setPosition(0, 0, 0);
    overlayState.launcherRoot = launcherRoot;
    promoteToFront(launcherRoot, canvasNode);
    return launcherRoot;
}

function mountOverlayToActiveScene(): void {
    if (!DEV) {
        return;
    }

    services().initialize(resolveCanvasNode() ?? undefined);
    ensureLauncherRoot();
    ensureToolbarRoot();
    promoteToFront(overlayState.root);
    promoteToFront(overlayState.launcherRoot);
    refreshCurrencyDisplay();
    syncDebugChromeVisibility();
}

function ensureSceneAutoMount(): void {
    if (!DEV || isSceneAutoMountInstalled) {
        return;
    }

    isSceneAutoMountInstalled = true;
    director.on(Director.EVENT_AFTER_SCENE_LAUNCH, mountOverlayToActiveScene);
    mountOverlayToActiveScene();
}

function toggleDevToolPanel(forceVisible?: boolean): void {
    ensureToolbarRoot();
    const nextVisible = typeof forceVisible === 'boolean' ? forceVisible : !overlayState.isPanelVisible;
    overlayState.isPanelVisible = nextVisible;
    if (overlayState.root?.isValid) {
        overlayState.root.active = nextVisible && !hasOpenDebugWindow();
    }
    if (nextVisible) {
        promoteToFront(overlayState.root);
        promoteToFront(overlayState.launcherRoot);
    }
    if (overlayState.launcherIconLabel) {
        overlayState.launcherIconLabel.string = nextVisible ? '−' : '+';
    }
    refreshCurrencyDisplay();
}

function renderToolbarSummary(): void {
    if (!overlayState.summaryLabel || !overlayState.summaryLabel.node.isValid) {
        return;
    }

    const sync = services().sync;
    const hasGachaContext = !!overlayState.gachaService;
    const singlePlayer = overlayState.gachaService?.isSinglePlayerModeEnabled() ?? false;
    const rosterCount = PlayerRosterService.getCount();
    const wallet = overlayState.gachaService?.getWalletSnapshot() ?? null;

    overlayState.summaryLabel.string = hasGachaContext
        ? [
            `Storage: ${sync.getStorageModeLabel()}`,
            `Pending: ${sync.getActionRecordCount()} | Roster: ${rosterCount}`,
            `錢包: ◈ ${formatWalletValue(wallet?.gems ?? 0)} | 金 ${formatWalletValue(wallet?.gold ?? 0)} | 券 ${formatWalletValue(wallet?.tickets ?? 0)}`,
            `Single Player: ${singlePlayer ? 'ON' : 'OFF'}`,
        ].join('\n')
        : [
            `Storage: ${sync.getStorageModeLabel()}`,
            `Pending: ${sync.getActionRecordCount()} | Roster: ${rosterCount}`,
            '事件日誌可跨畫面開啟',
        ].join('\n');

    if (overlayState.singlePlayerLabel) {
        overlayState.singlePlayerLabel.string = singlePlayer ? '單機模式：ON' : '單機模式：OFF';
    }

    if (overlayState.singlePlayerButton) {
        overlayState.singlePlayerButton.active = hasGachaContext;
    }
    if (overlayState.clearRosterButton) {
        overlayState.clearRosterButton.active = hasGachaContext;
    }
    if (overlayState.addGemsButton) {
        overlayState.addGemsButton.active = hasGachaContext;
    }
    if (overlayState.addGoldButton) {
        overlayState.addGoldButton.active = hasGachaContext;
    }
    if (overlayState.addTicketsButton) {
        overlayState.addTicketsButton.active = hasGachaContext;
    }
}

function formatGachaResultTitle(entry: LocalGachaResultEntry): string {
    return entry.displayText;
}

function formatGachaResultDetail(entry: LocalGachaResultEntry): string {
    return `pool=${entry.poolId} | currency=${entry.currencyKey}`;
}


export function attachCurrencyCheatPanel(
    gachaService: LocalGachaService,
    onSinglePlayerToggle?: (() => void) | undefined,
    onClearRoster?: (() => void) | undefined,
    onWalletChanged?: (() => void) | undefined,
): void {
    if (!DEV) {
        return;
    }

    ensureSceneAutoMount();
    services().initialize(resolveCanvasNode() ?? undefined);
    overlayState.gachaService = gachaService;
    overlayState.onSinglePlayerToggle = onSinglePlayerToggle ?? null;
    overlayState.onClearRoster = onClearRoster ?? null;
    overlayState.onWalletChanged = onWalletChanged ?? null;
    ensureLauncherRoot();
    ensureToolbarRoot();
    refreshCurrencyDisplay();
}

export function ensureGlobalDevOverlay(
    gachaService?: LocalGachaService,
    onSinglePlayerToggle?: (() => void) | undefined,
    onClearRoster?: (() => void) | undefined,
    onWalletChanged?: (() => void) | undefined,
): void {
    if (!DEV) {
        return;
    }

    ensureSceneAutoMount();
    services().initialize(resolveCanvasNode() ?? undefined);
    overlayState.gachaService = gachaService ?? null;
    overlayState.onSinglePlayerToggle = onSinglePlayerToggle ?? null;
    overlayState.onClearRoster = onClearRoster ?? null;
    overlayState.onWalletChanged = onWalletChanged ?? null;
    ensureLauncherRoot();
    ensureToolbarRoot();
    refreshCurrencyDisplay();
    syncDebugChromeVisibility();
}

export function detachCurrencyCheatPanel(): void {
    if (!DEV) {
        return;
    }

    destroyWindow(gachaResultsWindow);
    destroyWindow(gachaHistoryWindow);
    destroyWindow(gachaErrorWindow);
    gachaResultsWindow = null;
    gachaHistoryWindow = null;
    gachaErrorWindow = null;

    if (overlayState.actionLogPanel?.node.isValid) {
        overlayState.actionLogPanel.node.destroy();
    }
    overlayState.actionLogPanel = null;

    if (overlayState.root?.isValid) {
        overlayState.root.destroy();
    }
    if (overlayState.launcherRoot?.isValid) {
        overlayState.launcherRoot.destroy();
    }

    overlayState.launcherRoot = null;
    overlayState.launcherIconLabel = null;
    overlayState.root = null;
    overlayState.summaryLabel = null;
    overlayState.singlePlayerLabel = null;
    overlayState.singlePlayerButton = null;
    overlayState.clearRosterButton = null;
    overlayState.eventLogButton = null;
    overlayState.addGemsButton = null;
    overlayState.addGoldButton = null;
    overlayState.addTicketsButton = null;
    overlayState.gachaService = null;
    overlayState.onSinglePlayerToggle = null;
    overlayState.onClearRoster = null;
    overlayState.onWalletChanged = null;
    overlayState.isPanelVisible = false;
}

export function detachRosterClearButton(): void {
    overlayState.onClearRoster = null;
    refreshCurrencyDisplay();
}

export function refreshCurrencyDisplay(): void {
    if (!DEV) {
        return;
    }

    renderToolbarSummary();
    overlayState.onWalletChanged?.();
}

export function showActionLogWindow(limit = 120): void {
    if (!DEV) {
        return;
    }

    overlayState.isPanelVisible = false;
    destroyWindow(gachaResultsWindow);
    destroyWindow(gachaHistoryWindow);
    destroyWindow(gachaErrorWindow);
    gachaResultsWindow = null;
    gachaHistoryWindow = null;
    gachaErrorWindow = null;
    syncDebugChromeVisibility();

    if (!overlayState.actionLogPanel?.node.isValid) {
        const root = createModalRoot('ActionLogDebugWindow', 1320, 820);
        if (!root) {
            return;
        }
        overlayState.actionLogPanel = root.addComponent(ActionLogDebugPanel);
        overlayState.actionLogPanel.onVisibilityChanged = syncDebugChromeVisibility;
    }

    void overlayState.actionLogPanel.open(limit);
    syncDebugChromeVisibility();
}

export async function showGachaResults(
    title: string,
    results: LocalGachaResultEntry[],
    onRetry?: (() => void) | undefined,
): Promise<void> {
    if (!DEV) {
        return;
    }

    overlayState.isPanelVisible = false;

    destroyWindow(gachaResultsWindow);
    gachaResultsWindow = buildListModal(
        'GachaResultsWindow',
        `${title} 結果`,
        `共 ${results.length} 筆抽取結果`,
        results.map((entry) => ({
            title: formatGachaResultTitle(entry),
            detail: formatGachaResultDetail(entry),
        })),
        onRetry
            ? { text: '再抽一次', onClick: onRetry }
            : undefined,
    );
    syncDebugChromeVisibility();
}

export async function showGachaHistory(data: { total: number; records: GachaHistoryRecord[] }): Promise<void> {
    if (!DEV) {
        return;
    }

    overlayState.isPanelVisible = false;

    // Expand each record into per-result rows so all drawn generals are visible individually.
    type HistoryItem = { title: string; detail: string; accent?: Color };
    const items: HistoryItem[] = [];
    for (const record of data.records) {
        const sessionLabel = `${formatTimestamp(record.timestamp)} | ${record.actionType} | draw×${record.drawCount}`;
        if (record.results.length === 0) {
            items.push({
                title: `#${record.seq} | (空)`,
                detail: sessionLabel,
                accent: new Color(46, 54, 66, 220),
            });
        } else {
            record.results.forEach((result, idx) => {
                items.push({
                    title: result.displayText,
                    detail: idx === 0 ? `#${record.seq} ${sessionLabel}` : `#${record.seq} (続)`,
                    accent: idx % 2 === 0 ? new Color(28, 34, 46, 220) : new Color(35, 42, 56, 220),
                });
            });
        }
    }

    destroyWindow(gachaHistoryWindow);
    gachaHistoryWindow = buildListModal(
        'GachaHistoryWindow',
        '召喚紀錄',
        `共 ${data.total} 筆，最新紀錄在最上方`,
        items,
    );
    syncDebugChromeVisibility();
}

export function showGachaError(message: string): void {
    if (!DEV) {
        return;
    }

    overlayState.isPanelVisible = false;

    destroyWindow(gachaErrorWindow);
    gachaErrorWindow = buildListModal(
        'GachaErrorWindow',
        '召喚錯誤',
        '請確認轉蛋資料或網路狀態。',
        [{
            title: '錯誤訊息',
            detail: message,
        }],
    );
    syncDebugChromeVisibility();
}

ensureSceneAutoMount();