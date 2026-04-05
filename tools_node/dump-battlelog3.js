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
                if (!gameWin.cc) return resolve('No cc');
                
                const cc = gameWin.cc;
                const scene = cc.director.getScene();
                
                let bLog = null; let hdr = null;
                const findNode = (parent) => {
                    if (parent.name === 'BattleLogPanel' && parent.parent?.name === 'SidePanelRoot') bLog = parent;
                    if (parent.name === 'Header') hdr = parent;
                    if (parent.children) parent.children.forEach(findNode);
                };
                findNode(scene);

                resolve({
                    BattleLogPanel: bLog ? { 
                        act: bLog.active,
                        actH: bLog.activeInHierarchy,
                        scaleY: bLog.scale.y
                    } : null,
                    Header: hdr ? {
                        act: hdr.active,
                        actH: hdr.activeInHierarchy
                    } : null
                });
            });
        });
        console.log(JSON.stringify(data, null, 2));
        browser.disconnect();
    } catch (e) { console.error(e); }
})();