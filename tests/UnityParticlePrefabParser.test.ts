import { buildUnityCompoundEffectDraft, renderCompoundEffectSnippet } from '../unity/UnityParticleCompoundMapper';
import { extractUnityParticlePrefab, parseUnityYamlDocuments } from '../unity/UnityParticlePrefabParser';
import { TestSuite, assert } from './TestRunner';

const SAMPLE_UNITY_PREFAB = `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!1 &100
GameObject:
  m_Component:
    - component: {fileID: 101}
  m_Name: AuraRoot
--- !u!4 &101
Transform:
  m_GameObject: {fileID: 100}
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 0, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
  m_Children:
    - {fileID: 201}
  m_Father: {fileID: 0}
--- !u!1 &200
GameObject:
  m_Component:
    - component: {fileID: 201}
    - component: {fileID: 202}
    - component: {fileID: 203}
  m_Name: Runes
--- !u!4 &201
Transform:
  m_GameObject: {fileID: 200}
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 0.2, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
  m_Children: []
  m_Father: {fileID: 101}
--- !u!198 &202
ParticleSystem:
  lengthInSec: 1.5
  looping: 1
  playOnAwake: 1
  simulationSpeed: 1
  scalingMode: 1
  startDelay: {minMaxState: 0, scalar: 0}
  InitialModule:
    maxNumParticles: 64
    startLifetime: {minMaxState: 0, scalar: 1.5}
    startColor:
      minMaxState: 0
      maxColor: {r: 1, g: 0.86, b: 0.43, a: 0.92}
    startSize: {minMaxState: 0, scalar: 1.2}
    startSpeed: {minMaxState: 0, scalar: 0.8}
    gravityModifier: {minMaxState: 0, scalar: -0.3}
  EmissionModule:
    rateOverTime: {minMaxState: 0, scalar: 10}
    rateOverDistance: {minMaxState: 0, scalar: 0}
    m_BurstCount: 1
    m_Bursts:
      - time: 0
  ShapeModule:
    enabled: 1
    type: 10
    radius: {value: 0.7}
    angle: 0
    length: 0
    m_Scale: {x: 1, y: 1, z: 1}
  VelocityModule:
    enabled: 1
    x: {minMaxState: 0, scalar: 0.3}
    y: {minMaxState: 0, scalar: 1.5}
    z: {minMaxState: 0, scalar: 0}
    speedModifier: {minMaxState: 0, scalar: 1}
    inWorldSpace: 1
  ForceModule: {enabled: 0}
  RotationModule: {enabled: 0}
  SizeModule:
    enabled: 1
    separateAxes: 0
    curve: {minMaxState: 0, scalar: 0.55}
  ColorModule:
    enabled: 1
    gradient:
      minMaxState: 0
      maxColor: {r: 1, g: 0.52, b: 0.12, a: 0.5}
  UVModule: {enabled: 0}
  ClampVelocityModule: {enabled: 0}
  TrailModule: {enabled: 0}
  NoiseModule: {enabled: 0}
--- !u!199 &203
ParticleSystemRenderer:
  m_RenderMode: 1
  m_SortMode: 0
  m_NormalDirection: 1
  m_VelocityScale: 2
  m_LengthScale: 1
`;

export function createUnityParticlePrefabParserSuite(): TestSuite {
    const suite = new TestSuite('UnityParticlePrefabParser');

    suite.test('可解析 Unity ForceText 文件段落', () => {
        const docs = parseUnityYamlDocuments(SAMPLE_UNITY_PREFAB);
        assert.equals(6, docs.length);
        assert.equals('GameObject', docs[0].typeName);
        assert.equals('203', docs[5].fileId);
    });

    suite.test('可重建 prefab 階層與粒子節點摘要', () => {
        const summary = extractUnityParticlePrefab(SAMPLE_UNITY_PREFAB);
        assert.equals(1, summary.rootNodes.length);
        assert.equals('AuraRoot', summary.rootNodes[0].name);
        assert.equals(2, summary.allNodes.length);
        assert.equals(1, summary.particleNodes.length);

        const node = summary.particleNodes[0];
        assert.equals('Runes', node.name);
        assert.equals('101', node.parentTransformFileId);
        assert.isDefined(node.localPosition);
        assert.equals(0.2, node.localPosition!.y);
        assert.isDefined(node.particleSystem);
        assert.isDefined(node.particleRenderer);
        assert.equals(1.5, node.particleSystem!.duration);
        assert.isTrue(node.particleSystem!.looping);
        assert.equals(64, node.particleSystem!.maxParticles);
        assert.isDefined(node.particleSystem!.startColor);
        assert.equals(255, node.particleSystem!.startColor!.maxColor!.r);
        assert.equals(219, node.particleSystem!.startColor!.maxColor!.g);
        assert.equals(1.2, node.particleSystem!.startSize!.scalar);
        assert.equals(0.7, node.particleSystem!.shape.radius);
        assert.isTrue(node.particleSystem!.modules.sizeOverLifetime);
        assert.isTrue(node.particleSystem!.modules.colorOverLifetime);
        assert.equals(0.55, node.particleSystem!.sizeOverLifetime.size!.scalar);
        assert.equals(128, node.particleSystem!.colorOverLifetime.color!.maxColor!.a);
        assert.isTrue(node.particleSystem!.velocityOverLifetime.enabled);
        assert.equals(1.5, node.particleSystem!.velocityOverLifetime.y!.scalar);
        assert.equals(0.3, node.particleSystem!.velocityOverLifetime.x!.scalar);
        assert.equals(1, node.particleSystem!.velocityOverLifetime.space);
        assert.equals(1, node.particleRenderer!.renderMode);
        assert.equals(2, node.particleRenderer!.velocityScale);
    });

    suite.test('root 節點 parent fileID=0 時正確識別為根', () => {
        const summary = extractUnityParticlePrefab(SAMPLE_UNITY_PREFAB);
        assert.equals(null, summary.rootNodes[0].parentTransformFileId);
    });

    suite.test('可轉成 compound generator draft', () => {
      const summary = extractUnityParticlePrefab(SAMPLE_UNITY_PREFAB);
      const draft = buildUnityCompoundEffectDraft(summary, { effectId: 'p3d_unity_aura' });

      assert.equals('p3d_unity_aura', draft.effectId);
      assert.equals(1, draft.particleCount);
      assert.equals(1, draft.subPS.length);
      assert.equals('Runes', draft.subPS[0].name);
      assert.equals(4, draft.subPS[0].shapeType);
      assert.equals(1, draft.subPS[0].simulationSpace);
      assert.equals(1, draft.subPS[0].renderMode);
      assert.equals(255, draft.subPS[0].color.r);
      assert.equals(219, draft.subPS[0].color.g);
      assert.equals(110, draft.subPS[0].color.b);
      assert.equals(235, draft.subPS[0].color.a);
      assert.equals(2, draft.subPS[0].velocityScale);
      assert.equals(1, draft.subPS[0].lengthScale);
      assert.equals(0.55, draft.subPS[0].sizeOverLifetime.multiplier);
      assert.equals(255, draft.subPS[0].colorOverLifetime.color!.r);
      assert.equals(133, draft.subPS[0].colorOverLifetime.color!.g);
      assert.isFalse(draft.warnings.some((warning) => warning.includes('sizeOverLifetime')));
      assert.isFalse(draft.warnings.some((warning) => warning.includes('colorOverLifetime')));
      assert.isTrue(draft.subPS[0].velocityOverLifetime.enabled);
      assert.equals(0.3, draft.subPS[0].velocityOverLifetime.x);
      assert.equals(1.5, draft.subPS[0].velocityOverLifetime.y);
      assert.equals(1, draft.subPS[0].velocityOverLifetime.space);
      assert.isFalse(draft.warnings.some((warning) => warning.includes('velocityOverLifetime')));
    });

    suite.test('可輸出 compound generator snippet', () => {
      const summary = extractUnityParticlePrefab(SAMPLE_UNITY_PREFAB);
      const draft = buildUnityCompoundEffectDraft(summary, { effectId: 'p3d_unity_aura' });
      const snippet = renderCompoundEffectSnippet(draft, {
        label: 'Unity 光環',
        folder: 'unity_aura',
        scale: 1.25,
        audio: 'skill0',
      });

      assert.isTrue(snippet.includes("id: 'p3d_unity_aura'"));
      assert.isTrue(snippet.includes("label: 'Unity 光環'"));
      assert.isTrue(snippet.includes("folder: 'unity_aura'"));
      assert.isTrue(snippet.includes("audio: 'skill0'"));
      assert.isTrue(snippet.includes("shapeType: 4"));
      assert.isTrue(snippet.includes("renderMode: 1"));
      assert.isTrue(snippet.includes('sizeOverLifetime: { enabled: true, multiplier: 0.55 }'));
      assert.isTrue(snippet.includes('colorOverLifetime: { enabled: true, mode: 0'));
      assert.isTrue(snippet.includes('velocityOverLifetime: { enabled: true, x: 0.3, y: 1.5'));
    });

    return suite;
}