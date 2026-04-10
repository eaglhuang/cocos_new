import type { GeneralDetailRarityTier } from '../../core/models/GeneralUnit';

export type UIRarityMarkColor = [number, number, number];

export interface UIRarityMarkSpec {
    mark: string;
    textColor: UIRarityMarkColor;
    outlineColor: UIRarityMarkColor;
    plateColor: UIRarityMarkColor;
    underlayColor: UIRarityMarkColor;
}

const RARITY_MARK_SPEC: Record<GeneralDetailRarityTier, UIRarityMarkSpec> = {
    common: {
        mark: 'R',
        textColor: [124, 208, 255],
        outlineColor: [40, 92, 164],
        plateColor: [28, 46, 70],
        underlayColor: [14, 28, 44],
    },
    rare: {
        mark: 'SR',
        textColor: [212, 128, 255],
        outlineColor: [102, 52, 174],
        plateColor: [54, 30, 78],
        underlayColor: [30, 16, 48],
    },
    epic: {
        mark: 'SSR',
        textColor: [255, 222, 118],
        outlineColor: [170, 122, 24],
        plateColor: [86, 64, 22],
        underlayColor: [42, 30, 10],
    },
    legendary: {
        mark: 'UR',
        textColor: [255, 104, 112],
        outlineColor: [174, 42, 54],
        plateColor: [94, 28, 34],
        underlayColor: [48, 12, 18],
    },
    mythic: {
        mark: 'LR',
        textColor: [240, 232, 186],
        outlineColor: [156, 132, 54],
        plateColor: [96, 80, 30],
        underlayColor: [50, 38, 12],
    },
};

const SHORT_MARK_RE = /^(R|SR|SSR|UR|LR)$/i;

export function getUIRarityMarkSpec(tier: GeneralDetailRarityTier): UIRarityMarkSpec {
    return RARITY_MARK_SPEC[tier] ?? RARITY_MARK_SPEC.common;
}

export function getUIRarityMarkLabel(tier: GeneralDetailRarityTier): string {
    return getUIRarityMarkSpec(tier).mark;
}

export function normalizeUIRarityMarkLabel(raw?: string): string | null {
    const value = raw?.trim();
    if (!value) {
        return null;
    }

    const compact = value.replace(/\s+/g, '').split(/[\/｜|．]/)[0]?.toUpperCase() ?? '';
    if (!SHORT_MARK_RE.test(compact)) {
        return null;
    }

    return compact;
}