/**
 * gen-icon-v2-candidates.js
 * 根據 UI-2-0032/agent1-generation-brief.md 的規格，
 * 使用 puppeteer-core + HTML5 Canvas 繪製
 * F7 戰場微型屬性 badge 三個方向（v2a/v2b/v2c）× 三尺寸（128/64/32）
 *
 * v2a: 偏穩定，接近 v1 但更厚重
 * v2b: 舊幣 / 勳章感
 * v2c: 高對比戰場 badge
 *
 * 輸出至 artifacts/ui-qa/UI-2-0032/
 * 命名：unitinfo_type_icon_spear_{variant}_{size}.png
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.resolve(__dirname, '../artifacts/ui-qa/UI-2-0032');
const BROWSER_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

// 三個設計方向視覺規格
const VARIANTS = [
  {
    id: 'v2a',
    label: '偏穩定，比v1更厚重',
    // 外圈：舊金 antique gold
    rimOuter: '#A07830',
    rimInner: '#5C4010',
    rimFactor: 0.19,       // rim width 佔半徑比
    // 內盤：深墨藍
    disk1: '#1E2B42',
    disk2: '#121C2E',
    disk3: '#080C18',
    // glyph：灰骨白
    glyphColor: '#D0C8A8',
    glyphWidth: 14,         // 128px 基準
    // 噪點強度（做舊質感）
    noiseIntensity: 0.28,
  },
  {
    id: 'v2b',
    label: '舊幣勳章感',
    // 外圈：更暗/銅感 tarnished gold
    rimOuter: '#7C5A18',
    rimInner: '#3A2208',
    rimFactor: 0.22,       // 更寬邊 = 更有幣感
    // 內盤：暗沉藍黑
    disk1: '#0E1A28',
    disk2: '#080F1A',
    disk3: '#04080E',
    // glyph：老骨色
    glyphColor: '#C0A870',
    glyphWidth: 11,
    noiseIntensity: 0.50,  // 更強噪點 = 更舊
  },
  {
    id: 'v2c',
    label: '高對比戰場badge',
    // 外圈：最亮金（但非螢光），強對比
    rimOuter: '#C09020',
    rimInner: '#704800',
    rimFactor: 0.16,       // 較窄 = badge 感更強
    // 內盤：最深黑藍
    disk1: '#0C1620',
    disk2: '#060C14',
    disk3: '#02050A',
    // glyph：亮骨白，最高對比
    glyphColor: '#E8DCC0',
    glyphWidth: 16,         // 最粗
    noiseIntensity: 0.18,
  },
];

const SIZES = [128, 64, 32];

// ──────────────────────────────────────────────────────
// 生成 HTML Canvas 頁面（透明背景）
// ──────────────────────────────────────────────────────
function buildBadgeHTML(variant, canvasSize) {
  const v = JSON.stringify(variant);
  const sz = canvasSize;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
html, body { margin:0; padding:0; width:${sz}px; height:${sz}px; overflow:hidden; background:transparent; }
canvas { display:block; }
</style>
</head>
<body>
<canvas id="c" width="${sz}" height="${sz}"></canvas>
<script>
(function(){
const v = ${v};
const sz = ${sz};
const cx = sz/2, cy = sz/2;
const r = sz * 0.46;
const rimW = r * v.rimFactor;
const innerR = r - rimW;

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.clearRect(0, 0, sz, sz);

// ── 1. 外圈 rim ──────────────────────────────
{
  // 主體填色（焦點偏上左，模擬舊金屬不均勻反光）
  const rg = ctx.createRadialGradient(cx - r*0.18, cy - r*0.22, r*0.25, cx, cy, r);
  rg.addColorStop(0,   v.rimOuter + 'FF');
  rg.addColorStop(0.35, v.rimOuter + 'EE');
  rg.addColorStop(0.65, v.rimInner + 'FF');
  rg.addColorStop(1,   v.rimInner + '99');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.restore();

  // 上方弧形亮帶（磨耗高光）
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - rimW*0.22, -Math.PI*0.85, -Math.PI*0.15);
  ctx.lineWidth = rimW * 0.28;
  ctx.strokeStyle = v.rimOuter + '66';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

// ── 2. rim 與 disk 之間暗溝 ─────────────────
{
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR + rimW*0.08, 0, Math.PI*2);
  ctx.lineWidth = rimW * 0.22;
  ctx.strokeStyle = 'rgba(0,0,0,0.60)';
  ctx.stroke();
  ctx.restore();
}

// ── 3. 內盤 disk ──────────────────────────────
{
  const dg = ctx.createRadialGradient(cx, cy - innerR*0.30, 0, cx, cy, innerR);
  dg.addColorStop(0,    v.disk1);
  dg.addColorStop(0.55, v.disk2);
  dg.addColorStop(1,    v.disk3);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI*2);
  ctx.fillStyle = dg;
  ctx.fill();
  ctx.restore();

  // 盤內陰影圈
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR * 0.93, 0, Math.PI*2);
  ctx.lineWidth = innerR * 0.12;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.stroke();
  ctx.restore();
}

// ── 4. 槍 Glyph（交叉長槍）────────────────────
{
  const gW   = v.glyphWidth * (sz / 128);
  const sLen = innerR * 0.76;
  const tipL = sLen * 0.24;
  const tipW = Math.min(gW * 2.5, innerR * 0.38);  // 防小尺寸過寬
  const ang  = Math.PI / 4;                          // 45°

  function drawSpearLine(x1,y1,x2,y2){
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.lineTo(x2,y2);
    ctx.lineWidth = gW;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = v.glyphColor;
    ctx.stroke();
    // 中心線高光
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.lineTo(x2,y2);
    ctx.lineWidth = gW * 0.30;
    ctx.strokeStyle = v.glyphColor + '40';
    ctx.stroke();
    ctx.restore();
  }

  function drawTip(bx,by,dx,dy){
    const len = Math.sqrt(dx*dx+dy*dy);
    if(len < 0.001) return;
    const nx=dx/len, ny=dy/len;
    const px=-ny, py=nx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bx - px*tipW*0.5, by - py*tipW*0.5);
    ctx.lineTo(bx + nx*tipL,     by + ny*tipL);
    ctx.lineTo(bx + px*tipW*0.5, by + py*tipW*0.5);
    ctx.closePath();
    ctx.fillStyle = v.glyphColor;
    ctx.fill();
    ctx.restore();
  }

  const cos = Math.cos(ang), sin = Math.sin(ang);

  // 槍 A: 右上tip ─── 左下tip
  const aHiX = cx + cos*sLen, aHiY = cy - sin*sLen;
  const aLoX = cx - cos*sLen, aLoY = cy + sin*sLen;
  drawSpearLine(aLoX, aLoY, aHiX, aHiY);
  drawTip(aHiX, aHiY, aHiX-cx, aHiY-cy);  // 右上尖頭
  drawTip(aLoX, aLoY, aLoX-cx, aLoY-cy);  // 左下尖頭

  // 槍 B: 左上tip ─── 右下tip
  const bHiX = cx - cos*sLen, bHiY = cy - sin*sLen;
  const bLoX = cx + cos*sLen, bLoY = cy + sin*sLen;
  drawSpearLine(bLoX, bLoY, bHiX, bHiY);
  drawTip(bHiX, bHiY, bHiX-cx, bHiY-cy);  // 左上尖頭
  drawTip(bLoX, bLoY, bLoX-cx, bLoY-cy);  // 右下尖頭
}

// ── 5. 中心紅點（綁帶 / 漆印）───────────────
{
  const gW = v.glyphWidth * (sz/128);
  const dotR = gW * 1.15;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, dotR, 0, Math.PI*2);
  const dg = ctx.createRadialGradient(cx-dotR*0.3, cy-dotR*0.3, 0, cx, cy, dotR);
  dg.addColorStop(0, '#C83000');
  dg.addColorStop(1, '#5A0E00');
  ctx.fillStyle = dg;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, dotR, 0, Math.PI*2);
  ctx.lineWidth = dotR * 0.2;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.stroke();
  ctx.restore();
}

// ── 6. 噪點材質（做舊、磨耗感）──────────────
{
  const ni = v.noiseIntensity;
  if(ni > 0){
    const imgData = ctx.getImageData(0, 0, sz, sz);
    const data = imgData.data;
    // xorshift32 pseudo-random
    let seed = 0xABCD1234;
    function xr(){
      seed ^= seed << 13;
      seed ^= seed >> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 0xFFFFFFFF;
    }
    for(let i=0; i<data.length; i+=4){
      if(data[i+3] > 8){
        const n = (xr() - 0.5) * ni * 72;
        data[i]   = Math.max(0, Math.min(255, data[i]   + n));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + n));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + n));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
}

// ── 7. 最終圓形 clip（圓外透明）────────────
{
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

document.title = 'DONE';
})();
</script>
</body>
</html>`;
}

// 用 base64 母圖縮放成小尺寸（比直接 re-render 品質好）
function buildThumbHTML(base64PNG, targetSize, srcSize) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
html, body { margin:0; padding:0; width:${targetSize}px; height:${targetSize}px; overflow:hidden; background:transparent; }
img { display:block; width:${targetSize}px; height:${targetSize}px; image-rendering:auto; }
</style>
</head>
<body>
<img src="data:image/png;base64,${base64PNG}" width="${targetSize}" height="${targetSize}">
<script>
document.querySelector('img').onload = function(){ document.title = 'DONE'; };
</script>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────
// puppeteer 截圖（透明底）
// ──────────────────────────────────────────────────────
async function screenshotPage(browser, html, w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction("document.title === 'DONE'", { timeout: 10000 });
  const buf = await page.screenshot({
    type: 'png',
    omitBackground: true,
    clip: { x: 0, y: 0, width: w, height: h },
  });
  await page.close();
  return buf;
}

// ──────────────────────────────────────────────────────
// 主流程
// ──────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const browserArg = args.indexOf('--browser');
  const browserPath = browserArg >= 0 ? args[browserArg + 1] : BROWSER_PATH;

  if (!fs.existsSync(browserPath)) {
    console.error(`Browser not found: ${browserPath}`);
    console.error('Usage: node gen-icon-v2-candidates.js [--browser <path>]');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--force-color-profile=srgb',
    ],
  });

  try {
    for (const variant of VARIANTS) {
      console.log(`\n[${variant.id}] ${variant.label}`);

      // 1. 先產 128px 母圖
      const html128 = buildBadgeHTML(variant, 128);
      const buf128 = await screenshotPage(browser, html128, 128, 128);
      const file128 = path.join(OUTPUT_DIR, `unitinfo_type_icon_spear_${variant.id}_128.png`);
      fs.writeFileSync(file128, buf128);
      console.log(`  ✓ ${path.basename(file128)}`);

      // 2. 64px / 32px：從母圖縮放（品質優於重新 render）
      const b64 = buf128.toString('base64');
      for (const sz of [64, 32]) {
        const html = buildThumbHTML(b64, sz, 128);
        const buf  = await screenshotPage(browser, html, sz, sz);
        const file = path.join(OUTPUT_DIR, `unitinfo_type_icon_spear_${variant.id}_${sz}.png`);
        fs.writeFileSync(file, buf);
        console.log(`  ✓ ${path.basename(file)}`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n✅ 全部完成');
  console.log(`📁 輸出目錄: ${OUTPUT_DIR}`);
  console.log('\n產出清單:');
  for (const v of VARIANTS) {
    for (const sz of SIZES) {
      console.log(`  artifacts/ui-qa/UI-2-0032/unitinfo_type_icon_spear_${v.id}_${sz}.png`);
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
