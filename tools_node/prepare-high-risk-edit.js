#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const configPath = path.join(__dirname, 'encoding-integrity.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const highRiskFiles = new Set(Object.keys(config.highRiskFiles || {}));

function toPosixPath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function usage() {
    console.log('Usage: node tools_node/prepare-high-risk-edit.js <repo-relative-file> [more files...]');
}

function ensureHighRisk(relativePath) {
    if (!highRiskFiles.has(relativePath)) {
        throw new Error(`File is not in high-risk list: ${relativePath}`);
    }
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function timestampForPath() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function main() {
    const inputFiles = process.argv.slice(2);
    if (inputFiles.length === 0) {
        usage();
        process.exit(1);
    }

    const relativeFiles = inputFiles.map((filePath) => {
        const absolutePath = path.isAbsolute(filePath)
            ? path.normalize(filePath)
            : path.resolve(projectRoot, filePath);
        return toPosixPath(path.relative(projectRoot, absolutePath));
    });

    for (const relativePath of relativeFiles) {
        ensureHighRisk(relativePath);
        if (!fs.existsSync(path.join(projectRoot, relativePath))) {
            throw new Error(`File does not exist: ${relativePath}`);
        }
    }

    const backupRoot = path.join(projectRoot, 'local', 'encoding-backups', timestampForPath());
    fs.mkdirSync(backupRoot, { recursive: true });

    const manifest = {
        createdAt: new Date().toISOString(),
        files: [],
    };

    for (const relativePath of relativeFiles) {
        const absolutePath = path.join(projectRoot, relativePath);
        const buffer = fs.readFileSync(absolutePath);
        const fileBackupPath = path.join(backupRoot, relativePath);
        fs.mkdirSync(path.dirname(fileBackupPath), { recursive: true });
        fs.writeFileSync(fileBackupPath, buffer);

        manifest.files.push({
            path: relativePath,
            sha256: sha256(buffer),
            backupPath: toPosixPath(path.relative(projectRoot, fileBackupPath)),
        });
    }

    const manifestPath = path.join(backupRoot, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    const result = spawnSync('node', [path.join(__dirname, 'check-encoding-integrity.js'), '--files', ...relativeFiles], {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: false,
    });

    if ((result.status ?? 1) !== 0) {
        console.error('[encoding] Backup created, but pre-edit integrity check failed.');
        process.exit(result.status ?? 1);
    }

    console.log(`[encoding] Backup manifest written to ${toPosixPath(path.relative(projectRoot, manifestPath))}`);
    for (const file of manifest.files) {
        console.log(`[encoding] ${file.path}`);
        console.log(`  sha256: ${file.sha256}`);
        console.log(`  backup: ${file.backupPath}`);
    }
}

main();
