#!/usr/bin/env node
// doc_id: doc_other_0009 — Register UCUF Runtime Route (M31)
//
// Purpose:
//   Generate `<screen>.runtime-route.json` sidecars under
//   `assets/resources/ui-spec/screens/`. These are loaded at boot via
//   `UIVariantRouter.loadFromManifest()` so the runtime can map a panelKey
//   (e.g. "general-detail") to one of N screenIds, gated by featureFlag.
//
// Sidecar schema (validated below):
//   {
//     "screenId":       string,                 // canonical default screenId
//     "panelKey":       string,                 // composite key, e.g. "general-detail"
//     "mountTarget":    string,                 // node path or "<auto>"
//     "componentClass": string,                 // e.g. "GeneralDetailComposite"
//     "featureFlag":    string | null,          // e.g. "ds3" or null
//     "fallbackScreen": string | null,          // fallback screenId on resolve fail
//     "variants":       { [variantKey: string]: string }  // ds3 → character-ds3-main
//   }
//
// Usage:
//   node tools_node/register-ucuf-runtime-route.js \
//     --panel-key general-detail \
//     --screen-id general-detail-unified-screen \
//     --component GeneralDetailComposite \
//     --variant ds3=character-ds3-main \
//     --variant unified=general-detail-unified-screen \
//     --feature-flag ds3

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCREENS_DIR = path.join(ROOT, 'assets/resources/ui-spec/screens');

function parseArgs(argv) {
  const opts = {
    panelKey: null,
    screenId: null,
    component: null,
    mountTarget: '<auto>',
    featureFlag: null,
    fallbackScreen: null,
    variants: {},
    out: null,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--panel-key': opts.panelKey = next(); break;
      case '--screen-id': opts.screenId = next(); break;
      case '--component': opts.component = next(); break;
      case '--mount-target': opts.mountTarget = next(); break;
      case '--feature-flag': opts.featureFlag = next(); break;
      case '--fallback-screen': opts.fallbackScreen = next(); break;
      case '--variant': {
        const kv = next();
        const eq = kv.indexOf('=');
        if (eq < 0) { console.error(`[register-ucuf-runtime-route] --variant expects key=screenId, got: ${kv}`); process.exit(2); }
        opts.variants[kv.slice(0, eq)] = kv.slice(eq + 1);
        break;
      }
      case '--out': opts.out = next(); break;
      case '--dry-run': opts.dryRun = true; break;
      case '--help':
      case '-h':
        console.log('Usage: register-ucuf-runtime-route.js --panel-key <key> --screen-id <id> --component <Class> [--variant k=screenId ...] [--feature-flag <flag>] [--out <path>] [--dry-run]');
        process.exit(0);
        break;
      default:
        console.error(`[register-ucuf-runtime-route] unknown arg: ${a}`); process.exit(2);
    }
  }
  if (!opts.panelKey || !opts.screenId || !opts.component) {
    console.error('[register-ucuf-runtime-route] --panel-key, --screen-id, --component are required');
    process.exit(2);
  }
  return opts;
}

function buildSidecar(opts) {
  return {
    screenId: opts.screenId,
    panelKey: opts.panelKey,
    mountTarget: opts.mountTarget,
    componentClass: opts.component,
    featureFlag: opts.featureFlag || null,
    fallbackScreen: opts.fallbackScreen || opts.screenId,
    variants: Object.keys(opts.variants).length ? opts.variants : { default: opts.screenId },
    paramSchema: null,
    generatedAt: new Date().toISOString(),
  };
}

function validate(sidecar) {
  const errors = [];
  if (!sidecar.screenId) errors.push('missing screenId');
  if (!sidecar.panelKey) errors.push('missing panelKey');
  if (!sidecar.componentClass) errors.push('missing componentClass');
  if (!sidecar.variants || typeof sidecar.variants !== 'object') errors.push('variants must be object');
  return errors;
}

function main() {
  const opts = parseArgs(process.argv);
  const sidecar = buildSidecar(opts);
  const errs = validate(sidecar);
  if (errs.length) { console.error('[register-ucuf-runtime-route] validation:', errs); process.exit(2); }

  const outPath = opts.out || path.join(SCREENS_DIR, `${opts.screenId}.runtime-route.json`);
  if (opts.dryRun) {
    console.log(JSON.stringify(sidecar, null, 2));
    console.log(`[register-ucuf-runtime-route] (dry-run) would write ${path.relative(ROOT, outPath)}`);
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(sidecar, null, 2) + '\n', 'utf8');
  console.log(`[register-ucuf-runtime-route] wrote ${path.relative(ROOT, outPath)}`);
}

if (require.main === module) main();
module.exports = { buildSidecar, validate };
