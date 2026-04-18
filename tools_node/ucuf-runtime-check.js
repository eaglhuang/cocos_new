#!/usr/bin/env node
/**
 * ucuf-runtime-check.js
 *
 * Runtime-like checks for UCUF screens that can run in plain Node.js.
 * This tool is intended as a pre-submit gate for screen-level integrity.
 *
 * Usage:
 *   node tools_node/ucuf-runtime-check.js --screen <screen-id>
 *   node tools_node/ucuf-runtime-check.js --changed
 *   node tools_node/ucuf-runtime-check.js --screen <screen-id> --strict --json
 *
 * Notes:
 * - This is a static approximation of runtime rules and does not require Cocos preview.
 * - If both --screen and --changed are omitted, all screens are checked.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const UI_SPEC_ROOT = path.join(PROJECT_ROOT, 'assets/resources/ui-spec');
const SCREENS_DIR = path.join(UI_SPEC_ROOT, 'screens');
const LAYOUTS_DIR = path.join(UI_SPEC_ROOT, 'layouts');
const SKINS_DIR = path.join(UI_SPEC_ROOT, 'skins');
const FRAGMENTS_DIR = path.join(UI_SPEC_ROOT, 'fragments');

function parseArgs(argv) {
    const args = {
        screen: '',
        changed: false,
        strict: false,
        json: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--screen' && argv[i + 1]) {
            args.screen = String(argv[i + 1]).trim();
            i++;
        } else if (token === '--changed') {
            args.changed = true;
        } else if (token === '--strict') {
            args.strict = true;
        } else if (token === '--json') {
            args.json = true;
        }
    }

    return args;
}

function listJsonFiles(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const out = [];
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.json')) {
                out.push(fullPath);
            }
        }
    }

    return out;
}

function readJsonSafe(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

function toPosix(p) {
    return p.replace(/\\/g, '/');
}

function relToSpec(filePath) {
    return toPosix(path.relative(UI_SPEC_ROOT, filePath));
}

function buildLayoutsIndex() {
    const files = listJsonFiles(LAYOUTS_DIR);
    const byId = new Map();

    for (const filePath of files) {
        const json = readJsonSafe(filePath);
        if (!json) {
            continue;
        }

        const baseName = path.basename(filePath, '.json');
        const layoutId = json.id || json.layoutId || baseName;
        const rel = relToSpec(filePath);

        byId.set(layoutId, { filePath, rel, json });
        byId.set(baseName, { filePath, rel, json });
        byId.set(rel, { filePath, rel, json });
        byId.set(rel.replace(/^layouts\//, '').replace(/\.json$/, ''), { filePath, rel, json });
    }

    return byId;
}

function buildSkinsIndex() {
    const files = listJsonFiles(SKINS_DIR);
    const byId = new Map();

    for (const filePath of files) {
        const json = readJsonSafe(filePath);
        if (!json) {
            continue;
        }

        const baseName = path.basename(filePath, '.json');
        const skinId = json.id || json.skinId || baseName;
        const rel = relToSpec(filePath);

        byId.set(skinId, { filePath, rel, json });
        byId.set(baseName, { filePath, rel, json });
        byId.set(rel, { filePath, rel, json });
        byId.set(rel.replace(/^skins\//, '').replace(/\.json$/, ''), { filePath, rel, json });
    }

    return byId;
}

function loadScreens() {
    const files = listJsonFiles(SCREENS_DIR);
    return files
        .map((filePath) => {
            const json = readJsonSafe(filePath);
            if (!json) {
                return null;
            }
            const screenId = json.id || json.screenId || path.basename(filePath, '.json');
            return {
                filePath,
                rel: relToSpec(filePath),
                screenId,
                json,
            };
        })
        .filter(Boolean);
}

function runGitLines(args) {
    const result = spawnSync('git', args, {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        shell: false,
    });

    if ((result.status ?? 1) !== 0) {
        return [];
    }

    return String(result.stdout || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(toPosix);
}

function collectChangedScreenIds(allScreens) {
    const changed = new Set([
        ...runGitLines(['diff', '--name-only', '--diff-filter=ACMR']),
        ...runGitLines(['diff', '--cached', '--name-only', '--diff-filter=ACMR']),
        ...runGitLines(['ls-files', '--others', '--exclude-standard']),
    ]);

    const screenFiles = [...changed]
        .filter((p) => p.startsWith('assets/resources/ui-spec/screens/') && p.endsWith('.json'));

    const byPath = new Map(allScreens.map((s) => [toPosix(path.relative(PROJECT_ROOT, s.filePath)), s]));
    const ids = new Set();

    for (const relPath of screenFiles) {
        const screen = byPath.get(relPath);
        if (screen) {
            ids.add(screen.screenId);
        }
    }

    return [...ids];
}

function walkNodes(root, visitor) {
    if (!root || typeof root !== 'object') {
        return;
    }
    visitor(root);
    const children = Array.isArray(root.children) ? root.children : [];
    for (const child of children) {
        walkNodes(child, visitor);
    }
}

function normalizeWidgetHash(widget) {
    if (!widget || typeof widget !== 'object') {
        return '';
    }

    const keys = Object.keys(widget).sort();
    const normalized = {};
    for (const k of keys) {
        normalized[k] = widget[k];
    }

    return JSON.stringify(normalized);
}

function normalizeSlotResourceKey(value) {
    if (!value || typeof value !== 'object') {
        return '';
    }

    if (value.path || value.spriteFramePath || value.src) {
        return String(value.path || value.spriteFramePath || value.src);
    }

    if (value.frame) {
        return String(value.frame);
    }

    if (value.frames && typeof value.frames === 'object') {
        const normalizedFrames = {};
        for (const key of Object.keys(value.frames).sort()) {
            normalizedFrames[key] = value.frames[key];
        }
        return JSON.stringify(normalizedFrames);
    }

    if (value.normal || value.pressed || value.disabled) {
        return JSON.stringify({
            normal: value.normal || '',
            pressed: value.pressed || '',
            disabled: value.disabled || '',
        });
    }

    return String(value.kind || '[object-slot]');
}

function extractSkinSlots(skinJson) {
    const out = [];

    const append = (slotId, slotPath) => {
        if (!slotId) {
            return;
        }
        out.push({ slotId: String(slotId), path: slotPath === undefined || slotPath === null ? '' : String(slotPath) });
    };

    const arrayCandidates = [];
    if (Array.isArray(skinJson.slots)) arrayCandidates.push(...skinJson.slots);
    if (Array.isArray(skinJson.skinSlots)) arrayCandidates.push(...skinJson.skinSlots);
    if (Array.isArray(skinJson.skinLayers)) arrayCandidates.push(...skinJson.skinLayers);

    for (const slot of arrayCandidates) {
        append(slot.slotId || slot.id, normalizeSlotResourceKey(slot));
    }

    const objectCandidates = [];
    if (skinJson.slots && typeof skinJson.slots === 'object' && !Array.isArray(skinJson.slots)) {
        objectCandidates.push(skinJson.slots);
    }
    if (skinJson.skinSlots && typeof skinJson.skinSlots === 'object' && !Array.isArray(skinJson.skinSlots)) {
        objectCandidates.push(skinJson.skinSlots);
    }

    for (const obj of objectCandidates) {
        for (const [slotId, value] of Object.entries(obj)) {
            if (value && typeof value === 'object') {
                append(slotId, normalizeSlotResourceKey(value));
            }
        }
    }

    return out;
}

function collectResolvedSkinSlots(skinEntry, indexes, visited = new Set()) {
    const resolved = new Map();

    if (!skinEntry || !skinEntry.json) {
        return resolved;
    }

    const skinKey = skinEntry.rel || skinEntry.filePath || skinEntry.json.id || '';
    if (skinKey && visited.has(skinKey)) {
        return resolved;
    }
    if (skinKey) {
        visited.add(skinKey);
    }

    const themeStack = skinEntry.json.themeStack && typeof skinEntry.json.themeStack === 'object'
        ? skinEntry.json.themeStack
        : null;

    if (themeStack) {
        for (const inheritedRef of Object.values(themeStack)) {
            if (!inheritedRef || typeof inheritedRef !== 'string') {
                continue;
            }

            const inheritedEntry = indexes.skins.get(String(inheritedRef));
            if (!inheritedEntry) {
                continue;
            }

            const inheritedSlots = collectResolvedSkinSlots(inheritedEntry, indexes, visited);
            for (const [slotId, slotPath] of inheritedSlots.entries()) {
                resolved.set(slotId, slotPath);
            }
        }
    }

    for (const pair of extractSkinSlots(skinEntry.json)) {
        resolved.set(pair.slotId, pair.path);
    }

    if (skinKey) {
        visited.delete(skinKey);
    }

    return resolved;
}

function resolveFragmentPath(fragmentId) {
    if (!fragmentId || typeof fragmentId !== 'string') {
        return null;
    }

    const raw = fragmentId.trim();
    if (!raw) {
        return null;
    }

    const withExt = raw.endsWith('.json') ? raw : `${raw}.json`;

    const candidates = [
        path.join(LAYOUTS_DIR, withExt),
        path.join(FRAGMENTS_DIR, withExt),
        path.join(FRAGMENTS_DIR, 'layouts', withExt),
        path.join(FRAGMENTS_DIR, 'widgets', withExt),
        path.join(UI_SPEC_ROOT, withExt),
    ];

    if (raw.includes('/')) {
        candidates.push(path.join(UI_SPEC_ROOT, withExt));
    }

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    return null;
}

function pushViolation(arr, ruleId, severity, screenId, message, source) {
    arr.push({
        ruleId,
        severity,
        screenId,
        message,
        source,
    });
}

function collectLayoutSignals(layoutJson) {
    const skinSlots = [];
    const lazySlotNames = new Set();
    const duplicateWidgetSiblings = [];

    const layoutRoot = layoutJson && typeof layoutJson === 'object' && layoutJson.root
        ? layoutJson.root
        : layoutJson;

    walkNodes(layoutRoot, (node) => {
        if (!node || typeof node !== 'object') {
            return;
        }

        if (node.skinSlot) {
            skinSlots.push(String(node.skinSlot));
        }

        if (Array.isArray(node.skinLayers)) {
            for (const layer of node.skinLayers) {
                if (layer && layer.slotId) {
                    skinSlots.push(String(layer.slotId));
                }
            }
        }

        if (node.lazySlot === true && node.name) {
            lazySlotNames.add(String(node.name));
        }

        const children = Array.isArray(node.children) ? node.children : [];
        if (children.length < 2) {
            return;
        }

        const byWidget = new Map();
        for (const child of children) {
            if (!child || typeof child !== 'object' || !child.widget) {
                continue;
            }
            const hash = normalizeWidgetHash(child.widget);
            if (!hash) {
                continue;
            }
            const list = byWidget.get(hash) || [];
            list.push(String(child.name || '?'));
            byWidget.set(hash, list);
        }

        for (const names of byWidget.values()) {
            if (names.length >= 2) {
                duplicateWidgetSiblings.push(names);
            }
        }
    });

    return { skinSlots, lazySlotNames, duplicateWidgetSiblings };
}

function checkScreen(screen, indexes) {
    const violations = [];
    const screenId = screen.screenId;
    const s = screen.json || {};

    // Composite screens (type:'composite' with panels[]) and multi-screen grouping files
    // (screens[] with sub-screen definitions) do not carry their own layout/skin — skip
    // layout checks entirely to avoid false RT-03 errors.
    const isCompositeScreen = s.type === 'composite' || Array.isArray(s.panels);
    const isMultiScreenFile = Array.isArray(s.screens);
    if (isCompositeScreen || isMultiScreenFile) {
        return violations;
    }

    const layoutRef = s.layoutId || s.layout || s.layoutRef;
    const skinRef = s.skinId || s.skin || s.skinRef;

    const layoutEntry = layoutRef ? indexes.layouts.get(layoutRef) : null;
    const skinEntry = skinRef ? indexes.skins.get(skinRef) : null;

    const childPanels = Array.isArray(s.childPanels) ? s.childPanels : [];

    // RT-02: duplicate dataSource within one screen.
    const seenDataSource = new Set();
    const dupes = new Set();
    for (const cp of childPanels) {
        const ds = cp && cp.dataSource ? String(cp.dataSource) : '';
        if (!ds) {
            continue;
        }
        if (seenDataSource.has(ds)) {
            dupes.add(ds);
        }
        seenDataSource.add(ds);
    }
    if (dupes.size > 0) {
        pushViolation(
            violations,
            'RT-02',
            'error',
            screenId,
            `Duplicate dataSource in childPanels: ${[...dupes].join(', ')}`,
            screen.rel,
        );
    }

    // RT-07: required child panel fields.
    for (let i = 0; i < childPanels.length; i++) {
        const cp = childPanels[i] || {};
        const missing = [];
        if (!cp.name) missing.push('name');
        if (!cp.type && !cp.childType) missing.push('type/childType');
        if (!cp.dataSource) missing.push('dataSource');
        if (missing.length > 0) {
            pushViolation(
                violations,
                'RT-07',
                'error',
                screenId,
                `childPanels[${i}] missing required fields: ${missing.join(', ')}`,
                screen.rel,
            );
        }
    }

    if (!layoutEntry) {
        pushViolation(
            violations,
            'RT-03',
            'error',
            screenId,
            `Layout not found for layout reference: ${String(layoutRef || '(empty)')}`,
            screen.rel,
        );
        return violations;
    }

    const layoutSignals = collectLayoutSignals(layoutEntry.json);

    // RT-05: duplicate widget siblings.
    for (const names of layoutSignals.duplicateWidgetSiblings) {
        pushViolation(
            violations,
            'RT-05',
            'warning',
            screenId,
            `Sibling nodes share identical widget config: [${names.join(', ')}]`,
            layoutEntry.rel,
        );
    }

    // RT-03 and RT-10: skin slot checks.
    if (!skinEntry) {
        if (layoutSignals.skinSlots.length > 0) {
            pushViolation(
                violations,
                'RT-03',
                'error',
                screenId,
                `Skin not found for skin reference: ${String(skinRef || '(empty)')}`,
                screen.rel,
            );
        }
    } else {
        const pairs = extractSkinSlots(skinEntry.json);
        const resolvedSlots = collectResolvedSkinSlots(skinEntry, indexes);
        const knownSlots = new Set(resolvedSlots.keys());

        for (const slotId of layoutSignals.skinSlots) {
            if (!knownSlots.has(slotId)) {
                pushViolation(
                    violations,
                    'RT-03',
                    'error',
                    screenId,
                    `Layout references missing skin slot "${slotId}"`,
                    `${layoutEntry.rel} -> ${skinEntry.rel}`,
                );
            }
        }

        const slotToPath = new Map();
        for (const pair of pairs) {
            const existing = slotToPath.get(pair.slotId);
            if (existing !== undefined && existing !== pair.path) {
                pushViolation(
                    violations,
                    'RT-10',
                    'error',
                    screenId,
                    `Skin slot "${pair.slotId}" maps to conflicting paths: "${existing}" vs "${pair.path}"`,
                    skinEntry.rel,
                );
            } else {
                slotToPath.set(pair.slotId, pair.path);
            }
        }
    }

    // RT-08: tab routing integrity.
    const tabRouting = s.tabRouting && typeof s.tabRouting === 'object' ? s.tabRouting : {};
    for (const [tabKey, route] of Object.entries(tabRouting)) {
        if (!route || typeof route !== 'object') {
            pushViolation(
                violations,
                'RT-08',
                'error',
                screenId,
                `tabRouting.${tabKey} is not an object`,
                screen.rel,
            );
            continue;
        }

        const slotId = route.slotId ? String(route.slotId) : '';
        const fragment = route.fragment ? String(route.fragment) : '';

        if (!slotId || !layoutSignals.lazySlotNames.has(slotId)) {
            pushViolation(
                violations,
                'RT-08',
                'error',
                screenId,
                `tabRouting.${tabKey}.slotId "${slotId || '(empty)'}" not found in layout lazySlot nodes`,
                `${screen.rel} -> ${layoutEntry.rel}`,
            );
        }

        if (!fragment || !resolveFragmentPath(fragment)) {
            pushViolation(
                violations,
                'RT-08',
                'error',
                screenId,
                `tabRouting.${tabKey}.fragment "${fragment || '(empty)'}" does not resolve to a JSON file`,
                screen.rel,
            );
        }
    }

    return violations;
}

function selectTargetScreens(args, allScreens) {
    if (args.screen) {
        const picked = allScreens.filter((s) => s.screenId === args.screen);
        return {
            screens: picked,
            notes: picked.length === 0 ? [`screen not found: ${args.screen}`] : [],
        };
    }

    if (args.changed) {
        const changedIds = collectChangedScreenIds(allScreens);
        const picked = allScreens.filter((s) => changedIds.includes(s.screenId));
        return {
            screens: picked,
            notes: picked.length === 0 ? ['no changed screens detected'] : [],
        };
    }

    return { screens: allScreens, notes: [] };
}

function formatViolations(violations) {
    const errors = violations.filter((v) => v.severity === 'error');
    const warnings = violations.filter((v) => v.severity === 'warning');
    return { errors, warnings };
}

function printHuman(result) {
    console.log('[ucuf-runtime-check] UCUF runtime-like checks (static)');
    console.log(`[ucuf-runtime-check] Checked screens: ${result.checkedScreens}`);

    if (result.notes.length > 0) {
        for (const note of result.notes) {
            console.log(`[ucuf-runtime-check] note: ${note}`);
        }
    }

    if (result.violations.length === 0) {
        console.log('[ucuf-runtime-check] OK — no violations');
        return;
    }

    for (const v of result.violations) {
        const level = v.severity === 'error' ? 'ERROR' : 'WARN';
        console.log(`  [${level}] ${v.ruleId} ${v.screenId} — ${v.message} (${v.source})`);
    }

    console.log(
        `[ucuf-runtime-check] Result: ${result.errors.length} errors, ${result.warnings.length} warnings`,
    );
}

function main() {
    const args = parseArgs(process.argv.slice(2));

    const allScreens = loadScreens();
    const indexes = {
        layouts: buildLayoutsIndex(),
        skins: buildSkinsIndex(),
    };

    const selected = selectTargetScreens(args, allScreens);
    const violations = [];

    for (const screen of selected.screens) {
        violations.push(...checkScreen(screen, indexes));
    }

    const split = formatViolations(violations);
    const passed = split.errors.length === 0;

    const result = {
        passed,
        mode: 'static',
        checkedScreens: selected.screens.length,
        notes: selected.notes,
        violations,
        errors: split.errors,
        warnings: split.warnings,
    };

    if (args.json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        printHuman(result);
    }

    if (args.strict && !passed) {
        process.exit(1);
    }
}

main();
