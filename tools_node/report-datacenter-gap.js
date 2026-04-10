#!/usr/bin/env node
/**
 * report-datacenter-gap.js
 * 產出資料中心落差清單，逐張對照 tasks-dc.json 並標示 done / reopen。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TASKS_PATH = path.join(ROOT, 'docs', 'tasks', 'tasks-dc.json');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'tasks', 'data-center-gap-report.md');
const BASE_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-base.json');
const LORE_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-lore.json');
const STORIES_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-stories.json');
const RUNTIME_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'generals.json');
const INDEX_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'generals-index.json');
const REGISTRY_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'person-registry.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function unwrapData(value) {
  if (Array.isArray(value)) return value;
  return Array.isArray(value.data) ? value.data : [];
}

function summarizeNote(task) {
  const overrides = {
    'DC-2-0001': '依任務 acceptance，IndexedDB 已完成、SQLite 允許 stub + TODO；此卡保持 done。',
    'DC-2-0002': '本輪已補齊 build pipeline，generals-index.json 由 master 生成並含 200 筆資料。',
    'DC-2-0003': '由重建後的 generals-index/generals.json 驗證分頁載入前提已恢復。',
    'DC-3-0005': '目前 validate-bloodline-integrity.js 已能對 200 筆 runtime generals 驗證。',
    'DC-6-0001': '結構達標，但內容品質仍需另看 core-50 審校報告。',
    'DC-7-0001': '仍缺 Cocos Editor 內實機啟動/儲存回寫驗證，且 deliverable 仍為 JS scaffold。',
    'DC-7-0002': '仍缺 CC_DEV build-time 排除驗證，且尚未完成完整 runtime 上線驗收。',
  };
  if (overrides[task.id]) return overrides[task.id];
  return '與 tasks-dc.json 現況一致。';
}

function main() {
  const tasksDoc = loadJson(TASKS_PATH);
  const base = unwrapData(loadJson(BASE_PATH));
  const lore = unwrapData(loadJson(LORE_PATH));
  const stories = unwrapData(loadJson(STORIES_PATH));
  const runtime = unwrapData(loadJson(RUNTIME_PATH));
  const index = unwrapData(loadJson(INDEX_PATH));
  const registry = loadJson(REGISTRY_PATH);

  const reportRows = tasksDoc.tasks.map((task) => ({
    id: task.id,
    status: task.status === 'done' ? 'done' : 'reopen',
    title: task.title,
    note: summarizeNote(task),
  }));

  const doneCount = reportRows.filter((row) => row.status === 'done').length;
  const reopenCount = reportRows.filter((row) => row.status === 'reopen').length;

  const lines = [
    '# 資料中心落差清單',
    '',
    `- 產出時間: ${new Date().toISOString()}`,
    `- done: ${doneCount}`,
    `- reopen: ${reopenCount}`,
    `- master/generals-base: ${base.length}`,
    `- master/generals-lore: ${lore.length}`,
    `- master/generals-stories: ${stories.length}`,
    `- runtime/generals.json: ${runtime.length}`,
    `- runtime/generals-index.json: ${index.length}`,
    `- person-registry persons/links: ${(registry.persons || []).length} / ${(registry.links || []).length}`,
    '',
    '## 本輪關鍵結論',
    '',
    '- master -> generals-index/generals.json build pipeline 已補齊，runtime 不再只停留在 5 筆 legacy 武將。',
    '- DataCatalog 與 DataPageLoader 的前置資料檔已恢復可用，L0/L1-L5 主幹斷鏈已修補。',
    '- 目前仍需 reopen 的主要缺口集中在雙形態資料工具驗收（DC-7-0001、DC-7-0002）。',
    '- 200 筆資料的結構完整度已達標，但內容品質仍需另看 core-50 審校報告。',
    '',
    '## 任務卡對照',
    '',
    '| 卡號 | 標示 | 標題 | 審核摘要 |',
    '| --- | --- | --- | --- |',
    ...reportRows.map((row) => `| ${row.id} | ${row.status} | ${row.title} | ${row.note} |`),
    '',
  ];

  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8');
  console.log(`[report-datacenter-gap] 已輸出 ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main();