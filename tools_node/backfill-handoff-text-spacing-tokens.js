#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function parseArg(flag, fallback) {
  const idx = process.argv.indexOf(`--${flag}`);
  if (idx >= 0 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function parsePathListArg(flag, fallback) {
  const raw = parseArg(flag, fallback);
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

function normalizeStylePropertyName(name) {
  const trimmed = name.trim();
  if (trimmed.startsWith('--')) return trimmed;
  if (!trimmed.includes('-')) return trimmed;
  return trimmed.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function isSupportedSourceFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.mjs', '.cjs', '.css'].includes(ext);
}

function collectSourceFiles(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`source file not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    return isSupportedSourceFile(resolved) ? [resolved] : [];
  }

  const files = [];
  const stack = [resolved];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (entry.isFile() && isSupportedSourceFile(nextPath)) {
        files.push(nextPath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function getLineNumber(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function splitTopLevel(input, separatorChar) {
  const out = [];
  let buf = '';
  let depthBrace = 0;
  let depthBracket = 0;
  let depthParen = 0;
  let quote = null;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    buf += ch;

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depthBrace += 1;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);
    else if (ch === '[') depthBracket += 1;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '(') depthParen += 1;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);

    const atTop = depthBrace === 0 && depthBracket === 0 && depthParen === 0 && !quote;
    if (atTop && ch === separatorChar) {
      out.push(buf.slice(0, -1));
      buf = '';
    }
  }

  if (buf.trim()) out.push(buf);
  return out;
}

function firstTopLevelColonIndex(input) {
  let depthBrace = 0;
  let depthBracket = 0;
  let depthParen = 0;
  let quote = null;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') depthBrace += 1;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);
    else if (ch === '[') depthBracket += 1;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '(') depthParen += 1;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === ':' && depthBrace === 0 && depthBracket === 0 && depthParen === 0) {
      return i;
    }
  }

  return -1;
}

function unquote(raw) {
  const t = raw.trim();
  if (t.length >= 2) {
    const q = t[0];
    const end = t[t.length - 1];
    if ((q === '"' || q === '\'') && q === end) {
      return t.slice(1, -1);
    }
  }
  return t;
}

function tryParseNumber(raw) {
  const t = raw.trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return null;
}

function parseLiteral(raw) {
  const n = tryParseNumber(raw);
  if (n !== null) return n;
  return unquote(raw);
}

function findMatchingBrace(source, openIdx) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = openIdx; i < source.length; i += 1) {
    const ch = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function extractBraceEntries(source, sourceLabel, kind, lineOffset = 0) {
  const entries = [];
  let cursor = 0;

  while (cursor < source.length) {
    const openIdx = source.indexOf('{', cursor);
    if (openIdx < 0) break;

    const closeIdx = findMatchingBrace(source, openIdx);
    if (closeIdx < 0) break;

    entries.push({
      source: sourceLabel,
      kind,
      startIndex: openIdx,
      line: getLineNumber(source, openIdx) + lineOffset,
      body: source.slice(openIdx + 1, closeIdx),
    });

    cursor = closeIdx + 1;
  }

  return entries;
}

function extractCssBlockEntries(source, sourceLabel, lineOffset = 0) {
  return extractBraceEntries(source, sourceLabel, 'css', lineOffset);
}

function extractHtmlStyleBlockEntries(source, sourceLabel) {
  const entries = [];
  const openTagPattern = /<style\b[^>]*>/ig;
  let match;

  while ((match = openTagPattern.exec(source))) {
    const openEnd = match.index + match[0].length;
    const closeStart = source.toLowerCase().indexOf('</style>', openEnd);
    if (closeStart < 0) break;

    const innerSource = source.slice(openEnd, closeStart);
    const lineOffset = getLineNumber(source, openEnd) - 1;
    entries.push(...extractCssBlockEntries(innerSource, sourceLabel, lineOffset));

    openTagPattern.lastIndex = closeStart + 8;
  }

  return entries;
}

function extractJsOrHtmlStyleEntries(source, sourceLabel) {
  const entries = [];
  const marker = 'style';
  let cursor = 0;

  while (cursor < source.length) {
    const idx = source.indexOf(marker, cursor);
    if (idx < 0) break;

    const after = source.slice(idx, Math.min(source.length, idx + 40));
    const objectMatch = after.match(/^style\s*[:=]\s*\{/);
    if (objectMatch) {
      const firstBraceIdx = source.indexOf('{', idx);
      if (firstBraceIdx < 0) break;
      const nextNonSpaceIdx = (() => {
        let p = firstBraceIdx + 1;
        while (p < source.length && /\s/.test(source[p])) p += 1;
        return p;
      })();
      const openIdx = source[nextNonSpaceIdx] === '{' ? nextNonSpaceIdx : firstBraceIdx;
      const closeIdx = findMatchingBrace(source, openIdx);
      if (closeIdx < 0) break;
      entries.push({
        source: sourceLabel,
        kind: 'object',
        startIndex: idx,
        line: getLineNumber(source, idx),
        body: source.slice(openIdx + 1, closeIdx),
      });
      cursor = closeIdx + 1;
      continue;
    }

    const htmlMatch = after.match(/^style\s*=\s*(["'])/);
    if (htmlMatch) {
      const quote = htmlMatch[1];
      const valueStart = idx + after.indexOf(quote) + 1;
      let valueEnd = valueStart;
      while (valueEnd < source.length) {
        if (source[valueEnd] === quote && source[valueEnd - 1] !== '\\') break;
        valueEnd += 1;
      }
      if (valueEnd >= source.length) break;
      entries.push({
        source: sourceLabel,
        kind: 'html-attr',
        startIndex: idx,
        line: getLineNumber(source, idx),
        body: source.slice(valueStart, valueEnd),
      });
      cursor = valueEnd + 1;
      continue;
    }

    cursor = idx + marker.length;
  }

  return entries;
}

function extractStyleEntriesFromFile(filePath, sourceText, sourceLabel) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.css') {
    return extractCssBlockEntries(sourceText, sourceLabel);
  }
  if (ext === '.html' || ext === '.htm') {
    return [
      ...extractJsOrHtmlStyleEntries(sourceText, sourceLabel),
      ...extractHtmlStyleBlockEntries(sourceText, sourceLabel),
    ];
  }
  return extractJsOrHtmlStyleEntries(sourceText, sourceLabel);
}

function pushObserved(bucket, prop, parsedValue, sample) {
  if (!bucket[prop]) bucket[prop] = {};
  const key = typeof parsedValue === 'number' ? String(parsedValue) : parsedValue;
  if (!bucket[prop][key]) {
    bucket[prop][key] = {
      value: parsedValue,
      count: 0,
      samples: [],
    };
  }
  bucket[prop][key].count += 1;
  if (bucket[prop][key].samples.length < 10) {
    bucket[prop][key].samples.push(sample);
  }
}

function inferElementTag(source, startIndex) {
  const backSlice = source.slice(Math.max(0, startIndex - 300), startIndex);
  const reactMatch = [...backSlice.matchAll(/React\.createElement\((['"])([^'"]+)\1/g)].pop();
  if (reactMatch) return reactMatch[2];

  const htmlMatch = [...backSlice.matchAll(/<([A-Za-z][A-Za-z0-9-]*)\b/g)].pop();
  if (htmlMatch) return htmlMatch[1];

  return 'unknown';
}

function scanProperties(entries, sourceTextByLabel) {
  const textProps = new Set([
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight',
    'letterSpacing', 'textAlign', 'textIndent', 'textTransform',
  ]);
  const spaceProps = new Set([
    'gap', 'rowGap', 'columnGap',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'minWidth', 'minHeight', 'width', 'height',
  ]);

  const typography = {};
  const spacing = {};
  const customProperties = {};

  for (const entry of entries) {
    const pairs = entry.kind === 'object' ? splitTopLevel(entry.body, ',') : splitTopLevel(entry.body, ';');
    const element = inferElementTag(sourceTextByLabel.get(entry.source) || '', entry.startIndex);

    for (const rawPair of pairs) {
      const pair = rawPair.trim();
      if (!pair) continue;
      const colonIndex = firstTopLevelColonIndex(pair);
      if (colonIndex < 0) continue;

      const key = normalizeStylePropertyName(pair.slice(0, colonIndex).trim());
      const rawValue = pair.slice(colonIndex + 1).trim();
      const parsedValue = parseLiteral(rawValue);

      const sample = {
        source: entry.source,
        line: entry.line,
        element,
        raw: `${key}: ${rawValue}`,
      };

      if (textProps.has(key)) pushObserved(typography, key, parsedValue, sample);
      if (spaceProps.has(key)) pushObserved(spacing, key, parsedValue, sample);
      if (key.startsWith('--')) pushObserved(customProperties, key, parsedValue, sample);
    }
  }

  return { typography, spacing, customProperties };
}

function findCoreStatsRecipe(source) {
  const recipe = {};
  const coreStart = source.indexOf('Sec, { en:"CORE" }');
  if (coreStart < 0) return recipe;

  const roleStart = source.indexOf('// Battle position', coreStart);
  const coreSlice = roleStart > coreStart ? source.slice(coreStart, roleStart) : source.slice(coreStart, coreStart + 2000);

  const gridGap = coreSlice.match(/gridTemplateColumns:\s*"1fr 1fr"[^\n]*gap:\s*([^,}\n]+)/);
  if (gridGap) recipe.gridGap = parseLiteral(gridGap[1]);

  const itemGap = coreSlice.match(/key:lbl,\s*style:\{[^\n}]*gap:\s*([^,}\n]+)/);
  if (itemGap) recipe.itemGap = parseLiteral(itemGap[1]);

  const keyMatch = coreSlice.match(/fontFamily:\s*"var\(--font-headline\)"[^\n}]*fontSize:\s*([^,}\n]+)[^\n}]*letterSpacing:\s*([^,}\n]+)/);
  if (keyMatch) {
    recipe.key = {
      fontSize: parseLiteral(keyMatch[1]),
      letterSpacing: parseLiteral(keyMatch[2]),
    };
  }

  const valueMatch = coreSlice.match(/fontFamily:\s*"var\(--font-num\)"[^\n}]*fontSize:\s*([^,}\n]+)/);
  if (valueMatch) {
    recipe.value = {
      fontSize: parseLiteral(valueMatch[1]),
    };
  }

  return recipe;
}

function summarizeObserved(observed) {
  const out = {};
  for (const [prop, values] of Object.entries(observed)) {
    const sorted = Object.values(values)
      .sort((left, right) => right.count - left.count)
      .map((item) => ({
        value: item.value,
        count: item.count,
        samples: item.samples,
      }));
    out[prop] = sorted;
  }
  return out;
}

function main() {
  const cwd = process.cwd();
  const sourcePathArgs = parsePathListArg('source', 'Design System/design_handoff/character/tabs.jsx');
  const tokensPathArg = parseArg('tokens', 'Design System/design_handoff/source/ui-design-tokens.json');
  const sectionName = parseArg('section', 'handoffTextSpacingExtracted');

  const tokensPath = path.isAbsolute(tokensPathArg) ? tokensPathArg : path.join(cwd, tokensPathArg);
  if (!fs.existsSync(tokensPath)) {
    throw new Error(`tokens file not found: ${tokensPath}`);
  }

  const sourceFiles = [];
  for (const sourcePathArg of sourcePathArgs) {
    const resolved = path.isAbsolute(sourcePathArg) ? sourcePathArg : path.join(cwd, sourcePathArg);
    sourceFiles.push(...collectSourceFiles(resolved));
  }

  if (sourceFiles.length === 0) {
    throw new Error(`no supported source files found from: ${sourcePathArgs.join(', ')}`);
  }

  const tokensText = fs.readFileSync(tokensPath, 'utf8');
  const tokens = JSON.parse(tokensText);

  const allEntries = [];
  const sourceSummaries = [];
  const coreStatsRecipes = [];
  const sourceTextByLabel = new Map();

  for (const filePath of sourceFiles) {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const sourceLabel = toPosix(path.relative(cwd, filePath));
    const entries = extractStyleEntriesFromFile(filePath, sourceText, sourceLabel);
    sourceTextByLabel.set(sourceLabel, sourceText);
    allEntries.push(...entries);

    const coreRecipe = findCoreStatsRecipe(sourceText);
    if (Object.keys(coreRecipe).length > 0) {
      coreStatsRecipes.push({
        source: sourceLabel,
        recipe: coreRecipe,
      });
    }

    sourceSummaries.push({
      source: sourceLabel,
      kind: path.extname(filePath).toLowerCase().slice(1),
      styleEntryCount: entries.length,
    });
  }

  const scanned = scanProperties(allEntries, sourceTextByLabel);

  const section = {
    generatedAt: new Date().toISOString(),
    source: sourceSummaries.length === 1 ? sourceSummaries[0].source : sourceSummaries.map((item) => item.source),
    extractedStyleBlockCount: allEntries.length,
    sourceSummaries,
    typography: summarizeObserved(scanned.typography),
    spacing: summarizeObserved(scanned.spacing),
    customProperties: summarizeObserved(scanned.customProperties),
    componentRecipes: {
      tabOverview: coreStatsRecipes.length === 1
        ? { coreStats: coreStatsRecipes[0].recipe }
        : { coreStatsBySource: coreStatsRecipes },
    },
  };

  tokens[sectionName] = section;
  fs.writeFileSync(tokensPath, `${JSON.stringify(tokens, null, 2)}\n`, 'utf8');

  console.log('[backfill-handoff-text-spacing-tokens] updated section:', sectionName);
  console.log('[backfill-handoff-text-spacing-tokens] sources:', sourceFiles.length);
  console.log('[backfill-handoff-text-spacing-tokens] style blocks:', allEntries.length);
  console.log('[backfill-handoff-text-spacing-tokens] output:', toPosix(path.relative(cwd, tokensPath)));
}

main();
