// HTML-to-UCUF v2 source package resolver.
// A source package owns the design tokens, global CSS, and main HTML together.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_TOKEN_CANDIDATES = [
  'ui-design-tokens.json',
  path.join('source', 'ui-design-tokens.json'),
  path.join('design_handoff', 'source', 'ui-design-tokens.json'),
];

const DEFAULT_CSS_CANDIDATES = [
  'colors_and_type.css',
  path.join('design_handoff', 'colors_and_type.css'),
];

const SKIP_DIRS = new Set(['.git', 'node_modules', 'library', 'temp', 'profiles', 'settings']);

function resolveSourcePackage(options) {
  const opts = options || {};
  const errors = [];
  const warnings = [];
  const sourceDir = opts.sourceDir ? path.resolve(opts.sourceDir) : null;

  if (!sourceDir) {
    errors.push('source-dir-required');
    return buildResult({ ok: false, errors, warnings });
  }
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    errors.push(`source-dir-not-found:${sourceDir}`);
    return buildResult({ ok: false, errors, warnings, sourceDir });
  }

  const tokensPath = firstExisting(sourceDir, opts.tokensPath ? [opts.tokensPath] : DEFAULT_TOKEN_CANDIDATES);
  const cssPath = firstExisting(sourceDir, opts.cssPath ? [opts.cssPath] : DEFAULT_CSS_CANDIDATES);
  const mainHtmlPath = resolveMainHtml(sourceDir, opts.mainHtml, errors);

  let tokens = null;
  if (!tokensPath) {
    errors.push('ui-design-tokens-json-not-found');
  } else {
    try {
      tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8').replace(/^\uFEFF/, ''));
      for (const key of ['colors', 'spacing', 'typography']) {
        if (!tokens[key] || typeof tokens[key] !== 'object') errors.push(`tokens-missing-root:${key}`);
      }
    } catch (error) {
      errors.push(`tokens-json-invalid:${error.message}`);
    }
  }

  let cssText = '';
  if (!cssPath) {
    errors.push('colors-and-type-css-not-found');
  } else {
    cssText = fs.readFileSync(cssPath, 'utf8').replace(/^\uFEFF/, '');
    if (!/:root\b|--[A-Za-z0-9_-]+\s*:/.test(cssText)) {
      errors.push('colors-and-type-css-has-no-root-or-vars');
    }
  }

  let htmlText = '';
  if (mainHtmlPath) {
    htmlText = fs.readFileSync(mainHtmlPath, 'utf8').replace(/^\uFEFF/, '');
    if (!/<body\b[\s\S]*>[\s\S]*<\/body>/i.test(htmlText)) warnings.push('main-html-body-not-explicit');
    if (!/<(div|main|section|article|canvas|body)\b/i.test(htmlText)) errors.push('main-html-no-renderable-root');
    for (const href of findStylesheetHrefs(htmlText)) {
      if (/^(https?:|data:|file:|\/\/)/i.test(href)) {
        warnings.push(`external-stylesheet:${href}`);
        continue;
      }
      const linkedPath = path.resolve(path.dirname(mainHtmlPath), href);
      if (!fs.existsSync(linkedPath)) warnings.push(`linked-stylesheet-not-found:${href}`);
    }
  }

  const ok = errors.length === 0;
  const manifest = ok ? {
    sourceDir: relFromCwd(sourceDir),
    mainHtml: relFrom(sourceDir, mainHtmlPath),
    tokens: relFrom(sourceDir, tokensPath),
    css: relFrom(sourceDir, cssPath),
    hashes: {
      html: sha256File(mainHtmlPath),
      css: sha256File(cssPath),
      tokens: sha256File(tokensPath),
    },
    warnings,
  } : null;

  return buildResult({
    ok,
    errors,
    warnings,
    sourceDir,
    mainHtmlPath,
    tokensPath,
    cssPath,
    tokens,
    cssText,
    htmlText,
    manifest,
  });
}

function buildResult(result) {
  return Object.assign({
    ok: false,
    errors: [],
    warnings: [],
    sourceDir: null,
    mainHtmlPath: null,
    tokensPath: null,
    cssPath: null,
    tokens: null,
    cssText: '',
    htmlText: '',
    manifest: null,
  }, result);
}

function firstExisting(sourceDir, candidates) {
  for (const candidate of candidates) {
    const rel = String(candidate || '').replace(/\\/g, '/');
    if (!rel || path.isAbsolute(rel) || rel.split('/').includes('..')) continue;
    const full = path.resolve(sourceDir, rel);
    if (isInside(sourceDir, full) && fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

function resolveMainHtml(sourceDir, mainHtml, errors) {
  if (mainHtml) {
    const rel = String(mainHtml).replace(/\\/g, '/');
    if (path.isAbsolute(rel) || rel.split('/').includes('..')) {
      errors.push('main-html-must-be-relative-inside-source-dir');
      return null;
    }
    const full = path.resolve(sourceDir, rel);
    if (!isInside(sourceDir, full) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      errors.push(`main-html-not-found:${rel}`);
      return null;
    }
    return full;
  }

  const htmlFiles = findHtmlFiles(sourceDir);
  if (htmlFiles.length === 0) {
    errors.push('main-html-not-found');
    return null;
  }
  if (htmlFiles.length > 1) {
    errors.push(`main-html-ambiguous:${htmlFiles.map(file => relFrom(sourceDir, file)).slice(0, 8).join(',')}`);
    return null;
  }
  return htmlFiles[0];
}

function findHtmlFiles(sourceDir) {
  const out = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.html?$/i.test(entry.name)) out.push(full);
    }
  }
  walk(sourceDir);
  return out;
}

function writeSourcePackageManifest(sourcePackage, outputPath, extra) {
  if (!sourcePackage || !sourcePackage.ok) throw new Error('valid sourcePackage required');
  const manifest = Object.assign({
    validatedAt: new Date().toISOString(),
  }, sourcePackage.manifest, extra || {});
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}

function writeHtmlWithSourceCss(options) {
  const htmlPath = path.resolve(options.htmlPath);
  const cssPath = path.resolve(options.cssPath);
  const outputPath = path.resolve(options.outputPath);
  let html = fs.readFileSync(htmlPath, 'utf8').replace(/^\uFEFF/, '');
  const cssText = fs.readFileSync(cssPath, 'utf8').replace(/^\uFEFF/, '');
  html = ensureBaseHref(html, path.dirname(htmlPath));
  html = injectCssIntoHtml(html, cssText, options.cssLabel || path.basename(cssPath));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
  return { outputPath, cssBytes: Buffer.byteLength(cssText, 'utf8') };
}

function ensureBaseHref(html, htmlDir) {
  if (/<base\s+href=/i.test(html)) return html;
  const baseHref = encodeURI(`file:///${path.resolve(htmlDir).replace(/\\/g, '/')}/`);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>\n<base href="${baseHref}">`);
  return `<head><base href="${baseHref}"></head>\n${html}`;
}

function injectCssIntoHtml(html, cssText, label) {
  const style = `<style data-ucuf-source-css="${escapeAttr(label || 'colors_and_type.css')}">\n${cssText}\n</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}\n</head>`);
  return `${style}\n${html}`;
}

function findStylesheetHrefs(html) {
  const out = [];
  const re = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(html)) !== null) out.push(match[1]);
  return out;
}

function sha256File(filePath) {
  return 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 32);
}

function isInside(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function relFrom(base, target) {
  return path.relative(path.resolve(base), path.resolve(target)).replace(/\\/g, '/');
}

function relFromCwd(target) {
  return path.relative(process.cwd(), path.resolve(target)).replace(/\\/g, '/');
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

module.exports = {
  resolveSourcePackage,
  writeSourcePackageManifest,
  writeHtmlWithSourceCss,
  ensureBaseHref,
  injectCssIntoHtml,
};
