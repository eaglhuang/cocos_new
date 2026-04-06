#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const repoRoot = path.resolve(__dirname, '../../../../');
const serverDir = path.join(repoRoot, 'tools_mcp', 'dalle3-mcp');
const serverEntry = path.join(serverDir, 'index.js');

const { Client } = require(path.join(serverDir, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs', 'client', 'index.js'));
const { StdioClientTransport } = require(path.join(serverDir, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs', 'client', 'stdio.js'));

const VALID_SIZES = new Set(['1024x1024', '1024x1792', '1792x1024']);
const VALID_STYLES = new Set(['natural', 'vivid']);

function printUsage() {
  console.log([
    'Usage:',
    '  node .github/skills/dalle3-image-gen/scripts/generate-dalle3.js --prompt "..." [--size 1024x1024] [--style natural] [--output path] [--json]',
    '  node .github/skills/dalle3-image-gen/scripts/generate-dalle3.js --prompt-file path/to/prompt.txt [--output path]',
    '',
    'Options:',
    '  --prompt <text>        直接提供 prompt',
    '  --prompt-file <path>   從文字檔讀 prompt',
    '  --size <value>         1024x1024 | 1024x1792 | 1792x1024',
    '  --style <value>        natural | vivid',
    '  --output <path>        下載生成圖到本地路徑',
    '  --self-test            只驗證 MCP 連線與 tool 存在，不生圖',
    '  --json                 輸出 JSON',
    '  --help                 顯示說明'
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    size: '1024x1024',
    style: 'natural',
    json: false,
    prompt: '',
    promptFile: '',
    output: '',
    help: false,
    selfTest: false,
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

    const nextValue = argv[index + 1];
    if (!nextValue) {
      throw new Error(`缺少參數值: ${token}`);
    }

    if (token === '--prompt') {
      options.prompt = nextValue;
      index += 1;
      continue;
    }

    if (token === '--prompt-file') {
      options.promptFile = nextValue;
      index += 1;
      continue;
    }

    if (token === '--size') {
      options.size = nextValue;
      index += 1;
      continue;
    }

    if (token === '--style') {
      options.style = nextValue;
      index += 1;
      continue;
    }

    if (token === '--output') {
      options.output = nextValue;
      index += 1;
      continue;
    }

    throw new Error(`不支援的參數: ${token}`);
  }

  return options;
}

function resolvePrompt(options) {
  if (options.prompt && options.promptFile) {
    throw new Error('`--prompt` 與 `--prompt-file` 只能擇一使用');
  }

  if (options.promptFile) {
    const promptFilePath = path.resolve(repoRoot, options.promptFile);
    if (!fs.existsSync(promptFilePath)) {
      throw new Error(`找不到 prompt file: ${promptFilePath}`);
    }

    return fs.readFileSync(promptFilePath, 'utf8').trim();
  }

  return options.prompt.trim();
}

function collectTextContent(result) {
  if (!Array.isArray(result.content)) {
    return '';
  }

  return result.content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
}

function parseResponseText(text) {
  const urlMatch = text.match(/URL:\s*(\S+)/i);
  const revisedPromptMatch = text.match(/(?:實際使用的 Prompt \(Revised\)|Revised Prompt|revised_prompt):\s*([\s\S]*)$/i);

  return {
    url: urlMatch ? urlMatch[1].trim() : '',
    revisedPrompt: revisedPromptMatch ? revisedPromptMatch[1].trim() : '',
  };
}

async function downloadImage(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下載失敗: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const targetPath = path.resolve(repoRoot, outputPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
  return targetPath;
}

function printResult(payload, asJson) {
  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!payload.ok) {
    console.error(`Error: ${payload.error}`);
    if (payload.stderr) {
      console.error(payload.stderr);
    }
    return;
  }

  console.log(`URL: ${payload.url}`);
  if (payload.savedTo) {
    console.log(`Saved To: ${payload.savedTo}`);
  }
  if (payload.revisedPrompt) {
    console.log(`Revised Prompt:\n${payload.revisedPrompt}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (!VALID_SIZES.has(options.size)) {
    throw new Error(`不支援的 size: ${options.size}`);
  }

  if (!VALID_STYLES.has(options.style)) {
    throw new Error(`不支援的 style: ${options.style}`);
  }

  if (!fs.existsSync(serverEntry)) {
    throw new Error(`找不到 DALL-E 3 MCP server: ${serverEntry}`);
  }

  const prompt = resolvePrompt(options);
  if (!options.selfTest && !prompt) {
    throw new Error('請提供 `--prompt` 或 `--prompt-file`');
  }

  const client = new Client({
    name: 'dalle3-image-gen-wrapper',
    version: '1.0.0',
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd: serverDir,
    stderr: 'pipe',
  });

  const stderrChunks = [];
  if (transport.stderr) {
    transport.stderr.on('data', (chunk) => {
      stderrChunks.push(String(chunk));
    });
  }

  try {
    await client.connect(transport);

    const toolsResult = await client.listTools({});
    const hasDalleTool = toolsResult.tools.some((tool) => tool.name === 'generate_image_dalle3');
    if (!hasDalleTool) {
      throw new Error('MCP server 未提供 generate_image_dalle3');
    }

    if (options.selfTest) {
      printResult({
        ok: true,
        selfTest: true,
        serverDir,
        toolFound: true,
        availableTools: toolsResult.tools.map((tool) => tool.name),
      }, options.json);
      return;
    }

    const result = await client.callTool({
      name: 'generate_image_dalle3',
      arguments: {
        prompt,
        size: options.size,
        style: options.style,
      },
    });

    const rawText = collectTextContent(result);
    if (result.isError) {
      throw new Error(rawText || 'DALL-E 3 MCP server 回傳錯誤');
    }

    const parsed = parseResponseText(rawText);
    let savedTo = '';

    if (options.output) {
      if (!parsed.url) {
        throw new Error('回傳內容缺少 URL，無法下載圖片');
      }

      savedTo = await downloadImage(parsed.url, options.output);
    }

    printResult({
      ok: true,
      prompt,
      size: options.size,
      style: options.style,
      url: parsed.url,
      revisedPrompt: parsed.revisedPrompt,
      savedTo,
      rawText,
    }, options.json);
  } catch (error) {
    const payload = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stderr: stderrChunks.join('').trim(),
    };
    printResult(payload, options.json);
    process.exitCode = 1;
  } finally {
    await transport.close().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal: ${message}`);
  process.exit(1);
});