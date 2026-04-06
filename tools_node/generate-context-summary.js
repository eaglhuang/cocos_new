#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const TEXT_EXTS = new Set([
  '.md',
  '.json',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ps1',
  '.txt',
  '.log',
  '.yml',
  '.yaml',
  '.toml',
]);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

function parseArgs(argv) {
  const args = {
    task: '',
    goal: '',
    files: [],
    changed: false,
    maxFiles: 6,
    maxKnown: 3,
    maxNeed: 3,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--task') {
      args.task = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--goal') {
      args.goal = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--files') {
      i += 1;
      while (i < argv.length && !argv[i].startsWith('--')) {
        args.files.push(argv[i]);
        i += 1;
      }
      i -= 1;
      continue;
    }
    if (arg === '--changed') {
      args.changed = true;
      continue;
    }
    if (arg === '--max-files') {
      args.maxFiles = Number(argv[i + 1] || args.maxFiles);
      i += 1;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
    }
  }

  return args;
}

function rel(inputPath) {
  return path.relative(ROOT, path.resolve(ROOT, inputPath)).replace(/\\/g, '/');
}

function gitChangedFiles() {
  try {
    const out = cp.execSync('git status --short', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.slice(3).trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function classify(file) {
  const ext = path.extname(file.toLowerCase());
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (TEXT_EXTS.has(ext)) return 'text';
  return 'binary';
}

function safeRead(file) {
  try {
    return fs.readFileSync(path.resolve(ROOT, file), 'utf8');
  } catch {
    return '';
  }
}

function safeStat(file) {
  try {
    return fs.statSync(path.resolve(ROOT, file));
  } catch {
    return null;
  }
}

function firstNonEmptyLine(lines) {
  return lines.map((line) => line.trim()).find(Boolean) || '';
}

function summarizeMarkdown(text) {
  const lines = text.split(/\r?\n/);
  const heading = lines.find((line) => /^#{1,3}\s+/.test(line.trim()));
  const first = firstNonEmptyLine(lines);
  return (heading || first || '').replace(/^#{1,3}\s+/, '').trim();
}

function summarizeJson(text) {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      return `JSON array (${data.length})`;
    }
    if (data && typeof data === 'object') {
      if (typeof data.id === 'string' && typeof data.title === 'string') {
        return `${data.id}: ${data.title}`;
      }
      if (typeof data.title === 'string') return data.title;
      if (typeof data.description === 'string') return data.description.slice(0, 80);
      const keys = Object.keys(data).slice(0, 5);
      return `JSON object keys: ${keys.join(', ')}`;
    }
  } catch {
    return '';
  }
  return '';
}

function summarizeText(file, text) {
  const ext = path.extname(file.toLowerCase());
  if (ext === '.md') return summarizeMarkdown(text);
  if (ext === '.json') return summarizeJson(text);
  const lines = text.split(/\r?\n/);
  const first = firstNonEmptyLine(lines);
  return first.slice(0, 100);
}

function estimateTokens(text) {
  let ascii = 0;
  let nonAscii = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) <= 0x7f) ascii += 1;
    else nonAscii += 1;
  }
  return Math.ceil(ascii / 4 + nonAscii * 0.9);
}

function buildEntry(file) {
  const kind = classify(file);
  const stat = safeStat(file);
  const entry = {
    path: file,
    kind,
    bytes: stat ? stat.size : 0,
    summary: '',
    tokens: 0,
    inlineSafe: false,
  };

  if (kind === 'text') {
    const text = safeRead(file);
    entry.summary = summarizeText(file, text);
    entry.tokens = estimateTokens(text);
    entry.inlineSafe = entry.tokens <= 1200;
  } else if (kind === 'image') {
    entry.summary = 'image asset; use path only';
    entry.inlineSafe = false;
  } else {
    entry.summary = 'binary asset; do not inline';
    entry.inlineSafe = false;
  }

  return entry;
}

function bytesHuman(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function rankEntries(entries) {
  return [...entries].sort((a, b) => {
    const scoreA = a.kind === 'text' ? a.tokens : Math.ceil(a.bytes / 1024);
    const scoreB = b.kind === 'text' ? b.tokens : Math.ceil(b.bytes / 1024);
    return scoreA - scoreB;
  });
}

function selectAvoid(entries) {
  return entries
    .filter((entry) => !entry.inlineSafe || entry.tokens > 6000 || entry.kind !== 'text')
    .slice(0, 4)
    .map((entry) => {
      if (entry.kind === 'image') return `不要直接展開 ${entry.path}；只保留路徑與 QA 結論`;
      if (entry.kind === 'binary') return `不要直接展開 ${entry.path}；改用檔名與用途摘要`;
      if (entry.tokens > 6000) return `不要整份讀入 ${entry.path}；先用搜尋或節錄`;
      return `不要全文貼入 ${entry.path}`;
    });
}

function selectKnown(entries, maxKnown) {
  return entries.slice(0, maxKnown).map((entry) => {
    const score = entry.kind === 'text' ? `${entry.tokens} tok` : bytesHuman(entry.bytes);
    const summary = entry.summary ? ` | ${entry.summary}` : '';
    return `${entry.path} (${score})${summary}`;
  });
}

function buildCard(args, entries) {
  const ranked = rankEntries(entries);
  const read = ranked.slice(0, args.maxFiles);
  const card = {
    task: args.task || '(unset)',
    goal: args.goal || '(please fill goal)',
    read: read.map((entry) => entry.path),
    known: selectKnown(read, args.maxKnown),
    need: [
      '只補本輪必要決策，不重述背景',
      '若要看圖，只開 1 張主圖 + 1 張對照圖',
      '若遇大型文件，只節錄相關段落',
    ].slice(0, args.maxNeed),
    avoid: selectAvoid(entries),
  };
  return card;
}

function printCard(card) {
  console.log(`Task: ${card.task}`);
  console.log(`Goal: ${card.goal}`);
  console.log('Read:');
  for (const item of card.read) {
    console.log(`- ${item}`);
  }
  console.log('Known:');
  for (const item of card.known) {
    console.log(`- ${item}`);
  }
  console.log('Need:');
  for (const item of card.need) {
    console.log(`- ${item}`);
  }
  console.log('Avoid:');
  for (const item of card.avoid) {
    console.log(`- ${item}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = new Set(args.files.map(rel));
  if (args.changed) {
    for (const file of gitChangedFiles()) files.add(file);
  }
  const entries = [...files]
    .filter(Boolean)
    .map((file) => buildEntry(file));
  const card = buildCard(args, entries);
  if (args.json) {
    console.log(JSON.stringify(card, null, 2));
    return;
  }
  printCard(card);
}

main();
