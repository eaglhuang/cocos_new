const puppeteer = require('puppeteer-core');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        headless: true,
        defaultViewport: { width: 1920, height: 1080 },
    });
    const page = await browser.newPage();
    await page.goto('http://localhost:7456', { waitUntil: 'load', timeout: 30000 });
    
    await page.evaluate(() => {
        const previewHost = document.querySelector('preview-host');
        if (previewHost) {
            previewHost.switchToTarget(5);
        }
    }).catch(e => console.log("preview handle error:", e));

    await new Promise(r => setTimeout(r, 6000));
    
    // just evaluate in page and look for iframe containing cc?
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
        if (!cc) return "No CC found on any iframe!";
        
        const scene = cc.director.getScene();
        if (!scene) return "No scene";
        
        let targetNode = null; let tsBarNode = null; let pSideNode = null;
        let eSideNode = null; let ePortrait = null;

        const findNode = (parent) => {
            if (parent.name === 'PlayerPortrait') targetNode = parent;
            if (parent.name === 'TopBar') tsBarNode = parent;
            if (parent.name === 'PlayerSide') pSideNode = parent;
            if (parent.name === 'EnemySide') eSideNode = parent;
            if (parent.name === 'EnemyPortrait') ePortrait = parent;
            for (let c of parent.children) findNode(c);
        };
        findNode(scene);
        
        if (!targetNode) return "No target node";
        
        const getTf = (n) => n?.getComponent(cc.UITransform);
        const getWidget = (n) => n?.getComponent(cc.Widget);
        
        return {
            TopBar: {
                w: getTf(tsBarNode)?.width,
                h: getTf(tsBarNode)?.height,
                y: tsBarNode?.position.y,
                top: getWidget(tsBarNode)?.top
            },
            PlayerSide: {
                w: getTf(pSideNode)?.width,
                h: getTf(pSideNode)?.height,
                y: pSideNode?.position.y,
                anchorY: getTf(pSideNode)?.anchorPoint?.y
            },
            PlayerPortrait: {
                w: getTf(targetNode)?.width,
                h: getTf(targetNode)?.height,
                scaleY: targetNode?.scale.y,
                y: targetNode?.position.y,
                anchorY: getTf(targetNode)?.anchorPoint?.y,
                spriteType: targetNode?.getComponent(cc.Sprite)?.type,
                spriteSizeMode: targetNode?.getComponent(cc.Sprite)?.sizeMode,
                spriteIsTrimmed: targetNode?.getComponent(cc.Sprite)?.trim
            },
            EnemySide: {
                w: getTf(eSideNode)?.width,
                h: getTf(eSideNode)?.height,
                y: eSideNode?.position.y,
                anchorY: getTf(eSideNode)?.anchorPoint?.y
            },
            EnemyPortrait: {
                w: getTf(ePortrait)?.width,
                h: getTf(ePortrait)?.height,
                y: ePortrait?.position.y,
                anchorY: getTf(ePortrait)?.anchorPoint?.y
            }
        };
    });
    
    console.log(JSON.stringify(dumpInfo, null, 2));
    
    await browser.close();
})();