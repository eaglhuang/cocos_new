const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

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

const srcBand = findImage('header_band_formal');
const srcFill = findImage('header_fill_formal');
const srcFrame = findImage('header_frame_formal');

function resolveBrowser() {
    const candidates = [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    ];
    for (const c of candidates) { if (fs.existsSync(c)) return c; }
    return '';
}

async function processSimple(browser, srcFile, targetName, size) {
    if (!srcFile) return;
    const srcDataUrl = `data:image/png;base64,${fs.readFileSync(srcFile).toString('base64')}`;
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size });
    await page.setContent(`
        <style>body{margin:0;}</style>
        <div style="width:${size}px;height:${size}px;background:url('${srcDataUrl}');background-size:cover;background-position:center;"></div>
    `);
    await page.screenshot({ path: path.join(FORMAL_DIR, `${targetName}.png`), omitBackground: true });
    await page.close();
    console.log(`✓ Generated: ${targetName}`);
}

async function processFrame(browser, srcFile) {
    if (!srcFile) return;
    const srcDataUrl = `data:image/png;base64,${fs.readFileSync(srcFile).toString('base64')}`;
    const page = await browser.newPage();
    await page.setContent(`
        <html>
        <body style="margin:0; background:transparent;">
            <canvas id="c"></canvas>
            <script>
                window.processFrame = function(dataUrl) {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            const c = document.getElementById('c');
                            c.width = img.width;
                            c.height = img.height;
                            const ctx = c.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            
                            const imgData = ctx.getImageData(0,0,c.width,c.height);
                            const data = imgData.data;
                            
                            for(let y=0; y<c.height; y++) {
                                for(let x=0; x<c.width; x++) {
                                    const idx = (y*c.width + x)*4;
                                    const r = data[idx];
                                    const g = data[idx+1];
                                    const b = data[idx+2];
                                    
                                    const luma = 0.299*r + 0.587*g + 0.114*b;
                                    if (luma > 240) {
                                        data[idx+3] = 0; // Transparent
                                    } else if (luma > 200) {
                                        data[idx+3] = Math.max(0, 255 - (luma - 200) * 4);
                                    }
                                }
                            }
                            ctx.putImageData(imgData, 0, 0);
                            resolve(c.toDataURL('image/png'));
                        };
                        img.src = dataUrl;
                    });
                };
            </script>
        </body>
        </html>
    `);
    
    const result = await page.evaluate((url) => window.processFrame(url), srcDataUrl);
    const base64Data = result.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(path.join(FORMAL_DIR, 'header_frame_formal.png'), base64Data, 'base64');
    await page.close();
    console.log('✓ Generated: header_frame_formal');
}

async function main() {
    const browserPath = resolveBrowser();
    if (!browserPath) { console.error("No browser"); return; }
    if(!fs.existsSync(FORMAL_DIR)) { fs.mkdirSync(FORMAL_DIR, {recursive: true}); }

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    
    try {
        await processSimple(browser, srcBand, 'header_band_formal', 128);
        await processSimple(browser, srcFill, 'header_fill_formal', 128);
        await processFrame(browser, srcFrame);
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
