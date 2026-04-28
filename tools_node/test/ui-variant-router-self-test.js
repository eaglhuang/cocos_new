// Self-test for UIVariantRouter (M31).
// Pure JS port of the resolve logic — verifies the same precedence rules.
// Run: node tools_node/test/ui-variant-router-self-test.js

'use strict';

const ROUTES = {};

function defaultGlobalFlagKey(panelKey) {
  return '__UCUF_' + panelKey.replace(/[-/]/g, '_').toUpperCase() + '_VARIANT';
}
function defaultLocalStorageKey(panelKey) {
  return '__ucuf_' + panelKey.replace(/[-/]/g, '_') + '_variant';
}
function safeGetGlobal(key) {
  const v = globalThis[key];
  return typeof v === 'string' ? v : null;
}
function safeGetQuery() { return null; } // no window in node
function safeGetLocalStorage() { return null; }

const UIVariantRouter = {
  registerRoute(panelKey, spec) { ROUTES[panelKey] = spec; },
  loadFromManifest(manifest) {
    for (const e of manifest) {
      const existing = ROUTES[e.panelKey];
      ROUTES[e.panelKey] = existing
        ? Object.assign({}, existing, { variants: Object.assign({}, existing.variants || {}, e.variants || {}) })
        : { default: e.fallbackScreen || e.screenId, variants: e.variants };
    }
  },
  resolve(panelKey, hardDefault) {
    const spec = ROUTES[panelKey];
    const variants = (spec && spec.variants) || {};
    const def = hardDefault || (spec && spec.default);
    const globalKey = (spec && spec.globalFlagKey) || defaultGlobalFlagKey(panelKey);
    const lsKey = (spec && spec.localStorageKey) || defaultLocalStorageKey(panelKey);
    const fromGlobal = safeGetGlobal(globalKey);
    if (fromGlobal && variants[fromGlobal]) return variants[fromGlobal];
    if (!spec || spec.queryEnabled !== false) {
      const fromQuery = safeGetQuery();
      if (fromQuery && variants[fromQuery]) return variants[fromQuery];
    }
    const fromLs = safeGetLocalStorage(lsKey);
    if (fromLs && variants[fromLs]) return variants[fromLs];
    if (def) return def;
    throw new Error('no default for ' + panelKey);
  },
  _resetForTests() { for (const k of Object.keys(ROUTES)) delete ROUTES[k]; },
};

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log('[PASS]', msg); pass++; }
  else { console.error('[FAIL]', msg); fail++; }
}

UIVariantRouter._resetForTests();
UIVariantRouter.registerRoute('general-detail', {
  default: 'general-detail-unified-screen',
  variants: { unified: 'general-detail-unified-screen', ds3: 'character-ds3-main' },
});

delete globalThis.__UCUF_GENERAL_DETAIL_VARIANT;
assert(UIVariantRouter.resolve('general-detail') === 'general-detail-unified-screen', 'no flag → unified default');

globalThis.__UCUF_GENERAL_DETAIL_VARIANT = 'ds3';
assert(UIVariantRouter.resolve('general-detail') === 'character-ds3-main', 'globalThis ds3 → character-ds3-main');

globalThis.__UCUF_GENERAL_DETAIL_VARIANT = 'unified';
assert(UIVariantRouter.resolve('general-detail') === 'general-detail-unified-screen', 'globalThis unified → unified');

globalThis.__UCUF_GENERAL_DETAIL_VARIANT = 'nonexistent';
assert(UIVariantRouter.resolve('general-detail') === 'general-detail-unified-screen', 'unknown variant → unified default');

UIVariantRouter._resetForTests();
UIVariantRouter.loadFromManifest([{
  screenId: 'general-detail-unified-screen',
  panelKey: 'general-detail',
  componentClass: 'GeneralDetailComposite',
  featureFlag: 'ds3',
  fallbackScreen: 'general-detail-unified-screen',
  variants: { unified: 'general-detail-unified-screen', ds3: 'character-ds3-main' },
}]);
delete globalThis.__UCUF_GENERAL_DETAIL_VARIANT;
assert(UIVariantRouter.resolve('general-detail') === 'general-detail-unified-screen', 'manifest unified default works');
globalThis.__UCUF_GENERAL_DETAIL_VARIANT = 'ds3';
assert(UIVariantRouter.resolve('general-detail') === 'character-ds3-main', 'manifest ds3 works');
globalThis.__UCUF_GENERAL_DETAIL_VARIANT = 'unified';
assert(UIVariantRouter.resolve('general-detail') === 'general-detail-unified-screen', 'manifest unified override works');

UIVariantRouter._resetForTests();
delete globalThis.__UCUF_GENERAL_DETAIL_VARIANT;
assert(UIVariantRouter.resolve('unknown-panel', 'fallback-screen') === 'fallback-screen', 'hardDefault works without spec');

console.log('\n[' + (fail ? 'FAIL' : 'ALL PASS') + '] ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
