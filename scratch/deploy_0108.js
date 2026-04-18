const fs = require('fs');
const path = require('path');

const BRAIN = 'C:/Users/User/.gemini/antigravity/brain/25980505-7c49-47be-98d6-3ee4cee44565';
const OUT_BASE = 'assets/resources/ui/tiger-tally';

// Map: [src brain filename, dest relative path]
const copies = [
  // Card bodies
  ['battle_tally_card_body_1776045145843.png', 'battle_tally_card_body.png'],
  ['gd_tally_summary_card_1776045158627.png', 'gd_tally_summary_card.png'],
  // Rarity frames
  ['tally_rarity_frame_normal_1776045171614.png', 'rarity/tally_rarity_frame_normal.png'],
  ['tally_rarity_frame_rare_1776045225191.png', 'rarity/tally_rarity_frame_rare.png'],
  ['tally_rarity_frame_epic_1776045185988.png', 'rarity/tally_rarity_frame_epic.png'],
  ['tally_rarity_frame_legendary_1776045201182.png', 'rarity/tally_rarity_frame_legendary.png'],
  ['tally_rarity_frame_sacred_1776045238537.png', 'rarity/tally_rarity_frame_sacred.png'],
  // Grain cost plate
  ['tally_grain_cost_plate_1776045250781.png', 'tally_grain_plate.png'],
  // Source crests
  ['tally_source_crest_death_settlement_1776045262467.png', 'source-crest/tally_source_crest_death_settlement.png'],
  ['tally_source_crest_recruitment_1776045273287.png', 'source-crest/tally_source_crest_recruitment.png'],
  ['tally_source_crest_war_conquest_1776045287333.png', 'source-crest/tally_source_crest_war_conquest.png'],
  // State tags
  ['state_tag_ready_1776045316871.png', 'state-tag/state_tag_ready.png'],
  ['state_tag_food_short_1776045331912.png', 'state-tag/state_tag_food_short.png'],
  ['state_tag_cap_full_1776045345040.png', 'state-tag/state_tag_cap_full.png'],
  ['state_tag_set_active_1776045355949.png', 'state-tag/state_tag_set_active.png'],
  ['state_tag_locked_1776045369291.png', 'state-tag/state_tag_locked.png'],
  // Type badges (reuse V2 base troops, scaled — copy to badge folder)
  ['tt_cavalry_v2_1776013765417.png', 'badge/tally_badge_cavalry.png'],
  ['tt_infantry_v2_1776013780298.png', 'badge/tally_badge_infantry.png'],
  ['tt_archer_v2_1776013793773.png', 'badge/tally_badge_archer.png'],
  ['tt_shield_v2_1776013809140.png', 'badge/tally_badge_shield.png'],
  ['tt_pike_v2_1776013823842.png', 'badge/tally_badge_pike.png'],
];

let copied = 0;
for (const [src, dest] of copies) {
  const srcPath = path.join(BRAIN, src);
  const destPath = path.join(OUT_BASE, dest);
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    copied++;
    console.log(`✅ ${dest}`);
  } else {
    console.log(`❌ MISSING: ${src}`);
  }
}
console.log(`\nDone: ${copied}/${copies.length} files copied.`);
