#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();

function parseArgs(argv) {
  const args = {
    base: '',
    head: '',
    git: '',
    top: 8,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base') {
      args.base = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--head') {
      args.head = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--git') {
      args.git = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--top') {
      args.top = Number(argv[i + 1] || args.top);
      i += 1;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
    }
  }

  return args;
}

function readUtf8(filePath) {
  try {
    return fs.readFileSync(path.resolve(ROOT, filePath), 'utf8');
  } catch {
    return '';
  }
}

function readGitHead(relPath) {
  try {
    return cp.execSync(`git show HEAD:${relPath.replace(/\\/g, '/')}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function detectExt(basePath, headPath, gitPath) {
  const target = headPath || basePath || gitPath || '';
  return path.extname(target).toLowerCase();
}

function trimLines(text) {
  return text.replace(/\r/g, '').split('\n');
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

function buildLineDelta(baseText, headText) {
  const baseLines = trimLines(baseText);
  const headLines = trimLines(headText);
  let start = 0;
  while (start < baseLines.length && start < headLines.length && baseLines[start] === headLines[start]) {
    start += 1;
  }

  let baseEnd = baseLines.length - 1;
  let headEnd = headLines.length - 1;
  while (baseEnd >= start && headEnd >= start && baseLines[baseEnd] === headLines[headEnd]) {
    baseEnd -= 1;
    headEnd -= 1;
  }

  return {
    added: Math.max(0, headEnd - start + 1),
    removed: Math.max(0, baseEnd - start + 1),
    changedBlockStart: start + 1,
  };
}

function summarizeScalar(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value.slice(0, 60));
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'object') return `object(${Object.keys(value).length})`;
  return typeof value;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function diffJsonArray(baseArray, headArray, top) {
  const hasOnlyObjects = baseArray.concat(headArray).every((item) => item && typeof item === 'object' && !Array.isArray(item));
  const hasIdObjects = hasOnlyObjects && baseArray.concat(headArray).every((item) => Object.prototype.hasOwnProperty.call(item, 'id'));

  if (hasIdObjects) {
    const baseMap = new Map(baseArray.map((item) => [String(item.id), item]));
    const headMap = new Map(headArray.map((item) => [String(item.id), item]));
    const added = [...headMap.keys()].filter((key) => !baseMap.has(key)).slice(0, top);
    const removed = [...baseMap.keys()].filter((key) => !headMap.has(key)).slice(0, top);
    const changed = [];
    for (const key of [...headMap.keys()].filter((id) => baseMap.has(id))) {
      if (stableStringify(baseMap.get(key)) !== stableStringify(headMap.get(key))) {
        changed.push(key);
      }
      if (changed.length >= top) break;
    }
    return {
      mode: 'array-by-id',
      added,
      removed,
      changed,
      baseCount: baseArray.length,
      headCount: headArray.length,
    };
  }

  const changedIndexes = [];
  const max = Math.max(baseArray.length, headArray.length);
  for (let i = 0; i < max; i += 1) {
    if (stableStringify(baseArray[i]) !== stableStringify(headArray[i])) {
      changedIndexes.push(i);
    }
    if (changedIndexes.length >= top) break;
  }

  return {
    mode: 'array-by-index',
    added: Math.max(0, headArray.length - baseArray.length),
    removed: Math.max(0, baseArray.length - headArray.length),
    changedIndexes,
    baseCount: baseArray.length,
    headCount: headArray.length,
  };
}

function topLevelJsonDiff(baseValue, headValue, top) {
  if (Array.isArray(baseValue) || Array.isArray(headValue)) {
    return diffJsonArray(Array.isArray(baseValue) ? baseValue : [], Array.isArray(headValue) ? headValue : [], top);
  }

  const baseObj = baseValue && typeof baseValue === 'object' ? baseValue : {};
  const headObj = headValue && typeof headValue === 'object' ? headValue : {};
  const baseKeys = new Set(Object.keys(baseObj));
  const headKeys = new Set(Object.keys(headObj));

  const added = [...headKeys].filter((key) => !baseKeys.has(key)).slice(0, top);
  const removed = [...baseKeys].filter((key) => !headKeys.has(key)).slice(0, top);
  const changed = [];

  for (const key of [...headKeys].filter((name) => baseKeys.has(name))) {
    if (stableStringify(baseObj[key]) !== stableStringify(headObj[key])) {
      changed.push({
        key,
        before: summarizeScalar(baseObj[key]),
        after: summarizeScalar(headObj[key]),
      });
    }
    if (changed.length >= top) break;
  }

  return {
    mode: 'object',
    added,
    removed,
    changed,
    baseCount: Object.keys(baseObj).length,
    headCount: Object.keys(headObj).length,
  };
}

function extractMarkdownHeadings(text) {
  return trimLines(text)
    .map((line, index) => ({ raw: line, line: index + 1 }))
    .filter((item) => /^#{1,6}\s+/.test(item.raw))
    .map((item) => {
      const match = item.raw.match(/^(#{1,6})\s+(.*)$/);
      return {
        level: match[1].length,
        text: match[2].trim(),
        line: item.line,
      };
    });
}

function summarizeMarkdown(baseText, headText, top) {
  const baseHeadings = extractMarkdownHeadings(baseText);
  const headHeadings = extractMarkdownHeadings(headText);
  const baseSet = new Set(baseHeadings.map((item) => `${item.level}:${item.text}`));
  const headSet = new Set(headHeadings.map((item) => `${item.level}:${item.text}`));

  return {
    mode: 'markdown',
    baseHeadings: baseHeadings.length,
    headHeadings: headHeadings.length,
    added: headHeadings
      .filter((item) => !baseSet.has(`${item.level}:${item.text}`))
      .slice(0, top)
      .map((item) => `H${item.level} ${item.text}`),
    removed: baseHeadings
      .filter((item) => !headSet.has(`${item.level}:${item.text}`))
      .slice(0, top)
      .map((item) => `H${item.level} ${item.text}`),
    lineDelta: buildLineDelta(baseText, headText),
  };
}

function summarizeText(baseText, headText) {
  return {
    mode: 'text',
    baseLines: trimLines(baseText).length,
    headLines: trimLines(headText).length,
    lineDelta: buildLineDelta(baseText, headText),
  };
}

function buildSummary(args) {
  let basePath = args.base;
  let headPath = args.head;
  let gitPath = args.git;
  let baseText = '';
  let headText = '';

  if (gitPath) {
    gitPath = normalizePath(gitPath);
    headPath = gitPath;
    baseText = readGitHead(gitPath);
    headText = readUtf8(gitPath);
  } else {
    basePath = normalizePath(basePath);
    headPath = normalizePath(headPath);
    baseText = readUtf8(basePath);
    headText = readUtf8(headPath);
  }

  const ext = detectExt(basePath, headPath, gitPath);
  const summary = {
    target: gitPath || `${basePath} -> ${headPath}`,
    ext,
    baseTokens: estimateTokens(baseText),
    headTokens: estimateTokens(headText),
    mode: 'text',
    details: {},
  };

  if (ext === '.json') {
    try {
      const baseValue = baseText ? JSON.parse(baseText) : {};
      const headValue = headText ? JSON.parse(headText) : {};
      summary.mode = 'json';
      summary.details = topLevelJsonDiff(baseValue, headValue, args.top);
      return summary;
    } catch (error) {
      summary.mode = 'json-parse-failed';
      summary.details = {
        message: error instanceof Error ? error.message : String(error),
        fallback: summarizeText(baseText, headText),
      };
      return summary;
    }
  }

  if (ext === '.md') {
    summary.mode = 'markdown';
    summary.details = summarizeMarkdown(baseText, headText, args.top);
    return summary;
  }

  summary.mode = 'text';
  summary.details = summarizeText(baseText, headText);
  return summary;
}

function printHuman(summary) {
  console.log(`[structured-diff] target=${summary.target}`);
  console.log(`[structured-diff] mode=${summary.mode} baseTokens=${summary.baseTokens} headTokens=${summary.headTokens}`);

  if (summary.mode === 'json') {
    const details = summary.details;
    console.log(`[structured-diff] jsonScope=${details.mode} baseCount=${details.baseCount} headCount=${details.headCount}`);
    if (details.mode === 'object') {
      if (details.added.length > 0) console.log(`  added keys: ${details.added.join(', ')}`);
      if (details.removed.length > 0) console.log(`  removed keys: ${details.removed.join(', ')}`);
      for (const item of details.changed) {
        console.log(`  changed ${item.key}: ${item.before} -> ${item.after}`);
      }
      return;
    }
    if (details.mode === 'array-by-id') {
      if (details.added.length > 0) console.log(`  added ids: ${details.added.join(', ')}`);
      if (details.removed.length > 0) console.log(`  removed ids: ${details.removed.join(', ')}`);
      if (details.changed.length > 0) console.log(`  changed ids: ${details.changed.join(', ')}`);
      return;
    }
    console.log(`  length delta: ${details.baseCount} -> ${details.headCount}`);
    if (details.changedIndexes.length > 0) {
      console.log(`  changed indexes: ${details.changedIndexes.join(', ')}`);
    }
    return;
  }

  if (summary.mode === 'markdown') {
    const details = summary.details;
    console.log(`[structured-diff] headings ${details.baseHeadings} -> ${details.headHeadings}`);
    if (details.added.length > 0) console.log(`  added headings: ${details.added.join(' | ')}`);
    if (details.removed.length > 0) console.log(`  removed headings: ${details.removed.join(' | ')}`);
    console.log(`  changed block: line ${details.lineDelta.changedBlockStart}, +${details.lineDelta.added} / -${details.lineDelta.removed}`);
    return;
  }

  if (summary.mode === 'json-parse-failed') {
    console.log(`  parse error: ${summary.details.message}`);
    const fallback = summary.details.fallback;
    console.log(`  fallback line delta: line ${fallback.lineDelta.changedBlockStart}, +${fallback.lineDelta.added} / -${fallback.lineDelta.removed}`);
    return;
  }

  const details = summary.details;
  console.log(`[structured-diff] lines ${details.baseLines} -> ${details.headLines}`);
  console.log(`  changed block: line ${details.lineDelta.changedBlockStart}, +${details.lineDelta.added} / -${details.lineDelta.removed}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.git && (!args.base || !args.head)) {
    console.error('Usage: node tools_node/summarize-structured-diff.js --git <file>');
    console.error('   or: node tools_node/summarize-structured-diff.js --base <old> --head <new>');
    process.exit(1);
  }

  const summary = buildSummary(args);
  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  printHuman(summary);
}

main();
