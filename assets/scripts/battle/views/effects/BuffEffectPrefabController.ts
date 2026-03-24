import { _decorator, Component, instantiate, Node, ParticleSystem } from "cc";

const { ccclass, property, executeInEditMode } = _decorator;

@ccclass("BuffEffectPrefabController")
@executeInEditMode(true)
export class BuffEffectPrefabController extends Component {
    @property({ type: Node, tooltip: "法陣層根節點" })
    public ringRoot: Node | null = null;

    @property({ type: Node, tooltip: "圖示層根節點" })
    public iconRoot: Node | null = null;

    @property({ type: Node, tooltip: "主粒子層根節點" })
    public sparkPS: Node | null = null;

    @property({ type: Node, tooltip: "輔助粒子層根節點" })
    public accentPS: Node | null = null;

    onLoad(): void {
        this.ensureStructure();
    }

    public ensureStructure(): void {
        this.sparkPS = this.resolveSparkRoot();
        this.ringRoot = this.resolveNamedChild("RingRoot");
        this.iconRoot = this.resolveNamedChild("IconRoot");
        this.accentPS = this.resolveNamedChild("AccentPS");

        this.normalizeNode(this.ringRoot, 0, 0.02, 0, -90, 0, 0);
        this.normalizeNode(this.iconRoot, 0, 0.11, 0, 0, 0, 0);
        this.normalizeNode(this.sparkPS, 0, 0.06, 0, 0, 0, 0);
        this.normalizeNode(this.accentPS, 0, 0.1, 0, 0, 0, 0);
        this.bootstrapAccentEmitter();
        this.disableLegacyRootParticle();
    }

    private resolveSparkRoot(): Node {
        const explicit = this.node.getChildByName("SparkPS") ?? this.node.getChildByName("Particle-001");
        if (explicit) {
            explicit.name = "SparkPS";
            return explicit;
        }

        const particleChild = this.node.children.find(child => child.getComponent(ParticleSystem));
        if (particleChild) {
            particleChild.name = "SparkPS";
            return particleChild;
        }

        return this.resolveNamedChild("SparkPS");
    }

    private resolveNamedChild(name: string): Node {
        const existing = this.node.getChildByName(name);
        if (existing) {
            return existing;
        }

        const child = new Node(name);
        child.layer = this.node.layer;
        this.node.addChild(child);
        return child;
    }

    private normalizeNode(node: Node | null, px: number, py: number, pz: number, rx: number, ry: number, rz: number): void {
        if (!node) {
            return;
        }

        node.layer = this.node.layer;
        node.setPosition(px, py, pz);
        node.setRotationFromEuler(rx, ry, rz);
        node.setScale(1, 1, 1);
    }

    private bootstrapAccentEmitter(): void {
        if (!this.sparkPS || !this.accentPS) {
            return;
        }
        if (this.accentPS.getComponentsInChildren(ParticleSystem).length > 0) {
            return;
        }

        const template = this.findEmitterTemplate(this.sparkPS);
        if (!template) {
            return;
        }

        const clone = instantiate(template);
        clone.name = "AccentEmitter";
        clone.layer = this.accentPS.layer;
        clone.setPosition(0, 0, 0);
        clone.setRotationFromEuler(0, 0, 0);
        clone.setScale(1, 1, 1);
        this.accentPS.addChild(clone);
    }

    private findEmitterTemplate(root: Node): Node | null {
        if (root.getComponent(ParticleSystem)) {
            return root;
        }

        return root.children.find(child => child.getComponent(ParticleSystem)) ?? null;
    }

    private disableLegacyRootParticle(): void {
        const legacy = this.node.getComponent(ParticleSystem);
        if (!legacy) {
            return;
        }

        legacy.stop();
        legacy.clear();
        legacy.playOnAwake = false;
        legacy.loop = false;
        legacy.enabled = false;
    }
}