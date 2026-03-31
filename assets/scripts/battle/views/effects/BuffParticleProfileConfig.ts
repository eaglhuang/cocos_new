// @spec-source → 見 docs/cross-reference-index.md
export type BuffEffectVariant = "AtkGain" | "AtkLoss" | "HpGain" | "HpLoss";

export type ParticleColorValue = [number, number, number, number];

export interface ParticleLayerProfile {
    capacity: number;
    rateOverTime: number;
    burstCount: number;
    burstTime: number;
    startSize: number;
    startLifetime: number;
    startSpeed: number;
    gravityModifier: number;
    startDelay: number;
    simulationSpeed: number;
    shapeRadius: number;
    shapeAngle: number;
    startY: number;
    floatY: number;
    quadCount: number;
    quadRadius: number;
    quadRise: number;
    color: ParticleColorValue;
}

export interface BuffParticleProfile {
    spark: ParticleLayerProfile;
    accent: ParticleLayerProfile;
}

export interface BuffParticleProfileTable {
    version: number;
    variants: Record<BuffEffectVariant, BuffParticleProfile>;
}

type PartialParticleColorValue = number[] | ParticleColorValue;

interface ParticleLayerProfileInput {
    capacity?: number;
    rateOverTime?: number;
    burstCount?: number;
    burstTime?: number;
    startSize?: number;
    startLifetime?: number;
    startSpeed?: number;
    gravityModifier?: number;
    startDelay?: number;
    simulationSpeed?: number;
    shapeRadius?: number;
    shapeAngle?: number;
    startY?: number;
    floatY?: number;
    quadCount?: number;
    quadRadius?: number;
    quadRise?: number;
    color?: PartialParticleColorValue;
}

interface BuffParticleProfileInput {
    spark?: ParticleLayerProfileInput;
    accent?: ParticleLayerProfileInput;
}

interface BuffParticleProfileTableInput {
    version?: number;
    variants?: Partial<Record<BuffEffectVariant, BuffParticleProfileInput>>;
}

const VARIANTS: BuffEffectVariant[] = ["AtkGain", "AtkLoss", "HpGain", "HpLoss"];

export const DEFAULT_BUFF_PARTICLE_PROFILES: Record<BuffEffectVariant, BuffParticleProfile> = {
    AtkGain: {
        spark: { capacity: 30, rateOverTime: 22, burstCount: 18, burstTime: 0.04, startSize: 0.14, startLifetime: 0.62, startSpeed: 1.28, gravityModifier: 0, startDelay: 0, simulationSpeed: 1.08, shapeRadius: 0.18, shapeAngle: 14, startY: 0.08, floatY: 0.24, quadCount: 10, quadRadius: 0.24, quadRise: 0.26, color: [255, 210, 120, 232] },
        accent: { capacity: 18, rateOverTime: 10, burstCount: 8, burstTime: 0.1, startSize: 0.2, startLifetime: 0.86, startSpeed: 0.84, gravityModifier: 0, startDelay: 0.05, simulationSpeed: 1, shapeRadius: 0.12, shapeAngle: 8, startY: 0.12, floatY: 0.2, quadCount: 6, quadRadius: 0.18, quadRise: 0.18, color: [255, 232, 160, 180] },
    },
    HpGain: {
        spark: { capacity: 34, rateOverTime: 28, burstCount: 22, burstTime: 0.05, startSize: 0.18, startLifetime: 0.82, startSpeed: 1.06, gravityModifier: 0, startDelay: 0, simulationSpeed: 1.02, shapeRadius: 0.22, shapeAngle: 18, startY: 0.1, floatY: 0.28, quadCount: 14, quadRadius: 0.3, quadRise: 0.3, color: [180, 255, 214, 224] },
        accent: { capacity: 22, rateOverTime: 14, burstCount: 12, burstTime: 0.12, startSize: 0.26, startLifetime: 1.02, startSpeed: 0.72, gravityModifier: 0, startDelay: 0.06, simulationSpeed: 0.96, shapeRadius: 0.16, shapeAngle: 10, startY: 0.14, floatY: 0.24, quadCount: 8, quadRadius: 0.22, quadRise: 0.2, color: [132, 255, 206, 188] },
    },
    AtkLoss: {
        spark: { capacity: 20, rateOverTime: 10, burstCount: 9, burstTime: 0.02, startSize: 0.2, startLifetime: 0.94, startSpeed: 0.58, gravityModifier: 0.03, startDelay: 0, simulationSpeed: 0.84, shapeRadius: 0.26, shapeAngle: 28, startY: 0.06, floatY: 0.14, quadCount: 8, quadRadius: 0.22, quadRise: 0.18, color: [138, 88, 72, 188] },
        accent: { capacity: 16, rateOverTime: 6, burstCount: 5, burstTime: 0.09, startSize: 0.3, startLifetime: 1.18, startSpeed: 0.38, gravityModifier: 0.05, startDelay: 0.08, simulationSpeed: 0.76, shapeRadius: 0.22, shapeAngle: 22, startY: 0.08, floatY: 0.12, quadCount: 5, quadRadius: 0.18, quadRise: 0.14, color: [94, 58, 52, 152] },
    },
    HpLoss: {
        spark: { capacity: 24, rateOverTime: 12, burstCount: 12, burstTime: 0.03, startSize: 0.24, startLifetime: 1.06, startSpeed: 0.52, gravityModifier: 0.04, startDelay: 0, simulationSpeed: 0.82, shapeRadius: 0.28, shapeAngle: 30, startY: 0.07, floatY: 0.16, quadCount: 11, quadRadius: 0.26, quadRise: 0.22, color: [114, 94, 82, 176] },
        accent: { capacity: 18, rateOverTime: 8, burstCount: 6, burstTime: 0.11, startSize: 0.34, startLifetime: 1.24, startSpeed: 0.34, gravityModifier: 0.05, startDelay: 0.08, simulationSpeed: 0.72, shapeRadius: 0.24, shapeAngle: 24, startY: 0.1, floatY: 0.12, quadCount: 6, quadRadius: 0.2, quadRise: 0.16, color: [92, 70, 64, 144] },
    },
};

export function normalizeBuffParticleProfileTable(raw: unknown): BuffParticleProfileTable {
    const root = asRecord(raw);
    const variantSource = asRecord(root.variants) ?? root;
    const version = toFiniteNumber(root.version, 1);
    const variants = {} as Record<BuffEffectVariant, BuffParticleProfile>;

    VARIANTS.forEach(variant => {
        const fallback = DEFAULT_BUFF_PARTICLE_PROFILES[variant];
        const input = asRecord(variantSource[variant]);
        variants[variant] = {
            spark: normalizeLayer(asRecord(input.spark), fallback.spark),
            accent: normalizeLayer(asRecord(input.accent), fallback.accent),
        };
    });

    return { version, variants };
}

function normalizeLayer(raw: Record<string, unknown>, fallback: ParticleLayerProfile): ParticleLayerProfile {
    return {
        capacity: toFiniteNumber(raw.capacity, fallback.capacity),
        rateOverTime: toFiniteNumber(raw.rateOverTime, fallback.rateOverTime),
        burstCount: toFiniteNumber(raw.burstCount, fallback.burstCount),
        burstTime: toFiniteNumber(raw.burstTime, fallback.burstTime),
        startSize: toFiniteNumber(raw.startSize, fallback.startSize),
        startLifetime: toFiniteNumber(raw.startLifetime, fallback.startLifetime),
        startSpeed: toFiniteNumber(raw.startSpeed, fallback.startSpeed),
        gravityModifier: toFiniteNumber(raw.gravityModifier, fallback.gravityModifier),
        startDelay: toFiniteNumber(raw.startDelay, fallback.startDelay),
        simulationSpeed: toFiniteNumber(raw.simulationSpeed, fallback.simulationSpeed),
        shapeRadius: toFiniteNumber(raw.shapeRadius, fallback.shapeRadius),
        shapeAngle: toFiniteNumber(raw.shapeAngle, fallback.shapeAngle),
        startY: toFiniteNumber(raw.startY, fallback.startY),
        floatY: toFiniteNumber(raw.floatY, fallback.floatY),
        quadCount: toFiniteNumber(raw.quadCount, fallback.quadCount),
        quadRadius: toFiniteNumber(raw.quadRadius, fallback.quadRadius),
        quadRise: toFiniteNumber(raw.quadRise, fallback.quadRise),
        color: normalizeColor(raw.color, fallback.color),
    };
}

function normalizeColor(value: unknown, fallback: ParticleColorValue): ParticleColorValue {
    if (!Array.isArray(value) || value.length < 3) {
        return [...fallback] as ParticleColorValue;
    }

    return [
        clampChannel(value[0], fallback[0]),
        clampChannel(value[1], fallback[1]),
        clampChannel(value[2], fallback[2]),
        clampChannel(value[3], fallback[3]),
    ];
}

function clampChannel(value: unknown, fallback: number): number {
    const numeric = toFiniteNumber(value, fallback);
    return Math.max(0, Math.min(255, Math.round(numeric)));
}

function toFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}