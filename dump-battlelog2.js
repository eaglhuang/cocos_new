const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
    try {
        const port = 7456;
        const fetch = globalThis.fetch;
        const res = await fetch('http://localhost:' + port + '/json');
        const targets = await res.json();
        const pdw = targets.find(t => t.url.includes('preview.html') && t.type === 'page');
        if (!pdw) return;

        const browser = await puppeteer.connect({ browserWSEndpoint: pdw.webSocketDebuggerUrl });
        const pages = await browser.pages();
        const page = pages.find(p => p.url().includes('preview.html'));
        
        const data = await page.evaluate(() => {
            return new Promise((resolve) => {
                const gameWin = document.querySelector('iframe')?.contentWindow || window;
                if (!gameWin.cc) return resolve("NO CC");
                
                const cc = gameWin.cc;
                const scene = cc.director.getScene();
                
                let sb = null; let bLog = null; let side = null;
                const findNode = (parent) => {
                    if (parent.name === 'BtnCollapse') sb = parent;
                    if (parent.name === 'BattleLogPanel') bLog = parent;
                    if (parent.name === 'SidePanelRoot') side = parent;
                    if (parent.children) parent.children.forEach(findNode);
                };
                findNode(scene);
                
                const getSize = (n) => n?.getComponent(cc.UITransform)?.contentSize;
                const pos = (n) => n?.getComponent(cc.UITransform)?.convertToWorldSpaceAR(cc.v3(0,0,0));

                resolve({
                    SidePanelRoot: side ? { 
                        w: getSize(side)?.width, h: getSize(side)?.height,
                        pos: pos(side)
                    } : null,
                    BattleLogPanel: bLog ? { 
                        w: getSize(bLog)?.width, h: getSize(bLog)?.height, 
                        pos: pos(bLog),
                        bg: !!bLog.getComponent('SolidBackground'),
                        color: bLog.getComponent('SolidBackground')?.color?.toHEX()
                    } : null,
                    BtnCollapse: sb ? { pos: pos(sb) } : null
                });
            });
        });
        console.log(JSON.stringify(data, null, 2));
        browser.disconnect();
    } catch (e) { console.error(e); }
})();