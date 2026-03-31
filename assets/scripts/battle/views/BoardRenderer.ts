// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, Node, Vec3, Vec4, MeshRenderer, primitives, utils, Material, Color, Layers, gfx, tween, resources, EffectAsset } from 'cc';
import { Faction, GAME_CONFIG } from '../../core/config/Constants';
import { BattleState } from '../models/BattleState';

const { ccclass, property } = _decorator;

interface TileBuffFxView {
    node: Node;
    material: Material;
    frameNode: Node | null;
    frameMaterial: Material | null;
    rarity: "normal" | "rare";
    anim: {
        alpha: number;
        scale: number;
        frameAlpha: number;
        frameScale: number;
    };
}

interface CellView {
    root: Node;
    fillRenderer: MeshRenderer | null;
    borderEdgeRenderers: MeshRenderer[];
    borderMidRenderers: MeshRenderer[];
    borderInnerRenderers: MeshRenderer[];
}

@ccclass('BoardRenderer')
export class BoardRenderer extends Component {
    @property
    public cols: number = 5;

    @property
    public rows: number = 8;

    @property({ tooltip: '格子大小' })
    public cellSize: number = 1.0;

    @property({ tooltip: '格子間距' })
    public cellGap: number = 0.1;

    @property({ tooltip: '棋盤根節點 Y 軸旋轉（度）' })
    public boardYaw: number = 0;

    @property({ tooltip: '棋盤世界位置偏移 X' })
    public boardOffsetX: number = 0;

    @property({ tooltip: '棋盤世界位置偏移 Z' })
    public boardOffsetZ: number = 0;

    private boardRoot: Node | null = null;
    private cellNodes: Map<string, CellView> = new Map();
    private flashQuadMesh: any = null;  // 戰鬥擊中閃光用的 quad，在 onLoad 建立一次再充用
    private defaultFillMaterial: Material | null = null;
    private defaultBorderMaterial: Material | null = null;
    private defaultBorderMidMaterial: Material | null = null;
    private defaultBorderInnerMaterial: Material | null = null;
    private playerOccupiedFillMaterial: Material | null = null;
    private playerOccupiedBorderMaterial: Material | null = null;
    private playerOccupiedBorderMidMaterial: Material | null = null;
    private playerOccupiedBorderInnerMaterial: Material | null = null;
    private enemyOccupiedFillMaterial: Material | null = null;
    private enemyOccupiedBorderMaterial: Material | null = null;
    private enemyOccupiedBorderMidMaterial: Material | null = null;
    private enemyOccupiedBorderInnerMaterial: Material | null = null;
    private playerDeployHintFillMaterial: Material | null = null;
    private playerDeployHintBorderMaterial: Material | null = null;
    private playerDeployHintBorderMidMaterial: Material | null = null;
    private playerDeployHintBorderInnerMaterial: Material | null = null;
    private enemyDeployHintFillMaterial: Material | null = null;
    private enemyDeployHintBorderMaterial: Material | null = null;
    private enemyDeployHintBorderMidMaterial: Material | null = null;
    private enemyDeployHintBorderInnerMaterial: Material | null = null;
    private boardEffectAsset: EffectAsset | null = null;
    private isBoardEffectLoading: boolean = false;
    private deployHintFaction: Faction | null = Faction.Player;
    private readonly tileBuffFxViews: Map<string, TileBuffFxView> = new Map();

    onLoad() {
        // 確保此節點本身也在 DEFAULT layer，Camera 才照得到
        this.node.layer = Layers.Enum.DEFAULT;
        this.flashQuadMesh = utils.MeshUtils.createMesh(primitives.quad()); // 建立一次後重用
        this.loadBoardEffect();
        this.initMaterials();
        this.createBoard();
    }

    public rebuildBoard(): void {
        if (!this.defaultFillMaterial) {
            this.initMaterials();
        }
        this.createBoard();
    }

    private loadBoardEffect(): void {
        if (this.boardEffectAsset || this.isBoardEffectLoading) {
            return;
        }

        this.isBoardEffectLoading = true;
        resources.load('effects/board-jelly', EffectAsset, (err, effectAsset) => {
            this.isBoardEffectLoading = false;
            if (err || !effectAsset) {
                console.warn('[BoardRenderer] 棋盤玻璃 Shader 載入失敗，暫用 fallback 材質:', err?.message);
                return;
            }

            this.boardEffectAsset = effectAsset;
            this.initMaterials();
            this.createBoard();
            console.log('[BoardRenderer] 棋盤玻璃 Shader 載入成功 style=shader-jelly-v4');
        });
    }

    private initMaterials() {
        // 預設格子：全透明（不顯示顏色，諦變矩形 / 占領提示由專属 material 處理）
        this.defaultFillMaterial = this.createCellMaterial(
            new Color(0, 0, 0, 0),
            new Color(0, 0, 0, 0),
            new Color(0, 0, 0, 0),
            new Vec4(0, 0, 0, 0)
        );
        this.defaultBorderMaterial = this.defaultFillMaterial;
        this.defaultBorderMidMaterial = this.defaultFillMaterial;
        this.defaultBorderInnerMaterial = this.defaultFillMaterial;

        this.playerOccupiedFillMaterial = this.createCellMaterial(
            new Color(132, 242, 180, 60),
            new Color(150, 248, 190, 120),
            new Color(210, 255, 226, 80),
            new Vec4(0.08, 0.145, 0.17, 0.62)
        );
        this.playerOccupiedBorderMaterial = this.playerOccupiedFillMaterial;
        this.playerOccupiedBorderMidMaterial = this.playerOccupiedFillMaterial;
        this.playerOccupiedBorderInnerMaterial = this.playerOccupiedFillMaterial;

        this.enemyOccupiedFillMaterial = this.createCellMaterial(
            new Color(242, 180, 180, 60),
            new Color(248, 188, 188, 120),
            new Color(255, 230, 230, 80),
            new Vec4(0.08, 0.145, 0.17, 0.62)
        );
        this.enemyOccupiedBorderMaterial = this.enemyOccupiedFillMaterial;
        this.enemyOccupiedBorderMidMaterial = this.enemyOccupiedFillMaterial;
        this.enemyOccupiedBorderInnerMaterial = this.enemyOccupiedFillMaterial;

        this.playerDeployHintFillMaterial = this.createCellMaterial(
            new Color(140, 246, 170, 14),
            new Color(160, 252, 184, 110),
            new Color(210, 255, 222, 78),
            new Vec4(0.095, 0.16, 0.19, 0.62)
        );
        this.playerDeployHintBorderMaterial = this.playerDeployHintFillMaterial;
        this.playerDeployHintBorderMidMaterial = this.playerDeployHintFillMaterial;
        this.playerDeployHintBorderInnerMaterial = this.playerDeployHintFillMaterial;

        this.enemyDeployHintFillMaterial = this.createCellMaterial(
            new Color(244, 154, 154, 7),
            new Color(252, 166, 166, 58),
            new Color(255, 228, 228, 46),
            new Vec4(0.085, 0.15, 0.175, 0.62)
        );
        this.enemyDeployHintBorderMaterial = this.enemyDeployHintFillMaterial;
        this.enemyDeployHintBorderMidMaterial = this.enemyDeployHintFillMaterial;
        this.enemyDeployHintBorderInnerMaterial = this.enemyDeployHintFillMaterial;
    }

    private createCellMaterial(fillColor: Color, edgeColor: Color, highlightColor: Color, jellyParams: Vec4): Material {
        const material = new Material();

        if (this.boardEffectAsset) {
            material.initialize({
                effectAsset: this.boardEffectAsset,
                states: {
                    depthStencilState: { depthTest: true, depthWrite: false },
                    rasterizerState: { cullMode: gfx.CullMode.NONE }
                }
            });
            material.setProperty('fillColor', fillColor);
            material.setProperty('edgeColor', edgeColor);
            material.setProperty('highlightColor', highlightColor);
            material.setProperty('jellyParams', jellyParams);
            return material;
        }

        material.initialize({
            effectName: 'builtin-unlit',
            states: {
                blendState: { targets: [{ blend: true }] },
                depthStencilState: { depthTest: true, depthWrite: false },
                rasterizerState: { cullMode: gfx.CullMode.NONE }
            }
        });
        material.setProperty('mainColor', edgeColor);
        return material;
    }

    private applyCellStyle(cellView: CellView, fillMaterial: Material | null, borderMaterial: Material | null): void {
        if (cellView.fillRenderer) {
            cellView.fillRenderer.enabled = true;
            const activeMaterial = fillMaterial ?? borderMaterial ?? this.defaultFillMaterial;
            if (activeMaterial) {
                cellView.fillRenderer.setSharedMaterial(activeMaterial, 0);
            }
        }
    }

    public setDeployHintFaction(faction: Faction | null): void {
        this.deployHintFaction = faction;
    }

    public clearDeployHint(): void {
        this.deployHintFaction = null;
    }

    private createBoard() {
        this.tileBuffFxViews.forEach(view => view.node.destroy());
        this.tileBuffFxViews.clear();
        this.cellNodes.clear(); // 清除舊引用，避免記錄已錄destroy的節點

        if (this.boardRoot) {
            this.boardRoot.destroy();
        }

        this.boardRoot = new Node("BoardRoot");
        this.boardRoot.layer = Layers.Enum.DEFAULT;
        this.node.addChild(this.boardRoot);
        this.boardRoot.setPosition(new Vec3(this.boardOffsetX, 0, this.boardOffsetZ));
        this.boardRoot.setRotationFromEuler(new Vec3(0, this.boardYaw, 0));

        // 中心點偏移計算，讓整個棋盤置中
        const offsetX = (this.cols - 1) * (this.cellSize + this.cellGap) / 2;
        const offsetZ = (this.rows - 1) * (this.cellSize + this.cellGap) / 2;

        const quadMesh = utils.MeshUtils.createMesh(primitives.quad());
        const fillScale = Math.max(0.01, this.cellSize * 0.98);

        for (let x = 0; x < this.cols; x++) {
            for (let z = 0; z < this.rows; z++) {
            const cellNode = new Node(`Cell_${x}_${z}`);
                
                // 設定 3D 位置：X 為路徑 (lanes)，Z 為深度 (rows)。Y 保持 0 為地面
                const posX = x * (this.cellSize + this.cellGap) - offsetX;
                const posZ = z * (this.cellSize + this.cellGap) - offsetZ;
                cellNode.setPosition(new Vec3(posX, 0, posZ));
                
                // 網格平面的 quad 預設是朝上 (XY平面), 要在 3D 地面上需要旋轉向 X 軸 -90 度
                // 注意：縮放後再旋轉可以保持比例
                cellNode.setRotationFromEuler(new Vec3(-90, 0, 0));

                // DEFAULT layer 必須明確設定：UI Camera 照不到 DEFAULT，3D Camera 照得到
                cellNode.layer = Layers.Enum.DEFAULT;

                const fillNode = new Node('Fill');
                fillNode.layer = Layers.Enum.DEFAULT;
                fillNode.setPosition(new Vec3(0, 0, 0.001));
                fillNode.setScale(new Vec3(fillScale, fillScale, 1));
                const fillRenderer = fillNode.addComponent(MeshRenderer);
                fillRenderer.mesh = quadMesh;
                if (this.defaultFillMaterial) {
                    fillRenderer.setSharedMaterial(this.defaultFillMaterial, 0);
                }
                fillRenderer.enabled = true;
                cellNode.addChild(fillNode);

                this.boardRoot.addChild(cellNode);
                const key = `${x},${z}`;
                this.cellNodes.set(key, {
                    root: cellNode,
                    fillRenderer,
                    borderEdgeRenderers: [],
                    borderMidRenderers: [],
                    borderInnerRenderers: [],
                });
            }
        }

        console.log(
            `[BoardRenderer] 棋盤建立完成 size=${this.cols}x${this.rows} cell=${this.cellSize.toFixed(2)} style=shader-jelly-v4 effectLoaded=${this.boardEffectAsset ? 1 : 0}`
        );
    }

    public getBoardMetrics(): { width: number; depth: number; center: Vec3 } {
        const width = this.cols * this.cellSize + Math.max(0, this.cols - 1) * this.cellGap;
        const depth = this.rows * this.cellSize + Math.max(0, this.rows - 1) * this.cellGap;
        const center = (this.boardRoot?.worldPosition ?? this.node.worldPosition).clone();
        return { width, depth, center };
    }

    public getCellWorldPosition(lane: number, depth: number, yOffset = 0): Vec3 {
        const cellNode = this.cellNodes.get(`${lane},${depth}`);
        // 雙重 null guard：cellNode 可能未找到，root 節點可能已被銷毀
        if (!cellNode || !cellNode.root || !cellNode.root.isValid) {
            if (cellNode && (!cellNode.root || !cellNode.root.isValid)) {
                console.warn(`[BoardRenderer] getCellWorldPosition: 格 (${lane},${depth}) 的 root 節點無效或已銷毀`);
            }
            return new Vec3(this.node.worldPosition.x, this.node.worldPosition.y + yOffset, this.node.worldPosition.z);
        }
        const base = cellNode.root.worldPosition;
        return new Vec3(base.x, base.y + yOffset, base.z);
    }

    public getCellFromWorldPos(pos: Vec3): { lane: number; depth: number } | null {
        // 使用 totalSize（格子+縫隙）作為判定寬度，避免落在縫隙漏偵測
        const totalSize = this.cellSize + this.cellGap;
        let best: { key: string; dist: number } | null = null;
        for (const [key, cellView] of this.cellNodes.entries()) {
            // null guard：根節點可能在場景切換時被銷毀
            if (!cellView?.root || !cellView.root.isValid) {
                console.warn(`[BoardRenderer] getCellFromWorldPos: 格 ${key} 的 root 節點無效，跳過`);
                continue;
            }
            const dx = Math.abs(cellView.root.worldPosition.x - pos.x);
            const dz = Math.abs(cellView.root.worldPosition.z - pos.z);
            if (dx <= totalSize * 0.55 && dz <= totalSize * 0.55) {
                const dist = dx + dz;
                if (!best || dist < best.dist) best = { key, dist };
            }
        }
        if (!best) {
            return null;
        }
        const parts = best.key.split(',');
        return { lane: parseInt(parts[0], 10), depth: parseInt(parts[1], 10) };
    }

    public playCellImpact(lane: number, depth: number, tint = new Color(255, 220, 140, 200)): void {
        if (!this.boardRoot) return;

        const cellNode = this.cellNodes.get(`${lane},${depth}`);
        if (!cellNode) return;
        // null guard：root 節點可能已被銷毀（例如棋盤重建時）
        if (!cellNode.root || !cellNode.root.isValid) {
            console.warn(`[BoardRenderer] playCellImpact: 格 (${lane},${depth}) 的 root 節點無效，跳過特效`);
            return;
        }

        const flashNode = new Node(`Impact_${lane}_${depth}`);
        flashNode.layer = Layers.Enum.DEFAULT;
        flashNode.setPosition(new Vec3(cellNode.root.position.x, 0.035, cellNode.root.position.z));
        flashNode.setRotationFromEuler(new Vec3(-90, 0, 0));
        this.boardRoot.addChild(flashNode);

        const flashMaterial = new Material();
        flashMaterial.initialize({
            effectName: 'builtin-unlit',
            states: {
                blendState: { targets: [{ blend: true }] },
                depthStencilState: { depthTest: true, depthWrite: false },
                rasterizerState: { cullMode: gfx.CullMode.NONE }
            }
        });

        const mr = flashNode.addComponent(MeshRenderer);
        mr.mesh = this.flashQuadMesh;  // 重用已建立的 quad mesh
        mr.setSharedMaterial(flashMaterial, 0);

        const anim = { alpha: tint.a, scale: 0.72 };
        tween(anim)
            .to(0.22, { alpha: 0, scale: 1.35 }, {
                onUpdate: () => {
                    flashMaterial.setProperty('mainColor', new Color(tint.r, tint.g, tint.b, anim.alpha));
                    flashNode.setScale(new Vec3(this.cellSize * anim.scale, this.cellSize * anim.scale, 1));
                }
            })
            .call(() => flashNode.destroy())
            .start();
    }

    public playBuffConsumeBurst(lane: number, depth: number): void {
        this.playCellImpact(lane, depth, new Color(110, 255, 140, 220));
    }

    /**
     * 接收 BattleState 快照並更新畫面
     * 不負責邏輯判定，僅作為 View 層負責渲染。
     */
    public renderState(state: BattleState) {
        // 先將所有格子重置為預設狀態
        this.cellNodes.forEach((cellView) => {
            this.applyCellStyle(cellView, this.defaultFillMaterial, this.defaultBorderMaterial);
        });

        // 取出棋盤上有單位的格子並設置為高亮
        // state 的小兵
        state.units.forEach(unit => {
            if (unit.currentHp > 0) {
                const key = `${unit.lane},${unit.depth}`;
                const cellNode = this.cellNodes.get(key);
                if (cellNode) {
                    if (unit.faction === Faction.Player) {
                        // this.applyCellStyle(cellNode, this.playerOccupiedFillMaterial, this.playerOccupiedBorderMaterial);
                    } else {
                        // this.applyCellStyle(cellNode, this.enemyOccupiedFillMaterial, this.enemyOccupiedBorderMaterial);
                    }
                }
            }
        });

        // 玩家部署提示 (只在玩家回合顯示)
        if (this.deployHintFaction === Faction.Player) {
            const deployDepth = 0;
            for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
                const cell = state.getCell(lane, deployDepth);
                if (!cell || cell.occupantId) continue;

                const cellNode = this.cellNodes.get(`${lane},${deployDepth}`);
                if (!cellNode) continue;
                this.applyCellStyle(cellNode, this.playerDeployHintFillMaterial, this.playerDeployHintBorderMaterial);
            }
        }

        this.syncTileBuffFx(state);
    }

    private syncTileBuffFx(_state: BattleState): void {
        // 因需求變更，移除地板光暈特效，改由 UnitRenderer 的文字伸縮替代
        // 為了相容性保留空方法，確保呼叫正常
        return;
    }
}
