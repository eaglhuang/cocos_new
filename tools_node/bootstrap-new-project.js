#!/usr/bin/env node
/**
 * bootstrap-new-project.js — 新專案快速啟動工具
 *
 * 從本 repo 的 portable 工具集與 skills 中，萃取可移植的部分，
 * 在目標目錄建立新專案骨架。
 *
 * Usage:
 *   node tools_node/bootstrap-new-project.js --name <project-name> --out <dir>
 *   node tools_node/bootstrap-new-project.js --name MyGame --out ../MyNewGame
 *   node tools_node/bootstrap-new-project.js --list     # 顯示可移植的元件清單
 *
 * 可選：
 *   --include <components...>   只包含指定元件 (all, tools, skills, docs)
 *   --exclude <components...>   排除指定元件
 *   --dry-run                   只顯示會複製的清單，不實際複製
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, '.github', 'skills-manifest.json');

// ─── portable components catalogue ───────────────────────
const PORTABLE_COMPONENTS = [
    // Tools
    {
        id: 'tools/validate-ui-specs',
        label: 'validate-ui-specs.js',
        category: 'tools',
        src: 'tools_node/validate-ui-specs.js',
        dest: 'tools_node/validate-ui-specs.js',
        note: 'UI spec 三層 JSON 驗證器（R1-R18 rules）',
    },
    {
        id: 'tools/validate-widget-registry',
        label: 'validate-widget-registry.js',
        category: 'tools',
        src: 'tools_node/validate-widget-registry.js',
        dest: 'tools_node/validate-widget-registry.js',
        note: 'Widget registry ↔ 實際檔案一致性驗證',
    },
    {
        id: 'tools/build-fragment-usage-map',
        label: 'build-fragment-usage-map.js',
        category: 'tools',
        src: 'tools_node/build-fragment-usage-map.js',
        dest: 'tools_node/build-fragment-usage-map.js',
        note: '$ref fragment 使用地圖',
    },
    {
        id: 'tools/task-lock',
        label: 'task-lock.js',
        category: 'tools',
        src: 'tools_node/task-lock.js',
        dest: 'tools_node/task-lock.js',
        note: 'Multi-Agent task locking',
    },
    {
        id: 'tools/skills-manager',
        label: 'skills-manager.js',
        category: 'tools',
        src: 'tools_node/skills-manager.js',
        dest: 'tools_node/skills-manager.js',
        note: 'Agent Skills 管理 CLI',
    },
    {
        id: 'tools/headless-snapshot-test',
        label: 'headless-snapshot-test.js',
        category: 'tools',
        src: 'tools_node/headless-snapshot-test.js',
        dest: 'tools_node/headless-snapshot-test.js',
        note: 'UI spec JSON 結構快照測試',
    },
    {
        id: 'tools/layout-diff',
        label: 'layout-diff.js',
        category: 'tools',
        src: 'tools_node/layout-diff.js',
        dest: 'tools_node/layout-diff.js',
        note: 'Layout JSON 人類可讀 diff',
    },
    {
        id: 'tools/i18n-overflow-check',
        label: 'i18n-overflow-check.js',
        category: 'tools',
        src: 'tools_node/i18n-overflow-check.js',
        dest: 'tools_node/i18n-overflow-check.js',
        note: '多語文字溢出風險預測',
    },
    {
        id: 'tools/check-encoding-touched',
        label: 'check-encoding-touched.js',
        category: 'tools',
        src: 'tools_node/check-encoding-touched.js',
        dest: 'tools_node/check-encoding-touched.js',
        note: 'UTF-8 BOM / mojibake 防護',
    },
    {
        id: 'tools/lib/project-config',
        label: 'lib/project-config.js',
        category: 'tools',
        src: 'tools_node/lib/project-config.js',
        dest: 'tools_node/lib/project-config.js',
        note: '集中路徑管理（需手動調整到新專案路徑）',
    },
    // GitHub Instructions
    {
        id: 'instructions/agent-collaboration',
        label: 'agent-collaboration.instructions.md',
        category: 'instructions',
        src: '.github/instructions/agent-collaboration.instructions.md',
        dest: '.github/instructions/agent-collaboration.instructions.md',
        note: 'Agent 協作三防線規範',
    },
    {
        id: 'instructions/fragment-guard',
        label: 'fragment-guard.instructions.md',
        category: 'instructions',
        src: '.github/instructions/fragment-guard.instructions.md',
        dest: '.github/instructions/fragment-guard.instructions.md',
        note: '$ref fragment 修改防護規則',
    },
    {
        id: 'instructions/image-view-guard',
        label: 'image-view-guard.instructions.md',
        category: 'instructions',
        src: '.github/instructions/image-view-guard.instructions.md',
        dest: '.github/instructions/image-view-guard.instructions.md',
        note: '縮圖讀取節流規則',
    },
    {
        id: 'instructions/token-guard',
        label: 'token-guard.instructions.md',
        category: 'instructions',
        src: '.github/instructions/token-guard.instructions.md',
        dest: '.github/instructions/token-guard.instructions.md',
        note: 'Context token 預算防護',
    },
    // Docs
    {
        id: 'docs/agent-collaboration-protocol',
        label: 'docs/agent-collaboration-protocol.md',
        category: 'docs',
        src: 'docs/agent-collaboration-protocol.md',
        dest: 'docs/agent-collaboration-protocol.md',
        note: 'Agent 協作完整協議',
    },
    {
        id: 'docs/fragment-composition-guide',
        label: 'docs/ui/fragment-composition-guide.md',
        category: 'docs',
        src: 'docs/ui/fragment-composition-guide.md',
        dest: 'docs/ui/fragment-composition-guide.md',
        note: '$ref fragment 合成最佳實踐',
    },
    // UI Spec skeleton
    {
        id: 'ui-spec/widget-registry',
        label: 'widget-registry.json',
        category: 'ui-spec',
        src: 'assets/resources/ui-spec/fragments/widget-registry.json',
        dest: 'assets/resources/ui-spec/fragments/widget-registry.json',
        note: 'Widget fragment 索引（需按新專案 widget 調整）',
    },
    {
        id: 'ui-spec/design-tokens',
        label: 'ui-design-tokens.json',
        category: 'ui-spec',
        src: 'assets/resources/ui-spec/ui-design-tokens.json',
        dest: 'assets/resources/ui-spec/ui-design-tokens.json',
        note: '全域設計 token（需依新專案主題客製化）',
    },
];

// ─── helpers ──────────────────────────────────────────────
function copyFileEnsureDir(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function printList() {
    const cats = {};
    for (const c of PORTABLE_COMPONENTS) {
        if (!cats[c.category]) cats[c.category] = [];
        cats[c.category].push(c);
    }

    for (const [cat, items] of Object.entries(cats)) {
        console.log(`\n[${cat}]`);
        for (const item of items) {
            console.log(`  ${item.id.padEnd(40)} — ${item.note}`);
        }
    }

    console.log(`\nTotal: ${PORTABLE_COMPONENTS.length} portable component(s)`);

    // Show portable skills from manifest
    if (fs.existsSync(MANIFEST_PATH)) {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
        const portable = manifest.skills.filter(s => s.portable);
        console.log(`\n[skills (portable)]: ${portable.length} skill(s)`);
        for (const s of portable) {
            console.log(`  ${s.id.padEnd(40)} — ${s.description.slice(0, 50)}`);
        }
    }
}

// ─── main ─────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--list')) {
    printList();
    process.exit(0);
}

const nameIdx = args.indexOf('--name');
const outIdx = args.indexOf('--out');

if (nameIdx < 0 || outIdx < 0) {
    console.error('Usage:\n  bootstrap-new-project.js --name <project-name> --out <dir>\n  bootstrap-new-project.js --list');
    process.exit(1);
}

const projectName = args[nameIdx + 1];
const outDir = path.resolve(args[outIdx + 1]);
const isDryRun = args.includes('--dry-run');

// Determine which categories to include
const includeIdx = args.indexOf('--include');
const excludeIdx = args.indexOf('--exclude');
let includeCategories = null;
let excludeCategories = new Set();

if (includeIdx >= 0) {
    includeCategories = new Set(args[includeIdx + 1].split(',').map(s => s.trim()));
}
if (excludeIdx >= 0) {
    excludeCategories = new Set(args[excludeIdx + 1].split(',').map(s => s.trim()));
}

const toBootstrap = PORTABLE_COMPONENTS.filter(c => {
    if (includeCategories && !includeCategories.has(c.category) && !includeCategories.has('all')) return false;
    if (excludeCategories.has(c.category)) return false;
    return true;
});

console.log(`\n🚀 Bootstrap: ${projectName}`);
console.log(`   Target: ${outDir}`);
console.log(`   Components: ${toBootstrap.length}`);
if (isDryRun) console.log(`   (dry-run — no files written)\n`);
else console.log();

let copied = 0;
const skipped = [];

for (const comp of toBootstrap) {
    const srcPath = path.join(ROOT, comp.src);
    const destPath = path.join(outDir, comp.dest);

    if (!fs.existsSync(srcPath)) {
        skipped.push(`${comp.id} (source not found)`);
        continue;
    }

    if (isDryRun) {
        console.log(`  [${comp.category}] ${comp.src} → ${comp.dest}`);
        copied++;
        continue;
    }

    copyFileEnsureDir(srcPath, destPath);
    console.log(`  ✅ ${comp.dest}`);
    copied++;
}

if (skipped.length > 0) {
    console.log(`\n  ⚠️  Skipped (${skipped.length}):`);
    for (const s of skipped) console.log(`     ${s}`);
}

if (!isDryRun) {
    // Export portable skills
    if (fs.existsSync(MANIFEST_PATH)) {
        console.log('\n📦 Exporting portable skills...');
        const skillsOut = path.join(outDir, '.github', 'skills');
        const { execSync } = require('child_process');
        try {
            execSync(`node "${path.join(ROOT, 'tools_node', 'skills-manager.js')}" export --out "${skillsOut}"`, {
                cwd: ROOT,
                stdio: 'inherit',
            });
        } catch (e) {
            console.warn('  ⚠️  skills-manager export failed:', e.message);
        }
    }

    // Write a bootstrap README
    const readmeContent = `# ${projectName}

Bootstrapped from 3KLife UI toolchain.

## Tools

| Tool | Purpose |
|------|---------|
${toBootstrap.filter(c => c.category === 'tools').map(c => `| \`${c.dest}\` | ${c.note} |`).join('\n')}

## Setup

1. Edit \`tools_node/lib/project-config.js\` to match your project paths
2. Run \`node tools_node/validate-ui-specs.js\` to validate UI specs
3. See \`docs/agent-collaboration-protocol.md\` for Agent collaboration rules

## Portability Notes

- \`project-config.js\` contains hardcoded paths — **update before use**
- \`widget-registry.json\` and \`ui-design-tokens.json\` should be adapted for your design language
- Portable skills in \`.github/skills/\` can be used as-is
`;
    const readmePath = path.join(outDir, 'BOOTSTRAP-README.md');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(readmePath, readmeContent, 'utf-8');
    console.log(`\n  📄 BOOTSTRAP-README.md written`);
}

console.log(`\n✅ Bootstrap done: ${copied} file(s)${isDryRun ? ' (dry-run)' : ''}`);
