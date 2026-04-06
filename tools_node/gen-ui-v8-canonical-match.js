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

// Fallback to older source if quota is blocked
const crestRingSrc = findImage('crest_ring_v6_') || findImage('crest_ring_flat_');
const crestFaceSrc = findImage('crest_face_v6_') || findImage('crest_face_flat_');
const badgeSrc = findImage('rarity_badge_v6_');

console.log("V8 Found:", {crestRingSrc, crestFaceSrc, badgeSrc});

const JOBS = [
    { target: 'crest_ring_v5.png', src: crestRingSrc, w: 220, h: 220, type: 'jade_ring_embedded' },
    { target: 'crest_face_v5.png', src: crestFaceSrc, w: 180, h: 180, type: 'jade_face_embedded' },
    { target: 'badge_family_common_v5.png', src: badgeSrc, w: 180, h: 44, type: 'badge' },
    { target: 'story_strip_base_v5.png', src: null, w: 600, h: 100, type: 'slate_container' }
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
    
    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    
    try {
        for (const job of JOBS) {
            let srcDataUrl = "";
            if (job.src) {
                srcDataUrl = `data:image/png;base64,${fs.readFileSync(job.src).toString('base64')}`;
            }
            
            let html = "";
            
            if (job.type === 'jade_ring_embedded') {
                html = `<html><body style="margin:0; background:transparent;">
                    <div style="width:${job.w}px; height:${job.h}px; position:relative; border-radius:50%; box-shadow: inset 0px 6px 12px rgba(0,0,0,0.5), 0px 2px 4px rgba(255,255,255,0.4);">
                        <div style="position:absolute; top:0; left:0; right:0; bottom:0; padding:10px; border-radius:50%; box-sizing:border-box;">
                            <div style="width:100%; height:100%; background-image:url('${srcDataUrl}'); background-size:contain; background-position:center; background-repeat:no-repeat; mix-blend-mode: multiply; filter: brightness(0.8) contrast(1.2) hue-rotate(170deg) saturate(0.5);"></div>
                        </div>
                    </div>
                </body></html>`;
            } else if (job.type === 'jade_face_embedded') {
                html = `<html><body style="margin:0; background:transparent;">
                    <div style="width:${job.w}px; height:${job.h}px; position:relative; border-radius:50%; overflow:hidden; background-color:#7ca496; box-shadow: inset 0px 4px 8px rgba(0,0,0,0.6);">
                        <div style="position:absolute; width:100%; height:100%; background-image:url('${srcDataUrl}'); background-size:contain; background-position:center; background-repeat:no-repeat; mix-blend-mode: overlay; opacity: 0.9; filter: grayscale(1);"></div>
                        <div style="position:absolute; width:100%; height:100%; box-shadow: inset 0px 0px 20px rgba(0,0,0,0.4); border-radius:50%;"></div>
                    </div>
                </body></html>`;
            } else if (job.type === 'slate_container') {
                html = `<html><body style="margin:0; background:transparent;">
                    <div style="width:${job.w}px; height:${job.h}px; background: linear-gradient(180deg, #1A2226, #25333A); border-top: 2px solid #588075; border-bottom: 2px solid #588075; box-shadow: 0px -2px 10px rgba(0,0,0,0.4);"></div>
                </body></html>`;
            } else {
                html = `<html><body style="margin:0; background:transparent;">
                    <div style="width:${job.w}px; height:${job.h}px; background-image:url('${srcDataUrl}'); background-size:contain; background-position:center; background-repeat:no-repeat; filter: grayscale(0.5) brightness(0.9) opacity(0.9);"></div>
                </body></html>`;
            }

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
    console.log('V8 Canonical Match Script 完成');
}

main().catch(console.error);
