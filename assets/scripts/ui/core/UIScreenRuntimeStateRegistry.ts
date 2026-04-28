import { services } from '../../core/managers/ServiceLoader';
import { UIContentBinder } from './UIContentBinder';
import type { UIScreenSpec } from './UISpecTypes';
import type { UITemplateBinder } from './UITemplateBinder';
import { applyUIPreviewBinderState } from './UIPreviewStateApplicator';
import { buildGachaPreviewBinderState, resolveGachaPreviewContentState, type GachaPreviewContentFile } from './GachaPreviewStateRoute';

type UIScreenRuntimeStateProvider = 'declarative-content' | 'gacha-preview-state' | 'component-owned';

interface UIScreenRuntimeStateRouteSpec {
    screenId: string;
    screenVersion: number;
    provider: UIScreenRuntimeStateProvider;
    contentSource?: string;
    defaultState?: string;
    variants?: Record<string, string>;
    ownerComponent?: string;
}

interface UIScreenRuntimeStateRegistrySpec {
    version: number;
    routes: UIScreenRuntimeStateRouteSpec[];
}

interface UIScreenRuntimeStateOptions {
    previewVariant?: string;
    tags?: string[];
}

type UIScreenSpecWithContent = UIScreenSpec & {
    content?: {
        source?: string;
        state?: string;
    };
};

export interface UIScreenRuntimeStateApplyResult {
    applied: boolean;
    screenId: string;
    provider: UIScreenRuntimeStateProvider | 'none';
    stateKey?: string;
    reason?: string;
}

let registryCache: UIScreenRuntimeStateRegistrySpec | null = null;
const contentBinder = new UIContentBinder();

export async function applyUIScreenRuntimeState(
    binder: UITemplateBinder,
    screenId: string,
    options: UIScreenRuntimeStateOptions = {},
): Promise<UIScreenRuntimeStateApplyResult> {
    const screen = await services().specLoader.loadScreen(screenId) as UIScreenSpecWithContent;
    const route = await getUIScreenRuntimeStateRoute(screenId);

    if (route) {
        assertRouteMatchesScreen(screen, route);
        if (route.provider === 'component-owned') {
            return {
                applied: false,
                screenId,
                provider: route.provider,
                reason: `owned by ${route.ownerComponent || 'component'}`,
            };
        }
    }

    if (!screen.content?.source || !screen.contentRequirements) {
        return { applied: false, screenId, provider: route?.provider ?? 'none', reason: 'screen has no declarative content' };
    }

    const resolved = await loadUIScreenContentState(screen, route, options);
    const schema = await contentBinder.preloadSchema(screen.contentRequirements);
    const bindingState = filterStateForContentSchema(resolved.state, screen.contentRequirements.requiredFields, schema);
    contentBinder.bindWithSchema(binder, screen.contentRequirements, schema, bindingState, {
        suppressUnresolvedWarnings: true,
    });

    if (route?.provider === 'gacha-preview-state') {
        applyUIPreviewBinderState(binder, buildGachaPreviewBinderState(resolved.state));
    }

    return {
        applied: true,
        screenId,
        provider: route?.provider ?? 'declarative-content',
        stateKey: resolved.stateKey,
    };
}

function filterStateForContentSchema(
    state: Record<string, unknown>,
    requiredFields: string[],
    schema: { fields?: Record<string, unknown> } | null,
): Record<string, unknown> {
    const allowed = new Set<string>(requiredFields);
    for (const key of Object.keys(schema?.fields ?? {})) {
        allowed.add(key);
    }

    const filtered: Record<string, unknown> = {};
    for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(state, key)) {
            filtered[key] = state[key];
        }
    }
    return filtered;
}

export async function getUIScreenRuntimeStateRoute(screenId: string): Promise<UIScreenRuntimeStateRouteSpec | null> {
    const registry = await loadRuntimeStateRegistry();
    return registry.routes.find((route) => route.screenId === screenId) ?? null;
}

async function loadRuntimeStateRegistry(): Promise<UIScreenRuntimeStateRegistrySpec> {
    if (registryCache) {
        return registryCache;
    }

    registryCache = await services().resource.loadJson<UIScreenRuntimeStateRegistrySpec>(
        'ui-spec/runtime-state-registry',
        { tags: ['UISpecRuntimeState'] },
    );
    return registryCache;
}

async function loadUIScreenContentState(
    screen: UIScreenSpecWithContent,
    route: UIScreenRuntimeStateRouteSpec | null,
    options: UIScreenRuntimeStateOptions,
): Promise<{ stateKey: string; state: Record<string, unknown> }> {
    const contentSource = route?.contentSource ?? screen.content?.source;
    if (!contentSource) {
        throw new Error(`[UIScreenRuntimeStateRegistry] ${screen.id} 缺少 content.source，無法套用 runtime state`);
    }

    const content = await services().resource.loadJson<any>(
        `ui-spec/content/${contentSource}`,
        { tags: options.tags ?? ['UIScreenRuntimeState'] },
    );

    const defaultState = route?.defaultState
        ?? screen.content?.state
        ?? (typeof content?.defaultState === 'string' ? content.defaultState : 'default');
    const stateKey = resolveScreenStateKey(content, route, defaultState, options.previewVariant);
    const state = content?.states?.[stateKey] ?? content?.states?.[defaultState] ?? null;

    if (state && typeof state === 'object' && !Array.isArray(state)) {
        return { stateKey, state };
    }

    throw new Error(
        `[UIScreenRuntimeStateRegistry] ${screen.id} 找不到 content state ` +
        `source=${contentSource} state=${stateKey}`,
    );
}

function resolveScreenStateKey(
    content: unknown,
    route: UIScreenRuntimeStateRouteSpec | null,
    defaultState: string,
    previewVariant = '',
): string {
    const requested = previewVariant.trim().toLowerCase();
    if (route?.provider === 'gacha-preview-state') {
        return resolveGachaPreviewContentState(content as GachaPreviewContentFile, requested)
            ? (route.variants?.[requested] ?? (requested || defaultState))
            : defaultState;
    }
    if (requested && route?.variants?.[requested]) {
        return route.variants[requested];
    }
    if (requested) {
        return requested;
    }
    return defaultState;
}

function assertRouteMatchesScreen(screen: UIScreenSpec, route: UIScreenRuntimeStateRouteSpec): void {
    if (screen.version !== route.screenVersion) {
        throw new Error(
            `[UIScreenRuntimeStateRegistry] ${route.screenId} version mismatch: ` +
            `screen=${screen.version}, registry=${route.screenVersion}`,
        );
    }

    if (route.contentSource && screen.content?.source !== route.contentSource) {
        throw new Error(
            `[UIScreenRuntimeStateRegistry] ${route.screenId} content source mismatch: ` +
            `screen=${screen.content?.source ?? 'none'}, registry=${route.contentSource}`,
        );
    }
}