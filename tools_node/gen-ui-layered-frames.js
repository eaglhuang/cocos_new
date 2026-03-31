#!/usr/bin/env node
// tools_node/gen-ui-layered-frames.js
// Minimal implementation of the Layer-aware frame generator (scan + group + report)
// Usage examples:
//  node tools_node/gen-ui-layered-frames.js -ReportPath artifacts/ui-layered-frames/report.json

const fs = require('fs').promises;
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_SKINS_DIR = path.join(__dirname, '..', 'assets', 'resources', 'ui-spec', 'skins');
const RENDER_SCRIPT = path.join(__dirname, '..', 'tools', 'gen-ui-layered-frames.ps1');

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {};
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        switch (a) {
            case '-SkinPath':
                opts.skinPath = args[++i];
                break;
            case '-FamilyFilter':
                opts.familyFilter = args[++i];
                break;
            case '-RecipeFilter':
                opts.recipeFilter = args[++i];
                break;
            case '-Apply':
                opts.apply = true;
                break;
            case '-Preview':
                opts.preview = true;
                break;
            case '-RefreshCocos':
                opts.refreshCocos = true;
                break;
            case '-ReportPath':
                opts.reportPath = args[++i];
                break;
            case '-FailOnMissingMeta':
                opts.failOnMissingMeta = true;
                break;
            default:
                console.warn('Unknown arg:', a);
        }
    }
    return opts;
}

async function listJsonFiles(dir) {
    try {
        const names = await fs.readdir(dir);
        return names.filter(n => n.endsWith('.json')).map(n => path.join(dir, n));
    } catch (e) {
        return [];
    }
}

async function readJson(filePath) {
    try {
        const txt = await fs.readFile(filePath, 'utf8');
        return JSON.parse(txt);
    } catch (e) {
        console.error('Failed to read/parse JSON:', filePath, e.message);
        return null;
    }
}

function isIntArray(arr) {
    if (!Array.isArray(arr) || arr.length !== 4) return false;
    return arr.every(n => Number.isInteger(n));
}

function detectFamilyFromName(slotName) {
    const roles = new Set(['frame', 'bleed', 'fill', 'accent']);
    const idx = slotName.lastIndexOf('.');
    if (idx === -1) return null;
    const roleCandidate = slotName.slice(idx + 1);
    if (roles.has(roleCandidate)) {
        return { family: slotName.slice(0, idx), role: roleCandidate };
    }
    return null;
}

async function main() {
    const opts = parseArgs();
    const skinsPath = opts.skinPath ? path.resolve(opts.skinPath) : DEFAULT_SKINS_DIR;

    let skinFiles = [];
    const stats = await fs.stat(skinsPath).catch(() => null);
    if (!stats) {
        console.error('Skins path not found:', skinsPath);
        process.exitCode = 2;
        return;
    }

    if (stats.isFile()) {
        skinFiles = [skinsPath];
    } else {
        skinFiles = await listJsonFiles(skinsPath);
    }

    if (skinFiles.length === 0) {
        console.log('No skin manifest JSON files found at', skinsPath);
    }

    const families = new Map();
    const skinsScanned = [];

    for (const skinFile of skinFiles) {
        const json = await readJson(skinFile);
        if (!json) continue;
        skinsScanned.push(path.relative(process.cwd(), skinFile));
        const slots = json.slots || json.slots || {};
        for (const slotKey of Object.keys(slots)) {
            const meta = slots[slotKey] || {};
            let family = null;
            let role = null;

            if (meta && meta._family) {
                family = meta._family;
                role = meta._layerRole || null;
            } else {
                const det = detectFamilyFromName(slotKey);
                if (det) {
                    family = det.family;
                    role = det.role;
                }
            }

            if (!family) {
                // record alias slots separately under alias namespace
                const aliasFamily = '__aliases__';
                if (!families.has(aliasFamily)) families.set(aliasFamily, { familyId: aliasFamily, members: {}, slots: {}, skins: new Set() });
                const a = families.get(aliasFamily);
                a.slots[slotKey] = a.slots[slotKey] || [];
                a.slots[slotKey].push({ skin: skinFile, meta });
                a.skins.add(skinFile);
                continue;
            }

            if (opts.familyFilter && !family.startsWith(opts.familyFilter)) continue;

            if (!families.has(family)) {
                families.set(family, { familyId: family, members: {}, slots: {}, skins: new Set(), warnings: [] });
            }

            const entry = families.get(family);
            entry.skins.add(skinFile);
            entry.slots[slotKey] = meta;
            if (role) {
                entry.members[role] = entry.members[role] || [];
                entry.members[role].push({ slotKey, skin: skinFile, meta });
            }
        }
    }

    // Post-process families
    const reportFamilies = {};
    let familiesWithMissingFrame = 0;
    let familiesWithBorderWarning = 0;

    for (const [familyId, data] of families.entries()) {
        if (familyId === '__aliases__') continue;
        const rolesFound = Object.keys(data.members);
        const hasFrame = rolesFound.includes('frame');
        const frameSlots = data.members.frame || [];
        const frameInfo = frameSlots.length > 0 ? frameSlots[0] : null;

        const borderChecks = [];
        if (frameInfo && frameInfo.meta && frameInfo.meta.kind === 'sprite-frame') {
            const b = frameInfo.meta.border;
            const ok = isIntArray(b);
            borderChecks.push({ slot: frameInfo.slotKey, border: b || null, borderValid: ok });
            if (!ok) familiesWithBorderWarning++;
        }

        if (!hasFrame) familiesWithMissingFrame++;

        reportFamilies[familyId] = {
            familyId,
            skins: Array.from(data.skins).map(p => path.relative(process.cwd(), p)),
            roles: rolesFound,
            missingRoles: ['frame', 'fill', 'bleed', 'accent'].filter(r => !rolesFound.includes(r)),
            frameSample: frameInfo ? { slotKey: frameInfo.slotKey, kind: frameInfo.meta.kind } : null,
            borderChecks,
            warnings: data.warnings || []
        };
    }

    const report = {
        generatedAt: new Date().toISOString(),
        skinsScanned,
        totalFamilies: Object.keys(reportFamilies).length,
        familiesWithMissingFrame,
        familiesWithBorderWarning,
        families: reportFamilies
    };

    const outPath = opts.reportPath ? path.resolve(opts.reportPath) : path.join(process.cwd(), 'artifacts', 'ui-layered-frames', `report-${Date.now()}.json`);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('\nLayered frame scan report written to:', outPath);
    console.log(`Skins scanned: ${report.skinsScanned.length}, Families: ${report.totalFamilies}`);
    console.log(`Families missing frame: ${report.familiesWithMissingFrame}, Families with border warnings: ${report.familiesWithBorderWarning}`);

    if (opts.failOnMissingMeta && report.familiesWithMissingFrame > 0) {
        console.error('Failing due to missing frame(s) and -FailOnMissingMeta set.');
        process.exitCode = 3;
        return;
    }

    if (opts.preview || opts.apply) {
        const rendererArgs = [
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            RENDER_SCRIPT,
            '-SkinPath',
            skinsPath,
            '-ReportPath',
            outPath.replace(/\.json$/i, '.render.json'),
        ];

        if (opts.familyFilter) {
            rendererArgs.push('-FamilyFilter', opts.familyFilter);
        }
        if (opts.preview) {
            rendererArgs.push('-Preview');
        }
        if (opts.apply) {
            rendererArgs.push('-Apply');
        }
        if (opts.refreshCocos) {
            rendererArgs.push('-RefreshCocos');
        }

        const powershellExe = process.platform === 'win32' ? 'powershell' : 'pwsh';
        console.log(`Invoking renderer: ${path.relative(process.cwd(), RENDER_SCRIPT)}`);
        const renderResult = spawnSync(powershellExe, rendererArgs, {
            cwd: process.cwd(),
            stdio: 'inherit',
            shell: false,
        });

        if ((renderResult.status ?? 1) !== 0) {
            console.error('Renderer failed.');
            process.exitCode = renderResult.status ?? 1;
            return;
        }
    } else if (opts.refreshCocos) {
        try {
            console.log('Triggering Cocos Asset DB refresh...');
            const curlCmd = process.platform === 'win32' ? 'curl.exe' : 'curl';
            const url = 'http://localhost:7456/asset-db/refresh';
            const r = spawnSync(curlCmd, [url], { stdio: 'inherit' });
            if (r.status !== 0) console.warn('Asset DB refresh returned non-zero exit code');
        } catch (e) {
            console.warn('Failed to call asset-db refresh:', e.message);
        }
    }

    console.log('Done.');
}

main().catch(e => {
    console.error('Unhandled error:', e);
    process.exitCode = 2;
});
