#!/usr/bin/env node
// doc_id: doc_other_0009 — Plan Screen Migration (M35)
//
// Purpose:
//   Read tab-routing.json + runtime-route.json + (optional) layout to
//   produce a step-by-step migration plan from variant A to variant B.
//   Each step lists ChildPanels to switch, gates to verify (logic-guard,
//   runtime-diff threshold), and the rollback action.
//
// Usage:
//   node tools_node/plan-screen-migration.js \
//     --screen character-ds3-main \
//     --from unified --to ds3 \
//     [--out artifacts/migration/character-ds3.plan.json]
//
// The plan does NOT execute anything; pass to cutover-screen-variant.js.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCREENS_DIR = path.join(ROOT, 'assets/resources/ui-spec/screens');

function parseArgs(argv) {
  const opts = { screen: null, from: null, to: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--screen': opts.screen = next(); break;
      case '--from': opts.from = next(); break;
      case '--to': opts.to = next(); break;
      case '--out': opts.out = next(); break;
      case '--help': case '-h':
        console.log('Usage: plan-screen-migration.js --screen <id> --from <variant> --to <variant> [--out <json>]');
        process.exit(0);
        break;
      default:
        console.error(`[plan-screen-migration] unknown arg: ${a}`); process.exit(2);
    }
  }
  if (!opts.screen || !opts.from || !opts.to) {
    console.error('[plan-screen-migration] --screen, --from, --to are required');
    process.exit(2);
  }
  return opts;
}

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function buildPlan(opts) {
  // Find tab-routing for the target screen
  const tabRouting = readJsonIfExists(path.join(SCREENS_DIR, `${opts.screen}.tab-routing.json`));
  // Find runtime-route — can be either named after `to` variant target screenId or per-panelKey
  const candidateRoutes = fs.readdirSync(SCREENS_DIR).filter(f => f.endsWith('.runtime-route.json'));
  let runtimeRoute = null;
  for (const f of candidateRoutes) {
    const obj = readJsonIfExists(path.join(SCREENS_DIR, f));
    if (obj && obj.variants && (obj.variants[opts.to] || obj.variants[opts.from])) { runtimeRoute = obj; break; }
  }

  const steps = [];
  steps.push({
    step: 1,
    name: 'Pre-flight gate',
    actions: [
      { tool: 'validate-ui-specs.js', args: [], require: 'pass' },
      { tool: 'dom-to-ui-logic-guard.js', args: ['--screen-id', opts.screen], require: 'pass' },
      { tool: 'runtime-screen-diff.js', args: ['--screen', opts.screen], require: 'sourceVsUcuf >= 0.95' },
    ],
    rollback: '(no-op)',
  });

  if (tabRouting && tabRouting.tabs) {
    tabRouting.tabs.forEach((tab, i) => {
      steps.push({
        step: 2 + i,
        name: `Switch ChildPanel: ${tab.id}`,
        actions: [
          { description: `Wire ${tab.childPanelClass} into CompositePanel._switchToTab table`, tool: 'manual-or-codemod', require: 'compile-pass' },
          { tool: 'runtime-screen-diff.js', args: ['--screen', opts.screen, '--tab', tab.id], require: 'tab visual ≥ 0.93' },
        ],
        rollback: `Revert _switchToTab mapping for tab "${tab.id}"`,
      });
    });
  } else {
    steps.push({
      step: 2,
      name: 'Switch full screen (no tab-routing detected)',
      actions: [
        { description: `Set UIVariantRouter default to ${opts.to}`, tool: 'cutover-screen-variant.js', args: ['--screen', opts.screen, '--from', opts.from, '--to', opts.to, '--dry-run'], require: 'manual review' },
      ],
      rollback: `cutover-screen-variant.js --from ${opts.to} --to ${opts.from}`,
    });
  }

  steps.push({
    step: steps.length + 1,
    name: 'Cutover gate + apply',
    actions: [
      { tool: 'runtime-screen-diff.js', args: ['--screen', opts.screen], require: 'sourceVsUcuf >= 0.95 AND verdict=pass' },
      { tool: 'cutover-screen-variant.js', args: ['--screen', opts.screen, '--from', opts.from, '--to', opts.to], require: 'all prior steps pass' },
    ],
    rollback: `cutover-screen-variant.js --from ${opts.to} --to ${opts.from}`,
  });

  return {
    screen: opts.screen,
    from: opts.from,
    to: opts.to,
    generatedAt: new Date().toISOString(),
    runtimeRouteFound: runtimeRoute ? path.basename(SCREENS_DIR, '.json') : null,
    tabCount: tabRouting?.tabs?.length || 0,
    steps,
    cutoverGate: {
      runtimeDiffMin: 0.95,
      logicGuardRequired: true,
      validateUiSpecsRequired: true,
    },
  };
}

function main() {
  const opts = parseArgs(process.argv);
  const plan = buildPlan(opts);
  const outPath = opts.out ? path.resolve(opts.out) : path.join(ROOT, 'artifacts', 'migration', `${opts.screen}.plan.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(plan, null, 2), 'utf8');
  console.log(`[plan-screen-migration] ${plan.steps.length} step plan → ${path.relative(ROOT, outPath)}`);
  for (const s of plan.steps) console.log(`  step ${s.step}: ${s.name}`);
}

if (require.main === module) main();
module.exports = { buildPlan };
