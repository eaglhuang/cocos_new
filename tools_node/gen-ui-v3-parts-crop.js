#!/usr/bin/env node
/**
 * tools_node/gen-ui-v3-parts-crop.js
 * 
 * 任務：從 AI 生成的原始素材中裁切出 jade-parchment, crest, rarity badge 的正式碎圖。
 * 對接 V2 Flat-style source.
 */

const fs = require('fs');
const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer-core');
} catch (e) {
    console.error('缺少依賴 puppeteer-core');
    process.exit(1);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SPRITES_DIR = path.join(PROJECT_ROOT, 'assets', 'resources', 'sprites', 'ui_families', 'general_detail');

const CROPS = [
    // 1. Jade Parchment Panel (V2 Flat)
    {
        id: 'parchment_header_band',
        src: path.join(SPRITES_DIR, 'v3_parts', 'jade_parchment_source_flat.png'),
        outDir: path.join(SPRITES_DIR, 'v3_parts'),
        width: 800, height: 100, x: 100, y: 100,
    },
    {
        id: 'parchment_header_cap_left',
        src: path.join(SPRITES_DIR, 'v3_parts', 'jade_parchment_source_flat.png'),
        outDir: path.join(SPRITES_DIR, 'v3_parts'),
        width: 60, height: 100, x: 40, y: 100,
    },
    {
        id: 'parchment_header_cap_right',
        src: path.join(SPRITES_DIR, 'v3_parts', 'jade_parchment_source_flat.png'),
        outDir: path.join(SPRITES_DIR, 'v3_parts'),
        width: 60, height: 100, x: 900, y: 100,
    },
    {
        id: 'parchment_body_frame_flat',
        src: path.join(SPRITES_DIR, 'v3_parts', 'jade_parchment_source_flat.png'),
        outDir: path.join(SPRITES_DIR, 'v3_parts'),
        width: 600, height: 600, x: 100, y: 250,
    },
    {
        id: 'parchment_body_fill_flat',
        src: path.join(SPRITES_DIR, 'v3_parts', 'jade_parchment_source_flat.png'),
        outDir: path.join(SPRITES_DIR, 'v3_parts'),
        width: 128, height: 128, x: 750, y: 250,
    },

    // 2. Crest Medallion (V2 Flat Seal Style)
    {
        id: 'medallion_ring_flat',
        src: path.join(SPRITES_DIR, 'crest', 'final', 'medallion_source_flat.png'),
        outDir: path.join(SPRITES_DIR, 'crest', 'final'),
        width: 256, height: 256, x: 50, y: 50,
    },
    {
        id: 'medallion_face_flat',
        src: path.join(SPRITES_DIR, 'crest', 'final', 'medallion_source_flat.png'),
        outDir: path.join(SPRITES_DIR, 'crest', 'final'),
        width: 220, height: 220, x: 320, y: 50,
    },

    // 3. Rarity Badges (V2 Flat Ornament)
    {
        id: 'badge_rarity_common_flat',
        src: path.join(SPRITES_DIR, 'icons', 'v3_parts', 'rarity_badges_source_flat.png'),
        outDir: path.join(SPRITES_DIR, 'icons', 'v3_parts'),
        width: 180, height: 50, x: 30, y: 30,
    },
    {
        id: 'badge_rarity_rare_flat',
        src: path.join(SPRITES_DIR, 'icons', 'v3_parts', 'rarity_badges_source_flat.png'),
        outDir: path.join(SPRITES_DIR, 'icons', 'v3_parts'),
        width: 180, height: 50, x: 30, y: 90,
    },
    {
        id: 'badge_rarity_epic_flat',
        src: path.join(SPRITES_DIR, 'icons', 'v3_parts', 'rarity_badges_source_flat.png'),
        outDir: path.join(SPRITES_DIR, 'icons', 'v3_parts'),
        width: 180, height: 50, x: 30, y: 150,
    },
    {
        id: 'badge_rarity_legendary_flat',
        src: path.join(SPRITES_DIR, 'icons', 'v3_parts', 'rarity_badges_source_flat.png'),
        outDir: path.join(SPRITES_DIR, 'icons', 'v3_parts'),
        width: 180, height: 50, x: 30, y: 210,
    }
];

function resolveBrowser() {
    const candidates = [
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ];
    for (const c of candidates) { if (fs.existsSync(c)) return c; }
    return '';
}

async function main() {
    const browserPath = resolveBrowser();
    if (!browserPath) { console.error('No browser found'); process.exit(1); }

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    
    try {
        for (const crop of CROPS) {
            if (!fs.existsSync(crop.src)) { console.warn(`Missing source: ${crop.src}`); continue; }

            const srcDataUrl = `data:image/png;base64,${fs.readFileSync(crop.src).toString('base64')}`;
            const html = `<html><body style="margin:0; background:transparent;">
                <div style="width:${crop.width}px; height:${crop.height}px; 
                     background-image:url('${srcDataUrl}'); 
                     background-position:-${crop.x}px -${crop.y}px; 
                     background-repeat:no-repeat;"></div>
                </body></html>`;

            const page = await browser.newPage();
            await page.setViewport({ width: crop.width, height: crop.height });
            await page.setContent(html);
            
            const outPath = path.join(crop.outDir, `${crop.id}.png`);
            await page.screenshot({ path: outPath, omitBackground: true });
            console.log(`✓ Cropped: ${crop.id}.png`);
            await page.close();
        }
    } finally {
        await browser.close();
    }
    console.log('裁切完成 (V2 Flat)');
}

main().catch(console.error);
