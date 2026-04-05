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
        if (!cc) return "No CC on iframe or window";
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
        const getSprite = (n) => n?.getComponent(cc.Sprite);
        
        return {
            TopBar: {
                w: getTf(tsBarNode)?.width,
                h: getTf(tsBarNode)?.height,
                y: tsBarNode?.position.y,
                oy: tsBarNode?.worldPosition.y,
                top: getWidget(tsBarNode)?.top
            },
            PlayerSide: {
                w: getTf(pSideNode)?.width,
                h: getTf(pSideNode)?.height,
                y: pSideNode?.position.y,
                oy: pSideNode?.worldPosition.y,
                anchorY: getTf(pSideNode)?.anchorPoint?.y
            },
            PlayerPortrait: {
                w: getTf(targetNode)?.width,
                h: getTf(targetNode)?.height,
                scaleY: targetNode?.scale.y,
                y: targetNode?.position.y,
                oy: targetNode?.worldPosition.y,
                anchorY: getTf(targetNode)?.anchorPoint?.y,
                spriteSize: getSprite(targetNode)?.spriteFrame?.rect?.height,
                trim: getSprite(targetNode)?.trim,
                sizeMode: getSprite(targetNode)?.sizeMode
            }
        };
    });
    
    console.log(JSON.stringify(dumpInfo, null, 2));
    await browser.close();
})();
