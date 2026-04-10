#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer-core');
} catch (e) {
    process.exit(1);
}

const FORMAL_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'sprites', 'ui_families', 'general_detail', 'formal');
const ARTIFACT_DIR = path.resolve(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share"), '../.gemini/antigravity/brain/16e54070-ebe9-46f9-a875-de60756048f9');

let actualArtifactDir = ARTIFACT_DIR;
if(!fs.existsSync(ARTIFACT_DIR)) {
    const fallbacks = ['C:/Users/User/.gemini/antigravity/brain/16e54070-ebe9-46f9-a875-de60756048f9'];
    for (const f of fallbacks) { if(fs.existsSync(f)) { actualArtifactDir = f; break; } }
}

function findImage(prefix) {
    const files = fs.readdirSync(actualArtifactDir);
    const matches = files.filter(f => f.startsWith(prefix) && f.endsWith('.png'));
    matches.sort((a,b) => fs.statSync(path.join(actualArtifactDir, b)).mtimeMs - fs.statSync(path.join(actualArtifactDir, a)).mtimeMs);
    return matches.length > 0 ? path.join(actualArtifactDir, matches[0]) : null;
}

const srcCrestFace = findImage('crest_face_formal');
const srcCrestRing = findImage('crest_ring_formal');
const srcHeaderCaps = findImage('header_caps_formal');
const srcBadges = findImage('rarity_badges_formal');

const JOBS = [
    { target: 'crest_face_formal.png', src: srcCrestFace, w: 180, h: 180, type: 'fit_circle' },
    { target: 'crest_ring_formal.png', src: srcCrestRing, w: 220, h: 220, type: 'fit_circle' },
    { target: 'header_cap_left_formal.png', src: srcHeaderCaps, w: 120, h: 100, type: 'crop_left' },
    { target: 'header_cap_right_formal.png', src: srcHeaderCaps, w: 120, h: 100, type: 'crop_right' },
    { target: 'rarity_badge_common.png', src: srcBadges, w: 40, h: 56, type: 'crop_x1' },
    { target: 'rarity_badge_rare.png', src: srcBadges, w: 40, h: 56, type: 'crop_x2' },
    { target: 'rarity_badge_epic.png', src: srcBadges, w: 40, h: 56, type: 'crop_x3' },
    { target: 'rarity_badge_legendary.png', src: srcBadges, w: 40, h: 56, type: 'crop_x4' },
    { target: 'rarity_badge_mythic.png', src: srcBadges, w: 40, h: 56, type: 'crop_x5' },
];

function resolveBrowser() {
    const candidates = [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    ];
    for (const c of candidates) { if (fs.existsSync(c)) return c; }
    return '';
}

async function main() {
    const browserPath = resolveBrowser();
    if (!browserPath) { console.error("No browser"); return; }
    if(!fs.existsSync(FORMAL_DIR)) { fs.mkdirSync(FORMAL_DIR, {recursive: true}); }

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    
    try {
        for (const job of JOBS) {
            if(!job.src) { console.warn("Skip", job.target); continue; }
            const srcDataUrl = `data:image/png;base64,${fs.readFileSync(job.src).toString('base64')}`;
            
            let css = "";
            let filter = "mix-blend-mode: multiply;";
            
            if(job.type === 'fit_circle') {
                css = `background-image:url('${srcDataUrl}'); background-size: contain; background-position: center; border-radius: 50%;`;
            } else if (job.type === 'crop_left') {
                css = `background-image:url('${srcDataUrl}'); background-size: cover; background-position: left center;`;
            } else if (job.type === 'crop_right') {
                css = `background-image:url('${srcDataUrl}'); background-size: cover; background-position: right center;`;
            } else if (job.type.startsWith('crop_x')) {
                const idx = parseInt(job.type.replace('crop_x', '')) - 1;
                const percent = idx * 25; // 0, 25, 50, 75, 100 for 5 items
                css = `background-image:url('${srcDataUrl}'); background-size: auto 100%; background-position: ${percent}% center;`;
            }

            const html = `<html><body style="margin:0; background:transparent;">
                <div style="width:${job.w}px; height:${job.h}px; ${css} ${filter} background-repeat:no-repeat;"></div>
                </body></html>`;

            const page = await browser.newPage();
            await page.setViewport({ width: job.w, height: job.h });
            await page.setContent(html);
            await page.screenshot({ path: path.join(FORMAL_DIR, job.target), omitBackground: true });
            console.log(`✓ Generated: ${job.target}`);
            await page.close();
        }
    } finally {
        await browser.close();
    }
    console.log('Formal Assets Pack Done');
}

main().catch(console.error);
