#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const configPath = path.join(__dirname, 'encoding-integrity.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const allowedExtensions = new Set(config.allowedExtensions || []);

function toPosixPath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function isAllowedTextFile(filePath) {
    return allowedExtensions.has(path.extname(filePath).toLowerCase());
}

function fileExistsInWorkspace(relativePath) {
    return fs.existsSync(path.join(projectRoot, relativePath));
}

function runGit(args) {
    const result = spawnSync('git', args, {
        cwd: projectRoot,
        encoding: 'utf8',
        shell: false,
    });

    if ((result.status ?? 1) !== 0) {
        const stderr = (result.stderr || '').trim();
        throw new Error(stderr || `git ${args.join(' ')} failed.`);
    }

    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function collectTouchedFiles() {
    const workingTree = runGit(['diff', '--name-only', '--diff-filter=ACMR']);
    const staged = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
    const untracked = runGit(['ls-files', '--others', '--exclude-standard']);

    return [...new Set([...workingTree, ...staged, ...untracked])]
        .map(toPosixPath)
        .filter(isAllowedTextFile)
        .filter(fileExistsInWorkspace);
}

function parseArgs(argv) {
    const parsed = {
        help: argv.includes('--help') || argv.includes('-h'),
        stagedOnly: argv.includes('--staged'),
        files: [],
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (token === '--files') {
            while (index + 1 < argv.length && !argv[index + 1].startsWith('--')) {
                parsed.files.push(toPosixPath(argv[index + 1]));
                index += 1;
            }
        }
    }

    return parsed;
}

function printHelp() {
    console.log('Usage: node tools_node/check-encoding-touched.js [--staged] [--files <path...>]');
    console.log('');
    console.log('Default: check touched text files in working tree + staged + untracked.');
    console.log('--files: check only the provided file list.');
    console.log('--staged: delegate to staged-files integrity check.');
}

function main() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return;
    }

    if (options.stagedOnly) {
        const result = spawnSync(process.execPath, [
            path.join(__dirname, 'check-encoding-integrity.js'),
            '--staged',
        ], {
            cwd: projectRoot,
            stdio: 'inherit',
            shell: false,
        });

        process.exit(result.status ?? 1);
    }

    const touchedFiles = options.files.length > 0
        ? [...new Set(options.files)]
            .filter(isAllowedTextFile)
            .filter(fileExistsInWorkspace)
        : collectTouchedFiles();

    if (touchedFiles.length === 0) {
        console.log('[encoding-touched] No touched text files to check.');
        return;
    }

    console.log(`[encoding-touched] Checking ${touchedFiles.length} touched text file(s).`);

    const result = spawnSync(process.execPath, [
        path.join(__dirname, 'check-encoding-integrity.js'),
        '--files',
        ...touchedFiles,
    ], {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: false,
    });

    process.exit(result.status ?? 0);
}

main();
