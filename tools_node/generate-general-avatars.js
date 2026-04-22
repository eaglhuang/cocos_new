#!/usr/bin/env node
/**
 * generate-general-avatars.js
 *
 * 從武將立繪裁切頭像並縮放至目標尺寸，輸出到
 * assets/resources/sprites/generals/avatars/{id}_avatar.png
 *
 * 用法：
 *   node tools_node/generate-general-avatars.js          # 產生所有武將
 *   node tools_node/generate-general-avatars.js guan-yu  # 只產生指定武將
 *   node tools_node/generate-general-avatars.js --verify # 只驗證設定，不寫檔
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT       = path.resolve(__dirname, '..');
const CROPS_PATH = path.join(ROOT, 'assets/resources/data/general-avatar-crops.json');
const SRC_DIR    = path.join(ROOT, 'assets/resources/sprites/generals');
const OUT_DIR    = path.join(ROOT, 'assets/resources/sprites/generals/avatars');

// ─── 引數解析 ──────────────────────────────────────────────────────────────

const args     = process.argv.slice(2);
const verifyOnly = args.includes('--verify');
const targetId   = args.find(a => !a.startsWith('--')) ?? null;

// ─── 設定載入 ──────────────────────────────────────────────────────────────

function loadCrops() {
    if (!fs.existsSync(CROPS_PATH)) {
        console.error(`❌ 找不到裁切設定檔：${path.relative(ROOT, CROPS_PATH)}`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(CROPS_PATH, 'utf8'));
}

// ─── 圖片處理 ──────────────────────────────────────────────────────────────

/**
 * 使用 Box Filter 將 srcPng 的 (cropX, cropY, cropW, cropH) 區域
 * 縮放到 outSize × outSize 輸出。
 */
function cropAndResize(srcPng, cropX, cropY, cropW, cropH, outSize) {
    const out = new PNG({ width: outSize, height: outSize, filterType: -1 });
    out.data = Buffer.alloc(outSize * outSize * 4);

    const scaleX = cropW / outSize;
    const scaleY = cropH / outSize;

    for (let oy = 0; oy < outSize; oy++) {
        for (let ox = 0; ox < outSize; ox++) {
            const sx0 = cropX + ox * scaleX;
            const sy0 = cropY + oy * scaleY;
            const sx1 = sx0 + scaleX;
            const sy1 = sy0 + scaleY;

            let r = 0, g = 0, b = 0, a = 0, total = 0;

            const ixMin = Math.max(0, Math.floor(sx0));
            const ixMax = Math.min(srcPng.width  - 1, Math.ceil(sx1 - 1e-9));
            const iyMin = Math.max(0, Math.floor(sy0));
            const iyMax = Math.min(srcPng.height - 1, Math.ceil(sy1 - 1e-9));

            for (let iy = iyMin; iy <= iyMax; iy++) {
                for (let ix = ixMin; ix <= ixMax; ix++) {
                    const wx = Math.min(ix + 1, sx1) - Math.max(ix, sx0);
                    const wy = Math.min(iy + 1, sy1) - Math.max(iy, sy0);
                    const w  = Math.max(0, wx) * Math.max(0, wy);
                    if (w <= 0) continue;

                    const si = (iy * srcPng.width + ix) * 4;
                    r += srcPng.data[si]     * w;
                    g += srcPng.data[si + 1] * w;
                    b += srcPng.data[si + 2] * w;
                    a += srcPng.data[si + 3] * w;
                    total += w;
                }
            }

            const oi = (oy * outSize + ox) * 4;
            out.data[oi]     = total > 0 ? Math.round(r / total) : 0;
            out.data[oi + 1] = total > 0 ? Math.round(g / total) : 0;
            out.data[oi + 2] = total > 0 ? Math.round(b / total) : 0;
            out.data[oi + 3] = total > 0 ? Math.round(a / total) : 0;
        }
    }

    return out;
}

// ─── 單一武將處理 ──────────────────────────────────────────────────────────

function processGeneral(generalId, crop, outputSize) {
    const fileId  = generalId.replace(/-/g, '_');
    const srcPath = path.join(SRC_DIR, `${fileId}_portrait.png`);
    const outPath = path.join(OUT_DIR,  `${fileId}_avatar.png`);

    if (!fs.existsSync(srcPath)) {
        console.warn(`  ⚠  找不到源圖，跳過：${path.relative(ROOT, srcPath)}`);
        return false;
    }

    // 讀取源圖尺寸（PNG IHDR bytes 16-24）
    const header = fs.readFileSync(srcPath, null).slice(0, 32);
    const srcW   = header.readUInt32BE(16);
    const srcH   = header.readUInt32BE(20);

    const { x, y, w, h } = crop;

    // 驗證裁切區域
    const errors = [];
    if (x < 0 || x >= srcW)      errors.push(`x=${x} 超出圖寬 ${srcW}`);
    if (y < 0 || y >= srcH)      errors.push(`y=${y} 超出圖高 ${srcH}`);
    if (x + w > srcW)             errors.push(`x+w=${x+w} 超出圖寬 ${srcW}`);
    if (y + h > srcH)             errors.push(`y+h=${y+h} 超出圖高 ${srcH}`);
    if (w <= 0 || h <= 0)         errors.push(`裁切尺寸無效 w=${w} h=${h}`);
    if (errors.length > 0) {
        console.error(`  ❌ ${generalId}：裁切設定有誤`);
        errors.forEach(e => console.error(`       - ${e}`));
        return false;
    }

    console.log(`  ✓  ${generalId.padEnd(20)} 源圖 ${srcW}×${srcH}  裁切 (${x},${y})+${w}×${h}  → ${outputSize}×${outputSize}`);

    if (verifyOnly) return true;

    // 讀取完整 PNG
    const srcPng = PNG.sync.read(fs.readFileSync(srcPath));

    // 裁切 + 縮放
    const outPng = cropAndResize(srcPng, x, y, w, h, outputSize);

    // 輸出
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(outPath, PNG.sync.write(outPng));
    return true;
}

// ─── 主流程 ───────────────────────────────────────────────────────────────

function main() {
    const config  = loadCrops();
    const outSize = config.outputSize ?? 256;
    const crops   = config.crops ?? {};

    const ids = targetId
        ? (crops[targetId] ? [targetId] : (() => { console.error(`❌ 找不到設定：${targetId}`); process.exit(1); })())
        : Object.keys(crops);

    if (!verifyOnly) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    console.log(`\n武將頭像生成${verifyOnly ? '（驗證模式）' : ''}：共 ${ids.length} 筆\n`);

    let ok = 0, fail = 0;
    for (const id of ids) {
        const success = processGeneral(id, crops[id], outSize);
        success ? ok++ : fail++;
    }

    console.log(`\n結果：${ok} 成功  ${fail} 失敗`);
    if (!verifyOnly && ok > 0) {
        console.log(`輸出目錄：${path.relative(ROOT, OUT_DIR)}`);
        console.log('\n⚠  注意：新增 PNG 後需在 Cocos Creator 中重新匯入（Refresh Assets）才會更新 .meta');
    }
    if (fail > 0) process.exit(1);
}

main();
