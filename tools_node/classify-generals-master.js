#!/usr/bin/env node
/**
 * classify-generals-master.js
 * 依 rarity-thresholds.json 對 master/generals-base.json 補齊 rarityTier / characterCategory / epRating。
 * 用法：node tools_node/classify-generals-master.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-base.json');
const THRESHOLDS_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'rarity-thresholds.json');

const TIER_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function rank(tier) {
  return Math.max(0, TIER_ORDER.indexOf(tier));
}

function toTier(value, axisCfg) {
  if (value >= axisCfg.legendary) return 'legendary';
  if (value >= axisCfg.epic) return 'epic';
  if (value >= axisCfg.rare) return 'rare';
  return 'common';
}

function computeTier(g, cfg) {
  if (g.rarityTier) return g.rarityTier;

  const stats = [g.str ?? 0, g.int ?? 0, g.lea ?? 0, g.pol ?? 0, g.cha ?? 0];
  const maxStat = Math.max(...stats);
  const avg5 = stats.reduce((sum, value) => sum + value, 0) / stats.length;

  let tier;
  if (maxStat === 0) {
    const ep = g.ep ?? 0;
    tier = ep >= 90 ? 'legendary'
      : ep >= 75 ? 'epic'
      : ep >= 60 ? 'rare'
      : 'common';
  } else {
    const tierA = toTier(maxStat, cfg.axes.maxStat);
    const tierB = toTier(avg5, cfg.axes.avg5);
    tier = rank(tierA) >= rank(tierB) ? tierA : tierB;
  }

  const override = cfg.categoryOverrides?.[g.characterCategory];
  if (override && rank(override) > rank(tier)) {
    tier = override;
  }
  return tier;
}

function computeCategory(g, tier) {
  if (g.characterCategory) return g.characterCategory;
  const maxStat = Math.max(g.str ?? 0, g.int ?? 0, g.lea ?? 0, g.pol ?? 0, g.cha ?? 0);
  if (maxStat < 50) return 'civilian';
  if (maxStat < 80) return 'general';
  if (rank(tier) >= rank('epic')) return 'famed';
  return 'general';
}

function computeEpRating(g) {
  if (g.epRating) return g.epRating;
  const stats = [g.str ?? 0, g.int ?? 0, g.lea ?? 0, g.pol ?? 0, g.cha ?? 0];
  const maxStat = Math.max(...stats);
  const avg5 = stats.reduce((sum, value) => sum + value, 0) / stats.length;
  const epBase = Math.round(avg5 * 0.8 + maxStat * 0.2);
  if (epBase >= 90) return 'S+';
  if (epBase >= 85) return 'S';
  if (epBase >= 80) return 'S-';
  if (epBase >= 75) return 'A+';
  if (epBase >= 70) return 'A';
  if (epBase >= 65) return 'A-';
  if (epBase >= 60) return 'B+';
  if (epBase >= 55) return 'B';
  return 'C';
}

const baseObj = loadJson(BASE_PATH);
const cfg = loadJson(THRESHOLDS_PATH);
const generals = Array.isArray(baseObj.data) ? baseObj.data : [];

let tierPatched = 0;
let categoryPatched = 0;
let epRatingPatched = 0;

for (const g of generals) {
  const tier = computeTier(g, cfg);
  const category = computeCategory(g, tier);
  const epRating = computeEpRating(g);

  if (!g.rarityTier) {
    g.rarityTier = tier;
    tierPatched++;
  }
  if (!g.characterCategory) {
    g.characterCategory = category;
    categoryPatched++;
  }
  if (!g.epRating) {
    g.epRating = epRating;
    epRatingPatched++;
  }
}

baseObj.updatedAt = new Date().toISOString();
fs.writeFileSync(BASE_PATH, JSON.stringify(baseObj, null, 2), 'utf-8');

console.log(`[classify-generals-master] rarityTier 補齊 ${tierPatched} 筆`);
console.log(`[classify-generals-master] characterCategory 補齊 ${categoryPatched} 筆`);
console.log(`[classify-generals-master] epRating 補齊 ${epRatingPatched} 筆`);
console.log(`[classify-generals-master] 完成，總筆數 ${generals.length}`);