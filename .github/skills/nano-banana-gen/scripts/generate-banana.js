#!/usr/bin/env node
/**
 * generate-banana.js - Nano Banana (Google Gemini) image generation CLI
 * Pattern mirrors generate-dalle3.js for consistency.
 * Dependencies loaded from tools_mcp/nano-banana-mcp/node_modules.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const repoRoot = path.resolve(__dirname, '../../../../');
const mcpDir = path.join(repoRoot, 'tools_mcp', 'nano-banana-mcp');
const LOCK_DIR = path.join(repoRoot, 'temp_workspace', 'agent-locks');
const IMAGE_LOCK_PATH = path.join(LOCK_DIR, 'nano-banana-image.lock');

// Load deps from nano-banana-mcp/node_modules
require(path.join(mcpDir, 'node_modules', 'dotenv')).config({
  path: path.join(mcpDir, '.env'),
});
const { GoogleGenerativeAI } = require(
  path.join(mcpDir, 'node_modules', '@google', 'generative-ai'),
);

// -----------------------------------------------------------------------
// Model alias map (community names → API model IDs)
// Verified available 2026-04 via ListModels:
//   gemini-2.5-flash-image          (Nano Banana)
//   gemini-3.1-flash-image-preview  (Nano Banana 2 / Flash 3.1)
//   gemini-3-pro-image-preview      (Nano Banana Pro)
// -----------------------------------------------------------------------
const MODEL_ALIASES = {
  'nano-banana':   'gemini-2.5-flash-image',           // Nano Banana
  'nano-banana-2': 'gemini-3.1-flash-image-preview',   // Nano Banana 2 / Flash 3.1 (最新)
  'nano-banana-pro': 'gemini-3-pro-image-preview',     // Nano Banana Pro
  'flash-2.5':     'gemini-2.5-flash-image',
  'flash-3.1':     'gemini-3.1-flash-image-preview',
};
const DEFAULT_MODEL = 'gemini-2.5-flash-image';
const DEFAULT_TIMEOUT_MS = 180000;
const SLOW_MODEL_TIMEOUT_MS = 300000;

function extensionForMimeType(mimeType) {
  if (mimeType === 'image/jpeg') {
    return '.jpg';
  }
  if (mimeType === 'image/webp') {
    return '.webp';
  }
  return '.png';
}

// -----------------------------------------------------------------------
// CLI helpers
// -----------------------------------------------------------------------
function printUsage() {
  console.log([
    'Usage:',
    '  node .github/skills/nano-banana-gen/scripts/generate-banana.js --prompt "..." [options]',
    '  node .github/skills/nano-banana-gen/scripts/generate-banana.js --prompt-file path/to/prompt.txt [options]',
    '',
    'Options:',
    '  --prompt <text>        直接提供 prompt',
    '  --prompt-file <path>   從文字檔讀 prompt（推薦長 prompt）',
    '  --model <id|alias>     Gemini model ID 或 alias（預設: gemini-2.0-flash-preview-image-generation）',
    '                         Aliases: nano-banana, nano-banana-2, flash-2.5, flash-3.1',
    '  --output <path>        輸出圖片路徑 (.png / .jpg / .webp)',
    '  --self-test            只驗證 API Key，不生圖',
    '  --json                 輸出 JSON（方便 Agent 串接）',
    '  --help                 顯示說明',
    '',
    '需要在 tools_mcp/nano-banana-mcp/.env 設定:',
    '  GOOGLE_AI_API_KEY=AIza...',
    '  （免費取得: https://aistudio.google.com/apikey）',
  ].join('\n'));
}

function parseArgs(argv) {
  const opts = {
    prompt: '',
    promptFile: '',
    model: DEFAULT_MODEL,
    output: '',
    timeoutMs: DEFAULT_TIMEOUT_MS,
    progress: false,
    json: false,
    selfTest: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === '--help' || tok === '-h') { opts.help = true; continue; }
    if (tok === '--json') { opts.json = true; continue; }
    if (tok === '--progress') { opts.progress = true; continue; }
    if (tok === '--self-test') { opts.selfTest = true; continue; }

    const next = argv[i + 1];
    const needsValue = ['--prompt', '--prompt-file', '--model', '--output', '--timeout-ms'];
    if (needsValue.includes(tok)) {
      if (!next || next.startsWith('--')) {
        throw new Error(`缺少參數值: ${tok}`);
      }
      if (tok === '--prompt')      { opts.prompt     = next; i += 1; continue; }
      if (tok === '--prompt-file') { opts.promptFile = next; i += 1; continue; }
      if (tok === '--model')       { opts.model      = next; i += 1; continue; }
      if (tok === '--output')      { opts.output     = next; i += 1; continue; }
      if (tok === '--timeout-ms')  { opts.timeoutMs  = Number(next); i += 1; continue; }
    }
  }
  return opts;
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logProgress(opts, message) {
  if (!opts.progress) {
    return;
  }
  const timestamp = new Date().toISOString();
  process.stderr.write(`[generate-banana] ${timestamp} ${message}\n`);
}

async function acquireLock(opts, lockPath, waitMs) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const start = Date.now();

  while (true) {
    try {
      const handle = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2));
      fs.closeSync(handle);
      logProgress(opts, `acquired lock path=${lockPath}`);
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }

      const elapsed = Date.now() - start;
      if (elapsed >= waitMs) {
        throw new Error(`lock wait timeout after ${waitMs}ms: ${lockPath}`);
      }

      logProgress(opts, `waiting for lock path=${lockPath} elapsedMs=${elapsed}`);
      await sleep(5000);
    }
  }
}

function releaseLock(opts, lockPath) {
  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
      logProgress(opts, `released lock path=${lockPath}`);
    }
  } catch (error) {
    logProgress(opts, `release lock failed path=${lockPath} error=${error.message || String(error)}`);
  }
}

function resolveTimeoutMs(opts, modelId) {
  if (opts.timeoutMs !== DEFAULT_TIMEOUT_MS) {
    return opts.timeoutMs;
  }

  if (modelId === 'gemini-3.1-flash-image-preview' || modelId === 'gemini-3-pro-image-preview') {
    return SLOW_MODEL_TIMEOUT_MS;
  }

  return opts.timeoutMs;
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let lockAcquired = false;
  let shouldExit = false;

  if (opts.help) { printUsage(); return; }

  // Validate API key
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || apiKey.startsWith('AIza...')) {
    const msg = [
      'GOOGLE_AI_API_KEY 未設定。',
      '請在 tools_mcp/nano-banana-mcp/.env 加入:',
      '  GOOGLE_AI_API_KEY=AIza...',
      '免費取得: https://aistudio.google.com/apikey',
    ].join('\n');
    if (opts.json) {
      process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    } else {
      process.stderr.write(msg + '\n');
    }
    process.exit(1);
  }

  // Self-test: just validate key is set
  if (opts.selfTest) {
    const modelId = MODEL_ALIASES[opts.model] || opts.model;
    const out = { ok: true, apiKeySet: true, model: modelId, mcpDir };
    if (opts.json) {
      process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    } else {
      console.log('OK: GOOGLE_AI_API_KEY is set.');
      console.log('Model:', modelId);
    }
    return;
  }

  // Resolve model alias
  const modelId = MODEL_ALIASES[opts.model] || opts.model;
  const timeoutMs = resolveTimeoutMs(opts, modelId);

  // Resolve prompt
  let prompt = opts.prompt;
  if (opts.promptFile) {
    const absPath = path.resolve(process.cwd(), opts.promptFile);
    if (!fs.existsSync(absPath)) {
      process.stderr.write(`prompt file not found: ${absPath}\n`);
      process.exit(1);
    }
    prompt = fs.readFileSync(absPath, 'utf8').trim();
  }

  if (!prompt) {
    process.stderr.write('缺少 --prompt 或 --prompt-file\n');
    printUsage();
    process.exit(1);
  }

  try {
    await acquireLock(opts, IMAGE_LOCK_PATH, timeoutMs);
    lockAcquired = true;

    // Call Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId });

    logProgress(opts, `start generateContent model=${modelId} timeoutMs=${timeoutMs}`);
    const result = await withTimeout(model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }), timeoutMs, `generateContent(${modelId})`);
    logProgress(opts, `finish generateContent model=${modelId}`);

    const candidate = result.response.candidates?.[0];
    if (!candidate) {
      throw new Error('Gemini API returned no response candidate. Prompt may have been blocked.');
    }

    let imageData = null;
    let mimeType = 'image/png';
    let textContent = '';

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        imageData = part.inlineData.data;       // base64 string
        mimeType  = part.inlineData.mimeType || 'image/png';
      }
      if (part.text) {
        textContent += part.text;
      }
    }

    if (!imageData) {
      throw new Error(
        'API returned no image data. ' +
        'Verify the model supports image generation, or try --model nano-banana or --model nano-banana-2'
      );
    }

    // Save image to disk
    let savedTo = null;
    if (opts.output) {
      logProgress(opts, `start save output=${opts.output}`);
      const absOut = path.resolve(process.cwd(), opts.output);
      const desiredExt = path.extname(absOut);
      const actualExt = extensionForMimeType(mimeType);
      const normalizedOut = desiredExt.toLowerCase() === actualExt
        ? absOut
        : path.join(path.dirname(absOut), `${path.basename(absOut, desiredExt)}${actualExt}`);
      const dir = path.dirname(normalizedOut);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(normalizedOut, Buffer.from(imageData, 'base64'));
      savedTo = normalizedOut;
      logProgress(opts, `finish save output=${normalizedOut}`);
    }

    const out = {
      ok: true,
      model: modelId,
      mimeType,
      savedTo,
      textContent: textContent || null,
    };

    if (opts.json) {
      process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    } else {
      console.log(`OK: image generated via ${modelId}`);
      if (savedTo) { console.log(`Saved: ${savedTo}`); }
      if (textContent) { console.log('Text:', textContent); }
    }

    // Some Gemini image model calls leave SDK handles open on Windows.
    // Exit explicitly after the result has been written so batch runs do not hang.
    shouldExit = true;
  } finally {
    if (lockAcquired) {
      releaseLock(opts, IMAGE_LOCK_PATH);
    }
  }

  if (shouldExit) {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error:', err.message || String(err));
  process.exit(1);
});
