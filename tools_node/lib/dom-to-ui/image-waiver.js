// doc_id: doc_other_0009 — Image Asset Waiver Registry (M20)
// Detects url(...) references in computed-style snapshots and verifies whether
// the file is actually present in the workspace.  Missing assets become
// waivers that pixel-diff can exclude from its denominator.
'use strict';

const fs = require('fs');
const path = require('path');

function extractUrls(snapshots) {
  const urls = [];
  for (const s of snapshots) {
    const styles = s.styles || {};
    for (const prop of ['background-image', 'mask-image', '-webkit-mask-image']) {
      const v = styles[prop];
      if (!v || v === 'none') continue;
      const re = /url\((["']?)([^"')]+)\1\)/g;
      let m;
      while ((m = re.exec(v))) {
        urls.push({ snapshot: s, url: m[2], cssProp: prop, rect: styles._rect || null, ucufId: s.ucufId });
      }
    }
  }
  return urls;
}

function urlExistsLocally(url, repoRoot) {
  if (!url) return false;
  if (/^(data|https?|blob):/i.test(url)) return true; // not a file we care about
  // Strip query / hash
  const clean = url.split('?')[0].split('#')[0];
  // Resolve relative to repoRoot
  const abs = path.resolve(repoRoot, clean.replace(/^\//, ''));
  return fs.existsSync(abs);
}

/**
 * Build waiver report.
 * @param {object} args { snapshots, repoRoot, sourceDir, screenId }
 * @returns {object}
 */
function buildWaivers(args) {
  const snapshots = args.snapshots || [];
  const repoRoot = args.repoRoot || process.cwd();
  const sourceDir = args.sourceDir || repoRoot;
  const urls = extractUrls(snapshots);

  const waivers = [];
  for (const u of urls) {
    if (urlExistsLocally(u.url, repoRoot) || urlExistsLocally(u.url, sourceDir)) continue;
    waivers.push({
      ucufId: u.ucufId || null,
      snapshotPath: u.snapshot.path,
      url: u.url,
      reason: 'asset-not-in-db',
      cssProp: u.cssProp,
      rectInCanvas: u.rect ? { x: u.rect.x, y: u.rect.y, w: u.rect.w, h: u.rect.h } : null,
      manualOverride: false,
    });
  }

  const manualWaivers = normalizeManualWaivers(args.manualWaivers || readManualWaivers(args.manualWaiverPath));
  for (const waiver of manualWaivers) {
    waivers.push(Object.assign({
      ucufId: null,
      snapshotPath: waiver.selector || waiver.snapshotPath || 'manual',
      url: waiver.url || null,
      reason: waiver.reason || 'manual-override',
      cssProp: waiver.cssProp || null,
      rectInCanvas: waiver.rectInCanvas || null,
      manualOverride: true,
    }, waiver, { manualOverride: true }));
  }

  const totalWaiverPixels = waivers.reduce((sum, w) =>
    sum + (w.rectInCanvas ? w.rectInCanvas.w * w.rectInCanvas.h : 0), 0);

  return {
    screenId: args.screenId || null,
    waivers,
    totalWaiverPixels,
  };
}

function readManualWaivers(filePath) {
  if (!filePath) return [];
  try {
    if (!fs.existsSync(filePath)) return [];
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
    return normalizeManualWaivers(json);
  } catch (_) {
    return [];
  }
}

function normalizeManualWaivers(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.waivers)) return value.waivers;
  return [];
}

function waiverRectsForPixelDiff(waiverReport) {
  return (waiverReport.waivers || [])
    .map(w => w.rectInCanvas)
    .filter(Boolean);
}

module.exports = { buildWaivers, waiverRectsForPixelDiff, readManualWaivers };
