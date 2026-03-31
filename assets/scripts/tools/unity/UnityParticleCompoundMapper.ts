// @spec-source → 見 docs/cross-reference-index.md
import {
    UnityColorLike,
    UnityMinMaxCurveSummary,
    UnityMinMaxGradientSummary,
    UnityParticlePrefabSummary,
    UnityPrefabNodeSummary,
} from './UnityParticlePrefabParser';

export interface UnityCompoundDraftSubParticle {
    name: string;
    position: { x: number; y: number; z: number } | null;
    color: UnityColorLike;
    startSize: number;
    startSpeed: number;
    startLifetime: number;
    gravity: number;
    rateOverTime: number;
    burstCount: number;
    shapeType: number;
    radius: number;
    simulationSpace: number;
    loop: boolean;
    duration: number;
    capacity: number;
    renderMode: number;
    velocityScale: number;
    lengthScale: number;
    materialHint: 'MAT_ADDITIVE';
    texKeyHint: string | null;
    sizeOverLifetime: {
        enabled: boolean;
        multiplier: number | null;
    };
    colorOverLifetime: {
        enabled: boolean;
        color: UnityColorLike | null;
        mode: number | null;
    };
    velocityOverLifetime: {
        enabled: boolean;
        x: number;
        y: number;
        z: number;
        speedModifier: number;
        space: number;
    };
    unsupported: string[];
}

export interface UnityCompoundEffectDraft {
    effectId: string;
    rootNames: string[];
    particleCount: number;
    subPS: UnityCompoundDraftSubParticle[];
    warnings: string[];
}

export interface UnityCompoundMapperOptions {
    effectId?: string;
    defaultColor?: UnityColorLike;
    defaultSimulationSpace?: number;
    defaultRenderMode?: number;
}

export interface UnityCompoundSnippetOptions {
    label?: string;
    folder?: string;
    scale?: number;
    audio?: string | null;
}

const COCOS_SHAPE = {
    SPHERE: 1,
    CONE: 3,
    CIRCLE: 4,
} as const;

const DEFAULT_COLOR: UnityColorLike = { r: 255, g: 255, b: 255, a: 255 };

function scalarOf(curve: UnityMinMaxCurveSummary | null, fallback = 0): number {
    if (!curve) return fallback;
    const mode = curve.mode ?? 0;
    if (mode === 0 && curve.scalar !== null) return curve.scalar;
    if (mode === 3) {
        const values = [curve.minScalar, curve.maxScalar].filter((v): v is number => v !== null);
        if (values.length === 2) return (values[0] + values[1]) * 0.5;
        if (values.length === 1) return values[0];
    }
    return curve.scalar ?? curve.maxScalar ?? curve.minScalar ?? fallback;
}

function resolveColor(summary: UnityMinMaxGradientSummary | null, fallback: UnityColorLike): UnityColorLike {
    return summary?.maxColor ?? summary?.color ?? summary?.minColor ?? fallback;
}

function isConstantCurve(curve: UnityMinMaxCurveSummary | null): boolean {
    return !curve || curve.mode === null || curve.mode === 0 || curve.mode === 3;
}

function mapUnityShapeType(shapeType: number | null): number {
    switch (shapeType) {
    case 10:
        return COCOS_SHAPE.CIRCLE;
    case 4:
    case 8:
        return COCOS_SHAPE.CONE;
    case 0:
    case 2:
    case 5:
    case 15:
    case 16:
    default:
        return COCOS_SHAPE.SPHERE;
    }
}

function mapUnityRenderMode(renderMode: number | null, fallback: number): number {
    if (renderMode === null || renderMode === 5) return fallback;
    return renderMode;
}

function collectUnsupported(node: UnityPrefabNodeSummary): string[] {
    const particle = node.particleSystem;
    if (!particle) return [];

    const unsupported: string[] = [];
    const constantChecks: Array<[string, UnityMinMaxCurveSummary | null]> = [
        ['startDelay', particle.startDelay],
        ['startLifetime', particle.startLifetime],
        ['startSpeed', particle.startSpeed],
        ['startSize', particle.startSize],
        ['gravityModifier', particle.gravityModifier],
        ['rateOverTime', particle.emissionRateOverTime],
        ['rateOverDistance', particle.emissionRateOverDistance],
    ];

    for (const [label, curve] of constantChecks) {
        if (!isConstantCurve(curve)) {
            unsupported.push(`${label}: 目前只支援常數模式`);
        }
    }

    if (particle.startColor && particle.startColor.mode !== null && particle.startColor.mode !== 0) {
        unsupported.push('startColor: 目前只支援單一顏色');
    }

    const moduleLabels: Array<[string, boolean]> = [
        ['forceOverLifetime', particle.modules.forceOverLifetime],
        ['rotationOverLifetime', particle.modules.rotationOverLifetime],
        ['textureAnimation', particle.modules.textureAnimation],
        ['limitVelocityOverLifetime', particle.modules.limitVelocityOverLifetime],
        ['trails', particle.modules.trails],
        ['noise', particle.modules.noise],
    ];

    for (const [label, enabled] of moduleLabels) {
        if (enabled) unsupported.push(`${label}: 尚未映射到 compound generator`);
    }

    // velocityOverLifetime：只支援常數模式
    if (particle.velocityOverLifetime.enabled) {
        const volCurves: Array<[string, UnityMinMaxCurveSummary | null]> = [
            ['velocityOverLifetime.x', particle.velocityOverLifetime.x],
            ['velocityOverLifetime.y', particle.velocityOverLifetime.y],
            ['velocityOverLifetime.z', particle.velocityOverLifetime.z],
            ['velocityOverLifetime.speedModifier', particle.velocityOverLifetime.speedModifier],
        ];
        for (const [label, curve] of volCurves) {
            if (!isConstantCurve(curve)) {
                unsupported.push(`${label}: 目前只支援常數模式`);
            }
        }
    }

    if (particle.sizeOverLifetime.enabled && !isConstantCurve(particle.sizeOverLifetime.size)) {
        unsupported.push('sizeOverLifetime: 目前只支援常數倍率');
    }

    if (
        particle.colorOverLifetime.enabled
        && particle.colorOverLifetime.color
        && ![0, 2, null].includes(particle.colorOverLifetime.color.mode)
    ) {
        unsupported.push('colorOverLifetime: 目前只支援單色或雙色');
    }

    return unsupported;
}

function mapParticleNode(
    node: UnityPrefabNodeSummary,
    options: Required<Pick<UnityCompoundMapperOptions, 'defaultColor' | 'defaultSimulationSpace' | 'defaultRenderMode'>>,
): UnityCompoundDraftSubParticle {
    const particle = node.particleSystem;
    if (!particle) {
        throw new Error(`節點 ${node.name} 缺少 ParticleSystem，無法轉成 compound draft。`);
    }

    const renderer = node.particleRenderer;
    return {
        name: node.name,
        position: node.localPosition,
        color: resolveColor(particle.startColor, options.defaultColor),
        startSize: scalarOf(particle.startSize, 1),
        startSpeed: scalarOf(particle.startSpeed, 0),
        startLifetime: scalarOf(particle.startLifetime, 1),
        gravity: scalarOf(particle.gravityModifier, 0),
        rateOverTime: scalarOf(particle.emissionRateOverTime, 0),
        burstCount: particle.burstCount,
        shapeType: mapUnityShapeType(particle.shape.type),
        radius: particle.shape.radius ?? 0,
        simulationSpace: (particle as any).simulationSpace ?? options.defaultSimulationSpace,
        loop: particle.looping,
        duration: particle.duration ?? 1,
        capacity: particle.maxParticles ?? 32,
        renderMode: mapUnityRenderMode(renderer?.renderMode ?? null, options.defaultRenderMode),
        velocityScale: renderer?.velocityScale ?? 0,
        lengthScale: renderer?.lengthScale ?? 0,
        materialHint: 'MAT_ADDITIVE',
        texKeyHint: null,
        velocityOverLifetime: {
            enabled: particle.velocityOverLifetime.enabled,
            x: scalarOf(particle.velocityOverLifetime.x, 0),
            y: scalarOf(particle.velocityOverLifetime.y, 0),
            z: scalarOf(particle.velocityOverLifetime.z, 0),
            speedModifier: scalarOf(particle.velocityOverLifetime.speedModifier, 1),
            space: particle.velocityOverLifetime.space ?? 1,
        },
        sizeOverLifetime: {
            enabled: particle.sizeOverLifetime.enabled,
            multiplier: scalarOf(particle.sizeOverLifetime.size, 1),
        },
        colorOverLifetime: {
            enabled: particle.colorOverLifetime.enabled,
            color: resolveColor(particle.colorOverLifetime.color, options.defaultColor),
            mode: particle.colorOverLifetime.color?.mode ?? null,
        },
        unsupported: collectUnsupported(node),
    };
}

export function buildUnityCompoundEffectDraft(
    summary: UnityParticlePrefabSummary,
    options: UnityCompoundMapperOptions = {},
): UnityCompoundEffectDraft {
    const resolvedOptions = {
        defaultColor: options.defaultColor ?? DEFAULT_COLOR,
        defaultSimulationSpace: options.defaultSimulationSpace ?? 1,
        defaultRenderMode: options.defaultRenderMode ?? 0,
    };

    const effectId = options.effectId ?? summary.rootNodes[0]?.name ?? 'unity_particle_effect';
    const subPS = summary.particleNodes.map((node) => mapParticleNode(node, resolvedOptions));
    const warnings = subPS.flatMap((sub) => sub.unsupported.map((warning) => `${sub.name}: ${warning}`));

    return {
        effectId,
        rootNames: summary.rootNodes.map((node) => node.name),
        particleCount: subPS.length,
        subPS,
        warnings,
    };
}

function sanitizeFolderName(effectId: string): string {
    return effectId
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
}

function formatColor(color: UnityColorLike): string {
    return `{ r:${color.r}, g:${color.g}, b:${color.b}, a:${color.a} }`;
}

function formatVec3(position: { x: number; y: number; z: number } | null): string | null {
    if (!position) return null;
    return `{ "__type__": "cc.Vec3", "x": ${position.x}, "y": ${position.y}, "z": ${position.z} }`;
}

export function renderCompoundEffectSnippet(
    draft: UnityCompoundEffectDraft,
    options: UnityCompoundSnippetOptions = {},
): string {
    const folder = options.folder ?? sanitizeFolderName(draft.effectId);
    const label = options.label ?? `${draft.effectId} (Unity)`;
    const scale = options.scale ?? 1.0;
    const audio = options.audio === undefined ? null : options.audio;
    const warningLines = draft.warnings.length > 0
        ? draft.warnings.map((warning) => `    // WARN: ${warning}`).join('\n') + '\n'
        : '';

    const subPSLines = draft.subPS.map((sub) => {
        const positionLine = formatVec3(sub.position)
            ? `,\n        position: ${formatVec3(sub.position)}`
            : '';
        const unsupportedLine = sub.unsupported.length > 0
            ? `,\n        // unsupported: ${sub.unsupported.join(' | ')}`
            : '';
        const velocityOverLifetimeLine = sub.velocityOverLifetime.enabled
            ? `,\n        velocityOverLifetime: { enabled: true, x: ${sub.velocityOverLifetime.x}, y: ${sub.velocityOverLifetime.y}, z: ${sub.velocityOverLifetime.z}, speedModifier: ${sub.velocityOverLifetime.speedModifier}, space: ${sub.velocityOverLifetime.space} }`
            : '';
        const sizeOverLifetimeLine = sub.sizeOverLifetime.enabled
            ? `,\n        sizeOverLifetime: { enabled: true, multiplier: ${sub.sizeOverLifetime.multiplier ?? 1} }`
            : ''
        const colorOverLifetimeLine = sub.colorOverLifetime.enabled && sub.colorOverLifetime.color
            ? `,\n        colorOverLifetime: { enabled: true, mode: ${sub.colorOverLifetime.mode ?? 0}, color: ${formatColor(sub.colorOverLifetime.color)} }`
            : '';
        return [
            '      {',
            `        name: '${sub.name}',`,
            `        texKey: '${sub.texKeyHint ?? 'cfxr_aura_runic'}', material: MAT_ADDITIVE,`,
            `        color: ${formatColor(sub.color)},`,
            `        startSize: ${sub.startSize}, startSpeed: ${sub.startSpeed}, startLifetime: ${sub.startLifetime},`,
            `        gravity: ${sub.gravity}, rateOverTime: ${sub.rateOverTime},`,
            `        shapeType: ${sub.shapeType}, radius: ${sub.radius}, simulationSpace: ${sub.simulationSpace},`,
            `        loop: ${sub.loop}, duration: ${sub.duration}, capacity: ${sub.capacity}, renderMode: ${sub.renderMode},`,
            `        velocityScale: ${sub.velocityScale}, lengthScale: ${sub.lengthScale}${positionLine}${velocityOverLifetimeLine}${sizeOverLifetimeLine}${colorOverLifetimeLine}${unsupportedLine}`,
            '      },',
        ].join('\n');
    }).join('\n');

    const audioValue = audio ? `'${audio}'` : 'null';
    return [
        warningLines + '{',
        `    id: '${draft.effectId}',`,
        `    label: '${label}',`,
        `    folder: '${folder}',`,
        `    scale: ${scale},`,
        `    audio: ${audioValue},`,
        '    subPS: [',
        subPSLines,
        '    ]',
        '  },',
    ].join('\n');
}