#!/usr/bin/env node
/**
 * gen-hud-portrait-crop.js
 *
 * 任務：從全身立繪裁出符合 A2 HUD 頭像裁片 family 規格的 HUD portrait crop proof。
 * 輸出：artifacts/ui-qa/UI-2-0038/ 資料夾內 4 張 512x512 母圖 + 各對應 64x64、32x32 縮圖。
 *
 * 用法：
 *   node tools_node/gen-hud-portrait-crop.js
 *   node tools_node/gen-hud-portrait-crop.js --browser "C:\Program Files\Google\Chrome\Application\chrome.exe"
 */

'use strict';

const fs   = require('fs');
const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer-core');
} catch (e) {
    console.error('[gen-hud-portrait-crop] 缺少依賴 puppeteer-core，請先執行: npm i -D puppeteer-core');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// 路徑設定
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '..');
const GENERALS_DIR = path.join(PROJECT_ROOT, 'assets', 'resources', 'sprites', 'generals');
const OUT_DIR      = path.join(PROJECT_ROOT, 'artifacts', 'ui-qa', 'UI-2-0038');

// ---------------------------------------------------------------------------
// 裁切規格
// 使用 CSS background-position、background-size 從全身圖取出頭頸肩區塊。
// 規格依 portrait-family-spec.md：
//   - 頭臉寬 40~52% 容器寬，頭頂到下巴 48~62% 容器高
//   - 左下角留 badge 落點
//   - 白底全身圖會疊一層半透明深色漸層來壓暗背景
//
// 計算基準（以 512x512 容器為基準）：
//   張飛原圖 720x1280：頭部約 y:50-320px，x:220-500px
//     bgSize=270% → display 1382x2456px；bgPositionY=3% → viewport y:58-570px
//     bgPositionX=47% → viewport x:404-916 (orig x:211-479)
//   趙雲原圖 1024x1024：頭部約 y:50-340px，x:350-650px
//     bgSize=250% → display 1280x1280px；bgPositionY=3% → viewport y:23-535px
//     bgPositionX=46% → viewport x:350-862 (orig x:280-690)
// ---------------------------------------------------------------------------
const CROPS = [
    {
        id: 'zhang_fei_v1a',
        label: '張飛 v1a（緊裁：頭部特寫）',
        src: path.join(GENERALS_DIR, 'zhang_fei_portrait.png'),
        // 放大 270%，聚焦頭頸，臉部佔框 ~50%
        bgSize: '270%',
        bgPositionX: '47%',
        bgPositionY: '3%',
        badgeSide: 'left',
        characterName: '張飛',
    },
    {
        id: 'zhang_fei_v1b',
        label: '張飛 v1b（寬裁：頭頸肩）',
        src: path.join(GENERALS_DIR, 'zhang_fei_portrait.png'),
        // 放大 200%，包含更多肩甲，臉部佔框 ~40%
        bgSize: '200%',
        bgPositionX: '46%',
        bgPositionY: '2%',
        badgeSide: 'left',
        characterName: '張飛',
    },
    {
        id: 'zhao_yun_v1a',
        label: '趙雲 v1a（緊裁：頭部特寫）',
        src: path.join(GENERALS_DIR, 'zhao_yun_portrait.png'),
        // 趙雲 1024x1024 正方形，放大 250%，聚焦面部
        bgSize: '250%',
        bgPositionX: '46%',
        bgPositionY: '3%',
        badgeSide: 'left',
        characterName: '趙雲',
    },
    {
        id: 'zhao_yun_v1b',
        label: '趙雲 v1b（寬裁：頭頸肩含披風）',
        src: path.join(GENERALS_DIR, 'zhao_yun_portrait.png'),
        // 放大 190%，包含飄逸髮絲與披風上緣
        bgSize: '190%',
        bgPositionX: '46%',
        bgPositionY: '2%',
        badgeSide: 'left',
        characterName: '趙雲',
    },
];

// 驗收縮圖尺寸
const THUMB_SIZES = [64, 32];

// ---------------------------------------------------------------------------
// 瀏覽器解析
// ---------------------------------------------------------------------------
function parseArg(name) {
    const idx = process.argv.indexOf(`--${name}`);
    return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : '';
}

function resolveBrowser(custom) {
    if (custom && fs.existsSync(custom)) return custom;
    const candidates = [
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return '';
}

// ---------------------------------------------------------------------------
// PNG 尺寸讀取（純 JS，無需外部套件）
// ---------------------------------------------------------------------------
function readPngSize(filePath) {
    const buf = fs.readFileSync(filePath);
    // PNG signature is 8 bytes, IHDR chunk starts at offset 8
    // IHDR: 4 bytes length, 4 bytes "IHDR", 4 bytes width, 4 bytes height
    if (buf.slice(0, 4).toString('hex') !== '89504e47') {
        throw new Error(`${filePath} 不是有效的 PNG 文件`);
    }
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    return { width: w, height: h };
}

// ---------------------------------------------------------------------------
// 為單一裁切規格產生 HTML 字串
// ---------------------------------------------------------------------------
function buildHtml(crop, parentSize) {
    const srcDataUrl = `data:image/png;base64,${fs.readFileSync(crop.src).toString('base64')}`;

    const badgeStyle = crop.badgeSide === 'left'
        ? 'left: 8px; bottom: 8px;'
        : 'right: 8px; bottom: 8px;';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; width: ${parentSize}px; height: ${parentSize}px; overflow: hidden; }

  /* Portrait crop 容器 */
  .portrait-container {
    position: relative;
    width: ${parentSize}px;
    height: ${parentSize}px;
    overflow: hidden;
    background-color: #0e0e12;
    background-image: url('${srcDataUrl}');
    background-size: ${crop.bgSize};
    background-position: ${crop.bgPositionX} ${crop.bgPositionY};
    background-repeat: no-repeat;
  }

  /* 深色漸層疊層：壓暗白底，推進三國 HUD 氛圍 */
  .overlay {
    position: absolute;
    inset: 0;
    /* 上方輕壓，下方強壓 → 讓頭臉保持最亮 */
    background: linear-gradient(
      to bottom,
      rgba(10, 12, 20, 0.18) 0%,
      rgba(10, 12, 20, 0.24) 40%,
      rgba(8, 10, 18, 0.60) 75%,
      rgba(6, 8, 16, 0.88) 100%
    );
  }

  /* 邊緣暈影（強調 HUD 裁片感） */
  .vignette {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 80px rgba(0,0,0,0.65);
    border-radius: 2px;
  }

  /* Badge 預留區指示（只出現在 proof 版，不在正式美術中） */
  .badge-zone {
    position: absolute;
    width: 11%;
    height: 11%;
    ${badgeStyle}
    border: max(1px, 0.25%) dashed rgba(220,180,60,0.65);
    border-radius: 3px;
    background: rgba(220,180,60,0.10);
  }
</style>
</head>
<body>
  <div class="portrait-container">
    <div class="overlay"></div>
    <div class="vignette"></div>
    <div class="badge-zone"></div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
async function main() {
    const browserPath = resolveBrowser(parseArg('browser'));
    if (!browserPath) {
        console.error('[gen-hud-portrait-crop] 找不到 Chrome / Edge 瀏覽器，請用 --browser 指定路徑');
        process.exit(1);
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });

    console.log(`[gen-hud-portrait-crop] 使用瀏覽器: ${browserPath}`);

    const browser = await puppeteer.launch({
        executablePath: browserPath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        for (const crop of CROPS) {
            if (!fs.existsSync(crop.src)) {
                console.warn(`[gen-hud-portrait-crop] 找不到來源圖: ${crop.src}, 跳過 ${crop.id}`);
                continue;
            }

            const { width: srcW, height: srcH } = readPngSize(crop.src);
            console.log(`\n[${crop.id}] ${crop.label}`);
            console.log(`  來源: ${path.basename(crop.src)} (${srcW}x${srcH})`);

            // 512x512 母圖
            const motherSize = 512;
            const html = buildHtml(crop, motherSize);
            const page = await browser.newPage();
            await page.setViewport({ width: motherSize, height: motherSize, deviceScaleFactor: 1 });
            await page.setContent(html, { waitUntil: 'networkidle0' });

            const motherPath = path.join(OUT_DIR, `battlehud_portrait_${crop.id}_512.png`);
            await page.screenshot({ path: motherPath, clip: { x: 0, y: 0, width: motherSize, height: motherSize } });
            console.log(`  ✓ 母圖: ${path.basename(motherPath)}`);

            // 縮圖：64x64, 32x32 — 將 512 母圖 scale down 確保品質一致
            for (const sz of THUMB_SIZES) {
                const motherB64 = fs.readFileSync(motherPath).toString('base64');
                const thumbHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>* { margin:0; padding:0; } body { width:${sz}px; height:${sz}px; overflow:hidden; background:#000; }
img { width:${sz}px; height:${sz}px; image-rendering: -webkit-optimize-contrast; }</style>
</head><body><img src="data:image/png;base64,${motherB64}" /></body></html>`;
                const thumbPage = await browser.newPage();
                await thumbPage.setViewport({ width: sz, height: sz, deviceScaleFactor: 1 });
                await thumbPage.setContent(thumbHtml, { waitUntil: 'networkidle0' });
                const thumbPath = path.join(OUT_DIR, `battlehud_portrait_${crop.id}_${sz}.png`);
                await thumbPage.screenshot({ path: thumbPath, clip: { x: 0, y: 0, width: sz, height: sz } });
                await thumbPage.close();
                console.log(`  ✓ 縮圖: ${path.basename(thumbPath)}`);
            }

            await page.close();
        }
    } finally {
        await browser.close();
    }

    // 同時把 _512 版也複製一份為與 brief 要求一致的命名
    // brief 要求命名：battlehud_portrait_zhang_fei_v1a.png 等
    for (const crop of CROPS) {
        const srcFile = path.join(OUT_DIR, `battlehud_portrait_${crop.id}_512.png`);
        const dstFile = path.join(OUT_DIR, `battlehud_portrait_${crop.id}.png`);
        if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, dstFile);
        }
    }

    console.log('\n[gen-hud-portrait-crop] 全部完成');
    console.log(`輸出目錄: ${OUT_DIR}`);
    console.log('生成檔案列表:');
    fs.readdirSync(OUT_DIR)
        .filter(f => f.startsWith('battlehud_portrait_'))
        .sort()
        .forEach(f => console.log(`  ${f}`));
}

main().catch(err => {
    console.error('[gen-hud-portrait-crop] 錯誤:', err);
    process.exit(1);
});
