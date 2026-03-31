#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const configPath = path.join(__dirname, 'encoding-integrity.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const allowedExtensions = new Set(config.allowedExtensions || []);
const highRiskEntries = config.highRiskFiles || {};
const ignoredTrackedPrefixes = [
    '@cocos/creator-types/',
];

function toPosixPath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function relativeToProject(filePath) {
    return toPosixPath(path.relative(projectRoot, filePath));
}

function resolveProjectPath(filePath) {
    const absolutePath = path.isAbsolute(filePath)
        ? path.normalize(filePath)
        : path.resolve(projectRoot, filePath);
    return {
        absolutePath,
        relativePath: relativeToProject(absolutePath),
    };
}

function isAllowedTextFile(filePath) {
    return allowedExtensions.has(path.extname(filePath).toLowerCase());
}

function isIgnoredTrackedPath(filePath) {
    const normalizedPath = toPosixPath(filePath);
    return ignoredTrackedPrefixes.some((prefix) => normalizedPath.startsWith(prefix));
}

function fileExistsInWorkspace(relativePath) {
    return fs.existsSync(path.join(projectRoot, relativePath));
}

function collectOccurrences(text, fragments) {
    return fragments.reduce((total, fragment) => {
        if (!fragment) {
            return total;
        }

        return total + (text.split(fragment).length - 1);
    }, 0);
}

function countNonAscii(text) {
    let count = 0;
    for (const char of text) {
        if (char.codePointAt(0) > 127) {
            count += 1;
        }
    }

    return count;
}

function getStagedFiles() {
    const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
        cwd: projectRoot,
        encoding: 'utf8',
        shell: false,
    });

    if ((result.status ?? 1) !== 0) {
        const stderr = (result.stderr || '').trim();
        throw new Error(stderr || 'Unable to read staged files from git.');
    }

    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((filePath) => !isIgnoredTrackedPath(filePath))
        .filter((filePath) => fileExistsInWorkspace(filePath))
        .filter(isAllowedTextFile);
}

function getTrackedFiles() {
    const result = spawnSync('git', ['ls-files'], {
        cwd: projectRoot,
        encoding: 'utf8',
        shell: false,
    });

    if ((result.status ?? 1) !== 0) {
        const stderr = (result.stderr || '').trim();
        throw new Error(stderr || 'Unable to read tracked files from git.');
    }

    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((filePath) => !isIgnoredTrackedPath(filePath))
        .filter((filePath) => fileExistsInWorkspace(filePath))
        .filter(isAllowedTextFile);
}

function parseArgs(argv) {
    const parsed = {
        files: [],
        staged: false,
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (token === '--staged') {
            parsed.staged = true;
            continue;
        }

        if (token === '--help' || token === '-h') {
            parsed.help = true;
            continue;
        }

        if (token === '--files') {
            while (index + 1 < argv.length && !argv[index + 1].startsWith('--')) {
                parsed.files.push(argv[index + 1]);
                index += 1;
            }
            continue;
        }

        parsed.files.push(token);
    }

    return parsed;
}

function printHelp() {
    console.log('Usage: node tools_node/check-encoding-integrity.js [--staged] [--files <path...>]');
    console.log('');
    console.log('Default: check all tracked text files with allowed extensions.');
    console.log('--staged: check staged text files plus configured high-risk files.');
    console.log('--files: check only the provided paths.');
}

function buildTargetList(options) {
    if (options.files.length > 0) {
        return [...new Set(options.files.map((filePath) => resolveProjectPath(filePath).relativePath))];
    }

    if (options.staged) {
        const stagedFiles = getStagedFiles().map((filePath) => resolveProjectPath(filePath).relativePath);
        const configuredFiles = Object.keys(highRiskEntries);
        return [...new Set([...stagedFiles, ...configuredFiles])];
    }

    return getTrackedFiles().map((filePath) => resolveProjectPath(filePath).relativePath);
}

function analyzeFile(relativePath) {
    const absolutePath = path.join(projectRoot, relativePath);
    const highRiskConfig = highRiskEntries[relativePath] || null;
    const allowBom = Boolean(
        (highRiskConfig && highRiskConfig.allowBom)
        || ((config.legacyAllowlist?.bom || []).includes(relativePath))
    );
    const allowReplacement = Boolean((config.legacyAllowlist?.replacementChar || []).includes(relativePath));
    const allowMojibake = Boolean((config.legacyAllowlist?.mojibake || []).includes(relativePath));

    if (!fs.existsSync(absolutePath)) {
        return {
            relativePath,
            issues: [`Missing file: ${relativePath}`],
            warnings: [],
            stats: null,
        };
    }

    const buffer = fs.readFileSync(absolutePath);
    const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
    const contentBuffer = hasBom ? buffer.subarray(3) : buffer;
    const text = contentBuffer.toString('utf8');
    const roundTripBuffer = Buffer.from(text, 'utf8');
    const replacementCount = (text.match(/\uFFFD/g) || []).length;
    const latinMojibakeCount = collectOccurrences(text, config.latinMojibakeFragments || []);
    const weirdCjkCount = collectOccurrences(text, config.weirdCjkFragments || []);
    const suspiciousRatio = text.length > 0 ? latinMojibakeCount / text.length : 0;
    const nonAsciiCount = countNonAscii(text);

    const issues = [];
    const warnings = [];

    if (!contentBuffer.equals(roundTripBuffer)) {
        issues.push('Invalid UTF-8 byte sequence or lossy utf8 decode detected.');
    }

    if (hasBom && !allowBom) {
        issues.push('Unexpected UTF-8 BOM detected.');
    } else if (hasBom && allowBom) {
        warnings.push('BOM allowed by temporary legacy allowlist.');
    }

    if (replacementCount > 0 && !allowReplacement) {
        issues.push(`Replacement character found ${replacementCount} time(s).`);
    }

    const exceedsLatinHeuristic = latinMojibakeCount >= (config.latinMojibakeMinCount || 1)
        && suspiciousRatio >= (config.latinMojibakeMinRatio || 0);
    const exceedsWeirdCjkHeuristic = weirdCjkCount >= (config.weirdCjkMinCount || 1);

    if ((exceedsLatinHeuristic || exceedsWeirdCjkHeuristic) && !allowMojibake) {
        issues.push(
            `Suspicious mojibake signature detected (latin=${latinMojibakeCount}, weird-cjk=${weirdCjkCount}, ratio=${suspiciousRatio.toFixed(4)}).`
        );
    }

    if (highRiskConfig && Number.isFinite(highRiskConfig.baselineNonAscii)) {
        const delta = Math.abs(nonAsciiCount - highRiskConfig.baselineNonAscii);
        if (delta > highRiskConfig.maxNonAsciiDelta) {
            issues.push(
                `Non-ASCII baseline drift too large (${nonAsciiCount} vs baseline ${highRiskConfig.baselineNonAscii}, delta ${delta}, allowed ${highRiskConfig.maxNonAsciiDelta}).`
            );
        }
    }

    return {
        relativePath,
        issues,
        warnings,
        stats: {
            hasBom,
            replacementCount,
            latinMojibakeCount,
            weirdCjkCount,
            nonAsciiCount,
            label: highRiskConfig ? highRiskConfig.label : null,
        },
    };
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const targets = buildTargetList(options)
        .filter(Boolean)
        .filter(isAllowedTextFile);

    if (targets.length === 0) {
        console.log('[encoding] No matching text files to check.');
        return;
    }

    let failed = false;
    for (const relativePath of targets) {
        const result = analyzeFile(relativePath);
        const label = result.stats && result.stats.label ? ` (${result.stats.label})` : '';
        console.log(`[encoding] Checking ${result.relativePath}${label}`);

        if (result.stats) {
            console.log(
                `  nonAscii=${result.stats.nonAsciiCount} bom=${result.stats.hasBom ? 'yes' : 'no'} replacement=${result.stats.replacementCount} latinMojibake=${result.stats.latinMojibakeCount} weirdCjk=${result.stats.weirdCjkCount}`
            );
        }

        for (const warning of result.warnings) {
            console.log(`  warning: ${warning}`);
        }

        if (result.issues.length > 0) {
            failed = true;
            for (const issue of result.issues) {
                console.error(`  error: ${issue}`);
            }
        } else {
            console.log('  ok');
        }
    }

    if (failed) {
        console.error('[encoding] Integrity check failed.');
        process.exit(1);
    }

    console.log('[encoding] Integrity check passed.');
}

main();
