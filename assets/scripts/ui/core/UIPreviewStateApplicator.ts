import { Color, UITransform } from 'cc';
import type { GeneralDetailRarityTier } from '../../core/models/GeneralUnit';
import { UITemplateBinder } from './UITemplateBinder';
import { applyUIRarityMarkToBinder, type UIRarityMarkDockBinding } from './UIRarityMarkVisual';

export interface UIPreviewBinderRarityDockState {
    tier: GeneralDetailRarityTier;
    binding: UIRarityMarkDockBinding;
}

export interface UIPreviewBinderState {
    texts?: Record<string, string>;
    actives?: Record<string, boolean>;
    spriteColors?: Record<string, UIPreviewColorValue>;
    labelColors?: Record<string, UIPreviewColorValue>;
    nodeWidthPercents?: Record<string, { percent: number; relativeTo: string }>;
    rarityDocks?: UIPreviewBinderRarityDockState[];
}

type UIPreviewColorValue = string | [number, number, number] | [number, number, number, number] | { r: number; g: number; b: number; a?: number };

export function applyUIPreviewBinderState(binder: UITemplateBinder, state: UIPreviewBinderState | null | undefined): void {
    if (!state) {
        return;
    }

    if (state.texts) {
        binder.setTexts(state.texts);
    }

    if (state.actives) {
        binder.setActives(state.actives);
    }

    if (state.spriteColors) {
        for (const [id, colorValue] of Object.entries(state.spriteColors)) {
            const sprite = binder.getSprite(id);
            if (sprite) {
                const color = toColor(colorValue);
                if (color) {
                    sprite.color = color;
                }
            }
        }
    }

    if (state.labelColors) {
        for (const [id, colorValue] of Object.entries(state.labelColors)) {
            const label = binder.getLabel(id);
            if (label) {
                const color = toColor(colorValue);
                if (color) {
                    label.color = color;
                }
            }
        }
    }

    if (state.nodeWidthPercents) {
        for (const [targetId, spec] of Object.entries(state.nodeWidthPercents)) {
            const targetNode = binder.getNode(targetId);
            const baseNode = binder.getNode(spec.relativeTo);
            if (!targetNode || !baseNode) {
                continue;
            }

            const targetTransform = targetNode.getComponent(UITransform);
            const baseTransform = baseNode.getComponent(UITransform);
            if (!targetTransform || !baseTransform) {
                continue;
            }

            const clampedPercent = Math.max(0, Math.min(100, Number(spec.percent) || 0));
            targetTransform.width = Math.round(baseTransform.width * (clampedPercent / 100));
        }
    }

    if (state.rarityDocks) {
        for (const dock of state.rarityDocks) {
            applyUIRarityMarkToBinder(binder, dock.tier, dock.binding);
        }
    }
}

function toColor(value: UIPreviewColorValue): Color | null {
    if (typeof value === 'string') {
        const color = new Color();
        const anyColor = color as unknown as { fromHEX?: (value: string) => void };
        const ctorAny = Color as unknown as { fromHEX?: (out: Color, value: string) => void };
        const formatted = value.startsWith('#') ? value : `#${value}`;

        try {
            if (typeof anyColor.fromHEX === 'function') {
                anyColor.fromHEX(formatted);
                return color;
            }
            if (typeof ctorAny.fromHEX === 'function') {
                ctorAny.fromHEX(color, formatted);
                return color;
            }
        } catch {
            return null;
        }
        return null;
    }

    if (Array.isArray(value)) {
        const [r, g, b, a = 255] = value;
        return new Color(r, g, b, a);
    }

    return new Color(value.r, value.g, value.b, value.a ?? 255);
}