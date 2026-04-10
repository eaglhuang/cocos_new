import { Color, Label, Node, Sprite, UITransform } from 'cc';
import type { GeneralDetailRarityTier } from '../../core/models/GeneralUnit';
import { UITemplateBinder } from './UITemplateBinder';
import { getUIRarityMarkSpec } from './UIRarityMark';

export interface UIRarityMarkDockBinding {
    dockNodeName?: string;
    underlayNodeName: string;
    badgeNodeName: string;
    labelNodeName: string;
}

export interface UIRarityMarkDockNodes {
    dockNode?: Node | null;
    underlayNode?: Node | null;
    badgeNode?: Node | null;
    labelNode?: Node | null;
}

export function applyUIRarityMarkToNodes(
    tier: GeneralDetailRarityTier,
    nodes: UIRarityMarkDockNodes,
): void {
    const spec = getUIRarityMarkSpec(tier);
    const dockWidth = spec.mark.length >= 3 ? 176 : spec.mark.length === 2 ? 160 : 144;

    setNodeSize(nodes.dockNode, dockWidth, 44);
    setNodeSize(nodes.underlayNode, dockWidth, 40);
    setNodeSize(nodes.badgeNode, dockWidth - 14, 34);
    setNodeSize(nodes.labelNode, dockWidth - 34, 24);

    const underlaySprite = getSprite(nodes.underlayNode);
    if (underlaySprite) {
        underlaySprite.color = colorFromTuple(spec.underlayColor);
    }

    const badgeSprite = getSprite(nodes.badgeNode);
    if (badgeSprite) {
        badgeSprite.color = colorFromTuple(spec.plateColor);
    }

    const label = getLabel(nodes.labelNode);
    if (label) {
        label.string = spec.mark;
        label.color = colorFromTuple(spec.textColor);
        label.outlineColor = colorFromTuple(spec.outlineColor);
        label.outlineWidth = 1;
    }
}

export function applyUIRarityMarkToBinder(
    binder: UITemplateBinder,
    tier: GeneralDetailRarityTier,
    binding: UIRarityMarkDockBinding,
): void {
    applyUIRarityMarkToNodes(tier, {
        dockNode: binding.dockNodeName ? binder.getNode(binding.dockNodeName) : null,
        underlayNode: binder.getNode(binding.underlayNodeName),
        badgeNode: binder.getNode(binding.badgeNodeName),
        labelNode: binder.getNode(binding.labelNodeName),
    });
}

function setNodeSize(node: Node | null | undefined, width: number, height: number): void {
    if (!node) {
        return;
    }

    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(width, height);
}

function getSprite(node: Node | null | undefined): Sprite | null {
    return node?.getComponent(Sprite) ?? null;
}

function getLabel(node: Node | null | undefined): Label | null {
    return node?.getComponent(Label) ?? null;
}

function colorFromTuple([r, g, b]: [number, number, number], a = 255): Color {
    return new Color(r, g, b, a);
}