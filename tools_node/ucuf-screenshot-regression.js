#!/usr/bin/env node
// @spec-source → docs/UCUF規範文件.md §6  (UCUF M6)
/**
 * ucuf-screenshot-regression.js
 *
 * UCUF M6 — UI 截圖回歸測試工具
 *
 * 對 baseline 目錄與 current 目錄中的同名 PNG 檔案進行像素差異比對（pixelmatch + pngjs）。
 * 若 current 目錄中找不到對應 PNG，則標記為 MISSING；
 * 若差異百分比超過 --threshold（預設 5%），在 --strict 模式下 exit 1。
 *
 * CLI:
 *   node tools_node/ucuf-screenshot-regression.js
 *   node tools_node/ucuf-screenshot-regression.js --screens general-detail --baseline artifacts/screenshots/baseline --threshold 5
 *   node tools_node/ucuf-screenshot-regression.js --strict
 *
 * Unity 對照：Automated UI Testing / Graphics Test Framework 的 screenshot diff 管線。
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        screens:   [],        // --screens <csv>  篩選畫面 ID
        baseline:  'artifacts/screenshots/baseline',
        current:   'artifacts/screenshots/current',
        output:    null,      // --output <path>  diff-report JSON 輸出路徑
        threshold: 5,         // 允許 5% 像素差異
        strict:    false,
        help:      false,
    };
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--screens':   opts.screens   = args[++i].split(',').map(s => s.trim()); break;
            case '--baseline':  opts.baseline  = args[++i]; break;
            case '--current':   opts.current   = args[++i]; break;
            case '--output':    opts.output    = args[++i]; break;
            case '--threshold': opts.threshold = Number(args[++i]); break;
            case '--strict':    opts.strict    = true; break;
            case '--help': case '-h': opts.help = true; break;
        }
    }
    return opts;
}

function printHelp() {
    console.log(`
Usage: node tools_node/ucuf-screenshot-regression.js [options]

Options:
  --screens <csv>     Comma-separated screen IDs to test (default: all PNG files in baseline)
  --baseline <dir>    Baseline screenshots directory (default: artifacts/screenshots/baseline)
  --current  <dir>    Current screenshots directory  (default: artifacts/screenshots/current)
  --output   <path>   Write diff-report JSON to this path (optional)
  --threshold <pct>   Max allowed pixel diff % (default: 5)
  --strict            Exit 1 if any diff exceeds threshold or any file is MISSING
  --help, -h          Show this help
`);
}

// ─── PNG diff ─────────────────────────────────────────────────────────────────

/**
 * 比對兩個 PNG 檔案，回傳 { diffPct, totalPixels, diffPixels }。
 * 若 pixelmatch / pngjs 無法載入或 PNG 尺寸不符，回傳 error 字串。
 */
function comparePng(baselinePath, currentPath) {
    let pixelmatch, PNG;
    try {
        pixelmatch = require('pixelmatch');
        ({ PNG } = require('pngjs'));
    } catch (e) {
        return { error: `依賴套件缺失：${e.message}` };
    }

    try {
        const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
        const img2 = PNG.sync.read(fs.readFileSync(currentPath));

        if (img1.width !== img2.width || img1.height !== img2.height) {
            return {
                error: `尺寸不符：baseline=${img1.width}x${img1.height} current=${img2.width}x${img2.height}`,
            };
        }

        const { width, height } = img1;
        const diff = new PNG({ width, height });
        const diffPixels = pixelmatch(
            img1.data, img2.data, diff.data,
            width, height,
            { threshold: 0.1 },
        );
        const totalPixels = width * height;
        const diffPct = (diffPixels / totalPixels) * 100;

        return { diffPct, totalPixels, diffPixels, width, height };
    } catch (e) {
        return { error: `PNG 讀取失敗：${e.message}` };
    }
}

// ─── メイン ────────────────────────────────────────────────────────────────────

function main() {
    const opts = parseArgs();
    if (opts.help) { printHelp(); process.exit(0); }

    const projectRoot = path.resolve(__dirname, '..');
    const baselineDir = path.resolve(projectRoot, opts.baseline);
    const currentDir  = path.resolve(projectRoot, opts.current);

    console.log('[ucuf-screenshot-regression] 截圖回歸測試工具（M6 實作版）');
    console.log(`  baseline : ${baselineDir}`);
    console.log(`  current  : ${currentDir}`);
    console.log(`  threshold: ${opts.threshold}%`);
    console.log(`  strict   : ${opts.strict}`);
    console.log('');

    // ── 取得 baseline 中的 PNG 列表 ──────────────────────────────────────────
    if (!fs.existsSync(baselineDir)) {
        console.log(`[ucuf-screenshot-regression] baseline 目錄不存在：${baselineDir}`);
        console.log('[ucuf-screenshot-regression] 無可比對的截圖，exit 0（尚無 baseline）');
        process.exit(0);
    }

    let pngFiles = fs.readdirSync(baselineDir)
        .filter(f => f.endsWith('.png'));

    if (opts.screens.length > 0) {
        pngFiles = pngFiles.filter(f => {
            const name = path.basename(f, '.png');
            return opts.screens.some(s => name.startsWith(s));
        });
    }

    if (pngFiles.length === 0) {
        console.log('[ucuf-screenshot-regression] 沒有符合條件的 baseline PNG，exit 0');
        process.exit(0);
    }

    // ── 比對每個 PNG ──────────────────────────────────────────────────────────
    const results = [];
    let regressionCount = 0;
    let missingCount = 0;

    for (const file of pngFiles) {
        const bPath = path.join(baselineDir, file);
        const cPath = path.join(currentDir,  file);
        const entry = { file };

        if (!fs.existsSync(cPath)) {
            entry.status = 'MISSING';
            entry.message = `current 目錄中找不到 ${file}`;
            missingCount++;
            console.log(`  [MISSING] ${file}`);
        } else {
            const r = comparePng(bPath, cPath);
            if (r.error) {
                entry.status = 'ERROR';
                entry.message = r.error;
                console.log(`  [ERROR  ] ${file} — ${r.error}`);
            } else {
                const { diffPct, diffPixels, totalPixels } = r;
                const exceeded = diffPct > opts.threshold;
                entry.status = exceeded ? 'REGRESSION' : 'PASS';
                entry.diffPct = +diffPct.toFixed(2);
                entry.diffPixels = diffPixels;
                entry.totalPixels = totalPixels;
                if (exceeded) {
                    regressionCount++;
                    console.log(`  [REGRESS] ${file} — diff=${diffPct.toFixed(2)}% (threshold=${opts.threshold}%)`);
                } else {
                    console.log(`  [PASS   ] ${file} — diff=${diffPct.toFixed(2)}%`);
                }
            }
        }
        results.push(entry);
    }

    // ── 輸出 JSON 報告 ─────────────────────────────────────────────────────────
    const report = {
        generatedAt: new Date().toISOString(),
        baselineDir: opts.baseline,
        currentDir:  opts.current,
        threshold:   opts.threshold,
        summary: {
            total:       results.length,
            pass:        results.filter(r => r.status === 'PASS').length,
            regression:  regressionCount,
            missing:     missingCount,
            error:       results.filter(r => r.status === 'ERROR').length,
        },
        results,
    };

    console.log('');
    console.log(`[ucuf-screenshot-regression] 完成：${report.summary.total} 張，PASS=${report.summary.pass}，REGRESSION=${regressionCount}，MISSING=${missingCount}`);

    if (opts.output) {
        const outPath = path.resolve(projectRoot, opts.output);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
        console.log(`[ucuf-screenshot-regression] 報告已寫入：${outPath}`);
    }

    if (opts.strict && (regressionCount > 0 || missingCount > 0)) {
        console.log('[ucuf-screenshot-regression] --strict 模式：偵測到回歸或缺漏，exit 1');
        process.exit(1);
    }

    process.exit(0);
}

main();

