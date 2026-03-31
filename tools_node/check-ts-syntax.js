#!/usr/bin/env node
/**
 * check-ts-syntax.js — 逐檔 TypeScript 語法掃描
 *
 * 為了避免 Cocos Creator 型別宣告在 CLI 下造成大量雜訊，
 * 這裡不做完整 type-check，而是用 TypeScript compiler API
 * 對 assets/ 與 extensions/ 下的 .ts 檔逐檔做 syntax-level 驗證。
 *
 * 可抓到的典型問題：
 *   - 缺少方法/區塊邊界
 *   - 註解或字串破損
 *   - 非法 token / 非法模板字串
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const scanRoots = ['assets', 'extensions']
    .map((dir) => path.join(projectRoot, dir))
    .filter((dir) => fs.existsSync(dir));

function walk(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === 'library' || entry.name === 'temp' || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath, files);
            continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) continue;
        files.push(fullPath);
    }
    return files;
}

function formatDiagnostic(filePath, diagnostic) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    if (!diagnostic.file || typeof diagnostic.start !== 'number') {
        return `${path.relative(projectRoot, filePath)} - ${message}`;
    }

    const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    const line = pos.line + 1;
    const column = pos.character + 1;
    return `${path.relative(projectRoot, filePath)}:${line}:${column} - ${message}`;
}

function checkFile(filePath) {
    const source = fs.readFileSync(filePath, 'utf8');
    const result = ts.transpileModule(source, {
        fileName: filePath,
        reportDiagnostics: true,
        compilerOptions: {
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ESNext,
            experimentalDecorators: true,
            allowJs: false,
        },
    });

    return (result.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
}

const files = scanRoots.flatMap((dir) => walk(dir));
const failures = [];

for (const filePath of files) {
    const diagnostics = checkFile(filePath);
    for (const diagnostic of diagnostics) {
        failures.push(formatDiagnostic(filePath, diagnostic));
    }
}

if (failures.length > 0) {
    console.error('❌ TypeScript 語法掃描失敗\n');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    console.error(`\n共 ${failures.length} 筆語法錯誤。`);
    process.exit(1);
}

console.log(`✅ TypeScript 語法掃描通過（${files.length} 個檔案）`);
