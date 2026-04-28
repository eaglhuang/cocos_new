'use strict';

const fs = require('fs');
const cssText = fs.readFileSync('Design System 3/colors_and_type.css', 'utf8');
const tokens = JSON.parse(fs.readFileSync('assets/resources/ui-spec/ui-design-tokens.json', 'utf8'));

// Extract :root CSS vars
const rootMatch = cssText.match(/:root\s*\{([\s\S]*?)\}/);
if (!rootMatch) { console.error('no :root'); process.exit(1); }
const lines = rootMatch[1].split('\n');
const cssVars = [];
for (const line of lines) {
  const m = line.match(/^\s*--([a-z0-9-]+)\s*:\s*([^;]+?)\s*;/);
  if (m) cssVars.push({ kebab: m[1], value: m[2].trim() });
}
console.log('total CSS vars:', cssVars.length);

const kebabToCamel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

const colorKeys = new Set(Object.keys(tokens.colors || {}));
const spacingKeys = new Set(Object.keys(tokens.spacing || {}));
const typoKeys = new Set();
function collectKeys(obj, set, prefix='') {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) set.add(k);
}
collectKeys(tokens.typography, typoKeys);

const missingColors = [];
const missingOther = [];
const present = [];
for (const v of cssVars) {
  const camel = kebabToCamel(v.kebab);
  const isColor = /^(#|rgb|hsl)/i.test(v.value);
  const isPx = /\dpx$/.test(v.value) || /^\d+$/.test(v.value);
  const isVar = v.value.startsWith('var(');
  if (isVar) continue; // alias, skip
  if (isColor) {
    if (colorKeys.has(camel)) present.push({camel, kind:'color'});
    else missingColors.push({ kebab: v.kebab, camel, value: v.value });
  } else {
    missingOther.push({ kebab: v.kebab, camel, value: v.value });
  }
}
console.log('\nMissing color tokens (would be added):', missingColors.length);
for (const m of missingColors) console.log('  ', m.camel.padEnd(28), m.value);
console.log('\nNon-color vars (typography/spacing/etc):', missingOther.length);
for (const m of missingOther.slice(0, 30)) console.log('  ', m.kebab.padEnd(28), m.value);
