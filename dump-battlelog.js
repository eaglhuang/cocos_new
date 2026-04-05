const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
    try {
        const port = 7456;
        console.log('fetching list');
        const fetch = (await import('node-fetch')).default;
        const res = await fetch('http://localhost:' + port + '/json');
        const targets = await res.json();
        const pdw = targets.find(t => t.url.includes('preview.html') && t.type === 'page');
        if (!pdw) {
            console.log('No preview window found');
            return;
        }

        const browser = await puppeteer.connect({ browserWSEndpoint: pdw.webSocketDebuggerUrl });
        const pages = await browser.pages();
        const page = pages.find(p => p.url().includes('preview.html'));
        
        console.log('injecting code');
        
        const data = await page.evaluate(() => {
            return new Promise((resolve) => {
                const gameWin = document.querySelector('iframe')?.contentWindow || window;
                if (!gameWin.cc) return 'No CC';
                
                const cc = gameWin.cc;
                const scene = cc.director.getScene();
                if (!scene) return 'No scene';
                
                let bLog = null; let ctrBar = null; let btnC = null; let txt = null; let sv = null; let rootBG = null;
                const findNode = (parent) => {
                    if (parent.name === 'BattleLogPanel') bLog = parent;
                    if (parent.name === 'ControlBar') ctrBar = parent;
                    if (parent.name === 'BtnCollapse') btnC = parent;
                    if (parent.name === 'TextBase') txt = parent;
                    if (parent.name === 'ScrollView') sv = parent;
                    if (parent.name === 'SolidBackground') rootBG = parent;
                    
                    if (parent.children) {
                        for (let c of parent.children) findNode(c);
                    }
                };
                findNode(scene);
                
                const getSize = (n) => n?.getComponent(cc.UITransform)?.contentSize;
                const getWidget = (n) => n?.getComponent(cc.Widget);
                const getSprite = (n) => n?.getComponent(cc.Sprite);

                resolve({
                    BattleLogPanel: bLog ? { 
                        h: getSize(bLog)?.height, 
                        y: bLog?.position?.y, 
                        act: bLog?.active,
                        scaleY: bLog?.scale?.y,
                        widBase: getWidget(bLog)?.top,
                        widBot: getWidget(bLog)?.bottom,
                    } : null,
                    SolidBackground: rootBG ? {
                        h: getSize(rootBG)?.height,
                        y: rootBG?.position?.y,
                    } : null,
                    ControlBar: ctrBar ? { 
                        h: getSize(ctrBar)?.height, 
                        act: ctrBar?.active, 
                    } : null,
                    ScrollView: sv ? {
                        act: sv?.active,
                        h: getSize(sv)?.height
                    } : null
                });
            });
        });
        
        console.log(JSON.stringify(data, null, 2));
        browser.disconnect();
    } catch (e) {
        console.error(e);
    }
})();
