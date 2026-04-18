// @spec-source → 見 docs/cross-reference-index.md
// @deprecated UCUF M12 — UIPreviewShadowManager 已暫存於 _pending-delete/。
//   待所有面板由 UIPreviewBuilder 遷移至 CompositePanel 後，可確認無引用時刪除。
/**
 * UIPreviewShadowManager
 *
 * @deprecated 待所有面板遷移至 CompositePanel 後刪除（UCUF M12）
 *
 * 負責 shadow 與 noise overlay 層的創建、位置同步與生命週期管理：
 *   - shadow：從 skin manifest 取得陰影 spriteFrame，
 *             在 sibling 或獨立的 DetachedShadowLayer 節點放置陰影
 *   - noise：在 sibling 放置噪點疊圖節點
 *   - lateUpdate 同步：每幀追蹤 DetachedShadow 的位置，確保與目標節點對齊
 *
 * 為什麼需要 DetachedShadow？
 *   當父節點有 Layout 元件時，Layout 會重排所有子節點（siblingIndex），
 *   導致陰影節點被覆蓋或錯位。DetachedShadow 將陰影移到 Layout 之外的
 *   獨立圖層（__DetachedShadowLayer），再透過 lateUpdate 同步位置。
 *
 * Unity 對照：在 SortingGroup 外掛 Shadow Caster，或透過 Canvas 層計算位置
 */
import { Node, Sprite, UITransform, UIOpacity, Layout, Vec3 } from 'cc';
import { UISkinResolver } from './UISkinResolver';
import { UIPreviewStyleBuilder } from './UIPreviewStyleBuilder';
import { UIPreviewLayoutBuilder } from './UIPreviewLayoutBuilder';
import type { UILayoutNodeSpec } from './UISpecTypes';
import { UIPreviewDiagnostics } from '../UIPreviewDiagnostics';

/** DetachedShadow 的位置追蹤資料（對應 Unity 的 shadow binding） */
interface DetachedShadowBinding {
    target: Node;   // 被追蹤的原始節點
    shadow: Node;   // 陰影替身節點
    host: Node;     // 陰影所在的父容器（__DetachedShadowLayer）
    offsetY: number;
}

export class UIPreviewShadowManager {

    /** Design Token，用於 elevation 預設值（由 UIPreviewBuilder 設定） */
    tokens: any = {};

    private _detachedShadowBindings: DetachedShadowBinding[] = [];
    private _detachedShadowHost: Node | null = null;

    /**
     * @param skinResolver  Skin 解析器（共享自 UIPreviewBuilder）
     * @param styleBuilder  樣式套用器（用於 applyWidget、applySpriteSkin）
     * @param getRootNode   取得 UIPreviewBuilder 根節點的 callback
     */
    constructor(
        private readonly skinResolver: UISkinResolver,
        private readonly styleBuilder: UIPreviewStyleBuilder,
        private readonly layoutBuilder: UIPreviewLayoutBuilder,
        private readonly getRootNode: () => Node,
    ) {}

    // ─── 生命週期 ─────────────────────────────────────────────────────────────

    /**
     * 清除所有 detached shadow（每次 buildScreen 呼叫前執行）。
     * Unity 對照：Destroy 所有 shadow GameObject
     */
    clearDetachedShadows(): void {
        this._detachedShadowBindings = [];
        if (!this._detachedShadowHost?.isValid) {
            this._detachedShadowHost = null;
            return;
        }
        this._detachedShadowHost.destroy();
        this._detachedShadowHost = null;
    }

    /**
     * 每幀同步所有 DetachedShadow 的位置（於 lateUpdate 呼叫）。
     * Unity 對照：LateUpdate 中更新 Shadow RectTransform 位置
     */
    syncDetachedShadows(): void {
        if (this._detachedShadowBindings.length === 0) return;
        this._detachedShadowBindings = this._detachedShadowBindings.filter((binding) => {
            if (!binding.target?.isValid || !binding.shadow?.isValid || !binding.host?.isValid) {
                return false;
            }
            this._syncDetachedShadowBinding(binding);
            return true;
        });
    }

    // ─── 附加層 ───────────────────────────────────────────────────────────────

    /**
     * 為節點附加 shadow layer（若 skin manifest 有對應的 shadow slot）。
     * 套用型別限制：僅 container / panel / button / image 類型才掛陰影。
     */
    async attachShadowLayer(
        node: Node,
        spec: UILayoutNodeSpec,
        parent: Node,
        width: number,
        height: number,
    ): Promise<void> {
        if (!spec.skinSlot) return;
        if (!['container', 'panel', 'button', 'image'].includes(spec.type)) return;

        const shadowSlotId = this._resolveRelatedSlotId(spec.skinSlot, 'shadow');
        if (!shadowSlotId) return;

        const shadowSlot = this.skinResolver.getSlot(shadowSlotId);
        if (!shadowSlot || shadowSlot.kind !== 'sprite-frame') return;

        const frame = await this.skinResolver.getSpriteFrame(shadowSlotId);
        if (!frame) return;

        // 父節點有 Layout 時，需要放到獨立圖層避免被重排
        const usesDetachedHost = !!parent.getComponent(Layout);
        const shadowNode = new Node(`${spec.name}Shadow`);
        shadowNode.layer = node.layer;
        shadowNode.parent = usesDetachedHost ? this._ensureDetachedShadowHost() : parent;

        if (!usesDetachedHost) {
            shadowNode.setSiblingIndex(node.getSiblingIndex());
        }

        const transform = shadowNode.addComponent(UITransform);
        transform.setContentSize(width, height);

        if (spec.widget && !usesDetachedHost) {
            this.layoutBuilder.applyWidget(shadowNode, spec.widget);
        }

        const sprite = shadowNode.addComponent(Sprite);
        sprite.spriteFrame = frame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.styleBuilder.applySpriteSkin(sprite, shadowSlot.spriteType, shadowSlot.border);

        // 計算透明度（優先使用 slot 設定，否則從 tokens.elevation 取預設值）
        const elevation = this.tokens?.elevation?.shadowDefault ?? { offsetY: 4, opacity: 0.24 };
        const rawOffsetY = (shadowSlot as any).offsetY ?? elevation.offsetY ?? 4;
        const rawOpacity = (shadowSlot as any).opacity ?? elevation.opacity ?? 0.24;
        const opacityValue = rawOpacity <= 1 ? Math.round(rawOpacity * 255) : Math.round(rawOpacity);
        const opacity = shadowNode.getComponent(UIOpacity) || shadowNode.addComponent(UIOpacity);
        opacity.opacity = Math.max(0, Math.min(255, opacityValue));

        if (usesDetachedHost) {
            // 放入 DetachedShadowLayer，每幀由 syncDetachedShadows 追蹤位置
            this._detachedShadowBindings.push({
                target: node,
                shadow: shadowNode,
                host: shadowNode.parent,
                offsetY: rawOffsetY,
            });
            this._syncDetachedShadowBinding(
                this._detachedShadowBindings[this._detachedShadowBindings.length - 1],
            );
            return;
        }

        shadowNode.setPosition(node.position.x, node.position.y - rawOffsetY, node.position.z);
    }

    /**
     * 為節點附加 noise overlay（若 skin manifest 有對應的 noise slot）。
     * 噪點 overlay 放在 sibling 層，做成寬高 fill 的同尺寸遮罩。
     * 套用限制：panel / container / image 且沒有 Layout 或子節點時才附加。
     */
    async attachNoiseLayer(
        node: Node,
        spec: UILayoutNodeSpec,
        parent: Node,
        width: number,
        height: number,
    ): Promise<void> {
        if (!spec.skinSlot) return;
        if (!['container', 'panel', 'image'].includes(spec.type)) return;

        // 跳過：panel 有 Layout 或子節點時，噪點層視覺複雜度超出合理範圍
        if (spec.layout || spec.children?.length || parent.getComponent(Layout)) return;

        const noiseSlotId = this._resolveRelatedSlotId(spec.skinSlot, 'noise');
        if (!noiseSlotId) return;

        const noiseSlot = this.skinResolver.getSlot(noiseSlotId);
        if (!noiseSlot || noiseSlot.kind !== 'sprite-frame') return;

        const frame = await this.skinResolver.getSpriteFrame(noiseSlotId);
        if (!frame) return;

        const noiseNode = new Node(`${spec.name}Noise`);
        noiseNode.layer = node.layer;
        noiseNode.parent = parent;
        noiseNode.setSiblingIndex(node.getSiblingIndex() + 1);

        const transform = noiseNode.addComponent(UITransform);
        transform.setContentSize(width, height);

        if (spec.widget) {
            this.layoutBuilder.applyWidget(noiseNode, spec.widget);
        } else {
            noiseNode.setPosition(node.position);
        }

        const sprite = noiseNode.addComponent(Sprite);
        sprite.spriteFrame = frame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.styleBuilder.applySpriteSkin(sprite, noiseSlot.spriteType, noiseSlot.border);

        const rawOpacity = (noiseSlot as any).opacity ?? 0.12;
        const opacityValue = rawOpacity <= 1 ? Math.round(rawOpacity * 255) : Math.round(rawOpacity);
        const opacity = noiseNode.getComponent(UIOpacity) || noiseNode.addComponent(UIOpacity);
        opacity.opacity = Math.max(0, Math.min(255, opacityValue));

        // 僅支援 alpha 混合；其他模式給出警告並回退
        const requestedBlend = (noiseSlot as any).blendMode ?? 'alpha';
        if (requestedBlend !== 'alpha') {
            UIPreviewDiagnostics.noiseBlendModeWarning(requestedBlend, noiseSlotId);
        }
    }

    // ─── 私有工具 ─────────────────────────────────────────────────────────────

    /**
     * 從 skinSlot id 解析對應的 shadow / noise slot id。
     * 採用多層候選策略：完整路徑 → 逐層縮短 → 底線後綴變體
     */
    private _resolveRelatedSlotId(skinSlot: string, suffix: 'shadow' | 'noise'): string | null {
        const candidates: string[] = [];
        const parts = skinSlot.split('.');

        // 完整路徑加後綴
        candidates.push(`${skinSlot}.${suffix}`);
        // 逐層縮短路徑
        for (let i = parts.length - 1; i >= 1; i--) {
            candidates.push(`${parts.slice(0, i).join('.')}.${suffix}`);
        }
        // 底線後綴的變體（例如 bg_frame → bg.shadow）
        const lastPart = parts[parts.length - 1];
        const underscoredSuffix = /^(.*)_(bg|frame|fill)$/.exec(lastPart);
        if (underscoredSuffix) {
            candidates.push([...parts.slice(0, -1), underscoredSuffix[1], suffix].join('.'));
        }

        for (const candidate of candidates) {
            if (this.skinResolver.getSlot(candidate)) return candidate;
        }
        return null;
    }

    /** 取得（或創建）DetachedShadowLayer 根節點 */
    private _ensureDetachedShadowHost(): Node {
        if (this._detachedShadowHost?.isValid) return this._detachedShadowHost;

        const rootNode = this.getRootNode();
        const host = new Node('__DetachedShadowLayer');
        host.layer = rootNode.layer;
        host.parent = rootNode;
        host.setSiblingIndex(0); // 置於最底層

        const transform = host.getComponent(UITransform) || host.addComponent(UITransform);
        const rootTransform = rootNode.getComponent(UITransform);
        if (rootTransform) {
            transform.setContentSize(rootTransform.width, rootTransform.height);
        }

        this._detachedShadowHost = host;
        return host;
    }

    /** 同步單個 DetachedShadow 的位置與尺寸到目標節點 */
    private _syncDetachedShadowBinding(binding: DetachedShadowBinding): void {
        const targetTransform = binding.target.getComponent(UITransform);
        const hostTransform   = binding.host.getComponent(UITransform);
        const shadowTransform = binding.shadow.getComponent(UITransform);
        if (!targetTransform || !hostTransform || !shadowTransform) return;

        const w = targetTransform.width;
        const h = targetTransform.height;
        // 世界座標轉換：將目標節點的四個角點對映到陰影容器的本地座標
        const minWorld = targetTransform.convertToWorldSpaceAR(
            new Vec3(-w * targetTransform.anchorX, -h * targetTransform.anchorY, 0), new Vec3(),
        );
        const maxWorld = targetTransform.convertToWorldSpaceAR(
            new Vec3(w * (1 - targetTransform.anchorX), h * (1 - targetTransform.anchorY), 0), new Vec3(),
        );
        const minLocal = hostTransform.convertToNodeSpaceAR(minWorld, new Vec3());
        const maxLocal = hostTransform.convertToNodeSpaceAR(maxWorld, new Vec3());

        shadowTransform.setContentSize(
            Math.abs(maxLocal.x - minLocal.x),
            Math.abs(maxLocal.y - minLocal.y),
        );
        binding.shadow.setPosition(
            (minLocal.x + maxLocal.x) * 0.5,
            (minLocal.y + maxLocal.y) * 0.5 - binding.offsetY,
            binding.target.position.z,
        );
        binding.shadow.active = binding.target.activeInHierarchy;
    }
}
