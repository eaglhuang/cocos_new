#!/usr/bin/env node
// doc_id: doc_other_0011 — html_skill_plan2 M11
// Sync CSS :root vars from a source design package's colors_and_type.css
// into the project's ui-design-tokens.json. Adds missing color/spacing/typography
// entries; never overwrites existing values; never touches keys not introduced
// by this run.
//
// Usage:
//   node tools_node/sync-css-vars-to-tokens.js \
//     --css "Design System 3/colors_and_type.css" \
//     --tokens assets/resources/ui-spec/ui-design-tokens.json \
//     --mode dry-run|append
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const opts = { css: null, tokens: 'assets/resources/ui-spec/ui-design-tokens.json', mode: 'dry-run' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--css') opts.css = next();
    else if (a === '--tokens') opts.tokens = next();
    else if (a === '--mode') opts.mode = next();
  }
  if (!opts.css) { console.error('Missing --css <path>'); process.exit(2); }
  return opts;
}

function kebabToCamel(s) { return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()); }

function extractRootVars(cssText) {
  const m = cssText.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!m) return [];
  const out = [];
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^\s*--([a-z0-9-]+)\s*:\s*([^;]+?)\s*;/);
    if (mm) out.push({ kebab: mm[1], camel: kebabToCamel(mm[1]), value: mm[2].trim() });
  }
  return out;
}

function classify(v) {
  const val = v.value;
  if (val.startsWith('var(')) return { kind: 'alias', target: val.slice(4, -1).trim() };
  if (/^#([0-9a-f]{3,8})$/i.test(val)) return { kind: 'color' };
  if (/^rgba?\(/i.test(val)) return { kind: 'color' };
  if (/^\d+px$/.test(val)) return { kind: 'px' };
  if (/^\d+ms$/.test(val)) return { kind: 'duration' };
  if (val.startsWith('cubic-bezier(') || ['ease','ease-in','ease-out','ease-in-out','linear'].includes(val)) return { kind: 'easing' };
  if (/serif|sans-serif|monospace|"/.test(val)) return { kind: 'fontStack' };
  if (/^\d+$/.test(val)) return { kind: 'number' };
  if (val.includes('rgba') || val.includes(',')) return { kind: 'composite' };
  return { kind: 'unknown' };
}

function main() {
  const opts = parseArgs(process.argv);
  const cssText = fs.readFileSync(opts.css, 'utf8');
  const tokens = JSON.parse(fs.readFileSync(opts.tokens, 'utf8'));
  tokens.colors = tokens.colors || {};
  tokens.spacing = tokens.spacing || {};
  tokens.typography = tokens.typography || {};
  tokens.motion = tokens.motion || {};
  tokens.radii = tokens.radii || {};

  const vars = extractRootVars(cssText);
  const report = { addedColors: [], addedSpacing: [], addedTypography: [], addedMotion: [], addedRadii: [], skippedAliases: [], skippedExisting: [], skippedComposite: [] };

  for (const v of vars) {
    const c = classify(v);
    if (c.kind === 'alias') { report.skippedAliases.push(v.kebab); continue; }
    if (c.kind === 'color') {
      if (tokens.colors[v.camel] != null) { report.skippedExisting.push(v.camel); continue; }
      tokens.colors[v.camel] = v.value.toUpperCase();
      report.addedColors.push({ key: v.camel, value: v.value });
    } else if (c.kind === 'px' && v.kebab.startsWith('sp-')) {
      const key = v.camel; if (tokens.spacing[key] != null) continue;
      tokens.spacing[key] = parseInt(v.value, 10);
      report.addedSpacing.push({ key, value: v.value });
    } else if (c.kind === 'px' && v.kebab.startsWith('r-')) {
      const key = v.camel; if (tokens.radii[key] != null) continue;
      tokens.radii[key] = v.value;
      report.addedRadii.push({ key, value: v.value });
    } else if (c.kind === 'px' && (v.kebab.startsWith('type-') || v.kebab.startsWith('lh-'))) {
      const key = v.camel; if (tokens.typography[key] != null) continue;
      tokens.typography[key] = v.value;
      report.addedTypography.push({ key, value: v.value });
    } else if (c.kind === 'fontStack' && v.kebab.startsWith('font-')) {
      const key = v.camel; if (tokens.typography[key] != null) continue;
      tokens.typography[key] = v.value;
      report.addedTypography.push({ key, value: v.value });
    } else if (c.kind === 'duration' || c.kind === 'easing') {
      const key = v.camel; if (tokens.motion[key] != null) continue;
      tokens.motion[key] = v.value;
      report.addedMotion.push({ key, value: v.value });
    } else {
      report.skippedComposite.push({ key: v.camel, value: v.value, kind: c.kind });
    }
  }

  console.log('=== sync-css-vars-to-tokens report ===');
  console.log('Added colors:', report.addedColors.length);
  for (const r of report.addedColors) console.log(`  +color  ${r.key.padEnd(28)} ${r.value}`);
  console.log('Added spacing:', report.addedSpacing.length);
  for (const r of report.addedSpacing) console.log(`  +space  ${r.key.padEnd(28)} ${r.value}`);
  console.log('Added typography:', report.addedTypography.length);
  for (const r of report.addedTypography) console.log(`  +type   ${r.key.padEnd(28)} ${r.value}`);
  console.log('Added motion:', report.addedMotion.length);
  for (const r of report.addedMotion) console.log(`  +motion ${r.key.padEnd(28)} ${r.value}`);
  console.log('Added radii:', report.addedRadii.length);
  console.log('Skipped (aliases/existing/composite):', report.skippedAliases.length, report.skippedExisting.length, report.skippedComposite.length);

  if (opts.mode === 'append') {
    fs.writeFileSync(opts.tokens, JSON.stringify(tokens, null, 2) + '\n', 'utf8');
    console.log('\nMode=append: wrote', opts.tokens);
  } else {
    console.log('\nMode=dry-run: no file written. Use --mode append to apply.');
  }
}

main();
