// @spec-source → 見 docs/cross-reference-index.md
import { parse as parseYaml } from 'yaml';

export interface Vec3Like {
    x: number;
    y: number;
    z: number;
}

export interface QuatLike {
    x: number;
    y: number;
    z: number;
    w: number;
}

export interface UnityYamlDocument {
    classId: number;
    fileId: string;
    typeName: string;
    data: Record<string, any>;
}

export interface UnityColorLike {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface UnityMinMaxCurveSummary {
    mode: number | null;
    scalar: number | null;
    minScalar: number | null;
    maxScalar: number | null;
    curveKeyCount: number;
    minCurveKeyCount: number;
}

export interface UnityMinMaxGradientSummary {
    mode: number | null;
    color: UnityColorLike | null;
    minColor: UnityColorLike | null;
    maxColor: UnityColorLike | null;
    gradientColorKeyCount: number;
    minGradientColorKeyCount: number;
}

export interface UnityParticleSystemSummary {
    duration: number | null;
    looping: boolean;
    playOnAwake: boolean;
    simulationSpeed: number | null;
    scalingMode: number | null;
    maxParticles: number | null;
    startDelay: UnityMinMaxCurveSummary | null;
    startLifetime: UnityMinMaxCurveSummary | null;
    startColor: UnityMinMaxGradientSummary | null;
    startSpeed: UnityMinMaxCurveSummary | null;
    startSize: UnityMinMaxCurveSummary | null;
    gravityModifier: UnityMinMaxCurveSummary | null;
    emissionRateOverTime: UnityMinMaxCurveSummary | null;
    emissionRateOverDistance: UnityMinMaxCurveSummary | null;
    burstCount: number;
    shape: {
        enabled: boolean;
        type: number | null;
        radius: number | null;
        angle: number | null;
        length: number | null;
        scale: Vec3Like | null;
    };
    sizeOverLifetime: {
        enabled: boolean;
        separateAxes: boolean;
        size: UnityMinMaxCurveSummary | null;
        x: UnityMinMaxCurveSummary | null;
        y: UnityMinMaxCurveSummary | null;
        z: UnityMinMaxCurveSummary | null;
    };
    colorOverLifetime: {
        enabled: boolean;
        color: UnityMinMaxGradientSummary | null;
    };
    velocityOverLifetime: {
        enabled: boolean;
        x: UnityMinMaxCurveSummary | null;
        y: UnityMinMaxCurveSummary | null;
        z: UnityMinMaxCurveSummary | null;
        speedModifier: UnityMinMaxCurveSummary | null;
        space: number | null;
    };
    modules: {
        velocityOverLifetime: boolean;
        forceOverLifetime: boolean;
        sizeOverLifetime: boolean;
        rotationOverLifetime: boolean;
        colorOverLifetime: boolean;
        textureAnimation: boolean;
        limitVelocityOverLifetime: boolean;
        trails: boolean;
        noise: boolean;
    };
}

export interface UnityParticleRendererSummary {
    renderMode: number | null;
    sortMode: number | null;
    normalDirection: number | null;
    cameraVelocityScale: number | null;
    velocityScale: number | null;
    lengthScale: number | null;
}

export interface UnityPrefabNodeSummary {
    gameObjectFileId: string;
    transformFileId: string;
    name: string;
    parentTransformFileId: string | null;
    childTransformFileIds: string[];
    localPosition: Vec3Like | null;
    localRotation: QuatLike | null;
    localScale: Vec3Like | null;
    particleSystem: UnityParticleSystemSummary | null;
    particleRenderer: UnityParticleRendererSummary | null;
}

export interface UnityParticlePrefabSummary {
    documents: UnityYamlDocument[];
    rootNodes: UnityPrefabNodeSummary[];
    allNodes: UnityPrefabNodeSummary[];
    particleNodes: UnityPrefabNodeSummary[];
}

interface UnityPrefabNodeInternal {
    gameObject: UnityYamlDocument;
    transform: UnityYamlDocument;
    particleSystem: UnityYamlDocument | null;
    particleRenderer: UnityYamlDocument | null;
}

const DOC_HEADER_RE = /^---\s*!u!(\d+)\s*&([^\r\n]+)\r?\n/gm;

function asNumber(value: any): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asVec3(value: any): Vec3Like | null {
    if (!value || typeof value !== 'object') return null;
    const x = asNumber(value.x);
    const y = asNumber(value.y);
    const z = asNumber(value.z);
    if (x === null || y === null || z === null) return null;
    return { x, y, z };
}

function asQuat(value: any): QuatLike | null {
    if (!value || typeof value !== 'object') return null;
    const x = asNumber(value.x);
    const y = asNumber(value.y);
    const z = asNumber(value.z);
    const w = asNumber(value.w);
    if (x === null || y === null || z === null || w === null) return null;
    return { x, y, z, w };
}

function asColor(value: any): UnityColorLike | null {
    if (!value || typeof value !== 'object') return null;
    const r = asNumber(value.r);
    const g = asNumber(value.g);
    const b = asNumber(value.b);
    const a = asNumber(value.a);
    if (r === null || g === null || b === null || a === null) return null;
    const toByte = (channel: number) => Math.max(0, Math.min(255, Math.round(channel <= 1 ? channel * 255 : channel)));
    return {
        r: toByte(r),
        g: toByte(g),
        b: toByte(b),
        a: toByte(a),
    };
}

function toFileId(value: any): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') {
        // 轉為字符串，但使用 toLocaleString('fullwide') 來保留大整數精度
        // (或者簡單地用 String)
        const str = String(value);
        return str;
    }
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'object' && 'fileID' in value) {
        return toFileId(value.fileID);
    }
    return null;
}

function normalizeParentFileId(fileId: string | null): string | null {
    return (!fileId || fileId === '0') ? null : fileId;
}

function extractMinMaxCurve(input: any): UnityMinMaxCurveSummary | null {
    if (!input || typeof input !== 'object') return null;
    return {
        mode: asNumber(input.minMaxState),
        scalar: asNumber(input.scalar),
        minScalar: asNumber(input.minScalar),
        maxScalar: asNumber(input.maxScalar),
        curveKeyCount: Array.isArray(input.maxCurve?.m_Curve) ? input.maxCurve.m_Curve.length : 0,
        minCurveKeyCount: Array.isArray(input.minCurve?.m_Curve) ? input.minCurve.m_Curve.length : 0,
    };
}

function extractMinMaxGradient(input: any): UnityMinMaxGradientSummary | null {
    if (!input || typeof input !== 'object') return null;
    return {
        mode: asNumber(input.minMaxState),
        color: asColor(input.color),
        minColor: asColor(input.minColor),
        maxColor: asColor(input.maxColor),
        gradientColorKeyCount: Array.isArray(input.maxGradient?.m_Colors)
            ? input.maxGradient.m_Colors.length
            : asNumber(input.maxGradient?.m_NumColorKeys) ?? 0,
        minGradientColorKeyCount: Array.isArray(input.minGradient?.m_Colors)
            ? input.minGradient.m_Colors.length
            : asNumber(input.minGradient?.m_NumColorKeys) ?? 0,
    };
}

function extractParticleSystemSummary(data: Record<string, any>): UnityParticleSystemSummary {
    const initial = data.InitialModule ?? {};
    const emission = data.EmissionModule ?? {};
    const shape = data.ShapeModule ?? {};

    return {
        duration: asNumber(data.lengthInSec),
        looping: !!data.looping,
        playOnAwake: !!data.playOnAwake,
        simulationSpeed: asNumber(data.simulationSpeed),
        scalingMode: asNumber(data.scalingMode),
        maxParticles: asNumber(initial.maxNumParticles),
        startDelay: extractMinMaxCurve(data.startDelay),
        startLifetime: extractMinMaxCurve(initial.startLifetime),
        startColor: extractMinMaxGradient(initial.startColor),
        startSpeed: extractMinMaxCurve(initial.startSpeed),
        startSize: extractMinMaxCurve(initial.startSize),
        gravityModifier: extractMinMaxCurve(initial.gravityModifier),
        emissionRateOverTime: extractMinMaxCurve(emission.rateOverTime),
        emissionRateOverDistance: extractMinMaxCurve(emission.rateOverDistance),
        burstCount: asNumber(emission.m_BurstCount) ?? (Array.isArray(emission.m_Bursts) ? emission.m_Bursts.length : 0) ?? 0,
        shape: {
            enabled: !!shape.enabled,
            type: asNumber(shape.type),
            radius: asNumber(shape.radius?.value),
            angle: asNumber(shape.angle),
            length: asNumber(shape.length),
            scale: asVec3(shape.m_Scale),
        },
        sizeOverLifetime: {
            enabled: !!data.SizeModule?.enabled,
            separateAxes: !!data.SizeModule?.separateAxes,
            size: extractMinMaxCurve(data.SizeModule?.curve),
            x: extractMinMaxCurve(data.SizeModule?.x),
            y: extractMinMaxCurve(data.SizeModule?.y),
            z: extractMinMaxCurve(data.SizeModule?.z),
        },
        colorOverLifetime: {
            enabled: !!data.ColorModule?.enabled,
            color: extractMinMaxGradient(data.ColorModule?.gradient),
        },
        velocityOverLifetime: {
            enabled: !!data.VelocityModule?.enabled,
            x: extractMinMaxCurve(data.VelocityModule?.x),
            y: extractMinMaxCurve(data.VelocityModule?.y),
            z: extractMinMaxCurve(data.VelocityModule?.z),
            speedModifier: extractMinMaxCurve(data.VelocityModule?.speedModifier),
            space: asNumber(data.VelocityModule?.inWorldSpace),
        },
        modules: {
            velocityOverLifetime: !!data.VelocityModule?.enabled,
            forceOverLifetime: !!data.ForceModule?.enabled,
            sizeOverLifetime: !!data.SizeModule?.enabled,
            rotationOverLifetime: !!data.RotationModule?.enabled,
            colorOverLifetime: !!data.ColorModule?.enabled,
            textureAnimation: !!data.UVModule?.enabled,
            limitVelocityOverLifetime: !!data.ClampVelocityModule?.enabled,
            trails: !!data.TrailModule?.enabled,
            noise: !!data.NoiseModule?.enabled,
        },
    };
}

function extractParticleRendererSummary(data: Record<string, any>): UnityParticleRendererSummary {
    return {
        renderMode: asNumber(data.m_RenderMode),
        sortMode: asNumber(data.m_SortMode),
        normalDirection: asNumber(data.m_NormalDirection),
        cameraVelocityScale: asNumber(data.m_CameraVelocityScale),
        velocityScale: asNumber(data.velocityScale ?? data.m_VelocityScale),
        lengthScale: asNumber(data.lengthScale ?? data.m_LengthScale),
    };
}

export function parseUnityYamlDocuments(text: string): UnityYamlDocument[] {
    const content = text
        .replace(/^%YAML.*\r?\n/gm, '')
        .replace(/^%TAG.*\r?\n/gm, '');

    const matches = Array.from(content.matchAll(DOC_HEADER_RE));
    if (matches.length === 0) {
        throw new Error('找不到 Unity YAML 文件標頭，請確認 prefab 已設為 ForceText。');
    }

    const docs: UnityYamlDocument[] = [];

    for (let index = 0; index < matches.length; index++) {
        const match = matches[index];
        const next = matches[index + 1];
        const bodyStart = (match.index ?? 0) + match[0].length;
        const bodyEnd = next ? (next.index ?? content.length) : content.length;
        const body = content.slice(bodyStart, bodyEnd).trim();
        if (!body) continue;

        // 先用正則提取所有 fileID 並轉成字符串以保留精度
        const fileIdFixes = new Map<string, string>();
        Array.from(body.matchAll(/fileID:\s*(\d+)/g)).forEach((m) => {
            fileIdFixes.set(String(Number(m[1])), m[1]);
        });

        const parsed = parseYaml(body) as Record<string, any> | null;
        if (!parsed || typeof parsed !== 'object') continue;

        const typeName = Object.keys(parsed)[0];
        if (!typeName) continue;

        // 後處理：把所有 Number 類型的 fileID 換回原始字符串以保留精度
        const fixFileIds = (obj: any): any => {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj === 'number' && fileIdFixes.has(String(obj))) {
                return fileIdFixes.get(String(obj))!;
            }
            if (typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) return obj.map(fixFileIds);
            const fixed: Record<string, any> = {};
            for (const [key, value] of Object.entries(obj)) {
                if (key === 'fileID' && typeof value === 'number') {
                    fixed[key] = fileIdFixes.get(String(value)) ?? String(value);
                } else {
                    fixed[key] = fixFileIds(value);
                }
            }
            return fixed;
        };

        docs.push({
            classId: Number(match[1]),
            fileId: match[2],
            typeName,
            data: fixFileIds(parsed[typeName] ?? {}),
        });
    }

    return docs;
}

export function extractUnityParticlePrefab(text: string): UnityParticlePrefabSummary {
    const documents = parseUnityYamlDocuments(text);
    const gameObjects = new Map<string, UnityYamlDocument>();
    const transforms = new Map<string, UnityYamlDocument>();
    const particleSystems = new Map<string, UnityYamlDocument>();
    const particleRenderers = new Map<string, UnityYamlDocument>();

    for (const doc of documents) {
        switch (doc.typeName) {
        case 'GameObject':
            gameObjects.set(doc.fileId, doc);
            break;
        case 'Transform':
            transforms.set(doc.fileId, doc);
            break;
        case 'ParticleSystem':
            particleSystems.set(doc.fileId, doc);
            break;
        case 'ParticleSystemRenderer':
            particleRenderers.set(doc.fileId, doc);
            break;
        default:
            break;
        }
    }

    const nodeMap = new Map<string, UnityPrefabNodeInternal>();

    for (const [gameObjectId, gameObjectDoc] of gameObjects.entries()) {
        const componentRefs = Array.isArray(gameObjectDoc.data.m_Component) ? gameObjectDoc.data.m_Component : [];
        let transformDoc: UnityYamlDocument | null = null;
        let particleDoc: UnityYamlDocument | null = null;
        let rendererDoc: UnityYamlDocument | null = null;

        for (const ref of componentRefs) {
            const componentId = toFileId(ref?.component);
            if (!componentId) continue;

            const transformCandidate = transforms.get(componentId) ?? null;
            const particleCandidate = particleSystems.get(componentId) ?? null;
            const rendererCandidate = particleRenderers.get(componentId) ?? null;

            if (transformCandidate) transformDoc = transformCandidate;
            if (particleCandidate) particleDoc = particleCandidate;
            if (rendererCandidate) rendererDoc = rendererCandidate;
        }

        if (!transformDoc) continue;
        nodeMap.set(transformDoc.fileId, {
            gameObject: gameObjectDoc,
            transform: transformDoc,
            particleSystem: particleDoc,
            particleRenderer: rendererDoc,
        });
    }

    const allNodes: UnityPrefabNodeSummary[] = Array.from(nodeMap.values()).map((node) => ({
        gameObjectFileId: node.gameObject.fileId,
        transformFileId: node.transform.fileId,
        name: String(node.gameObject.data.m_Name ?? 'Unnamed'),
        parentTransformFileId: normalizeParentFileId(toFileId(node.transform.data.m_Father)),
        childTransformFileIds: Array.isArray(node.transform.data.m_Children)
            ? node.transform.data.m_Children.map((entry: any) => toFileId(entry)).filter((id: string | null): id is string => !!id)
            : [],
        localPosition: asVec3(node.transform.data.m_LocalPosition),
        localRotation: asQuat(node.transform.data.m_LocalRotation),
        localScale: asVec3(node.transform.data.m_LocalScale),
        particleSystem: node.particleSystem ? extractParticleSystemSummary(node.particleSystem.data) : null,
        particleRenderer: node.particleRenderer ? extractParticleRendererSummary(node.particleRenderer.data) : null,
    }));

    const rootNodes = allNodes.filter((node) => !node.parentTransformFileId);
    const particleNodes = allNodes.filter((node) => !!node.particleSystem);

    return { documents, rootNodes, allNodes, particleNodes };
}