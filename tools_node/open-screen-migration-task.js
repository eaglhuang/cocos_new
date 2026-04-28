#!/usr/bin/env node
// doc_id: doc_other_0009 — Screen Migration Task Card (M37)
//
// Purpose:
//   Thin wrapper around task-card-opener.js that pre-fills the
//   "screen-migration" task type so each Phase B (M30-M36) cutover gets
//   a consistent task card with:
//     - source HTML path
//     - target screenId
//     - ChildPanel list (auto-detected from <screen>.tab-routing.json)
//     - phase markers (A: fidelity, B: wire-to-runtime)
//     - acceptance criteria gate (runtime-diff ≥ 95% AND logic-guard pass
//       AND coverage tracker shows cutover-prod)
//
// Usage:
//   node tools_node/open-screen-migration-task.js \
//     --task-id UI-2-9001 \
//     --screen character-ds3-main \
//     --html "Design System 2/ui_kits/character/index.html" \
//     --from-variant unified \
//     --to-variant ds3 \
//     --md-out docs/agent-briefs/tasks/UI-2-9001.md \
//     --shard-out docs/ui-quality-tasks/UI-2-9001.json \
//     --write

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    taskId: null,
    screen: null,
    html: null,
    fromVariant: null,
    toVariant: null,
    mdOut: null,
    shardOut: null,
    write: false,
    owner: 'Copilot',
    priority: 'P1',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--task-id': opts.taskId = next(); break;
      case '--screen': opts.screen = next(); break;
      case '--html': opts.html = next(); break;
      case '--from-variant': opts.fromVariant = next(); break;
      case '--to-variant': opts.toVariant = next(); break;
      case '--md-out': opts.mdOut = next(); break;
      case '--shard-out': opts.shardOut = next(); break;
      case '--owner': opts.owner = next(); break;
      case '--priority': opts.priority = next(); break;
      case '--write': opts.write = true; break;
      case '--help': case '-h':
        console.log('Usage: open-screen-migration-task.js --task-id <id> --screen <id> --html <file> --from-variant <a> --to-variant <b> [--md-out <md>] [--shard-out <json>] [--write]');
        process.exit(0);
        break;
      default:
        console.error(`unknown flag: ${a}`);
        process.exit(1);
    }
  }
  return opts;
}

function detectChildPanels(screen) {
  const sidecarPath = path.join(ROOT, 'assets', 'resources', 'ui-spec', 'screens', `${screen}.tab-routing.json`);
  if (!fs.existsSync(sidecarPath)) return [];
  try {
    const json = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
    return Array.isArray(json.tabs) ? json.tabs : [];
  } catch { return []; }
}

function detectRuntimeRoute(screen) {
  // Check for any *.runtime-route.json that lists this screen as a variant
  const dir = path.join(ROOT, 'assets', 'resources', 'ui-spec', 'screens');
  if (!fs.existsSync(dir)) return null;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.runtime-route.json')) continue;
    try {
      const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const variants = json.variants || {};
      if (Object.values(variants).includes(screen) || json.screenId === screen) {
        return { file, panelKey: json.panelKey, route: json };
      }
    } catch { /* ignore */ }
  }
  return null;
}

function main() {
  const opts = parseArgs(process.argv);
  const required = ['taskId', 'screen', 'html', 'fromVariant', 'toVariant'];
  for (const k of required) {
    if (!opts[k]) {
      console.error(`[open-screen-migration-task] --${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())} is required`);
      process.exit(1);
    }
  }

  const tabs = detectChildPanels(opts.screen);
  const route = detectRuntimeRoute(opts.screen);
  const panelKey = route ? route.panelKey : '<unknown>';
  const childPanelList = tabs.length > 0
    ? tabs.map(t => `${t.childPanelClass}@${t.id}`).join(', ')
    : '(none — single-panel screen)';

  const description = `Phase B screen migration: switch panelKey="${panelKey}" from variant "${opts.fromVariant}" → "${opts.toVariant}" (target screenId=${opts.screen}).`;

  const acceptanceLines = [
    `runtime-diff ≥ 0.95 (sourceVsUcuf or runtimeVsSource) — see <screen>.runtime-verdict.json`,
    `logic-guard verdict ≠ fail — see <screen>.logic-guard.json`,
    `validate-ui-specs.js passes (no failures, warnings allowed)`,
    `coverage tracker shows status=cutover-prod for ${opts.screen} after cutover`,
    `cutover-screen-variant.js --verdict <pass>.json applied + .bak removed only after one stable release`,
  ];

  const notesLines = [
    `Phase: B (Wire-to-Runtime)`,
    `Source HTML: ${opts.html}`,
    `Target screenId: ${opts.screen}`,
    `Variant: ${opts.fromVariant} → ${opts.toVariant}`,
    `panelKey: ${panelKey}`,
    `ChildPanels: ${childPanelList}`,
    `runtime-route sidecar: ${route ? route.file : '(missing — run register-ucuf-runtime-route.js first)'}`,
    `Tools: scan-ucuf-screen-coverage.js → register-ucuf-runtime-route.js → annotate-html-bindings.js → generate-tab-childpanels.js → runtime-screen-diff.js → plan-screen-migration.js → cutover-screen-variant.js`,
  ];

  const args = [
    'tools_node/task-card-opener.js',
    '--id', opts.taskId,
    '--title', `Screen Migration: ${opts.screen} (${opts.fromVariant} → ${opts.toVariant})`,
    '--owner', opts.owner,
    '--priority', opts.priority,
    '--type', 'screen-migration',
    '--phase', 'B',
    '--description', description,
    '--acceptance', acceptanceLines.join(' / '),
    '--notes', notesLines.join('\n'),
  ];
  if (opts.mdOut) args.push('--md-out', opts.mdOut);
  if (opts.shardOut) args.push('--json-out', opts.shardOut, '--json-kind', 'ui-quality-task-shard');
  if (opts.write) args.push('--write');

  console.log('[open-screen-migration-task] delegating to task-card-opener.js with screen-migration type');
  console.log(`  taskId:       ${opts.taskId}`);
  console.log(`  screen:       ${opts.screen}`);
  console.log(`  variants:     ${opts.fromVariant} → ${opts.toVariant}`);
  console.log(`  panelKey:     ${panelKey}`);
  console.log(`  childPanels:  ${tabs.length}`);
  console.log(`  acceptance:   ${acceptanceLines.length} criteria`);
  console.log('');

  try {
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
  } catch (err) {
    console.error('[open-screen-migration-task] task-card-opener.js failed');
    process.exit(err.status || 1);
  }
}

main();
