#!/usr/bin/env node
/**
 * audit-generals-commercial-balance.js
 * 全量盤點武將資料的平衡 tier、category、一致性與商業化 7 色稀有度分層。
 * 用法：node tools_node/audit-generals-commercial-balance.js [--top 20]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-base.json');
const THRESHOLDS_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'rarity-thresholds.json');

const args = process.argv.slice(2);
const topIndex = args.indexOf('--top');
const TOP_N = topIndex >= 0 && args[topIndex + 1] ? Number(args[topIndex + 1]) : 15;

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function sortCountMap(map, order) {
  return order
    .filter((key) => map[key])
    .map((key) => ({ key, count: map[key] }));
}

function rankOf(order, value) {
  const index = order.indexOf(value);
  return index >= 0 ? index : -1;
}

function toCoreTier(value, axisCfg) {
  if (value >= axisCfg.legendary) return 'legendary';
  if (value >= axisCfg.epic) return 'epic';
  if (value >= axisCfg.rare) return 'rare';
  return 'common';
}

function computeBalance(record, cfg) {
  const stats = [record.str ?? 0, record.int ?? 0, record.lea ?? 0, record.pol ?? 0, record.cha ?? 0];
  const maxStat = Math.max(...stats);
  const avg5 = Number((stats.reduce((sum, value) => sum + value, 0) / stats.length).toFixed(1));

  let tier;
  if (maxStat === 0) {
    const ep = record.ep ?? 0;
    tier = ep >= 90 ? 'legendary'
      : ep >= 75 ? 'epic'
      : ep >= 60 ? 'rare'
      : 'common';
  } else {
    const axisA = toCoreTier(maxStat, cfg.axes.maxStat);
    const axisB = toCoreTier(avg5, cfg.axes.avg5);
    tier = rankOf(cfg.tierOrder, axisA) >= rankOf(cfg.tierOrder, axisB) ? axisA : axisB;
  }

  const override = cfg.categoryOverrides?.[record.characterCategory];
  if (override && rankOf(cfg.tierOrder, override) > rankOf(cfg.tierOrder, tier)) {
    tier = override;
  }

  return { maxStat, avg5, tier };
}

function suggestedCategory(record, tier, cfg) {
  if (record.characterCategory === 'mythical' || record.characterCategory === 'titled') {
    return record.characterCategory;
  }
  const maxStat = Math.max(record.str ?? 0, record.int ?? 0, record.lea ?? 0, record.pol ?? 0, record.cha ?? 0);
  if (maxStat < 50) return 'civilian';
  if (maxStat < 80) return 'general';
  if (rankOf(cfg.tierOrder, tier) >= rankOf(cfg.tierOrder, 'epic')) return 'famed';
  return 'general';
}

function countAOrS(block) {
  if (!block || typeof block !== 'object') return 0;
  return Object.values(block).filter((grade) => grade === 'A' || grade === 'S').length;
}

function expectedAptitudeRange(tier) {
  switch (tier) {
    case 'common': return { min: 0, max: 1 };
    case 'rare': return { min: 1, max: 2 };
    case 'epic': return { min: 2, max: 3 };
    case 'legendary': return { min: 3, max: 4 };
    case 'mythic': return { min: 4, max: 99 };
    default: return { min: 0, max: 99 };
  }
}

function commercialBand(score, cfg) {
  const order = cfg.order;
  const bands = cfg.scoreBands;
  let result = order[0];
  for (const band of order) {
    if (score >= bands[band]) result = band;
  }
  return result;
}

function transformCommercialCha(record, scoreCfg) {
  const rawCha = record.cha ?? 0;
  const transform = scoreCfg.charismaTransform?.[record.gender || ''];
  if (transform === 'sqrt10') {
    return Math.round(Math.sqrt(Math.max(0, rawCha)) * 10);
  }
  return rawCha;
}

function featuredBand(record, scoreCfg) {
  const featured = scoreCfg.featuredBandIds || {};
  let bestBand = null;
  for (const [band, ids] of Object.entries(featured)) {
    if (!Array.isArray(ids)) continue;
    if (ids.includes(record.id)) {
      if (!bestBand || rankOf(scoreCfg.order, band) > rankOf(scoreCfg.order, bestBand)) {
        bestBand = band;
      }
    }
  }
  return bestBand;
}

function clampBandForRules(record, balance, band, scoreCfg, forcedBand) {
  if (forcedBand) {
    return forcedBand;
  }

  const premiumBands = new Set(scoreCfg.premiumBandsRequireFeatured || []);
  let result = band;

  if (!forcedBand && premiumBands.has(result)) {
    result = scoreCfg.premiumBandFallback || 'purple';
  }

  const maxBand = scoreCfg.maxBandByGender?.[record.gender || ''];
  if (maxBand && rankOf(scoreCfg.order, result) > rankOf(scoreCfg.order, maxBand)) {
    result = maxBand;
  }

  const avg5Limits = scoreCfg.bandMinAvg5ByGender?.[record.gender || ''];
  const minAvg5 = avg5Limits?.[result];
  if (typeof minAvg5 === 'number' && balance.avg5 < minAvg5) {
    const lowerBands = scoreCfg.order.filter((item) => rankOf(scoreCfg.order, item) < rankOf(scoreCfg.order, result));
    result = lowerBands.at(-1) || scoreCfg.order[0];
  }

  return result;
}

function computeCommercial(record, effectiveTier, balance, cfg) {
  const scoreCfg = cfg.commercialRarity;
  const category = record.characterCategory || 'general';
  let score = scoreCfg.baseScoreByTier[effectiveTier] ?? 0;
  score += scoreCfg.categoryBonus[category] ?? 0;
  score += scoreCfg.genderScoreBonus?.[record.gender || ''] ?? 0;

  if (balance.maxStat >= 90) score += scoreCfg.thresholdBonus.maxStat90;
  if (balance.maxStat >= 95) score += scoreCfg.thresholdBonus.maxStat95;
  if (balance.avg5 >= 70) score += scoreCfg.thresholdBonus.avg570;
  if (balance.avg5 >= 80) score += scoreCfg.thresholdBonus.avg580;
  const commercialCha = transformCommercialCha(record, scoreCfg);
  if (commercialCha >= 90) score += scoreCfg.thresholdBonus.cha90;
  if (commercialCha >= 95) score += scoreCfg.thresholdBonus.cha95;

  const aptitudeTotal = countAOrS(record.troopAptitude) + countAOrS(record.terrainAptitude) + countAOrS(record.weatherAptitude);
  if (aptitudeTotal >= 2) score += scoreCfg.aptitudeBonus.aOrS2;
  if (aptitudeTotal >= 5) score += scoreCfg.aptitudeBonus.aOrS5;

  const forcedBand = featuredBand(record, scoreCfg);
  const rawBand = commercialBand(score, scoreCfg);
  const band = clampBandForRules(record, balance, rawBand, scoreCfg, forcedBand);

  return {
    score,
    band,
    commercialCha,
    forcedBand,
    aptitudeTotal,
  };
}

function percent(count, total) {
  if (!total) return '0.0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

function printDistribution(title, counts, total, order, labels) {
  console.log(`\n=== ${title} ===`);
  for (const item of sortCountMap(counts, order)) {
    const label = labels?.[item.key] || item.key;
    console.log(`${label.padEnd(16)} ${String(item.count).padStart(3)} / ${total} = ${percent(item.count, total)}`);
  }
}

function main() {
  const baseObj = loadJson(BASE_PATH);
  const cfg = loadJson(THRESHOLDS_PATH);
  const records = Array.isArray(baseObj.data) ? baseObj.data : [];

  const rarityMismatches = [];
  const categoryMismatches = [];
  const aptitudeWarnings = [];
  const genderIssues = [];
  const duplicateNames = [];
  const duplicateMap = new Map();

  const commercialized = records.map((record) => {
    const balance = computeBalance(record, cfg);
    const effectiveTier = rankOf(cfg.tierOrder, record.rarityTier) >= rankOf(cfg.tierOrder, balance.tier)
      ? record.rarityTier
      : balance.tier;
    const suggested = suggestedCategory(record, balance.tier, cfg);
    const commercial = computeCommercial(record, effectiveTier, balance, cfg);
    const troopA = countAOrS(record.troopAptitude);
    const terrainA = countAOrS(record.terrainAptitude);
    const weatherA = countAOrS(record.weatherAptitude);
    const aptitudeTotal = troopA + terrainA + weatherA;
    const expected = expectedAptitudeRange(effectiveTier);

    if (record.rarityTier !== balance.tier) {
      rarityMismatches.push({
        id: record.id,
        name: record.name,
        gender: record.gender || '未知',
        current: record.rarityTier,
        computed: balance.tier,
        maxStat: balance.maxStat,
        avg5: balance.avg5,
        severity: Math.abs(rankOf(cfg.tierOrder, record.rarityTier) - rankOf(cfg.tierOrder, balance.tier)) * 10 + Math.max(0, balance.maxStat - (record.rarityTier === 'legendary' ? 95 : record.rarityTier === 'epic' ? 80 : record.rarityTier === 'rare' ? 65 : 0)),
      });
    }

    if ((record.characterCategory || 'general') !== suggested && !['mythical', 'titled'].includes(record.characterCategory)) {
      categoryMismatches.push({
        id: record.id,
        name: record.name,
        gender: record.gender || '未知',
        current: record.characterCategory,
        suggested,
        currentTier: record.rarityTier,
        computedTier: balance.tier,
        maxStat: balance.maxStat,
      });
    }

    if (aptitudeTotal < expected.min || aptitudeTotal > expected.max) {
      aptitudeWarnings.push({
        id: record.id,
        name: record.name,
        gender: record.gender || '未知',
        tier: effectiveTier,
        total: aptitudeTotal,
        troopA,
        terrainA,
        weatherA,
        expected: `${expected.min}-${expected.max === 99 ? '∞' : expected.max}`,
        severity: aptitudeTotal < expected.min ? expected.min - aptitudeTotal : aptitudeTotal - expected.max,
      });
    }

    if (!record.gender || !['男', '女', '未知'].includes(record.gender)) {
      genderIssues.push({ id: record.id, name: record.name, gender: record.gender || '(missing)' });
    }

    const list = duplicateMap.get(record.name) || [];
    list.push({ id: record.id, gender: record.gender || '未知' });
    duplicateMap.set(record.name, list);

    return {
      ...record,
      _balance: balance,
      _effectiveTier: effectiveTier,
      _suggestedCategory: suggested,
      _commercial: commercial,
    };
  });

  for (const [name, list] of duplicateMap.entries()) {
    if (list.length > 1) duplicateNames.push({ name, list });
  }

  rarityMismatches.sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id));
  categoryMismatches.sort((a, b) => b.maxStat - a.maxStat || a.id.localeCompare(b.id));
  aptitudeWarnings.sort((a, b) => b.severity - a.severity || b.total - a.total || a.id.localeCompare(b.id));

  const total = commercialized.length;
  const genderCounts = countBy(commercialized, (item) => item.gender || '未知');
  const currentTierCounts = countBy(commercialized, (item) => item.rarityTier || '(missing)');
  const computedTierCounts = countBy(commercialized, (item) => item._balance.tier);
  const commercialBandCounts = countBy(commercialized, (item) => item._commercial.band);

  const genderTier = {};
  const genderCommercial = {};
  for (const item of commercialized) {
    const gender = item.gender || '未知';
    genderTier[gender] = genderTier[gender] || {};
    genderCommercial[gender] = genderCommercial[gender] || {};
    genderTier[gender][item.rarityTier] = (genderTier[gender][item.rarityTier] || 0) + 1;
    genderCommercial[gender][item._commercial.band] = (genderCommercial[gender][item._commercial.band] || 0) + 1;
  }

  console.log('=== 武將平衡 / 商業化稽核 ===');
  console.log(`總筆數: ${total}`);
  console.log(`性別分布: ${Object.entries(genderCounts).map(([key, count]) => `${key}=${count}`).join(' / ')}`);
  console.log(`稀有度矛盾: ${rarityMismatches.length} 筆`);
  console.log(`category 矛盾: ${categoryMismatches.length} 筆`);
  console.log(`aptitude 矛盾: ${aptitudeWarnings.length} 筆`);
  console.log(`gender 欄位異常: ${genderIssues.length} 筆`);
  console.log(`重名角色: ${duplicateNames.length} 組`);

  printDistribution('目前核心 rarityTier', currentTierCounts, total, cfg.tierOrder, cfg.tierLabels);
  printDistribution('雙軸重算 rarityTier', computedTierCounts, total, cfg.tierOrder, cfg.tierLabels);
  printDistribution('商業化 7 色分層', commercialBandCounts, total, cfg.commercialRarity.order, cfg.commercialRarity.labels);

  console.log('\n=== 性別 × 目前 rarityTier ===');
  for (const gender of Object.keys(genderTier)) {
    console.log(`${gender}: ${cfg.tierOrder.map((tier) => `${tier}=${genderTier[gender][tier] || 0}`).join(' / ')}`);
  }

  console.log('\n=== 性別 × 商業化 7 色 ===');
  for (const gender of Object.keys(genderCommercial)) {
    console.log(`${gender}: ${cfg.commercialRarity.order.map((band) => `${band}=${genderCommercial[gender][band] || 0}`).join(' / ')}`);
  }

  console.log(`\n=== Top ${TOP_N} 稀有度矛盾 ===`);
  rarityMismatches.slice(0, TOP_N).forEach((item, index) => {
    console.log(`${index + 1}. ${item.id} ${item.name} [${item.gender}] current=${item.current} computed=${item.computed} max=${item.maxStat} avg5=${item.avg5}`);
  });

  console.log(`\n=== Top ${TOP_N} category 矛盾 ===`);
  categoryMismatches.slice(0, TOP_N).forEach((item, index) => {
    console.log(`${index + 1}. ${item.id} ${item.name} [${item.gender}] current=${item.current} suggested=${item.suggested} currentTier=${item.currentTier} computedTier=${item.computedTier} max=${item.maxStat}`);
  });

  console.log(`\n=== Top ${TOP_N} aptitude 矛盾 ===`);
  aptitudeWarnings.slice(0, TOP_N).forEach((item, index) => {
    console.log(`${index + 1}. ${item.id} ${item.name} [${item.gender}] tier=${item.tier} A/S=${item.total} (troop=${item.troopA}, terrain=${item.terrainA}, weather=${item.weatherA}) expected=${item.expected}`);
  });

  if (duplicateNames.length > 0) {
    console.log(`\n=== 重名角色 ===`);
    duplicateNames.slice(0, TOP_N).forEach((item, index) => {
      console.log(`${index + 1}. ${item.name}: ${item.list.map((entry) => `${entry.id}[${entry.gender}]`).join(', ')}`);
    });
  }
}

main();