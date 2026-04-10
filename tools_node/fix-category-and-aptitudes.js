'use strict';
/**
 * fix-category-and-aptitudes.js
 *
 * Pass 1 – characterCategory: promote/demote based on tier + maxStat algorithm,
 *           but NEVER downgrade female characters who are already 'famed'.
 * Pass 2 – aptitudes: auto-generate troop/terrain/weather aptitude grades that
 *           fit the expected A/S count range for each rarityTier.
 *           Existing data in generals.json is kept when within range; excess
 *           A/S grades are trimmed; missing aptitudes are generated.
 */

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const RUNTIME_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'generals.json');
const MASTER_PATH  = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-base.json');

// ─── Tier ordering ───────────────────────────────────────────────────────────
const TIER_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];
function tierRank(t) { return TIER_ORDER.indexOf(t); }

// ─── Category algorithm (mirrors audit script) ───────────────────────────────
function computeSuggestedCategory(record, tier) {
  if (['mythical', 'titled'].includes(record.characterCategory)) return record.characterCategory;
  const maxStat = Math.max(record.str ?? 0, record.int ?? 0, record.lea ?? 0, record.pol ?? 0, record.cha ?? 0);
  if (maxStat < 50) return 'civilian';
  if (maxStat < 80) return 'general';
  if (tierRank(tier) >= tierRank('epic')) return 'famed';
  return 'general';
}

// ─── Aptitude helpers ────────────────────────────────────────────────────────
const GRADES = ['S', 'A', 'B', 'C', 'D'];

function countAorS(block) {
  if (!block || typeof block !== 'object') return 0;
  return Object.values(block).filter(v => v === 'A' || v === 'S').length;
}

/** How many total A/S grades the general should have (mid of expected range). */
function targetAS(tier) {
  switch (tier) {
    case 'common':    return 0;
    case 'rare':      return 1;
    case 'epic':      return 2;
    case 'legendary': return 3;
    case 'mythic':    return 5;
    default:          return 1;
  }
}

function maxAS(tier) {
  switch (tier) {
    case 'common':    return 1;
    case 'rare':      return 2;
    case 'epic':      return 3;
    case 'legendary': return 4;
    case 'mythic':    return 99;
    default:          return 99;
  }
}

// ─── Affinity scoring ────────────────────────────────────────────────────────

function troopScores(r) {
  const wu  = r.faction === 'wu'  ? 15 : 0;
  const wei = r.faction === 'wei' ? 8  : 0;
  return {
    CAVALRY:  r.str * 0.60 + r.lea * 0.30 + wei * 0.5,
    INFANTRY: r.str * 0.80 + r.lea * 0.20,
    ARCHER:   r.int * 0.30 + r.lea * 0.50 + r.str * 0.10,
    SIEGE:    r.int * 0.50 + r.lea * 0.30 + r.pol * 0.20,
    ENGINEER: r.int * 0.60 + r.pol * 0.40,
    NAVY:     r.int * 0.25 + r.lea * 0.30 + wu * 2.5,
  };
}

function terrainScores(r) {
  const wu  = r.faction === 'wu'  ? 20 : 0;
  const shu = r.faction === 'shu' ? 12 : 0;
  const wei = r.faction === 'wei' ? 10 : 0;
  return {
    PLAIN:    r.str * 0.45 + r.lea * 0.45 + wei,
    MOUNTAIN: r.lea * 0.55 + r.str * 0.25 + shu,
    WATER:    r.lea * 0.30 + wu * 1.5,
    FOREST:   r.lea * 0.50 + r.int * 0.15 + shu * 0.8,
    DESERT:   r.str * 0.45 + r.lea * 0.30,
    RIVER:    r.lea * 0.35 + wu,
  };
}

function weatherScores(r) {
  const wu = r.faction === 'wu' ? 12 : 0;
  return {
    SUNNY:   r.str * 0.65 + r.lea * 0.25,
    RAINY:   wu + r.int * 0.35,
    FOG:     r.int * 0.60 + r.lea * 0.20,
    WINDY:   r.str * 0.35 + r.lea * 0.40 + r.int * 0.10,
    NIGHT:   r.int * 0.50 + r.lea * 0.30,
    THUNDER: r.str * 0.65 + r.lea * 0.20,
  };
}

/**
 * Build a full grade map for one category given score map and allowed A/S budget.
 * Returns {KEY: 'S'|'A'|'B'|'C'|'D'}.
 */
function buildGradeMap(scores, asAllowed, topIsS) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const result = {};
  for (let i = 0; i < sorted.length; i++) {
    const [key] = sorted[i];
    let grade;
    if (i === 0 && topIsS && asAllowed > 0) {
      grade = 'S';
    } else if (i < asAllowed) {
      grade = 'A';
    } else if (i < asAllowed + 2) {
      grade = 'B';
    } else if (i < asAllowed + 4) {
      grade = 'C';
    } else {
      grade = 'D';
    }
    result[key] = grade;
  }
  return result;
}

/**
 * Generate a full aptitude suite for a general.
 * Distributes `target` A/S grades across troop / terrain / weather roughly evenly.
 */
function generateAptitudes(record, tier) {
  const target  = targetAS(tier);
  if (target === 0) {
    // common tier – fill all B/C/D, no A/S
    const mkAll = scores => Object.fromEntries(Object.keys(scores).map((k, i) => [k, ['B','B','C','C','D','D'][i]]));
    return {
      troopAptitude:   mkAll(troopScores(record)),
      terrainAptitude: mkAll(terrainScores(record)),
      weatherAptitude: mkAll(weatherScores(record)),
    };
  }

  // Distribute AS budget: troop gets ceiling, rest split between terrain + weather
  const troopAS   = Math.ceil(target / 3);
  const terrainAS = Math.floor((target - troopAS) / 2 + ((target - troopAS) % 2));
  const weatherAS = target - troopAS - terrainAS;

  const isLegendaryPlus = tierRank(tier) >= tierRank('legendary');

  return {
    troopAptitude:   buildGradeMap(troopScores(record),   troopAS,   isLegendaryPlus && troopAS > 0),
    terrainAptitude: buildGradeMap(terrainScores(record), terrainAS, false),
    weatherAptitude: buildGradeMap(weatherScores(record), weatherAS, false),
  };
}

/**
 * Trim an existing aptitude block so its A/S count doesn't exceed `limit`.
 * Downgrades excess A/S grades to B starting from the end of the sorted list.
 */
function trimAptitude(block, limit) {
  if (!block || typeof block !== 'object') return block;
  const entries = Object.entries(block);
  // Separate A/S from the rest
  const asList  = entries.filter(([, v]) => v === 'A' || v === 'S').sort();
  const bList   = entries.filter(([, v]) => v !== 'A' && v !== 'S');
  const excess  = asList.length - limit;
  if (excess <= 0) return block;
  // Downgrade the last `excess` entries to B (keep highest-value ones)
  const trimmed = [...asList];
  for (let i = trimmed.length - 1; i >= 0 && trimmed.length - limit > 0; i--) {
    // Count how many are still A/S
    const asCount = trimmed.filter(([, v]) => v === 'A' || v === 'S').length;
    if (asCount > limit) {
      trimmed[i] = [trimmed[i][0], 'B'];
    }
  }
  return Object.fromEntries([...trimmed, ...bList]);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function applyFixes(records) {
  let catFixed = 0;
  let aptFixed = 0;

  for (const r of records) {
    const tier = r.rarityTier || 'common';

    // ── Pass 1: characterCategory ──────────────────────────────────────────
    const suggested = computeSuggestedCategory(r, tier);
    const current   = r.characterCategory || 'general';

    // Never downgrade a female 'famed' character
    const isFemale     = r.gender === '女';
    const wouldDegrade = current === 'famed' && suggested !== 'famed';
    if (wouldDegrade && isFemale) {
      // keep as famed
    } else if (current !== suggested && !['mythical', 'titled'].includes(current)) {
      r.characterCategory = suggested;
      catFixed++;
    }

    // ── Pass 2: aptitudes ──────────────────────────────────────────────────
    const max = maxAS(tier);
    const tgt = targetAS(tier);

    const existingTroop   = r.troopAptitude;
    const existingTerrain = r.terrainAptitude;
    const existingWeather = r.weatherAptitude;

    const hasKeys = key => r[key] && Object.keys(r[key]).length > 0;
    const hasExisting = hasKeys('troopAptitude') && hasKeys('terrainAptitude') && hasKeys('weatherAptitude');
    const currentAS   = countAorS(existingTroop) + countAorS(existingTerrain) + countAorS(existingWeather);

    if (hasExisting) {
      if (currentAS > max) {
        // Trim: proportionally reduce each category
        const ratio = max / currentAS;
        const tA = Math.max(0, Math.round(countAorS(existingTroop)   * ratio));
        const teA= Math.max(0, Math.round(countAorS(existingTerrain) * ratio));
        const wA = Math.max(0, max - tA - teA);
        r.troopAptitude   = trimAptitude(existingTroop,   tA);
        r.terrainAptitude = trimAptitude(existingTerrain, teA);
        r.weatherAptitude = trimAptitude(existingWeather, wA);
        aptFixed++;
      } else if (currentAS < targetAS(tier)) {
        // Too few A/S grades → regenerate fresh aptitudes
        const generated = generateAptitudes(r, tier);
        r.troopAptitude   = generated.troopAptitude;
        r.terrainAptitude = generated.terrainAptitude;
        r.weatherAptitude = generated.weatherAptitude;
        aptFixed++;
      }
      // within range → leave untouched
    } else if (tgt > 0 || tier !== 'common') {
      // Generate fresh aptitudes
      const generated = generateAptitudes(r, tier);
      r.troopAptitude   = generated.troopAptitude;
      r.terrainAptitude = generated.terrainAptitude;
      r.weatherAptitude = generated.weatherAptitude;
      if (tgt > 0) aptFixed++;
    }
  }

  return { catFixed, aptFixed };
}

// ─── Load, patch, save ───────────────────────────────────────────────────────

// 1. Runtime generals.json
const runtimeData = JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8'));
const rtResult = applyFixes(runtimeData);
fs.writeFileSync(RUNTIME_PATH, JSON.stringify(runtimeData, null, 2), 'utf8');
console.log(`[runtime] category fixed: ${rtResult.catFixed}, aptitude fixed/generated: ${rtResult.aptFixed}`);

// 2. Master generals-base.json  (data is inside .data array)
const masterRaw  = JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8'));
const masterRecs = masterRaw.data || masterRaw;

// Build a lookup from runtime for aptitude data (master is lighter, no aptitudes)
const runtimeMap = new Map(runtimeData.map(r => [r.id, r]));

// For master: apply category fix AND copy aptitudes from runtime
let masterCatFixed = 0;
let masterAptSynced = 0;
for (const mr of masterRecs) {
  const tier = mr.rarityTier || 'common';
  const suggested = computeSuggestedCategory(mr, tier);
  const current   = mr.characterCategory || 'general';
  const isFemale  = mr.gender === '女';
  const wouldDegrade = current === 'famed' && suggested !== 'famed';

  if (wouldDegrade && isFemale) {
    // keep
  } else if (current !== suggested && !['mythical', 'titled'].includes(current)) {
    mr.characterCategory = suggested;
    masterCatFixed++;
  }

  // Sync aptitudes from runtime
  const rt = runtimeMap.get(mr.id);
  if (rt) {
    if (rt.troopAptitude || rt.terrainAptitude || rt.weatherAptitude) {
      mr.troopAptitude   = rt.troopAptitude   ?? mr.troopAptitude;
      mr.terrainAptitude = rt.terrainAptitude ?? mr.terrainAptitude;
      mr.weatherAptitude = rt.weatherAptitude ?? mr.weatherAptitude;
      masterAptSynced++;
    }
  }
}

if (masterRaw.data) {
  masterRaw.data = masterRecs;
} 
fs.writeFileSync(MASTER_PATH, JSON.stringify(masterRaw, null, 2), 'utf8');
console.log(`[master]  category fixed: ${masterCatFixed}, aptitudes synced: ${masterAptSynced}`);
