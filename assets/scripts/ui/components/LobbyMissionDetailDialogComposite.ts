// @spec-source docs/cross-reference-index.md
import {
    _decorator,
    Button,
    Color,
    EventKeyboard,
    Input,
    input,
    KeyCode,
    Label,
    Layout,
    Node,
    Toggle,
    UIOpacity,
    UITransform,
    Vec3,
    tween,
} from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { CompositePanel } from '../core/CompositePanel';
import { UIContentBinder, type ContentContractSchema } from '../core/UIContentBinder';
import type { ContentContractRef } from '../core/UISpecTypes';
import type { UITemplateBinder } from '../core/UITemplateBinder';
import { SolidBackground } from './SolidBackground';

const { ccclass } = _decorator;

const SCREEN_ID = 'lobby-mission-detail-dialog-screen';
const CONTENT_PATH = 'ui-spec/content/lobby-mission-detail-dialog-states-v1';
const CONTENT_TAG = 'LobbyMissionDetailDialog';
const DEFAULT_STATE_KEY = 'smoke-military-partial';
const DIALOG_ENTER_SCALE = 0.96;
const ROW_HEIGHT = 44;
const ROW_SPACING = 8;
const ROW_PADDING = 12;
const DROPDOWN_TITLE_HEIGHT = 28;
const DROPDOWN_TITLE_GAP = 10;

export type LobbyMissionActionKey = 're-scout' | 'execute' | 'wait' | 'assign';

const ACTION_BUTTON_IDS: Record<LobbyMissionActionKey, string> = {
    're-scout': 'btnScout',
    execute: 'btnExecute',
    wait: 'btnWait',
    assign: 'btnAssign',
};

const CONTRACT: ContentContractRef = {
    schemaId: 'lobby-mission-detail-dialog-content',
    familyId: 'lobby-mission-detail-dialog',
    requiredFields: [
        'missionTypeLabel',
        'missionTitle',
        'missionBrief',
        'intelRevealPercent',
        'intelBody',
        'intelFogVisible',
        'intelHintLabel',
        'selectedGeneralLabel',
        'volunteerBadgeVisible',
        'volunteerBadgeLabel',
        'generalSelectHintLabel',
        'costFoodValueLabel',
        'costTroopValueLabel',
        'costSilverValueLabel',
        'costTimeValueLabel',
        'rewardBaseLabel',
        'rewardPerfectLabel',
        'aiDelegateHintLabel',
    ],
};

export interface MissionGeneralOption {
    id: string;
    label: string;
    volunteer?: boolean;
}

export interface LobbyMissionDetailDialogContentState {
    missionTypeLabel: string;
    missionTitle: string;
    missionBrief: string;
    intelRevealPercent: number;
    intelBody: string;
    intelFogVisible: boolean;
    intelHintLabel: string;
    selectedGeneralLabel: string;
    volunteerBadgeVisible: boolean;
    volunteerBadgeLabel: string;
    generalSelectHintLabel: string;
    costFoodValueLabel: string;
    costFoodRatio: number;
    costTroopValueLabel: string;
    costTroopRatio: number;
    costSilverValueLabel: string;
    costSilverRatio: number;
    costTimeValueLabel: string;
    costTimeRatio: number;
    rewardBaseLabel: string;
    rewardPerfectLabel: string;
    aiDelegateChecked: boolean;
    aiDelegateHintLabel: string;
    availableActions?: LobbyMissionActionKey[];
}

interface LobbyMissionDetailDialogContentFile {
    version: number;
    templateFamily: string;
    layout: string;
    defaultState: string;
    states: Record<string, LobbyMissionDetailDialogContentState>;
}

export interface LobbyMissionDetailDialogSnapshot extends LobbyMissionDetailDialogContentState {
    stateKey: string;
    selectedGeneralId: string | null;
    selectedGeneralLabel: string;
    selectedGeneralVolunteer: boolean;
    availableGenerals: MissionGeneralOption[];
}

export interface LobbyMissionDetailDialogOpenPayload {
    stateKey?: string;
    previewVariant?: string;
    state?: Partial<LobbyMissionDetailDialogContentState>;
    availableGenerals?: MissionGeneralOption[];
    selectedGeneralId?: string;
    selectedGeneralLabel?: string;
    selectedGeneralVolunteer?: boolean;
    onRequestClose?: () => void;
    onActionSelected?: (action: LobbyMissionActionKey, snapshot: LobbyMissionDetailDialogSnapshot) => void | Promise<void>;
    onGeneralSelected?: (general: MissionGeneralOption, snapshot: LobbyMissionDetailDialogSnapshot) => void | Promise<void>;
    onAiDelegateChanged?: (checked: boolean, snapshot: LobbyMissionDetailDialogSnapshot) => void | Promise<void>;
}

@ccclass('LobbyMissionDetailDialogComposite')
export class LobbyMissionDetailDialogComposite extends CompositePanel {
    public onRequestClose: (() => void) | null = null;

    private readonly _contentBinder = new UIContentBinder();
    private _templateBinder: UITemplateBinder | null = null;
    private _contentSchema: ContentContractSchema | null = null;
    private _contentSource: LobbyMissionDetailDialogContentFile | null = null;
    private _isMounted = false;
    private _isVisible = false;
    private _stateKey = DEFAULT_STATE_KEY;
    private _currentState: LobbyMissionDetailDialogSnapshot | null = null;
    private _selectedGeneralId: string | null = null;
    private _selectedGeneralLabel = '';
    private _selectedGeneralVolunteer = false;
    private _availableGenerals: MissionGeneralOption[] = [];
    private _dropdownPanel: Node | null = null;
    private _dropdownVisible = false;
    private _scrollContent: Node | null = null;
    private _scrollContentTransform: UITransform | null = null;
    private _scrollContentLayout: Layout | null = null;
    private _scrollContentBaseHeight = 1120;
    private _dialogCard: Node | null = null;
    private _dialogCardOpacity: UIOpacity | null = null;
    private _aiDelegateToggle: Toggle | null = null;
    private _actionButtons: Record<LobbyMissionActionKey, Button | null> = {
        're-scout': null,
        execute: null,
        wait: null,
        assign: null,
    };
    private _suppressAiDelegateEvent = false;
    private _onActionSelected: LobbyMissionDetailDialogOpenPayload['onActionSelected'] | null = null;
    private _onGeneralSelected: LobbyMissionDetailDialogOpenPayload['onGeneralSelected'] | null = null;
    private _onAiDelegateChanged: LobbyMissionDetailDialogOpenPayload['onAiDelegateChanged'] | null = null;

    protected onLoad(): void {
        services().initialize(this.node);
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    }

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        this.unmount();
        this._isMounted = false;
        this._templateBinder = null;
        this._contentSchema = null;
        this._contentSource = null;
    }

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._templateBinder = binder;
        this._dialogCard = binder.getNode('DialogCard');
        this._dialogCardOpacity = this._dialogCard?.getComponent(UIOpacity) ?? this._dialogCard?.addComponent(UIOpacity) ?? null;
        this._scrollContent = binder.getNode('scrollContent');
        this._scrollContentTransform = this._scrollContent?.getComponent(UITransform) ?? null;
        this._scrollContentLayout = this._scrollContent?.getComponent(Layout) ?? null;
        this._scrollContentBaseHeight = this._scrollContentTransform?.height ?? this._scrollContentBaseHeight;
        this._aiDelegateToggle = binder.getNode('aiDelegateToggle')?.getComponent(Toggle) ?? null;
        this._actionButtons['re-scout'] = binder.getButton('btnScout');
        this._actionButtons.execute = binder.getButton('btnExecute');
        this._actionButtons.wait = binder.getButton('btnWait');
        this._actionButtons.assign = binder.getButton('btnAssign');
        this._bindStaticEvents();
    }

    public async show(payload?: LobbyMissionDetailDialogOpenPayload): Promise<void> {
        if (!this._isMounted) {
            await this.mount(SCREEN_ID);
            this._isMounted = true;
        }

        await this._ensureContentAssets();

        this._onActionSelected = payload?.onActionSelected ?? null;
        this._onGeneralSelected = payload?.onGeneralSelected ?? null;
        this._onAiDelegateChanged = payload?.onAiDelegateChanged ?? null;
        this.onRequestClose = payload?.onRequestClose ?? null;

        this._setDropdownVisible(false);

        const snapshot = this._resolveRuntimeState(payload);
        this._applyRuntimeSnapshot(snapshot);

        this.node.active = true;
        const parent = this.node.parent;
        if (parent) {
            this.node.setSiblingIndex(parent.children.length - 1);
        }

        this._playEnterTransition();
        this._isVisible = true;
    }

    public hide(): void {
        if (!this._isVisible && !this.node.active) {
            return;
        }

        this._isVisible = false;
        this._setDropdownVisible(false);

        const card = this._dialogCard ?? this.node;
        const opacity = this._dialogCardOpacity ?? card.getComponent(UIOpacity) ?? card.addComponent(UIOpacity);
        tween(card)
            .to(0.14, { scale: new Vec3(DIALOG_ENTER_SCALE, DIALOG_ENTER_SCALE, 1) }, { easing: 'quadOut' })
            .start();
        tween(opacity)
            .to(0.14, { opacity: 0 })
            .call(() => {
                this.node.active = false;
            })
            .start();
    }

    public requestClose(): void {
        if (this.onRequestClose) {
            this.onRequestClose();
            return;
        }
        void services().ui.closeCurrentUI();
    }

    public resetState(): void {
        this.onRequestClose = null;
        this._onActionSelected = null;
        this._onGeneralSelected = null;
        this._onAiDelegateChanged = null;
        this._currentState = null;
        this._stateKey = DEFAULT_STATE_KEY;
        this._selectedGeneralId = null;
        this._selectedGeneralLabel = '';
        this._selectedGeneralVolunteer = false;
        this._availableGenerals = [];
        this._suppressAiDelegateEvent = true;
        if (this._aiDelegateToggle) {
            this._aiDelegateToggle.isChecked = false;
        }
        this._suppressAiDelegateEvent = false;
        this._setDropdownVisible(false);
        this._setScrollContentBaseHeight();
    }

    private _bindStaticEvents(): void {
        this._bindButton('overlayMask', () => this.requestClose());
        this._bindButton('btnClose', () => this.requestClose());

        const selectButton = this._templateBinder?.getButton('generalSelectButton');
        if (!selectButton) {
            throw new Error('[LobbyMissionDetailDialogComposite] missing generalSelectButton');
        }
        selectButton.transition = Button.Transition.NONE;
        selectButton.target = selectButton.node;
        selectButton.node.off(Button.EventType.CLICK);
        selectButton.node.on(Button.EventType.CLICK, this._onGeneralSelectButtonClick, this);

        if (!this._aiDelegateToggle) {
            throw new Error('[LobbyMissionDetailDialogComposite] missing aiDelegateToggle');
        }
        this._aiDelegateToggle.node.off('toggle', this._onAiDelegateToggleChanged, this);
        this._aiDelegateToggle.node.on('toggle', this._onAiDelegateToggleChanged, this);

        for (const action of Object.keys(ACTION_BUTTON_IDS) as LobbyMissionActionKey[]) {
            const button = this._actionButtons[action];
            if (!button) {
                throw new Error(`[LobbyMissionDetailDialogComposite] missing action button: ${action}`);
            }
            button.transition = Button.Transition.NONE;
            button.target = button.node;
            button.node.off(Button.EventType.CLICK);
            button.node.on(Button.EventType.CLICK, () => this._emitAction(action), this);
        }
    }

    private _bindButton(nodeId: string, handler: () => void): void {
        const button = this._templateBinder?.getButton(nodeId);
        if (!button) {
            throw new Error(`[LobbyMissionDetailDialogComposite] missing button: ${nodeId}`);
        }
        button.transition = Button.Transition.NONE;
        button.target = button.node;
        button.node.off(Button.EventType.CLICK);
        button.node.on(Button.EventType.CLICK, handler, this);
    }

    private async _ensureContentAssets(): Promise<void> {
        if (!this._contentSource) {
            this._contentSource = await services().resource.loadJson<LobbyMissionDetailDialogContentFile>(
                CONTENT_PATH,
                { tags: [CONTENT_TAG] },
            );
        }

        if (!this._contentSource) {
            throw new Error(`[LobbyMissionDetailDialogComposite] missing content file: ${CONTENT_PATH}`);
        }

        if (!this._contentSchema) {
            this._contentSchema = await this._contentBinder.preloadSchema(CONTRACT);
        }
        if (!this._contentSchema) {
            throw new Error(`[LobbyMissionDetailDialogComposite] missing content schema: ${CONTRACT.schemaId}`);
        }
    }

    private _resolveRuntimeState(payload?: LobbyMissionDetailDialogOpenPayload): LobbyMissionDetailDialogSnapshot {
        if (!this._contentSource) {
            throw new Error('[LobbyMissionDetailDialogComposite] content source not ready');
        }

        const stateKey = this._resolveStateKey(payload);
        const baseState = this._contentSource.states[stateKey]
            ?? this._contentSource.states[this._contentSource.defaultState]
            ?? this._contentSource.states[DEFAULT_STATE_KEY];
        if (!baseState) {
            throw new Error(`[LobbyMissionDetailDialogComposite] missing content state: ${stateKey}`);
        }

        const mergedState = {
            ...baseState,
            ...(payload?.state ?? {}),
        } as LobbyMissionDetailDialogContentState;

        const availableGenerals = this._normalizeGeneralOptions(
            payload?.availableGenerals,
            mergedState.selectedGeneralLabel,
            mergedState.volunteerBadgeVisible,
        );
        const selectedGeneral = this._resolveSelectedGeneral(
            availableGenerals,
            payload,
            mergedState.selectedGeneralLabel,
            mergedState.volunteerBadgeVisible,
        );

        return {
            ...mergedState,
            stateKey,
            selectedGeneralId: selectedGeneral.id,
            selectedGeneralLabel: selectedGeneral.label,
            selectedGeneralVolunteer: selectedGeneral.volunteer === true,
            availableGenerals,
        };
    }

    private _resolveStateKey(payload?: LobbyMissionDetailDialogOpenPayload): string {
        const fromPayload = (payload?.stateKey ?? '').trim();
        if (fromPayload && this._contentSource?.states?.[fromPayload]) {
            return fromPayload;
        }

        const variant = (payload?.previewVariant ?? '').trim().toLowerCase();
        if (!variant) {
            return this._contentSource?.defaultState ?? DEFAULT_STATE_KEY;
        }
        if (this._contentSource?.states?.[variant]) {
            return variant;
        }

        switch (variant) {
        case 'military':
        case 'partial':
        case '50':
        case '50%':
        case 'smoke-military-partial':
            return 'smoke-military-partial';
        case 'domestic':
        case 'revealed':
        case 'full':
        case '100':
        case '100%':
        case 'smoke-domestic-revealed':
            return 'smoke-domestic-revealed';
        default:
            return this._contentSource?.defaultState ?? DEFAULT_STATE_KEY;
        }
    }

    private _normalizeGeneralOptions(
        options: MissionGeneralOption[] | undefined,
        selectedLabel: string,
        volunteerVisible: boolean,
    ): MissionGeneralOption[] {
        const source = Array.isArray(options) ? options : [];
        const normalized = source
            .filter((item) => !!item && typeof item.label === 'string')
            .map((item, index) => ({
                id: (item.id?.trim() || `${item.label.trim()}-${index}`),
                label: item.label.trim(),
                volunteer: item.volunteer === true || (item.label.trim() === selectedLabel && volunteerVisible),
            }));

        if (normalized.length > 0) {
            return normalized;
        }

        const fallbackLabel = selectedLabel.trim() || '未指定武將';
        return [{
            id: `fallback-${fallbackLabel}`,
            label: fallbackLabel,
            volunteer: volunteerVisible,
        }];
    }

    private _resolveSelectedGeneral(
        options: MissionGeneralOption[],
        payload: LobbyMissionDetailDialogOpenPayload | undefined,
        stateLabel: string,
        stateVolunteerVisible: boolean,
    ): MissionGeneralOption {
        const payloadId = payload?.selectedGeneralId?.trim() ?? '';
        const payloadLabel = payload?.selectedGeneralLabel?.trim() ?? '';
        const matchedById = payloadId ? options.find((item) => item.id === payloadId) ?? null : null;
        const matchedByLabel = payloadLabel
            ? options.find((item) => item.label === payloadLabel) ?? null
            : null;
        const matchedByState = options.find((item) => item.label === stateLabel) ?? null;
        const selected = matchedById ?? matchedByLabel ?? matchedByState ?? options[0];

        return {
            id: selected?.id ?? payloadId ?? payloadLabel ?? 'general-unknown',
            label: payloadLabel || selected?.label || stateLabel || '未指定武將',
            volunteer: payload?.selectedGeneralVolunteer ?? selected?.volunteer ?? stateVolunteerVisible,
        };
    }

    private _applyRuntimeSnapshot(snapshot: LobbyMissionDetailDialogSnapshot): void {
        this._stateKey = snapshot.stateKey;
        this._currentState = snapshot;
        this._selectedGeneralId = snapshot.selectedGeneralId;
        this._selectedGeneralLabel = snapshot.selectedGeneralLabel;
        this._selectedGeneralVolunteer = snapshot.selectedGeneralVolunteer;
        this._availableGenerals = [...snapshot.availableGenerals];

        if (!this._templateBinder || !this._contentSchema) {
            throw new Error('[LobbyMissionDetailDialogComposite] binder/schema not ready');
        }

        const bindingState = this._buildBindingState(snapshot);
        void this._contentBinder.bindWithSchema(
            this._templateBinder,
            CONTRACT,
            this._contentSchema,
            bindingState,
        );

        this._suppressAiDelegateEvent = true;
        if (this._aiDelegateToggle) {
            this._aiDelegateToggle.isChecked = snapshot.aiDelegateChecked;
        }
        this._suppressAiDelegateEvent = false;

        this._applyRatios(snapshot);
        this._refreshActionButtons(snapshot.availableActions);
        this._setScrollContentBaseHeight();
    }

    private _buildBindingState(snapshot: LobbyMissionDetailDialogSnapshot): Record<string, unknown> {
        return {
            missionTypeLabel: snapshot.missionTypeLabel,
            missionTitle: snapshot.missionTitle,
            missionBrief: snapshot.missionBrief,
            intelRevealPercent: snapshot.intelRevealPercent,
            intelBody: snapshot.intelBody,
            intelFogVisible: snapshot.intelFogVisible,
            intelHintLabel: snapshot.intelHintLabel,
            selectedGeneralLabel: snapshot.selectedGeneralLabel,
            volunteerBadgeVisible: snapshot.volunteerBadgeVisible,
            volunteerBadgeLabel: snapshot.volunteerBadgeLabel,
            generalSelectHintLabel: snapshot.generalSelectHintLabel,
            costFoodValueLabel: snapshot.costFoodValueLabel,
            costTroopValueLabel: snapshot.costTroopValueLabel,
            costSilverValueLabel: snapshot.costSilverValueLabel,
            costTimeValueLabel: snapshot.costTimeValueLabel,
            rewardBaseLabel: snapshot.rewardBaseLabel,
            rewardPerfectLabel: snapshot.rewardPerfectLabel,
            aiDelegateHintLabel: snapshot.aiDelegateHintLabel,
        };
    }

    private _applyRatios(snapshot: LobbyMissionDetailDialogSnapshot): void {
        this._setRatioBar('costFoodRatio', snapshot.costFoodRatio);
        this._setRatioBar('costTroopRatio', snapshot.costTroopRatio);
        this._setRatioBar('costSilverRatio', snapshot.costSilverRatio);
        this._setRatioBar('costTimeRatio', snapshot.costTimeRatio);
    }

    private _setRatioBar(path: string, ratio: number): void {
        if (!this._templateBinder) {
            return;
        }

        const fillNode = this._templateBinder.getNode(path) ?? this._templateBinder.getNodeByPath(path);
        if (!fillNode) {
            return;
        }

        const fillTransform = fillNode.getComponent(UITransform);
        const trackWidth = fillNode.parent?.getComponent(UITransform)?.width ?? 0;
        if (!fillTransform || trackWidth <= 0) {
            return;
        }

        const clampedRatio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
        fillTransform.setAnchorPoint(0, 0.5);
        fillTransform.width = Math.max(0, Math.floor(trackWidth * clampedRatio));
    }

    private _refreshActionButtons(availableActions?: LobbyMissionActionKey[]): void {
        const enabledActions = new Set<LobbyMissionActionKey>(
            availableActions?.length ? availableActions : (Object.keys(ACTION_BUTTON_IDS) as LobbyMissionActionKey[]),
        );

        for (const action of Object.keys(ACTION_BUTTON_IDS) as LobbyMissionActionKey[]) {
            const button = this._actionButtons[action];
            if (!button) {
                continue;
            }

            const enabled = enabledActions.has(action);
            button.interactable = enabled;
            const opacity = button.node.getComponent(UIOpacity) ?? button.node.addComponent(UIOpacity);
            opacity.opacity = enabled ? 255 : 120;
        }
    }

    private _onGeneralSelectButtonClick(): void {
        this._setDropdownVisible(!this._dropdownVisible);
    }

    private _setDropdownVisible(visible: boolean): void {
        this._dropdownVisible = visible;
        if (visible) {
            const dropdown = this._ensureDropdownPanel();
            dropdown.active = true;
            this._populateDropdownPanel();
            return;
        }

        if (this._dropdownPanel?.isValid) {
            this._dropdownPanel.active = false;
            this._clearDropdownPanel();
        }
        this._setScrollContentBaseHeight();
    }

    private _ensureDropdownPanel(): Node {
        if (this._dropdownPanel?.isValid) {
            return this._dropdownPanel;
        }

        const scrollContent = this._scrollContent;
        if (!scrollContent) {
            throw new Error('[LobbyMissionDetailDialogComposite] missing scroll content');
        }

        const panel = new Node('GeneralSelectDropdownPanel');
        panel.layer = scrollContent.layer;
        panel.parent = scrollContent;

        const transform = panel.addComponent(UITransform);
        transform.setContentSize(this._scrollContentTransform?.width ?? 760, 120);

        const background = panel.addComponent(SolidBackground);
        background.color = new Color(18, 24, 34, 232);

        const layout = panel.addComponent(Layout);
        layout.type = Layout.Type.VERTICAL;
        layout.spacingY = ROW_SPACING;
        layout.paddingTop = ROW_PADDING;
        layout.paddingBottom = ROW_PADDING;
        layout.paddingLeft = ROW_PADDING;
        layout.paddingRight = ROW_PADDING;
        layout.resizeMode = Layout.ResizeMode.NONE;

        panel.active = false;
        this._dropdownPanel = panel;
        this._setDropdownSiblingIndex();
        return panel;
    }

    private _setDropdownSiblingIndex(): void {
        if (!this._dropdownPanel || !this._scrollContent) {
            return;
        }

        const assignmentPanel = this._templateBinder?.getNode('AssignmentPanel');
        if (!assignmentPanel) {
            this._dropdownPanel.setSiblingIndex(this._scrollContent.children.length - 1);
            return;
        }

        this._dropdownPanel.setSiblingIndex(assignmentPanel.getSiblingIndex() + 1);
    }

    private _populateDropdownPanel(): void {
        const dropdown = this._ensureDropdownPanel();
        dropdown.removeAllChildren();

        const panelTransform = dropdown.getComponent(UITransform);
        const scrollWidth = this._scrollContentTransform?.width ?? 760;
        const panelWidth = Math.max(520, Math.floor(scrollWidth - ROW_PADDING * 2));
        const rowWidth = Math.max(360, panelWidth - ROW_PADDING * 2);
        const rows = this._availableGenerals.length > 0
            ? [...this._availableGenerals]
            : [{ id: 'fallback-empty', label: '目前沒有可選武將', volunteer: false }];

        this._createDropdownHeader(dropdown, panelWidth);
        for (const option of rows) {
            this._createDropdownRow(dropdown, option, rowWidth);
        }

        const rowBlockHeight = rows.length * ROW_HEIGHT + Math.max(0, rows.length - 1) * ROW_SPACING;
        const panelHeight = DROPDOWN_TITLE_HEIGHT + DROPDOWN_TITLE_GAP + rowBlockHeight + ROW_PADDING * 2;
        if (panelTransform) {
            panelTransform.setContentSize(panelWidth, panelHeight);
        }

        dropdown.getComponent(Layout)?.updateLayout(true);
        dropdown.getComponent(Layout)?.updateLayout();

        if (this._scrollContentTransform) {
            this._scrollContentTransform.setContentSize(
                this._scrollContentTransform.width,
                this._scrollContentBaseHeight + panelHeight,
            );
        }

        this._setDropdownSiblingIndex();
        this._scrollContentLayout?.updateLayout(true);
        this._scrollContentLayout?.updateLayout();
    }

    private _createDropdownHeader(parent: Node, panelWidth: number): Node {
        const titleNode = new Node('DropdownTitle');
        titleNode.layer = parent.layer;
        titleNode.parent = parent;

        const transform = titleNode.addComponent(UITransform);
        transform.setContentSize(panelWidth - ROW_PADDING * 2, DROPDOWN_TITLE_HEIGHT);

        const label = titleNode.addComponent(Label);
        label.string = '可選武將';
        label.fontSize = 18;
        label.color = new Color(239, 228, 201, 255);
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP;
        return titleNode;
    }

    private _createDropdownRow(parent: Node, option: MissionGeneralOption, rowWidth: number): void {
        const rowNode = new Node(`GeneralOption_${this._sanitizeNodeName(option.id)}`);
        rowNode.layer = parent.layer;
        rowNode.parent = parent;

        const rowTransform = rowNode.addComponent(UITransform);
        rowTransform.setContentSize(rowWidth, ROW_HEIGHT);

        const rowBg = rowNode.addComponent(SolidBackground);
        const isSelected = option.label === this._selectedGeneralLabel;
        rowBg.color = isSelected
            ? new Color(40, 67, 92, 235)
            : new Color(24, 32, 44, 228);

        const button = rowNode.addComponent(Button);
        button.transition = Button.Transition.NONE;
        button.target = rowNode;
        button.interactable = option.id !== 'fallback-empty';

        const layout = rowNode.addComponent(Layout);
        layout.type = Layout.Type.HORIZONTAL;
        layout.spacingX = 10;
        layout.paddingLeft = 12;
        layout.paddingRight = 12;
        layout.paddingTop = 8;
        layout.paddingBottom = 8;
        layout.resizeMode = Layout.ResizeMode.NONE;

        this._createDropdownLabel(
            rowNode,
            `GeneralOptionName_${this._sanitizeNodeName(option.id)}`,
            Math.max(220, rowWidth - 150),
            option.label,
            16,
            new Color(236, 239, 244, 255),
            Label.HorizontalAlign.LEFT,
        );

        const badgeVisible = option.volunteer === true || (option.label === this._selectedGeneralLabel && this._selectedGeneralVolunteer);
        const badgeNode = this._createDropdownLabel(
            rowNode,
            `GeneralOptionBadge_${this._sanitizeNodeName(option.id)}`,
            110,
            '毛遂自薦',
            14,
            new Color(250, 204, 94, 255),
            Label.HorizontalAlign.RIGHT,
        );
        badgeNode.active = badgeVisible;

        button.node.off(Button.EventType.CLICK);
        button.node.on(Button.EventType.CLICK, () => {
            if (option.id === 'fallback-empty') {
                return;
            }
            this._selectGeneral(option);
        }, this);

        layout.updateLayout(true);
        layout.updateLayout();

        const opacity = rowNode.getComponent(UIOpacity) ?? rowNode.addComponent(UIOpacity);
        opacity.opacity = isSelected ? 255 : 230;
    }

    private _createDropdownLabel(
        parent: Node,
        nodeName: string,
        width: number,
        text: string,
        fontSize: number,
        color: Color,
        align: number,
    ): Node {
        const labelNode = new Node(nodeName);
        labelNode.layer = parent.layer;
        labelNode.parent = parent;

        const transform = labelNode.addComponent(UITransform);
        transform.setContentSize(width, ROW_HEIGHT - 16);

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        label.horizontalAlign = align;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP;
        return labelNode;
    }

    private _clearDropdownPanel(): void {
        if (!this._dropdownPanel?.isValid) {
            return;
        }
        this._dropdownPanel.removeAllChildren();
    }

    private _selectGeneral(option: MissionGeneralOption): void {
        this._selectedGeneralId = option.id;
        this._selectedGeneralLabel = option.label;
        this._selectedGeneralVolunteer = option.volunteer === true;

        const badgeVisible = option.volunteer === true;
        const badgeLabel = badgeVisible ? `${option.label} 毛遂自薦` : '';

        this._templateBinder?.setTexts({
            selectedGeneralLabel: option.label,
            volunteerBadgeLabel: badgeLabel,
        });
        this._templateBinder?.setActives({
            volunteerBadge: badgeVisible,
        });

        const snapshot = this._buildSnapshot();
        if (snapshot) {
            this.node.emit('general-selected', { option, snapshot });
            void Promise.resolve(this._onGeneralSelected?.(option, snapshot));
        }
        this._setDropdownVisible(false);
    }

    private _emitAction(action: LobbyMissionActionKey): void {
        const snapshot = this._buildSnapshot();
        if (!snapshot) {
            return;
        }

        this.node.emit('mission-action', { action, snapshot });
        if (this._onActionSelected) {
            void Promise.resolve(this._onActionSelected(action, snapshot));
        }
    }

    private _onAiDelegateToggleChanged(toggle: Toggle): void {
        if (this._suppressAiDelegateEvent) {
            return;
        }

        const checked = toggle.isChecked;
        if (this._currentState) {
            this._currentState = {
                ...this._currentState,
                aiDelegateChecked: checked,
            };
        }

        const snapshot = this._buildSnapshot();
        if (!snapshot) {
            return;
        }

        this.node.emit('ai-delegate-changed', { checked, snapshot });
        void Promise.resolve(this._onAiDelegateChanged?.(checked, snapshot));
    }

    private _playEnterTransition(): void {
        const card = this._dialogCard ?? this.node;
        const opacity = this._dialogCardOpacity ?? card.getComponent(UIOpacity) ?? card.addComponent(UIOpacity);
        opacity.opacity = 0;
        card.setScale(new Vec3(DIALOG_ENTER_SCALE, DIALOG_ENTER_SCALE, 1));
        tween(card)
            .to(0.16, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
        tween(opacity)
            .to(0.16, { opacity: 255 })
            .start();
    }

    private _buildSnapshot(): LobbyMissionDetailDialogSnapshot | null {
        if (!this._currentState) {
            return null;
        }

        return {
            ...this._currentState,
            stateKey: this._stateKey,
            selectedGeneralId: this._selectedGeneralId,
            selectedGeneralLabel: this._selectedGeneralLabel,
            selectedGeneralVolunteer: this._selectedGeneralVolunteer,
            availableGenerals: [...this._availableGenerals],
        };
    }

    private _setScrollContentBaseHeight(): void {
        if (!this._scrollContentTransform) {
            return;
        }

        const currentHeight = this._dropdownVisible
            ? this._scrollContentTransform.height
            : this._scrollContentBaseHeight;
        this._scrollContentTransform.setContentSize(this._scrollContentTransform.width, currentHeight);
    }

    private _sanitizeNodeName(value: string): string {
        return value.replace(/[^a-zA-Z0-9_-]/g, '_') || 'general';
    }

    private _onKeyDown(event: EventKeyboard): void {
        if (!this._isVisible || !this.node.active) {
            return;
        }
        if (event.keyCode === KeyCode.ESCAPE) {
            this.requestClose();
        }
    }
}
