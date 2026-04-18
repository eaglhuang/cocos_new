#!/usr/bin/env node
/**
 * tools_node/consolidation-backfill.js
 *
 * 將「歷史上已整併完成」但尚未在 manifest 補齊的來源，直接回填為 completed。
 * 適用於已有明確回寫紀錄（例如 討論來源整併狀態.md）者。
 *
 * Usage:
 *   node tools_node/consolidation-backfill.js complete <file> --targets doc_a,doc_b [--notes "..."]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'docs/遊戲規格文件/consolidation-manifest.json');

const args = process.argv.slice(2);
const cmd = args[0];
const filePath = args[1];

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}

function parseFlag(name) {
  const idx = args.indexOf(name);
  if (idx < 0) return '';
  return args[idx + 1] || '';
}

function cmdComplete() {
  if (!filePath) {
    console.error('[ERROR] Missing file path. Usage: complete <file> --targets doc_a,doc_b');
    process.exit(1);
  }

  const targets = parseFlag('--targets')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const notes = parseFlag('--notes');

  if (targets.length === 0) {
    console.error('[ERROR] Missing --targets');
    process.exit(1);
  }

  const manifest = loadManifest();
  const file = (manifest.files || []).find(item => item.path === filePath);

  if (!file) {
    console.error(`[ERROR] File not found in manifest: ${filePath}`);
    process.exit(1);
  }

  const total = file.paragraphs?.total || 0;
  file.status = 'completed';
  file.dateCompleted = new Date().toISOString().split('T')[0];
  file.paragraphs = {
    total,
    consolidated: total,
    doubt: 0,
    discarded: 0,
    pending: 0,
  };
  file.coverage_percentage = total > 0 ? 100 : 0;
  file.targetSpecs = [...new Set([...(file.targetSpecs || []), ...targets])];
  if (notes) file.notes = notes;

  manifest._meta.completedFiles = (manifest.files || []).filter(item => item.status === 'completed').length;
  manifest._meta.overallCoverage = manifest.files.length > 0
    ? Math.round((manifest._meta.completedFiles / manifest.files.length) * 100)
    : 0;
  manifest._meta.lastUpdated = new Date().toISOString().split('T')[0];

  saveManifest(manifest);

  console.log(`\n[consolidation-backfill] Completed: ${filePath}`);
  console.log(`Targets: ${targets.join(', ')}`);
  console.log(`Paragraph total: ${total}`);
  console.log('');
}

switch (cmd) {
  case 'complete':
    cmdComplete();
    break;
  default:
    console.log(`
[consolidation-backfill]

Usage:
  node tools_node/consolidation-backfill.js complete <file> --targets doc_a,doc_b [--notes "..."]
`);
}