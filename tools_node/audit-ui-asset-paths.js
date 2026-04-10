#!/usr/bin/env node
/**
 * audit-ui-asset-paths.js  —  通用 UI 資產路徑審計腳本
 *
 * 任意 screen 都可跑。只要指定 --screen 和 --official-path，
 * 就能列出所有 sprite 路徑、分類、檢查存在性，並標記非正式資產。
 *
 * Usage:
 *   # 基本：掃描指定 screen
 *   node tools_node/audit-ui-asset-paths.js --screen general-detail-bloodline-v3-screen
 *
 *   # 指定正式素材路徑（可多個，逗號分隔）
 *   node tools_node/audit-ui-asset-paths.js --screen general-detail-bloodline-v3-screen \
 *       --official-path sprites/ui_families/general_detail/v3_final
 *
 *   # 掃描所有 screen
 *   node tools_node/audit-ui-asset-paths.js --all
 *
 *   # 盤點正式目錄（找 orphan / duplicate / untracked）
 *   node tools_node/audit-ui-asset-paths.js --check-inventory \
 *       --official-path sprites/ui_families/general_detail/v3_final
 *
 *   # JSON 機器可讀輸出
 *   node tools_node/audit-ui-asset-paths.js --screen ... --json
 *
 *   # 詳細模式
 *   node tools_node/audit-ui-asset-paths.js --screen ... --verbose
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ─── CLI ───
const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
        const key = args[i].slice(2);
        flags[key] = (i + 1 < args.length && !args[i + 1].startsWith('--')) ? args[++i] : true;
    }
}

const ROOT = path.resolve(__dirname, '..');
const RESOURCES = path.join(ROOT, 'assets', 'resources');
const SCRIPTS = path.join(ROOT, 'assets', 'scripts');
const JSON_OUTPUT = !!flags.json;
const VERBOSE = !!flags.verbose;
const CHECK_ALL = !!flags.all;
const CHECK_INVENTORY = !!flags['check-inventory'];

// official-path 可以是逗號分隔多個
const officialPaths = flags['official-path']
    ? flags['official-path'].split(',').map(p => p.trim())
    : [];

// ─── Helpers ───
const RED = '\x1b[31m', YELLOW = '\x1b[33m', GREEN = '\x1b[32m';
const CYAN = '\x1b[36m', DIM = '\x1b[2m', RESET = '\x1b[0m';

function loadJson(relPath) {
    const full = path.join(RESOURCES, relPath + '.json');
    if (!fs.existsSync(full)) return null;
    return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function assetExists(spritePath) {
    const base = path.join(RESOURCES, spritePath);
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
        if (fs.existsSync(base + ext)) return true;
    }
    return false;
}

function isOfficial(spritePath) {
    if (officialPaths.length === 0) return false;
    return officialPaths.some(op => spritePath.includes(op));
}

function classify(spritePath) {
    if (isOfficial(spritePath)) return 'OFFICIAL';
    if (spritePath.includes('/common/')) return 'COMMON';
    if (spritePath.includes('/generals/')) return 'PORTRAIT';
    if (/\/(proof|draft|test|temp)\//i.test(spritePath)) return 'PROOF_LEGACY';
    return 'OTHER';
}

// ─── Collector ───
function createCollector() {
    const findings = [];
    return {
        add(source, sourceDetail, slot, spritePath) {
            const exists = assetExists(spritePath);
            const cls = classify(spritePath);
            findings.push({ source, sourceDetail, slot, path: spritePath, exists, class: cls });
        },
        get findings() { return findings; },
    };
}

// ─── Phase: Scan Skin JSON ───
function scanSkin(skinId, collector) {
    const skin = loadJson(`ui-spec/skins/${skinId}`);
    if (!skin || !skin.slots) return;
    for (const [slotName, slotDef] of Object.entries(skin.slots)) {
        if (slotDef.path) collector.add('skin', skinId, slotName, slotDef.path);
    }
}

// ─── Phase: Scan Content States ───
function scanContent(contentSource, collector) {
    const data = loadJson(`ui-spec/content/${contentSource}`);
    if (!data || !data.states) return;
    for (const [stateName, state] of Object.entries(data.states)) {
        for (const [key, value] of Object.entries(state)) {
            if (typeof value === 'string' && value.startsWith('sprites/')) {
                collector.add('content-state', `${contentSource}/${stateName}`, key, value);
            }
        }
    }
}

// ─── Phase: Scan TS files for sprite paths ───
function scanTsDir(dir, collector, filterFamily) {
    if (!fs.existsSync(dir)) return;
    const walk = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            if (entry.isDirectory()) walk(path.join(d, entry.name));
            else if (entry.name.endsWith('.ts')) {
                const full = path.join(d, entry.name);
                const src = fs.readFileSync(full, 'utf8');
                const re = /['"`](sprites\/[^'"`\n]+)['"`]/g;
                let m;
                while ((m = re.exec(src)) !== null) {
                    const sp = m[1];
                    if (sp.includes('${')) continue;
                    if (filterFamily && !sp.includes(filterFamily) && !sp.includes('/common/')) continue;
                    const lineNum = src.substring(0, m.index).split('\n').length;
                    const relTs = path.relative(path.join(ROOT, 'assets'), full).replace(/\\/g, '/');
                    collector.add('ts-code', `${relTs}:${lineNum}`, 'static', sp);
                }
            }
        }
    };
    walk(dir);
}

// ─── Deduplicate ───
function dedup(findings) {
    const seen = new Set();
    return findings.filter(f => {
        const key = `${f.source}|${f.slot}|${f.path}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ─── Screen audit ───
function auditScreen(screenId) {
    const screen = loadJson(`ui-spec/screens/${screenId}`);
    if (!screen) {
        if (!JSON_OUTPUT) console.error(`${RED}❌ Screen not found: ${screenId}${RESET}`);
        return null;
    }

    const collector = createCollector();

    // 1. Skin
    if (screen.skin) scanSkin(screen.skin, collector);

    // 2. Content
    if (screen.content && screen.content.source) {
        scanContent(screen.content.source, collector);
    }

    // 3. TS code — infer family from official paths or skin id
    let family = null;
    if (officialPaths.length > 0) {
        // e.g. sprites/ui_families/general_detail/v3_final → "general_detail"
        const parts = officialPaths[0].split('/').filter(Boolean);
        family = parts.length >= 2 ? parts[parts.length - 2] : null;
    }
    if (!family && screen.skin) {
        // e.g. general-detail-bloodline-v3-default → try first 2 segments
        family = screen.skin.replace(/-default$/, '').split('-').slice(0, 2).join('_');
    }
    scanTsDir(path.join(SCRIPTS, 'ui'), collector, family);

    const unique = dedup(collector.findings);
    unique.sort((a, b) => {
        const order = { PROOF_LEGACY: 0, OTHER: 1, PORTRAIT: 2, COMMON: 3, OFFICIAL: 4 };
        return (order[a.class] ?? 2) - (order[b.class] ?? 2) || a.path.localeCompare(b.path);
    });

    return { screenId, skin: screen.skin, content: screen.content, findings: unique };
}

// ═══════════════ INVENTORY CHECK ═══════════════

function checkInventory(officialPath) {
    const absDir = path.join(RESOURCES, officialPath);
    if (!fs.existsSync(absDir)) {
        console.error(`${RED}❌ Directory not found: ${officialPath}${RESET}`);
        return null;
    }

    const pngs = fs.readdirSync(absDir).filter(f => f.endsWith('.png'));
    const inventory = [];

    // git tracked check
    let trackedSet = new Set();
    try {
        const gitFiles = execSync('git ls-files --full-name', { cwd: ROOT, encoding: 'utf8' });
        trackedSet = new Set(gitFiles.split('\n').map(l => l.trim()));
    } catch (_) { /* git not available */ }

    // hashes for all files in the dir
    const localHashes = new Map(); // hash → [filename]
    for (const png of pngs) {
        const buf = fs.readFileSync(path.join(absDir, png));
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        if (!localHashes.has(hash)) localHashes.set(hash, []);
        localHashes.get(hash).push(png);
    }

    // scan sibling directories for external duplicates
    const parentDir = path.dirname(absDir);
    const extHashes = new Map(); // hash → [relPath]
    const walkForHashes = (dir, prefix) => {
        if (dir === absDir) return;
        try {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.isDirectory()) walkForHashes(path.join(dir, entry.name), `${prefix}${entry.name}/`);
                else if (entry.name.endsWith('.png')) {
                    const buf = fs.readFileSync(path.join(dir, entry.name));
                    const hash = crypto.createHash('sha256').update(buf).digest('hex');
                    if (!extHashes.has(hash)) extHashes.set(hash, []);
                    extHashes.get(hash).push(`${prefix}${entry.name}`);
                }
            }
        } catch (_) { /* skip unreadable dirs */ }
    };
    walkForHashes(parentDir, '');

    for (const png of pngs) {
        const relGit = `assets/resources/${officialPath}/${png}`.replace(/\\/g, '/');
        const buf = fs.readFileSync(path.join(absDir, png));
        const hash = crypto.createHash('sha256').update(buf).digest('hex');

        const tracked = trackedSet.has(relGit);
        const internalDupes = (localHashes.get(hash) || []).filter(f => f !== png);
        const externalDupes = extHashes.get(hash) || [];

        let status = 'OK';
        const issues = [];

        if (externalDupes.length > 0) {
            status = 'DUPLICATE';
            issues.push(`same as: ${externalDupes.join(', ')}`);
        }
        if (!tracked && status === 'OK') {
            status = 'UNTRACKED';
            issues.push('not in git');
        }
        if (!tracked && status === 'DUPLICATE') {
            issues.push('not in git');
        }
        if (internalDupes.length > 0) {
            issues.push(`internal dup: ${internalDupes.join(', ')}`);
        }

        inventory.push({ file: png, size: buf.length, hash: hash.substring(0, 12), tracked, status, issues });
    }

    return { officialPath, total: pngs.length, inventory };
}

// ═══════════════ OUTPUT ═══════════════

function printScreenReport(result) {
    if (!result) return null;
    const { screenId, findings } = result;

    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║  UI Asset Path Audit — Screen: ${screenId}`);
    if (officialPaths.length > 0)
        console.log(`║  Official: ${officialPaths.join(', ')}`);
    console.log(`╚══════════════════════════════════════════════════════════╝\n`);

    const groups = [
        [`${RED}🔴 PROOF/LEGACY${RESET}`, findings.filter(f => f.class === 'PROOF_LEGACY')],
        [`${YELLOW}🟠 OTHER (review needed)${RESET}`, findings.filter(f => f.class === 'OTHER')],
        [`${CYAN}🔵 PORTRAIT${RESET}`, findings.filter(f => f.class === 'PORTRAIT')],
        [`${DIM}⚪ COMMON${RESET}`, findings.filter(f => f.class === 'COMMON')],
        [`${GREEN}🟢 OFFICIAL${RESET}`, findings.filter(f => f.class === 'OFFICIAL')],
    ];

    let actionRequired = 0;
    for (const [label, items] of groups) {
        if (items.length === 0) continue;
        console.log(`── ${label} (${items.length}) ──`);
        for (const f of items) {
            const existsTag = f.exists ? '' : ` ${RED}[MISSING]${RESET}`;
            console.log(`  ${f.path}${existsTag}`);
            if (VERBOSE) console.log(`    └─ source=${f.source}  slot=${f.slot}  detail=${f.sourceDetail}`);
            if (f.class === 'PROOF_LEGACY' || !f.exists) actionRequired++;
        }
        console.log('');
    }

    const missing = findings.filter(f => !f.exists);
    if (missing.length > 0) {
        console.log(`${RED}⚠  ${missing.length} MISSING assets:${RESET}`);
        missing.forEach(f => console.log(`  ${RED}✗ ${f.path}${RESET}  (${f.source}→${f.slot})`));
        console.log('');
    }

    const stats = {
        total: findings.length,
        official: findings.filter(f => f.class === 'OFFICIAL').length,
        common: findings.filter(f => f.class === 'COMMON').length,
        portrait: findings.filter(f => f.class === 'PORTRAIT').length,
        proofLegacy: findings.filter(f => f.class === 'PROOF_LEGACY').length,
        other: findings.filter(f => f.class === 'OTHER').length,
        missing: missing.length,
        actionRequired,
    };

    console.log('═══════════════════ SUMMARY ═══════════════════');
    console.log(`  Total:          ${stats.total}`);
    console.log(`  ${GREEN}Official:       ${stats.official}${RESET}`);
    console.log(`  Common:         ${stats.common}`);
    console.log(`  Portrait:       ${stats.portrait}`);
    console.log(`  ${RED}Proof/Legacy:   ${stats.proofLegacy}${RESET}`);
    console.log(`  ${YELLOW}Other:          ${stats.other}${RESET}`);
    console.log(`  ${RED}Missing:        ${stats.missing}${RESET}`);
    console.log(`  ${actionRequired > 0 ? RED : GREEN}Action needed:  ${actionRequired}${RESET}`);
    console.log('═══════════════════════════════════════════════\n');

    return stats;
}

function printInventoryReport(inv) {
    if (!inv) return null;
    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║  Inventory Check — ${inv.officialPath}`);
    console.log(`║  Total files: ${inv.total}`);
    console.log(`╚══════════════════════════════════════════════════════════╝\n`);

    const ok = inv.inventory.filter(i => i.status === 'OK');
    const dupes = inv.inventory.filter(i => i.status === 'DUPLICATE');
    const untracked = inv.inventory.filter(i => i.status === 'UNTRACKED');

    if (dupes.length > 0) {
        console.log(`${RED}── DUPLICATE (copied from elsewhere) ──${RESET}`);
        dupes.forEach(i => console.log(`  ${RED}⚠ ${i.file}${RESET} (${i.size}B) ${i.issues.join(' | ')}`));
        console.log('');
    }

    if (untracked.length > 0) {
        console.log(`${YELLOW}── UNTRACKED (not in git, unique — possibly AI-generated) ──${RESET}`);
        untracked.forEach(i => console.log(`  ${YELLOW}? ${i.file}${RESET} (${i.size}B) ${i.issues.join(' | ')}`));
        console.log('');
    }

    if (ok.length > 0) {
        console.log(`${GREEN}── OK (tracked + unique) ──${RESET}`);
        ok.forEach(i => {
            const note = i.issues.length > 0 ? ` ${DIM}${i.issues.join(' | ')}${RESET}` : '';
            console.log(`  ${GREEN}✓ ${i.file}${RESET} (${i.size}B)${note}`);
        });
        console.log('');
    }

    console.log('═══════════════════ INVENTORY SUMMARY ═══════════════════');
    console.log(`  ${GREEN}OK:          ${ok.length}${RESET}`);
    console.log(`  ${YELLOW}Untracked:   ${untracked.length}${RESET}`);
    console.log(`  ${RED}Duplicate:   ${dupes.length}${RESET}`);
    console.log('═════════════════════════════════════════════════════════\n');

    return inv;
}

// ═══════════════ MAIN ═══════════════

if (CHECK_INVENTORY) {
    if (officialPaths.length === 0) {
        console.error(`${RED}❌ --check-inventory requires --official-path${RESET}`);
        process.exit(1);
    }
    const results = officialPaths.map(op => {
        const inv = checkInventory(op);
        if (JSON_OUTPUT) { console.log(JSON.stringify(inv, null, 2)); return inv; }
        return printInventoryReport(inv);
    });
    const hasDupes = results.some(r => r && r.inventory && r.inventory.some(i => i.status === 'DUPLICATE'));
    process.exit(hasDupes ? 1 : 0);

} else if (CHECK_ALL) {
    const screensDir = path.join(RESOURCES, 'ui-spec', 'screens');
    const screens = fs.readdirSync(screensDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    let totalAction = 0;

    if (JSON_OUTPUT) {
        const allResults = screens.map(s => auditScreen(s)).filter(Boolean);
        console.log(JSON.stringify(allResults, null, 2));
    } else {
        for (const s of screens) {
            const result = auditScreen(s);
            if (result) {
                const stats = printScreenReport(result);
                if (stats) totalAction += stats.actionRequired;
            }
        }
        console.log(`\n${'═'.repeat(50)}`);
        console.log(`  ALL SCREENS — Total action items: ${totalAction}`);
        console.log(`${'═'.repeat(50)}\n`);
    }
    process.exit(totalAction > 0 ? 1 : 0);

} else {
    const screenId = flags.screen;
    if (!screenId) {
        console.error('Usage:');
        console.error('  --screen <id> [--official-path <path>] [--json] [--verbose]');
        console.error('  --all [--official-path <path>]');
        console.error('  --check-inventory --official-path <path>');
        process.exit(1);
    }

    const result = auditScreen(screenId);
    if (!result) process.exit(1);

    if (JSON_OUTPUT) {
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.findings.some(f => !f.exists || f.class === 'PROOF_LEGACY') ? 1 : 0);
    }

    const stats = printScreenReport(result);
    process.exit(stats && stats.actionRequired > 0 ? 1 : 0);
}
