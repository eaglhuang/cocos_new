const puppeteer = require('puppeteer-core');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function resizePng(filePath, maxWidth = 512) {
    const script = [
        'Add-Type -AssemblyName System.Drawing',
        `$filePath = '${filePath.replace(/'/g, "''")}'`,
        '$image = [System.Drawing.Image]::FromFile($filePath)',
        '$width = $image.Width',
        '$height = $image.Height',
        `if ($width -le ${maxWidth}) { $image.Dispose(); exit 0 }`,
        `$scale = ${maxWidth} / [double]$width`,
        `$newWidth = ${maxWidth}`,
        '$newHeight = [int][Math]::Round($height * $scale)',
        '$bitmap = New-Object System.Drawing.Bitmap $newWidth, $newHeight',
        '$graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
        '$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
        '$graphics.DrawImage($image, 0, 0, $newWidth, $newHeight)',
        '$graphics.Dispose()',
        '$image.Dispose()',
        '$bitmap.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)',
        '$bitmap.Dispose()',
    ].join('\n');

    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
        stdio: 'ignore',
    });
}

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
    const fullPath = path.join('artifacts', 'ui-qa', 'UI-2-0023', 'BattleScene_Full.png');
    await page.screenshot({ path: fullPath, fullPage: true });
    resizePng(fullPath);
    
    // Also capture specifically the Top Bar area if we can
    const topPath = path.join('artifacts', 'ui-qa', 'UI-2-0023', 'BattleScene_Top.png');
    await page.screenshot({ 
        path: topPath, 
        clip: { x: 0, y: 0, width: 1920, height: 200 }
    });
    resizePng(topPath);
    
    await browser.close();
    console.log("Done");
})();
