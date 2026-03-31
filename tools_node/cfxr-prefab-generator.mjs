import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const MAT_ADDITIVE    = "bc53962f-518f-46cc-9d44-be308287d2a6";
const MAT_TRANSPARENT = "9371e79d-f81b-495d-a1f8-ccd8e8f55223";
const SHAPE = { SPHERE:1, CONE:3, CIRCLE:4 };

// Read UUID from .meta file
function getTexUuid(metaPath) {
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    const subKeys = Object.keys(meta.subMetas || {});
    if (subKeys.length > 0) {
      return meta.subMetas[subKeys[0]].uuid; // e.g. "xxxxxxxx@6c48a"
    }
    return meta.uuid + "@6c48a";
  } catch(e) { return null; }
}

// Scan textures/cfxr/*.meta for all UUIDs
const cfxrTexDir = resolve(ROOT, "assets/bundles/vfx_core/textures/cfxr");
const cfxrUuids = {};
if (existsSync(cfxrTexDir)) {
  readdirSync(cfxrTexDir).filter(f => f.endsWith(".png.meta")).forEach(f => {
    const key = f.replace(".png.meta", ""); // e.g. "cfxr_hit_triangle"
    const uuid = getTexUuid(resolve(cfxrTexDir, f));
    if (uuid) cfxrUuids[key] = uuid;
  });
}
console.log("Found CFXR texture UUIDs:", Object.keys(cfxrUuids).length);
writeFileSync(resolve(ROOT, "tools/cfxr_texture_uuids.json"), JSON.stringify(cfxrUuids, null, 2), "utf8");
if (Object.keys(cfxrUuids).length === 0) {
  console.error("No CFXR texture UUIDs found! Run Cocos Creator refresh first, then re-run this script.");
  process.exit(1);
}

const templatePath = resolve(ROOT, "assets/bundles/vfx_core/prefabs/bubble/bubbleG.prefab");
function loadTemplate() { return JSON.parse(readFileSync(templatePath, "utf8")); }
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

// 20 CFXR particle effects targeting cartoon/stylized combat game
const CFXR_EFFECTS = [
  { id:"p3d_cfxr_hit_red",      label:"CFXR\u7D05\u8272\u6253\u64CA",   folder:"cfxr_hit_red",
    texKey:"cfxr_hit_triangle",       material:MAT_ADDITIVE, duration:0.35, loop:false, capacity:12, startSize:0.5, startSpeed:3.5, startLifetime:0.3, gravity:0.0, rateOverTime:80, shapeType:SHAPE.SPHERE, radius:0.1, simulationSpace:1, color:{r:255,g:80,b:50,a:255},  renderMode:0, audio:"hurt",  scale:1.5, space:"3d" },
  { id:"p3d_cfxr_hit_yellow",   label:"CFXR\u9EC3\u8272\u6253\u64CA",   folder:"cfxr_hit_yellow",
    texKey:"cfxr_hit_triangle_2",     material:MAT_ADDITIVE, duration:0.35, loop:false, capacity:12, startSize:0.5, startSpeed:3.5, startLifetime:0.3, gravity:0.0, rateOverTime:80, shapeType:SHAPE.SPHERE, radius:0.1, simulationSpace:1, color:{r:255,g:220,b:60,a:255}, renderMode:0, audio:"hurt",  scale:1.5, space:"3d" },
  { id:"p3d_cfxr_spikes_impact",label:"CFXR\u5C16\u523A\u885D\u64CA",   folder:"cfxr_spikes_impact",
    texKey:"cfxr_spikes_impact",      material:MAT_ADDITIVE, duration:0.5,  loop:false, capacity:8,  startSize:0.6, startSpeed:4.0, startLifetime:0.4, gravity:0.0, rateOverTime:60, shapeType:SHAPE.CIRCLE, radius:0.2, simulationSpace:1, color:{r:255,g:180,b:60,a:255}, renderMode:0, audio:"hurt",  scale:2.0, space:"3d" },
  { id:"p3d_cfxr_electric_spark",label:"CFXR\u96FB\u706B\u82B1",        folder:"cfxr_electric_spark",
    texKey:"cfxr_electric_spark",     material:MAT_ADDITIVE, duration:0.4,  loop:false, capacity:15, startSize:0.25,startSpeed:3.0, startLifetime:0.35, gravity:0.5, rateOverTime:50, shapeType:SHAPE.SPHERE, radius:0.2, simulationSpace:1, color:{r:160,g:220,b:255,a:255}, renderMode:1, audio:"thunder",scale:1.5, space:"3d" },
  { id:"p3d_cfxr_electric_ring", label:"CFXR\u96FB\u6C17\u74B0",        folder:"cfxr_electric_ring",
    texKey:"cfxr_ring_electric",      material:MAT_ADDITIVE, duration:0.5,  loop:false, capacity:4,  startSize:1.8, startSpeed:0.1, startLifetime:0.4, gravity:0.0, rateOverTime:20, shapeType:SHAPE.CIRCLE, radius:0.05, simulationSpace:0, color:{r:140,g:200,b:255,a:255}, renderMode:3, audio:"thunder",scale:2.5, space:"3d" },
  { id:"p3d_cfxr_star_gold",     label:"CFXR\u91D1\u8272\u661F\u661F",  folder:"cfxr_star_gold",
    texKey:"cfxr_star",               material:MAT_ADDITIVE, duration:0.8,  loop:false, capacity:10, startSize:0.35,startSpeed:2.0, startLifetime:0.7, gravity:-0.3,rateOverTime:30, shapeType:SHAPE.SPHERE, radius:0.2, simulationSpace:1, color:{r:255,g:230,b:80,a:255},  renderMode:0, audio:null, scale:2.0, space:"3d" },
  { id:"p3d_cfxr_star_blurred",  label:"CFXR\u661F\u5149\u6563\u5C04",  folder:"cfxr_star_blurred",
    texKey:"cfxr_star_blurred",       material:MAT_ADDITIVE, duration:1.0,  loop:true,  capacity:12, startSize:0.3, startSpeed:1.5, startLifetime:1.0, gravity:-0.2,rateOverTime:8,  shapeType:SHAPE.SPHERE, radius:0.3, simulationSpace:1, color:{r:255,g:255,b:200,a:255}, renderMode:0, audio:null, scale:2.0, space:"3d" },
  { id:"p3d_cfxr_flare_heal",    label:"CFXR\u6CBB\u7652\u5149\u6688",  folder:"cfxr_flare_heal",
    texKey:"cfxr_flare",              material:MAT_ADDITIVE, duration:0.6,  loop:false, capacity:3,  startSize:2.5, startSpeed:0.0, startLifetime:0.5, gravity:0.0, rateOverTime:5, shapeType:SHAPE.CIRCLE, radius:0.0, simulationSpace:0, color:{r:120,g:255,b:160,a:200}, renderMode:0, audio:"heal", scale:2.5, space:"3d" },
  { id:"p3d_cfxr_fire_crisp",    label:"CFXR\u6E05\u6670\u706B\u7130",  folder:"cfxr_fire_crisp",
    texKey:"cfxr_flamme_crisp",       material:MAT_ADDITIVE, duration:1.0,  loop:true,  capacity:15, startSize:0.5, startSpeed:2.5, startLifetime:0.6, gravity:-1.2,rateOverTime:20, shapeType:SHAPE.CONE,   radius:0.15,simulationSpace:0, color:{r:255,g:160,b:40,a:255},  renderMode:0, audio:"fireball",scale:2.0,space:"3d" },
  { id:"p3d_cfxr_fire_circle",   label:"CFXR\u706B\u5708",              folder:"cfxr_fire_circle",
    texKey:"cfxr_fire_circle_crisp",  material:MAT_ADDITIVE, duration:1.0,  loop:true,  capacity:8,  startSize:1.5, startSpeed:0.0, startLifetime:0.8, gravity:0.0, rateOverTime:8,  shapeType:SHAPE.CIRCLE, radius:0.5, simulationSpace:0, color:{r:255,g:120,b:30,a:255},  renderMode:0, audio:"fireball",scale:2.5,space:"3d" },
  { id:"p3d_cfxr_smoke",         label:"CFXR\u7159\u970E",              folder:"cfxr_smoke",
    texKey:"cfxr_smoke_cloud_x4",     material:MAT_TRANSPARENT, duration:0.8, loop:false, capacity:8, startSize:0.8, startSpeed:1.0, startLifetime:1.0, gravity:-0.2,rateOverTime:20, shapeType:SHAPE.SPHERE, radius:0.2, simulationSpace:1, color:{r:180,g:180,b:180,a:180}, renderMode:0, audio:null, scale:2.5, space:"3d" },
  { id:"p3d_cfxr_smoke_white",   label:"CFXR\u767D\u7159",              folder:"cfxr_smoke_white",
    texKey:"cfxr_smoke_cloud_x4_white", material:MAT_TRANSPARENT, duration:1.0, loop:true, capacity:6, startSize:1.0, startSpeed:0.8, startLifetime:1.5, gravity:-0.3,rateOverTime:4,  shapeType:SHAPE.CONE,   radius:0.1, simulationSpace:1, color:{r:230,g:230,b:240,a:160}, renderMode:0, audio:null, scale:2.0, space:"3d" },
  { id:"p3d_cfxr_bubble",        label:"CFXR\u6CE1\u6CE1",              folder:"cfxr_bubble",
    texKey:"cfxr_bubble",             material:MAT_ADDITIVE, duration:1.5,  loop:true,  capacity:10, startSize:0.3, startSpeed:0.8, startLifetime:1.5, gravity:-0.5,rateOverTime:5,  shapeType:SHAPE.SPHERE, radius:0.2, simulationSpace:1, color:{r:100,g:200,b:255,a:200}, renderMode:0, audio:null, scale:1.5, space:"3d" },
  { id:"p3d_cfxr_aura_runic",    label:"CFXR\u7B26\u6587\u5149\u74B0", folder:"cfxr_aura_runic",
    texKey:"cfxr_aura_runic",         material:MAT_ADDITIVE, duration:1.0,  loop:true,  capacity:12, startSize:1.4, startSpeed:0.8, startLifetime:1.5, gravity:-0.3,rateOverTime:10, shapeType:SHAPE.CIRCLE, radius:0.7, simulationSpace:1, color:{r:255,g:220,b:100,a:255}, renderMode:0, audio:"skill0",scale:2.5, space:"3d" },
  { id:"p3d_cfxr_aura_rays",     label:"CFXR\u5C04\u7DDA\u5149\u74B0", folder:"cfxr_aura_rays",
    texKey:"cfxr_aura_rays",          material:MAT_ADDITIVE, duration:1.0,  loop:true,  capacity:8,  startSize:1.0, startSpeed:0.3, startLifetime:1.5, gravity:0.0, rateOverTime:5,  shapeType:SHAPE.CIRCLE, radius:0.5, simulationSpace:0, color:{r:255,g:240,b:150,a:255}, renderMode:0, audio:"buff",  scale:2.5, space:"3d" },
  { id:"p3d_cfxr_heart",         label:"CFXR\u611B\u5FC3",              folder:"cfxr_heart",
    texKey:"cfxr_heart",              material:MAT_ADDITIVE, duration:1.0,  loop:false, capacity:6,  startSize:0.4, startSpeed:1.5, startLifetime:1.2, gravity:-0.8,rateOverTime:20, shapeType:SHAPE.SPHERE, radius:0.1, simulationSpace:1, color:{r:255,g:100,b:140,a:255}, renderMode:0, audio:"heal", scale:2.0, space:"3d" },
  { id:"p3d_cfxr_skull",         label:"CFXR\u5916\u9AB8\u982D",        folder:"cfxr_skull",
    texKey:"cfxr_skull",              material:MAT_ADDITIVE, duration:0.8,  loop:false, capacity:5,  startSize:0.5, startSpeed:1.0, startLifetime:0.8, gravity:-0.5,rateOverTime:15, shapeType:SHAPE.SPHERE, radius:0.15,simulationSpace:1, color:{r:200,g:80,b:255,a:255},  renderMode:0, audio:null, scale:2.0, space:"3d" },
  { id:"p3d_cfxr_ring_ice",      label:"CFXR\u51B0\u5176\u74B0",        folder:"cfxr_ring_ice",
    texKey:"cfxr_ring_ice",           material:MAT_ADDITIVE, duration:0.6,  loop:false, capacity:3,  startSize:2.5, startSpeed:0.0, startLifetime:0.5, gravity:0.0, rateOverTime:10, shapeType:SHAPE.CIRCLE, radius:0.0, simulationSpace:0, color:{r:160,g:230,b:255,a:220}, renderMode:3, audio:null, scale:3.0, space:"3d" },
  { id:"p3d_cfxr_ember",         label:"CFXR\u706B\u661F\u98DB\u8DBA",  folder:"cfxr_ember",
    texKey:"cfxr_ember_blur",         material:MAT_ADDITIVE, duration:2.0,  loop:true,  capacity:20, startSize:0.15,startSpeed:1.5, startLifetime:1.5, gravity:-0.3,rateOverTime:10, shapeType:SHAPE.CONE,   radius:0.2, simulationSpace:1, color:{r:255,g:160,b:60,a:255},  renderMode:0, audio:null, scale:1.5, space:"3d" },
  { id:"p3d_cfxr_slash_ray",     label:"CFXR\u65AC\u64CA\u5C04\u7DDA",  folder:"cfxr_slash_ray",
    texKey:"cfxr_stretch_ray_blur",   material:MAT_ADDITIVE, duration:0.3,  loop:false, capacity:4,  startSize:0.8, startSpeed:3.0, startLifetime:0.2, gravity:0.0, rateOverTime:40, shapeType:SHAPE.CIRCLE, radius:0.05,simulationSpace:0, color:{r:220,g:240,b:255,a:255}, renderMode:1, audio:"weapon",scale:2.0, space:"3d" },
];

function generatePrefab(effect) {
  const texUuid = cfxrUuids[effect.texKey];
  if (!texUuid) { console.warn("  SKIP (no UUID yet): " + effect.texKey); return null; }

  const arr = loadTemplate();
  arr[0]._name = effect.folder;
  arr[1]._name = effect.folder;
  arr[2]._name = "particles";
  // bubbleG 模板子節點預設 _lscale = 0.25，必須重置為 1，否則粒子被壓縮到 1/4 大小
  arr[2]._lscale.x = 1; arr[2]._lscale.y = 1; arr[2]._lscale.z = 1;

  const ps = arr[3];
  ps._materials       = [{ "__uuid__": effect.material }];
  ps.duration         = effect.duration;
  ps.loop             = effect.loop;
  ps._capacity        = effect.capacity;
  ps._simulationSpace = effect.simulationSpace;
  ps.playOnAwake      = true;
  ps.bursts           = []; // always empty - use rateOverTime instead

  arr[5].color.r = effect.color.r; arr[5].color.g = effect.color.g;
  arr[5].color.b = effect.color.b; arr[5].color.a = effect.color.a;

  arr[6].mode = 0; arr[6].constant = effect.startSize;     arr[6].multiplier = 1;
  arr[9].mode = 0; arr[9].constant = effect.startSpeed;    arr[9].multiplier = 1;
  arr[14].mode= 0; arr[14].constant= effect.startLifetime; arr[14].multiplier= 1;
  arr[15].mode= 0; arr[15].constant= effect.gravity;       arr[15].multiplier= 1;
  arr[16].mode= 0; arr[16].constant= effect.rateOverTime;  arr[16].multiplier= 1;

  arr[18]._enable = true;
  arr[19]._mode   = 3;
  delete arr[19].colorMin; delete arr[19].colorMax;
  arr[19].gradient = makeColorGradient(effect.color.r, effect.color.g, effect.color.b);

  arr[20]._enable    = true;
  arr[20]._shapeType = effect.shapeType;
  arr[20].shapeType  = effect.shapeType;
  arr[20].radius     = effect.radius;

  arr[54]._mainTexture = { "__uuid__": texUuid };
  arr[54]._renderMode  = effect.renderMode ?? 0;
  arr[54]._useGPU      = false;

  arr[4].fileId  = randomFileId(effect.folder + "_comp");
  arr[55].fileId = randomFileId(effect.folder + "_child");
  arr[56].fileId = randomFileId(effect.folder + "_root");

  return arr;
}

const outputDir = resolve(ROOT, "assets/bundles/vfx_core/prefabs");
const registryLines = [];
let generated = 0, skipped = 0;

console.log("\nCFXR Prefab Generator starting...\n");

for (const effect of CFXR_EFFECTS) {
  const prefabJson = generatePrefab(effect);
  if (!prefabJson) { skipped++; continue; }

  const effectDir = resolve(outputDir, effect.folder);
  if (!existsSync(effectDir)) mkdirSync(effectDir, { recursive: true });
  const prefabPath = resolve(effectDir, effect.folder + ".prefab");
  writeFileSync(prefabPath, JSON.stringify(prefabJson, null, 2), "utf8");
  generated++;
  console.log("OK: prefabs/" + effect.folder + " (tex=" + effect.texKey + ")");

  const audioStr = effect.audio ? "'" + effect.audio + "'" : "undefined";
  const blendMode = effect.material === MAT_ADDITIVE ? "additive" : "transparent";
  registryLines.push(
    "    { id: '" + effect.id + "', label: '" + effect.label + "', category: 'particle3d', texPath: '', prefabPath: 'prefabs/" + effect.folder + "/" + effect.folder +
    "', blendMode: '" + blendMode + "', audio: " + audioStr + ", scale: " + effect.scale + ", renderMode: 'cpu', space: '" + effect.space + "' },"
  );
}

const content = "\n    // --- [CFXR] Cartoon FX Remaster FREE particle prefabs ---\n" + registryLines.join("\n") + "\n";
writeFileSync(resolve(ROOT, "tools/cfxr-registry-additions.ts"), content, "utf8");

console.log("\nGenerated: " + generated + " / " + CFXR_EFFECTS.length + "  Skipped (need Cocos refresh): " + skipped);
console.log("Registry -> tools/cfxr-registry-additions.ts");