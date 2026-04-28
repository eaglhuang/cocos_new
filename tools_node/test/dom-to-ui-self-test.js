#!/usr/bin/env node
// doc_id: doc_other_0009 — dom-to-ui-json self-test
// 用法： node tools_node/test/dom-to-ui-self-test.js
//
// 驗證 phase 2 之核心能力：
//   1. 嵌套 children 正確（panel→[image,label]）
//   2. lazySlot 後代資產被推到 deferred
//   3. label-style auto-fill outlineColor / outlineWidth
//   4. --validate 串接 validate-ui-specs.js
//   5. --sync-existing preserve-human 保留人手欄位
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { PNG } = require('pngjs');
const { buildDraftFromHtml } = require('../lib/dom-to-ui/draft-builder');
const { snapshotToSlots } = require('../lib/dom-to-ui/snapshot-to-slots');
const { resolveSourcePackage, writeHtmlWithSourceCss } = require('../lib/html-to-ucuf/source-package');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'dom-to-ui', 'gacha-banner.html');
const INTERACTION_FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'dom-to-ui', 'interaction-motion.html');
const VISUAL_RICH_FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'dom-to-ui', 'visual-rich.html');
const CLI = path.join(REPO_ROOT, 'tools_node', 'dom-to-ui-json.js');
const COMPARE_CLI = path.join(REPO_ROOT, 'tools_node', 'dom-to-ui-compare.js');
const FEEDBACK_CLI = path.join(REPO_ROOT, 'tools_node', 'dom-to-ui-feedback.js');
const LOGIC_GUARD_CLI = path.join(REPO_ROOT, 'tools_node', 'dom-to-ui-logic-guard.js');
const SCAFFOLD_CLI = path.join(REPO_ROOT, 'tools_node', 'scaffold-ui-component.js');
const HTML_COCOS_COMPARE_CLI = path.join(REPO_ROOT, 'tools_node', 'compare-html-to-cocos-editor.js');
const HTML_TO_UCUF_WORKFLOW_CLI = path.join(REPO_ROOT, 'tools_node', 'run-html-to-ucuf-workflow.js');

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[ok] ${msg}`);
}

function run(args, env) {
  const hasFidelityIntent = args.some(a => [
    '--no-css-coverage', '--strict-coverage', '--coverage-baseline',
    '--no-token-suggestions', '--strict-tokens', '--no-image-waivers', '--manual-waivers', '--browser',
  ].includes(a));
  const finalArgs = hasFidelityIntent
    ? args
    : [...args, '--no-css-coverage', '--no-token-suggestions', '--no-image-waivers'];
  const proc = spawnSync(process.execPath, [CLI, ...finalArgs], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, env || {}),
  });
  return proc;
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-to-ui-selftest-'));
  try { return fn(dir); } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
}

function main() {
  if (!fs.existsSync(FIXTURE)) fail(`fixture missing: ${FIXTURE}`);

  withTempDir((tmp) => {
    const layout = path.join(tmp, 'out.layout.json');
    const skin = path.join(tmp, 'out.skin.json');

    // 1. base run with preload + perf
    let p = run([
      '--input', FIXTURE,
      '--output', layout,
      '--skin-output', skin,
      '--screen-id', 'self-test',
      '--bundle', 'ui_gacha',
      '--emit-preload-manifest',
      '--emit-performance-report',
    ], { DOM_TO_UI_TELEMETRY: '0' });
    if (p.status !== 0) fail(`base run exit=${p.status}\n${p.stderr}`);
    ok('base run');

    const layoutObj = JSON.parse(fs.readFileSync(layout, 'utf8'));
    const skinObj = JSON.parse(fs.readFileSync(skin, 'utf8'));

    const fragmentRoutesPath = layout.replace(/\.layout\.json$/, '.layout.fragment-routes.json');
    if (!fs.existsSync(fragmentRoutesPath)) fail('fragment route patch sidecar not produced');
    const fragmentRoutes = JSON.parse(fs.readFileSync(fragmentRoutesPath, 'utf8'));
    if (fragmentRoutes.summary.lazySlotCount < 2) fail('fragment route patch did not include lazy slots');
    ok('fragment route patch sidecar includes lazy slots');

    // 2. nesting: must contain a panel containing an image + a label
    const panel = findNode(layoutObj, n => n.type === 'panel');
    if (!panel) fail('expected a panel node from .banner');
    const hasImage = (panel.children || []).some(c => c.type === 'image');
    const hasLabel = (panel.children || []).some(c => c.type === 'label');
    if (!hasImage || !hasLabel) fail('panel must contain image + label children');
    ok('nested children panel→[image,label]');

    // 3. lazy slot preserved + has defaultFragment + warmupHint
    const lazy = collectNodes(layoutObj, n => n.lazySlot === true);
    if (lazy.length < 2) fail(`expected >=2 lazy slots, got ${lazy.length}`);
    for (const l of lazy) {
      if (!l.defaultFragment) fail(`lazy slot ${l.name} missing defaultFragment`);
      if (!l.warmupHint) fail(`lazy slot ${l.name} missing warmupHint`);
    }
    ok('lazy slots with defaultFragment + warmupHint');

    // 4. label-style auto-fill
    const labelNode = findNode(layoutObj, n => n.type === 'label');
    const styleSlot = labelNode && labelNode.styleSlot && skinObj.slots[labelNode.styleSlot];
    if (!styleSlot) fail('label styleSlot missing');
    if (styleSlot.outlineColor !== 'colorOutlineDark') fail(`outlineColor expected colorOutlineDark, got ${styleSlot.outlineColor}`);
    if (styleSlot.outlineWidth !== 2) fail(`outlineWidth expected 2, got ${styleSlot.outlineWidth}`);
    ok('label-style outline auto-fill (UCUF §37.2)');

    // 5. preload manifest split correctness
    const preloadPath = path.join(path.dirname(layout), 'screens', 'out.layout.preload.json');
    const preloadAlt = layout.replace(/\.layout\.json$/, '.layout.preload.json');
    const usedPreload = fs.existsSync(preloadPath) ? preloadPath : preloadAlt;
    if (!fs.existsSync(usedPreload)) fail('preload manifest not produced');
    const preload = JSON.parse(fs.readFileSync(usedPreload, 'utf8'));
    if (!preload.firstScreen || !preload.deferred) fail('preload missing firstScreen/deferred');
    if (!Array.isArray(preload.deferred.lazySlots) || preload.deferred.lazySlots.length < 2) {
      fail(`deferred.lazySlots count = ${preload.deferred.lazySlots && preload.deferred.lazySlots.length}`);
    }
    ok('preload manifest splits firstScreen vs deferred');

    const perfPath = layout.replace(/\.layout\.json$/, '.layout.performance.json');
    if (!fs.existsSync(perfPath)) fail('performance report not produced');
    const perf = JSON.parse(fs.readFileSync(perfPath, 'utf8'));
    if (!perf.runtimeGate || !perf.runtimeGate.nodeCount || !perf.runtimeGate.maxDepth) fail('performance runtimeGate missing nodeCount/maxDepth');
    ok('performance runtimeGate includes nodeCount + maxDepth');

    // 6. --validate runs validate-ui-specs.js
    p = run([
      '--input', FIXTURE,
      '--output', layout,
      '--skin-output', skin,
      '--screen-id', 'self-test',
      '--bundle', 'ui_gacha',
      '--validate',
    ], { DOM_TO_UI_TELEMETRY: '0' });
    if (p.status !== 0) fail(`--validate exit=${p.status}\n${p.stderr}`);
    ok('--validate hooked validate-ui-specs.js (exit 0)');

    // 7. sync-existing preserve-human keeps manual edits
    const layoutBefore = JSON.parse(fs.readFileSync(layout, 'utf8'));
    const targetPanel = findNode(layoutBefore, n => n.type === 'panel');
    targetPanel._humanNote = 'manual';
    const targetImage = findNode(targetPanel, n => n.type === 'image');
    targetImage.width = 12345;
    fs.writeFileSync(layout, JSON.stringify(layoutBefore, null, 2), 'utf8');

    p = run([
      '--input', FIXTURE,
      '--output', layout,
      '--skin-output', skin,
      '--screen-id', 'self-test',
      '--bundle', 'ui_gacha',
      '--sync-existing',
      '--merge-mode', 'preserve-human',
    ], { DOM_TO_UI_TELEMETRY: '0' });
    if (p.status !== 0) fail(`--sync-existing exit=${p.status}\n${p.stderr}`);

    const layoutAfter = JSON.parse(fs.readFileSync(layout, 'utf8'));
    const panelAfter = findNode(layoutAfter, n => n.type === 'panel');
    const imageAfter = findNode(panelAfter, n => n.type === 'image');
    if (panelAfter._humanNote !== 'manual') fail('preserve-human dropped _humanNote');
    if (imageAfter.width !== 12345) fail(`preserve-human dropped width override (got ${imageAfter.width})`);
    ok('--sync-existing preserve-human kept manual edits');

    // 8. dry-run does not write files
    const probeMtime = fs.statSync(layout).mtimeMs;
    p = run([
      '--input', FIXTURE,
      '--output', layout,
      '--skin-output', skin,
      '--screen-id', 'self-test',
      '--bundle', 'ui_gacha',
      '--sync-existing',
      '--merge-mode', 'dry-run',
    ], { DOM_TO_UI_TELEMETRY: '0' });
    if (p.status !== 0) fail(`dry-run exit=${p.status}\n${p.stderr}`);
    const afterMtime = fs.statSync(layout).mtimeMs;
    if (afterMtime !== probeMtime) fail('dry-run modified the layout file');
    ok('--merge-mode dry-run does not write files');

    // 9. M2 art-director guards: token reverse lookup + visual risk warnings
    const artHtml = `
      <style>
        .card {
          display: flex;
          gap: var(--spacing-md);
          padding: 8px 12px;
          background: var(--surface-parchment-base);
          overflow: hidden;
          transform: translateX(4px);
          z-index: 3;
          border-radius: 8px 16px;
          opacity: .8;
          box-shadow: 0 4px 8px rgba(0,0,0,.4);
        }
        .title {
          color: var(--text-primary);
          font-size: 18px;
          line-height: 26px;
          font-weight: 700;
          letter-spacing: .05em;
        }
      </style>
      <div class="card" data-name="ArtCard">
        <span class="title" data-name="ArtTitle">測試標題</span>
        <img data-name="DbSprite" src="db://assets/foo.png" />
        <img data-name="AbsoluteSprite" src="C:\\bad\\asset.png" />
      </div>`;
    const artDraft = buildDraftFromHtml(artHtml, { screenId: 'art-m2', bundle: 'ui_gacha' });
    const artSkin = artDraft.skinDraft;
    const artLayout = artDraft.layoutDraft;
    const artPanel = findNode(artLayout, n => n.name === 'ArtCard');
    const artLabel = findNode(artLayout, n => n.name === 'ArtTitle');
    const artPanelSlot = artPanel && artPanel.skinSlot && artSkin.slots[artPanel.skinSlot];
    const artLabelSlot = artLabel && artLabel.styleSlot && artSkin.slots[artLabel.styleSlot];
    if (!artPanelSlot || artPanelSlot.color !== 'surface.parchment.base') fail(`CSS var color token not mapped: ${artPanelSlot && artPanelSlot.color}`);
    if (!artPanel.layout || artPanel.layout.spacingX !== 12 || artPanel.layout.paddingTop !== 8 || artPanel.layout.paddingLeft !== 12) {
      fail(`spacing / padding mapping failed: ${JSON.stringify(artPanel && artPanel.layout)}`);
    }
    if (!artLabelSlot || artLabelSlot.color !== 'textPrimary') fail(`label CSS var color not mapped: ${artLabelSlot && artLabelSlot.color}`);
    if (!artLabelSlot.isBold) fail('font-weight 700 did not map to isBold');
    if (!artLabelSlot.style) fail('typography scale reverse lookup did not set label-style.style');
    const codes = artDraft.warnings.map(w => w.code);
    for (const code of [
      'asset-path-guarded',
      'css-transform-manual-layout-risk',
      'overflow-hidden-clipping-risk',
      'z-index-manual-zorder-risk',
      'asymmetric-border-radius-approximated',
      'node-opacity-washes-children-risk',
      'css-effect-needs-art-review',
    ]) {
      if (!codes.includes(code)) fail(`expected art warning: ${code}\n${JSON.stringify(artDraft.warnings, null, 2)}`);
    }
    const tokenUsage = artSkin.meta && artSkin.meta.tokenUsageReport;
    if (!tokenUsage || !tokenUsage.spacing.some(t => t.token === 'spacing.md')) fail('spacing token usage report missing spacing.md');
    if (!tokenUsage.typography.some(t => /^typography\./.test(t.token))) fail('typography token usage report missing');
    ok('M2 art token mapping + visual guard warnings');

    // 9b. CSS-hidden overlay must not render active in runtime by default.
    const hiddenHtml = `
      <style>
        .stage { position: relative; width: 100px; height: 100px; }
        .base { background: #222; width: 100px; height: 100px; }
        .overlay { position: absolute; inset: 0; background: #000; display: none; opacity: 0; }
      </style>
      <div class="stage">
        <div class="base" data-name="BasePanel"></div>
        <div class="overlay" data-name="HiddenOverlay"></div>
      </div>`;
    const hiddenDraft = buildDraftFromHtml(hiddenHtml, { screenId: 'hidden-overlay', bundle: 'ui_test' });
    const hiddenOverlay = findNode(hiddenDraft.layoutDraft, n => n.name === 'HiddenOverlay' && n.type === 'panel');
    if (!hiddenOverlay) fail('hidden overlay node missing');
    if (hiddenOverlay.active !== false) fail(`display:none overlay should be active=false, got ${hiddenOverlay.active}`);
    if (hiddenOverlay.opacity !== 0) fail(`opacity:0 should map to node opacity=0, got ${hiddenOverlay.opacity}`);
    if (!hiddenDraft.warnings.some(w => w.code === 'css-hidden-node-default-inactive')) fail('hidden overlay warning missing');
    ok('CSS display:none / opacity hidden overlay maps to inactive runtime node');

    // 9c. CSS unitless line-height is a multiplier, not px. Cocos skin must receive px.
    const lineHeightHtml = `
      <div data-name="LineHeightStage">
        <span data-name="LineHeightOne" style="font-size:32px;line-height:1">將</span>
        <span data-name="LineHeightPercent" style="font-size:20px;line-height:150%">兵</span>
      </div>`;
    const lineHeightDraft = buildDraftFromHtml(lineHeightHtml, { screenId: 'line-height-unitless', bundle: 'ui_test' });
    const lineHeightOne = findNode(lineHeightDraft.layoutDraft, n => n.name === 'LineHeightOne');
    const lineHeightPercent = findNode(lineHeightDraft.layoutDraft, n => n.name === 'LineHeightPercent');
    const lineHeightOneSlot = lineHeightDraft.skinDraft.slots[lineHeightOne.styleSlot];
    const lineHeightPercentSlot = lineHeightDraft.skinDraft.slots[lineHeightPercent.styleSlot];
    if (lineHeightOneSlot.lineHeight !== 32) fail(`unitless line-height:1 should map to 32px, got ${lineHeightOneSlot.lineHeight}`);
    if (lineHeightPercentSlot.lineHeight !== 30) fail(`line-height:150% should map to 30px, got ${lineHeightPercentSlot.lineHeight}`);
    ok('unitless / percent line-height maps to Cocos px lineHeight');

    // 9d. v2 source package: source tokens + colors_and_type.css are explicit converter inputs.
    runSourcePackageV2Step(tmp);

    // 10. variant mode gacha-3pool metadata
    p = run([
      '--input', FIXTURE,
      '--output', layout,
      '--skin-output', skin,
      '--screen-id', 'self-test-variant',
      '--bundle', 'ui_gacha',
      '--variant-mode', 'gacha-3pool',
      '--emit-screen-draft',
    ], { DOM_TO_UI_TELEMETRY: '0' });
    if (p.status !== 0) fail(`variant-mode exit=${p.status}\n${p.stderr}`);
    const variantLayout = JSON.parse(fs.readFileSync(layout, 'utf8'));
    if (!variantLayout.meta || !variantLayout.meta.domToUi || !variantLayout.meta.domToUi.previewVariants.includes('limited')) {
      fail('variant-mode gacha-3pool did not write previewVariants');
    }
    ok('--variant-mode gacha-3pool emits preview variants');

    // 11. M10 interaction + motion sidecars
    const behaviorLayout = path.join(tmp, 'behavior.layout.json');
    const behaviorSkin = path.join(tmp, 'behavior.skin.json');
    p = run([
      '--input', INTERACTION_FIXTURE,
      '--output', behaviorLayout,
      '--skin-output', behaviorSkin,
      '--screen-id', 'interaction-motion',
      '--bundle', 'ui_test',
      '--strict',
    ], { DOM_TO_UI_TELEMETRY: '0' });
    if (p.status !== 0) fail(`interaction/motion strict exit=${p.status}\nstdout=${p.stdout}\nstderr=${p.stderr}`);
    const interactionPath = behaviorLayout.replace(/\.layout\.json$/, '.layout.interaction.json');
    const motionPath = behaviorLayout.replace(/\.layout\.json$/, '.layout.motion.json');
    if (!fs.existsSync(interactionPath) || !fs.existsSync(motionPath)) fail('interaction / motion sidecars missing');
    const interaction = JSON.parse(fs.readFileSync(interactionPath, 'utf8'));
    const motion = JSON.parse(fs.readFileSync(motionPath, 'utf8'));
    if (!interaction.actions.some(a => a.type === 'openPanel' && a.target === 'sample-dialog')) fail('openPanel interaction not translated');
    if (!interaction.actions.some(a => a.type === 'closeModal' && a.target === 'sample-dialog')) fail('closeModal interaction not translated');
    if (motion.summary.motionCount < 1 || !motion.motionTokens.standard) fail('motion draft missing transition/keyframes or motion tokens');
    ok('interaction + motion sidecars translate button open/close and CSS motion');

    // 12. M9 logic guard inventory + verify
    const logicInventory = path.join(tmp, 'behavior.logic-inventory.json');
    const logicVerify = path.join(tmp, 'behavior.logic-guard.json');
    p = spawnSync(process.execPath, [LOGIC_GUARD_CLI,
      '--mode', 'inventory',
      '--screen-id', 'interaction-motion',
      '--layout', behaviorLayout,
      '--output', logicInventory,
    ], { encoding: 'utf8', env: Object.assign({}, process.env, { DOM_TO_UI_TELEMETRY: '0' }) });
    if (p.status !== 0) fail(`logic inventory exit=${p.status}\n${p.stderr}`);
    p = spawnSync(process.execPath, [LOGIC_GUARD_CLI,
      '--mode', 'verify',
      '--screen-id', 'interaction-motion',
      '--layout', behaviorLayout,
      '--baseline', logicInventory,
      '--output', logicVerify,
      '--strict',
    ], { encoding: 'utf8', env: Object.assign({}, process.env, { DOM_TO_UI_TELEMETRY: '0' }) });
    if (p.status !== 0) fail(`logic verify exit=${p.status}\n${p.stderr}`);
    const logicReport = JSON.parse(fs.readFileSync(logicVerify, 'utf8'));
    if (logicReport.verdict !== 'pass') fail(`logic guard verdict=${logicReport.verdict}`);
    ok('logic guard inventory + verify pass');

    // 13. scaffold-ui-component --ucuf end-to-end contract check
    p = spawnSync(process.execPath, [SCAFFOLD_CLI,
      '--screen', 'self-test-screen',
      '--ucuf',
      '--check-ucuf',
      '--dry-run',
      '--no-uiconfig',
      '--out', tmp,
    ], { encoding: 'utf8' });
    if (p.status !== 0) fail(`scaffold --ucuf check exit=${p.status}\nstdout=${p.stdout}\nstderr=${p.stderr}`);
    ok('scaffold-ui-component --ucuf contract check');

    // 14. backup-before-overwrite: second run should create a timestamped backup (§45)
    const backupRoot = path.join(tmp, 'dom-to-ui-backups');
    p = run([
      '--input', FIXTURE,
      '--output', layout,
      '--skin-output', skin,
      '--screen-id', 'self-test-backup',
      '--bundle', 'ui_gacha',
      '--backup-dir', backupRoot,
    ], { DOM_TO_UI_TELEMETRY: '0' });
    if (p.status !== 0) fail(`backup run exit=${p.status}\nstdout=${p.stdout}\nstderr=${p.stderr}`);
    // backup dir should now have a timestamped subdirectory
    if (!fs.existsSync(backupRoot)) fail('backup root dir not created');
    const backupEntries = fs.readdirSync(backupRoot);
    if (backupEntries.length === 0) fail('no backup subdirectory was created');
    const backupSubDir = path.join(backupRoot, backupEntries[0]);
    const backupFiles = fs.readdirSync(backupSubDir);
    if (!backupFiles.some(f => f.endsWith('.layout.json') || f === path.basename(layout))) {
      fail(`backup subdir ${backupSubDir} missing layout backup; found: ${backupFiles.join(', ')}`);
    }
    // verify --no-backup suppresses backup creation
    const backupRoot2 = path.join(tmp, 'dom-to-ui-backups-skip');
    p = run([
      '--input', FIXTURE,
      '--output', layout,
      '--skin-output', skin,
      '--screen-id', 'self-test-backup-skip',
      '--bundle', 'ui_gacha',
      '--no-backup',
      '--backup-dir', backupRoot2,
    ], { DOM_TO_UI_TELEMETRY: '0' });
    if (p.status !== 0) fail(`--no-backup run exit=${p.status}`);
    if (fs.existsSync(backupRoot2)) fail('--no-backup should not create backup dir');
    ok('backup-before-overwrite: timestamped backup created; --no-backup suppresses it');
  });

  // 15. Accuracy harness baseline (§40)
  runAccuracyStep();
  runAdditionalAccuracyBaselines();

  // 16-22. M13-M20 fidelity sidecars and feedback loop (§47-§54)
  runFidelitySteps();

  console.log('\nALL PASS');
}

function runSourcePackageV2Step(tmp) {
  const sourceDir = path.join(tmp, 'v2-source-package');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'ui-design-tokens.json'), JSON.stringify({
    colors: { brandPrimary: '#336699', textPrimary: '#f8f8f8' },
    spacing: { md: 12 },
    typography: { body: { fontSize: 16, lineHeight: 24 } },
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(sourceDir, 'colors_and_type.css'), `
:root { --brand-primary: #336699; --text-primary: #f8f8f8; --spacing-md: 12px; }
html, body { margin: 0; width: 64px; height: 64px; overflow: hidden; background: var(--brand-primary); }
.stage { width: 64px; height: 64px; background: var(--brand-primary); color: var(--text-primary); }
`, 'utf8');
  fs.writeFileSync(path.join(sourceDir, 'index.html'), `<!doctype html>
<html><head><title>v2</title></head><body><div class="stage" data-name="Stage"></div></body></html>
`, 'utf8');

  const pkg = resolveSourcePackage({ sourceDir, mainHtml: 'index.html' });
  if (!pkg.ok) fail(`source package should validate: ${pkg.errors.join(',')}`);
  if (!pkg.tokensPath.endsWith('ui-design-tokens.json')) fail('source package did not resolve source token json');
  if (!pkg.cssPath.endsWith('colors_and_type.css')) fail('source package did not resolve colors_and_type.css');
  const preparedHtml = path.join(tmp, 'v2-source-package.prepared.html');
  writeHtmlWithSourceCss({ htmlPath: pkg.mainHtmlPath, cssPath: pkg.cssPath, outputPath: preparedHtml });
  if (!/data-ucuf-source-css/.test(fs.readFileSync(preparedHtml, 'utf8'))) fail('source CSS was not injected into converter HTML');

  const layout = path.join(tmp, 'v2-source-package.layout.json');
  const skin = path.join(tmp, 'v2-source-package.skin.json');
  const runtimeTokens = path.join(tmp, 'v2-runtime-tokens.json');
  fs.writeFileSync(runtimeTokens, JSON.stringify({ colors: { brandPrimary: '#111111' } }, null, 2), 'utf8');
  let p = run([
    '--input', preparedHtml,
    '--output', layout,
    '--skin-output', skin,
    '--screen-id', 'v2-source-package',
    '--bundle', 'ui_test',
    '--tokens-source', pkg.tokensPath,
    '--tokens-runtime', runtimeTokens,
    '--source-css', pkg.cssPath,
  ], { DOM_TO_UI_TELEMETRY: '0' });
  if (p.status !== 0) fail(`v2 source token dom-to-ui run exit=${p.status}\nstdout=${p.stdout}\nstderr=${p.stderr}`);
  const skinObj = JSON.parse(fs.readFileSync(skin, 'utf8'));
  if (!skinObj.meta || !skinObj.meta.tokenSources || path.resolve(skinObj.meta.tokenSources.sourcePath) !== path.resolve(pkg.tokensPath)) {
    fail('skin meta did not record source token path');
  }
  const hasBrandToken = Object.values(skinObj.slots).some(slot => slot && slot.color === 'brandPrimary');
  if (!hasBrandToken) fail('source token brandPrimary was not used by skin slot');
  const conflicts = skinObj.meta.tokenConflictReport || [];
  if (!conflicts.some(item => item.section === 'colors' && item.token === 'brandPrimary' && item.chosenSource === 'source')) {
    fail('source token conflict report did not record brandPrimary source override');
  }
  ok('v2 source package validates, injects CSS, and maps source tokens');

  const editorBlue = path.join(tmp, 'v2-editor-blue.png');
  const editorRed = path.join(tmp, 'v2-editor-red.png');
  writeSolidPng(editorBlue, 64, 64, [0x33, 0x66, 0x99, 0xff]);
  writeSolidPng(editorRed, 64, 64, [0x99, 0x22, 0x22, 0xff]);
  const compareOut = path.join(tmp, 'html-cocos-compare');
  const evolutionLog = path.join(tmp, 'html_skill_rule-evolution2.md');
  fs.writeFileSync(evolutionLog, '# Evolution v2 Test\n', 'utf8');
  p = spawnSync(process.execPath, [HTML_COCOS_COMPARE_CLI,
    '--source-dir', sourceDir,
    '--main-html', 'index.html',
    '--screen-id', 'v2-source-package',
    '--editor-screenshot', editorBlue,
    '--output', compareOut,
    '--viewport', '64x64',
    '--threshold', '0.99',
    '--evolution-log', evolutionLog,
  ], { encoding: 'utf8' });
  if (p.status !== 0) fail(`html-cocos compare pass exit=${p.status}\nstdout=${p.stdout}\nstderr=${p.stderr}`);
  const verdict = JSON.parse(fs.readFileSync(path.join(compareOut, 'v2-source-package.html-cocos-verdict.json'), 'utf8'));
  if (verdict.runtimeVsSource.verdict !== 'pass' || verdict.runtimeVsSource.score < 0.99) fail(`html-cocos pass verdict invalid: ${JSON.stringify(verdict.runtimeVsSource)}`);

  const compareOutFail = path.join(tmp, 'html-cocos-compare-fail');
  p = spawnSync(process.execPath, [HTML_COCOS_COMPARE_CLI,
    '--source-dir', sourceDir,
    '--main-html', 'index.html',
    '--screen-id', 'v2-source-package-fail',
    '--editor-screenshot', editorRed,
    '--output', compareOutFail,
    '--viewport', '64x64',
    '--threshold', '0.99',
    '--evolution-log', evolutionLog,
  ], { encoding: 'utf8' });
  if (p.status !== 12) fail(`html-cocos compare fail should exit 12, got ${p.status}\nstdout=${p.stdout}\nstderr=${p.stderr}`);
  if (!/html-cocos-runtime-gap/.test(fs.readFileSync(evolutionLog, 'utf8'))) fail('failed html-cocos compare did not append evolution2 candidate');
  ok('HTML source vs Cocos Editor screenshot gate passes, fails, and emits evolution2 candidate');

  const workflowOut = path.join(tmp, 'v2-workflow');
  p = spawnSync(process.execPath, [HTML_TO_UCUF_WORKFLOW_CLI,
    '--source-dir', sourceDir,
    '--main-html', 'index.html',
    '--screen-id', 'v2-workflow',
    '--bundle', 'ui_test',
    '--out-dir', workflowOut,
    '--editor-screenshot', editorBlue,
    '--viewport', '64x64',
    '--skip-compare',
    '--no-validate',
    '--evolution-log', evolutionLog,
  ], { encoding: 'utf8', env: Object.assign({}, process.env, { DOM_TO_UI_TELEMETRY: '0' }) });
  if (p.status !== 0) fail(`v2 workflow source-dir exit=${p.status}\nstdout=${p.stdout}\nstderr=${p.stderr}`);
  const summary = JSON.parse(fs.readFileSync(path.join(workflowOut, 'v2-workflow.workflow-summary.json'), 'utf8'));
  if (!summary.sourcePackage || !summary.verdict.editorVisualPass || !summary.verdict.workflowPass) fail('v2 workflow summary missing sourcePackage/editorVisualPass/workflowPass');
  ok('run-html-to-ucuf-workflow --source-dir wires source package and Editor visual gate');

  const workflowSkipOut = path.join(tmp, 'v2-workflow-skip-editor');
  p = spawnSync(process.execPath, [HTML_TO_UCUF_WORKFLOW_CLI,
    '--source-dir', sourceDir,
    '--main-html', 'index.html',
    '--screen-id', 'v2-workflow-skip-editor',
    '--bundle', 'ui_test',
    '--out-dir', workflowSkipOut,
    '--skip-compare',
    '--skip-editor-compare',
    '--no-validate',
  ], { encoding: 'utf8', env: Object.assign({}, process.env, { DOM_TO_UI_TELEMETRY: '0' }) });
  if (p.status === 0) fail('v2 workflow must not pass when --skip-editor-compare is used');
  const skipSummary = JSON.parse(fs.readFileSync(path.join(workflowSkipOut, 'v2-workflow-skip-editor.workflow-summary.json'), 'utf8'));
  if (skipSummary.verdict.workflowPass || !skipSummary.verdict.remainingIssues.includes('editor-compare-skipped')) {
    fail('v2 workflow skip-editor verdict should fail with editor-compare-skipped');
  }
  ok('run-html-to-ucuf-workflow rejects skipped Editor gate in v2 source package flow');
}

function runFidelitySteps() {
  if (!fs.existsSync(VISUAL_RICH_FIXTURE)) fail(`fixture missing: ${VISUAL_RICH_FIXTURE}`);

  const syntheticSlots = snapshotToSlots({
    'background-image': 'linear-gradient(135deg, rgb(109, 93, 255), rgb(21, 25, 36))',
    'box-shadow': 'rgba(0, 0, 0, 0.45) 0px 8px 24px 0px',
    'border-top-width': '2px',
    'border-right-width': '2px',
    'border-bottom-width': '2px',
    'border-left-width': '2px',
    'border-top-style': 'solid',
    'border-right-style': 'solid',
    'border-bottom-style': 'solid',
    'border-left-style': 'solid',
    'border-top-color': 'rgb(109, 93, 255)',
    'border-right-color': 'rgb(109, 93, 255)',
    'border-bottom-color': 'rgb(109, 93, 255)',
    'border-left-color': 'rgb(109, 93, 255)',
    'border-top-left-radius': '12px',
    'border-top-right-radius': '12px',
    'border-bottom-right-radius': '12px',
    'border-bottom-left-radius': '12px',
    filter: 'brightness(1.05)',
    transform: 'matrix(0.997, -0.069, 0.069, 0.997, 0, 0)',
    'clip-path': 'inset(0px round 12px)',
    opacity: '0.92',
    'mix-blend-mode': 'screen',
    'text-decoration-line': 'underline',
    'text-decoration-color': 'rgb(109, 93, 255)',
    'text-decoration-thickness': '2px',
  }, { slotPrefix: 'rich' });
  for (const kind of ['gradient-rect', 'shadow-set', 'border-style', 'filter-stack', 'transform-stack', 'mask-and-clip', 'opacity-and-blend', 'text-decoration']) {
    if (!syntheticSlots.some(slot => slot.kind === kind)) fail(`M14 slot kind missing: ${kind}`);
  }
  ok('M14 skin slot kind expansion covers gradient/shadow/border/filter/transform/mask/blend/text-decoration');

  withTempDir((tmp) => {
    const layout = path.join(tmp, 'visual-rich.layout.json');
    const skin = path.join(tmp, 'visual-rich.skin.json');
    const manualWaivers = path.join(tmp, 'visual-rich.manual-waivers.json');
    const cssEvolutionLog = path.join(tmp, 'html_skill_rule-evolution2-css.md');
    fs.writeFileSync(cssEvolutionLog, '# Evolution v2 CSS Test\n', 'utf8');
    fs.writeFileSync(manualWaivers, JSON.stringify({
      waivers: [{
        selector: '.stage',
        reason: 'fixture-expected-decorative-image-gap',
        rectInCanvas: { x: 0, y: 0, w: 12, h: 12 },
      }],
    }, null, 2), 'utf8');

    let p = run([
      '--input', VISUAL_RICH_FIXTURE,
      '--output', layout,
      '--skin-output', skin,
      '--screen-id', 'visual-rich',
      '--bundle', 'ui_test',
      '--strict-coverage', '0.1',
      '--strict-tokens', '999',
      '--manual-waivers', manualWaivers,
      '--evolution-log', cssEvolutionLog,
    ], { DOM_TO_UI_TELEMETRY: '0' });
    if (p.status !== 0) fail(`M13/M18/M20 fidelity sidecars exit=${p.status}\nstdout=${p.stdout}\nstderr=${p.stderr}`);

    const coveragePath = layout.replace(/\.json$/, '.css-coverage.json');
    const tokenPath = layout.replace(/\.json$/, '.token-suggestions.json');
    const waiverPath = layout.replace(/\.json$/, '.image-waivers.json');
    for (const file of [coveragePath, tokenPath, waiverPath]) {
      if (!fs.existsSync(file)) fail(`missing fidelity sidecar: ${file}`);
    }
    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const waivers = JSON.parse(fs.readFileSync(waiverPath, 'utf8'));
    if (!(coverage.coveragePercent > 0)) fail(`M13 coveragePercent invalid: ${coverage.coveragePercent}`);
    if (!coverage.cssCapability || !coverage.cssCapability.topOffenders || coverage.cssCapability.topOffenders.length < 1) {
      fail('M4 cssCapability topOffenders missing from css coverage sidecar');
    }
    if (!coverage.cssCapability.assetizeHints || !coverage.cssCapability.assetizeHints.some(item => item.property === 'background-image')) {
      fail('M4 cssCapability assetizeHints missing background-image task hint');
    }
    const offenderProps = new Set(coverage.cssCapability.topOffenders.map(item => item.property));
    if (!offenderProps.has('background-image') || !offenderProps.has('filter')) {
      fail(`M4 cssCapability expected background-image/filter offenders, got ${[...offenderProps].join(',')}`);
    }
    if (!/css-capability-gap/.test(fs.readFileSync(cssEvolutionLog, 'utf8'))) {
      fail('M4 cssCapability did not append evolution2 candidate for unsupported CSS');
    }
    if (!(coverage.pseudoNodes > 0)) fail('M19 pseudo-element capture did not count pseudoNodes');
    const tokenSuggestionCount = ['colorSuggestions', 'fontSuggestions', 'spacingSuggestions']
      .reduce((sum, key) => sum + ((tokens[key] || []).length), 0);
    if (tokenSuggestionCount < 1) fail('M18 token suggestions empty');
    if (!waivers.waivers || !waivers.waivers.some(w => w.manualOverride)) fail('M20 manual image waiver missing');
    if (!waivers.waivers.some(w => /missing-banner/.test(String(w.url)))) fail('M20 missing image URL waiver missing');
    ok('M13/M18/M19/M20 sidecars: coverage, css capability, pseudo capture, token suggestions, image waivers');

    const comparePng = path.join(tmp, 'visual-rich.compare.png');
    p = spawnSync(process.execPath, [COMPARE_CLI,
      '--html', VISUAL_RICH_FIXTURE,
      '--layout', layout,
      '--skin', skin,
      '--output', comparePng,
      '--render-mode', 'high-fidelity',
      '--pixel-diff',
      '--strict-coverage', '0.1',
      '--strict-pixel', '0.1',
      '--save-panels', path.join(tmp, 'compare-panels'),
    ], { encoding: 'utf8', env: Object.assign({}, process.env, { DOM_TO_UI_TELEMETRY: '0' }) });
    if (p.status !== 0) fail(`M15/M16 compare exit=${p.status}\nstdout=${p.stdout}\nstderr=${p.stderr}`);
    const pixelPath = comparePng.replace(/\.png$/i, '.pixel-diff.json');
    if (!fs.existsSync(pixelPath)) fail('M16 pixel-diff sidecar missing');
    const pixel = JSON.parse(fs.readFileSync(pixelPath, 'utf8'));
    if (typeof pixel.adjustedCoverage !== 'number') fail('M16 adjustedCoverage missing');
    ok('M15/M16 high-fidelity renderer + pixel diff strict gate');

    const evolutionLog = path.join(tmp, 'html_skill_rule-evolution.md');
    fs.writeFileSync(evolutionLog, '# Evolution Test Log\n\n', 'utf8');
    p = spawnSync(process.execPath, [FEEDBACK_CLI,
      '--emit-fidelity-suggestions',
      '--coverage', coveragePath,
      '--pixel-diff', pixelPath,
      '--source', VISUAL_RICH_FIXTURE,
      '--log', evolutionLog,
    ], { encoding: 'utf8' });
    if (p.status !== 0) fail(`M17 emit fidelity suggestions exit=${p.status}\nstdout=${p.stdout}\nstderr=${p.stderr}`);
    if (!/fidelity-gap/.test(fs.readFileSync(evolutionLog, 'utf8'))) fail('M17 evolution log did not receive fidelity-gap entry');
    ok('M17 feedback appends fidelity-gap evolution entries');

    const firstSuggestion = (tokens.colorSuggestions || [])[0]
      || (tokens.fontSuggestions || [])[0]
      || (tokens.spacingSuggestions || [])[0];
    if (!firstSuggestion) fail('M18 no suggestion available to accept');
    const tokenRegistry = path.join(tmp, 'accepted-tokens.json');
    p = spawnSync(process.execPath, [FEEDBACK_CLI,
      '--accept-token-suggestion', String(firstSuggestion.value),
      '--token-suggestions', tokenPath,
      '--tokens', tokenRegistry,
      '--value', 'richAccent=#6d5dff',
      '--log', evolutionLog,
    ], { encoding: 'utf8' });
    if (p.status !== 0) fail(`M18 accept token suggestion exit=${p.status}\nstdout=${p.stdout}\nstderr=${p.stderr}`);
    const acceptedTokens = JSON.parse(fs.readFileSync(tokenRegistry, 'utf8'));
    const hasAccepted = Object.values(acceptedTokens).some(bucket => bucket && bucket.richAccent === '#6d5dff');
    if (!hasAccepted) fail('M18 accepted token not written to registry');
    ok('M18 token suggestion acceptance writes token registry and evolution entry');
  });
}

function runAccuracyStep() {
  const { runAccuracy } = require('../lib/dom-to-ui/accuracy-harness');
  const html = fs.readFileSync(FIXTURE, 'utf8');
  const baseline = JSON.parse(fs.readFileSync(
    path.join(REPO_ROOT, 'tests', 'fixtures', 'dom-to-ui', 'gacha-banner.accuracy-baseline.json'),
    'utf8',
  ));
  const result = runAccuracy({
    html,
    iterations: 5,
    baseline,
    opts: { screenId: 'self-test-accuracy', bundle: 'ui_gacha' },
  });
  if (result.idempotencyRate !== 1) fail(`accuracy idempotencyRate=${result.idempotencyRate} (expected 1)`);
  if (result.structuralStability !== 1) fail(`accuracy structuralStability=${result.structuralStability} (expected 1)`);
  if (result.tokenCoverage < 0.5) fail(`accuracy tokenCoverage=${result.tokenCoverage} (<0.5)`);
  ok('accuracy harness: idempotency=1, structuralStability=1, tokenCoverage>=0.5');
}

function runAdditionalAccuracyBaselines() {
  const { runAccuracy } = require('../lib/dom-to-ui/accuracy-harness');
  const cases = [
    ['lobby-action', 'formal-ui'],
    ['general-detail-tabs', 'formal-ui'],
    ['battle-hud', 'formal-ui'],
  ];
  for (const [name, profile] of cases) {
    const html = fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'dom-to-ui', `${name}.html`), 'utf8');
    const baseline = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'tests', 'fixtures', 'dom-to-ui', `${name}.accuracy-baseline.json`),
      'utf8',
    ));
    const result = runAccuracy({
      html,
      iterations: 3,
      baseline,
      opts: { screenId: name, bundle: 'ui_test' },
    });
    if (result.idempotencyRate !== 1) fail(`${name} idempotencyRate=${result.idempotencyRate}`);
    if (result.structuralStability !== 1) fail(`${name} structuralStability=${result.structuralStability}`);
    if (result.tokenCoverage < 0.5) fail(`${name} tokenCoverage=${result.tokenCoverage}`);
    if (!result.visualReview || result.visualReview.metrics.screenshotZoneConfidence < 1) fail(`${name} visual review missing screenshotZoneConfidence`);
  }
  ok('accuracy harness covers lobby, general-detail, battle baselines');
}

function findNode(root, pred) {
  if (!root || typeof root !== 'object') return null;
  if (pred(root)) return root;
  for (const c of root.children || []) {
    const hit = findNode(c, pred);
    if (hit) return hit;
  }
  return null;
}

function collectNodes(root, pred, acc) {
  acc = acc || [];
  if (!root || typeof root !== 'object') return acc;
  if (pred(root)) acc.push(root);
  for (const c of root.children || []) collectNodes(c, pred, acc);
  return acc;
}

function writeSolidPng(filePath, width, height, rgba) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      png.data[idx] = rgba[0];
      png.data[idx + 1] = rgba[1];
      png.data[idx + 2] = rgba[2];
      png.data[idx + 3] = rgba[3];
    }
  }
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e); process.exit(1); }
}
