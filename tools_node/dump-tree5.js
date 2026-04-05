const puppeteer = require('puppeteer-core');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        headless: true,
        defaultViewport: { width: 1920, height: 1080 },
    });
    const page = await browser.newPage();
    
    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('PREVIEW_MODE', 'true');
        localStorage.setItem('PREVIEW_TARGET', '5');
    });

    await page.goto('http://localhost:7456/?previewMode=true&previewTarget=5', { waitUntil: 'load', timeout: 30000 });
    
    // Wait for the game to render
    await new Promise(r => setTimeout(r, 6000));
    
    const dumpInfo = await page.evaluate(() => {
        let gameWin = window;
        const iframes = document.querySelectorAll('iframe');
        for (let i = 0; i < iframes.length; i++) {
            try {
                if (iframes[i].contentWindow && iframes[i].contentWindow.cc) {
                    gameWin = iframes[i].contentWindow;
                    break;
                }
            } catch(e) {}
        }
        
        const cc = gameWin.cc;
        if (!cc) return "No CC";
        const scene = cc.director.getScene();
        if (!scene) return "No scene";
        
        const dumpTree = (parent, indent) => {
            let s = indent + parent.name + "\n";
            for (let c of parent.children) s += dumpTree(c, indent + "  ");
            return s;
        };
        let res = "";
        for (let c of scene.children) res += dumpTree(c, "");
        return res;
    });
    
    console.log(dumpInfo.substring(0, 10000));
    await browser.close();
})();