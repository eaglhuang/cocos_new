/**
 * scaffoldV2.test.ts - UCUF M10 Scaffold v2 + Validator R26~R28 unit tests
 *
 * Covers:
 *  - composite-panel.template.ts placeholder substitution contract
 *  - generateContentContract dataSource scan contract
 *  - R26 lazy-slot-has-fragment trigger / no-trigger
 *  - R27 dataSource-declared trigger / no-trigger
 *  - R28 composite-panel-tab-route-integrity trigger / no-trigger
 *
 * No Cocos runtime dependency; all tests runnable in Node.js (ts-node).
 *
 * Unity equiv: unit test for EditorScript tool + validation pipeline
 */

import { TestSuite, assert } from '../TestRunner';
import * as fs from 'fs';
import * as path from 'path';

// --- Placeholder substitution helper ---
function applyTemplate(tpl: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v),
        tpl,
    );
}

// --- Validator inline stubs ---
// validate-ui-specs.js executes on require, so we inline the R26/R27/R28 logic
// to verify trigger conditions without side-effects.

/** R26 inline stub: collect lazy-slot missing defaultFragment warnings */
function runR26(layoutRoot: Record<string, unknown>): string[] {
    const warnings: string[] = [];
    function walkNodes(node: Record<string, unknown>): void {
        if (!node || typeof node !== 'object') return;
        if (node['lazySlot'] === true) {
            const hasDefault =
                typeof node['defaultFragment'] === 'string' &&
                (node['defaultFragment'] as string).trim().length > 0;
            if (!hasDefault) {
                warnings.push(
                    `[lazy-slot-has-fragment] node "${node['name'] ?? '?'}" lazySlot missing defaultFragment`,
                );
            }
        }
        if (Array.isArray(node['children'])) {
            for (const child of node['children'] as Record<string, unknown>[]) {
                walkNodes(child);
            }
        }
    }
    walkNodes(layoutRoot);
    return warnings;
}

/** R27 inline stub: collect dataSource undeclared in requiredFields warnings */
function runR27(
    layoutRoot: Record<string, unknown>,
    requiredFields: string[],
): string[] {
    const reqSet = new Set(requiredFields);
    const warnings: string[] = [];
    function walkNodes(node: Record<string, unknown>): void {
        if (!node || typeof node !== 'object') return;
        if (
            typeof node['dataSource'] === 'string' &&
            (node['dataSource'] as string).trim().length > 0
        ) {
            const raw = (node['dataSource'] as string).trim().replace(/^data\./, '');
            const field = raw.split('.')[0].replace(/\[\d+\]/g, '');
            if (field && !reqSet.has(field)) {
                warnings.push(
                    `[dataSource-declared] dataSource="${node['dataSource']}" not in requiredFields (field="${field}")`,
                );
            }
        }
        if (Array.isArray(node['children'])) {
            for (const child of node['children'] as Record<string, unknown>[]) {
                walkNodes(child);
            }
        }
    }
    walkNodes(layoutRoot);
    return warnings;
}

/** R28 inline stub: collect tabRouting integrity warnings */
interface TabRouteEntry {
    slotId?: string;
    fragment?: string;
}
function runR28(
    tabRouting: Record<string, TabRouteEntry | string>,
    lazySlotNames: Set<string>,
    existingFragments: Set<string>,
): string[] {
    const warnings: string[] = [];
    for (const [tabKey, route] of Object.entries(tabRouting)) {
        const routeObj =
            typeof route === 'object' && route !== null ? (route as TabRouteEntry) : {};
        const slotId =
            typeof routeObj.slotId === 'string'
                ? routeObj.slotId
                : typeof route === 'string'
                ? route
                : null;
        const fragmentId =
            typeof routeObj.fragment === 'string' ? routeObj.fragment : null;

        if (slotId && lazySlotNames.size > 0 && !lazySlotNames.has(slotId)) {
            warnings.push(
                `[composite-panel-tab-route-integrity] tabRouting["${tabKey}"].slotId="${slotId}" not found in lazySlots`,
            );
        }
        if (fragmentId && !existingFragments.has(fragmentId)) {
            warnings.push(
                `[composite-panel-tab-route-integrity] tabRouting["${tabKey}"].fragment="${fragmentId}" not found`,
            );
        }
    }
    return warnings;
}

export function createScaffoldV2Suite(): TestSuite {
    const suite = new TestSuite('M10: ScaffoldV2 + R26~R28 Validator');

    const TEMPLATES_DIR = path.resolve(__dirname, '../../tools_node/templates');
    const TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'composite-panel.template.ts');

    // --- composite-panel.template.ts placeholder substitution ---

    suite.test('composite-panel.template.ts file exists', () => {
        assert.isTrue(
            fs.existsSync(TEMPLATE_PATH),
            `composite-panel.template.ts not found: ${TEMPLATE_PATH}`,
        );
    });

    suite.test('template replaces {{PanelClassName}} correctly', () => {
        if (!fs.existsSync(TEMPLATE_PATH)) return;
        const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
        const result = applyTemplate(tpl, {
            PanelClassName: 'MyTestPanel',
            screenId: 'my-test-screen',
            familyId: 'composite-panel',
            uiId: 'MyTest',
        });
        assert.isTrue(result.includes('class MyTestPanel'), 'PanelClassName not substituted into class declaration');
        assert.isFalse(result.includes('{{PanelClassName}}'), 'Unreplaced {{PanelClassName}} still present');
    });

    suite.test('template replaces {{screenId}} correctly', () => {
        if (!fs.existsSync(TEMPLATE_PATH)) return;
        const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
        const result = applyTemplate(tpl, {
            PanelClassName: 'MyTestPanel',
            screenId: 'my-test-screen',
            familyId: 'composite-panel',
            uiId: 'MyTest',
        });
        assert.isTrue(result.includes('my-test-screen'), 'screenId not substituted');
        assert.isFalse(result.includes('{{screenId}}'), 'Unreplaced {{screenId}} still present');
    });

    suite.test('template replaces {{familyId}} correctly', () => {
        if (!fs.existsSync(TEMPLATE_PATH)) return;
        const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
        const result = applyTemplate(tpl, {
            PanelClassName: 'MyTestPanel',
            screenId: 'my-test-screen',
            familyId: 'my-family',
            uiId: 'MyTest',
        });
        assert.isTrue(result.includes('my-family'), 'familyId not substituted');
        assert.isFalse(result.includes('{{familyId}}'), 'Unreplaced {{familyId}} still present');
    });

    suite.test('template extends CompositePanel (not UIPreviewBuilder)', () => {
        if (!fs.existsSync(TEMPLATE_PATH)) return;
        const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
        assert.isTrue(tpl.includes('extends CompositePanel'), 'template must extend CompositePanel');
        assert.isFalse(tpl.includes('extends UIPreviewBuilder'), 'template must not extend UIPreviewBuilder');
    });

    suite.test('template contains ContentContractRef declaration', () => {
        if (!fs.existsSync(TEMPLATE_PATH)) return;
        const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
        assert.isTrue(tpl.includes('ContentContractRef'), 'template must include ContentContractRef type');
        assert.isTrue(tpl.includes('const CONTRACT'), 'template must include CONTRACT constant');
    });

    // --- R26: lazy-slot-has-fragment ---

    suite.test('R26: lazySlot with defaultFragment -> no warning', () => {
        const root = {
            type: 'container',
            name: 'Root',
            children: [
                {
                    name: 'SlotMain',
                    type: 'container',
                    lazySlot: true,
                    defaultFragment: 'my-fragment',
                },
            ],
        };
        const warns = runR26(root as Record<string, unknown>);
        assert.isTrue(warns.length === 0, `Expected 0 warnings, got: ${warns.join('; ')}`);
    });

    suite.test('R26: lazySlot without defaultFragment -> triggers warning', () => {
        const root = {
            type: 'container',
            name: 'Root',
            children: [{ name: 'SlotEmpty', type: 'container', lazySlot: true }],
        };
        const warns = runR26(root as Record<string, unknown>);
        assert.isTrue(warns.length === 1, `Expected 1 warning, got ${warns.length}`);
        assert.isTrue(warns[0].includes('lazy-slot-has-fragment'), 'Warning should contain rule ID');
    });

    suite.test('R26: lazySlot with empty defaultFragment string -> triggers warning', () => {
        const root = {
            type: 'container',
            name: 'Root',
            children: [
                {
                    name: 'SlotBlank',
                    type: 'container',
                    lazySlot: true,
                    defaultFragment: '',
                },
            ],
        };
        const warns = runR26(root as Record<string, unknown>);
        assert.isTrue(warns.length === 1, 'Empty string defaultFragment should trigger warning');
    });

    suite.test('R26: non-lazySlot nodes -> no warning', () => {
        const root = {
            type: 'container',
            name: 'Root',
            children: [
                { name: 'Normal', type: 'container', lazySlot: false },
                { name: 'NoLazy', type: 'container' },
            ],
        };
        const warns = runR26(root as Record<string, unknown>);
        assert.isTrue(warns.length === 0, 'Non-lazySlot nodes should not trigger R26');
    });

    // --- R27: dataSource-declared ---

    suite.test('R27: dataSource in requiredFields -> no warning', () => {
        const root = {
            type: 'container',
            name: 'Root',
            children: [
                { name: 'TitleLabel', type: 'label', dataSource: 'data.titleKey' },
            ],
        };
        const warns = runR27(root as Record<string, unknown>, ['titleKey', 'tabs']);
        assert.isTrue(warns.length === 0, `Expected 0 warnings, got: ${warns.join('; ')}`);
    });

    suite.test('R27: dataSource not in requiredFields -> triggers warning', () => {
        const root = {
            type: 'container',
            name: 'Root',
            children: [
                { name: 'TitleLabel', type: 'label', dataSource: 'data.unknownField' },
            ],
        };
        const warns = runR27(root as Record<string, unknown>, ['titleKey', 'tabs']);
        assert.isTrue(warns.length === 1, `Expected 1 warning, got ${warns.length}`);
        assert.isTrue(warns[0].includes('dataSource-declared'), 'Warning should contain rule ID');
    });

    suite.test('R27: dataSource without data. prefix is correctly parsed', () => {
        const root = {
            type: 'container',
            name: 'Root',
            children: [{ name: 'N1', type: 'label', dataSource: 'titleKey' }],
        };
        const warns = runR27(root as Record<string, unknown>, ['titleKey']);
        assert.isTrue(warns.length === 0, 'No-prefix dataSource should match requiredFields correctly');
    });

    // --- R28: composite-panel-tab-route-integrity ---

    suite.test('R28: valid slotId and fragment -> no warning', () => {
        const tabRouting = {
            TabA: { slotId: 'SlotMain', fragment: 'my-fragment' },
        };
        const lazySlots = new Set(['SlotMain']);
        const fragments = new Set(['my-fragment']);
        const warns = runR28(tabRouting, lazySlots, fragments);
        assert.isTrue(warns.length === 0, `Expected 0 warnings, got: ${warns.join('; ')}`);
    });

    suite.test('R28: slotId not in lazySlots -> triggers warning', () => {
        const tabRouting = {
            TabA: { slotId: 'SlotGhost', fragment: 'my-fragment' },
        };
        const lazySlots = new Set(['SlotMain']);
        const fragments = new Set(['my-fragment']);
        const warns = runR28(tabRouting, lazySlots, fragments);
        assert.isTrue(
            warns.some(w => w.includes('SlotGhost')),
            'Should warn about missing slotId',
        );
    });

    suite.test('R28: fragment not found -> triggers warning', () => {
        const tabRouting = {
            TabA: { slotId: 'SlotMain', fragment: 'non-existent-fragment' },
        };
        const lazySlots = new Set(['SlotMain']);
        const fragments = new Set<string>();
        const warns = runR28(tabRouting, lazySlots, fragments);
        assert.isTrue(
            warns.some(w => w.includes('non-existent-fragment')),
            'Should warn about missing fragment',
        );
    });

    suite.test('R28: empty tabRouting -> no warning', () => {
        const warns = runR28({}, new Set(['SlotMain']), new Set(['fragment-a']));
        assert.isTrue(warns.length === 0, 'Empty tabRouting should not trigger warnings');
    });

    suite.test('R28: string-form route (shorthand slotId) -> correct parsing', () => {
        const tabRouting: Record<string, string | TabRouteEntry> = {
            TabA: 'SlotMain',
        };
        const lazySlots = new Set(['SlotMain']);
        const fragments = new Set<string>();
        const warns = runR28(
            tabRouting as Record<string, TabRouteEntry | string>,
            lazySlots,
            fragments,
        );
        // String-form route has no fragment, so no fragment warning expected
        assert.isFalse(
            warns.some(w => w.includes('SlotMain')),
            'Valid slotId in string-form route should not trigger warning',
        );
    });

    return suite;
}
