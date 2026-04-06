#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer-core');
} catch (e) {
    process.exit(1);
}

const FINAL_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'sprites', 'ui_families', 'general_detail', 'v3_final');
const ARTIFACT_DIR = path.resolve(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share"), '../.gemini/antigravity/brain/16e54070-ebe9-46f9-a875-de60756048f9');

// fallback directory logic for artifacts depending on OS/user path
const fallbacks = [
    'C:/Users/User/.gemini/antigravity/brain/16e54070-ebe9-46f9-a875-de60756048f9'
];

let actualArtifactDir = ARTIFACT_DIR;
if(!fs.existsSync(ARTIFACT_DIR)) {
    for (let f of fallbacks) {
        if(fs.existsSync(f)) {
            actualArtifactDir = f;
            break;
        }
    }
}

function findImage(prefix) {
    const files = fs.readdirSync(actualArtifactDir);
    const matches = files.filter(f => f.startsWith(prefix) && f.endsWith('.png'));
    matches.sort((a,b) => fs.statSync(path.join(actualArtifactDir, b)).mtimeMs - fs.statSync(path.join(actualArtifactDir, a)).mtimeMs);
    return matches.length > 0 ? path.join(actualArtifactDir, matches[0]) : null;
}

const crestRingV6 = findImage('crest_ring_v6_');
const crestFaceV6 = findImage('crest_face_v6_');
const badgeV6 = findImage('rarity_badge_v6_');
const storyV6 = findImage('story_strip_v6_');

console.log("Found:", {crestRingV6, crestFaceV6, badgeV6, storyV6});

const JOBS = [
    { target: 'crest_ring_v5.png', src: crestRingV6, w: 220, h: 220, type: 'fit_circle' },
    { target: 'crest_face_v5.png', src: crestFaceV6, w: 180, h: 180, type: 'fit_circle' },
    { target: 'badge_family_common_v5.png', src: badgeV6, w: 180, h: 44, type: 'fit_rect' },
    { target: 'badge_family_rare_v5.png', src: badgeV6, w: 180, h: 44, type: 'fit_rect' },
    { target: 'badge_family_epic_v5.png', src: badgeV6, w: 180, h: 44, type: 'fit_rect' },
    { target: 'badge_family_legendary_v5.png', src: badgeV6, w: 180, h: 44, type: 'fit_rect' },
    { target: 'story_strip_base_v5.png', src: storyV6, w: 600, h: 100, type: 'stretch' }
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
    if (!browserPath) { console.error("No browser"); return; }
    
    for (let job of JOBS) {
        if(!job.src) { console.warn("Skipping", job.target, "no source"); continue; }
    }

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    
    try {
        for (const job of JOBS) {
            if(!job.src) continue;
            const srcDataUrl = `data:image/png;base64,${fs.readFileSync(job.src).toString('base64')}`;
            
            let css = "";
            if(job.type === 'fit_circle') {
                css = `background-image:url('${srcDataUrl}'); background-size: contain; background-position: center; border-radius: 50%; mix-blend-mode: multiply;`;
            } else if (job.type === 'fit_rect') {
                css = `background-image:url('${srcDataUrl}'); background-size: contain; background-position: center; mix-blend-mode: multiply;`;
            } else {
                css = `background-image:url('${srcDataUrl}'); background-size: 100% 100%; mix-blend-mode: multiply;`;
            }

            const html = `<html><body style="margin:0; background:transparent;">
                <div style="width:${job.w}px; height:${job.h}px; ${css} background-repeat:no-repeat;"></div>
                </body></html>`;

            const page = await browser.newPage();
            await page.setViewport({ width: job.w, height: job.h });
            await page.setContent(html);
            await page.screenshot({ path: path.join(FINAL_DIR, job.target), omitBackground: true });
            console.log(`✓ Replaced: ${job.target}`);
            await page.close();
        }
    } finally {
        await browser.close();
    }
    console.log('V6 Clean Asset Swap 完成');
}

main().catch(console.error);
