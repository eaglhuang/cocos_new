#!/usr/bin/env node
/**
 * prep-and-slice.js
 *
 * One-shot pipeline: bg-removal (flood-fill) → component slicing
 * Supports PNG and JPEG inputs.
 *
 * Usage:
 *   node tools_node/prep-and-slice.js --input <img|dir> --out-dir <dir>
 *
 * Options:
 *   --input <path>           Source image file or directory of images
 *   --out-dir <dir>          Output root (default: artifacts/ui-generated/cap-candidates)
 *   --color-threshold <n>    BG removal colour distance (default: 28)
 *   --pad <n>                Crop padding after bg removal (default: 0)
 *   --slice-pad <n>          Padding around each slice (default: 4)
 *   --no-removebg            Skip background removal step (input already transparent)
 *   --keep-nobg              Keep the intermediate nobg PNG in out-dir
 *   --report                 Print per-image JSON stats summary
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
    const opts = {
        input:          null,
        outDir:         path.join('artifacts', 'ui-generated', 'cap-candidates'),
        colorThreshold: 28,
        pad:            0,
        slicePad:       4,
        removeBg:       true,
        keepNobg:       false,
        report:         false,
    };
    for (let i = 0; i < argv.length; i++) {
        const t = argv[i], n = argv[i + 1];
        switch (t) {
            case '--input':           opts.input          = n; i++; break;
            case '--out-dir':         opts.outDir         = n; i++; break;
            case '--color-threshold': opts.colorThreshold = Number(n); i++; break;
            case '--pad':             opts.pad            = Number(n); i++; break;
            case '--slice-pad':       opts.slicePad       = Number(n); i++; break;
            case '--no-removebg':     opts.removeBg       = false; break;
            case '--keep-nobg':       opts.keepNobg       = true; break;
            case '--report':          opts.report         = true; break;
        }
    }
    return opts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const node = process.execPath;
const dir  = path.resolve(__dirname);

function runScript(script, args) {
    const result = spawnSync(node, [path.join(dir, script), ...args], { encoding: 'utf8' });
    return result;
}

function collectImages(inputPath) {
    const stat = fs.statSync(inputPath);
    if (stat.isDirectory()) {
        return fs.readdirSync(inputPath)
            .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
            .map(f => path.join(inputPath, f))
            .sort();
    }
    return [inputPath];
}

// ---------------------------------------------------------------------------
// Process one image
// ---------------------------------------------------------------------------
function processImage(imgPath, opts) {
    const base    = path.basename(imgPath, path.extname(imgPath));
    const outDir  = path.resolve(opts.outDir, base);
    const nobgOut = path.join(outDir, `${base}_nobg.png`);

    fs.mkdirSync(outDir, { recursive: true });

    let sliceInput = imgPath;

    // Step 1 — bg removal
    if (opts.removeBg) {
        const args = [
            '--input',  imgPath,
            '--output', nobgOut,
            '--color-threshold', String(opts.colorThreshold),
            '--pad',    String(opts.pad),
            // crop enabled: tightly trim to foreground before slicing
        ];
        if (opts.report) args.push('--report');

        const r = runScript('remove-bg-flood-fill.js', args);
        if (r.status !== 0) {
            console.error(`[prep-and-slice] ❌ bg-removal failed for ${base}`);
            console.error(r.stderr || r.stdout);
            return null;
        }
        if (opts.report) {
            try {
                const lines = (r.stdout || '').split('\n').filter(l => l.trim().startsWith('{'));
                if (lines.length) console.log(`  bg-removal: ${lines.join('')}`);
            } catch (_) {}
        }
        sliceInput = nobgOut;
    }

    // Step 2 — slice
    const sliceDir = path.join(outDir, 'sliced');
    const args2 = [
        '--input',    sliceInput,
        '--out-dir',  sliceDir,
        '--pad',      String(opts.slicePad),
    ];
    const r2 = runScript('slice-ui-image-components.js', args2);
    if (r2.status !== 0) {
        console.error(`[prep-and-slice] ❌ slice failed for ${base}`);
        console.error(r2.stderr || r2.stdout);
        return null;
    }

    // Report slice summary
    const reportPath = path.join(sliceDir, 'slice-components-report.json');
    let sliceStats = null;
    if (fs.existsSync(reportPath)) {
        try {
            const rpt = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            const res = (rpt.results || [])[0] || {};
            sliceStats = { total: res.componentCount, kinds: res.countsByKind, picked: res.pickedCount };
        } catch (_) {}
    }

    // Cleanup intermediate nobg if not requested
    if (opts.removeBg && !opts.keepNobg && fs.existsSync(nobgOut)) {
        fs.unlinkSync(nobgOut);
    }

    return { image: base, outDir, sliceDir, nobg: opts.keepNobg ? nobgOut : null, sliceStats };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (!opts.input) {
        console.error('Usage: node tools_node/prep-and-slice.js --input <img|dir> [--out-dir <dir>] [options]');
        process.exit(1);
    }

    if (!fs.existsSync(opts.input)) {
        console.error(`[prep-and-slice] 找不到: ${opts.input}`);
        process.exit(1);
    }

    const images = collectImages(opts.input);
    console.log(`[prep-and-slice] 處理 ${images.length} 張圖片 → ${path.resolve(opts.outDir)}`);

    const results = [];
    for (const img of images) {
        process.stdout.write(`  ${path.basename(img)} ... `);
        const r = processImage(img, opts);
        if (r) {
            const s = r.sliceStats;
            const summary = s ? `${s.total ?? '?'} 件 (${JSON.stringify(s.kinds)})` : '?';
            console.log(`✓  切出 ${summary}`);
            results.push(r);
        } else {
            console.log('✗');
        }
    }

    console.log(`\n[prep-and-slice] 完成 ${results.length}/${images.length}，待選區: ${path.resolve(opts.outDir)}`);
}

main();
