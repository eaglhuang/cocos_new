#!/usr/bin/env node
/**
 * audit-core-generals-quality.js
 * 針對 master 前 50 核心武將輸出內容品質審校報告。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-base.json');
const LORE_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-lore.json');
const STORIES_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-stories.json');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'tasks', 'core-50-general-quality-report.md');

const ICONIC_BENCHMARKS = {
  'lu-bu': { field: 'str', min: 95, tier: 'legendary', reason: '呂布應是頂級武力天花板。' },
  'zhuge-liang': { field: 'int', min: 95, tier: 'legendary', reason: '諸葛亮應是頂級智略代表。' },
  'guan-yu': { field: 'str', min: 90, tier: 'legendary', reason: '關羽應具頂級武力與名將 tier。' },
  'zhang-fei': { field: 'str', min: 92, tier: 'legendary', reason: '張飛應具極高爆發武力。' },
  'zhao-yun': { field: 'str', min: 88, tier: 'legendary', reason: '趙雲應屬高機動高上限名將。' },
  'cao-cao': { field: 'int', min: 88, tier: 'legendary', reason: '曹操的智略/政治應具明顯領先。' },
  'sima-yi': { field: 'int', min: 90, tier: 'legendary', reason: '司馬懿應具頂級智略與戰略層級。' },
  'zhou-yu': { field: 'int', min: 88, tier: 'legendary', reason: '周瑜應有更高智略與魅力辨識度。' },
  'liu-bei': { field: 'cha', min: 85, tier: 'legendary', reason: '劉備應以魅力/統御見長。' },
  'sun-quan': { field: 'lea', min: 82, tier: 'legendary', reason: '孫權應具更高統御與君主位階。' },
};

const GENERIC_BLOODLINE_PATTERNS = [
  '坊間流傳其有神將血脈',
  '族譜顯示其家族世代習武',
  '據說其出生時天現異象',
];

const GENERIC_STORY_PATTERNS = [
  '年少時便展現過人才華',
  '初入仕途，以一件奇事引起上位者注意',
  '在一場關鍵之戰中，以智勇雙全之姿力挽狂瀾',
  '盛年之際，聲名遠播',
  '晚年回望一生',
  '身後，人們以詩文紀念其偉業',
];

function loadData(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(raw) ? raw : (raw.data || []);
}

function tierRank(tier) {
  return ({ common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 })[tier] ?? 0;
}

function isGenericStory(cells) {
  if (!Array.isArray(cells) || cells.length !== 6) return true;
  return GENERIC_STORY_PATTERNS.every((pattern, index) => String(cells[index]?.text || '').includes(pattern));
}

function main() {
  const base = loadData(BASE_PATH).slice(0, 50);
  const lore = loadData(LORE_PATH);
  const stories = loadData(STORIES_PATH);
  const loreMap = new Map(lore.map((item) => [item.id, item]));
  const storiesMap = new Map(stories.map((item) => [item.id, item]));

  const statFlags = [];
  const copyFlags = [];
  let genericStoryCount = 0;
  let genericBloodlineCount = 0;
  let shortAnecdoteCount = 0;

  for (const record of base) {
    const loreRecord = loreMap.get(record.id) || {};
    const storyRecord = storiesMap.get(record.id) || {};
    const bench = ICONIC_BENCHMARKS[record.id];

    if (bench) {
      const actual = Number(record[bench.field] || 0);
      const deficit = bench.min - actual;
      const tierGap = tierRank(bench.tier) - tierRank(record.rarityTier);
      if (deficit > 0 || tierGap > 0) {
        statFlags.push({
          id: record.id,
          name: record.name,
          field: bench.field,
          actual,
          expectedMin: bench.min,
          rarityTier: record.rarityTier,
          expectedTier: bench.tier,
          reason: bench.reason,
          score: deficit + tierGap * 10,
        });
      }
    }

    const range = Math.max(record.str || 0, record.int || 0, record.lea || 0, record.pol || 0, record.cha || 0, record.luk || 0)
      - Math.min(record.str || 0, record.int || 0, record.lea || 0, record.pol || 0, record.cha || 0, record.luk || 0);

    const anecdote = String(loreRecord.historicalAnecdote || '').trim();
    const bloodlineRumor = String(loreRecord.bloodlineRumor || '').trim();
    const storyCells = storyRecord.storyStripCells || loreRecord.storyStripCells || [];

    const genericBloodline = GENERIC_BLOODLINE_PATTERNS.some((pattern) => bloodlineRumor.includes(pattern));
    const genericStory = isGenericStory(storyCells);
    const shortAnecdote = anecdote.length < 80;

    if (genericStory) genericStoryCount++;
    if (genericBloodline) genericBloodlineCount++;
    if (shortAnecdote) shortAnecdoteCount++;

    const copyScore = (genericStory ? 3 : 0) + (genericBloodline ? 2 : 0) + (shortAnecdote ? 1 : 0) + (range <= 10 ? 1 : 0);
    if (copyScore >= 4) {
      copyFlags.push({
        id: record.id,
        name: record.name,
        genericStory,
        genericBloodline,
        shortAnecdote,
        range,
        score: copyScore,
      });
    }
  }

  statFlags.sort((a, b) => b.score - a.score);
  copyFlags.sort((a, b) => b.score - a.score);

  const rarityDist = base.reduce((map, item) => {
    const key = item.rarityTier || '(missing)';
    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});

  const lines = [
    '# 前 50 核心武將內容品質審校報告',
    '',
    `- 產出時間: ${new Date().toISOString()}`,
    `- 審校集合: master/generals-base.json 前 50 筆`,
    '',
    '## 摘要',
    '',
    `- 泛用故事條模板命中: ${genericStoryCount} / 50`,
    `- 泛用血脈傳聞模板命中: ${genericBloodlineCount} / 50`,
    `- historicalAnecdote 過短: ${shortAnecdoteCount} / 50`,
    `- 稀有度分布: ${Object.entries(rarityDist).map(([key, value]) => `${key}=${value}`).join(' / ')}`,
    '',
    '## 數值最不合理名單',
    '',
    '| 名次 | id | 名稱 | 問題 | 現況 | 建議 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...statFlags.slice(0, 12).map((item, index) => `| ${index + 1} | ${item.id} | ${item.name} | ${item.reason} | ${item.field}=${item.actual}, rarity=${item.rarityTier} | ${item.field} >= ${item.expectedMin}，tier 至少 ${item.expectedTier} |`),
    '',
    '## 文案最不合理名單',
    '',
    '| 名次 | id | 名稱 | 問題 | 觀察 |',
    '| --- | --- | --- | --- | --- |',
    ...copyFlags.slice(0, 15).map((item, index) => `| ${index + 1} | ${item.id} | ${item.name} | ${[
      item.genericStory ? '故事條高度模板化' : null,
      item.genericBloodline ? '血脈傳聞高度模板化' : null,
      item.shortAnecdote ? '歷史趣聞偏短' : null,
      item.range <= 10 ? '六維差異過平' : null,
    ].filter(Boolean).join('、')} | range=${item.range} |`),
    '',
    '## 審校建議',
    '',
    '1. 先人工校正 10 位核心招牌武將的主屬性與 rarityTier，建立可作為後續批次校準的標尺。',
    '2. 將泛用故事條模板從 lore 內拆出，改為只作 fallback，避免 50 位核心武將出現大量相同人生弧線。',
    '3. 為核心武將建立 `content_locked` 或 `manual_override` 清單，防止後續批次腳本再次把手工校調結果沖淡。',
    '',
  ];

  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8');
  console.log(`[audit-core-generals-quality] 已輸出 ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main();