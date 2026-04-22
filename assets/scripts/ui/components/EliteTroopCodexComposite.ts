import { _decorator, Button, Color, ImageAsset, Label, Node, Rect, ScrollView, Sprite, SpriteFrame, Texture2D } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { CompositePanel } from '../core/CompositePanel';
import type { UITemplateBinder } from '../core/UITemplateBinder';

const { ccclass } = _decorator;

const SCREEN_ID = 'elite-troop-codex-screen';
const CONTENT_PATH = 'ui-spec/content/elite-troop-codex-v1';
const CONTENT_TAG = 'EliteTroopCodex';
const CARD_ART_FALLBACK_PATH = 'ui/tiger-tally/card-art/troops/spriteFrame';
const TYPE_ICON_FALLBACK_PATH = 'sprites/battle/battle_unit_type_underlay';
const WHITE = new Color(255, 255, 255, 255);

type CodexQuality = 'R' | 'SR' | 'SSR' | 'UR' | 'LR';
type CodexGroupKey = 'transfer' | 'exclusive';

interface EliteTroopCodexEntry {
    index: number;
    groupKey: CodexGroupKey;
    groupLabel: string;
    tallyName: string;
    troopName: string;
    baseTypeLabel: string;
    typeKey: string;
    quality: CodexQuality;
    originHero: string;
    source: string;
    special: string;
    cardArtResource: string;
    artReady: boolean;
}

interface EliteTroopCodexState {
    defaultSelectedIndex?: number;
    entries: EliteTroopCodexEntry[];
}

interface EliteTroopCodexContentSource {
    id: string;
    version: number;
    defaultState: string;
    states: Record<string, EliteTroopCodexState>;
}

export interface EliteTroopCodexOpenPayload {
    selectedIndex?: number;
}

@ccclass('EliteTroopCodexComposite')
export class EliteTroopCodexComposite extends CompositePanel {
    private _binder: UITemplateBinder | null = null;
    private _scrollView: ScrollView | null = null;
    private _isMounted = false;
    private _isRendering = false;
    private _contentLoaded = false;
    private _renderSerial = 0;
    private _defaultSelectedIndex = 0;
    private _selectedIndex = 0;
    private _entries: EliteTroopCodexEntry[] = [];
    private _rowNodes: Node[] = [];
    private _spriteFrameCache = new Map<string, SpriteFrame | null>();
    private _codexArtFramesLoaded = false;
    private _codexArtFrames = new Map<string, SpriteFrame>();

    public onLoad(): void {
        services().initialize(this.node);
    }

    protected onDestroy(): void {
        this.unmount();
        this._isMounted = false;
        this._binder = null;
        this._scrollView = null;
        this._entries = [];
        this._rowNodes = [];
        this._spriteFrameCache.clear();
        this._codexArtFramesLoaded = false;
        this._codexArtFrames.clear();
    }

    public async show(payload?: EliteTroopCodexOpenPayload): Promise<void> {
        this.node.active = true;
        const parent = this.node.parent;
        if (parent) {
            this.node.setSiblingIndex(parent.children.length - 1);
        }

        if (!this._isMounted) {
            await this.mount(SCREEN_ID);
            this._isMounted = true;
        }

        await this._loadContent(false);
        const targetIndex = this._clampIndex(payload?.selectedIndex ?? this._defaultSelectedIndex);
        await this._renderCodex(targetIndex);
        this.playEnterTransition(this.node, { enter: 'fadeIn', duration: 0.18 });
    }

    public hide(): void {
        this.playExitTransition(this.node, { exit: 'fadeOut', duration: 0.12 }, () => {
            this.node.active = false;
        });
    }

    public resetState(): void {
        this._selectedIndex = 0;
    }

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._binder = binder;
        this._scrollView = binder.getNode('TroopList')?.getComponent(ScrollView) ?? null;
        this._bindStaticEvents();
    }

    private _bindStaticEvents(): void {
        this._bindButton('BtnRefresh', () => {
            void this._refreshCodex();
        });
        this._bindButton('BtnTop', () => {
            this._scrollView?.scrollToTop(0);
        });
        this._bindButton('BtnClose', () => {
            void services().ui.closeCurrentUI();
        });
    }

    private _bindButton(nodeName: string, handler: () => void): void {
        const node = this._requireNodeByPath(`ActionRow/${nodeName}`);
        const button = node.getComponent(Button) || node.addComponent(Button);
        button.transition = Button.Transition.NONE;
        button.target = node;
        button.node.off(Button.EventType.CLICK);
        button.node.on(Button.EventType.CLICK, handler, this);
    }

    private async _refreshCodex(): Promise<void> {
        if (this._isRendering) {
            return;
        }

        services().resource.releaseByTag(CONTENT_TAG);
        this._spriteFrameCache.clear();
        this._codexArtFramesLoaded = false;
        this._codexArtFrames.clear();
        this._contentLoaded = false;
        await this._loadContent(true);
        await this._renderCodex(this._selectedIndex);
    }

    private async _loadContent(forceReload: boolean): Promise<void> {
        if (this._contentLoaded && !forceReload) {
            return;
        }

        const content = await services().resource.loadJson<EliteTroopCodexContentSource>(
            CONTENT_PATH,
            { tags: [CONTENT_TAG] },
        );
        const stateKey = content.defaultState || 'all';
        const state = content.states?.[stateKey] ?? content.states?.all;
        if (!state) {
            throw new Error(`[EliteTroopCodexComposite] 找不到 content state: ${stateKey}`);
        }

        this._entries = Array.isArray(state.entries)
            ? [...state.entries].sort((a, b) => a.index - b.index)
            : [];
        this._defaultSelectedIndex = this._clampIndex(state.defaultSelectedIndex ?? 0);
        this._contentLoaded = true;
    }

    private async _renderCodex(initialSelectedIndex: number): Promise<void> {
        if (this._isRendering) {
            return;
        }
        if (!this._binder) {
            throw new Error('[EliteTroopCodexComposite] binder 尚未就緒');
        }

        this._isRendering = true;
        const renderSerial = ++this._renderSerial;
        try {
            if (!this._entries.length) {
                this._updateSummaryLabels();
                await this._applySelectedEntry(null);
                return;
            }

            const listPath = this._mainPath('CenterGridPanel/TroopList');
            const contentNode = this._requireNodeByPath('CenterGridPanel/TroopList/view/Content');
            contentNode.removeAllChildren();
            this._rowNodes = [];
            await this._preloadEntrySprites(this._entries);

            const pendingRowTasks: Promise<void>[] = [];
            let rowIndex = 0;
            await this.populateList(listPath, this._entries, (entry, row) => {
                const currentIndex = rowIndex++;
                this._rowNodes[currentIndex] = row;
                pendingRowTasks.push(this._bindRow(entry, row, currentIndex, renderSerial));
            });

            await Promise.all(pendingRowTasks);
            if (renderSerial !== this._renderSerial) {
                return;
            }

            this._selectedIndex = this._clampIndex(initialSelectedIndex);
            this._syncSelectionVisuals();
            await this._applySelectedEntry(this._entries[this._selectedIndex] ?? null);
            this._updateSummaryLabels();
            this._scrollView?.scrollToTop(0);
        } finally {
            this._isRendering = false;
        }
    }

    private async _bindRow(entry: EliteTroopCodexEntry, row: Node, index: number, renderSerial: number): Promise<void> {
        if (renderSerial !== this._renderSerial) {
            return;
        }

        const button = row.getComponent(Button) || row.addComponent(Button);
        button.transition = Button.Transition.NONE;
        button.target = row;
        button.node.off(Button.EventType.CLICK);
        button.node.on(Button.EventType.CLICK, () => {
            this._selectEntry(index);
        }, this);

        this._setRowLabel(row, 'CardArtShell/CardArtBadge', entry.artReady ? '正式' : '占位');
        this._setRowLabel(row, 'CardHeaderRow/CardQuality', entry.quality);
        this._setRowLabel(row, 'CardHeaderRow/CardIndex', `#${String(entry.index).padStart(2, '0')}`);
        this._setRowLabel(row, 'CardTallyName', entry.tallyName);
        this._setRowLabel(row, 'CardTroopName', entry.troopName);
        this._setRowLabel(row, 'CardMeta', `${entry.baseTypeLabel} / ${entry.originHero} / ${this._resolveGroupShortLabel(entry.groupKey)}`);
        this._setRowLabel(row, 'CardSpecial', entry.special);
        this._setRowLabel(row, 'CardStateHint', entry.artReady ? '正式圖' : '占位圖');
        this._setRowSelection(row, index === this._selectedIndex);

        await this._assignRowSprite(row, 'CardArtShell/CardArt', entry.cardArtResource, CARD_ART_FALLBACK_PATH, true);
        await this._assignRowSprite(row, 'CardArtShell/CardTypeIcon', this._buildTypeIconPath(entry.typeKey), TYPE_ICON_FALLBACK_PATH, false);
    }

    private async _preloadEntrySprites(entries: EliteTroopCodexEntry[]): Promise<void> {
        const paths = new Set<string>();
        for (const entry of entries) {
            paths.add(entry.cardArtResource);
            paths.add(this._buildTypeIconPath(entry.typeKey));
        }
        paths.add(CARD_ART_FALLBACK_PATH);
        paths.add(TYPE_ICON_FALLBACK_PATH);

        await Promise.all([...paths].map(async (path) => {
            if (this._isCodexArtPath(path)) {
                await this._loadCodexArtSpriteFrame(path, true);
                return;
            }

            await this._loadSpriteFrame(path, path === CARD_ART_FALLBACK_PATH);
        }));
    }

    private async _assignRowSprite(
        row: Node,
        path: string,
        spritePath: string,
        fallbackPath: string,
        preferTextureFallback: boolean,
    ): Promise<void> {
        const sprite = this._getNodeSprite(row, path);
        if (!sprite) {
            console.warn(
                `[EliteTroopCodexComposite] sprite node missing: row="${row.name}" path="${path}" children=[${row.children.map((child) => child.name).join(', ')}]`,
            );
            return;
        }

        const frame = await this._loadCodexArtSpriteFrame(spritePath, preferTextureFallback);
        const finalFrame = frame ?? await this._loadSpriteFrame(fallbackPath, false);
        if (!finalFrame) {
            console.warn(`[EliteTroopCodexComposite] row art missing: ${path} -> ${spritePath} (fallback=${fallbackPath})`);
            sprite.node.active = false;
            return;
        }

        sprite.spriteFrame = finalFrame;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = WHITE;
        sprite.node.active = true;
    }

    private async _applySelectedArt(path: string, spritePath: string, fallbackPath: string, preferTextureFallback: boolean): Promise<void> {
        const targetNode = this._requireNodeByPath(path);
        const sprite = targetNode.getComponent(Sprite) || targetNode.addComponent(Sprite);
        const frame = await this._loadCodexArtSpriteFrame(spritePath, preferTextureFallback);
        const finalFrame = frame ?? await this._loadSpriteFrame(fallbackPath, false);
        if (!finalFrame) {
            console.warn(`[EliteTroopCodexComposite] selected art missing: ${path} -> ${spritePath} (fallback=${fallbackPath})`);
            targetNode.active = false;
            return;
        }

        sprite.spriteFrame = finalFrame;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = WHITE;
        targetNode.active = true;
    }

    private async _applySelectedEntry(entry: EliteTroopCodexEntry | null): Promise<void> {
        const statsRoot = 'RightDetailPanel/DetailContent/SelectedTroopStats/StatsContent';
        const loreRoot = 'RightDetailPanel/DetailContent/SelectedTroopLore/LoreContent';
        const noteRoot = 'RightDetailPanel/DetailContent/LinkedHeroPanel/LinkedHeroContent';

        if (!entry) {
            this._setMainLabel('RightDetailPanel/DetailContent/SelectedTroopBannerShell/SelectedTroopBannerArt', '');
            this._setMainLabel('RightDetailPanel/DetailContent/SelectedTroopCrestShell/SelectedTroopCrestArt', '');
            this._setMainLabel(`${statsRoot}/SelectedTroopTitle`, '尚未選取');
            this._setMainLabel(`${statsRoot}/SelectedTroopSubtitle`, '');
            this._setMainLabel(`${statsRoot}/SelectedTroopMeta`, '');
            this._setMainLabel(`${statsRoot}/SelectedTroopIndex`, '');
            this._setMainLabel(`${statsRoot}/SelectedTroopQuality`, '');
            this._setMainLabel(`${statsRoot}/SelectedTroopOrigin`, '');
            this._setMainLabel(`${statsRoot}/SelectedTroopSource`, '');
            this._setMainLabel(`${statsRoot}/SelectedTroopArtState`, '');
            this._setMainLabel(`${loreRoot}/SelectedTroopSpecialTitle`, '特殊戰法');
            this._setMainLabel(`${loreRoot}/SelectedTroopSpecialBody`, '');
            this._setMainLabel(`${noteRoot}/SelectedTroopNoteTitle`, '補圖備註');
            this._setMainLabel(`${noteRoot}/SelectedTroopNoteBody`, '');
            this._setSpriteActive('RightDetailPanel/DetailContent/SelectedTroopBannerShell/SelectedTroopBannerArt', false);
            this._setSpriteActive('RightDetailPanel/DetailContent/SelectedTroopCrestShell/SelectedTroopCrestArt', false);
            return;
        }

        this._setMainLabel(`${statsRoot}/SelectedTroopTitle`, entry.tallyName);
        this._setMainLabel(`${statsRoot}/SelectedTroopSubtitle`, entry.troopName);
        this._setMainLabel(`${statsRoot}/SelectedTroopMeta`, `${entry.baseTypeLabel} / ${entry.quality} / ${this._resolveGroupShortLabel(entry.groupKey)}`);
        this._setMainLabel(`${statsRoot}/SelectedTroopIndex`, `#${String(entry.index).padStart(2, '0')} / ${entry.groupLabel}`);
        this._setMainLabel(`${statsRoot}/SelectedTroopQuality`, `稀有度：${entry.quality}`);
        this._setMainLabel(`${statsRoot}/SelectedTroopOrigin`, `歸屬名將：${entry.originHero}`);
        this._setMainLabel(`${statsRoot}/SelectedTroopSource`, `死亡結算來源：${entry.source}`);
        this._setMainLabel(`${statsRoot}/SelectedTroopArtState`, entry.artReady ? '正式圖' : '占位圖');
        this._setMainLabel(`${loreRoot}/SelectedTroopSpecialTitle`, '特殊戰法');
        this._setMainLabel(`${loreRoot}/SelectedTroopSpecialBody`, entry.special);
        this._setMainLabel(`${noteRoot}/SelectedTroopNoteTitle`, '補圖備註');
        this._setMainLabel(
            `${noteRoot}/SelectedTroopNoteBody`,
            entry.artReady
                ? '目前已接入正式圖，之後如果要換更漂亮的版本，可以直接替換單張資產。'
                : '目前先以占位圖維持正式區完整，後續可逐張替換成正式版。',
        );

        await this._applySelectedArt(
            'RightDetailPanel/DetailContent/SelectedTroopBannerShell/SelectedTroopBannerArt',
            entry.cardArtResource,
            CARD_ART_FALLBACK_PATH,
            true,
        );
        await this._applySelectedArt(
            'RightDetailPanel/DetailContent/SelectedTroopCrestShell/SelectedTroopCrestArt',
            this._buildTypeIconPath(entry.typeKey),
            TYPE_ICON_FALLBACK_PATH,
            false,
        );
    }

    private async _loadSpriteFrame(path: string, preferTextureFallback = false): Promise<SpriteFrame | null> {
        const normalized = this._normalizeKey(path);
        if (this._spriteFrameCache.has(normalized)) {
            return this._spriteFrameCache.get(normalized) ?? null;
        }

        const frame = await services().resource.loadSpriteFrame(path, {
            tags: [CONTENT_TAG],
            preferTextureFallback,
        }).catch(() => null);
        this._spriteFrameCache.set(normalized, frame);
        return frame;
    }

    private async _loadCodexArtSpriteFrame(path: string, preferTextureFallback = false): Promise<SpriteFrame | null> {
        const normalized = this._normalizeKey(path);
        if (!this._isCodexArtPath(path)) {
            return this._loadSpriteFrame(path, preferTextureFallback);
        }

        if (this._spriteFrameCache.has(normalized)) {
            return this._spriteFrameCache.get(normalized) ?? null;
        }

        const frame = await this._loadCodexArtSpriteFrameFromImage(path).catch(async () => {
            return this._loadSpriteFrame(path, preferTextureFallback);
        });
        this._spriteFrameCache.set(normalized, frame);
        return frame;
    }

    private async _loadCodexArtSpriteFrameFromImage(path: string): Promise<SpriteFrame | null> {
        const imageAsset = await this._loadCodexArtImageAsset(path);
        if (!imageAsset) {
            return null;
        }

        const texture = new Texture2D();
        texture.image = imageAsset;
        (texture as any).loaded = true;

        const width = Math.max(1, (imageAsset as any).width ?? (texture as any).width ?? 0);
        const height = Math.max(1, (imageAsset as any).height ?? (texture as any).height ?? 0);

        const frame = new SpriteFrame();
        frame.packable = false;
        frame.rect = new Rect(0, 0, width, height);
        frame.texture = texture;
        frame.name = path.split('/').pop() ?? 'codex-card-art';
        return frame;
    }

    private async _loadCodexArtImageAsset(path: string): Promise<ImageAsset | null> {
        for (const candidate of this._buildCodexArtCandidates(path)) {
            const imageAsset = await services().resource.loadImageAsset(candidate, {
                tags: [CONTENT_TAG],
            }).catch(() => null);
            if (imageAsset) {
                return imageAsset;
            }
        }

        return null;
    }

    private _buildCodexArtCandidates(path: string): string[] {
        const normalized = this._normalizePath(path);
        const base = normalized.replace(/\.(png|jpg|jpeg|webp)$/i, '');
        return this._uniquePaths([
            normalized,
            base,
            `${base}.png`,
            `${base}.jpg`,
            `${base}.jpeg`,
            `${base}.webp`,
        ]);
    }

    private _isCodexArtPath(path: string): boolean {
        return this._normalizeKey(path).includes('ui_tiger_tally_card_art_talisman_');
    }

    private _selectEntry(index: number): void {
        this._selectedIndex = this._clampIndex(index);
        this._syncSelectionVisuals();
        void this._applySelectedEntry(this._entries[this._selectedIndex] ?? null);
    }

    private _syncSelectionVisuals(): void {
        for (let i = 0; i < this._rowNodes.length; i += 1) {
            this._setRowSelection(this._rowNodes[i], i === this._selectedIndex);
        }
    }

    private _setRowSelection(row: Node | null | undefined, selected: boolean): void {
        if (!row) {
            return;
        }
        const glow = row.getChildByName('SelectionGlow');
        if (glow) {
            glow.active = selected;
        }
    }

    private _updateSummaryLabels(): void {
        const total = this._entries.length;
        const formal = this._entries.filter((entry) => entry.artReady).length;
        const missing = total - formal;

        this._setMainLabel('LeftFilterRail/RailContent/RailTitle', '虎符特殊兵種圖');
        this._setMainLabel('LeftFilterRail/RailContent/RailSubtitle', '34 筆名錄已接入正式區，圖片內不寫字，後續可逐張替換。');
        this._setMainLabel('LeftFilterRail/RailContent/RailSummaryPanel/RailTotalLabel', `總數：${total}`);
        this._setMainLabel('LeftFilterRail/RailContent/RailSummaryPanel/RailFormalLabel', `正式圖：${formal}`);
        this._setMainLabel('LeftFilterRail/RailContent/RailSummaryPanel/RailMissingLabel', `占位圖：${missing}`);
        this._setMainLabel('LeftFilterRail/RailContent/RailQualityTitle', '稀有度分布');
        this._setMainLabel('LeftFilterRail/RailContent/RailQualityR', `R：${this._countQuality('R')}`);
        this._setMainLabel('LeftFilterRail/RailContent/RailQualitySR', `SR：${this._countQuality('SR')}`);
        this._setMainLabel('LeftFilterRail/RailContent/RailQualitySSR', `SSR：${this._countQuality('SSR')}`);
        this._setMainLabel('LeftFilterRail/RailContent/RailQualityUR', `UR：${this._countQuality('UR')}`);
        this._setMainLabel('LeftFilterRail/RailContent/RailQualityLR', `LR：${this._countQuality('LR')}`);
        this._setMainLabel('LeftFilterRail/RailContent/RailTypeTitle', '兵種分布');
        this._setMainLabel('LeftFilterRail/RailContent/RailTypeSummary', this._buildTypeSummary());
        this._setMainLabel('LeftFilterRail/RailContent/RailNote', '正式區已接好，先看整體，再逐張替換成你滿意的版本。');
        this._setMainLabel('HeaderRow/CodexTitle', '虎符兵種圖鑑');
        this._setMainLabel('HeaderRow/CodexSubtitle', `34 筆名錄 / 正式圖 ${formal} / 占位圖 ${missing}`);
        this._setMainLabel('HeaderRow/CodexStateBadge/CodexStateLabel', '正式區');
        this._setMainLabel('HeaderRow/CodexCountDock/CodexCountLabel', `${total} / ${total}`);
        this._setButtonText('BtnRefresh', '更新');
        this._setButtonText('BtnTop', '回頂');
        this._setButtonText('BtnClose', '關閉');
    }

    private _countQuality(quality: CodexQuality): number {
        return this._entries.filter((entry) => entry.quality === quality).length;
    }

    private _buildTypeSummary(): string {
        const order: Array<[string, string]> = [
            ['騎兵', 'cavalry'],
            ['步兵', 'infantry'],
            ['弓兵', 'archer'],
            ['盾兵', 'shield'],
            ['水軍', 'navy'],
            ['長槍兵', 'pikeman'],
            ['機械', 'engineer'],
        ];

        const counts = new Map<string, number>();
        for (const entry of this._entries) {
            counts.set(entry.baseTypeLabel, (counts.get(entry.baseTypeLabel) ?? 0) + 1);
        }

        return order
            .map(([label]) => counts.has(label) ? `${label} ${counts.get(label)}` : null)
            .filter((item): item is string => !!item)
            .join('\n');
    }

    private _setButtonText(nodeName: string, text: string): void {
        const node = this._requireNodeByPath(`ActionRow/${nodeName}`);
        const label = node.getChildByName('Label')?.getComponent(Label);
        if (label) {
            label.string = text;
        }
    }

    private _setMainLabel(path: string, text: string): void {
        const label = this._requireNodeByPath(path).getComponent(Label);
        if (label) {
            label.string = text;
        }
    }

    private _setRowLabel(row: Node, path: string, text: string): void {
        const label = row.getChildByPath(path)?.getComponent(Label);
        if (label) {
            label.string = text;
        }
    }

    private _setSpriteActive(path: string, active: boolean): void {
        const node = this._requireNodeByPath(path);
        node.active = active;
    }

    private _getNodeSprite(row: Node, path: string): Sprite | null {
        return row.getChildByPath(path)?.getComponent(Sprite) ?? null;
    }

    private _buildTypeIconPath(typeKey: string): string {
        return `sprites/battle/battle_unit_type_icon_${this._normalizeKey(typeKey)}`;
    }

    private _resolveGroupShortLabel(groupKey: CodexGroupKey): string {
        return groupKey === 'exclusive' ? '專屬型' : '通用型';
    }

    private _resolveMainRoot(): Node | null {
        return this.node.getChildByPath('__safeArea/EliteTroopCodexRoot')
            ?? this.node.getChildByName('EliteTroopCodexRoot');
    }

    private _mainPath(path: string): string {
        const root = this._resolveMainRoot();
        if (root?.parent?.name === '__safeArea') {
            return `__safeArea/EliteTroopCodexRoot/${path}`;
        }
        return `EliteTroopCodexRoot/${path}`;
    }

    private _requireNodeByPath(path: string): Node {
        const fullPath = this._mainPath(path);
        const node = this.node.getChildByPath(fullPath);
        if (!node) {
            throw new Error(`[EliteTroopCodexComposite] 找不到節點: ${fullPath}`);
        }
        return node;
    }

    private _clampIndex(index: number): number {
        if (this._entries.length === 0) {
            return 0;
        }
        return Math.max(0, Math.min(this._entries.length - 1, Math.trunc(index)));
    }

    private _normalizeKey(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    private _normalizePath(value: string): string {
        return value
            .trim()
            .replace(/\\/g, '/')
            .replace(/^db:\/\/assets\/resources\//i, '')
            .replace(/^assets\/resources\//i, '')
            .replace(/^resources\//i, '')
            .replace(/^\/+/, '')
            .replace(/\/+/g, '/');
    }

    private _uniquePaths(paths: Array<string | null | undefined>): string[] {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const path of paths) {
            const normalized = path?.trim();
            if (!normalized || seen.has(normalized)) {
                continue;
            }
            seen.add(normalized);
            result.push(normalized);
        }
        return result;
    }
}
