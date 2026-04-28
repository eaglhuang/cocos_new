// tools_node/crop-regions.js  — PNG crop helper using pngjs
'use strict';
const fs = require('fs');
const path = require('path');
const { PNG } = require(path.join(__dirname, '../node_modules/pngjs/lib/png'));

function crop(src, dst, x, y, w, h, maxW) {
  const img = PNG.sync.read(fs.readFileSync(src));
  const W = img.width;
  // clamp
  if (x + w > W) w = W - x;
  if (y + h > img.height) h = img.height - y;
  // extract region
  const buf = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++) {
    const srcOff = ((y + row) * W + x) * 4;
    img.data.copy(buf, row * w * 4, srcOff, srcOff + w * 4);
  }
  // nearest-neighbour scale
  const scale = maxW / w;
  const nw = maxW, nh = Math.round(h * scale);
  const outBuf = Buffer.alloc(nw * nh * 4);
  for (let dy = 0; dy < nh; dy++) {
    for (let dx = 0; dx < nw; dx++) {
      const sx = Math.min(Math.floor(dx / scale), w - 1);
      const sy = Math.min(Math.floor(dy / scale), h - 1);
      const si = (sy * w + sx) * 4;
      const di = (dy * nw + dx) * 4;
      outBuf[di] = buf[si]; outBuf[di+1] = buf[si+1];
      outBuf[di+2] = buf[si+2]; outBuf[di+3] = buf[si+3];
    }
  }
  const out = new PNG({ width: nw, height: nh });
  out.data = outBuf;
  fs.writeFileSync(dst, PNG.sync.write(out));
  console.log(`saved ${path.basename(dst)} (${nw}x${nh})`);
}

const SRC = 'artifacts/skill-test-html-to-ucuf/gacha/m24.compare.png';
const O = 'artifacts/_view_image';
// compare PNG = 1920 x 1080, left half=HTML (x:0-959), right half=UCUF (x:960-1919)
crop(SRC, O+'/gacha-bottom-html.png',   0, 780,  960, 300, 480);
crop(SRC, O+'/gacha-bottom-ucuf.png', 960, 780,  960, 300, 480);
crop(SRC, O+'/gacha-banner-html.png',   0,   0,  350, 270, 350);
crop(SRC, O+'/gacha-banner-ucuf.png', 960,   0,  350, 270, 350);
crop(SRC, O+'/gacha-right-html.png',  680,   0,  280, 860, 280);
crop(SRC, O+'/gacha-right-ucuf.png', 1640,   0,  280, 860, 280);
