import { EffectAsset, Material, Node, resources, Sprite, UITransform, Vec4 } from 'cc';
import { UCUFLogger, LogCategory } from '../../core/UCUFLogger';

const PORTRAIT_SOFT_MASK_EFFECT_PATH = 'effects/portrait-soft-mask';
const DEFAULT_MASK_RECT = new Vec4(-0.06, 0.00, 0.99, 1.06);
const DEFAULT_MASK_FEATHER = new Vec4(0.12, 0.12, 0.06, 0.30);
const PORTRAIT_ARTWORK_CARRIER_NODE_NAME = 'PortraitArtworkCarrier';
const PORTRAIT_ARTWORK_NODE_NAME = 'PortraitArtwork';
const PORTRAIT_ARTWORK_SCALE_MULTIPLIER = 1.3;
const PORTRAIT_BOX_INSET_TOP_RATIO = 0.035;
const PORTRAIT_BOX_INSET_BOTTOM_RATIO = 0.000;
const PORTRAIT_BOX_INSET_SIDE_RATIO = 0.000;

export interface PortraitSoftMaskOptions {
    maskRect?: Vec4;
    maskFeather?: Vec4;
}

let cachedEffectAssetPromise: Promise<EffectAsset | null> | null = null;
const materialCache = new WeakMap<Sprite, Material>();

function stringifyUnknownError(error: unknown): string {
    if (error instanceof Error) {
        return error.stack || error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

async function loadPortraitSoftMaskEffectAsset(): Promise<EffectAsset | null> {
    if (!cachedEffectAssetPromise) {
        cachedEffectAssetPromise = new Promise((resolve) => {
            resources.load(PORTRAIT_SOFT_MASK_EFFECT_PATH, EffectAsset, (error, effectAsset) => {
                if (error || !effectAsset) {
                    UCUFLogger.warn(LogCategory.SKIN, '[PortraitSoftMask] 載入 portrait-soft-mask.effect 失敗', {
                        effectPath: PORTRAIT_SOFT_MASK_EFFECT_PATH,
                        error: error ? String(error) : 'unknown',
                    });
                    cachedEffectAssetPromise = null;
                    resolve(null);
                    return;
                }

                resolve(effectAsset);
            });
        });
    }

    return cachedEffectAssetPromise;
}

function cloneVec4(source: Vec4): Vec4 {
    return new Vec4(source.x, source.y, source.z, source.w);
}

export function getOrCreatePortraitArtworkSprite(host: Node | Sprite | null): Sprite | null {
    const hostNode = host instanceof Sprite ? host.node : host;
    if (!hostNode) {
        return null;
    }

    let carrierNode = hostNode.getChildByName(PORTRAIT_ARTWORK_CARRIER_NODE_NAME);
    if (!carrierNode) {
        carrierNode = new Node(PORTRAIT_ARTWORK_CARRIER_NODE_NAME);
        carrierNode.parent = hostNode;
    }

    const carrierTransform = carrierNode.getComponent(UITransform) || carrierNode.addComponent(UITransform);
    carrierTransform.setAnchorPoint(0.5, 0.5);
    carrierNode.layer = hostNode.layer;
    carrierNode.setSiblingIndex(hostNode.children.length - 1);

    let artworkNode = carrierNode.getChildByName(PORTRAIT_ARTWORK_NODE_NAME);
    if (!artworkNode) {
        artworkNode = new Node(PORTRAIT_ARTWORK_NODE_NAME);
        artworkNode.parent = carrierNode;
    }

    const artworkTransform = artworkNode.getComponent(UITransform) || artworkNode.addComponent(UITransform);
    artworkTransform.setAnchorPoint(0.5, 0.5);
    artworkNode.layer = hostNode.layer;
    artworkNode.setSiblingIndex(carrierNode.children.length - 1);

    const artworkSprite = artworkNode.getComponent(Sprite) || artworkNode.addComponent(Sprite);
    artworkSprite.type = Sprite.Type.SIMPLE;
    return artworkSprite;
}

export function fitPortraitSpriteToLogicalFrame(sprite: Sprite | null): void {
    if (!sprite) {
        return;
    }

    const spriteFrame = sprite.spriteFrame;
    const carrierNode = sprite.node.parent;
    const hostNode = carrierNode?.parent;
    const hostTransform = hostNode?.getComponent(UITransform);
    const carrierTransform = carrierNode?.getComponent(UITransform);
    if (!spriteFrame || !hostTransform || !carrierTransform) {
        return;
    }

    const trimmedWidth = spriteFrame.width;
    const trimmedHeight = spriteFrame.height;
    const logicalWidth = spriteFrame.originalSize.width > 0 ? spriteFrame.originalSize.width : trimmedWidth;
    const logicalHeight = spriteFrame.originalSize.height > 0 ? spriteFrame.originalSize.height : trimmedHeight;
    const offsetX = spriteFrame.offset.x;
    const offsetY = spriteFrame.offset.y;

    const availableWidth = hostTransform.contentSize.width * (1 - PORTRAIT_BOX_INSET_SIDE_RATIO * 2);
    const availableHeight = hostTransform.contentSize.height * (1 - PORTRAIT_BOX_INSET_TOP_RATIO - PORTRAIT_BOX_INSET_BOTTOM_RATIO);

    if (availableWidth <= 0 || availableHeight <= 0 || logicalWidth <= 0 || logicalHeight <= 0
        || trimmedWidth <= 0 || trimmedHeight <= 0) {
        return;
    }

    // 用 originalSize + offset 還原每張立繪自己的邏輯框，避免 trimmed atlas 尺寸把角色推出可視區。
    const scale = Math.min(availableWidth / logicalWidth, availableHeight / logicalHeight);
    const displayScale = scale * PORTRAIT_ARTWORK_SCALE_MULTIPLIER;
    const logicalScaledWidth = logicalWidth * scale;
    const logicalScaledHeight = logicalHeight * scale;
    const hostHalfHeight = hostTransform.contentSize.height * 0.5;
    const topMargin = hostTransform.contentSize.height * PORTRAIT_BOX_INSET_TOP_RATIO;

    carrierTransform.setContentSize(logicalScaledWidth, logicalScaledHeight);
    carrierNode.setPosition(0, hostHalfHeight - topMargin - (logicalScaledHeight * 0.5), 0);

    const artworkTransform = sprite.node.getComponent(UITransform) || sprite.node.addComponent(UITransform);
    artworkTransform.setAnchorPoint(0.5, 1.0);
    artworkTransform.setContentSize(trimmedWidth, trimmedHeight);

    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.node.setScale(displayScale, displayScale, 1);
    sprite.node.setPosition(offsetX * displayScale, offsetY * scale + (trimmedHeight * scale * 0.5), 0);
    sprite.markForUpdateRenderData(true);
}

function applyPortraitSoftMaskMaterialProperties(material: Material, sprite: Sprite, options: PortraitSoftMaskOptions): void {
    const spriteFrameTexture = sprite.spriteFrame?.texture;
    if (spriteFrameTexture) {
        material.setProperty('mainTexture', spriteFrameTexture);
    }

    const maskRect = options.maskRect ?? DEFAULT_MASK_RECT;
    const maskFeather = options.maskFeather ?? DEFAULT_MASK_FEATHER;
    material.setProperty('u_maskRect', cloneVec4(maskRect));
    material.setProperty('u_maskFeather', cloneVec4(maskFeather));
}

async function createPortraitSoftMaskMaterialWithOptions(sprite: Sprite, options: PortraitSoftMaskOptions): Promise<Material | null> {
    const cachedMaterial = materialCache.get(sprite);
    if (cachedMaterial) {
        applyPortraitSoftMaskMaterialProperties(cachedMaterial, sprite, options);
        return cachedMaterial;
    }

    const effectAsset = await loadPortraitSoftMaskEffectAsset();
    if (!effectAsset) {
        return null;
    }

    const material = new Material();
    try {
        material.initialize({ effectAsset, technique: 0 });
    } catch (error) {
        throw new Error(`[PortraitSoftMask] material.initialize failed: ${stringifyUnknownError(error)}`);
    }

    try {
        applyPortraitSoftMaskMaterialProperties(material, sprite, options);
    } catch (error) {
        throw new Error(`[PortraitSoftMask] material property setup failed: ${stringifyUnknownError(error)}`);
    }

    materialCache.set(sprite, material);
    return material;
}

export async function applyPortraitSoftMask(sprite: Sprite | null, options: PortraitSoftMaskOptions = {}): Promise<void> {
    if (!sprite) {
        return;
    }

    const material = await createPortraitSoftMaskMaterialWithOptions(sprite, options);
    if (!material) {
        return;
    }

    sprite.customMaterial = material;
    sprite.markForUpdateRenderData(true);
}