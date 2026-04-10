/**
 * project-config.js — 專案路徑與常數集中管理
 *
 * 所有 tools_node/ 工具應透過此模組取得專案路徑，
 * 不再各自硬編碼 `assets/resources/data/generals.json` 等路徑。
 *
 * Usage:
 *   const config = require('./lib/project-config');
 *   const generalsPath = config.paths.generalsJson;
 */
'use strict';

const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * @typedef {Object} ProjectPaths
 */
const paths = {
    // ── 專案根目錄 ──
    root: ROOT,

    // ── 遊戲資料 ──
    dataDir: path.join(ROOT, 'assets', 'resources', 'data'),
    generalsJson: path.join(ROOT, 'assets', 'resources', 'data', 'generals.json'),

    // ── UI Spec 三層 ──
    uiSpecDir: path.join(ROOT, 'assets', 'resources', 'ui-spec'),
    layoutsDir: path.join(ROOT, 'assets', 'resources', 'ui-spec', 'layouts'),
    skinsDir: path.join(ROOT, 'assets', 'resources', 'ui-spec', 'skins'),
    screensDir: path.join(ROOT, 'assets', 'resources', 'ui-spec', 'screens'),
    contractsDir: path.join(ROOT, 'assets', 'resources', 'ui-spec', 'contracts'),
    templatesDir: path.join(ROOT, 'assets', 'resources', 'ui-spec', 'templates'),

    // ── UI Spec Fragments ──
    fragmentsDir: path.join(ROOT, 'assets', 'resources', 'ui-spec', 'fragments'),
    widgetFragmentsDir: path.join(ROOT, 'assets', 'resources', 'ui-spec', 'fragments', 'widgets'),
    layoutFragmentsDir: path.join(ROOT, 'assets', 'resources', 'ui-spec', 'fragments', 'layouts'),
    skinFragmentsDir: path.join(ROOT, 'assets', 'resources', 'ui-spec', 'fragments', 'skins'),
    widgetRegistryJson: path.join(ROOT, 'assets', 'resources', 'ui-spec', 'fragments', 'widget-registry.json'),

    // ── Design Tokens ──
    designTokensJson: path.join(ROOT, 'assets', 'resources', 'ui-spec', 'ui-design-tokens.json'),

    // ── UI Scripts ──
    uiScriptsDir: path.join(ROOT, 'assets', 'scripts', 'ui'),
    uiCoreDir: path.join(ROOT, 'assets', 'scripts', 'ui', 'core'),

    // ── Sprites / Assets ──
    spritesDir: path.join(ROOT, 'assets', 'resources', 'sprites'),
    uiFamiliesDir: path.join(ROOT, 'assets', 'resources', 'sprites', 'ui_families'),

    // ── Artifacts ──
    artifactsDir: path.join(ROOT, 'artifacts'),
    uiSourceDir: path.join(ROOT, 'artifacts', 'ui-source'),
    uiLibraryDir: path.join(ROOT, 'artifacts', 'ui-library'),
    uiQaDir: path.join(ROOT, 'artifacts', 'ui-qa'),

    // ── Docs ──
    docsDir: path.join(ROOT, 'docs'),
    keepMd: path.join(ROOT, 'docs', 'keep.md'),
    keepSummaryMd: path.join(ROOT, 'docs', 'keep.summary.md'),
    keepShardsDir: path.join(ROOT, 'docs', 'keep-shards'),
    uiDocsDir: path.join(ROOT, 'docs', 'ui'),

    // ── i18n ──
    i18nDir: path.join(ROOT, 'assets', 'resources', 'i18n'),

    // ── Tools / Skills ──
    toolsNodeDir: path.join(ROOT, 'tools_node'),
    skillsDir: path.join(ROOT, '.github', 'skills'),
    agentSkillsDir: path.join(ROOT, '.agents', 'skills'),
    skillsManifestJson: path.join(ROOT, '.github', 'skills-manifest.json'),

    // ── Scenes ──
    scenesDir: path.join(ROOT, 'assets', 'scenes'),

    // ── Task Locks ──
    taskLocksDir: path.join(ROOT, '.task-locks'),
};

/**
 * 場景清單（用於 preview target 等）
 */
const scenes = [
    'LoadingScene',
    'BattleScene',
];

/**
 * 支援的語系
 */
const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];

/**
 * UI template family 清單
 */
const templateFamilies = [
    'detail-split',
    'dialog-card',
    'rail-list',
];

module.exports = {
    paths,
    scenes,
    locales,
    templateFamilies,
    ROOT,
};
