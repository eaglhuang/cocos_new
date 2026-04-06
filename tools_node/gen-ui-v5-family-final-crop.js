#!/usr/bin/env node
/**
 * tools_node/gen-ui-v5-family-final-crop.js
 * 
 * 任務：達成 100% 正式家族替換。
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
const SOURCE_V5 = path.join(FINAL_DIR, 'jade_family_v5_kit.png');

const CROPS = [
    // 1. Refined Crest (V5 Low contrast)
    { id: 'crest_ring_v5', width: 220, height: 220, x: 50, y: 50 },
    { id: 'crest_face_v5', width: 180, height: 180, x: 300, y: 70 },
    
    // 2. Refined Badges (V5 Minimalist)
    { id: 'badge_family_common_v5', width: 180, height: 44, x: 550, y: 50 },
    { id: 'badge_family_rare_v5', width: 180, height: 44, x: 550, y: 100 },
    { id: 'badge_family_epic_v5', width: 180, height: 44, x: 550, y: 150 },
    { id: 'badge_family_legendary_v5', width: 180, height: 44, x: 550, y: 200 },

    // 3. Story Strip (V5)
    { id: 'story_strip_base_v5', width: 600, height: 100, x: 50, y: 400 },
    { id: 'story_strip_cap_l_v5', width: 60, height: 100, x: 10, y: 400 },
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
        const srcDataUrl = `data:image/png;base64,${fs.readFileSync(SOURCE_V5).toString('base64')}`;
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
    console.log('V5 Full Family Final 裁切完成');
}

main().catch(console.error);
