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
    
    await page.evaluate(() => {
        const previewHost = document.querySelector('preview-host');
        if (previewHost) previewHost.switchToTarget(0);
    }).catch(e => console.log("preview handle error:", e));

    await new Promise(r => setTimeout(r, 6000));
    
    let gameFrame = null;
    for (const frame of page.frames()) {
        const url = frame.url();
        if (url.includes('preview.html') || frame.name() === 'game-frame') {
            gameFrame = frame;
            break;
        }
    }
    
    if (!gameFrame) {
        console.log("No game frame");
        await browser.close();
        return;
    }
    
    const dumpInfo = await gameFrame.evaluate(() => {
        const cc = window.cc || window.top.cc;
        if (!cc) return "No CC";
        const scene = cc.director.getScene();
        if (!scene) return "No scene";
        
        let targetNode = null;
        let tsBarNode = null;
        let pSideNode = null;

        const findNode = (parent) => {
            if (parent.name === 'PlayerPortrait') targetNode = parent;
            if (parent.name === 'TopBar') tsBarNode = parent;
            if (parent.name === 'PlayerSide') pSideNode = parent;
            for (let c of parent.children) {
                findNode(c);
            }
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
                top: getWidget(pSideNode)?.top,
                anchorY: getTf(pSideNode)?.anchorPoint?.y
            },
            PlayerPortrait: {
                w: getTf(targetNode)?.width,
                h: getTf(targetNode)?.height,
                scaleY: targetNode?.scale.y,
                y: targetNode?.position.y,
                anchorY: getTf(targetNode)?.anchorPoint?.y,
                spriteSizeMode: targetNode?.getComponent(cc.Sprite)?.sizeMode,
                spriteType: targetNode?.getComponent(cc.Sprite)?.type
            }
        };
    });
    
    console.log(JSON.stringify(dumpInfo, null, 2));
    
    await browser.close();
})();
