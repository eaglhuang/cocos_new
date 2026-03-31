// @spec-source → 見 docs/cross-reference-index.md
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
    Graphics, Vec3, Vec4, assetManager, AssetManager, Material, MeshRenderer,
    Texture2D, ImageAsset, AudioClip, gfx, utils, primitives, Layers,
    Canvas, director, Enum, Sprite, SpriteFrame, Prefab, instantiate,
    ParticleSystem, resources, EditBox, ScrollView, Mask, Layout, Animation,
    tween, Tween,
} from "cc";
import { VFX_BLOCK_REGISTRY, VFX_CATEGORIES, VfxBlockDef } from "./vfx-block-registry";
import { services } from "../core/managers/ServiceLoader";
import { setMaterialSafe } from "../core/utils/MaterialUtils";
import { BoardRenderer } from "../battle/views/BoardRenderer";
import { BuffEffectPrefabController } from "../battle/views/effects/BuffEffectPrefabController";
import { BuffGainEffectPool, BuffEffectConfig } from "../battle/views/effects/BuffGainEffectPool";
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
const PREVIEW_POS = new Vec3(0, 0.5, 0); // 特效浮在格子上方 0.5 單位，2.5D 視角更清楚（舊值 0.08 幾乎貼地不易看見）
const PREVIEW_DURATION = 5;              // seconds before auto-clear
const THUMB_SIZE = 64;
const LARGE_PREVIEW_SIZE = 220;
// Panel 縮小至 0.80 倍 → 有效寬度從 912px 降至約 608px，讓 3D 背景可見
// 舊值 1.2 會讓右側面板佔據 71% 螢幕，完全遮住棋盤中央的特效預覽
const PANEL_SCALE = 0.80;
// Tab 分兩行排列，每行最多 5 個分類
const TAB_COLS = 5;
const TAB_H = 50;
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

/**
 * 狀態特效 → BuffGainEffectPool 配置映射表。
 * VfxComposerTool 中的狀態積木直接用戰鬥場景相同的系統播放，
 * 預覽和實際遊戲效果完全一致（展環 → 彈出圖示 → 箭頭 → 火花）。
 * Unity 對照：直接外露 RuntimeSystem.atkGainPool.play(pos) 給工具用。
 */
const STATUS_BUFF_POOL_CONFIGS: Record<string, BuffEffectConfig> = {
    ring_addatk: {
        variant: 'AtkGain',
        ringTexturePath:  'vfx_core:textures/rings/tex_ring_addatk',
        mainTexturePath:  'vfx_core:textures/icons/tex_icon_addatk',
        arrowTexturePath: 'vfx_core:textures/shapes/tex_shape_arrow_addatk',
        sparkTexturePath: 'vfx_core:textures/glow/ex_hit_flash',
        arrowUp: true,
        label: 'AtkGain',
    },
    icon_addatk: {
        variant: 'AtkGain',
        ringTexturePath:  'vfx_core:textures/rings/tex_ring_addatk',
        mainTexturePath:  'vfx_core:textures/icons/tex_icon_addatk',
        arrowTexturePath: 'vfx_core:textures/shapes/tex_shape_arrow_addatk',
        sparkTexturePath: 'vfx_core:textures/glow/ex_hit_flash',
        arrowUp: true,
        mainScaleMultiplier: 0.78,
        label: 'AtkGain',
    },
    ring_addlife: {
        variant: 'HpGain',
        ringTexturePath:  'vfx_core:textures/rings/tex_ring_addlife',
        mainTexturePath:  'vfx_core:textures/icons/tex_icon_addlife',
        arrowTexturePath: 'vfx_core:textures/shapes/tex_shape_arrow_addlife',
        sparkTexturePath: 'vfx_core:textures/glow/tex_glow_soft',
        arrowUp: true,
        useDualArrows: true,
        label: 'HpGain',
    },
    icon_addlife: {
        variant: 'HpGain',
        ringTexturePath:  'vfx_core:textures/rings/tex_ring_addlife',
        mainTexturePath:  'vfx_core:textures/icons/tex_icon_addlife',
        arrowTexturePath: 'vfx_core:textures/shapes/tex_shape_arrow_addlife',
        sparkTexturePath: 'vfx_core:textures/glow/tex_glow_soft',
        arrowUp: true,
        useDualArrows: true,
        mainScaleMultiplier: 0.78,
        label: 'HpGain',
    },
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
    private tabNodes: { id: string; node: Node }[] = [];
    private quadModeBtn!: Node;
    private particleModeBtn!: Node;
    /** 已初始化的 BuffGainEffectPool 快取：避免每次預覽都重新載入 EffectAsset + 貼圖 */
    private buffPoolCache = new Map<string, { node: Node; pool: BuffGainEffectPool }>();
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
        // BuffGainEffectPool 快取節點獨立於 previewEntries，需自行清理
        this.buffPoolCache.forEach(({ node }) => { if (node?.isValid) node.destroy(); });
        this.buffPoolCache.clear();
        if (this.worldPreviewRoot?.isValid) this.worldPreviewRoot.destroy();
    }

    // ─── Bundle loading ──────────────────────────────────────────────────────
    private loadBundle(): Promise<void> {
        return new Promise<void>((resolve) => {
            const existing = assetManager.getBundle('vfx_core');
            if (existing) { this.vfxBundle = existing; resolve(); return; }
            assetManager.loadBundle('vfx_core', (err, bundle) => {
                if (!err) {
                    this.vfxBundle = bundle;
                    console.log('[VfxComposerTool] vfx_core bundle 載入成功');
                } else {
                    console.warn('[VfxComposerTool] vfx_core bundle 載入失敗（特效積木 Quad 預覽停用）:', err);
                }
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
        this.quadModeBtn = this.mkModeButton(p, 'Quad 預覽', new Color(54, 118, 220, 255), -156, modeY, () => this.setPreviewMode(VfxPreviewMode.Quad));
        this.particleModeBtn = this.mkModeButton(p, 'Particle Prefab', new Color(148, 88, 220, 255), 156, modeY, () => this.setPreviewMode(VfxPreviewMode.ParticlePrefab));

        // ── Category tabs（兩行排列，確保每個 tab 有足夠點擊面積）──
        const tabRowTopY = PANEL_H / 2 - 260;
        const tabRows = Math.ceil(VFX_CATEGORIES.length / TAB_COLS);
        const tabW = (PANEL_W - 10) / TAB_COLS;
        this.tabNodes = [];
        VFX_CATEGORIES.forEach((cat, i) => {
            const col = i % TAB_COLS;
            const row = Math.floor(i / TAB_COLS);
            const x = -PANEL_W / 2 + 5 + tabW * col + tabW / 2;
            const y = tabRowTopY - row * (TAB_H + 4);
            const tab = this.mkNode(`Tab_${cat.id}`, p, tabW - 4, TAB_H);
            tab.setPosition(x, y);
            this.drawRect(tab, tabW - 4, TAB_H, new Color(35, 45, 75, 230), 3);
            this.mkLabel(tab, cat.label, 22, new Color(190, 200, 230, 255));
            this.mkButton(tab, () => {
                console.log(`[VfxComposerTool] tab 點擊 → ${cat.id} (${cat.label})`);
                this.selectCategory(cat.id);
            });
            this.tabNodes.push({ id: cat.id, node: tab });
        });

        const tabBottomY = tabRowTopY - (tabRows - 1) * (TAB_H + 4) - TAB_H / 2;
        const searchY = tabBottomY - 38;
        this.mkSearchBox(p, searchY);

        // ── Block list area（使用 ScrollView 支援拖拉捲動）──
        const listH = MAX_ROWS * ROW_H;
        const listY = searchY - 14 - listH / 2;
        const scrollNode = this.mkNode('BlockListScroll', p, PANEL_W - 16, listH);
        scrollNode.setPosition(0, listY);
        this.drawRect(scrollNode, PANEL_W - 16, listH, new Color(18, 22, 38, 220), 4);

        // ScrollView 結構: scrollNode(ScrollView) → viewport(Mask) → content(Layout)
        const viewport = this.mkNode('Viewport', scrollNode, PANEL_W - 16, listH);
        viewport.addComponent(Mask);

        this.blockListContainer = this.mkNode('Content', viewport, PANEL_W - 16, listH);
        const contentTransform = this.blockListContainer.getComponent(UITransform)!;
        contentTransform.setAnchorPoint(0.5, 1); // 頂部對齊，方便垂直捲動
        this.blockListContainer.setPosition(0, listH / 2);

        const sv = scrollNode.addComponent(ScrollView);
        sv.content = this.blockListContainer;
        sv.horizontal = false;
        sv.vertical = true;
        sv.bounceDuration = 0.3;
        sv.brake = 0.75;

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
        this.selectedPreviewSprite.sizeMode = Sprite.SizeMode.CUSTOM;

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
        console.log(`[VfxComposerTool] selectCategory: ${catId}`);
        this.currentCat = catId;
        // 更新 tab 高亮
        this.updateTabHighlight(catId);
        // Clear old rows
        this.blockListContainer.removeAllChildren();

        const query = this.searchQuery.trim().toLowerCase();
        const blocks = VFX_BLOCK_REGISTRY.filter(b => b.category === catId)
            .filter(block => query.length === 0
                || block.id.toLowerCase().includes(query)
                || block.label.toLowerCase().includes(query));
        this.filteredBlocks = blocks;
        console.log(`[VfxComposerTool] 分類 ${catId} 篩選結果：${blocks.length} 個積木`);

        if (blocks.length === 0) {
            const empty = this.mkTextLabel(this.blockListContainer, '查無符合的積木', 26, new Color(168, 186, 208, 255), Label.HorizontalAlign.CENTER, PANEL_W - 48, 30);
            empty.setPosition(0, -30);
            // 重設 content 高度
            this.blockListContainer.getComponent(UITransform)!.setContentSize(PANEL_W - 16, MAX_ROWS * ROW_H);
            return;
        }

        // 列出所有積木（不再限制 MAX_ROWS），交由 ScrollView 捲動
        const totalH = blocks.length * ROW_H;
        this.blockListContainer.getComponent(UITransform)!.setContentSize(PANEL_W - 16, totalH);

        blocks.forEach((block, i) => {
            const playable = this.isBlockPlayable(block);
            const row = this.mkNode(`Block_${block.id}`, this.blockListContainer, PANEL_W - 22, ROW_H - 2);
            // anchor 在頂部 (0.5, 1)，所以向下排列
            row.setPosition(0, -(i * ROW_H + ROW_H / 2));
            // 可播放→正常底色；不可播放→灰暗底色
            this.drawRect(row, PANEL_W - 22, ROW_H - 2,
                playable ? new Color(28, 36, 58, 210) : new Color(40, 40, 44, 180), 2);

            const thumb = this.mkNode(`Thumb_${block.id}`, row, THUMB_SIZE + 18, THUMB_SIZE + 18);
            thumb.setPosition(-PANEL_W / 2 + 66, 0);
            this.drawRect(thumb, THUMB_SIZE + 18, THUMB_SIZE + 18, new Color(12, 16, 28, 255), 4);

            const spriteNode = new Node('ThumbSprite');
            spriteNode.parent = thumb;
            const spriteTransform = spriteNode.addComponent(UITransform);
            spriteTransform.setContentSize(THUMB_SIZE, THUMB_SIZE);
            const sprite = spriteNode.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            this.loadThumbnail(block, sprite);

            // 文字顏色：可播放→白色；不可播放→暗灰
            const titleColor = playable ? new Color(235, 242, 255, 255) : new Color(100, 100, 110, 200);
            const titleNode = this.mkTextLabel(row, block.label, 28, titleColor, Label.HorizontalAlign.LEFT, PANEL_W - 190, 34);
            titleNode.setPosition(96, 18);

            const metaAudio = block.audio ? `🔊 ${block.audio}` : '🔇 無音效';
            // 顯示播放方式標記
            const playTag = block.prefabPath ? '🎆3D粒子'
                : block.texPath ? '🖼️平面'
                : this.hasParticlePrefabBinding(block) ? '🎆Prefab' : '⛔無資源';
            const blendTag = block.blendMode === 'additive' ? '加算' : '透明';
            const metaText = `${playTag} / ${block.space.toUpperCase()} / ${blendTag} / ${metaAudio}`;
            const metaColor = playable ? new Color(160, 185, 220, 255) : new Color(90, 90, 100, 180);
            const metaNode = this.mkTextLabel(row, metaText, 20, metaColor, Label.HorizontalAlign.LEFT, PANEL_W - 190, 26);
            metaNode.setPosition(96, -20);

            if (playable) {
                this.mkButton(row, () => {
                    console.log(`[VfxComposerTool] 積木點擊 → ${block.id} (${block.label}), prefabPath=${block.prefabPath ?? 'none'}, texPath=${block.texPath || 'none'}`);
                    this.selectBlock(block);
                });
            } else {
                // 不可播放：不加 Button，log 記錄
                console.log(`[VfxComposerTool] 積木 ${block.id} (${block.label}) 無可用資源，已灰掉`);
            }
        });

        // 重設 ScrollView 捲動位置到頂部
        const scrollNode = this.blockListContainer.parent?.parent;
        const sv = scrollNode?.getComponent(ScrollView);
        sv?.scrollToTop(0.1);
    }

    /** 更新 tab 高亮樣式 */
    private updateTabHighlight(activeId: string) {
        for (const { id, node } of this.tabNodes) {
            const g = node.getComponent(Graphics);
            if (!g) continue;
            g.clear();
            const ut = node.getComponent(UITransform)!;
            const w = ut.contentSize.width;
            const h = ut.contentSize.height;
            const color = id === activeId
                ? new Color(60, 90, 180, 255)   // 選中→亮藍
                : new Color(35, 45, 75, 230);   // 未選中→暗底
            g.fillColor = color;
            g.roundRect(-w / 2, -h / 2, w, h, 3);
            g.fill();
        }
    }

    // ─── Composition management ──────────────────────────────────────────────
    private selectBlock(block: VfxBlockDef) {
        console.log(`[VfxComposerTool] selectBlock: ${block.id} (${block.label}), category=${block.category}, prefabPath=${block.prefabPath ?? 'none'}`);
        this.selectedBlockId = block.id;
        this.composition = [block];
        // 根據積木支援的模式自動切換
        if (block.prefabPath && !block.texPath) {
            this.currentPreviewMode = VfxPreviewMode.ParticlePrefab;
        } else if (block.texPath && !block.prefabPath && !this.hasParticlePrefabBinding(block)) {
            this.currentPreviewMode = VfxPreviewMode.Quad;
        }
        this.updateModeButtonVisuals();
        this.refreshCompLabel();
        this.refreshSelectedBlockPanel(block);
        if (this.autoPreviewOnSelect) {
            void this.fireComposition();
        }
    }

    private clearComposition() {
        console.log('[VfxComposerTool] clearComposition');
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
        console.log(`[VfxComposerTool] fireComposition: 組合=${this.composition.map(b => b.id).join(',')}, mode=${this.currentPreviewMode === VfxPreviewMode.Quad ? 'Quad' : 'Particle'}`);
        if (this.composition.length === 0) {
            this.updateStatus('尚未選擇積木');
            return;
        }

        this.clearPreview();
        this.refreshPreviewAnchor();
        this.worldPreviewRoot.setWorldPosition(this.previewAnchor);

        for (let i = 0; i < this.composition.length; i++) {
            const block = this.composition[i];
            // 有 prefabPath 的積木強制使用 Particle Prefab 模式（3D 粒子特效不適合 Quad 預覽）
            const useParticle = !!block.prefabPath
                || this.currentPreviewMode === VfxPreviewMode.ParticlePrefab;
            console.log(`[VfxComposerTool] 載入積木[${i}]: ${block.id}, useParticle=${useParticle}, prefabPath=${block.prefabPath ?? 'none'}, texPath=${block.texPath || 'none'}`);
            const entry = useParticle
                ? await this.createParticlePrefabPreview(block, i)
                : await this.createWorldQuad(block, i);
            console.log(`[VfxComposerTool] 積木[${i}] ${block.id} 載入${entry ? '成功' : '失敗'}`);
            if (entry) this.previewEntries.push(entry);
        }

        if (this.previewEntries.length === 0) {
            this.updateStatus(`⚠️ 播放失敗：積木無法載入，請確認 vfx_core bundle 是否正常（${this.composition[0]?.id ?? '?'}）`);
            console.warn('[VfxComposerTool] fireComposition：所有積木項目載入均失敗，預覽無輸出');
            return;
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
        if (!this.vfxBundle) {
            console.warn(`[VfxComposerTool] vfx_core bundle 未載入，無法建立 Quad 預覽 (${block.id})`);
            return Promise.resolve(null);
        }
        if (!block.texPath) {
            console.warn(`[VfxComposerTool] 積木 ${block.id} 無 texPath，無法建立 Quad 預覽`);
            return Promise.resolve(null);
        }

        return new Promise((resolve) => {
            this.loadVfxTexture(block.texPath).then(texture => {
                if (!texture) {
                    resolve(null);
                    return;
                }
                if (!this.worldPreviewRoot?.isValid) {
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
                // 初始縮放極小，tween pop-in 會動畫至 block.scale（見下方）
                node.setScale(0.01, 0.01, 0.01);

                // 建立 Quad Mesh
                const mr = node.addComponent(MeshRenderer);
                mr.mesh = utils.MeshUtils.createMesh(primitives.quad());

                // 建立材質
                // 注意：builtin-unlit 需要 defines: { USE_TEXTURE: true } 才會取樣 mainTexture
                // 否則 shader 只會輸出 mainColor（純白），這是之前「白紙」的根因。
                const mat = new Material();
                if (block.blendMode === 'additive') {
                    mat.initialize({
                        effectName: 'builtin-unlit',
                        defines: { USE_TEXTURE: true },
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
                        defines: { USE_TEXTURE: true },
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

                // Quad 模式下也為 flipbook 貼圖啟用 UV 序列幀動畫
                // 讓 _sheet / _flipbook 類貼圖在靜態 Quad 預覽時就能看到動態序列
                const flipbookGrid = this.parseFlipbookGrid(block.texPath);
                if (flipbookGrid) {
                    this.startFlipbookAnimation(mat, flipbookGrid.cols, flipbookGrid.rows);
                }

                // tween pop-in：從幾乎零 → block.scale（backOut 帶輕微彈性）
                // Unity 對照：DOTween.To(() => t.localScale, x => t.localScale = x, Vector3.one * s, 0.25f).SetEase(Ease.OutBack)
                const s = block.scale;
                tween(node)
                    .to(0.25, { scale: new Vec3(s, s, s) }, { easing: 'backOut' })
                    .start();

                // 通報 MemoryManager 記帳→ 相當於 Unity Addressables handle.Completed 事件追蹤
                services().memory.notifyLoaded(block.texPath, 'vfx_core', 'Texture2D');

                resolve({ node, texture, blockPath: block.texPath });
            });
        });
    }

    private async createParticlePrefabPreview(block: VfxBlockDef, stackIndex: number): Promise<PreviewEntry | null> {
        console.log(`[VfxComposerTool] createParticlePrefabPreview: ${block.id}, prefabPath=${block.prefabPath ?? 'none'}`);
        // 狀態特效直接使用 BuffGainEffectPool（與戰鬥場景完全相同的完整動畫）
        // Unity 對照：相當於直接呼叫 RuntimeSystem.buffGainPool.play(worldPos)
        if (STATUS_BUFF_POOL_CONFIGS[block.id]) {
            return this.playBuffStatusViaPool(block, stackIndex);
        }
        const prefab = await this.resolveParticlePrefab(block);
        if (!prefab) {
            // texPath 積木（無 prefab）→ 建立動畫版 Quad 預覽（flipbook 序列幀 or 脈衝縮放）
            if (block.texPath) {
                console.log(`[VfxComposerTool] Prefab 解析失敗: ${block.id}，改用動畫 Quad 預覽`);
                return this.createTextureAnimatedPreview(block, stackIndex);
            }
            console.warn(`[VfxComposerTool] Prefab 解析失敗且無 texPath: ${block.id}，無法預覽`);
            this.updateStatus(`無可用資源：${block.label}`);
            return null;
        }

        const node = instantiate(prefab);
        node.name = `VfxPrefab_${block.id}`;
        node.parent = this.worldPreviewRoot;
        node.layer = Layers.Enum.DEFAULT;
    node.setPosition(0, stackIndex * 0.01, 0);

        // ArtProject 3D 粒子 prefab 自帶完整尺寸，使用 block.scale（預設 1.0）；
        // 舊有 buff prefab 維持原本的縮小比例。
        const s = block.prefabPath ? block.scale : PARTICLE_PREVIEW_ROOT_SCALE;
        node.setScale(s, s, s);
        this.applyLayerRecursively(node);

        const controller = node.getComponent(BuffEffectPrefabController);
        controller?.ensureStructure();

        // BuffEffectPrefabController 管理的 buff prefab 要補上貫圈/圖示 Quad，
        // 否則只有粒子沒有視覺元件（白煙問題的根因）。
        // Unity 對照：手動填充 Prefab 的 sub-component 視覺資料。
        if (controller && block.texPath) {
            await this.decorateBuffPrefab(controller, block);
        }

        // ArtProject prefab 可能包含 Animation（如 star、commonLight 是 Mesh+Animation 型特效）
        // 參考 ArtProject chooseUI.ts：先播放 Animation，再處理 ParticleSystem
        const anim = node.getComponent(Animation);
        if (anim) {
            console.log(`[VfxComposerTool] prefab ${block.id} 包含 Animation，播放中`);
            anim.play();
        }

        const systems = node.getComponentsInChildren(ParticleSystem);
        console.log(`[VfxComposerTool] prefab ${block.id} 實例化完成，ParticleSystem 數量=${systems.length}, hasAnimation=${!!anim}`);
        if (systems.length === 0 && !anim) {
            node.destroy();
            this.updateStatus(`Particle Prefab 無粒子系統也無動畫：${block.label}，改用 Quad 預覽`);
            return this.createWorldQuad(block, stackIndex);
        }

        // prefabPath（含 Unity 轉換 compound）應保留原 prefab 內的 loop 設定，
        // 避免工具預覽強制覆寫後和實際執行效果不一致。
        // 舊有 buff prefab 仍維持工具覆寫流程。
        const preservePrefabLoop = !!block.prefabPath;
        if (!preservePrefabLoop) {
            this.applyParticlePreviewOverrides(systems);
        }
        systems.forEach(ps => {
            const authoredLoop = ps.loop;
            ps.stop();
            ps.clear();
            ps.playOnAwake = false;
            ps.loop = preservePrefabLoop ? authoredLoop : false;
            ps.enabled = true;
            ps.play();
        });

        return { node };
    }

    /**
     * 為 buff prefab 的 RingRoot / IconRoot 填充貼圖 Quad，
     * 使 BuffEffectPrefabController 管理的 prefab 顯示正確的法陣/圖示視覺。
     * 沒有這步驟的話，prefab 只有粒子噴發（白煙）而沒有法陣圖案。
     *
     * Unity 對照：相當於 BuffGainEffectPool.buildSlot() 中 makeQuad 的簡化版。
     */
    private async decorateBuffPrefab(controller: BuffEffectPrefabController, block: VfxBlockDef): Promise<void> {
        const texture = await this.loadVfxTexture(block.texPath);
        if (!texture) return;
        texture.addRef();

        const isRing = block.id.startsWith('ring_');
        // ring → 放入 RingRoot（平躺法陣），icon → 放入 IconRoot（面向鏡頭圖示）
        const targetRoot = isRing ? controller.ringRoot : controller.iconRoot;
        if (!targetRoot?.isValid) return;

        const quadNode = new Node(`BuffQuad_${block.id}`);
        quadNode.layer = Layers.Enum.DEFAULT;
        targetRoot.addChild(quadNode);

        const mr = quadNode.addComponent(MeshRenderer);
        mr.mesh = utils.MeshUtils.createMesh(primitives.quad());

        const mat = new Material();
        mat.initialize({
            effectName: 'builtin-unlit',
            defines: { USE_TEXTURE: true },
            states: {
                blendState: {
                    targets: [{
                        blend:    true,
                        blendSrc: gfx.BlendFactor.ONE,
                        blendDst: gfx.BlendFactor.ONE,
                        blendSrcAlpha: gfx.BlendFactor.ONE,
                        blendDstAlpha: gfx.BlendFactor.ZERO,
                    }],
                },
                depthStencilState: { depthTest: false, depthWrite: false },
            },
        });
        mat.setProperty('mainTexture', texture);
        mat.setProperty('mainColor', new Color(255, 255, 255, 220));
        setMaterialSafe(mr, mat, 0);

        // 法陣尺寸放大，圖示維持小尺寸
        const scale = isRing ? 0.7 : 0.35;
        quadNode.setScale(scale, scale, scale);
        console.log(`[VfxComposerTool] decorateBuffPrefab: ${block.id} → ${isRing ? 'RingRoot' : 'IconRoot'}, texPath=${block.texPath}`);
    }

    /**
     * 使用 BuffGainEffectPool 播放狀態 Buff 特效（與戰鬥場景完全相同的完整動畫序列）。
     * 快取策略：pool 在跨預覽間保持初始化狀態，避免重複執行 EffectAsset + 貼圖載入。
     * Unity 對照：相當於把 RuntimeSystem 的某個 pool 參考暴露給工具用，而不重建它。
     */
    private async playBuffStatusViaPool(block: VfxBlockDef, _stackIndex: number): Promise<PreviewEntry | null> {
        const config = STATUS_BUFF_POOL_CONFIGS[block.id];
        if (!config) return null;

        const cached = this.buffPoolCache.get(block.id);
        let poolNode: Node;
        let pool: BuffGainEffectPool;

        if (cached?.node?.isValid) {
            poolNode = cached.node;
            pool    = cached.pool;
            console.log(`[VfxComposerTool] BuffGainEffectPool 快取命中: ${block.id}`);
        } else {
            poolNode = new Node(`BuffPool_${block.id}`);
            poolNode.layer = Layers.Enum.DEFAULT;
            poolNode.parent = this.worldPreviewRoot;
            pool = poolNode.addComponent(BuffGainEffectPool);
            console.log(`[VfxComposerTool] BuffGainEffectPool 初始化中: ${block.id}`);
            try {
                await pool.initialize(config);
            } catch (e) {
                console.error(`[VfxComposerTool] BuffGainEffectPool 初始化失敗: ${block.id}`, e);
                poolNode.destroy();
                return null;
            }
            this.buffPoolCache.set(block.id, { node: poolNode, pool });
            console.log(`[VfxComposerTool] BuffGainEffectPool 初始化完成: ${block.id}`);
        }

        this.refreshPreviewAnchor();
        pool.play(this.previewAnchor);
        console.log(`[VfxComposerTool] BuffGainEffectPool.play at ${JSON.stringify(this.previewAnchor)}: ${block.id}`);

        // 回傳 dummy marker 讓 fireComposition 記帳（pool 自管理動畫生命週期）
        const marker = new Node(`BuffPoolMarker_${block.id}`);
        marker.parent = this.worldPreviewRoot;
        return { node: marker };
    }

    // ─── Panel toggle ─────────────────────────────────────────────────────────
    private togglePanel() {
        this.panelVisible = !this.panelVisible;
        this.panel.active = this.panelVisible;
        // 確保面板在最頂層，避免被戰鬥紀錄等 UI 遮擋（Unity 對照：Canvas.sortingOrder）
        if (this.panelVisible && this.panel.parent) {
            this.panel.setSiblingIndex(this.panel.parent.children.length - 1);
        }
        console.log(`[VfxComposerTool] togglePanel: ${this.panelVisible ? '開啟' : '關閉'}`);
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

        // 使用棋盤左下角第一格（lane=0, depth=0）作為預覽錨點。
        // 2.5D 視角下此格離鏡頭最近、顯示面積最大，且位於畫面左側不被右側面板遮擋。
        // Unity 對照：把預覽 GameObject 放在最靠近玩家攝影機的棋盤格上。
        const cellPos = board.getCellWorldPosition(0, 0, PREVIEW_POS.y);
        this.previewAnchor = cellPos.clone();
        this.updateTitle('⚙ 特效積木組合器  [左下格 最大]');
    }

    // 從 vfx_core bundle 正確載入 Texture2D
    // Cocos Creator 3.x bundle.load(path, Texture2D) 需用 path+'/texture' sub-asset 後綴；
    // 若失敗則 fallback 以 ImageAsset 載入再包成 Texture2D（同 BuffGainEffectPool 後備策略）。
    private loadVfxTexture(texPath: string): Promise<Texture2D | null> {
        if (!this.vfxBundle) return Promise.resolve(null);
        return new Promise(resolve => {
            this.vfxBundle!.load(texPath + '/texture', Texture2D, (err, tex) => {
                if (!err && tex) { resolve(tex); return; }
                this.vfxBundle!.load(texPath, ImageAsset, (err2, img) => {
                    if (err2 || !img) {
                        console.warn(`[VfxComposerTool] 貼圖載入失敗 (${texPath}):`, err2?.message ?? err?.message);
                        resolve(null);
                        return;
                    }
                    const fallbackTex = new Texture2D();
                    fallbackTex.image = img;
                    resolve(fallbackTex);
                });
            });
        });
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
        console.log(`[VfxComposerTool] setPreviewMode: ${mode === VfxPreviewMode.Quad ? 'Quad' : 'ParticlePrefab'}`);
        this.currentPreviewMode = mode;
        this.updateModeButtonVisuals();
        this.refreshCompLabel();
        this.updateStatus(mode === VfxPreviewMode.Quad ? '已切換到 Quad 預覽' : '已切換到 Particle Prefab 預覽');
        if (this.autoPreviewOnSelect && this.composition.length > 0) {
            void this.fireComposition();
        }
    }

    /**
     * 根據當前選中積木的類型，更新 Quad / Particle 模式按鈕的亮滅狀態。
     * - 積木有 texPath（平面特效）→ Quad 亮、Particle 暗
     * - 積木有 prefabPath（3D 粒子）→ Particle 亮、Quad 暗
     * - 兩者皆有或皆無 → 依 currentPreviewMode 決定亮滅
     */
    private updateModeButtonVisuals() {
        if (!this.quadModeBtn?.isValid || !this.particleModeBtn?.isValid) return;
        const block = this.composition[0] ?? null;
        const hasQuad = !!block?.texPath;
        const hasParticle = !!block?.prefabPath || (!!block && this.hasParticlePrefabBinding(block));

        // 決定各按鈕是否可用
        let quadActive: boolean;
        let particleActive: boolean;
        if (block && hasQuad && !hasParticle) {
            quadActive = true;
            particleActive = false;
        } else if (block && hasParticle && !hasQuad) {
            quadActive = false;
            particleActive = true;
        } else {
            // 兩者皆有或沒有選中積木 → 依當前模式
            quadActive = this.currentPreviewMode === VfxPreviewMode.Quad;
            particleActive = this.currentPreviewMode === VfxPreviewMode.ParticlePrefab;
        }

        this.redrawModeBtn(this.quadModeBtn, quadActive,
            new Color(54, 118, 220, 255), new Color(30, 40, 60, 180));
        this.redrawModeBtn(this.particleModeBtn, particleActive,
            new Color(148, 88, 220, 255), new Color(45, 30, 60, 180));
    }

    private redrawModeBtn(btn: Node, active: boolean, activeColor: Color, dimColor: Color) {
        const g = btn.getComponent(Graphics);
        if (!g) return;
        g.clear();
        const ut = btn.getComponent(UITransform)!;
        const w = ut.contentSize.width;
        const h = ut.contentSize.height;
        g.fillColor = active ? activeColor : dimColor;
        g.roundRect(-w / 2, -h / 2, w, h, 6);
        g.fill();
        // 文字顏色
        const label = btn.getComponentInChildren(Label);
        if (label) {
            label.color = active ? Color.WHITE : new Color(120, 120, 140, 180);
        }
    }

    private hasParticlePrefabBinding(block: VfxBlockDef): boolean {
        return this.particlePrefabBindings.some(binding => binding.blockId === block.id && !!binding.prefab)
            || !!DEFAULT_PARTICLE_PREFAB_PATHS[block.id]
            || !!block.prefabPath;
    }

    /** 判斷積木是否可播放：有貼圖（Quad）或有 Prefab（Particle）即可 */
    private isBlockPlayable(block: VfxBlockDef): boolean {
        return !!block.texPath || !!block.prefabPath || this.hasParticlePrefabBinding(block);
    }

    private async resolveParticlePrefab(block: VfxBlockDef): Promise<Prefab | null> {
        console.log(`[VfxComposerTool] resolveParticlePrefab: ${block.id}, prefabPath=${block.prefabPath ?? 'none'}, vfxBundle=${!!this.vfxBundle}`);
        // 1. Inspector 綁定優先
        const bound = this.particlePrefabBindings.find(binding => binding.blockId === block.id && binding.prefab);
        if (bound?.prefab) {
            return bound.prefab;
        }

        // 2. Registry 中的 prefabPath → 從 vfx_core bundle 載入（ArtProject 3D 粒子特效）
        if (block.prefabPath && this.vfxBundle) {
            if (this.resourcePrefabCache.has(block.prefabPath)) {
                return this.resourcePrefabCache.get(block.prefabPath) ?? null;
            }
            return new Promise(resolve => {
                this.vfxBundle!.load(block.prefabPath!, Prefab, (err, prefab) => {
                    if (err || !prefab) {
                        console.warn(`[VfxComposerTool] vfx_core prefab 載入失敗 (${block.prefabPath}):`, err?.message);
                        this.resourcePrefabCache.set(block.prefabPath!, null);
                        resolve(null);
                        return;
                    }
                    this.resourcePrefabCache.set(block.prefabPath!, prefab);
                    resolve(prefab);
                });
            });
        }

        // 3. 舊有 DEFAULT_PARTICLE_PREFAB_PATHS → 從 resources bundle 載入
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
        // prefabPath 積木沒有 texPath，跳過貼圖縮圖載入
        if (!block.texPath || !this.vfxBundle) {
            return;
        }

        this.loadVfxTexture(block.texPath).then(texture => {
            if (!texture || !sprite.node?.isValid) {
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
        const playMode = activeBlock.prefabPath ? '🎆3D粒子' : activeBlock.texPath ? '🖼️平面' : this.hasParticlePrefabBinding(activeBlock) ? '🎆Prefab' : '⛔無資源';
        const playable = this.isBlockPlayable(activeBlock);
        this.selectedMetaLabel.string = `ID: ${activeBlock.id}\n分類: ${activeBlock.category}\n${activeBlock.space.toUpperCase()} / ${activeBlock.blendMode}\n模式: ${playMode} ${playable ? '✅可播放' : '❌不可播'}\nPrefab: ${prefabText} / ${audioText}`;
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

    private mkModeButton(parent: Node, text: string, color: Color, x: number, y: number, cb: () => void): Node {
        const btn = this.mkNode(`Mode_${text}`, parent, 260, 58);
        btn.setPosition(x, y);
        this.drawRect(btn, 260, 58, color, 6);
        this.mkLabel(btn, text, 24, Color.WHITE);
        this.mkButton(btn, cb);
        return btn;
    }

    private mkSearchBox(parent: Node, y: number) {
        const box = this.mkNode('SearchBox', parent, PANEL_W - 18, 54);
        box.setPosition(0, y);
        // 背景獨立子節點：Graphics 與 EditBox 不可在同一節點
        // EditBox.onEnable 內部會呼叫 _ensureBackgroundSprite 嘗試加 cc.Sprite，
        // 而 cc.Sprite 和 cc.Graphics 同屬 Renderer 衍生類，Cocos 禁止共存。
        const bg = this.mkNode('SearchBoxBg', box, PANEL_W - 18, 54);
        this.drawRect(bg, PANEL_W - 18, 54, new Color(20, 24, 42, 240), 6);

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

    // ─── Animated Quad preview（Particle Prefab 模式，無 prefab 的 texPath 積木）────────

    /**
     * 為 texPath 積木在 Particle Prefab 模式下建立帶動畫的 Quad 預覽：
     *   - 偵測到 _sheet / _flipbook 貼圖 → UV 序列幀動畫（flipbook 播放）
     *   - 其他貼圖 → 縮放脈衝動畫（讓靜態光暈/刀光/衝擊類有「呼吸感」）
     *
     * Unity 對照：相當於 Texture Sheet Animation + Size over Lifetime 的簡化動態呈現，
     *            讓每張貼圖都「動起來」而不只是靜態白板。
     */
    private async createTextureAnimatedPreview(block: VfxBlockDef, stackIndex: number): Promise<PreviewEntry | null> {
        if (!this.vfxBundle || !block.texPath) return null;

        const texture = await this.loadVfxTexture(block.texPath);
        if (!texture) {
            console.warn(`[VfxComposerTool] createTextureAnimatedPreview: 貼圖載入失敗 (${block.id})`);
            return null;
        }
        if (!this.worldPreviewRoot?.isValid) { return null; }
        texture.addRef();

        const node = new Node(`VfxAnimQuad_${block.id}`);
        node.parent = this.worldPreviewRoot;
        node.layer = Layers.Enum.DEFAULT;
        node.setPosition(0, stackIndex * 0.005, 0);
        node.eulerAngles = new Vec3(-90, 0, 0);
        // 初始縮放極小，tween pop-in 會動畫至 block.scale
        node.setScale(0.01, 0.01, 0.01);

        const mr = node.addComponent(MeshRenderer);
        mr.mesh = utils.MeshUtils.createMesh(primitives.quad());

        const mat = new Material();
        if (block.blendMode === 'additive') {
            mat.initialize({
                effectName: 'builtin-unlit',
                defines: { USE_TEXTURE: true },
                states: {
                    blendState: {
                        targets: [{ blend: true, blendSrc: gfx.BlendFactor.ONE, blendDst: gfx.BlendFactor.ONE,
                            blendSrcAlpha: gfx.BlendFactor.ONE, blendDstAlpha: gfx.BlendFactor.ZERO }],
                    },
                    depthStencilState: { depthTest: false, depthWrite: false },
                },
            });
        } else {
            mat.initialize({
                effectName: 'builtin-unlit',
                defines: { USE_TEXTURE: true },
                states: {
                    blendState: {
                        targets: [{ blend: true, blendSrc: gfx.BlendFactor.SRC_ALPHA,
                            blendDst: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA }],
                    },
                    depthStencilState: { depthTest: false, depthWrite: false },
                },
            });
        }
        mat.setProperty('mainTexture', texture);
        mat.setProperty('mainColor', new Color(255, 255, 255, 255));
        setMaterialSafe(mr, mat, 0);

        // 動畫選擇：flipbook 序列幀 or 重複脈衝縮放（均先做彈性 pop-in）
        // Unity 對照：backOut easing = Unity Animator 的 BounceOut curve；repeatForever = DOTween.SetLoops(-1)
        const grid = this.parseFlipbookGrid(block.texPath);
        if (grid) {
            this.startFlipbookAnimation(mat, grid.cols, grid.rows);
        }
        const s = block.scale;
        tween(node)
            .to(0.25, { scale: new Vec3(s * 1.15, s * 1.15, s * 1.15) }, { easing: 'backOut' })
            .to(0.12, { scale: new Vec3(s, s, s) }, { easing: 'sineOut' })
            .call(() => {
                // 非 flipbook 貼圖：pop-in 結束後加上重複緩縮脈衝，讓靜態貼圖保持視覺動感
                if (!grid && node?.isValid) {
                    tween(node)
                        .to(0.7, { scale: new Vec3(s * 1.12, s * 1.12, s * 1.12) }, { easing: 'sineInOut' })
                        .to(0.7, { scale: new Vec3(s * 0.9, s * 0.9, s * 0.9) }, { easing: 'sineInOut' })
                        .repeatForever()
                        .start();
                }
            })
            .start();

        services().memory.notifyLoaded(block.texPath, 'vfx_core', 'Texture2D');
        console.log(`[VfxComposerTool] createTextureAnimatedPreview: ${block.id}, flipbook=${JSON.stringify(grid)}`);
        return { node, texture, blockPath: block.texPath };
    }

    /**
     * 解析貼圖路徑中的 flipbook 網格大小。
     * 偵測規則（Unity 對照：Texture Sheet Animation 的 Tiles 參數）：
     *   tex_fire_particles_sheet4  → 4×4 (16 frames)
     *   ex_smoke_flipbook_4x4      → 4×4 (16 frames)
     *   tex_lightning_purple_sheet → 預設 4×4 (無數字時假設 4×4)
     */
    private parseFlipbookGrid(texPath: string): { cols: number; rows: number } | null {
        const numMatch = texPath.match(/_sheet(\d+)/i);
        if (numMatch) {
            const n = parseInt(numMatch[1]);
            return { cols: n, rows: n };
        }
        const dimMatch = texPath.match(/_flipbook_(\d+)x(\d+)/i);
        if (dimMatch) {
            return { cols: parseInt(dimMatch[1]), rows: parseInt(dimMatch[2]) };
        }
        if (texPath.includes('_sheet') || texPath.includes('_flipbook')) {
            return { cols: 4, rows: 4 };
        }
        return null;
    }

    /**
     * flipbook UV 動畫：每 1/fps 秒更新材質的 tilingOffset，實現序列幀循環播放。
     * Unity 對照：Particle System → Texture Sheet Animation 模組（WholeSheet 模式）。
     * builtin-unlit 的 tilingOffset (Vec4) = (scaleU, scaleV, offsetU, offsetV)
     * 每幀：offsetU = col / cols, offsetV = row / rows
     */
    private startFlipbookAnimation(mat: Material, cols: number, rows: number) {
        const total = cols * rows;
        const tileW = 1 / cols;
        const tileH = 1 / rows;
        let frame = 0;
        // 先設定第 0 幀，後續透過 schedule 更新
        mat.setProperty('tilingOffset', new Vec4(tileW, tileH, 0, 0));
        this.schedule(() => {
            frame = (frame + 1) % total;
            const col = frame % cols;
            const row = Math.floor(frame / cols);
            mat.setProperty('tilingOffset', new Vec4(tileW, tileH, col * tileW, row * tileH));
        }, 1 / 12, 999999, 0);
    }

    /**
     * 縮放脈衝動畫：模擬粒子「呼吸感」，讓靜態貼圖顯得有生命力。
     * Unity 對照：Size over Lifetime 搭配 sin curve，產生縮放來回的視覺節奏。
     * 振幅 ±15%，週期 1.4 秒，以不搶眼為前提。
     */
    private startPulseAnimation(node: Node, baseScale: number) {
        let elapsed = 0;
        this.schedule(() => {
            if (!node?.isValid) return;
            elapsed += 1 / 30;
            // sin 波：0.85 ~ 1.15 倍率，週期 1.4 秒
            const s = baseScale * (1 + 0.15 * Math.sin(elapsed * Math.PI * 2 / 1.4));
            node.setScale(s, s, s);
        }, 1 / 30, 999999, 0);
    }
}
