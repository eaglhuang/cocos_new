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
    rarityDocks?: UIPreviewBinderRarityDockState[];
}

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

    if (state.rarityDocks) {
        for (const dock of state.rarityDocks) {
            applyUIRarityMarkToBinder(binder, dock.tier, dock.binding);
        }
    }
}