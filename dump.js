const     puppeteer = require('puppeteer-core'); 
(async () => { 
    const port = 7456; 
    const fetch = globalThis.fetch; 
    const pdw = (await (await fetch('http://localhost:' + port + '/json')).json()).find(t => t.url.includes('preview.html'));
    const browser = await puppeteer.connect({ browserWSEndpoint: pdw.webSocketDebuggerUrl }); 
    const pages = await browser.pages(); 
    const page = pages.find(p => p.url().includes('preview.html')); 
    const data = await page.evaluate(() => { 
        const scene = document.querySelector('iframe')?.contentWindow?.cc?.director.getScene(); 
        if(!scene) return "NO SCENE";
        let h = []; 
        const getPName = (n) => n.parent ? getPName(n.parent) + '/' + n.name : n.name;
        const f = (p) => { 
            if(p.name==='Header') h.push({path: getPName(p), actH: p.activeInHierarchy, act: p.active}); 
            if(p.children) p.children.forEach(c => f(c)); 
        }; 
        f(scene); 
        return h; 
    }); 
    console.log(JSON.stringify(data, null, 2)); 
    browser.disconnect(); 
})();