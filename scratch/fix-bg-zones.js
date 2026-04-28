'use strict';
const fs = require('fs');
const skinPath = 'assets/resources/ui-spec/skins/character-ds3-default.json';
const skin = JSON.parse(fs.readFileSync(skinPath, 'utf8'));
const slots = skin.slots;

// div_1 = full screen bg → parchment (right side will show through; left covered by div_2)
slots['auto.character-ds3-main.characterds3main_div_1'] = { kind: 'color-rect', color: 'parchmentBase', opacity: 1 };
// div_2 = portrait area 62% width → bgMid (dark olive matching HTML)
slots['auto.character-ds3-main.characterds3main_div_2'] = { kind: 'color-rect', color: 'bgMid', opacity: 1 };

skin.slots = slots;
fs.writeFileSync(skinPath, JSON.stringify(skin, null, 2) + '\n', 'utf8');
console.log('updated div_1 -> parchmentBase, div_2 -> bgMid');
