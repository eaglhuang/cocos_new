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

const srcFile = findImage('header_frame_safe');

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

    if (!srcFile) { console.error("No src file"); return; }

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    
    try {
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
                                
                                let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
                                
                                for(let y=0; y<c.height; y++) {
                                    for(let x=0; x<c.width; x++) {
                                        const idx = (y*c.width + x)*4;
                                        const r = data[idx];
                                        const g = data[idx+1];
                                        const b = data[idx+2];
                                        
                                        const luma = 0.299*r + 0.587*g + 0.114*b;
                                        if (luma > 240) {
                                            data[idx+3] = 0; // Transparent
                                        } else {
                                            if (luma > 200) {
                                                data[idx+3] = Math.max(0, 255 - (luma - 200) * 4);
                                            }
                                            if (x < minX) minX = x;
                                            if (x > maxX) maxX = x;
                                            if (y < minY) minY = y;
                                            if (y > maxY) maxY = y;
                                        }
                                    }
                                }
                                ctx.putImageData(imgData, 0, 0);
                                
                                if (minX > maxX) { resolve(null); return; }
                                
                                // Since we want a stretchable middle part, let's take a 128px wide horizontal strip right from the center
                                const cx = Math.floor(img.width / 2);
                                
                                const finalW = 128;
                                const finalH = maxY - minY + 1;
                                
                                const cropCanvas = document.createElement('canvas');
                                cropCanvas.width = finalW;
                                cropCanvas.height = finalH;
                                const cropCtx = cropCanvas.getContext('2d');
                                
                                // Draw from center-64 to final
                                cropCtx.drawImage(c, cx - 64, minY, finalW, finalH, 0, 0, finalW, finalH);
                                
                                resolve(cropCanvas.toDataURL('image/png'));
                            };
                            img.src = dataUrl;
                        });
                    };
                </script>
            </body>
            </html>
        `);
        
        const result = await page.evaluate((url) => window.processFrame(url), srcDataUrl);
        if (result) {
            const base64Data = result.replace(/^data:image\/png;base64,/, "");
            fs.writeFileSync(path.join(FORMAL_DIR, 'header_frame_formal.png'), base64Data, 'base64');
            console.log('✓ Generated stretch-safe: header_frame_formal.png');
        } else {
            console.error('Failed to crop');
        }
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
