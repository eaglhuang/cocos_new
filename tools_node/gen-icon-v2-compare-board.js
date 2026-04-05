/**
 * gen-icon-v2-compare-board.js
 * 產出 UI-2-0032 v1 vs v2a/v2b/v2c 對比板
 * 輸出: artifacts/ui-qa/UI-2-0032/v2-compare-board.png
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const DIR = path.resolve(__dirname, '../artifacts/ui-qa/UI-2-0032');
const V1_PATH = path.resolve(__dirname, '../artifacts/ui-generated/UI-2-0028/unitinfo_type_icon_spear_v1.png');
const BROWSER_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUTPUT = path.join(DIR, 'v2-compare-board.png');

function imgToB64(p) {
  return fs.readFileSync(p).toString('base64');
}

function buildHTML(images) {
  // images: { v1_128, v2a_128, v2a_64, v2a_32, v2b_128, ... }
  const b = (k) => `data:image/png;base64,${images[k]}`;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#F5F0E8; font-family: Arial, sans-serif; padding:32px; width:900px; }
h1 { font-size:20px; margin-bottom:4px; color:#333; }
.sub { font-size:12px; color:#888; margin-bottom:24px; }
.grid { display:flex; gap:16px; margin-bottom:24px; }
.card { background:#fff; border:1px solid #ddd; border-radius:6px; padding:16px; flex:1; }
.card-label { font-size:13px; font-weight:bold; color:#444; margin-bottom:4px; }
.card-sub { font-size:11px; color:#888; margin-bottom:12px; }
.sizes { display:flex; align-items:flex-end; gap:12px; }
.size-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; }
.size-wrap span { font-size:10px; color:#999; }
.checker { background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 8px 8px; display:inline-block; }
img { display:block; }
.v1-tag { display:inline-block; background:#888; color:#fff; font-size:10px; padding:2px 6px; border-radius:3px; margin-bottom:8px; }
.v2-tag { display:inline-block; background:#5B7DB1; color:#fff; font-size:10px; padding:2px 6px; border-radius:3px; margin-bottom:8px; }
.focus { font-size:11px; color:#666; margin-top:8px; line-height:1.5; }
.row-label { font-size:12px; color:#555; font-weight:bold; margin-bottom:8px; }
</style>
</head>
<body>
<h1>UI-2-0032 Icon v2 Candidate Compare Board</h1>
<div class="sub">v1 baseline vs v2a / v2b / v2c candidates — F7 戰場微型屬性 badge</div>

<div class="grid">
  <!-- v1 -->
  <div class="card">
    <div class="card-label">v1 (baseline)</div>
    <div class="card-sub">UI-2-0028 原始版本</div>
    <span class="v1-tag">baseline</span>
    <div class="sizes">
      <div class="size-wrap">
        <div class="checker"><img src="${b('v1_128')}" width="128" height="128"></div>
        <span>128px</span>
      </div>
    </div>
    <div class="focus">gap: 過亮、過乾淨<br>glyph 太細、太現代</div>
  </div>

  <!-- v2a -->
  <div class="card">
    <div class="card-label">v2a — 偏穩定、厚重</div>
    <div class="card-sub">最接近v1，金邊更厚，glyph更粗</div>
    <span class="v2-tag">v2a</span>
    <div class="sizes">
      <div class="size-wrap">
        <div class="checker"><img src="${b('v2a_128')}" width="128" height="128"></div>
        <span>128px</span>
      </div>
      <div class="size-wrap">
        <div class="checker"><img src="${b('v2a_64')}" width="64" height="64"></div>
        <span>64px</span>
      </div>
      <div class="size-wrap">
        <div class="checker"><img src="${b('v2a_32')}" width="32" height="32"></div>
        <span>32px</span>
      </div>
    </div>
  </div>

  <!-- v2b -->
  <div class="card">
    <div class="card-label">v2b — 舊幣 / 勳章感</div>
    <div class="card-sub">更暗銅金、更厚邊、更多噪點</div>
    <span class="v2-tag">v2b</span>
    <div class="sizes">
      <div class="size-wrap">
        <div class="checker"><img src="${b('v2b_128')}" width="128" height="128"></div>
        <span>128px</span>
      </div>
      <div class="size-wrap">
        <div class="checker"><img src="${b('v2b_64')}" width="64" height="64"></div>
        <span>64px</span>
      </div>
      <div class="size-wrap">
        <div class="checker"><img src="${b('v2b_32')}" width="32" height="32"></div>
        <span>32px</span>
      </div>
    </div>
  </div>

  <!-- v2c -->
  <div class="card">
    <div class="card-label">v2c — 高對比戰場 badge</div>
    <div class="card-sub">最深底盤、最亮金邊、最粗glyph</div>
    <span class="v2-tag">v2c</span>
    <div class="sizes">
      <div class="size-wrap">
        <div class="checker"><img src="${b('v2c_128')}" width="128" height="128"></div>
        <span>128px</span>
      </div>
      <div class="size-wrap">
        <div class="checker"><img src="${b('v2c_64')}" width="64" height="64"></div>
        <span>64px</span>
      </div>
      <div class="size-wrap">
        <div class="checker"><img src="${b('v2c_32')}" width="32" height="32"></div>
        <span>32px</span>
      </div>
    </div>
  </div>
</div>

<div class="focus">
  <strong>v2 共同改進：</strong>
  舊金/黯金 rim（非光亮現代金）｜ 深墨藍 / 槍鐵藍內盤｜ 骨白 glyph（非亮藍）｜ 做舊噪點材質｜ 粗 glyph 保證 32px 可辨識
</div>

<script>document.title='DONE';</script>
</body>
</html>`;
}

async function main() {
  const args = process.argv.slice(2);
  const bi = args.indexOf('--browser');
  const browserPath = bi >= 0 ? args[bi + 1] : BROWSER_PATH;

  const images = {
    v1_128:  imgToB64(V1_PATH),
    v2a_128: imgToB64(path.join(DIR, 'unitinfo_type_icon_spear_v2a_128.png')),
    v2a_64:  imgToB64(path.join(DIR, 'unitinfo_type_icon_spear_v2a_64.png')),
    v2a_32:  imgToB64(path.join(DIR, 'unitinfo_type_icon_spear_v2a_32.png')),
    v2b_128: imgToB64(path.join(DIR, 'unitinfo_type_icon_spear_v2b_128.png')),
    v2b_64:  imgToB64(path.join(DIR, 'unitinfo_type_icon_spear_v2b_64.png')),
    v2b_32:  imgToB64(path.join(DIR, 'unitinfo_type_icon_spear_v2b_32.png')),
    v2c_128: imgToB64(path.join(DIR, 'unitinfo_type_icon_spear_v2c_128.png')),
    v2c_64:  imgToB64(path.join(DIR, 'unitinfo_type_icon_spear_v2c_64.png')),
    v2c_32:  imgToB64(path.join(DIR, 'unitinfo_type_icon_spear_v2c_32.png')),
  };

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 420 });
    await page.setContent(buildHTML(images), { waitUntil: 'load' });
    await page.waitForFunction("document.title==='DONE'", { timeout: 10000 });
    const buf = await page.screenshot({ type: 'png', fullPage: true });
    await page.close();
    fs.writeFileSync(OUTPUT, buf);
    console.log(`✓ ${path.basename(OUTPUT)}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
