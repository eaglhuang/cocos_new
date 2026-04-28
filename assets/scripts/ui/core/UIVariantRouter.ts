// doc_id: doc_other_0009 — UCUF Variant Router (M31)
//
// Purpose:
//   Centralize "which screenId should this CompositePanel mount" decisions.
//   Replaces ad-hoc `_resolveScreenId()` helpers scattered across composites.
//
// Resolution order (first match wins):
//   1. globalThis[__UCUF_<NAME>_VARIANT]                    (runtime override)
//   2. window.location.search ?ui=<variant>                 (preview URL)
//   3. window.localStorage[__ucuf_<name>_variant]           (dev sticky toggle)
//   4. registered defaults from registerRoute()             (build-time config)
//   5. fallback string passed to resolve()                  (hard default)
//
// Variants map to screenIds via routes registered at boot, e.g.:
//   UIVariantRouter.registerRoute('general-detail', {
//     default:  'general-detail-unified-screen',
//     variants: { ds3: 'character-ds3-main' },
//   });
//   const screenId = UIVariantRouter.resolve('general-detail');
//
// Sidecars produced by `tools_node/register-ucuf-runtime-route.js` can be
// loaded at boot via UIVariantRouter.loadFromManifest().

interface VariantRouteSpec {
    /** screenId returned when no variant is selected. */
    default: string;
    /** variant key -> screenId map. */
    variants?: Record<string, string>;
    /** Read variant from URL `?ui=` query (default true). */
    queryEnabled?: boolean;
    /** localStorage key suffix; default uses panelKey. */
    localStorageKey?: string;
    /** globalThis flag; default `__UCUF_<UPPER_PANEL_KEY>_VARIANT`. */
    globalFlagKey?: string;
}

interface RuntimeRouteSidecar {
    screenId: string;
    panelKey: string;
    mountTarget?: string;
    componentClass?: string;
    featureFlag?: string | null;
    fallbackScreen?: string | null;
    paramSchema?: unknown;
    variants?: Record<string, string>;
}

const ROUTES: Record<string, VariantRouteSpec> = {};

function safeGetGlobal(key: string): string | null {
    try {
        const g = globalThis as unknown as Record<string, unknown>;
        const v = g[key];
        return typeof v === 'string' ? v : null;
    } catch { return null; }
}

function safeGetQuery(_panelKey: string): string | null {
    try {
        const w = (globalThis as unknown as { window?: Window }).window;
        if (!w?.location?.search) return null;
        const m = w.location.search.match(/[?&]ui=([^&]+)/);
        return m ? decodeURIComponent(m[1]) : null;
    } catch { return null; }
}

function safeGetLocalStorage(key: string): string | null {
    try {
        const w = (globalThis as unknown as { window?: Window }).window;
        const ls = w?.localStorage;
        if (!ls) return null;
        return ls.getItem(key);
    } catch { return null; }
}

function defaultGlobalFlagKey(panelKey: string): string {
    const upper = panelKey.replace(/[-/]/g, '_').toUpperCase();
    return `__UCUF_${upper}_VARIANT`;
}

function defaultLocalStorageKey(panelKey: string): string {
    return `__ucuf_${panelKey.replace(/[-/]/g, '_')}_variant`;
}

export const UIVariantRouter = {
    registerRoute(panelKey: string, spec: VariantRouteSpec): void {
        ROUTES[panelKey] = spec;
    },

    /**
     * Apply runtime-route.json sidecars produced by
     * `tools_node/register-ucuf-runtime-route.js`. The manifest is an array
     * of sidecar objects; variants map merges with any registerRoute() spec.
     */
    loadFromManifest(manifest: RuntimeRouteSidecar[]): void {
        for (const entry of manifest) {
            const existing = ROUTES[entry.panelKey];
            const spec: VariantRouteSpec = existing
                ? { ...existing, variants: { ...(existing.variants || {}), ...(entry.variants || {}) } }
                : { default: entry.fallbackScreen || entry.screenId, variants: entry.variants };
            ROUTES[entry.panelKey] = spec;
        }
    },

    resolve(panelKey: string, hardDefault?: string): string {
        const spec = ROUTES[panelKey];
        const variants = spec?.variants || {};
        const def = hardDefault || spec?.default;

        const globalKey = spec?.globalFlagKey || defaultGlobalFlagKey(panelKey);
        const lsKey = spec?.localStorageKey || defaultLocalStorageKey(panelKey);

        const fromGlobal = safeGetGlobal(globalKey);
        if (fromGlobal && variants[fromGlobal]) return variants[fromGlobal];

        const queryEnabled = spec?.queryEnabled !== false;
        if (queryEnabled) {
            const fromQuery = safeGetQuery(panelKey);
            if (fromQuery && variants[fromQuery]) return variants[fromQuery];
        }

        const fromLs = safeGetLocalStorage(lsKey);
        if (fromLs && variants[fromLs]) return variants[fromLs];

        if (def) return def;
        throw new Error(`[UIVariantRouter] no default screenId registered for "${panelKey}"`);
    },

    /** Test helper: clear all registered routes. */
    _resetForTests(): void {
        for (const k of Object.keys(ROUTES)) delete ROUTES[k];
    },
};

export type { VariantRouteSpec, RuntimeRouteSidecar };
