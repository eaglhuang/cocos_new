/**
 * rarity-resolver.js
 * Node.js 共用稀有度計算模組 — 對應 TypeScript 版 RarityResolver.ts
 *
 * 邏輯與 assets/scripts/core/utils/RarityResolver.ts 保持一致：
 *   1. config.rarityTier 已設定 → 直接回傳
 *   2. categoryOverrides 命中 → 回傳 override tier
 *   3. 雙軸（maxStat + avg5）各自判定，取較高 tier
 *
 * 使用方式：
 *   const { resolveRarityTier, loadThresholds } = require('./lib/rarity-resolver');
 *   loadThresholds(); // 載入 rarity-thresholds.json（可選，預設內建門檻）
 *   const tier = resolveRarityTier(generalConfig);
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---- 預設門檻（與 RarityResolver.ts DEFAULT_THRESHOLDS 相同）----
const DEFAULT_THRESHOLDS = {
    axes: {
        maxStat: { legendary: 95, epic: 80, rare: 65 },
        avg5:    { legendary: 80, epic: 65, rare: 50 },
    },
    excludeFromAvg: ['luk'],
    categoryOverrides: {
        mythical: 'mythic',
        titled:   'legendary',
        civilian: 'common',
        general:  'common',
        famed:    'rare',
    },
    tierOrder: ['common', 'rare', 'epic', 'legendary', 'mythic'],
};

let _thresholds = DEFAULT_THRESHOLDS;

/**
 * 從 assets/resources/data/rarity-thresholds.json 載入門檻（可選）。
 * 若檔案不存在，繼續使用預設值。
 */
function loadThresholds() {
    const filePath = path.resolve(__dirname, '../../assets/resources/data/rarity-thresholds.json');
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.axes && data.tierOrder) {
            _thresholds = data;
        }
    } catch (_e) {
        // 預設門檻繼續有效
    }
}

function _resolveTierFromAxis(value, axisThresholds) {
    const highToLow = [..._thresholds.tierOrder].reverse().filter(t => t in axisThresholds);
    for (const tier of highToLow) {
        if (value >= axisThresholds[tier]) return tier;
    }
    return 'common';
}

function _tierRank(tier) {
    return _thresholds.tierOrder.indexOf(tier);
}

function _higher(a, b) {
    return _tierRank(a) >= _tierRank(b) ? a : b;
}

function _calcMaxStat(g) {
    const fields = ['str', 'int', 'lea', 'pol', 'cha', 'luk'];
    let max = 0;
    for (const f of fields) {
        const v = g.stats?.[f] ?? g[f] ?? 0;
        if (v > max) max = v;
    }
    return max;
}

function _calcAvg5(g) {
    const exclude = new Set(_thresholds.excludeFromAvg);
    const fields = ['str', 'int', 'lea', 'pol', 'cha', 'luk'];
    const vals = [];
    for (const f of fields) {
        if (!exclude.has(f)) {
            const v = g.stats?.[f] ?? g[f];
            if (typeof v === 'number') vals.push(v);
        }
    }
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

/**
 * 計算武將的 rarityTier（與 TypeScript RarityResolver.resolveRarityTier 邏輯相同）。
 * @param {object} g  GeneralConfig-like 物件（含六維屬性）
 * @returns {string}  'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
 */
function resolveRarityTier(g) {
    // 1. 已手動設定 rarityTier → 直接採用
    if (g.rarityTier) return g.rarityTier;

    // 2. categoryOverrides
    const cat = g.characterCategory;
    if (cat && _thresholds.categoryOverrides[cat]) {
        return _thresholds.categoryOverrides[cat];
    }

    // 3. 雙軸判定
    const maxStat = _calcMaxStat(g);
    const avg5    = _calcAvg5(g);
    const tMax    = _resolveTierFromAxis(maxStat, _thresholds.axes.maxStat);
    const tAvg    = _resolveTierFromAxis(avg5,    _thresholds.axes.avg5);
    return _higher(tMax, tAvg);
}

module.exports = { resolveRarityTier, loadThresholds };
