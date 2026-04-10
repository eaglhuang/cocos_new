"use strict";

const FIELD_ALIASES = {
  id: 'id', uid: 'id', 名稱: 'name', name: 'name',
  別名: 'alias', alias: 'alias',
  武力: 'str', str: 'str', 智力: 'int', int: 'int',
  統率: 'lea', lea: 'lea', 政治: 'pol', pol: 'pol',
  魅力: 'cha', cha: 'cha', 運氣: 'luk', luk: 'luk',
  爆發力: 'ep', ep: 'ep', 陣營: 'faction', faction: 'faction',
  稀有度: 'rarityTier', rarity: 'rarityTier', rarityTier: 'rarityTier',
  分類: 'characterCategory', characterCategory: 'characterCategory',
  角色: 'role', role: 'role', 性別: 'gender', gender: 'gender',
};

const TEXT_FIELDS = new Set(['id', 'name', 'alias', 'faction', 'rarityTier', 'characterCategory', 'role', 'gender']);
const OPERATORS = ['>=', '<=', '!=', '==', '>', '<', '=', ':'];

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）\[\]【】'"、,，.。:：;；_\-]/g, '');
}

function isSubsequence(query, text) {
  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (query[qi] === text[ti]) qi++;
  }
  return qi === query.length;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  const curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function fuzzyMatchGeneralName(query, candidate) {
  const normalizedQuery = normalizeText(query);
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedQuery || !normalizedCandidate) return false;
  if (normalizedCandidate.includes(normalizedQuery)) return true;
  if (isSubsequence(normalizedQuery, normalizedCandidate)) return true;
  const distance = levenshtein(normalizedQuery, normalizedCandidate);
  return distance <= (normalizedQuery.length <= 3 ? 1 : 2);
}

function splitByLogicalOperator(query, operator) {
  const pattern = operator === 'or' ? /\s*(?:\bor\b|\|\||或)\s*/i : /\s*(?:\band\b|&&|且)\s*/i;
  return query.split(pattern).map(token => token.trim()).filter(Boolean);
}

function parseClause(rawClause) {
  for (const operator of OPERATORS) {
    const index = rawClause.indexOf(operator);
    if (index > 0) {
      return {
        field: FIELD_ALIASES[rawClause.slice(0, index).trim()] ?? null,
        operator,
        value: rawClause.slice(index + operator.length).trim(),
      };
    }
  }
  return { field: null, operator: null, value: rawClause.trim() };
}

function compareClause(record, clause) {
  if (!clause.field || !clause.operator) {
    return [record.name, ...(Array.isArray(record.alias) ? record.alias : []), record.id, record.uid, record.faction, record.rarityTier, record.characterCategory]
      .some(value => fuzzyMatchGeneralName(clause.value, String(value ?? '')));
  }

  const current = record[clause.field];
  if (current === undefined || current === null) return false;

  if (TEXT_FIELDS.has(clause.field)) {
    const left = Array.isArray(current)
      ? current.map((value) => normalizeText(value)).filter(Boolean)
      : normalizeText(current);
    const right = normalizeText(clause.value);
    if (Array.isArray(left)) {
      if (clause.operator === ':' || clause.operator === '=') return left.some((item) => item.includes(right) || fuzzyMatchGeneralName(right, item));
      if (clause.operator === '==') return left.includes(right);
      if (clause.operator === '!=') return !left.includes(right);
      return false;
    }
    if (clause.operator === ':' || clause.operator === '=') return left.includes(right) || fuzzyMatchGeneralName(right, left);
    if (clause.operator === '==') return left === right;
    if (clause.operator === '!=') return left !== right;
    return false;
  }

  const left = Number(current);
  const right = Number(clause.value);
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  switch (clause.operator) {
    case '>': return left > right;
    case '>=': return left >= right;
    case '<': return left < right;
    case '<=': return left <= right;
    case '=':
    case '==': return left === right;
    case '!=': return left !== right;
    default: return false;
  }
}

function matchesGeneralQuery(record, query) {
  const trimmed = String(query ?? '').trim();
  if (!trimmed) return true;
  const orGroups = splitByLogicalOperator(trimmed, 'or');
  return orGroups.some(group => {
    const andClauses = splitByLogicalOperator(group, 'and');
    return andClauses.every(text => compareClause(record, parseClause(text)));
  });
}

module.exports = { fuzzyMatchGeneralName, matchesGeneralQuery };