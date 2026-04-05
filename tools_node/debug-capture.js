const puppeteer = require('puppeteer-core');
const os = require('os');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        headless: true,
        defaultViewport: { width: 1920, height: 1080 },
    });
    const page = await browser.newPage();
    await page.goto('http://localhost:7456', { waitUntil: 'load', timeout: 30000 });
    
    // Switch to Browser Review "Target 0"
    await page.evaluate(() => {
        const previewHost = document.querySelector('preview-host');
        if (previewHost) {
            previewHost.switchToTarget(0);
        }
    }).catch(e => console.log("preview handle error:", e));

    await new Promise(r => setTimeout(r, 8000));
    await page.screenshot({ path: path.join('artifacts', 'ui-qa', 'UI-2-0023', 'BattleScene_Full.png'), fullPage: true });
    
    // Also capture specifically the Top Bar area if we can
    await page.screenshot({ 
        path: path.join('artifacts', 'ui-qa', 'UI-2-0023', 'BattleScene_Top.png'), 
        clip: { x: 0, y: 0, width: 1920, height: 200 }
    });
    
    await browser.close();
    console.log("Done");
})();
