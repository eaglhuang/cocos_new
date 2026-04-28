'use strict';
const fs = require('fs');
const skinPath = 'assets/resources/ui-spec/skins/character-ds3-default.json';
const skin = JSON.parse(fs.readFileSync(skinPath, 'utf8'));
const slots = skin.slots;

// Revert div_1 and div_2 to original state.
slots['auto.character-ds3-main.characterds3main_div_1'] = { kind: 'color-rect', color: 'backgroundDeep', opacity: 1 };
slots['auto.character-ds3-main.characterds3main_div_2'] = { kind: 'color-rect', color: 'unmappedColor', opacity: 1 };

skin.slots = slots;
fs.writeFileSync(skinPath, JSON.stringify(skin, null, 2) + '\n', 'utf8');
console.log('reverted div_1 and div_2 to baseline state');
