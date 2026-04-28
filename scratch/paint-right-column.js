'use strict';
const fs = require('fs');

const layoutPath = 'assets/resources/ui-spec/layouts/character-ds3-main.json';
const skinPath = 'assets/resources/ui-spec/skins/character-ds3-default.json';

const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
const skin = JSON.parse(fs.readFileSync(skinPath, 'utf8'));

// Find div_7 and convert to panel + add skinSlot.
function findAndPatch(n) {
  if (!n) return false;
  if (n.name === 'CharacterDs3Main_div_7') {
    n.type = 'panel';
    n.skinSlot = 'auto.character-ds3-main.characterds3main_div_7';
    return true;
  }
  for (const c of (n.children || [])) {
    if (findAndPatch(c)) return true;
  }
  return false;
}
const found = findAndPatch(layout.root);
console.log('div_7 patched:', found);

// Add skin slot for the right column bg.
skin.slots['auto.character-ds3-main.characterds3main_div_7'] = {
  kind: 'color-rect',
  color: 'parchmentBase',
  opacity: 1,
};

fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2) + '\n', 'utf8');
fs.writeFileSync(skinPath, JSON.stringify(skin, null, 2) + '\n', 'utf8');
console.log('layout + skin updated');
