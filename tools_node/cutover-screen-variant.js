#!/usr/bin/env node
// doc_id: doc_other_0009 — Cutover Screen Variant (M35)
//
// Purpose:
//   Apply or revert a screen variant cutover by mutating the
//   `<screen>.runtime-route.json` sidecar:
//     - swap default screenId from variants[from] → variants[to]
//     - mark the previous variant as `fallback`
//   This is the "make the new variant the production default" action.
//
// Safety:
//   - Refuses to run unless --dry-run OR --verdict <path> exists with
//     `verdict: pass` (from runtime-screen-diff.js M34).
//   - Always writes a backup `<screen>.runtime-route.json.bak` before edits.
//   - --rollback restores from the backup.
//
// Usage:
//   node tools_node/cutover-screen-variant.js --screen general-detail-unified-screen \
//     --from unified --to ds3 --verdict artifacts/runtime-diff/character-ds3/character-ds3-main.runtime-verdict.json
//
//   node tools_node/cutover-screen-variant.js --screen general-detail-unified-screen --rollback

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCREENS_DIR = path.join(ROOT, 'assets/resources/ui-spec/screens');

function parseArgs(argv) {
  const opts = { screen: null, from: null, to: null, verdict: null, rollback: false, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--screen': opts.screen = next(); break;
      case '--from': opts.from = next(); break;
      case '--to': opts.to = next(); break;
      case '--verdict': opts.verdict = next(); break;
      case '--rollback': opts.rollback = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--help': case '-h':
        console.log('Usage: cutover-screen-variant.js --screen <screenId> [--from <v> --to <v>] [--verdict <json>] [--dry-run] [--rollback]');
        process.exit(0);
        break;
      default:
        console.error(`[cutover-screen-variant] unknown arg: ${a}`); process.exit(2);
    }
  }
  if (!opts.screen) { console.error('[cutover-screen-variant] --screen required'); process.exit(2); }
  if (!opts.rollback && (!opts.from || !opts.to)) {
    console.error('[cutover-screen-variant] --from and --to required (or use --rollback)');
    process.exit(2);
  }
  return opts;
}

function checkVerdict(verdictPath) {
  if (!fs.existsSync(verdictPath)) return { ok: false, reason: `verdict file not found: ${verdictPath}` };
  try {
    const v = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
    if (v.verdict !== 'pass') return { ok: false, reason: `verdict is "${v.verdict}", required "pass"` };
    if (!v.runtimeVsSource || typeof v.runtimeVsSource.score !== 'number') {
      return { ok: false, reason: 'runtimeVsSource.score is required for production cutover; source-vs-UCUF preview pass is not enough' };
    }
    return { ok: true, verdict: v };
  } catch (e) { return { ok: false, reason: `verdict parse failed: ${e.message}` }; }
}

function assertCanonicalScreenExists(screenId) {
  const screenPath = path.join(SCREENS_DIR, `${screenId}.json`);
  if (!fs.existsSync(screenPath)) {
    throw new Error(`canonical screen JSON not found for target "${screenId}": ${path.relative(ROOT, screenPath)}`);
  }
}

function applyCutover(routePath, opts) {
  const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
  const before = JSON.stringify(route);
  if (!route.variants || !route.variants[opts.to]) {
    throw new Error(`runtime-route variants does not have key "${opts.to}"; have: ${Object.keys(route.variants || {}).join(', ')}`);
  }
  // Swap default
  const newScreenId = route.variants[opts.to];
  route.fallbackScreen = route.screenId;
  route.screenId = newScreenId;
  route.featureFlag = null; // cutover removes the flag — new default
  route.cutover = {
    from: opts.from,
    to: opts.to,
    at: new Date().toISOString(),
    verdictRef: opts.verdict ? path.relative(ROOT, path.resolve(opts.verdict)).replace(/\\/g, '/') : null,
    previous: { screenId: JSON.parse(before).screenId, featureFlag: JSON.parse(before).featureFlag || null },
  };
  return route;
}

function main() {
  const opts = parseArgs(process.argv);
  const routePath = path.join(SCREENS_DIR, `${opts.screen}.runtime-route.json`);
  const backupPath = `${routePath}.bak`;

  if (!fs.existsSync(routePath)) {
    console.error(`[cutover-screen-variant] route sidecar not found: ${path.relative(ROOT, routePath)}`);
    console.error('[cutover-screen-variant] hint: run register-ucuf-runtime-route.js first');
    process.exit(2);
  }

  if (opts.rollback) {
    if (!fs.existsSync(backupPath)) { console.error('[cutover-screen-variant] no backup to rollback'); process.exit(2); }
    if (opts.dryRun) {
      console.log('[cutover-screen-variant] (dry-run) would restore from', path.relative(ROOT, backupPath));
      return;
    }
    fs.copyFileSync(backupPath, routePath);
    fs.unlinkSync(backupPath);
    console.log(`[cutover-screen-variant] rolled back ${path.relative(ROOT, routePath)}`);
    return;
  }

  // Verdict gate
  if (opts.verdict) {
    const r = checkVerdict(opts.verdict);
    if (!r.ok) { console.error('[cutover-screen-variant] gate FAILED:', r.reason); process.exit(3); }
    console.log(`[cutover-screen-variant] gate ok: verdict=pass score=${r.verdict.sourceVsUcuf?.score}`);
  } else if (!opts.dryRun) {
    console.error('[cutover-screen-variant] --verdict <json> is required (or use --dry-run for preview)');
    process.exit(2);
  }

  const newRoute = applyCutover(routePath, opts);
  assertCanonicalScreenExists(newRoute.screenId);

  if (opts.dryRun) {
    console.log('[cutover-screen-variant] (dry-run) new sidecar would be:');
    console.log(JSON.stringify(newRoute, null, 2));
    return;
  }

  fs.copyFileSync(routePath, backupPath);
  fs.writeFileSync(routePath, JSON.stringify(newRoute, null, 2) + '\n', 'utf8');
  console.log(`[cutover-screen-variant] applied: ${opts.from} → ${opts.to}`);
  console.log(`  new screenId:    ${newRoute.screenId}`);
  console.log(`  fallback:        ${newRoute.fallbackScreen}`);
  console.log(`  backup:          ${path.relative(ROOT, backupPath)}`);
  console.log('  rollback with:   --rollback');
}

if (require.main === module) main();
module.exports = { applyCutover, checkVerdict };
