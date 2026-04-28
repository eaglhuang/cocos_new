#!/usr/bin/env node
// doc_id: doc_other_0009 — existing UI logic inventory / verify CLI (§41)
'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildLogicInventory,
  verifyLogicGuard,
  readJsonIfExists,
  readTextIfExists,
} = require('./lib/dom-to-ui/logic-guard');
const { appendTelemetry } = require('./lib/dom-to-ui/telemetry');

function parseArgs(argv) {
  const opts = {
    mode: 'inventory',
    screenId: null,
    layout: null,
    screen: null,
    component: null,
    baseline: null,
    output: null,
    errorLog: null,
    strict: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--mode': opts.mode = next(); break;
      case '--screen-id': opts.screenId = next(); break;
      case '--layout': opts.layout = next(); break;
      case '--screen': opts.screen = next(); break;
      case '--component': opts.component = next(); break;
      case '--baseline': opts.baseline = next(); break;
      case '--output': opts.output = next(); break;
      case '--error-log': opts.errorLog = next(); break;
      case '--strict': opts.strict = true; break;
      case '--help': case '-h': printHelp(); process.exit(0); break;
      default:
        if (a.startsWith('--')) console.warn(`[dom-to-ui-logic-guard] unknown flag: ${a}`);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
dom-to-ui-logic-guard — inventory / verify existing Cocos UI logic

Required:
  --layout <layout.json>   layout to scan
  --output <json>          output inventory or guard report

Optional:
  --mode inventory|verify  default inventory
  --baseline <json>        baseline inventory for verify mode
  --screen <json>          screen spec
  --component <ts>         CompositePanel / ChildPanel source
  --error-log <log>        runtime log snippet to summarize
  --screen-id <id>         explicit screen id
  --strict                 verify fail exits 9
`);
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.layout || !opts.output) {
    console.error('[dom-to-ui-logic-guard] --layout and --output are required');
    process.exit(2);
  }
  const startedAt = Date.now();
  const layout = readJsonIfExists(path.resolve(opts.layout));
  if (!layout) {
    console.error(`[dom-to-ui-logic-guard] layout not found or unreadable: ${opts.layout}`);
    process.exit(2);
  }
  const screen = readJsonIfExists(opts.screen && path.resolve(opts.screen));
  const componentSource = readTextIfExists(opts.component && path.resolve(opts.component));
  const current = buildLogicInventory({
    screenId: opts.screenId,
    layout,
    screen,
    screenPath: opts.screen || null,
    componentSource,
    componentPath: opts.component || null,
  });

  let report = current;
  if (opts.mode === 'verify') {
    if (!opts.baseline) {
      console.error('[dom-to-ui-logic-guard] --baseline is required in verify mode');
      process.exit(2);
    }
    const baseline = readJsonIfExists(path.resolve(opts.baseline));
    if (!baseline) {
      console.error(`[dom-to-ui-logic-guard] baseline not found or unreadable: ${opts.baseline}`);
      process.exit(2);
    }
    report = verifyLogicGuard(baseline, current, {
      errorLogText: readTextIfExists(opts.errorLog && path.resolve(opts.errorLog)),
    });
  } else if (opts.mode !== 'inventory') {
    console.error(`[dom-to-ui-logic-guard] unsupported --mode ${opts.mode}`);
    process.exit(2);
  }

  const outFull = path.resolve(opts.output);
  fs.mkdirSync(path.dirname(outFull), { recursive: true });
  fs.writeFileSync(outFull, JSON.stringify(report, null, 2) + '\n', 'utf8');

  appendTelemetry({
    tool: 'dom-to-ui-logic-guard',
    mode: opts.mode,
    input: { layoutPath: opts.layout, screenPath: opts.screen, componentPath: opts.component },
    output: { logicGuardPath: opts.output },
    logicGuard: opts.mode === 'verify' ? { verdict: report.verdict, summary: report.summary } : { summary: report.summary },
    durationMs: Date.now() - startedAt,
  });

  if (opts.mode === 'verify') {
    console.log(`[dom-to-ui-logic-guard] ok mode=verify verdict=${report.verdict} output=${opts.output}`);
    if (opts.strict && report.verdict === 'fail') {
      for (const b of report.broken || []) console.error(`  - ${b.featureId}: ${b.reason}`);
      process.exit(9);
    }
  } else {
    console.log(`[dom-to-ui-logic-guard] ok mode=inventory features=${report.summary.featureCount} output=${opts.output}`);
  }
}

if (require.main === module) {
  try { main(); } catch (err) {
    console.error('[dom-to-ui-logic-guard] fatal: ' + err.message);
    if (process.env.DOM_TO_UI_DEBUG === '1') console.error(err.stack);
    process.exit(1);
  }
}

module.exports = { parseArgs };
