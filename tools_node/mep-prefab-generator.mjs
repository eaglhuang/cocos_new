import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

// Material UUIDs (already in vfx_core bundle)
const MAT_ADDITIVE    = "bc53962f-518f-46cc-9d44-be308287d2a6"; // hitLineQ.mtl techIdx:1
const MAT_TRANSPARENT = "9371e79d-f81b-495d-a1f8-ccd8e8f55223"; // hit.mtl techIdx:0

// Load MEP texture UUIDs
const texUuids = JSON.parse(readFileSync(resolve(ROOT, "tools/mep_texture_uuids.json"), "utf8"));

// Load bubbleG.prefab as template (single-node, single-PS, 57 entries)
const templatePath = resolve(ROOT, "assets/bundles/vfx_core/prefabs/bubble/bubbleG.prefab");
function loadTemplate() { return JSON.parse(readFileSync(templatePath, "utf8")); }

function randomFileId(seed) {
  const hash = createHash("md5").update(seed + Date.now() + Math.random()).digest("hex");
  return Buffer.from(hash, "hex").toString("base64").replace(/\+/g, "-").replace(/\//g, "+").substring(0, 22);
}

// Cocos Creator ShapeModule shapeType enum: 0=Box 1=Sphere 2=Hemisphere 3=Cone 4=Circle
const SHAPE = { SPHERE:1, CONE:3, CIRCLE:4 };

const MEP_EFFECTS = [
  { id:"p3d_mep_buff_aura",     label:"MEP\u589E\u76CA\u5149\u74B0", category:"particle3d", folder:"mep_buff_aura",
    texKey:"mep_shape_star",       material:MAT_ADDITIVE,
    duration:1.0, loop:true,  capacity:30,  startSize:0.25, startSpeed:1.5, startLifetime:1.2,
    gravity:-0.3, rateOverTime:12, shapeType:SHAPE.CIRCLE, radius:0.8, simulationSpace:1,
    colorOverTime:true, color:{r:255,g:215,b:50,a:255}, renderMode:0, audio:"buff", scale:2.0, space:"3d" },

  { id:"p3d_mep_debuff_aura",   label:"MEP\u8CA0\u9762\u5149\u74B0", category:"particle3d", folder:"mep_debuff_aura",
    texKey:"mep_shape_electro",    material:MAT_ADDITIVE,
    duration:1.0, loop:true,  capacity:15,  startSize:0.2,  startSpeed:0.8, startLifetime:1.0,
    gravity:0.2,  rateOverTime:8,  shapeType:SHAPE.CIRCLE, radius:0.7, simulationSpace:1,
    colorOverTime:true, color:{r:180,g:50,b:255,a:255},  renderMode:0, audio:null, scale:2.0, space:"3d" },

  { id:"p3d_mep_healing_aura",  label:"MEP\u6CBB\u7652\u5149\u74B0", category:"particle3d", folder:"mep_healing_aura",
    texKey:"mep_shape_heart",      material:MAT_ADDITIVE,
    duration:2.0, loop:true,  capacity:12,  startSize:0.3,  startSpeed:0.8, startLifetime:2.0,
    gravity:-0.5, rateOverTime:4,  shapeType:SHAPE.CONE,   radius:0.4, simulationSpace:1,
    colorOverTime:true, color:{r:80,g:255,b:130,a:255},  renderMode:0, audio:"heal",  scale:2.0, space:"3d" },

  { id:"p3d_mep_sparks_orange", label:"MEP\u6A59\u8272\u661F\u706B", category:"particle3d", folder:"mep_sparks_orange",
    texKey:"mep_glow_flash",       material:MAT_ADDITIVE,
    duration:0.3, loop:false, capacity:25,  startSize:0.12, startSpeed:4.5, startLifetime:0.4,
    gravity:1.2,  rateOverTime:200,shapeType:SHAPE.SPHERE, radius:0.15,simulationSpace:1,
    colorOverTime:true, color:{r:255,g:190,b:70,a:255},  renderMode:0, audio:"hurt",  scale:1.5, space:"3d" },

  { id:"p3d_mep_sparks_blue",   label:"MEP\u85CD\u8272\u661F\u706B", category:"particle3d", folder:"mep_sparks_blue",
    texKey:"mep_glow_flash_free1", material:MAT_ADDITIVE,
    duration:0.3, loop:false, capacity:20,  startSize:0.1,  startSpeed:4.0, startLifetime:0.35,
    gravity:1.0,  rateOverTime:150,shapeType:SHAPE.SPHERE, radius:0.15,simulationSpace:1,
    colorOverTime:true, color:{r:80,g:170,b:255,a:255},  renderMode:0, audio:"hurt",  scale:1.5, space:"3d" },

  { id:"p3d_mep_explosion",     label:"MEP\u7206\u70B8\u6548\u679C", category:"particle3d", folder:"mep_explosion",
    texKey:"mep_glow_flash_free3", material:MAT_ADDITIVE,
    duration:0.5, loop:false, capacity:20,  startSize:0.7,  startSpeed:5.0, startLifetime:0.5,
    gravity:0.5,  rateOverTime:100,shapeType:SHAPE.SPHERE, radius:0.4, simulationSpace:1,
    colorOverTime:true, color:{r:255,g:130,b:30,a:255},  renderMode:0, audio:"boom", scale:3.0, space:"3d" },

  { id:"p3d_mep_electro_hit",   label:"MEP\u96F7\u64CA\u547D\u4E2D", category:"particle3d", folder:"mep_electro_hit",
    texKey:"mep_shape_electro",    material:MAT_ADDITIVE,
    duration:0.4, loop:false, capacity:10,  startSize:0.35, startSpeed:2.5, startLifetime:0.3,
    gravity:0.0,  rateOverTime:80, shapeType:SHAPE.SPHERE, radius:0.25,simulationSpace:1,
    colorOverTime:true, color:{r:130,g:200,b:255,a:255}, renderMode:0, audio:"thunder",scale:2.0,space:"3d" },

  { id:"p3d_mep_charge_slash",  label:"MEP\u84C4\u529B\u65AC\u64CA", category:"particle3d", folder:"mep_charge_slash",
    texKey:"mep_shape_slash",      material:MAT_ADDITIVE,
    duration:0.4, loop:false, capacity:8,   startSize:0.5,  startSpeed:2.5, startLifetime:0.25,
    gravity:0.0,  rateOverTime:60, shapeType:SHAPE.CIRCLE, radius:0.3, simulationSpace:1,
    colorOverTime:true, color:{r:200,g:240,b:255,a:255}, renderMode:0, audio:"weapon",scale:2.5,space:"3d" },

  { id:"p3d_mep_magic_ring",    label:"MEP\u9B54\u6CD5\u7C92\u5B50\u74B0", category:"particle3d", folder:"mep_magic_ring",
    texKey:"mep_ring_magic_circle",material:MAT_ADDITIVE,
    duration:1.0, loop:true,  capacity:6,   startSize:1.8,  startSpeed:0.2, startLifetime:1.0,
    gravity:0.0,  rateOverTime:4,  shapeType:SHAPE.CIRCLE, radius:0.05,simulationSpace:0,
    colorOverTime:true, color:{r:160,g:110,b:255,a:200}, renderMode:3, audio:"skill0",scale:3.0,space:"3d" },
];

function generatePrefab(effect) {
  const arr = loadTemplate();
  const texUuid = texUuids[effect.texKey];
  if (!texUuid) { console.error("Missing tex UUID: " + effect.texKey); return null; }

  arr[0]._name  = effect.folder;
  arr[1]._name  = effect.folder;
  arr[2]._name  = "particles";
  // bubbleG 模板的子節點預設 _lscale = 0.25，會讓所有粒子縮小到 1/4 大小
  // 必須重置為 1，避免 startSize 效果被壓縮成不可見的尺寸
  arr[2]._lscale.x = 1; arr[2]._lscale.y = 1; arr[2]._lscale.z = 1;

  const ps = arr[3];
  ps._materials       = [{ "__uuid__": effect.material }];
  ps.duration         = effect.duration;
  ps.loop             = effect.loop;
  ps._capacity        = effect.capacity;
  ps._simulationSpace = effect.simulationSpace;
  ps.playOnAwake      = true;

  arr[5].color.r = effect.color.r; arr[5].color.g = effect.color.g;
  arr[5].color.b = effect.color.b; arr[5].color.a = effect.color.a;

  arr[6].mode = 0; arr[6].constant = effect.startSize;       arr[6].multiplier = 1;
  arr[9].mode = 0; arr[9].constant = effect.startSpeed;      arr[9].multiplier = 1;
  arr[14].mode= 0; arr[14].constant= effect.startLifetime;   arr[14].multiplier= 1;
  arr[15].mode= 0; arr[15].constant= effect.gravity;         arr[15].multiplier= 1;
  arr[16].mode= 0; arr[16].constant= effect.rateOverTime;    arr[16].multiplier= 1;

  arr[18]._enable    = effect.colorOverTime ?? false;
  // Fix colorOverLifetime gradient: replace green bubbleG color with effect's own color (fade out to transparent)
  // _mode 3 = Gradient, keyed from full-alpha at start to alpha=0 at end
  arr[19]._mode = 3;
  delete arr[19].colorMin;
  delete arr[19].colorMax;
  arr[19].gradient = {
    "__type__": "cc.Gradient",
    "colorKeys": [
      { "color": { "__type__": "cc.Color", "r": effect.color.r, "g": effect.color.g, "b": effect.color.b, "a": 255 }, "time": 0 },
      { "color": { "__type__": "cc.Color", "r": effect.color.r, "g": effect.color.g, "b": effect.color.b, "a": 255 }, "time": 0.5 }
    ],
    "alphaKeys": [
      { "alpha": 255, "time": 0 },
      { "alpha": 0,   "time": 1 }
    ],
    "mode": 0
  };

  arr[20]._enable    = true;
  arr[20]._shapeType = effect.shapeType;
  arr[20].shapeType  = effect.shapeType;
  arr[20].radius     = effect.radius;

  arr[54]._mainTexture = { "__uuid__": texUuid + "@6c48a" };
  arr[54]._renderMode  = effect.renderMode ?? 0;
  arr[54]._useGPU      = false;

  arr[4].fileId  = randomFileId(effect.folder + "_comp");
  arr[55].fileId = randomFileId(effect.folder + "_child");
  arr[56].fileId = randomFileId(effect.folder + "_root");

  return arr;
}

const outputDir = resolve(ROOT, "assets/bundles/vfx_core/prefabs");
const registryLines = [];

console.log("MEP Prefab Generator starting...\n");

for (const effect of MEP_EFFECTS) {
  const prefabJson = generatePrefab(effect);
  if (!prefabJson) continue;

  const effectDir = resolve(outputDir, effect.folder);
  if (!existsSync(effectDir)) mkdirSync(effectDir, { recursive: true });

  const prefabPath = resolve(effectDir, effect.folder + ".prefab");
  writeFileSync(prefabPath, JSON.stringify(prefabJson, null, 2), "utf8");

  console.log("OK: prefabs/" + effect.folder + "/" + effect.folder + ".prefab");
  console.log("    tex=" + effect.texKey + "  dur=" + effect.duration + "s loop=" + effect.loop + " cap=" + effect.capacity + " rate=" + effect.rateOverTime + "/s");

  const audioStr = effect.audio ? "'" + effect.audio + "'" : "undefined";
  registryLines.push(
    "    { id: '" + effect.id + "', label: '" + effect.label + "', category: '" + effect.category +
    "', texPath: '', prefabPath: 'prefabs/" + effect.folder + "/" + effect.folder +
    "', blendMode: '" + (effect.material === MAT_ADDITIVE ? "additive" : "transparent") +
    "', audio: " + audioStr + ", scale: " + effect.scale + ", renderMode: 'cpu', space: '" + effect.space + "' },"
  );
}

const registryContent = [
  "",
  "    // --- [MEP Particle Prefabs] Magic Effects Pack translated to Cocos particle prefabs ---",
  ...registryLines,
].join("\n");

writeFileSync(resolve(ROOT, "tools/mep-registry-additions.ts"), registryContent, "utf8");

console.log("\nDone! Generated " + MEP_EFFECTS.length + " prefabs.");
console.log("Registry additions -> tools/mep-registry-additions.ts");