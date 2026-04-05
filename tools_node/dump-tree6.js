const puppeteer = require('puppeteer-core');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        headless: true,
        defaultViewport: { width: 1920, height: 1080 },
    });
    const page = await browser.newPage();
    
    const startUrl = new URL('/', 'http://localhost:7456');
    startUrl.searchParams.set('previewMode', 'true');
    startUrl.searchParams.set('previewTarget', '5');
    startUrl.searchParams.set('t', String(Date.now()));
    
    await page.goto(startUrl.toString(), { waitUntil: 'load', timeout: 30000 });
    
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
        
        let targetNode = null; let tsBarNode = null; let pSideNode = null;
        
        const findNode = (parent) => {
            if (parent.name === 'PlayerPortrait') targetNode = parent;
            if (parent.name === 'TopBar') tsBarNode = parent;
            if (parent.name === 'PlayerSide') pSideNode = parent;
            for (let c of parent.children) findNode(c);
        };
        findNode(scene);
        
        if (!targetNode) return "No target node found in scene: " + scene.children.map(c=>c.name).join(',');
        
        const getTf = (n) => n?.getComponent(cc.UITransform);
        const getSprite = (n) => n?.getComponent(cc.Sprite);
        
        return {
            TopBar: { h: getTf(tsBarNode)?.height, y: tsBarNode?.position.y },
            PlayerSide: { h: getTf(pSideNode)?.height, y: pSideNode?.position.y },
            PlayerPortrait: { 
                h: getTf(targetNode)?.height, 
                y: targetNode?.position.y, 
                sizeMode: getSprite(targetNode)?.sizeMode
            }
        };
    });
    
    console.log(JSON.stringify(dumpInfo, null, 2));
    await browser.close();
})();
