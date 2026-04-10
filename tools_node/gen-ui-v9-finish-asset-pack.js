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

const srcMedallion = findImage('ui_crest_medallion_v9');
const srcHeader = findImage('ui_header_ornament_v9');
const srcFrame = findImage('ui_portrait_frame_v9');

console.log("Found V9 Sources:", {srcMedallion, srcHeader, srcFrame});

const JOBS = [
    { target: 'crest_ring_final.png', src: srcMedallion, w: 220, h: 220, type: 'fit_circle' },
    { target: 'crest_face_final.png', src: srcMedallion, w: 180, h: 180, type: 'filtered_watermark' },
    { target: 'header_ornament_l.png', src: srcHeader, w: 160, h: 100, type: 'crop_left' },
    { target: 'header_ornament_r.png', src: srcHeader, w: 160, h: 100, type: 'crop_right' },
    { target: 'portrait_frame_final.png', src: srcFrame, w: 600, h: 900, type: 'fit_rect' }
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
    
    if(!fs.existsSync(FINAL_DIR)) { fs.mkdirSync(FINAL_DIR, {recursive: true}); }

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    
    try {
        for (const job of JOBS) {
            if(!job.src) { console.warn("Skip", job.target); continue; }
            const srcDataUrl = `data:image/png;base64,${fs.readFileSync(job.src).toString('base64')}`;
            
            let css = "";
            let filter = "";
            let innerHtml = "";
            
            if (job.type === 'filtered_watermark') {
                filter = "filter: grayscale(80%) opacity(80%) brightness(105%) contrast(110%);";
                css = `background-image:url('${srcDataUrl}'); background-size: cover; background-position: center; border-radius: 50%; mix-blend-mode: multiply;`;
            } else if(job.type === 'fit_circle') {
                css = `background-image:url('${srcDataUrl}'); background-size: contain; background-position: center; border-radius: 50%; mix-blend-mode: multiply;`;
            } else if (job.type === 'crop_left') {
                css = `background-image:url('${srcDataUrl}'); background-size: cover; background-position: left center; mix-blend-mode: multiply;`;
            } else if (job.type === 'crop_right') {
                css = `background-image:url('${srcDataUrl}'); background-size: cover; background-position: right center; mix-blend-mode: multiply;`;
            } else if (job.type === 'fit_rect') {
                css = `background-image:url('${srcDataUrl}'); background-size: 100% 100%; mix-blend-mode: multiply;`;
            }

            const html = `<html><body style="margin:0; background:transparent;">
                <div style="width:${job.w}px; height:${job.h}px; ${css} ${filter} background-repeat:no-repeat;">${innerHtml}</div>
                </body></html>`;

            const page = await browser.newPage();
            await page.setViewport({ width: job.w, height: job.h });
            await page.setContent(html);
            await page.screenshot({ path: path.join(FINAL_DIR, job.target), omitBackground: true });
            console.log(`✓ Generated: ${job.target}`);
            await page.close();
        }
    } finally {
        await browser.close();
    }
    console.log('V9 Final Asset Pack Done');
}

main().catch(console.error);
