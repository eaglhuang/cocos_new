#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer-core');
} catch (e) {
    process.exit(1);
}

const OUT_DIR = path.resolve(__dirname, '..', 'artifacts', 'ui-qa', 'UI-2-0032');
const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity/brain/16e54070-ebe9-46f9-a875-de60756048f9';

if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

function findImage(prefix) {
    const files = fs.readdirSync(ARTIFACT_DIR);
    const matches = files.filter(f => f.startsWith(prefix) && f.endsWith('.png'));
    matches.sort((a,b) => fs.statSync(path.join(ARTIFACT_DIR, b)).mtimeMs - fs.statSync(path.join(ARTIFACT_DIR, a)).mtimeMs);
    return matches.length > 0 ? path.join(ARTIFACT_DIR, matches[0]) : null;
}

const srcV2A = findImage('unitinfo_type_icon_spear_v2a_');
const srcV2B = findImage('unitinfo_type_icon_spear_v2b_');
const srcV2C = findImage('unitinfo_type_icon_spear_v2c_');

console.log("Found sources:", {srcV2A, srcV2B, srcV2C});

const jobs = [];
const SIZES = [128, 64, 32];
const VARIANTS = [
    { name: 'v2a', src: srcV2A },
    { name: 'v2b', src: srcV2B },
    { name: 'v2c', src: srcV2C },
];

for (let v of VARIANTS) {
    if (v.src) {
        for (let size of SIZES) {
            jobs.push({
                target: `unitinfo_type_icon_spear_${v.name}_${size}.png`,
                src: v.src,
                size: size
            });
        }
    }
}

function resolveBrowser() {
    const candidates = [
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    ];
    for (const c of candidates) { if (fs.existsSync(c)) return c; }
    return '';
}

async function main() {
    const browserPath = resolveBrowser();
    if (!browserPath) { console.error("No browser found"); return; }
    
    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    
    try {
        for (const job of jobs) {
            const srcDataUrl = `data:image/png;base64,${fs.readFileSync(job.src).toString('base64')}`;
            
            // To mask to a circle and resize
            const html = `<html><body style="margin:0; background:transparent;">
                <div style="width:${job.size}px; height:${job.size}px; border-radius:50%; overflow:hidden; display:flex; justify-content:center; align-items:center;">
                    <img src="${srcDataUrl}" style="width:${job.size}px; height:${job.size}px; mix-blend-mode: multiply;" />
                </div>
            </body></html>`;

            const page = await browser.newPage();
            await page.setViewport({ width: job.size, height: job.size });
            await page.setContent(html);
            await page.screenshot({ path: path.join(OUT_DIR, job.target), omitBackground: true });
            console.log(`✓ Generated: ${job.target}`);
            await page.close();
        }
    } finally {
        await browser.close();
    }
    console.log('Icon resizing complete!');
}

main().catch(console.error);
