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

const srcBadges = findImage('rarity_badges_formal');

const BADGES = ['common', 'rare', 'epic', 'legendary', 'mythic'];

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
        const page = await browser.newPage();
        
        if (srcBadges) {
            const srcDataUrl = `data:image/png;base64,${fs.readFileSync(srcBadges).toString('base64')}`;
            
            await page.setContent(`
                <html>
                <body style="margin:0; padding:0; background:transparent;">
                    <canvas id="c"></canvas>
                    <script>
                        window.processBadges = function(dataUrl) {
                            return new Promise((resolve) => {
                                const img = new Image();
                                img.onload = () => {
                                    const c = document.getElementById('c');
                                    const chunkW = img.width / 5;
                                    const chunkH = img.height;
                                    
                                    const results = [];
                                    const ctx = c.getContext('2d');
                                    
                                    for(let i=0; i<5; i++) {
                                        c.width = chunkW;
                                        c.height = chunkH;
                                        ctx.clearRect(0,0,chunkW,chunkH);
                                        ctx.drawImage(img, i*chunkW, 0, chunkW, chunkH, 0, 0, chunkW, chunkH);
                                        
                                        // Remove white background and crop to content
                                        const imgData = ctx.getImageData(0,0,chunkW,chunkH);
                                        const data = imgData.data;
                                        
                                        let minX = chunkW, minY = chunkH, maxX = 0, maxY = 0;
                                        
                                        for(let y=0; y<chunkH; y++) {
                                            for(let x=0; x<chunkW; x++) {
                                                const idx = (y*chunkW + x)*4;
                                                const r = data[idx];
                                                const g = data[idx+1];
                                                const b = data[idx+2];
                                                
                                                const isWhite = (r > 240 && g > 240 && b > 240);
                                                if (isWhite) {
                                                    data[idx+3] = 0; // transparent
                                                } else {
                                                    if (x < minX) minX = x;
                                                    if (x > maxX) maxX = x;
                                                    if (y < minY) minY = y;
                                                    if (y > maxY) maxY = y;
                                                }
                                            }
                                        }
                                        
                                        // simple luma edge smoothing
                                        for(let y=1; y<chunkH-1; y++) {
                                            for(let x=1; x<chunkW-1; x++) {
                                                const idx = (y*chunkW + x)*4;
                                                if (data[idx+3] === 0) continue;
                                                const r = data[idx];
                                                const g = data[idx+1];
                                                const b = data[idx+2];
                                                const luma = 0.299*r + 0.587*g + 0.114*b;
                                                if (luma > 200) {
                                                    data[idx+3] = Math.max(0, 255 - (luma - 200) * 4);
                                                }
                                            }
                                        }
                                        
                                        ctx.putImageData(imgData, 0, 0);
                                        
                                        // Crop
                                        const finalW = Math.max(1, maxX - minX + 1);
                                        const finalH = Math.max(1, maxY - minY + 1);
                                        const cropCanvas = document.createElement('canvas');
                                        cropCanvas.width = finalW;
                                        cropCanvas.height = finalH;
                                        const cropCtx = cropCanvas.getContext('2d');
                                        cropCtx.drawImage(c, minX, minY, finalW, finalH, 0, 0, finalW, finalH);
                                        
                                        results.push(cropCanvas.toDataURL('image/png'));
                                    }
                                    resolve(results);
                                };
                                img.src = dataUrl;
                            });
                        };
                    </script>
                </body>
                </html>
            `);
            
            const results = await page.evaluate((url) => window.processBadges(url), srcDataUrl);
            
            for(let i=0; i<5; i++) {
                const base64Data = results[i].replace(/^data:image\/png;base64,/, "");
                const targetPath = path.join(FORMAL_DIR, `rarity_badge_${BADGES[i]}.png`);
                fs.writeFileSync(targetPath, base64Data, 'base64');
                console.log('✓ Generated:', BADGES[i]);
            }
        }
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
