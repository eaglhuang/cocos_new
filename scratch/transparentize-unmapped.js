'use strict';
const fs = require('fs');
const path = require('path');

const skinPath = 'assets/resources/ui-spec/skins/character-ds3-default.json';
const layoutPath = 'assets/resources/ui-spec/layouts/character-ds3-main.json';

const skin = JSON.parse(fs.readFileSync(skinPath, 'utf8'));
const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));

// Collect all skinSlot ids referenced by layout and which node names they came from
const skinToName = new Map();
function walk(n) {
  if (!n) return;
  if (n.skinSlot) skinToName.set(n.skinSlot, n.name || '');
  for (const c of (n.children || [])) walk(c);
}
walk(layout.root);

const slots = skin.slots || {};
let convertedCount = 0;
let preservedCount = 0;
const sample = [];
for (const [slotId, def] of Object.entries(slots)) {
  if (def && def.kind === 'color-rect' && def.color === 'unmappedColor') {
    // Convert to transparent kind (no visible rect) — these slots had no parsable background in source.
    slots[slotId] = { kind: 'transparent' };
    convertedCount++;
    if (sample.length < 5) sample.push({ slotId, node: skinToName.get(slotId) });
  }
}

skin.slots = slots;
fs.writeFileSync(skinPath, JSON.stringify(skin, null, 2) + '\n', 'utf8');

console.log('converted unmappedColor -> transparent:', convertedCount);
console.log('sample:', JSON.stringify(sample, null, 2));
