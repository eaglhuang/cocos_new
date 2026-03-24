/**
 * VfxComposerTool — 特效積木組合器 (在遊戲畫面中運行的 VFX 可視化工具)
 *
 * 使用方式：
 *   1. 在任意場景節點（建議掛在 Canvas 下）加入此 Component。
 *   2. 可在 Inspector 指定 previewAnchorNode，直接決定預覽落點。
 *   3. 執行遊戲後，畫面右側會出現 [🎨VFX] 切換按鈕。
 *   3. 點擊切換按鈕展開面板後：
 *      - 點上方分類頁籤切換積木種類 (發光/火焰/閃電/刀光/衝擊/煙霧/投射物/狀態)。
 *      - 點選積木列會立即切換為該積木，並自動預覽。
 *      - 可切換 Quad 預覽 / Particle Prefab 預覽。
 *      - 按「▶ 重播」→ 在 3D 世界空間重新播放目前選到的積木。
 *      - 按「🔊 音效」→ 播放每個積木對應的音效。
 *      - 按「✕ 清空」→ 清除組合與場景中的預覽。
 *
 * Unity 對照：相當於一個輕量版的 Unity Timeline Preview Window，
 *             只需在 Play Mode 中即可以積木方式即時疊加預覽特效貼圖效果。
 */

import {
    _decorator, Component, Node, Label, Button, Color, UITransform, Widget,
    Graphics, Vec3, assetManager, AssetManager, Material, MeshRenderer,
    Texture2D, AudioClip, gfx, utils, primitives, Layers,
    Canvas, director, Enum, Sprite, SpriteFrame, Prefab, instantiate,
    ParticleSystem, resources, EditBox,
} from "cc";
import { VFX_BLOCK_REGISTRY, VFX_CATEGORIES, VfxBlockDef } from "./vfx-block-registry";
import { services } from "../core/managers/ServiceLoader";
import { setMaterialSafe } from "../core/utils/MaterialUtils";
import { BoardRenderer } from "../battle/views/BoardRenderer";
import { BuffEffectPrefabController } from "../battle/views/effects/BuffEffectPrefabController";
import { applyParticleOverride } from "../core/utils/ParticleUtils";

const { ccclass, property } = _decorator;

enum VfxPreviewMode {
    Quad = 0,
    ParticlePrefab = 1,
}

@ccclass("VfxParticlePreviewBinding")
class VfxParticlePreviewBinding {
    @property({ tooltip: "對應的 blockId（例如 ring_addatk）" })
    public blockId = "";

    @property({ type: Prefab, tooltip: "Particle Prefab 預覽模式使用的 Prefab" })
    public prefab: Prefab | null = null;
}

// ─── Layout constants ──────────────────────────────────────────────────────
const PANEL_W   = 760;
const PANEL_H   = 1220;
const ROW_H     = 86;
const MAX_ROWS  = 5;
const PREVIEW_POS = new Vec3(0, 0.08, 0); // fallback world-space position for preview quads
const PREVIEW_DURATION = 5;              // seconds before auto-clear
const THUMB_SIZE = 64;
const LARGE_PREVIEW_SIZE = 220;
const PANEL_SCALE = 1.2;
const PARTICLE_PREVIEW_ROOT_SCALE = 0.22;
const PARTICLE_PREVIEW_MAX_SIZE = 0.14;
const PARTICLE_PREVIEW_MAX_SPEED = 0.7;
const PARTICLE_PREVIEW_MAX_RADIUS = 0.16;

const DEFAULT_PARTICLE_PREFAB_PATHS: Record<string, string> = {
    ring_addatk: 'fx/buff/buff_gain_3d',
    icon_addatk: 'fx/buff/buff_gain_3d',
    ring_addlife: 'fx/buff/buff_gain_3d',
    icon_addlife: 'fx/buff/buff_gain_3d',
    ring_subatk: 'fx/buff/buff_debuff_3d',
    icon_subatk: 'fx/buff/buff_debuff_3d',
    ring_sublife: 'fx/buff/buff_debuff_3d',
    icon_sublife: 'fx/buff/buff_debuff_3d',
};

const PARTICLE_TINT_PRESETS: Array<{ label: string; color: Color | null }> = [
    { label: '原色', color: null },
    { label: '金', color: new Color(255, 218, 120, 255) },
    { label: '青', color: new Color(128, 255, 228, 255) },
    { label: '紅', color: new Color(255, 136, 136, 255) },
    { label: '紫', color: new Color(212, 160, 255, 255) },
];

interface PreviewEntry {
    node: Node;
    texture?: Texture2D;
    blockPath?: string;
}

@ccclass("VfxComposerTool")
export class VfxComposerTool extends Component {
    @property({ type: Node, tooltip: '預覽落點；若未指定則優先取棋盤中心' })
    public previewAnchorNode: Node | null = null;

    @property({ type: Enum(VfxPreviewMode), tooltip: '工具開啟時的預設預覽模式' })
    public defaultPreviewMode: VfxPreviewMode = VfxPreviewMode.Quad;

    @property({ tooltip: '點選積木列時是否立即預覽' })
    public autoPreviewOnSelect = true;

    @property({ type: [VfxParticlePreviewBinding], tooltip: 'Particle Prefab 模式的 blockId 對照表' })
    public particlePrefabBindings: VfxParticlePreviewBinding[] = [];

    // ─── State ──────────────────────────────────────────────────────────────
    private vfxBundle: AssetManager.Bundle | null = null;
    private panelVisible    = false;
    private currentCat      = 'glow';
    private currentPreviewMode: VfxPreviewMode = VfxPreviewMode.Quad;
    private composition: VfxBlockDef[] = [];
    private selectedBlockId = '';
    private searchQuery = '';
    private filteredBlocks: VfxBlockDef[] = [];
    private particleTint: Color | null = null;
    private particleTintLabel = '原色';
    private particleSizeMultiplier = 1;
    private particleSpeedMultiplier = 1;

    /**
     * 預覽內容的追蹤紀錄（節點 + 負責 addRef 的 Texture2D 引用 + 資源路徑）
     * Unity 對照：List<(GameObject go, Texture tex, string addr)> 的手動追蹤結構
     */
    private previewEntries: PreviewEntry[] = [];
    private thumbnailFrameCache = new Map<string, SpriteFrame>();
    private resourcePrefabCache = new Map<string, Prefab | null>();

    // ─── UI Node refs ────────────────────────────────────────────────────────
    private panel!: Node;
    private blockListContainer!: Node;
    private compLabel!: Label;
    private worldPreviewRoot!: Node;
    private titleLabel!: Label;
    private statusLabel!: Label;
    private selectedPreviewSprite!: Sprite;
    private selectedTitleLabel!: Label;
    private selectedMetaLabel!: Label;
    private particleTintValueLabel!: Label;
    private particleSizeValueLabel!: Label;
    private particleSpeedValueLabel!: Label;

    private previewAnchor = PREVIEW_POS.clone();

    // ─── Lifecycle ──────────────────────────────────────────────────────────
    onLoad() {
        this.currentPreviewMode = this.defaultPreviewMode;

        // World-space root for 3D preview quads
        this.worldPreviewRoot = new Node('VfxPreview_WorldRoot');
        this.worldPreviewRoot.parent = director.getScene()!;
        this.refreshPreviewAnchor();
        this.worldPreviewRoot.setWorldPosition(this.previewAnchor);

        // Build UI after bundle is ready
        this.loadBundle().then(() => this.buildUI());
    }

    onDestroy() {
        this.clearPreview();
        this.thumbnailFrameCache.forEach(frame => frame.destroy());
        this.thumbnailFrameCache.clear();
        if (this.worldPreviewRoot?.isValid) this.worldPreviewRoot.destroy();
    }

    // ─── Bundle loading ──────────────────────────────────────────────────────
    private loadBundle(): Promise<void> {
        return new Promise<void>((resolve) => {
            const existing = assetManager.getBundle('vfx_core');
            if (existing) { this.vfxBundle = existing; resolve(); return; }
            assetManager.loadBundle('vfx_core', (err, bundle) => {
                if (!err) this.vfxBundle = bundle;
                else console.warn('[VfxComposerTool] vfx_core bundle load error:', err);
                resolve();
            });
        });
    }

    // ─── UI Construction ─────────────────────────────────────────────────────
    private buildUI() {
        // Attach to Canvas so widgets calculate against screen size
        const canvas = this.findCanvas();
        if (!canvas) { console.error('[VfxComposerTool] Canvas not found'); return; }

        // Toggle button — always visible at right edge
        const toggleBtn = this.mkNode('VfxToggleBtn', canvas, 96, 36);
        const tw = toggleBtn.addComponent(Widget);
        tw.isAlignRight = true;  tw.right = 4;
        tw.isAlignVerticalCenter = true;
        this.drawRect(toggleBtn, 96, 36, new Color(30, 50, 120, 220), 5);
        this.mkLabel(toggleBtn, '🎨 VFX', 15, Color.WHITE);
        this.mkButton(toggleBtn, () => this.togglePanel());

        // Main panel — right-aligned, top-anchored
        this.panel = this.mkNode('VfxPanel', canvas, PANEL_W, PANEL_H);
        const pw = this.panel.addComponent(Widget);
        pw.isAlignRight = true;  pw.right = 78;
        pw.isAlignTop = true;    pw.top = 10;
        this.panel.setScale(PANEL_SCALE, PANEL_SCALE, 1);
        this.drawRect(this.panel, PANEL_W, PANEL_H, new Color(12, 14, 22, 235), 8);
        this.panel.active = false;

        this.buildPanelContent();
    }

    private buildPanelContent() {
        const p = this.panel;

        // ── Title bar ──
        const title = this.mkLabel(p, '⚙ 特效積木組合器', 42, new Color(180, 210, 255, 255));
        title.setPosition(0, PANEL_H / 2 - 42);
        this.titleLabel = title.getComponent(Label)!;

        const hint = this.mkLabel(p, '點一下就即時預覽；可切換 Quad / Particle Prefab', 24, new Color(120, 140, 180, 200));
        hint.setPosition(0, PANEL_H / 2 - 96);

        const statusNode = this.mkLabel(p, '預覽模式：Quad / 錨點：棋盤中心', 22, new Color(150, 230, 200, 220));
        statusNode.setPosition(0, PANEL_H / 2 - 142);
        this.statusLabel = statusNode.getComponent(Label)!;

        const modeY = PANEL_H / 2 - 198;
        this.mkModeButton(p, 'Quad 預覽', new Color(54, 118, 220, 255), -156, modeY, () => this.setPreviewMode(VfxPreviewMode.Quad));
        this.mkModeButton(p, 'Particle Prefab', new Color(148, 88, 220, 255), 156, modeY, () => this.setPreviewMode(VfxPreviewMode.ParticlePrefab));

        // ── Category tabs ──
        const tabRowY = PANEL_H / 2 - 270;
        const tabW = (PANEL_W - 10) / VFX_CATEGORIES.length;
        VFX_CATEGORIES.forEach((cat, i) => {
            const x = -PANEL_W / 2 + 5 + tabW * i + tabW / 2;
            const tab = this.mkNode(`Tab_${cat.id}`, p, tabW - 2, 56);
            tab.setPosition(x, tabRowY);
            this.drawRect(tab, tabW - 2, 56, new Color(35, 45, 75, 230), 3);
            this.mkLabel(tab, cat.label, 24, new Color(190, 200, 230, 255));
            this.mkButton(tab, () => this.selectCategory(cat.id));
        });

        const searchY = tabRowY - 64;
        this.mkSearchBox(p, searchY);

        // ── Block list area ──
        const listH = MAX_ROWS * ROW_H;
        const listY = searchY - 14 - listH / 2;
        this.blockListContainer = this.mkNode('BlockList', p, PANEL_W - 16, listH);
        this.blockListContainer.setPosition(0, listY);
        this.drawRect(this.blockListContainer, PANEL_W - 16, listH, new Color(18, 22, 38, 220), 4);

        // ── Selected block preview ──
        const compH = 330;
        const compY = listY - listH / 2 - compH / 2 - 6;
        const compArea = this.mkNode('CompArea', p, PANEL_W - 16, compH);
        compArea.setPosition(0, compY);
        this.drawRect(compArea, PANEL_W - 16, compH, new Color(15, 30, 22, 230), 4);

        const compHdr = this.mkLabel(compArea, '目前選中積木', 28, new Color(150, 220, 150, 255));
        compHdr.setPosition(0, compH / 2 - 32);

        const previewCard = this.mkNode('SelectedPreviewCard', compArea, LARGE_PREVIEW_SIZE + 18, LARGE_PREVIEW_SIZE + 18);
        previewCard.setPosition(-208, -6);
        this.drawRect(previewCard, LARGE_PREVIEW_SIZE + 18, LARGE_PREVIEW_SIZE + 18, new Color(12, 16, 28, 255), 8);

        const previewSpriteNode = new Node('SelectedPreviewSprite');
        previewSpriteNode.parent = previewCard;
        const previewSpriteTransform = previewSpriteNode.addComponent(UITransform);
        previewSpriteTransform.setContentSize(LARGE_PREVIEW_SIZE, LARGE_PREVIEW_SIZE);
        this.selectedPreviewSprite = previewSpriteNode.addComponent(Sprite);

        const selectedTitleNode = this.mkTextLabel(compArea, '尚未選擇積木', 32, new Color(240, 248, 255, 255), Label.HorizontalAlign.LEFT, 300, 44);
        selectedTitleNode.setPosition(110, 92);
        this.selectedTitleLabel = selectedTitleNode.getComponent(Label)!;

        const selectedMetaNode = this.mkTextLabel(compArea, '請先點選左側積木。', 22, new Color(170, 196, 220, 255), Label.HorizontalAlign.LEFT, 320, 118);
        selectedMetaNode.setPosition(116, 12);
        selectedMetaNode.getComponent(Label)!.overflow = Label.Overflow.RESIZE_HEIGHT;
        this.selectedMetaLabel = selectedMetaNode.getComponent(Label)!;

        const compLblNode = this.mkNode('CompLbl', compArea, 320, 94);
        compLblNode.setPosition(116, -108);
        const cl = compLblNode.addComponent(Label);
        cl.string = '等待預覽';
        cl.color = new Color(200, 210, 195, 255);
        cl.fontSize = 20;
        cl.horizontalAlign = Label.HorizontalAlign.LEFT;
        cl.verticalAlign = Label.VerticalAlign.TOP;
        cl.overflow = Label.Overflow.RESIZE_HEIGHT;
        this.compLabel = cl;

        const overrideH = 178;
        const overrideY = compY - compH / 2 - overrideH / 2 - 6;
        const overrideArea = this.mkNode('OverrideArea', p, PANEL_W - 16, overrideH);
        overrideArea.setPosition(0, overrideY);
        this.drawRect(overrideArea, PANEL_W - 16, overrideH, new Color(22, 24, 42, 228), 4);
        const overrideHdr = this.mkLabel(overrideArea, 'Particle Prefab 覆寫', 28, new Color(196, 212, 255, 255));
        overrideHdr.setPosition(0, overrideH / 2 - 28);

        const tintText = this.mkTextLabel(overrideArea, '顏色', 22, new Color(210, 220, 235, 255), Label.HorizontalAlign.LEFT, 82, 28);
        tintText.setPosition(-314, 30);
        const tintValue = this.mkTextLabel(overrideArea, this.particleTintLabel, 22, new Color(255, 230, 180, 255), Label.HorizontalAlign.LEFT, 78, 28);
        tintValue.setPosition(-238, 30);
        this.particleTintValueLabel = tintValue.getComponent(Label)!;

        PARTICLE_TINT_PRESETS.forEach((preset, index) => {
            const x = -82 + index * 92;
            this.mkMiniActionButton(overrideArea, preset.label, new Color(60, 78, 122, 255), x, 30, 82, () => this.setParticleTint(preset.label, preset.color));
        });

        const sizeText = this.mkTextLabel(overrideArea, 'Size', 22, new Color(210, 220, 235, 255), Label.HorizontalAlign.LEFT, 74, 28);
        sizeText.setPosition(-314, -42);
        this.mkMiniActionButton(overrideArea, '-', new Color(64, 76, 108, 255), -238, -42, 56, () => this.adjustParticleSize(-0.1));
        const sizeValue = this.mkTextLabel(overrideArea, '1.00x', 22, new Color(255, 230, 180, 255), Label.HorizontalAlign.CENTER, 92, 28);
        sizeValue.setPosition(-158, -42);
        this.particleSizeValueLabel = sizeValue.getComponent(Label)!;
        this.mkMiniActionButton(overrideArea, '+', new Color(64, 76, 108, 255), -78, -42, 56, () => this.adjustParticleSize(0.1));

        const speedText = this.mkTextLabel(overrideArea, 'Speed', 22, new Color(210, 220, 235, 255), Label.HorizontalAlign.LEFT, 88, 28);
        speedText.setPosition(64, -42);
        this.mkMiniActionButton(overrideArea, '-', new Color(64, 76, 108, 255), 160, -42, 56, () => this.adjustParticleSpeed(-0.1));
        const speedValue = this.mkTextLabel(overrideArea, '1.00x', 22, new Color(255, 230, 180, 255), Label.HorizontalAlign.CENTER, 92, 28);
        speedValue.setPosition(240, -42);
        this.particleSpeedValueLabel = speedValue.getComponent(Label)!;
        this.mkMiniActionButton(overrideArea, '+', new Color(64, 76, 108, 255), 320, -42, 56, () => this.adjustParticleSpeed(0.1));

        // ── Action buttons ──
        const btnY = overrideY - overrideH / 2 - 30;
        this.mkActionButton(p, '▶ 播放', new Color(40, 160, 70, 255), -PANEL_W / 2 + 132, btnY, () => this.fireComposition());
        this.mkActionButton(p, '🔊 音效', new Color(50, 100, 200, 255), 0, btnY, () => this.playAudioOnly());
        this.mkActionButton(p, '✕ 清空', new Color(180, 50, 50, 255), PANEL_W / 2 - 132, btnY, () => this.clearComposition());

        // Populate default category
        this.selectCategory('glow');
        this.refreshSelectedBlockPanel();
        this.refreshParticleOverrideLabels();
    }

    // ─── Category & block list ───────────────────────────────────────────────
    private selectCategory(catId: string) {
        this.currentCat = catId;
        // Clear old rows
        this.blockListContainer.removeAllChildren();

        const query = this.searchQuery.trim().toLowerCase();
        const blocks = VFX_BLOCK_REGISTRY.filter(b => b.category === catId)
            .filter(block => query.length === 0
                || block.id.toLowerCase().includes(query)
                || block.label.toLowerCase().includes(query));
        this.filteredBlocks = blocks;

        if (blocks.length === 0) {
            const empty = this.mkTextLabel(this.blockListContainer, '查無符合的積木', 26, new Color(168, 186, 208, 255), Label.HorizontalAlign.CENTER, PANEL_W - 48, 30);
            empty.setPosition(0, 0);
            return;
        }

        const visibleBlocks = blocks.slice(0, MAX_ROWS);
        const startY = (visibleBlocks.length / 2 - 0.5) * ROW_H;

        visibleBlocks.forEach((block, i) => {
            const row = this.mkNode(`Block_${block.id}`, this.blockListContainer, PANEL_W - 22, ROW_H - 2);
            row.setPosition(0, startY - i * ROW_H);
            this.drawRect(row, PANEL_W - 22, ROW_H - 2, new Color(28, 36, 58, 210), 2);

            const thumb = this.mkNode(`Thumb_${block.id}`, row, THUMB_SIZE + 18, THUMB_SIZE + 18);
            thumb.setPosition(-PANEL_W / 2 + 66, 0);
            this.drawRect(thumb, THUMB_SIZE + 18, THUMB_SIZE + 18, new Color(12, 16, 28, 255), 4);

            const spriteNode = new Node('ThumbSprite');
            spriteNode.parent = thumb;
            const spriteTransform = spriteNode.addComponent(UITransform);
            spriteTransform.setContentSize(THUMB_SIZE, THUMB_SIZE);
            const sprite = spriteNode.addComponent(Sprite);
            this.loadThumbnail(block, sprite);

            const titleNode = this.mkTextLabel(row, block.label, 28, new Color(235, 242, 255, 255), Label.HorizontalAlign.LEFT, PANEL_W - 190, 34);
            titleNode.setPosition(96, 18);

            const metaAudio = block.audio ? `🔊 ${block.audio}` : '🔇 無音效';
            const metaMode = this.hasParticlePrefabBinding(block) ? 'Prefab可用' : 'Prefab未綁';
            const blendTag = block.blendMode === 'additive' ? '加算' : '透明';
            const metaText = `${block.space.toUpperCase()} / ${blendTag} / ${metaAudio} / ${metaMode}`;
            const metaNode = this.mkTextLabel(row, metaText, 20, new Color(160, 185, 220, 255), Label.HorizontalAlign.LEFT, PANEL_W - 190, 26);
            metaNode.setPosition(96, -20);

            this.mkButton(row, () => this.selectBlock(block));
        });
    }

    // ─── Composition management ──────────────────────────────────────────────
    private selectBlock(block: VfxBlockDef) {
        this.selectedBlockId = block.id;
        this.composition = [block];
        this.refreshCompLabel();
        this.refreshSelectedBlockPanel(block);
        if (this.autoPreviewOnSelect) {
            void this.fireComposition();
        }
    }

    private clearComposition() {
        this.selectedBlockId = '';
        this.composition = [];
        this.refreshCompLabel();
        this.refreshSelectedBlockPanel();
        this.clearPreview();
        this.updateStatus('尚未選擇積木');
    }

    private refreshCompLabel() {
        if (!this.compLabel) return;
        this.compLabel.string = this.composition.length === 0
            ? '（空，請點選上方積木加入）'
            : this.composition.map((b, i) => {
                const mode = this.currentPreviewMode === VfxPreviewMode.Quad ? 'Quad' : 'Particle';
                return `${i + 1}. ${b.label}\nID: ${b.id}\n${b.blendMode === 'additive' ? '加算' : '透明'} / ${mode}`;
            }).join('\n');
    }

    // ─── Preview: fire & audio ────────────────────────────────────────────────
    private async fireComposition() {
        if (this.composition.length === 0) {
            this.updateStatus('尚未選擇積木');
            return;
        }

        this.clearPreview();
        this.refreshPreviewAnchor();
        this.worldPreviewRoot.setWorldPosition(this.previewAnchor);

        for (let i = 0; i < this.composition.length; i++) {
            const block = this.composition[i];
            const entry = this.currentPreviewMode === VfxPreviewMode.ParticlePrefab
                ? await this.createParticlePrefabPreview(block, i)
                : await this.createWorldQuad(block, i);
            if (entry) this.previewEntries.push(entry);
        }

        const active = this.composition[0];
        this.updateStatus(`預覽中：${active.label} / ${this.currentPreviewMode === VfxPreviewMode.Quad ? 'Quad' : 'Particle Prefab'}`);
        this.scheduleOnce(() => this.clearPreview(), PREVIEW_DURATION);
    }

    private async playAudioOnly() {
        const uniqueClips = [...new Set(
            this.composition.map(b => b.audio).filter(Boolean) as string[]
        )];

        if (uniqueClips.length === 0) {
            return;
        }

        const audioSys = services().audio;
        const bundle = await this.ensureAudioBundle();
        uniqueClips.forEach(clipName => {
            // 若 BattleScene 已預載，直接播放
            if (audioSys.hasClip(clipName)) {
                audioSys.playSfx(clipName);
                return;
            }
            if (!bundle) {
                console.warn(`[VfxComposerTool] audio bundle 尚未載入 (clip: ${clipName})`);
                return;
            }
            bundle.load(`clips/${clipName}`, AudioClip, (err, clip) => {
                if (err) { console.warn(`[VfxComposerTool] 音效載入失敗: ${clipName}`, err); return; }
                audioSys.registerClip(clipName, clip);
                audioSys.playSfx(clipName);
            });
        });
    }

    private clearPreview() {
        // 釋放資源：decRef 讓 Cocos GC 可回收資源，並通報 MemoryManager 更新帳目
        for (const entry of this.previewEntries) {
            if (entry.node?.isValid) entry.node.destroy();
            if (entry.texture) {
                entry.texture.decRef();
            }
            if (entry.blockPath) {
                services().memory.notifyReleased(entry.blockPath);
            }
        }
        this.previewEntries = [];
        this.unscheduleAllCallbacks();
    }

    // ─── World-space quad creation ────────────────────────────────────────────
    /**
     * 在世界空間建立一個平放的 Quad Mesh，貼上指定貼圖。
     * Unity 對照：類似 Graphics.DrawMesh() 在世界空間某點繪製一個帶材質的 Plane Mesh。
     *
     * 資源生命周期說明：
     *   - texture.addRef()  → 由此方法呼叫，讓 Cocos 知道這張貼圖正在被使用
     *   - texture.decRef()  → 由 clearPreview() 呼叫，相當於 Unity 的 Addressables.Release()
     *   - notifyLoaded()    → 通報 MemoryManager 記帳
     *
     * @param block      積木定義
     * @param stackIndex 堆疊索引（微量 y-offset 避免 Z-fighting）
     * @returns          追蹤頻目筆錄，null 表示載入失敗
     */
    private createWorldQuad(
        block: VfxBlockDef,
        stackIndex: number
    ): Promise<PreviewEntry | null> {
        if (!this.vfxBundle) return Promise.resolve(null);

        return new Promise((resolve) => {
            this.vfxBundle!.load(block.texPath, Texture2D, (err, texture) => {
                if (err || !this.worldPreviewRoot?.isValid) {
                    resolve(null);
                    return;
                }

                // addRef: 宣告我們手上持有這張貼圖的引用
                // Unity 對照： Addressables.LoadAssetAsync<Texture2D> 取得 handle
                texture.addRef();

                const node = new Node(`VfxQuad_${block.id}`);
                node.parent = this.worldPreviewRoot;
                node.layer   = Layers.Enum.DEFAULT;

                // 平躺在地面上（繞 X 軸旋轉 -90 度），微量 y-offset 防止 Z-fighting
                node.setPosition(0, stackIndex * 0.005, 0);
                node.eulerAngles = new Vec3(-90, 0, 0);
                node.setScale(block.scale, block.scale, block.scale);

                // 建立 Quad Mesh
                const mr = node.addComponent(MeshRenderer);
                mr.mesh = utils.MeshUtils.createMesh(primitives.quad());

                // 建立材質
                const mat = new Material();
                if (block.blendMode === 'additive') {
                    mat.initialize({
                        effectName: 'builtin-unlit',
                        states: {
                            blendState: {
                                targets: [{
                                    blend:        true,
                                    blendSrc:     gfx.BlendFactor.ONE,
                                    blendDst:     gfx.BlendFactor.ONE,
                                    blendSrcAlpha: gfx.BlendFactor.ONE,
                                    blendDstAlpha: gfx.BlendFactor.ZERO,
                                }],
                            },
                            depthStencilState: { depthTest: false, depthWrite: false },
                        },
                    });
                } else {
                    mat.initialize({
                        effectName: 'builtin-unlit',
                        states: {
                            blendState: {
                                targets: [{
                                    blend:    true,
                                    blendSrc: gfx.BlendFactor.SRC_ALPHA,
                                    blendDst: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
                                }],
                            },
                            depthStencilState: { depthTest: false, depthWrite: false },
                        },
                    });
                }

                mat.setProperty('mainTexture', texture);
                mat.setProperty('mainColor', new Color(255, 255, 255, 255));
                setMaterialSafe(mr, mat, 0);

                // 通報 MemoryManager 記帳→ 相當於 Unity Addressables handle.Completed 事件追蹤
                services().memory.notifyLoaded(block.texPath, 'vfx_core', 'Texture2D');

                resolve({ node, texture, blockPath: block.texPath });
            });
        });
    }

    private async createParticlePrefabPreview(block: VfxBlockDef, stackIndex: number): Promise<PreviewEntry | null> {
        const prefab = await this.resolveParticlePrefab(block);
        if (!prefab) {
            this.updateStatus(`Particle Prefab 未綁定：${block.label}，改用 Quad 預覽`);
            return this.createWorldQuad(block, stackIndex);
        }

        const node = instantiate(prefab);
        node.name = `VfxPrefab_${block.id}`;
        node.parent = this.worldPreviewRoot;
        node.layer = Layers.Enum.DEFAULT;
        node.setPosition(0, stackIndex * 0.01, 0);
        node.setRotationFromEuler(0, 0, 0);
        node.setScale(PARTICLE_PREVIEW_ROOT_SCALE, PARTICLE_PREVIEW_ROOT_SCALE, PARTICLE_PREVIEW_ROOT_SCALE);
        this.applyLayerRecursively(node);

        const controller = node.getComponent(BuffEffectPrefabController);
        controller?.ensureStructure();

        const systems = node.getComponentsInChildren(ParticleSystem);
        if (systems.length === 0) {
            node.destroy();
            this.updateStatus(`Particle Prefab 無粒子系統：${block.label}，改用 Quad 預覽`);
            return this.createWorldQuad(block, stackIndex);
        }

        this.applyParticlePreviewOverrides(systems);
        systems.forEach(ps => {
            ps.stop();
            ps.clear();
            ps.playOnAwake = false;
            ps.loop = false;
            ps.enabled = true;
            ps.play();
        });

        return { node };
    }

    // ─── Panel toggle ─────────────────────────────────────────────────────────
    private togglePanel() {
        this.panelVisible = !this.panelVisible;
        this.panel.active = this.panelVisible;
    }

    private refreshPreviewAnchor() {
        if (this.previewAnchorNode?.isValid) {
            this.previewAnchor = this.previewAnchorNode.worldPosition.clone();
            this.updateTitle('⚙ 特效積木組合器  [指定錨點]');
            return;
        }

        const board = director.getScene()?.getComponentInChildren(BoardRenderer) ?? null;
        if (!board) {
            this.previewAnchor = PREVIEW_POS.clone();
            this.updateTitle('⚙ 特效積木組合器  [fallback]');
            return;
        }

        const metrics = board.getBoardMetrics();
        this.previewAnchor = new Vec3(metrics.center.x, metrics.center.y + PREVIEW_POS.y, metrics.center.z);
        this.updateTitle('⚙ 特效積木組合器  [棋盤中心]');
    }

    private ensureAudioBundle(): Promise<AssetManager.Bundle | null> {
        return new Promise(resolve => {
            const existing = assetManager.getBundle('audio');
            if (existing) {
                resolve(existing);
                return;
            }

            assetManager.loadBundle('audio', (err, bundle) => {
                if (err || !bundle) {
                    console.warn('[VfxComposerTool] audio bundle load error:', err);
                    resolve(null);
                    return;
                }
                resolve(bundle);
            });
        });
    }

    private updateTitle(text: string) {
        if (!this.titleLabel) {
            return;
        }
        this.titleLabel.string = text;
    }

    private updateStatus(text: string) {
        if (!this.statusLabel) {
            return;
        }
        const modeText = this.currentPreviewMode === VfxPreviewMode.Quad ? 'Quad' : 'Particle Prefab';
        const anchorText = this.previewAnchorNode?.isValid ? '指定錨點' : (director.getScene()?.getComponentInChildren(BoardRenderer) ? '棋盤中心' : 'Fallback');
        const overrideText = `Tint:${this.particleTintLabel} Size:${this.particleSizeMultiplier.toFixed(2)}x Speed:${this.particleSpeedMultiplier.toFixed(2)}x`;
        this.statusLabel.string = `${text}  ｜  模式：${modeText}  ｜  錨點：${anchorText}  ｜  ${overrideText}`;
    }

    private setPreviewMode(mode: VfxPreviewMode) {
        this.currentPreviewMode = mode;
        this.refreshCompLabel();
        this.updateStatus(mode === VfxPreviewMode.Quad ? '已切換到 Quad 預覽' : '已切換到 Particle Prefab 預覽');
        if (this.autoPreviewOnSelect && this.composition.length > 0) {
            void this.fireComposition();
        }
    }

    private hasParticlePrefabBinding(block: VfxBlockDef): boolean {
        return this.particlePrefabBindings.some(binding => binding.blockId === block.id && !!binding.prefab)
            || !!DEFAULT_PARTICLE_PREFAB_PATHS[block.id];
    }

    private async resolveParticlePrefab(block: VfxBlockDef): Promise<Prefab | null> {
        const bound = this.particlePrefabBindings.find(binding => binding.blockId === block.id && binding.prefab);
        if (bound?.prefab) {
            return bound.prefab;
        }

        const defaultPath = DEFAULT_PARTICLE_PREFAB_PATHS[block.id];
        if (!defaultPath) {
            return null;
        }

        if (this.resourcePrefabCache.has(defaultPath)) {
            return this.resourcePrefabCache.get(defaultPath) ?? null;
        }

        return new Promise(resolve => {
            resources.load(defaultPath, Prefab, (err, prefab) => {
                if (err || !prefab) {
                    console.warn(`[VfxComposerTool] default particle prefab 載入失敗 (${defaultPath}):`, err?.message);
                    this.resourcePrefabCache.set(defaultPath, null);
                    resolve(null);
                    return;
                }
                this.resourcePrefabCache.set(defaultPath, prefab);
                resolve(prefab);
            });
        });
    }

    private applyLayerRecursively(root: Node) {
        root.layer = Layers.Enum.DEFAULT;
        root.children.forEach(child => this.applyLayerRecursively(child));
    }

    private loadThumbnail(block: VfxBlockDef, sprite: Sprite) {
        const cached = this.thumbnailFrameCache.get(block.id);
        if (cached) {
            sprite.spriteFrame = cached;
            return;
        }
        if (!this.vfxBundle) {
            return;
        }

        this.vfxBundle.load(block.texPath, Texture2D, (err, texture) => {
            if (err || !texture || !sprite.node?.isValid) {
                return;
            }
            const frame = new SpriteFrame();
            frame.texture = texture;
            this.thumbnailFrameCache.set(block.id, frame);
            sprite.spriteFrame = frame;
        });
    }

    private refreshSelectedBlockPanel(block?: VfxBlockDef) {
        const activeBlock = block ?? this.composition[0] ?? null;
        if (!activeBlock) {
            this.selectedTitleLabel.string = '尚未選擇積木';
            this.selectedMetaLabel.string = '請先點選左側積木。';
            this.selectedPreviewSprite.spriteFrame = null;
            return;
        }

        this.selectedTitleLabel.string = activeBlock.label;
        const prefabText = this.hasParticlePrefabBinding(activeBlock) ? '內建/已綁定' : '未綁定';
        const audioText = activeBlock.audio ? `音效 ${activeBlock.audio}` : '無音效';
        this.selectedMetaLabel.string = `ID: ${activeBlock.id}\n分類: ${activeBlock.category}\n${activeBlock.space.toUpperCase()} / ${activeBlock.blendMode}\nPrefab: ${prefabText} / ${audioText}`;
        this.loadThumbnail(activeBlock, this.selectedPreviewSprite);
    }

    private applyParticlePreviewOverrides(systems: ParticleSystem[]) {
        systems.forEach(ps => {
            const baseSize = ps.startSizeX.constant || 1;
            const baseSizeY = ps.startSizeY.constant || baseSize;
            const baseSizeZ = ps.startSizeZ.constant || baseSize;
            const baseSpeed = ps.startSpeed.constant || 1;
            const clampedSize = Math.min(baseSize, PARTICLE_PREVIEW_MAX_SIZE) * this.particleSizeMultiplier;
            const clampedSizeY = Math.min(baseSizeY, PARTICLE_PREVIEW_MAX_SIZE) * this.particleSizeMultiplier;
            const clampedSizeZ = Math.min(baseSizeZ, PARTICLE_PREVIEW_MAX_SIZE) * this.particleSizeMultiplier;
            const clampedSpeed = Math.min(baseSpeed, PARTICLE_PREVIEW_MAX_SPEED) * this.particleSpeedMultiplier;
            applyParticleOverride(ps, {
                startColor: this.particleTint ? new Color(this.particleTint.r, this.particleTint.g, this.particleTint.b, this.particleTint.a) : undefined,
                startSize: clampedSize,
                startSizeY: clampedSizeY,
                startSizeZ: clampedSizeZ,
                startSpeed: clampedSpeed,
                shapeRadius: Math.min(ps.shapeModule?.radius ?? PARTICLE_PREVIEW_MAX_RADIUS, PARTICLE_PREVIEW_MAX_RADIUS),
            });
        });
    }

    private setParticleTint(label: string, color: Color | null) {
        this.particleTintLabel = label;
        this.particleTint = color ? new Color(color.r, color.g, color.b, color.a) : null;
        this.refreshParticleOverrideLabels();
        this.updateStatus('已更新 Particle 顏色覆寫');
        this.replaySelectedParticlePreviewIfNeeded();
    }

    private adjustParticleSize(delta: number) {
        this.particleSizeMultiplier = this.clampParticleFactor(this.particleSizeMultiplier + delta);
        this.refreshParticleOverrideLabels();
        this.updateStatus('已更新 Particle Size');
        this.replaySelectedParticlePreviewIfNeeded();
    }

    private adjustParticleSpeed(delta: number) {
        this.particleSpeedMultiplier = this.clampParticleFactor(this.particleSpeedMultiplier + delta);
        this.refreshParticleOverrideLabels();
        this.updateStatus('已更新 Particle Speed');
        this.replaySelectedParticlePreviewIfNeeded();
    }

    private clampParticleFactor(value: number): number {
        return Math.min(2.5, Math.max(0.2, Math.round(value * 100) / 100));
    }

    private refreshParticleOverrideLabels() {
        this.particleTintValueLabel.string = this.particleTintLabel;
        this.particleSizeValueLabel.string = `${this.particleSizeMultiplier.toFixed(2)}x`;
        this.particleSpeedValueLabel.string = `${this.particleSpeedMultiplier.toFixed(2)}x`;
    }

    private replaySelectedParticlePreviewIfNeeded() {
        if (!this.autoPreviewOnSelect || this.currentPreviewMode !== VfxPreviewMode.ParticlePrefab || this.composition.length === 0) {
            return;
        }
        void this.fireComposition();
    }

    // ─── UI helpers ───────────────────────────────────────────────────────────
    /** 取得場景中的 Canvas 節點 */
    private findCanvas(): Node | null {
        const scene = director.getScene();
        if (!scene) return null;
        // Find Canvas component anywhere in scene
        const canvasComp = scene.getComponentInChildren(Canvas);
        return canvasComp?.node ?? null;
    }

    /** 建立帶有 UITransform 的 Node */
    private mkNode(name: string, parent: Node, w: number, h: number): Node {
        const n  = new Node(name);
        n.parent = parent;
        const t  = n.addComponent(UITransform);
        t.setContentSize(w, h);
        return n;
    }

    /** 使用 Graphics 繪製圓角矩形背景 */
    private drawRect(node: Node, w: number, h: number, color: Color, radius: number) {
        const g = node.addComponent(Graphics);
        g.fillColor = color;
        g.roundRect(-w / 2, -h / 2, w, h, radius);
        g.fill();
    }

    /** 在 parent 中央加入 Label，回傳 Label Node */
    private mkLabel(parent: Node, text: string, size: number, color: Color): Node {
        const pTrans = parent.getComponent(UITransform);
        const pw = pTrans?.contentSize.width  ?? 100;
        const ph = pTrans?.contentSize.height ?? 24;

        const ln = new Node('Lbl');
        ln.parent = parent;
        const lt = ln.addComponent(UITransform);
        lt.setContentSize(pw - 4, ph);

        const l = ln.addComponent(Label);
        l.string           = text;
        l.fontSize         = size;
        l.color            = color;
        l.horizontalAlign  = Label.HorizontalAlign.CENTER;
        l.verticalAlign    = Label.VerticalAlign.CENTER;
        l.overflow         = Label.Overflow.SHRINK;
        return ln;
    }

    private mkTextLabel(parent: Node, text: string, size: number, color: Color, align: number, width = PANEL_W - 110, height = 18): Node {
        const ln = new Node('TextLbl');
        ln.parent = parent;
        const lt = ln.addComponent(UITransform);
        lt.setContentSize(width, height);
        const l = ln.addComponent(Label);
        l.string = text;
        l.fontSize = size;
        l.color = color;
        l.horizontalAlign = align;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.overflow = Label.Overflow.SHRINK;
        return ln;
    }

    /** 替 node 加上 Button 組件並綁定點擊事件 */
    private mkButton(node: Node, cb: () => void) {
        const btn = node.addComponent(Button);
        btn.node.on(Button.EventType.CLICK, cb, this);
    }

    private mkModeButton(parent: Node, text: string, color: Color, x: number, y: number, cb: () => void) {
        const btn = this.mkNode(`Mode_${text}`, parent, 260, 58);
        btn.setPosition(x, y);
        this.drawRect(btn, 260, 58, color, 6);
        this.mkLabel(btn, text, 24, Color.WHITE);
        this.mkButton(btn, cb);
    }

    private mkSearchBox(parent: Node, y: number) {
        const box = this.mkNode('SearchBox', parent, PANEL_W - 18, 54);
        box.setPosition(0, y);
        this.drawRect(box, PANEL_W - 18, 54, new Color(20, 24, 42, 240), 6);

        const placeholderNode = new Node('Placeholder');
        placeholderNode.parent = box;
        const placeholderTransform = placeholderNode.addComponent(UITransform);
        placeholderTransform.setContentSize(PANEL_W - 38, 40);
        const placeholderLabel = placeholderNode.addComponent(Label);
        placeholderLabel.string = '搜尋 blockId / 名稱';
        placeholderLabel.fontSize = 24;
        placeholderLabel.color = new Color(120, 136, 168, 220);
        placeholderLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        placeholderLabel.verticalAlign = Label.VerticalAlign.CENTER;

        const textNode = new Node('Text');
        textNode.parent = box;
        const textTransform = textNode.addComponent(UITransform);
        textTransform.setContentSize(PANEL_W - 38, 40);
        const textLabel = textNode.addComponent(Label);
        textLabel.fontSize = 24;
        textLabel.color = new Color(235, 242, 255, 255);
        textLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        textLabel.verticalAlign = Label.VerticalAlign.CENTER;

        const editBox = box.addComponent(EditBox);
        editBox.placeholderLabel = placeholderLabel;
        editBox.textLabel = textLabel;
        editBox.string = '';
        editBox.maxLength = 32;
        editBox.node.on(EditBox.EventType.TEXT_CHANGED, () => {
            this.searchQuery = editBox.string;
            this.selectCategory(this.currentCat);
        }, this);
    }

    private mkMiniActionButton(parent: Node, text: string, color: Color, x: number, y: number, width: number, cb: () => void) {
        const btn = this.mkNode(`MiniBtn_${text}`, parent, width, 44);
        btn.setPosition(x, y);
        this.drawRect(btn, width, 44, color, 5);
        this.mkLabel(btn, text, 20, Color.WHITE);
        this.mkButton(btn, cb);
    }

    /** 建立一個帶顏色背景與文字的動作按鈕 */
    private mkActionButton(parent: Node, text: string, color: Color, x: number, y: number, cb: () => void) {
        const btn = this.mkNode(`Btn_${text}`, parent, 180, 68);
        btn.setPosition(x, y);
        this.drawRect(btn, 180, 68, color, 6);
        this.mkLabel(btn, text, 28, Color.WHITE);
        this.mkButton(btn, cb);
    }
}
