#!/usr/bin/env node
/**
 * tools_node/validate-consolidation-links.js
 *
 * 檢查 consolidation-manifest 與實際文件關聯是否正確：
 * 1) manifest.files[].path 是否存在
 * 2) targetSpecs doc_id 是否存在於 doc-id-registry
 * 3) mcqRefs (Qxx) 是否存在於 整併疑問書.md
 *
 * Usage:
 *   node tools_node/validate-consolidation-links.js
 *   node tools_node/validate-consolidation-links.js --strict
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'docs/遊戲規格文件/consolidation-manifest.json');
const REGISTRY_PATH = path.join(ROOT, 'docs/doc-id-registry.json');
const DOUBT_PATH = path.join(ROOT, 'docs/遊戲規格文件/整併疑問書.md');

const strictMode = process.argv.includes('--strict');

function fail(msg) {
  console.error(`[ERROR] ${msg}`);
  process.exit(1);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) fail(`File not found: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const manifest = readJson(MANIFEST_PATH);
  const registryRaw = readJson(REGISTRY_PATH);
  const registry = registryRaw.registry || registryRaw;

  if (!Array.isArray(manifest.files)) {
    fail('Invalid manifest format: files must be an array');
  }

  const doubtContent = fs.existsSync(DOUBT_PATH)
    ? fs.readFileSync(DOUBT_PATH, 'utf8')
    : '';

  const missingSourceFiles = [];
  const invalidTargetSpecs = [];
  const missingMcqRefs = [];

  for (const file of manifest.files) {
    if (!file || typeof file !== 'object') continue;

    const srcPath = file.path || '';
    if (srcPath) {
      const full = path.join(ROOT, srcPath);
      if (!fs.existsSync(full)) {
        missingSourceFiles.push(srcPath);
      }
    }

    const targets = Array.isArray(file.targetSpecs) ? file.targetSpecs : [];
    for (const docId of targets) {
      if (!registry[docId]) {
        invalidTargetSpecs.push({ source: srcPath, docId });
      }
    }

    const mcqRefs = Array.isArray(file.mcqRefs) ? file.mcqRefs : [];
    for (const ref of mcqRefs) {
      const marker = `## ${ref}.`;
      if (!doubtContent.includes(marker)) {
        missingMcqRefs.push({ source: srcPath, mcqRef: ref });
      }
    }
  }

  console.log('\n[validate-consolidation-links] Summary\n');
  console.log(`Manifest entries:           ${manifest.files.length}`);
  console.log(`Missing source files:       ${missingSourceFiles.length}`);
  console.log(`Invalid targetSpecs doc_id: ${invalidTargetSpecs.length}`);
  console.log(`Missing mcqRefs in doubt:   ${missingMcqRefs.length}`);

  if (missingSourceFiles.length > 0) {
    console.log('\nMissing source files:');
    for (const p of missingSourceFiles) {
      console.log(`  - ${p}`);
    }
  }

  if (invalidTargetSpecs.length > 0) {
    console.log('\nInvalid targetSpecs doc_id:');
    for (const item of invalidTargetSpecs) {
      console.log(`  - ${item.docId} @ ${item.source}`);
    }
  }

  if (missingMcqRefs.length > 0) {
    console.log('\nMissing mcqRefs in 整併疑問書.md:');
    for (const item of missingMcqRefs) {
      console.log(`  - ${item.mcqRef} @ ${item.source}`);
    }
  }

  const hasIssues =
    missingSourceFiles.length > 0 ||
    invalidTargetSpecs.length > 0 ||
    missingMcqRefs.length > 0;

  if (hasIssues) {
    console.log('\nResult: ISSUES FOUND');
    if (strictMode) {
      process.exit(2);
    }
  } else {
    console.log('\nResult: OK');
  }

  console.log('');
}

main();
