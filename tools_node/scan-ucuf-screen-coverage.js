#!/usr/bin/env node
// doc_id: doc_other_0009 — UCUF Screen Coverage Tracker (M36)
//
// Purpose:
//   Scan layouts/, screens/, ui/components/**, and Design System ui_kits/
//   to classify every UI screen into one of 4 states:
//     - orphan        : layout JSON exists, no mount() reference
//     - pending-html  : Design System HTML exists, no layout JSON
//     - wired-dev     : runtime-route.json exists with featureFlag (dev toggle on)
//     - cutover-prod  : mount() points directly at this screenId, no flag
//
// Output:
//   - docs/ui-screen-migration-coverage.md  (human report)
//   - artifacts/ui-screen-coverage.json     (machine-readable)
//
// Usage:
//   node tools_node/scan-ucuf-screen-coverage.js [--write-md] [--json <path>]

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LAYOUTS_DIR = path.join(ROOT, 'assets/resources/ui-spec/layouts');
const SCREENS_DIR = path.join(ROOT, 'assets/resources/ui-spec/screens');
const COMPONENTS_DIR = path.join(ROOT, 'assets/scripts/ui/components');
const HANDOFF_DIRS = [
  path.join(ROOT, 'Design System/ui_kits'),
  path.join(ROOT, 'Design System 2/ui_kits'),
];
const COVERAGE_MD = path.join(ROOT, 'docs/ui-screen-migration-coverage.md');
const COVERAGE_JSON = path.join(ROOT, 'artifacts/ui-screen-coverage.json');

function parseArgs(argv) {
  const opts = { writeMd: false, json: COVERAGE_JSON };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--write-md') opts.writeMd = true;
    else if (a === '--json') opts.json = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Usage: scan-ucuf-screen-coverage.js [--write-md] [--json <path>]');
      process.exit(0);
    }
  }
  return opts;
}

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.meta'));
}

function scanComponentsForMounts() {
  const mounts = []; // { file, screenId, line }
  if (!fs.existsSync(COMPONENTS_DIR)) return mounts;
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && ent.name.endsWith('.ts')) {
        const text = fs.readFileSync(p, 'utf8');
        const lines = text.split(/\r?\n/);
        lines.forEach((ln, idx) => {
          const m = ln.match(/\bmount\(\s*['"]([^'"]+)['"]/);
          if (m) mounts.push({ file: path.relative(ROOT, p).replace(/\\/g, '/'), screenId: m[1], line: idx + 1 });
        });
      }
    }
  }
  walk(COMPONENTS_DIR);
  return mounts;
}

function scanRuntimeRoutes() {
  const routes = {};
  if (!fs.existsSync(SCREENS_DIR)) return routes;
  for (const f of fs.readdirSync(SCREENS_DIR)) {
    if (!f.endsWith('.runtime-route.json')) continue;
    try {
      const obj = JSON.parse(fs.readFileSync(path.join(SCREENS_DIR, f), 'utf8'));
      if (obj.screenId) routes[obj.screenId] = obj;
    } catch { /* ignore */ }
  }
  return routes;
}

function scanHandoffHtml() {
  const screens = new Set();
  for (const dir of HANDOFF_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const indexHtml = path.join(dir, ent.name, 'index.html');
      if (fs.existsSync(indexHtml)) screens.add(ent.name);
    }
  }
  return Array.from(screens).sort();
}

function classify(layouts, screens, mounts, routes, handoffs) {
  const result = {};

  const mountByScreenId = {};
  for (const m of mounts) {
    if (!mountByScreenId[m.screenId]) mountByScreenId[m.screenId] = [];
    mountByScreenId[m.screenId].push(m);
  }

  // Build inverse map: screenId → list of routes that reference it
  const routesByScreenId = {};
  for (const route of Object.values(routes)) {
    const ids = new Set([route.screenId, route.fallbackScreen, ...Object.values(route.variants || {})]);
    for (const id of ids) {
      if (!id) continue;
      if (!routesByScreenId[id]) routesByScreenId[id] = [];
      routesByScreenId[id].push(route);
    }
  }

  const layoutIds = new Set(layouts.map(f => f.replace(/\.json$/, '')));
  const screenIds = new Set(
    screens
      .filter(f => f.endsWith('-screen.json') || f.endsWith('.screen.json') || f.endsWith('-main.json'))
      .map(f => f.replace(/\.(?:screen\.)?json$/, '').replace(/\.screen$/, ''))
  );

  // All known screenIds = mount targets ∪ screens dir ∪ runtime-routes (default + variants)
  const allIds = new Set([
    ...Object.keys(mountByScreenId),
    ...Array.from(screenIds),
    ...Object.keys(routesByScreenId),
  ]);

  for (const id of allIds) {
    const hasLayout = layoutIds.has(id) || layoutIds.has(id.replace(/-screen$/, '-main')) || layoutIds.has(id.replace(/-screen$/, ''));
    const hasMount = !!mountByScreenId[id];
    const referencingRoutes = routesByScreenId[id] || [];
    const hasRoute = referencingRoutes.length > 0;
    // Indirect mount: any route that references this screen has a registered panelKey,
    // and a mount(panelKey-resolver-output) exists somewhere — we approximate by saying
    // route presence = "mount via UIVariantRouter" candidate.
    const indirectMount = hasRoute;
    const featureFlag = hasRoute ? referencingRoutes[0].featureFlag : null;
    const routeDefaultsHere = hasRoute && referencingRoutes.some(r => r.screenId === id);

    let status;
    if (!hasLayout) {
      status = hasMount ? 'mount-no-layout' : 'unknown';
    } else if (hasRoute && featureFlag) {
      status = routeDefaultsHere ? 'wired-dev' : 'wired-dev';
    } else if (hasRoute && !featureFlag && routeDefaultsHere) {
      status = 'cutover-prod';
    } else if (hasMount) {
      status = 'cutover-prod';
    } else if (indirectMount) {
      status = 'wired-dev';
    } else {
      status = 'orphan';
    }

    result[id] = {
      screenId: id,
      status,
      hasLayout,
      hasMount,
      mountSites: mountByScreenId[id] || [],
      hasRoute,
      featureFlag,
      runtimeRoute: referencingRoutes[0] || null,
    };
  }

  // pending-html: handoff dir name not yet a known screenId
  const pendingHtml = handoffs.filter(name => !allIds.has(name) && !allIds.has(`${name}-screen`) && !allIds.has(`${name}-main`));

  return { byScreen: result, pendingHtml };
}

function buildMarkdown(data) {
  const rows = Object.values(data.byScreen).sort((a, b) => a.screenId.localeCompare(b.screenId));
  const counts = { 'cutover-prod': 0, 'wired-dev': 0, orphan: 0, 'mount-no-layout': 0, unknown: 0 };
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;

  let out = '';
  out += '# UI Screen Migration Coverage\n\n';
  out += `<!-- generated by tools_node/scan-ucuf-screen-coverage.js — do not edit by hand -->\n\n`;
  out += `_Last scan: ${new Date().toISOString()}_\n\n`;
  out += '## 統計\n\n';
  out += `- cutover-prod: **${counts['cutover-prod']}**（已正式 mount 並有 layout JSON）\n`;
  out += `- wired-dev: **${counts['wired-dev']}**（runtime-route.json 帶 featureFlag，dev toggle 中）\n`;
  out += `- orphan: **${counts.orphan}**（有 layout JSON 但無 mount 引用）\n`;
  out += `- mount-no-layout: **${counts['mount-no-layout']}**（mount 引用但 layout 缺）\n`;
  out += `- pending-html: **${data.pendingHtml.length}**（Design System HTML 但尚未拆解）\n\n`;
  out += '## 畫面清單\n\n';
  out += '| screenId | status | layout | mount sites | featureFlag |\n';
  out += '|---|---|---|---|---|\n';
  for (const r of rows) {
    const mountStr = r.mountSites.length ? r.mountSites.map(m => `${m.file}:${m.line}`).join('<br/>') : '—';
    out += `| \`${r.screenId}\` | ${r.status} | ${r.hasLayout ? '✓' : '—'} | ${mountStr} | ${r.featureFlag || '—'} |\n`;
  }
  out += '\n## Pending HTML（尚未拆解的 ui_kits）\n\n';
  if (data.pendingHtml.length === 0) {
    out += '_(none)_\n';
  } else {
    for (const name of data.pendingHtml) out += `- \`${name}\`\n`;
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv);
  const layouts = listJson(LAYOUTS_DIR);
  const screens = listJson(SCREENS_DIR);
  const mounts = scanComponentsForMounts();
  const routes = scanRuntimeRoutes();
  const handoffs = scanHandoffHtml();
  const classified = classify(layouts, screens, mounts, routes, handoffs);

  fs.mkdirSync(path.dirname(opts.json), { recursive: true });
  fs.writeFileSync(opts.json, JSON.stringify(classified, null, 2), 'utf8');

  if (opts.writeMd) {
    fs.mkdirSync(path.dirname(COVERAGE_MD), { recursive: true });
    fs.writeFileSync(COVERAGE_MD, buildMarkdown(classified), 'utf8');
    console.log(`[scan-ucuf-screen-coverage] wrote ${path.relative(ROOT, COVERAGE_MD)}`);
  }
  console.log(`[scan-ucuf-screen-coverage] wrote ${path.relative(ROOT, opts.json)}`);
  const counts = {};
  for (const r of Object.values(classified.byScreen)) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log(`[scan-ucuf-screen-coverage] counts:`, counts, `pending-html=${classified.pendingHtml.length}`);
}

if (require.main === module) main();
module.exports = { classify, scanComponentsForMounts };
