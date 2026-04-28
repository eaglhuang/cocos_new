'use strict';
const fs = require('fs');

const layoutPath = 'assets/resources/ui-spec/layouts/character-ds3-main.json';
const skinPath = 'assets/resources/ui-spec/skins/character-ds3-default.json';

const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
const skin = JSON.parse(fs.readFileSync(skinPath, 'utf8'));

function findAndRevert(n) {
  if (!n) return false;
  if (n.name === 'CharacterDs3Main_div_7') {
    n.type = 'container';
    delete n.skinSlot;
    return true;
  }
  for (const c of (n.children || [])) {
    if (findAndRevert(c)) return true;
  }
  return false;
}
findAndRevert(layout.root);
delete skin.slots['auto.character-ds3-main.characterds3main_div_7'];

fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2) + '\n', 'utf8');
fs.writeFileSync(skinPath, JSON.stringify(skin, null, 2) + '\n', 'utf8');
console.log('reverted div_7');
