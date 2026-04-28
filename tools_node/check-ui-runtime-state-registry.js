#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const screensDir = path.join(projectRoot, 'assets', 'resources', 'ui-spec', 'screens');
const contentDir = path.join(projectRoot, 'assets', 'resources', 'ui-spec', 'content');
const registryPath = path.join(projectRoot, 'assets', 'resources', 'ui-spec', 'runtime-state-registry.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function screenPath(screenId) {
  return path.join(screensDir, `${screenId}.json`);
}

function contentPath(contentSource) {
  return path.join(contentDir, `${contentSource}.json`);
}

function main() {
  const registry = readJson(registryPath);
  const routes = Array.isArray(registry.routes) ? registry.routes : [];
  const routeByScreen = new Map(routes.map((route) => [route.screenId, route]));
  const errors = [];
  const warnings = [];

  for (const route of routes) {
    const filePath = screenPath(route.screenId);
    if (!fs.existsSync(filePath)) {
      errors.push(`${route.screenId}: screen json 不存在`);
      continue;
    }

    const screen = readJson(filePath);
    if (screen.version !== route.screenVersion) {
      errors.push(`${route.screenId}: version mismatch screen=${screen.version} registry=${route.screenVersion}`);
    }

    if (route.contentSource && screen.content?.source !== route.contentSource) {
      errors.push(`${route.screenId}: content source mismatch screen=${screen.content?.source || 'none'} registry=${route.contentSource}`);
    }

    if (route.defaultState && screen.content?.state !== route.defaultState) {
      errors.push(`${route.screenId}: default state mismatch screen=${screen.content?.state || 'none'} registry=${route.defaultState}`);
    }

    if (route.contentSource) {
      const cPath = contentPath(route.contentSource);
      if (!fs.existsSync(cPath)) {
        errors.push(`${route.screenId}: content source 不存在 ${route.contentSource}`);
      } else {
        const content = readJson(cPath);
        if (route.defaultState && !content.states?.[route.defaultState]) {
          errors.push(`${route.screenId}: content state 不存在 ${route.contentSource}.${route.defaultState}`);
        }
        for (const [variant, stateKey] of Object.entries(route.variants || {})) {
          if (!content.states?.[stateKey]) {
            errors.push(`${route.screenId}: variant ${variant} 指向不存在 state ${stateKey}`);
          }
        }
      }
    }

    if (route.provider === 'component-owned' && !route.ownerComponent) {
      errors.push(`${route.screenId}: component-owned route 缺少 ownerComponent`);
    }
  }

  for (const file of fs.readdirSync(screensDir).filter((name) => name.endsWith('.json'))) {
    const screen = readJson(path.join(screensDir, file));
    if (screen.content && !routeByScreen.has(screen.id)) {
      warnings.push(`${screen.id}: 宣告 content 但未登記 runtime-state-registry`);
    }
  }

  if (warnings.length > 0) {
    console.warn('[ui-runtime-state-registry] warnings:');
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error('[ui-runtime-state-registry] failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`[ui-runtime-state-registry] passed routes=${routes.length} warnings=${warnings.length}`);
}

main();