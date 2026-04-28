'use strict';
const fs = require('fs');

const skinPath = 'assets/resources/ui-spec/skins/character-ds3-default.json';
const layoutPath = 'assets/resources/ui-spec/layouts/character-ds3-main.json';

const skin = JSON.parse(fs.readFileSync(skinPath, 'utf8'));
const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));

// Find div_7 subtree (right column)
let rightColumnSubtree = null;
function findNode(n, name) {
  if (!n) return null;
  if (n.name === name) return n;
  for (const c of (n.children || [])) {
    const r = findNode(c, name);
    if (r) return r;
  }
  return null;
}
rightColumnSubtree = findNode(layout.root, 'CharacterDs3Main_div_7');

// Collect skin slot ids inside the right column subtree
const rightSlots = new Set();
function collectSlots(n) {
  if (!n) return;
  if (n.skinSlot) rightSlots.add(n.skinSlot);
  for (const c of (n.children || [])) collectSlots(c);
}
collectSlots(rightColumnSubtree);

const slots = skin.slots || {};
let parchmentized = 0;
let restoredOther = 0;
for (const [slotId, def] of Object.entries(slots)) {
  if (!def || def.kind !== 'transparent') continue;
  if (rightSlots.has(slotId)) {
    // right column panel: parchment background
    slots[slotId] = { kind: 'color-rect', color: 'parchmentBase', opacity: 1 };
    parchmentized++;
  } else {
    // restore to previous unmappedColor (slightly better than fully transparent vs HTML which has no bg either)
    slots[slotId] = { kind: 'color-rect', color: 'unmappedColor', opacity: 1 };
    restoredOther++;
  }
}

skin.slots = slots;
fs.writeFileSync(skinPath, JSON.stringify(skin, null, 2) + '\n', 'utf8');

console.log('parchmentized (right column):', parchmentized);
console.log('restored to unmappedColor (other):', restoredOther);
console.log('right column slots discovered:', rightSlots.size);
