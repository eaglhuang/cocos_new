#!/usr/bin/env node
/**
 * convert-jpeg-to-png.js
 * Batch convert JPEG files to PNG (lossless pixel-for-pixel).
 * Uses jpeg-js + pngjs — no native bindings needed.
 *
 * Usage:
 *   node tools_node/convert-jpeg-to-png.js --input <file-or-dir> --out-dir <dir>
 *   node tools_node/convert-jpeg-to-png.js --input <file-or-dir>   (overwrites to same folder)
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

function parseArgs(argv) {
    const opts = { input: null, outDir: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--input')   { opts.input  = argv[++i]; }
        if (argv[i] === '--out-dir') { opts.outDir = argv[++i]; }
    }
    return opts;
}

function convertOne(src, dest) {
    const raw = jpeg.decode(fs.readFileSync(src), { useTArray: true, formatAsRGBA: true });
    const png = new PNG({ width: raw.width, height: raw.height });
    png.data = Buffer.from(raw.data);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, PNG.sync.write(png));
    return { width: raw.width, height: raw.height };
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (!opts.input) {
        console.error('Usage: node tools_node/convert-jpeg-to-png.js --input <file|dir> [--out-dir <dir>]');
        process.exit(1);
    }

    const inputPath = path.resolve(opts.input);
    const stat = fs.statSync(inputPath);
    const files = stat.isDirectory()
        ? fs.readdirSync(inputPath).filter(f => /\.jpe?g$/i.test(f)).map(f => path.join(inputPath, f))
        : [inputPath];

    if (files.length === 0) {
        console.log('[convert-jpeg-to-png] 找不到 JPEG 檔');
        return;
    }

    let ok = 0;
    for (const src of files) {
        const base    = path.basename(src, path.extname(src)) + '.png';
        const destDir = opts.outDir ? path.resolve(opts.outDir) : path.dirname(src);
        const dest    = path.join(destDir, base);
        try {
            const { width, height } = convertOne(src, dest);
            console.log(`  ✓ ${path.basename(src)}  →  ${base}  (${width}×${height})`);
            ok++;
        } catch (err) {
            console.error(`  ✗ ${path.basename(src)}: ${err.message}`);
        }
    }
    console.log(`[convert-jpeg-to-png] 完成 ${ok}/${files.length}`);
}

main();
