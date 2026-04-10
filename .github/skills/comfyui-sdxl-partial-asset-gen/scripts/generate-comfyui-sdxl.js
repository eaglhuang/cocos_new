#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const crypto = require('node:crypto');

const DEFAULTS = {
  host: '127.0.0.1',
  port: 8000,
  checkpoint: 'sd_xl_base_1.0.safetensors',
  loras: [
    {
      name: 'Chinese_Ink_Painting_Lora_SDXL.safetensors',
      strengthModel: 0.75,
      strengthClip: 0.75,
    },
    {
      name: 'engraving-sdxl-lora-001.safetensors',
      strengthModel: 0.3,
      strengthClip: 0.3,
    },
  ],
  prompt: '',
  negativePrompt: '',
  width: 1024,
  height: 1024,
  steps: 28,
  cfg: 6.5,
  sampler: 'dpmpp_2m',
  scheduler: 'karras',
  seed: 0,
  batchSize: 1,
  initImage: '',
  strength: 1,
  filenamePrefix: '3KLife/comfyui-sdxl-partial-asset',
  pollMs: 3000,
  timeoutMs: 900000,
  json: false,
  selfTest: false,
  output: '',
  outputDir: '',
};

const EXAMPLES_DIR = path.resolve(__dirname, '..', 'examples');

const ASSET_TYPE_PRESETS = {
  badge: {
    promptFile: path.join(EXAMPLES_DIR, 'badge-prompt.txt'),
    negativeFile: path.join(EXAMPLES_DIR, 'ui-partial-asset-negative.txt'),
    width: 1024,
    height: 1024,
  },
  cap: {
    promptFile: path.join(EXAMPLES_DIR, 'cap-prompt.txt'),
    negativeFile: path.join(EXAMPLES_DIR, 'ui-partial-asset-negative.txt'),
    width: 1536,
    height: 512,
  },
  plaque: {
    promptFile: path.join(EXAMPLES_DIR, 'plaque-prompt.txt'),
    negativeFile: path.join(EXAMPLES_DIR, 'ui-partial-asset-negative.txt'),
    width: 1280,
    height: 768,
  },
  'panel-fragment': {
    promptFile: path.join(EXAMPLES_DIR, 'panel-fragment-prompt.txt'),
    negativeFile: path.join(EXAMPLES_DIR, 'ui-partial-asset-negative.txt'),
    width: 1536,
    height: 768,
  },
};

const STYLE_PROFILES = {
  'game-ui-semi-real': {
    negativePromptAppend: 'photoreal product render, realistic studio lighting, hard specular highlights, chrome reflections, glossy enamel, pbr metal, deep embossed relief, real jewelry, real coin, realistic plaque, realistic sculpture, photographic texture, white seamless background, bright catalog background, dramatic cast shadow',
    loraStrengths: [0.45, 0.12],
  },
  'game-ui-flat-clean': {
    negativePromptAppend: 'photoreal product render, realistic studio lighting, hard specular highlights, chrome reflections, glossy enamel, pbr metal, deep embossed relief, real jewelry, real coin, realistic plaque, realistic sculpture, photographic texture, white seamless background, bright catalog background, dramatic cast shadow, watercolor wash, ink wash, brush stroke texture, painterly shading, sketch line, hand-drawn illustration, parchment painting, canvas texture, rough pigment bloom',
    loraStrengths: [0.18, 0.06],
  },
  'game-ui-clean-graphic': {
    negativePromptAppend: 'photoreal product render, realistic studio lighting, hard specular highlights, chrome reflections, glossy enamel, pbr metal, deep embossed relief, real jewelry, real coin, realistic plaque, realistic sculpture, photographic texture, white seamless background, bright catalog background, dramatic cast shadow, watercolor wash, ink wash, brush stroke texture, painterly shading, sketch line, hand-drawn illustration, parchment painting, canvas texture, rough pigment bloom, concept art, fantasy illustration, draft sketch, rough line art, ornament sheet, emblem sheet, asset sheet, sticker sheet, contact sheet, multi-object board, manuscript page, old book page, parchment document, scroll page, multi-column layout, UI layout mockup',
    loraStrengths: [0.0, 0.0],
  },
};

function printUsage() {
  console.log([
    'Usage:',
    '  node .github/skills/comfyui-sdxl-partial-asset-gen/scripts/generate-comfyui-sdxl.js --prompt "..." [options]',
    '  node .github/skills/comfyui-sdxl-partial-asset-gen/scripts/generate-comfyui-sdxl.js --prompt-file path/to/prompt.txt [options]',
    '',
    'Options:',
    '  --prompt <text>                直接提供 positive prompt',
    '  --prompt-file <path>           從文字檔讀 positive prompt',
    '  --negative <text>              直接提供 negative prompt',
    '  --negative-file <path>         從文字檔讀 negative prompt',
    '  --asset-type <name>            快捷載入 badge|cap|plaque|panel-fragment 的 prompt 與預設尺寸',
    '  --style-profile <name>         套用 style profile；目前支援 game-ui-semi-real|game-ui-flat-clean|game-ui-clean-graphic',
    '  --config <path>                讀取 JSON config',
    '  --checkpoint <name>            覆蓋 checkpoint 檔名',
    '  --init-image <path>            提供本機初始圖片，啟用 img2img workflow',
    '  --strength <number>            img2img 強度 / KSampler denoise，範圍 0~1',
    '  --lora1 <name>                 覆蓋第 1 顆 LoRA 檔名',
    '  --lora1-strength <number>      覆蓋第 1 顆 LoRA 強度',
    '  --lora2 <name>                 覆蓋第 2 顆 LoRA 檔名',
    '  --lora2-strength <number>      覆蓋第 2 顆 LoRA 強度',
    '  --width <number>               輸出寬度',
    '  --height <number>              輸出高度',
    '  --steps <number>               Sampler steps',
    '  --cfg <number>                 CFG scale',
    '  --sampler <name>               sampler_name',
    '  --scheduler <name>             scheduler',
    '  --seed <number>                0 代表隨機 seed',
    '  --filename-prefix <text>       ComfyUI SaveImage prefix',
    '  --host <host>                  ComfyUI host',
    '  --port <port>                  ComfyUI port',
    '  --output <path>                下載第一張輸出圖到指定路徑',
    '  --output-dir <dir>             把所有輸出圖下載到指定目錄',
    '  --self-test                    只驗證 backend',
    '  --json                         輸出 JSON',
    '  --help                         顯示說明',
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    config: '',
    prompt: '',
    promptFile: '',
    negative: '',
    negativeFile: '',
    assetType: '',
    styleProfile: '',
    checkpoint: '',
    initImage: '',
    strength: '',
    lora1: '',
    lora1Strength: '',
    lora2: '',
    lora2Strength: '',
    width: '',
    height: '',
    steps: '',
    cfg: '',
    sampler: '',
    scheduler: '',
    seed: '',
    filenamePrefix: '',
    host: '',
    port: '',
    output: '',
    outputDir: '',
    selfTest: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }

    if (token === '--json') {
      options.json = true;
      continue;
    }

    if (token === '--self-test') {
      options.selfTest = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) {
      throw new Error(`Missing value for ${token}`);
    }

    switch (token) {
      case '--config':
        options.config = next;
        break;
      case '--prompt':
        options.prompt = next;
        break;
      case '--prompt-file':
        options.promptFile = next;
        break;
      case '--negative':
        options.negative = next;
        break;
      case '--negative-file':
        options.negativeFile = next;
        break;
      case '--asset-type':
        options.assetType = next;
        break;
      case '--style-profile':
        options.styleProfile = next;
        break;
      case '--checkpoint':
        options.checkpoint = next;
        break;
      case '--init-image':
        options.initImage = next;
        break;
      case '--strength':
        options.strength = next;
        break;
      case '--lora1':
        options.lora1 = next;
        break;
      case '--lora1-strength':
        options.lora1Strength = next;
        break;
      case '--lora2':
        options.lora2 = next;
        break;
      case '--lora2-strength':
        options.lora2Strength = next;
        break;
      case '--width':
        options.width = next;
        break;
      case '--height':
        options.height = next;
        break;
      case '--steps':
        options.steps = next;
        break;
      case '--cfg':
        options.cfg = next;
        break;
      case '--sampler':
        options.sampler = next;
        break;
      case '--scheduler':
        options.scheduler = next;
        break;
      case '--seed':
        options.seed = next;
        break;
      case '--filename-prefix':
        options.filenamePrefix = next;
        break;
      case '--host':
        options.host = next;
        break;
      case '--port':
        options.port = next;
        break;
      case '--output':
        options.output = next;
        break;
      case '--output-dir':
        options.outputDir = next;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }

    index += 1;
  }

  return options;
}

function getAssetTypePreset(assetType) {
  if (!assetType) {
    return null;
  }

  const preset = ASSET_TYPE_PRESETS[assetType];
  if (!preset) {
    throw new Error(`Unsupported asset type: ${assetType}. Use one of ${Object.keys(ASSET_TYPE_PRESETS).join(', ')}`);
  }

  return preset;
}

function getStyleProfile(styleProfile) {
  if (!styleProfile) {
    return null;
  }

  const profile = STYLE_PROFILES[styleProfile];
  if (!profile) {
    throw new Error(`Unsupported style profile: ${styleProfile}. Use one of ${Object.keys(STYLE_PROFILES).join(', ')}`);
  }

  return profile;
}

function joinPromptParts(...parts) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

function readTextMaybe(filePath, directValue) {
  if (directValue) {
    return directValue.trim();
  }

  if (!filePath) {
    return '';
  }

  return fs.readFileSync(path.resolve(filePath), 'utf8').trim();
}

function readConfig(configPath) {
  if (!configPath) {
    return {};
  }

  return JSON.parse(fs.readFileSync(path.resolve(configPath), 'utf8'));
}

function ensureFileExists(filePath, label) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`${label} not found: ${resolvedPath}`);
  }
  return resolvedPath;
}

function toInteger(value, fallback) {
  if (value === '' || value === undefined || value === null) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected integer, got ${value}`);
  }

  return parsed;
}

function toFloat(value, fallback) {
  if (value === '' || value === undefined || value === null) {
    return fallback;
  }

  const parsed = Number.parseFloat(String(value));
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected number, got ${value}`);
  }

  return parsed;
}

function toTimestampSlug(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function getDefaultOutputPath(assetType) {
  if (!assetType) {
    return '';
  }

  return path.resolve('artifacts', 'ui-generated', 'comfyui', `${assetType}-${toTimestampSlug()}.png`);
}

function applyStyleProfileToLoras(baseLoras, styleProfile) {
  if (!styleProfile || !Array.isArray(styleProfile.loraStrengths) || styleProfile.loraStrengths.length === 0) {
    return baseLoras;
  }

  const sourceLoras = Array.isArray(baseLoras) && baseLoras.length > 0
    ? baseLoras.map((item) => ({ ...item }))
    : DEFAULTS.loras.map((item) => ({ ...item }));

  return sourceLoras.map((item, index) => {
    const strength = styleProfile.loraStrengths[index];
    if (strength === undefined) {
      return item;
    }

    return {
      ...item,
      strengthModel: strength,
      strengthClip: strength,
    };
  });
}

function normalizeLoras(baseLoras, options) {
  const loras = Array.isArray(baseLoras) && baseLoras.length > 0
    ? baseLoras.map((item) => ({ ...item }))
    : DEFAULTS.loras.map((item) => ({ ...item }));

  while (loras.length < 2) {
    loras.push({ name: '', strengthModel: 0, strengthClip: 0 });
  }

  if (options.lora1) {
    loras[0].name = options.lora1;
  }
  if (options.lora1Strength !== '') {
    const strength = toFloat(options.lora1Strength, loras[0].strengthModel);
    loras[0].strengthModel = strength;
    loras[0].strengthClip = strength;
  }
  if (options.lora2) {
    loras[1].name = options.lora2;
  }
  if (options.lora2Strength !== '') {
    const strength = toFloat(options.lora2Strength, loras[1].strengthModel);
    loras[1].strengthModel = strength;
    loras[1].strengthClip = strength;
  }

  return loras.filter((item) => item.name && (item.strengthModel !== 0 || item.strengthClip !== 0));
}

function buildSettings(options) {
  const config = readConfig(options.config);
  const assetTypePreset = getAssetTypePreset(options.assetType);
  const styleProfile = getStyleProfile(options.styleProfile);
  const promptFile = options.promptFile || assetTypePreset?.promptFile || '';
  const negativeFile = options.negativeFile || assetTypePreset?.negativeFile || '';
  const prompt = readTextMaybe(promptFile, options.prompt) || config.prompt || '';
  const negativePrompt = joinPromptParts(
    readTextMaybe(negativeFile, options.negative) || config.negativePrompt || '',
    styleProfile?.negativePromptAppend || ''
  );
  const baseLoras = applyStyleProfileToLoras(config.loras, styleProfile);

  const settings = {
    ...DEFAULTS,
    ...config,
    prompt,
    negativePrompt,
    assetType: options.assetType || '',
    styleProfile: options.styleProfile || '',
    host: options.host || config.host || DEFAULTS.host,
    port: toInteger(options.port || config.port, DEFAULTS.port),
    checkpoint: options.checkpoint || config.checkpoint || DEFAULTS.checkpoint,
    initImage: options.initImage || config.initImage || '',
    strength: toFloat(options.strength || config.strength, DEFAULTS.strength),
    width: toInteger(options.width || config.width || assetTypePreset?.width, DEFAULTS.width),
    height: toInteger(options.height || config.height || assetTypePreset?.height, DEFAULTS.height),
    steps: toInteger(options.steps || config.steps, DEFAULTS.steps),
    cfg: toFloat(options.cfg || config.cfg, DEFAULTS.cfg),
    sampler: options.sampler || config.sampler || DEFAULTS.sampler,
    scheduler: options.scheduler || config.scheduler || DEFAULTS.scheduler,
    seed: toInteger(options.seed || config.seed, DEFAULTS.seed),
    batchSize: toInteger(config.batchSize, DEFAULTS.batchSize),
    filenamePrefix: options.filenamePrefix || config.filenamePrefix || DEFAULTS.filenamePrefix,
    pollMs: toInteger(config.pollMs, DEFAULTS.pollMs),
    timeoutMs: toInteger(config.timeoutMs, DEFAULTS.timeoutMs),
    selfTest: options.selfTest,
    json: options.json,
    output: options.output || getDefaultOutputPath(options.assetType),
    outputDir: options.outputDir,
  };

  settings.loras = normalizeLoras(baseLoras, options);

  if (settings.initImage) {
    settings.initImage = ensureFileExists(settings.initImage, 'Init image');
  }

  if (!settings.selfTest && !settings.prompt) {
    throw new Error('Positive prompt is required. Use --prompt or --prompt-file.');
  }

  if (settings.strength <= 0 || settings.strength > 1) {
    throw new Error('Strength must be in the range (0, 1].');
  }

  if (settings.width % 8 !== 0 || settings.height % 8 !== 0) {
    throw new Error('Width and height must be divisible by 8.');
  }

  return settings;
}

function buildWorkflow(settings) {
  const workflow = {
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: settings.checkpoint,
      },
    },
  };

  let modelRef = ['4', 0];
  let clipRef = ['4', 1];
  let nextNodeId = 10;

  for (const lora of settings.loras) {
    const nodeId = String(nextNodeId);
    workflow[nodeId] = {
      class_type: 'LoraLoader',
      inputs: {
        lora_name: lora.name,
        strength_model: lora.strengthModel,
        strength_clip: lora.strengthClip,
        model: modelRef,
        clip: clipRef,
      },
    };
    modelRef = [nodeId, 0];
    clipRef = [nodeId, 1];
    nextNodeId += 1;
  }

  workflow['6'] = {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: settings.prompt,
      clip: clipRef,
    },
  };
  workflow['7'] = {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: settings.negativePrompt,
      clip: clipRef,
    },
  };
  let latentRef;

  if (settings.initImageUploadName) {
    workflow['5'] = {
      class_type: 'LoadImage',
      inputs: {
        image: settings.initImageUploadName,
      },
    };
    workflow['12'] = {
      class_type: 'ImageScale',
      inputs: {
        image: ['5', 0],
        upscale_method: 'lanczos',
        width: settings.width,
        height: settings.height,
        crop: 'disabled',
      },
    };
    workflow['13'] = {
      class_type: 'VAEEncode',
      inputs: {
        pixels: ['12', 0],
        vae: ['4', 2],
      },
    };
    latentRef = ['13', 0];
  } else {
    workflow['5'] = {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: settings.width,
        height: settings.height,
        batch_size: settings.batchSize,
      },
    };
    latentRef = ['5', 0];
  }

  workflow['3'] = {
    class_type: 'KSampler',
    inputs: {
      seed: settings.seed === 0 ? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) : settings.seed,
      steps: settings.steps,
      cfg: settings.cfg,
      sampler_name: settings.sampler,
      scheduler: settings.scheduler,
      denoise: settings.strength,
      model: modelRef,
      positive: ['6', 0],
      negative: ['7', 0],
      latent_image: latentRef,
    },
  };
  workflow['8'] = {
    class_type: 'VAEDecode',
    inputs: {
      samples: ['3', 0],
      vae: ['4', 2],
    },
  };
  workflow['9'] = {
    class_type: 'SaveImage',
    inputs: {
      filename_prefix: settings.filenamePrefix,
      images: ['8', 0],
    },
  };

  return workflow;
}

function baseUrl(settings) {
  return `http://${settings.host}:${settings.port}`;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
  }
  return response.json();
}

function getUploadFileName(initImagePath) {
  const parsed = path.parse(initImagePath);
  const extension = parsed.ext || '.png';
  const slugBase = parsed.name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'init-image';
  const digest = crypto.createHash('sha1').update(path.resolve(initImagePath)).digest('hex').slice(0, 10);
  return `${slugBase}-${digest}${extension}`;
}

async function uploadInitImage(settings) {
  if (!settings.initImage) {
    return '';
  }

  const uploadName = getUploadFileName(settings.initImage);
  const fileBytes = fs.readFileSync(settings.initImage);
  const formData = new FormData();
  formData.set('image', new Blob([fileBytes]), uploadName);
  formData.set('type', 'input');
  formData.set('overwrite', 'true');

  const response = await fetch(`${baseUrl(settings)}/upload/image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to upload init image: HTTP ${response.status} ${response.statusText}: ${text}`);
  }

  return uploadName;
}

async function selfTest(settings) {
  const stats = await fetchJson(`${baseUrl(settings)}/system_stats`);
  return {
    ok: true,
    host: settings.host,
    port: settings.port,
    devices: stats.devices || [],
    system: stats.system || {},
  };
}

async function submitWorkflow(settings) {
  const payload = {
    client_id: crypto.randomUUID(),
    prompt: buildWorkflow(settings),
  };
  const result = await fetchJson(`${baseUrl(settings)}/prompt`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!result.prompt_id) {
    throw new Error('ComfyUI did not return prompt_id.');
  }

  return {
    promptId: result.prompt_id,
    nodeErrors: result.node_errors || {},
    workflow: payload.prompt,
  };
}

function resolveHistoryEntry(history, promptId) {
  if (!history) {
    return null;
  }

  if (history[promptId]) {
    return history[promptId];
  }

  return history;
}

function collectImages(entry) {
  if (!entry || !entry.outputs) {
    return [];
  }

  const images = [];
  for (const output of Object.values(entry.outputs)) {
    if (output && Array.isArray(output.images)) {
      images.push(...output.images);
    }
  }

  return images;
}

function extractExecutionError(entry) {
  if (!entry || !entry.status || !Array.isArray(entry.status.messages)) {
    return null;
  }

  for (const message of entry.status.messages) {
    if (!Array.isArray(message) || message.length < 2) {
      continue;
    }

    const [type, payload] = message;
    if (type === 'execution_error' && payload) {
      return payload;
    }
  }

  return null;
}

function formatExecutionError(promptId, executionError) {
  const nodeId = executionError.node_id || 'unknown';
  const nodeType = executionError.node_type || 'unknown';
  const exceptionType = executionError.exception_type || 'Error';
  const exceptionMessage = String(executionError.exception_message || 'Unknown ComfyUI execution error').trim();
  return `Prompt ${promptId} failed at node ${nodeId} (${nodeType}): ${exceptionType}: ${exceptionMessage}`;
}

async function pollForCompletion(settings, promptId) {
  const deadline = Date.now() + settings.timeoutMs;

  while (Date.now() < deadline) {
    const history = await fetchJson(`${baseUrl(settings)}/history/${encodeURIComponent(promptId)}`);
    const entry = resolveHistoryEntry(history, promptId);
    const executionError = extractExecutionError(entry);
    if (executionError) {
      throw new Error(formatExecutionError(promptId, executionError));
    }

    const images = collectImages(entry);
    if (images.length > 0) {
      return { entry, images };
    }

    if (entry && entry.status && entry.status.completed === true && images.length === 0) {
      throw new Error(`Prompt ${promptId} completed without output images.`);
    }

    await new Promise((resolve) => setTimeout(resolve, settings.pollMs));
  }

  throw new Error(`Timed out waiting for prompt ${promptId}`);
}

function buildViewUrl(settings, image) {
  const params = new URLSearchParams();
  params.set('filename', image.filename);
  params.set('subfolder', image.subfolder || '');
  params.set('type', image.type || 'output');
  return `${baseUrl(settings)}/view?${params.toString()}`;
}

async function downloadImages(settings, images) {
  const downloaded = [];

  if (!settings.output && !settings.outputDir) {
    return downloaded;
  }

  const targets = settings.outputDir
    ? images.map((image) => path.join(path.resolve(settings.outputDir), image.filename))
    : [path.resolve(settings.output)];

  if (settings.outputDir) {
    fs.mkdirSync(path.resolve(settings.outputDir), { recursive: true });
  } else if (settings.output) {
    fs.mkdirSync(path.dirname(path.resolve(settings.output)), { recursive: true });
  }

  for (let index = 0; index < images.length; index += 1) {
    if (!settings.outputDir && index > 0) {
      break;
    }

    const image = images[index];
    const response = await fetch(buildViewUrl(settings, image));
    if (!response.ok) {
      throw new Error(`Failed to download output image ${image.filename}: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const outputPath = targets[index];
    fs.writeFileSync(outputPath, buffer);
    downloaded.push(outputPath);
  }

  return downloaded;
}

function formatResult(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.selfTest) {
    console.log(`ComfyUI OK: ${result.host}:${result.port}`);
    if (Array.isArray(result.devices) && result.devices.length > 0) {
      console.log(`Devices: ${result.devices.map((item) => item.name || item.type || 'unknown').join(', ')}`);
    }
    return;
  }

  console.log(`Prompt ID: ${result.promptId}`);
  if (result.assetType) {
    console.log(`Asset type: ${result.assetType}`);
  }
  if (result.styleProfile) {
    console.log(`Style profile: ${result.styleProfile}`);
  }
  if (result.initImage) {
    console.log(`Init image: ${result.initImage}`);
    console.log(`Strength: ${result.strength}`);
  }
  console.log(`Checkpoint: ${result.checkpoint}`);
  console.log(`LoRAs: ${result.loras.map((item) => `${item.name} (${item.strengthModel})`).join(', ') || 'none'}`);
  console.log(`Images: ${result.images.map((item) => item.filename).join(', ')}`);
  if (result.downloaded.length > 0) {
    console.log(`Downloaded: ${result.downloaded.join(', ')}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const settings = buildSettings(options);

  if (settings.selfTest) {
    const result = await selfTest(settings);
    formatResult({ ...result, selfTest: true }, settings.json);
    return;
  }

  settings.initImageUploadName = await uploadInitImage(settings);

  const submitted = await submitWorkflow(settings);
  const completed = await pollForCompletion(settings, submitted.promptId);
  const downloaded = await downloadImages(settings, completed.images);

  formatResult({
    promptId: submitted.promptId,
    assetType: settings.assetType,
    styleProfile: settings.styleProfile,
    initImage: settings.initImage,
    strength: settings.strength,
    checkpoint: settings.checkpoint,
    loras: settings.loras,
    images: completed.images,
    downloaded,
    nodeErrors: submitted.nodeErrors,
  }, settings.json);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});