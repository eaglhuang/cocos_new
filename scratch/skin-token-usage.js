'use strict';

const fs = require('fs');
const skin = JSON.parse(fs.readFileSync('assets/resources/ui-spec/skins/character-ds3-default.json', 'utf8'));
let total = 0;
let unmapped = 0;
const tokenUsage = new Map();
function walk(obj){
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (k === 'color' && typeof v === 'string') {
      total++;
      tokenUsage.set(v, (tokenUsage.get(v) || 0) + 1);
      if (v === 'unmappedColor') unmapped++;
    }
    if (typeof v === 'object') walk(v);
  }
}
walk(skin);
console.log('Total color refs:', total, 'unmappedColor:', unmapped, '(', (unmapped*100/total).toFixed(1), '%)');
console.log('\nTop 15 token usage:');
const sorted = [...tokenUsage.entries()].sort((a,b) => b[1]-a[1]).slice(0, 15);
for (const [t, n] of sorted) console.log('  ', String(n).padStart(4), t);
