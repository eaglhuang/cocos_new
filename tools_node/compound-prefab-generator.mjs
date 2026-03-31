/**
 * compound-prefab-generator.mjs
 *
 * 單一 prefab 內包含多個 ParticleSystem 子節點（子物件各掛一個 PS）。
 * 對照 Unity：相當於一個 Prefab 下有多個 child GameObject，每個掛 ParticleSystem。
 *
 * bubbleG.prefab 模板索引對照表（單 PS 57 個 entry）：
 *   [0]  cc.Prefab
 *   [1]  cc.Node (root)
 *   [2]  cc.Node (child, PS 所在節點)  ← CHILD_START
 *   [3]  cc.ParticleSystem
 *   [4]  cc.CompPrefabInfo
 *   [5]  GradientRange  startColor
 *   [6]  CurveRange     startSizeX/startSize
 *   [7]  CurveRange     startSizeY
 *   [8]  CurveRange     startSizeZ
 *   [9]  CurveRange     startSpeed
 *   [10-13] CurveRange  startRotation, startDelay
 *   [14] CurveRange     startLifetime
 *   [15] CurveRange     gravityModifier
 *   [16] CurveRange     rateOverTime
 *   [17] CurveRange     rateOverDistance
 *   [18] ColorOvertimeModule
 *   [19] GradientRange  colorOverLifetime
 *   [20] ShapeModule
 *   [21-53] 其他 modules（SizeOvertime, Velocity, Force, Rotation, Texture, Trail...）
 *   [54] cc.ParticleSystemRenderer   ← CHILD_END
 *   [55] cc.PrefabInfo (child node 的 _prefab 指向這裡)
 *   [56] cc.PrefabInfo (root node 的 _prefab 指向這裡)
 *
 * Compound 策略：N 個子 PS 時，結構如下：
 *   [0]           cc.Prefab
 *   [1]           cc.Node (root, _children = [2, 2+53, 2+106, ...])
 *   [2..54]       第 0 個子 PS 的 53 個 entries
 *   [55..107]     第 1 個子 PS 的 53 個 entries
 *   ...
 *   [2+N*53..]    PrefabInfo × N（各子節點）
 *   [2+N*53+N]    PrefabInfo（root）
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, "..");

const MAT_ADDITIVE    = "bc53962f-518f-46cc-9d44-be308287d2a6";
const MAT_TRANSPARENT = "9371e79d-f81b-495d-a1f8-ccd8e8f55223";
const SHAPE = { SPHERE:1, CONE:3, CIRCLE:4 };
const GENERATED_EFFECTS_DIR = resolve(ROOT, "tools/generated-compounds");

// ─── 讀入模板 ────────────────────────────────────────────────────────────────
const templatePath = resolve(ROOT, "assets/bundles/vfx_core/prefabs/bubble/bubbleG.prefab");
function loadTemplate() { return JSON.parse(readFileSync(templatePath, "utf8")); }

const CHILD_START = 2;   // 模板中子 PS section 的起始 index
const CHILD_END   = 54;  // 模板中子 PS section 的結束 index（含 renderer）
const CHILD_SIZE  = CHILD_END - CHILD_START + 1; // = 53

// ─── 讀入 CFXR 貼圖 UUID ─────────────────────────────────────────────────────
const cfxrTexDir = resolve(ROOT, "assets/bundles/vfx_core/textures/cfxr");
const cfxrUuids  = {};
if (existsSync(cfxrTexDir)) {
  readdirSync(cfxrTexDir).filter(f => f.endsWith(".png.meta")).forEach(f => {
    const key  = f.replace(".png.meta", "");
    try {
      const meta = JSON.parse(readFileSync(resolve(cfxrTexDir, f), "utf8"));
      const subKeys = Object.keys(meta.subMetas || {});
      cfxrUuids[key] = subKeys.length > 0 ? meta.subMetas[subKeys[0]].uuid : meta.uuid + "@6c48a";
    } catch(e) {}
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function randomFileId(seed) {
  const hash = createHash("md5").update(seed + Date.now() + Math.random()).digest("hex");
  return Buffer.from(hash, "hex").toString("base64").replace(/\+/g,"-").replace(/\//g,"+").substring(0,22);
}

function makeColorGradient(r, g, b) {
  return {
    "__type__": "cc.Gradient",
    "colorKeys": [
      { "color": { "__type__": "cc.Color", "r": r, "g": g, "b": b, "a": 255 }, "time": 0 },
      { "color": { "__type__": "cc.Color", "r": r, "g": g, "b": b, "a": 255 }, "time": 0.5 }
    ],
    "alphaKeys": [{ "alpha": 255, "time": 0 }, { "alpha": 0, "time": 1 }],
    "mode": 0
  };
}

function normalizeExternalSubPS(sub) {
  return {
    ...sub,
    texKey: sub.texKey ?? sub.texKeyHint ?? "cfxr_aura_runic",
    material: sub.material ?? MAT_ADDITIVE,
    velocityScale: sub.velocityScale ?? 1,
    lengthScale: sub.lengthScale ?? 1,
  };
}

function normalizeExternalCompoundEffect(effect) {
  return {
    ...effect,
    label: effect.label ?? `${effect.id} (Unity import)`,
    folder: effect.folder ?? effect.id,
    scale: effect.scale ?? 1.0,
    audio: effect.audio ?? null,
    subPS: Array.isArray(effect.subPS) ? effect.subPS.map(normalizeExternalSubPS) : [],
  };
}

function loadExternalCompoundEffects() {
  if (!existsSync(GENERATED_EFFECTS_DIR)) return [];

  return readdirSync(GENERATED_EFFECTS_DIR)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => {
      const filePath = resolve(GENERATED_EFFECTS_DIR, file);
      try {
        const raw = JSON.parse(readFileSync(filePath, "utf8"));
        const list = Array.isArray(raw) ? raw : [raw];
        return list
          .filter((effect) => effect && effect.id && Array.isArray(effect.subPS))
          .map(normalizeExternalCompoundEffect);
      } catch (error) {
        console.warn(`SKIP generated compound draft ${file}: ${error.message}`);
        return [];
      }
    });
}

function mergeCompoundEffects(...groups) {
  const merged = new Map();
  for (const group of groups) {
    for (const effect of group) {
      merged.set(effect.id, effect);
    }
  }
  return [...merged.values()];
}

/**
 * 深度複製 entry，並將所有 __id__: N (N 在 [CHILD_START..CHILD_END]) 加上 offset。
 * __id__: 55（子節點的 PrefabInfo 引用）改為 childPrefabInfoIdx。
 */
function cloneWithOffset(entry, offset, childPrefabInfoIdx) {
  let str = JSON.stringify(entry);
  str = str.replace(/"__id__":\s*(\d+)/g, (match, numStr) => {
    const n = parseInt(numStr, 10);
    if (n >= CHILD_START && n <= CHILD_END) return `"__id__": ${n + offset}`;
    if (n === 55) return `"__id__": ${childPrefabInfoIdx}`;
    return match; // 0 (asset), 1 (root node) 不動
  });
  return JSON.parse(str);
}

/**
 * 對 result 陣列中 base 開始的子 PS section 套用 SubPS 設定。
 * base = 2 + i * CHILD_SIZE
 * result[base + (j-2)] 對應原始模板的 arr[j]
 */
function applySubConfig(result, base, sub) {
  const node       = result[base + 0];   // arr[2] cc.Node
  const ps         = result[base + 1];   // arr[3] cc.ParticleSystem
  const colorStart = result[base + 3];   // arr[5] GradientRange startColor
  const sizeX      = result[base + 4];   // arr[6] CurveRange startSizeX
  const sizeY      = result[base + 5];   // arr[7]
  const sizeZ      = result[base + 6];   // arr[8]
  const speed      = result[base + 7];   // arr[9] startSpeed
  const lifetime   = result[base + 12];  // arr[14] startLifetime
  const gravity    = result[base + 13];  // arr[15] gravityModifier
  const rate       = result[base + 14];  // arr[16] rateOverTime
  const colorMod   = result[base + 16];  // arr[18] ColorOvertimeModule
  const colorGrad  = result[base + 17];  // arr[19] GradientRange colorOverLifetime
  const shape      = result[base + 18];  // arr[20] ShapeModule
  const sizeOvertime = result[base + 20]; // arr[22] SizeOvertimeModule
  const sizeOvertimeSize = result[base + 21]; // arr[23] CurveRange size
  const velMod     = result[base + 26];  // arr[28] VelocityOvertimeModule
  const velX       = result[base + 27];  // arr[29] CurveRange velocity.x
  const velY       = result[base + 28];  // arr[30] CurveRange velocity.y
  const velZ       = result[base + 29];  // arr[31] CurveRange velocity.z
  const velSpd     = result[base + 30];  // arr[32] CurveRange speedModifier
  const renderer   = result[base + 52];  // arr[54] ParticleSystemRenderer

  // ── Node ──
  node._name = sub.name;
  // 重置 scale（bubbleG 模板預設 0.25）
  node._lscale = { "__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1 };
  // 若有自訂 rotation 才覆蓋（預設保持模板的 +90° X，讓 Circle emitter 朝上噴）
  if (sub.rotation) {
    node._lrot   = sub.rotation.lrot;
    node._euler  = sub.rotation.euler;
  }
  if (sub.position) {
    node._lpos = sub.position;
  }

  // ── ParticleSystem ──
  ps._materials       = [{ "__uuid__": sub.material }];
  ps.duration         = sub.duration;
  ps.loop             = sub.loop;
  ps._capacity        = sub.capacity;
  ps._simulationSpace = sub.simulationSpace;
  ps.playOnAwake      = true;
  ps.bursts           = [];

  // ── StartColor ──
  colorStart.color = { "__type__": "cc.Color", "r": sub.color.r, "g": sub.color.g, "b": sub.color.b, "a": sub.color.a };

  // ── Size / Speed / Lifetime / Gravity / Rate ──
  sizeX.mode = 0; sizeX.constant = sub.startSize;     sizeX.multiplier = 1;
  sizeY.mode = 0; sizeY.constant = sub.startSize;     sizeY.multiplier = 1;
  sizeZ.mode = 0; sizeZ.constant = sub.startSize;     sizeZ.multiplier = 1;
  speed.mode = 0; speed.constant = sub.startSpeed;    speed.multiplier = 1;
  lifetime.mode = 0; lifetime.constant = sub.startLifetime; lifetime.multiplier = 1;
  gravity.mode  = 0; gravity.constant  = sub.gravity;       gravity.multiplier  = 1;
  rate.mode  = 0; rate.constant  = sub.rateOverTime;  rate.multiplier  = 1;

  // ── ColorOverLifetime：淡出 ──
  if (sub.colorOverLifetime?.enabled && sub.colorOverLifetime.color) {
    colorMod._enable = true;
    colorGrad._mode = sub.colorOverLifetime.mode ?? 0;
    delete colorGrad.gradient;
    delete colorGrad.color;
    delete colorGrad.colorMin;
    delete colorGrad.colorMax;
    if ((sub.colorOverLifetime.mode ?? 0) === 2 && sub.colorOverLifetime.colorMin) {
      colorGrad.colorMin = { "__type__": "cc.Color", ...sub.colorOverLifetime.colorMin };
      colorGrad.colorMax = { "__type__": "cc.Color", ...sub.colorOverLifetime.color };
    } else {
      colorGrad._mode = 0;
      colorGrad.color = { "__type__": "cc.Color", ...sub.colorOverLifetime.color };
    }
  } else {
    colorMod._enable = true;
    colorGrad._mode  = 3; // Gradient
    delete colorGrad.colorMin; delete colorGrad.colorMax; delete colorGrad.color;
    colorGrad.gradient = makeColorGradient(sub.color.r, sub.color.g, sub.color.b);
  }

  // ── SizeOverLifetime：目前支援常數倍率 ──
  sizeOvertime._enable = !!sub.sizeOverLifetime?.enabled;
  sizeOvertime.separateAxes = false;
  sizeOvertimeSize.mode = 0;
  sizeOvertimeSize.constant = sub.sizeOverLifetime?.multiplier ?? 1;
  sizeOvertimeSize.multiplier = 1;

  // ── VelocityOverLifetime：目前支援常數 XYZ ──
  velMod._enable = !!sub.velocityOverLifetime?.enabled;
  velMod.space   = sub.velocityOverLifetime?.space ?? 1;
  velX.mode = 0; velX.constant = sub.velocityOverLifetime?.x ?? 0;             velX.multiplier = 1;
  velY.mode = 0; velY.constant = sub.velocityOverLifetime?.y ?? 0;             velY.multiplier = 1;
  velZ.mode = 0; velZ.constant = sub.velocityOverLifetime?.z ?? 0;             velZ.multiplier = 1;
  velSpd.mode = 0; velSpd.constant = sub.velocityOverLifetime?.speedModifier ?? 1; velSpd.multiplier = 1;

  // ── Shape ──
  shape._enable    = true;
  shape._shapeType = sub.shapeType;
  shape.shapeType  = sub.shapeType;
  shape.radius     = sub.radius;

  // ── Renderer ──
  renderer._mainTexture   = { "__uuid__": cfxrUuids[sub.texKey] };
  renderer._renderMode    = sub.renderMode ?? 0;
  renderer._useGPU        = false;
  // Stretched Billboard 拉伸係數（renderMode=1 才有意義）
  renderer._velocityScale = sub.velocityScale ?? 0;
  renderer._lengthScale   = sub.lengthScale   ?? 0;

  // ── fileId（隨機化，避免衝突）──
  result[base + 2].fileId = randomFileId(sub.name + "_compinfo");
}

// ─── 複合 Prefab 建構器 ──────────────────────────────────────────────────────
function buildCompoundPrefab(effectId, subPSList) {
  const template = loadTemplate();
  const N = subPSList.length;
  const result = [];

  // [0] cc.Prefab
  const prefabEntry = JSON.parse(JSON.stringify(template[0]));
  prefabEntry.data = { "__id__": 1 };
  result.push(prefabEntry);

  // [1] Root cc.Node（子節點列表 + 更新 _prefab 指向最後的 root PrefabInfo）
  const rootNode = JSON.parse(JSON.stringify(template[1]));
  rootNode._name = effectId;
  rootNode._children = [];
  for (let i = 0; i < N; i++) {
    rootNode._children.push({ "__id__": 2 + i * CHILD_SIZE });
  }
  const rootPrefabInfoIdx = 2 + N * CHILD_SIZE + N;
  rootNode._prefab = { "__id__": rootPrefabInfoIdx };
  result.push(rootNode);

  // [2 .. 2+N*CHILD_SIZE-1] 各子 PS section
  for (let i = 0; i < N; i++) {
    const offset           = i * CHILD_SIZE;    // id offset for __id__ remapping
    const childPrefabInfoIdx = 2 + N * CHILD_SIZE + i;

    for (let j = CHILD_START; j <= CHILD_END; j++) {
      result.push(cloneWithOffset(template[j], offset, childPrefabInfoIdx));
    }
  }

  // [2+N*CHILD_SIZE .. 2+N*CHILD_SIZE+N-1]  各子節點的 PrefabInfo
  for (let i = 0; i < N; i++) {
    result.push({
      "__type__": "cc.PrefabInfo",
      "root":   { "__id__": 1 },
      "asset":  { "__id__": 0 },
      "fileId": randomFileId(effectId + "_child" + i + "_pinfo")
    });
  }

  // [rootPrefabInfoIdx]  Root PrefabInfo
  result.push({
    "__type__": "cc.PrefabInfo",
    "root":   { "__id__": 1 },
    "asset":  { "__id__": 0 },
    "fileId": randomFileId(effectId + "_root_pinfo")
  });

  // 套用各子 PS 參數
  for (let i = 0; i < N; i++) {
    const base = 2 + i * CHILD_SIZE;
    const sub  = subPSList[i];
    if (!cfxrUuids[sub.texKey]) {
      console.warn(`  WARN: texKey not found: ${sub.texKey} (sub.name=${sub.name})`);
    } else {
      applySubConfig(result, base, sub);
    }
  }

  return result;
}

// ─── 複合特效定義 ─────────────────────────────────────────────────────────────
//
// 每個 subPS 代表一個子 ParticleSystem：
//   name          子節點名稱
//   texKey        與 cfxr textures 的 key（對應 cfxr_*.png.meta）
//   material      UUID（MAT_ADDITIVE or MAT_TRANSPARENT）
//   color         {r,g,b,a}
//   startSize     粒子大小（世界單位）
//   startSpeed    初始速度
//   startLifetime 生命週期（秒）
//   gravity       重力（負值=向上浮）
//   rateOverTime  每秒發射量
//   shapeType     SPHERE=1 CONE=3 CIRCLE=4
//   radius        發射器半徑
//   simulationSpace  0=World 1=Local
//   loop          true/false
//   duration      秒
//   capacity      最大粒子數
//   renderMode    0=Billboard 1=Stretched 3=VerticalBillboard
//
// rotation / position 可選，預設維持模板 (+90° X → Circle 朝上噴)

// ─── 尺度計算 ─────────────────────────────────────────────────────────────────
// cellSize = 1.0 WU（BoardRenderer.cellSize 預設值）
// 角色寬約 0.6 WU → 光環目標直徑 0.8 WU → radius = 0.4 WU
// registry scale=1.0，所有 PS 參數直接等於世界單位
//
// 重力規則（Cocos）：gravity < 0 → 向上漂
// Circle emitter：speed > 0 → 沿徑向向外射（容易跑遠）
//   → 用極小 speed 只讓粒子稍微飄，主要靠 gravity 向上浮
//
// Stretched Billboard（renderMode=1）：
//   粒子需有速度才拉伸 → speed=0 + 大負 gravity → 累積向上速度形成光柱

const BUILTIN_COMPOUND_EFFECTS = [
  // 所有複合特效已遷移至 tools/generated-compounds/*.json（Unity 自動生成草稿）
];

const COMPOUND_EFFECTS = mergeCompoundEffects(
  BUILTIN_COMPOUND_EFFECTS,
  loadExternalCompoundEffects(),
);

// ─── 輸出 ─────────────────────────────────────────────────────────────────────
const outputDir    = resolve(ROOT, "assets/bundles/vfx_core/prefabs");
const registryLines = [];

console.log("Compound Prefab Generator starting...\n");

for (const effect of COMPOUND_EFFECTS) {
  // 確認所有 texKey 存在
  const missingTex = effect.subPS.filter(s => !cfxrUuids[s.texKey]).map(s => s.texKey);
  if (missingTex.length > 0) {
    console.warn(`SKIP ${effect.id}: missing textures -> ${missingTex.join(", ")}`);
    console.warn("  Run Cocos Creator refresh first, then re-run this script.");
    continue;
  }

  const prefabJson = buildCompoundPrefab(effect.id, effect.subPS);
  const effectDir  = resolve(outputDir, effect.folder);
  if (!existsSync(effectDir)) mkdirSync(effectDir, { recursive: true });

  const prefabPath = resolve(effectDir, effect.folder + ".prefab");
  writeFileSync(prefabPath, JSON.stringify(prefabJson, null, 2), "utf8");

  const totalEntries = prefabJson.length;
  console.log(`OK: ${effect.folder}.prefab  (${effect.subPS.length} sub-PS, ${totalEntries} entries)`);
  effect.subPS.forEach((s, i) => {
    console.log(`    [${i}] ${s.name}  tex=${s.texKey}  size=${s.startSize}  rate=${s.rateOverTime}/s  renderMode=${s.renderMode ?? 0}`);
  });

  const audioStr = effect.audio ? `'${effect.audio}'` : "undefined";
  registryLines.push(
    `    { id: '${effect.id}', label: '${effect.label}', category: 'particle3d', texPath: '', ` +
    `prefabPath: 'prefabs/${effect.folder}/${effect.folder}', ` +
    `blendMode: 'additive', audio: ${audioStr}, scale: ${effect.scale}, renderMode: 'cpu', space: '3d' },`
  );
}

const content = "\n    // --- [COMPOUND] Multi-PS compound effects ---\n" + registryLines.join("\n") + "\n";
writeFileSync(resolve(ROOT, "tools/compound-registry-additions.ts"), content, "utf8");

console.log("\nDone! Registry -> tools/compound-registry-additions.ts");
