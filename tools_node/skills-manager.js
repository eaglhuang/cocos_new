#!/usr/bin/env node
/**
 * skills-manager.js — Agent Skills 管理 CLI
 *
 * Sub-commands:
 *   list [--portable] [--category <cat>]  列出所有 skill
 *   validate                              驗證 manifest 與實際檔案一致
 *   export --out <dir>                    匯出 portable skills 到目標目錄
 *   import --from <dir>                   從目錄匯入 skills 到 .github/skills/
 *   generate-prompt-xml                   產生 prompt XML 片段
 *   sync-mirrors                          同步 .github/skills → .agents/skills mirrors
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, '.github', 'skills-manifest.json');

// ─── helpers ──────────────────────────────────────────────
function loadManifest() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        console.error('❌ skills-manifest.json not found at', MANIFEST_PATH);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
}

function saveManifest(manifest) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

function skillDir(loc) {
    return path.join(ROOT, loc);
}

// ─── list ─────────────────────────────────────────────────
function cmdList(args) {
    const manifest = loadManifest();
    let skills = manifest.skills;

    const portableOnly = args.includes('--portable');
    const catIdx = args.indexOf('--category');
    const category = catIdx >= 0 ? args[catIdx + 1] : null;

    if (portableOnly) skills = skills.filter(s => s.portable);
    if (category) skills = skills.filter(s => s.category === category);

    const header = `${'ID'.padEnd(32)} ${'Category'.padEnd(18)} ${'Port'.padEnd(6)} Description`;
    console.log(header);
    console.log('─'.repeat(header.length));
    for (const s of skills) {
        const port = s.portable ? '✅' : '❌';
        console.log(`${s.id.padEnd(32)} ${s.category.padEnd(18)} ${port.padEnd(6)} ${s.description.slice(0, 60)}`);
    }
    console.log(`\nTotal: ${skills.length} skill(s)`);
}

// ─── validate ─────────────────────────────────────────────
function cmdValidate() {
    const manifest = loadManifest();
    let errors = 0;
    let warnings = 0;

    for (const skill of manifest.skills) {
        // Check primary location exists
        const primaryDir = skillDir(skill.primaryLocation);
        if (!fs.existsSync(primaryDir)) {
            console.error(`❌ [${skill.id}] primary location missing: ${skill.primaryLocation}`);
            errors++;
            continue;
        }

        // Check SKILL.md exists
        const skillMd = path.join(primaryDir, 'SKILL.md');
        if (!fs.existsSync(skillMd)) {
            console.error(`❌ [${skill.id}] SKILL.md missing at ${skill.primaryLocation}/SKILL.md`);
            errors++;
        }

        // Check all locations exist
        for (const loc of skill.locations) {
            const dir = skillDir(loc);
            if (!fs.existsSync(dir)) {
                console.warn(`⚠️  [${skill.id}] listed location missing: ${loc}`);
                warnings++;
            }
        }

        // Check dependencies exist in manifest
        for (const dep of skill.depends || []) {
            if (!manifest.skills.find(s => s.id === dep)) {
                console.error(`❌ [${skill.id}] dependency "${dep}" not in manifest`);
                errors++;
            }
        }
    }

    // Check for unlisted skill directories
    const ghSkillsDir = path.join(ROOT, '.github', 'skills');
    const agSkillsDir = path.join(ROOT, '.agents', 'skills');
    const manifestIds = new Set(manifest.skills.map(s => s.id));

    for (const dir of [ghSkillsDir, agSkillsDir]) {
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const skillMd = path.join(dir, entry.name, 'SKILL.md');
            if (fs.existsSync(skillMd) && !manifestIds.has(entry.name)) {
                console.warn(`⚠️  unlisted skill directory: ${path.relative(ROOT, path.join(dir, entry.name))}`);
                warnings++;
            }
        }
    }

    // Check mirrors consistency
    for (const mirror of manifest.mirrors || []) {
        const primDir = skillDir(mirror.primary);
        const mirDir = skillDir(mirror.mirror);
        if (fs.existsSync(primDir) && fs.existsSync(mirDir)) {
            const primMd = path.join(primDir, 'SKILL.md');
            const mirMd = path.join(mirDir, 'SKILL.md');
            if (fs.existsSync(primMd) && fs.existsSync(mirMd)) {
                const primContent = fs.readFileSync(primMd, 'utf-8');
                const mirContent = fs.readFileSync(mirMd, 'utf-8');
                if (primContent !== mirContent) {
                    console.warn(`⚠️  mirror drift: ${mirror.skillId} — SKILL.md content differs`);
                    warnings++;
                }
            }
        }
    }

    console.log(`\n${errors === 0 ? '✅' : '❌'} Validate done: ${errors} error(s), ${warnings} warning(s)`);
    process.exit(errors > 0 ? 1 : 0);
}

// ─── export ───────────────────────────────────────────────
function cmdExport(args) {
    const outIdx = args.indexOf('--out');
    if (outIdx < 0 || !args[outIdx + 1]) {
        console.error('Usage: skills-manager.js export --out <dir>');
        process.exit(1);
    }
    const outDir = path.resolve(args[outIdx + 1]);
    const manifest = loadManifest();
    const portableSkills = manifest.skills.filter(s => s.portable);

    fs.mkdirSync(outDir, { recursive: true });
    let count = 0;

    for (const skill of portableSkills) {
        const srcDir = skillDir(skill.primaryLocation);
        if (!fs.existsSync(srcDir)) continue;

        const destDir = path.join(outDir, skill.id);
        fs.mkdirSync(destDir, { recursive: true });

        // Copy all files in skill directory
        for (const file of fs.readdirSync(srcDir)) {
            const srcFile = path.join(srcDir, file);
            const stat = fs.statSync(srcFile);
            if (stat.isFile()) {
                fs.copyFileSync(srcFile, path.join(destDir, file));
            }
        }
        count++;
    }

    // Write portable manifest subset
    const portableManifest = {
        _meta: { ...manifest._meta, description: 'Portable skills subset', totalSkills: portableSkills.length },
        skills: portableSkills,
    };
    fs.writeFileSync(path.join(outDir, 'skills-manifest.json'), JSON.stringify(portableManifest, null, 2) + '\n', 'utf-8');

    console.log(`✅ Exported ${count} portable skill(s) to ${outDir}`);
}

// ─── import ───────────────────────────────────────────────
function cmdImport(args) {
    const fromIdx = args.indexOf('--from');
    if (fromIdx < 0 || !args[fromIdx + 1]) {
        console.error('Usage: skills-manager.js import --from <dir>');
        process.exit(1);
    }
    const fromDir = path.resolve(args[fromIdx + 1]);
    if (!fs.existsSync(fromDir)) {
        console.error('❌ Source directory not found:', fromDir);
        process.exit(1);
    }

    const manifest = loadManifest();
    const existingIds = new Set(manifest.skills.map(s => s.id));
    let imported = 0;

    // Read source manifest if available
    const srcManifestPath = path.join(fromDir, 'skills-manifest.json');
    let srcSkills = [];
    if (fs.existsSync(srcManifestPath)) {
        const srcManifest = JSON.parse(fs.readFileSync(srcManifestPath, 'utf-8'));
        srcSkills = srcManifest.skills || [];
    }

    for (const entry of fs.readdirSync(fromDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillMd = path.join(fromDir, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillMd)) continue;

        const destDir = path.join(ROOT, '.github', 'skills', entry.name);
        if (existingIds.has(entry.name)) {
            console.warn(`⚠️  Skip existing skill: ${entry.name}`);
            continue;
        }

        // Copy skill directory
        fs.mkdirSync(destDir, { recursive: true });
        const srcSkillDir = path.join(fromDir, entry.name);
        for (const file of fs.readdirSync(srcSkillDir)) {
            const srcFile = path.join(srcSkillDir, file);
            if (fs.statSync(srcFile).isFile()) {
                fs.copyFileSync(srcFile, path.join(destDir, file));
            }
        }

        // Add to manifest
        const srcEntry = srcSkills.find(s => s.id === entry.name);
        manifest.skills.push(srcEntry || {
            id: entry.name,
            version: '1.0.0',
            category: 'unknown',
            portable: true,
            description: `Imported skill: ${entry.name}`,
            locations: [`.github/skills/${entry.name}`],
            primaryLocation: `.github/skills/${entry.name}`,
            depends: [],
            applyTo: '**',
            tags: ['imported'],
        });

        imported++;
    }

    if (imported > 0) {
        manifest._meta.totalSkills = manifest.skills.length;
        saveManifest(manifest);
    }

    console.log(`✅ Imported ${imported} skill(s)`);
}

// ─── generate-prompt-xml ──────────────────────────────────
function cmdGeneratePromptXml() {
    const manifest = loadManifest();
    const lines = ['<skills>'];

    for (const skill of manifest.skills) {
        lines.push(`<skill>`);
        lines.push(`<name>${skill.id}</name>`);
        lines.push(`<description>${skill.description}</description>`);
        lines.push(`<file>${skill.primaryLocation}/SKILL.md</file>`);
        lines.push(`</skill>`);
    }

    lines.push('</skills>');
    console.log(lines.join('\n'));
}

// ─── sync-mirrors ─────────────────────────────────────────
function cmdSyncMirrors() {
    const manifest = loadManifest();
    let synced = 0;

    for (const mirror of manifest.mirrors || []) {
        const primDir = skillDir(mirror.primary);
        const mirDir = skillDir(mirror.mirror);

        if (!fs.existsSync(primDir)) {
            console.warn(`⚠️  [${mirror.skillId}] primary missing: ${mirror.primary}`);
            continue;
        }

        fs.mkdirSync(mirDir, { recursive: true });

        // Sync all files from primary to mirror
        for (const file of fs.readdirSync(primDir)) {
            const srcFile = path.join(primDir, file);
            if (!fs.statSync(srcFile).isFile()) continue;

            const destFile = path.join(mirDir, file);
            const srcContent = fs.readFileSync(srcFile);
            const destContent = fs.existsSync(destFile) ? fs.readFileSync(destFile) : null;

            if (!destContent || !srcContent.equals(destContent)) {
                fs.writeFileSync(destFile, srcContent);
                console.log(`  📋 ${mirror.skillId}: synced ${file}`);
                synced++;
            }
        }
    }

    console.log(`\n✅ sync-mirrors done: ${synced} file(s) updated`);
}

// ─── main ─────────────────────────────────────────────────
const [, , cmd, ...args] = process.argv;

switch (cmd) {
    case 'list':
        cmdList(args);
        break;
    case 'validate':
        cmdValidate();
        break;
    case 'export':
        cmdExport(args);
        break;
    case 'import':
        cmdImport(args);
        break;
    case 'generate-prompt-xml':
        cmdGeneratePromptXml();
        break;
    case 'sync-mirrors':
        cmdSyncMirrors();
        break;
    default:
        console.log(`Usage: skills-manager.js <command>

Commands:
  list [--portable] [--category <cat>]  List skills
  validate                              Validate manifest ↔ files
  export --out <dir>                    Export portable skills
  import --from <dir>                   Import skills from directory
  generate-prompt-xml                   Generate prompt XML fragment
  sync-mirrors                          Sync .github → .agents mirrors
`);
        process.exit(cmd ? 1 : 0);
}
