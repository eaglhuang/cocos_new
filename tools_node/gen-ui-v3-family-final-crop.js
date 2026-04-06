#!/usr/bin/env node
/**
 * tools_node/gen-ui-v3-family-final-crop.js
 * 
 * 任務：從單一 V3 極簡家族素材中裁切出正式 9-slice 與組件。
 * 目標路徑：assets/resources/sprites/ui_families/general_detail/v3_final/
 */

const fs = require('fs');
const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer-core');
} catch (e) {
    process.exit(1);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FINAL_DIR = path.join(PROJECT_ROOT, 'assets', 'resources', 'sprites', 'ui_families', 'general_detail', 'v3_final');
const SOURCE = path.join(FINAL_DIR, 'jade_family_source_v3.png');

const CROPS = [
    // 1. Jade Parchment Panel (9-slice)
    { id: 'panel_header_band', width: 600, height: 80, x: 50, y: 50 },
    { id: 'panel_header_cap_l', width: 40, height: 80, x: 10, y: 50 },
    { id: 'panel_header_cap_r', width: 40, height: 80, x: 650, y: 50 },
    { id: 'panel_body_frame', width: 600, height: 600, x: 50, y: 150 },
    { id: 'panel_body_fill', width: 128, height: 128, x: 700, y: 150 },
    
    // 2. Crest Medallion (Flat Stamp Style)
    { id: 'crest_ring_flat', width: 220, height: 220, x: 50, y: 780 },
    { id: 'crest_face_flat', width: 180, height: 180, x: 300, y: 800 },
    
    // 3. Rarity Badges (Family Consistent)
    { id: 'badge_family_common', width: 180, height: 44, x: 600, y: 780 },
    { id: 'badge_family_rare', width: 180, height: 44, x: 600, y: 830 },
    { id: 'badge_family_epic', width: 180, height: 44, x: 600, y: 880 },
    { id: 'badge_family_legendary', width: 180, height: 44, x: 600, y: 930 },

    // 4. Story Strip Component (Add-on)
    { id: 'story_strip_base', width: 600, height: 100, x: 50, y: 1000 }
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
    if (!browserPath) process.exit(1);

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    
    try {
        const srcDataUrl = `data:image/png;base64,${fs.readFileSync(SOURCE).toString('base64')}`;
        for (const crop of CROPS) {
            const html = `<html><body style="margin:0; background:transparent;">
                <div style="width:${crop.width}px; height:${crop.height}px; 
                     background-image:url('${srcDataUrl}'); 
                     background-position:-${crop.x}px -${crop.y}px; 
                     background-repeat:no-repeat;"></div>
                </body></html>`;

            const page = await browser.newPage();
            await page.setViewport({ width: crop.width, height: crop.height });
            await page.setContent(html);
            await page.screenshot({ path: path.join(FINAL_DIR, `${crop.id}.png`), omitBackground: true });
            console.log(`✓ Cropped: ${crop.id}.png`);
            await page.close();
        }
    } finally {
        await browser.close();
    }
    console.log('V3 Family Final 裁切完成');
}

main().catch(console.error);
