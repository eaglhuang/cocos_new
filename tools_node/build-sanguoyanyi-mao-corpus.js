'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const SOURCE_ROOT = 'https://raw.githubusercontent.com/Ancient-China-Books/sanguoyanyi/master';
const INDEX_URL = `${SOURCE_ROOT}/index.html`;
const USER_AGENT = '3KLife-SanguoyanyiCorpus/1.0';
const REQUEST_DELAY_MS = 80;

const args = process.argv.slice(2);

function getArg(flag, fallback = null) {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value === undefined || value.startsWith('--') ? fallback : value;
}

const limitArg = getArg('--limit');
const limit = limitArg ? parseInt(limitArg, 10) : null;

if (limitArg && Number.isNaN(limit)) {
  console.error(`Invalid --limit value: ${limitArg}`);
  process.exit(1);
}

const dateStamp = new Date().toISOString().slice(0, 10);
const defaultOutputDir = path.join(ROOT, 'artifacts', 'data-pipeline', `sanguoyanyi-mao-hant-${dateStamp}`);
const outputDir = path.resolve(getArg('--outputDir', defaultOutputDir));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchText(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      },
    }, response => {
      const { statusCode, headers } = response;

      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        response.resume();
        if (redirectCount > 5) {
          reject(new Error(`Too many redirects for ${url}`));
          return;
        }
        const nextUrl = new URL(headers.location, url).toString();
        resolve(fetchText(nextUrl, redirectCount + 1));
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${statusCode} for ${url}`));
        return;
      }

      response.setEncoding('utf8');
      let data = '';
      response.on('data', chunk => {
        data += chunk;
      });
      response.on('end', () => resolve(data));
    });

    request.on('error', reject);
  });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function decodeEntities(input) {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(parseInt(number, 10)));
}

function normalizeText(input) {
  const decoded = decodeEntities(input)
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/对/g, '對')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ');

  return decoded
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function getAttr(attributes, name) {
  const match = attributes.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

function isNoteClass(className) {
  return /(jiazhu|jiazhusup|jiozhusup)/i.test(className || '');
}

function parseInlineContent(html, forceAllNote = false) {
  const tokens = html.match(/<[^>]+>|[^<]+/g) || [];
  let body = '';
  let noteBuffer = '';
  let anchorDepth = 0;
  const notes = [];
  const noteTagStack = [];
  const nestedInsideNoteStack = [];

  function noteIsActive() {
    return forceAllNote || noteTagStack.length > 0;
  }

  function append(text) {
    if (!text) return;
    if (noteIsActive()) {
      noteBuffer += text;
      return;
    }
    body += text;
  }

  function flushInlineNoteIfNeeded() {
    if (forceAllNote || noteTagStack.length > 0) return;
    const text = normalizeText(noteBuffer);
    if (text) notes.push(text);
    noteBuffer = '';
  }

  for (const token of tokens) {
    if (token.startsWith('<')) {
      const isClosing = /^<\//.test(token);
      const nameMatch = token.match(/^<\/?\s*([a-zA-Z0-9]+)/);
      const tagName = nameMatch ? nameMatch[1].toLowerCase() : '';
      const isSelfClosing = /\/\s*>$/.test(token) || /^<br\b/i.test(token);

      if (isClosing) {
        if (tagName === 'a' && anchorDepth > 0) {
          anchorDepth -= 1;
          continue;
        }
        if (!forceAllNote && noteTagStack.length > 0 && nestedInsideNoteStack.length > 0) {
          nestedInsideNoteStack.pop();
          continue;
        }
        if (!forceAllNote && noteTagStack.length > 0 && tagName === noteTagStack[noteTagStack.length - 1]) {
          noteTagStack.pop();
          flushInlineNoteIfNeeded();
        }
        continue;
      }

      if (tagName === 'a') {
        anchorDepth += 1;
        continue;
      }

      if (anchorDepth > 0) continue;

      if (tagName === 'br') {
        append('\n');
        continue;
      }

      const className = getAttr(token, 'class');
      if ((tagName === 'span' || tagName === 'sup') && isNoteClass(className)) {
        if (noteTagStack.length === 0) noteBuffer = '';
        noteTagStack.push(tagName);
        if (isSelfClosing) {
          noteTagStack.pop();
          flushInlineNoteIfNeeded();
        }
      } else if (noteTagStack.length > 0 && !isSelfClosing) {
        nestedInsideNoteStack.push(tagName);
      }
      continue;
    }

    if (anchorDepth > 0) continue;
    append(token);
  }

  if (forceAllNote) {
    const text = normalizeText(noteBuffer);
    if (text) notes.push(text);
  } else if (noteBuffer.trim() && noteTagStack.length === 0) {
    flushInlineNoteIfNeeded();
  }

  return {
    body: normalizeText(body),
    notes,
  };
}

function parseBlockContent(chapterHtml) {
  const match = chapterHtml.match(/<div id="text">([\s\S]*?)<\/div>\s*<\/body>/i);
  if (!match) {
    throw new Error('Cannot find <div id="text"> in source chapter HTML.');
  }

  const innerHtml = match[1];
  const blockRegex = /<(h1|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  const bodyBlocks = [];
  const noteEntries = [];
  let blockIndex = 0;

  let blockMatch;
  while ((blockMatch = blockRegex.exec(innerHtml)) !== null) {
    blockIndex += 1;
    const tagName = blockMatch[1].toLowerCase();
    const attributes = blockMatch[2];
    const blockInnerHtml = blockMatch[3];
    const className = getAttr(attributes, 'class');
    const paragraphId = getAttr(attributes, 'id') || `block-${blockIndex}`;

    if (tagName === 'h1') {
      const heading = parseInlineContent(blockInnerHtml).body;
      if (heading) bodyBlocks.push(`# ${heading}`);
      continue;
    }

    const parsed = parseInlineContent(blockInnerHtml, isNoteClass(className));
    if (!isNoteClass(className) && parsed.body) {
      bodyBlocks.push(parsed.body);
    }

    parsed.notes.forEach((noteText, noteIndex) => {
      const ref = parsed.notes.length === 1 ? paragraphId : `${paragraphId}-${noteIndex + 1}`;
      noteEntries.push({ ref, text: noteText });
    });
  }

  return { bodyBlocks, noteEntries };
}

function parseIndex(indexHtml) {
  const itemRegex = /<li>\s*<a href="(OEBPS\/Text\/[^"]+)">([\s\S]*?)<\/a>\s*<\/li>/gi;
  const items = [];
  let chapterNumber = 0;
  let frontNumber = 0;
  let match;

  while ((match = itemRegex.exec(indexHtml)) !== null) {
    const relativePath = match[1];
    const title = normalizeText(match[2]);
    const isChapter = /^第[一二三四五六七八九十百〇零○]+回/.test(title);
    const fileNumber = isChapter ? ++chapterNumber : ++frontNumber;

    items.push({
      order: items.length + 1,
      kind: isChapter ? 'chapter' : 'frontmatter',
      fileNumber,
      title,
      relativePath,
      sourceUrl: `${SOURCE_ROOT}/${relativePath}`,
    });
  }

  return items;
}

function buildBodyMarkdown(item, bodyBlocks) {
  const blocks = bodyBlocks.slice();
  if (!blocks.length || !/^#\s+/.test(blocks[0])) {
    blocks.unshift(`# ${item.title}`);
  }
  return `${blocks.join('\n\n')}\n`;
}

function buildNotesMarkdown(item, noteEntries) {
  const lines = [`# ${item.title} 夾註`, ''];
  if (!noteEntries.length) {
    lines.push('（本節無夾註）', '');
    return lines.join('\n');
  }

  for (const entry of noteEntries) {
    lines.push(`## ${entry.ref}`, '', entry.text, '');
  }

  return lines.join('\n');
}

function buildReadme(manifest) {
  return [
    '# Sanguoyanyi Mao Hant Corpus',
    '',
    `- generatedAt: ${manifest.generatedAt}`,
    `- source: ${manifest.source.indexUrl}`,
    '- edition: 繁體毛評本（GitHub: Ancient-China-Books/sanguoyanyi）',
    '- body/chapters: 第一回至第一百二十回的正文 markdown',
    '- body/frontmatter: 序、凡例、讀三國志法',
    '- annotations/chapters: 對應章回的夾註 markdown',
    '- annotations/frontmatter: 前置篇章的夾註 markdown',
    '- combined/all.body.md: 合併後正文',
    '- combined/all.annotations.md: 合併後夾註',
    '- manifest.json: 來源與輸出索引',
    '',
    '## Split Rule',
    '',
    '- `p.jiazhu` 等整段夾註會完整移到 annotations。',
    '- 正文段落中的 `span.jiazhu` / `sup` 類夾註會自正文剝離，並依原段落 id 存到 annotations。',
    '- 正文 markdown 保留段落分隔與詩句換行，但不保留原始 XHTML 樣式 class。',
    '',
  ].join('\n');
}

async function main() {
  console.log(`[sanguoyanyi] outputDir = ${outputDir}`);
  const indexHtml = await fetchText(INDEX_URL);
  const items = parseIndex(indexHtml);
  const selectedItems = limit ? items.slice(0, limit) : items;

  const bodyDir = path.join(outputDir, 'body');
  const bodyChaptersDir = path.join(bodyDir, 'chapters');
  const bodyFrontmatterDir = path.join(bodyDir, 'frontmatter');
  const annotationsDir = path.join(outputDir, 'annotations');
  const annotationsChaptersDir = path.join(annotationsDir, 'chapters');
  const annotationsFrontmatterDir = path.join(annotationsDir, 'frontmatter');
  const combinedDir = path.join(outputDir, 'combined');

  fs.rmSync(outputDir, { recursive: true, force: true });
  [
    bodyChaptersDir,
    bodyFrontmatterDir,
    annotationsChaptersDir,
    annotationsFrontmatterDir,
    combinedDir,
  ].forEach(ensureDir);

  const manifestItems = [];
  const combinedBodyParts = [];
  const combinedAnnotationsParts = [];

  for (const item of selectedItems) {
    console.log(`[sanguoyanyi] fetching ${item.title}`);
    const html = await fetchText(item.sourceUrl);
    const { bodyBlocks, noteEntries } = parseBlockContent(html);
    const bodyMarkdown = buildBodyMarkdown(item, bodyBlocks);
    const notesMarkdown = buildNotesMarkdown(item, noteEntries);
    const subDir = item.kind === 'chapter' ? 'chapters' : 'frontmatter';
    const fileName = `${String(item.fileNumber).padStart(3, '0')}.md`;
    const annotationFileName = `${String(item.fileNumber).padStart(3, '0')}.annotations.md`;
    const bodyFilePath = path.join(outputDir, 'body', subDir, fileName);
    const annotationFilePath = path.join(outputDir, 'annotations', subDir, annotationFileName);

    fs.writeFileSync(bodyFilePath, bodyMarkdown, 'utf8');
    fs.writeFileSync(annotationFilePath, notesMarkdown, 'utf8');

    manifestItems.push({
      order: item.order,
      kind: item.kind,
      fileNumber: item.fileNumber,
      title: item.title,
      sourceUrl: item.sourceUrl,
      sourcePath: item.relativePath,
      bodyFile: path.relative(outputDir, bodyFilePath).replace(/\\/g, '/'),
      annotationsFile: path.relative(outputDir, annotationFilePath).replace(/\\/g, '/'),
      bodyBlockCount: bodyBlocks.length,
      annotationCount: noteEntries.length,
    });

    combinedBodyParts.push(bodyMarkdown.trim());
    combinedAnnotationsParts.push(notesMarkdown.trim());

    await sleep(REQUEST_DELAY_MS);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: {
      repository: 'Ancient-China-Books/sanguoyanyi',
      indexUrl: INDEX_URL,
      edition: '繁體毛評本',
    },
    itemCount: manifestItems.length,
    chapterCount: manifestItems.filter(item => item.kind === 'chapter').length,
    frontmatterCount: manifestItems.filter(item => item.kind === 'frontmatter').length,
    items: manifestItems,
  };

  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'README.md'), buildReadme(manifest), 'utf8');
  fs.writeFileSync(path.join(combinedDir, 'all.body.md'), `${combinedBodyParts.join('\n\n---\n\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(combinedDir, 'all.annotations.md'), `${combinedAnnotationsParts.join('\n\n---\n\n')}\n`, 'utf8');

  console.log(`[sanguoyanyi] done: ${manifest.chapterCount} chapters, ${manifest.frontmatterCount} frontmatter sections`);
}

main().catch(error => {
  console.error(`[sanguoyanyi] ${error.stack || error.message}`);
  process.exit(1);
});