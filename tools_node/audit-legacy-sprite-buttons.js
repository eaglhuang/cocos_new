#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SKINS_DIR = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec', 'skins');
const LAYOUTS_DIR = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec', 'layouts');

function parseArgs(argv) {
  const options = { report: '', strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case '--report':
        options.report = next;
        index += 1;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--help':
      case '-h':
        console.log('用法: node tools_node/audit-legacy-sprite-buttons.js [--report <file>] [--strict]');
        process.exit(0);
      default:
        break;
    }
  }
  return options;
}

function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => path.join(dirPath, fileName));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectSkinSlotRefs(node, refs = [], currentPath = '') {
  if (!node || typeof node !== 'object') {
    return refs;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      collectSkinSlotRefs(child, refs, currentPath);
    }
    return refs;
  }

  const nodeName = typeof node.name === 'string' ? node.name : '';
  const pathLabel = nodeName ? (currentPath ? `${currentPath}/${nodeName}` : nodeName) : currentPath;
  if (typeof node.skinSlot === 'string') {
    refs.push({ skinSlot: node.skinSlot, path: pathLabel || '(anonymous-node)' });
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      collectSkinSlotRefs(value, refs, pathLabel);
    }
  }

  return refs;
}

function buildLayoutRefMap() {
  const map = new Map();
  for (const filePath of listJsonFiles(LAYOUTS_DIR)) {
    const layout = readJson(filePath);
    const refs = collectSkinSlotRefs(layout);
    for (const ref of refs) {
      const list = map.get(ref.skinSlot) || [];
      list.push({
        layoutId: layout.id || path.basename(filePath, '.json'),
        layoutPath: path.relative(PROJECT_ROOT, filePath),
        nodePath: ref.path,
      });
      map.set(ref.skinSlot, list);
    }
  }
  return map;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const layoutRefs = buildLayoutRefMap();
  const entries = [];

  for (const filePath of listJsonFiles(SKINS_DIR)) {
    const skin = readJson(filePath);
    const slots = skin.slots || {};
    for (const [slotId, slot] of Object.entries(slots)) {
      if (!slot || slot.kind !== 'sprite-button') {
        continue;
      }

      entries.push({
        skinId: skin.id || path.basename(filePath, '.json'),
        skinPath: path.relative(PROJECT_ROOT, filePath),
        slotId,
        normal: slot.normal || null,
        pressed: slot.pressed || null,
        disabled: slot.disabled || null,
        border: Array.isArray(slot.border) ? slot.border : null,
        layoutRefs: layoutRefs.get(slotId) || [],
      });
    }
  }

  const report = {
    reportVersion: '1.0',
    generatedAt: new Date().toISOString(),
    summary: {
      legacySlotCount: entries.length,
      skinsAffected: Array.from(new Set(entries.map((entry) => entry.skinId))).length,
    },
    entries,
  };

  if (options.report) {
    const reportPath = path.isAbsolute(options.report)
      ? options.report
      : path.join(PROJECT_ROOT, options.report);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  console.log(`[audit-legacy-sprite-buttons] legacySlots=${entries.length}`);
  if (entries.length > 0) {
    for (const entry of entries) {
      console.log(`- ${entry.skinId}.${entry.slotId} (${entry.layoutRefs.length} layout ref)`);
    }
    if (options.strict) {
      process.exit(1);
    }
  }
}

main();