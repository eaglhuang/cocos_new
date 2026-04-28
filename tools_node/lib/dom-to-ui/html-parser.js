// doc_id: doc_other_0009 — minimal recursive HTML parser without external deps
// 僅實作專案需求子集（§5.1 / §27 / §8）：
//   - 一般 element / void element / 文字節點
//   - class / id / style / data-* 屬性
//   - <style> 區塊（保留 raw cssText 供後續解析）
//   - 不處理 SVG/MathML 命名空間，不處理 CDATA
//
// 設計目的：避免引入 jsdom / cheerio 體積，可後續無痛替換。
'use strict';

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

/**
 * Parse HTML string into a tree of nodes.
 * Element node: { type:'element', tag, attrs, children, cssText? }
 * Text node:    { type:'text', value }
 * @param {string} html
 * @returns {{ children: object[], styleSheets: string[], warnings: object[] }}
 */
function parseHtml(html) {
  const tokens = tokenize(html);
  const stack = [{ type: 'element', tag: '#root', attrs: {}, children: [] }];
  const styleSheets = [];
  const warnings = [];

  for (const tok of tokens) {
    const top = stack[stack.length - 1];
    if (tok.kind === 'text') {
      const trimmed = tok.value.replace(/\s+/g, ' ');
      if (trimmed.trim().length === 0) continue;
      top.children.push({ type: 'text', value: tok.value });
    } else if (tok.kind === 'open') {
      const node = {
        type: 'element',
        tag: tok.tag,
        attrs: tok.attrs,
        children: [],
      };
      top.children.push(node);
      const isVoid = VOID_ELEMENTS.has(tok.tag) || tok.selfClosing;
      if (!isVoid) stack.push(node);
    } else if (tok.kind === 'close') {
      // pop stack down to matching tag, tolerate mismatched
      let popped = false;
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === tok.tag) {
          stack.length = i;
          popped = true;
          break;
        }
      }
      if (!popped) {
        warnings.push({ code: 'unmatched-close-tag', detail: tok.tag });
      }
    } else if (tok.kind === 'rawtext') {
      // attach to last opened element
      if (top.tag === 'style') styleSheets.push(tok.value);
      top.children.push({ type: 'text', value: tok.value });
    }
  }

  return { children: stack[0].children, styleSheets, warnings };
}

function tokenize(html) {
  const out = [];
  let i = 0;
  const n = html.length;

  while (i < n) {
    if (html[i] === '<') {
      // comment
      if (html.slice(i, i + 4) === '<!--') {
        const end = html.indexOf('-->', i + 4);
        i = end < 0 ? n : end + 3;
        continue;
      }
      if (html[i + 1] === '!') {
        // doctype or other declaration -> skip until '>'
        const end = html.indexOf('>', i + 1);
        i = end < 0 ? n : end + 1;
        continue;
      }
      // close tag
      if (html[i + 1] === '/') {
        const end = html.indexOf('>', i + 2);
        if (end < 0) { i = n; continue; }
        const tag = html.slice(i + 2, end).trim().toLowerCase();
        out.push({ kind: 'close', tag });
        i = end + 1;
        continue;
      }
      // open tag
      const end = findTagEnd(html, i);
      if (end < 0) { i = n; continue; }
      const inner = html.slice(i + 1, end);
      const selfClosing = inner.endsWith('/');
      const cleaned = selfClosing ? inner.slice(0, -1) : inner;
      const { tag, attrs } = parseOpenTag(cleaned);
      out.push({ kind: 'open', tag, attrs, selfClosing });
      i = end + 1;
      // raw text content for script/style/textarea/title
      if (RAW_TEXT_TAGS.has(tag) && !selfClosing) {
        const closeIdx = findRawTextClose(html, i, tag);
        if (closeIdx > i) {
          out.push({ kind: 'rawtext', value: html.slice(i, closeIdx) });
          i = closeIdx;
        }
      }
    } else {
      // text node
      const next = html.indexOf('<', i);
      const end = next < 0 ? n : next;
      const value = decodeEntities(html.slice(i, end));
      out.push({ kind: 'text', value });
      i = end;
    }
  }
  return out;
}

function findTagEnd(html, start) {
  let i = start + 1;
  let inDouble = false;
  let inSingle = false;
  while (i < html.length) {
    const ch = html[i];
    if (inDouble) {
      if (ch === '"') inDouble = false;
    } else if (inSingle) {
      if (ch === "'") inSingle = false;
    } else {
      if (ch === '"') inDouble = true;
      else if (ch === "'") inSingle = true;
      else if (ch === '>') return i;
    }
    i += 1;
  }
  return -1;
}

function parseOpenTag(inner) {
  const m = inner.match(/^([A-Za-z][A-Za-z0-9-]*)/);
  const tag = m ? m[1].toLowerCase() : 'unknown';
  const rest = m ? inner.slice(m[0].length) : '';
  const attrs = {};
  const re = /\s+([A-Za-z_:][A-Za-z0-9_:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`<>=]+)))?/g;
  let am;
  while ((am = re.exec(rest)) !== null) {
    const key = am[1].toLowerCase();
    const value = am[3] != null ? am[3] : (am[4] != null ? am[4] : (am[5] != null ? am[5] : ''));
    attrs[key] = decodeEntities(value);
  }
  return { tag, attrs };
}

function findRawTextClose(html, start, tag) {
  const lower = html.toLowerCase();
  const target = `</${tag}`;
  let idx = start;
  while (idx < html.length) {
    const at = lower.indexOf(target, idx);
    if (at < 0) return html.length;
    // ensure followed by '>' or whitespace
    const after = html[at + target.length];
    if (after === '>' || /\s/.test(after) || after === undefined) return at;
    idx = at + target.length;
  }
  return html.length;
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Parse a tiny subset of CSS: top-level rules of form "selector { decl; decl }".
 * Returns map: className -> declarationsObject.
 * Only handles a single ".class" or "#id" selector per rule (chained selectors merged into class hits).
 */
function parseStylesheets(sheets) {
  const classRules = {};
  const idRules = {};
  for (const sheet of sheets) {
    const noComments = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
    const ruleRe = /([^{}]+)\{([^{}]+)\}/g;
    let m;
    while ((m = ruleRe.exec(noComments)) !== null) {
      const selector = m[1].trim();
      const body = m[2];
      const decl = parseDeclarations(body);
      for (const sel of selector.split(',').map(s => s.trim())) {
        if (!sel || sel.includes(':')) continue;
        const classMatches = [...sel.matchAll(/\.([A-Za-z0-9_-]+)/g)].map(hit => hit[1]);
        const idMatches = [...sel.matchAll(/#([A-Za-z0-9_-]+)/g)].map(hit => hit[1]);
        if (classMatches.length > 0) {
          const cls = classMatches[classMatches.length - 1];
          classRules[cls] = Object.assign(classRules[cls] || {}, decl);
        } else if (idMatches.length > 0) {
          const id = idMatches[idMatches.length - 1];
          idRules[id] = Object.assign(idRules[id] || {}, decl);
        }
      }
    }
  }
  return { classRules, idRules };
}

function parseDeclarations(body) {
  const out = {};
  for (const rawDecl of body.split(';')) {
    const idx = rawDecl.indexOf(':');
    if (idx <= 0) continue;
    const key = rawDecl.slice(0, idx).trim().toLowerCase();
    const value = rawDecl.slice(idx + 1).trim();
    if (key) out[camelizeCss(key)] = value;
  }
  return out;
}

function camelizeCss(prop) {
  return prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseInlineStyle(styleStr) {
  if (!styleStr) return {};
  return parseDeclarations(styleStr);
}

module.exports = {
  parseHtml,
  parseStylesheets,
  parseInlineStyle,
  VOID_ELEMENTS,
};
