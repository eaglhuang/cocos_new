#!/usr/bin/env node
/**
 * validate-representative-spriteframe-assets.js
 *
 * 針對 UI-2-0021 的代表性 SpriteFrame 路徑做靜態驗證：
 * 1. assets/resources 下有對應圖片檔
 * 2. .meta 存在且包含 spriteFrame 子資產
 * 3. 路徑正規化後的 cache key 與 runtime 慣例一致
 */

'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const resourcesRoot = path.join(projectRoot, 'assets', 'resources');

const representativeAssets = [
  'sprites/ui_families/common/shadow/shadow_01',
  'sprites/ui_families/common/noise/metal_noise_256',
  'sprites/ui_families/common/equipment/btn_primary_normal',
  'sprites/ui_families/general_detail/detail_header_bg',
];

function normalizeResourcePath(resourcePath) {
  return resourcePath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^db:\/\/assets\/resources\//i, '')
    .replace(/^assets\/resources\//i, '')
    .replace(/^resources\//i, '')
    .replace(/^\/+/, '')
    .replace(/\.(png|jpg|jpeg|webp)$/i, '')
    .replace(/\/+/g, '/');
}

function getExistingImagePath(normalizedPath) {
  const extensions = ['.png', '.jpg', '.jpeg', '.webp'];
  for (const extension of extensions) {
    const candidate = path.join(resourcesRoot, `${normalizedPath}${extension}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function hasSpriteFrameSubMeta(metaJson, expectedName) {
  if (!metaJson || typeof metaJson !== 'object' || !metaJson.subMetas) {
    return false;
  }

  return Object.values(metaJson.subMetas).some((subMeta) => {
    if (!subMeta || typeof subMeta !== 'object') {
      return false;
    }
    return subMeta.name === 'spriteFrame' && subMeta.displayName === expectedName;
  });
}

const failures = [];
const passes = [];

for (const rawPath of representativeAssets) {
  const normalizedPath = normalizeResourcePath(rawPath);
  const spriteFrameKey = normalizedPath.endsWith('/spriteFrame')
    ? normalizedPath
    : `${normalizedPath}/spriteFrame`;
  const imagePath = getExistingImagePath(normalizedPath);

  if (!imagePath) {
    failures.push(`${rawPath}: 找不到對應圖片檔`);
    continue;
  }

  const metaPath = `${imagePath}.meta`;
  if (!fs.existsSync(metaPath)) {
    failures.push(`${rawPath}: 找不到 meta 檔 ${path.relative(projectRoot, metaPath)}`);
    continue;
  }

  let metaJson;
  try {
    metaJson = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (error) {
    failures.push(`${rawPath}: meta JSON 解析失敗: ${error.message}`);
    continue;
  }

  const expectedName = path.basename(normalizedPath);
  if (!hasSpriteFrameSubMeta(metaJson, expectedName)) {
    failures.push(`${rawPath}: meta 缺少 displayName=${expectedName} 的 spriteFrame 子資產`);
    continue;
  }

  passes.push(`${rawPath} -> ${path.relative(projectRoot, imagePath)} -> ${spriteFrameKey}`);
}

console.log('='.repeat(60));
console.log('UI-2-0021 代表性 SpriteFrame 資產驗證');
console.log('='.repeat(60));
passes.forEach((message) => console.log(`PASS ${message}`));

if (failures.length > 0) {
  failures.forEach((message) => console.error(`FAIL ${message}`));
  console.error(`\n驗證失敗: ${failures.length} 項`);
  process.exit(1);
}

console.log(`\n驗證通過: ${passes.length} 項`);
