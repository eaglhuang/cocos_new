// @ts-check
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const batchDir = 'artifacts/ui-library/title_stretch_x/general_detail/candidate_sets/candidate_batch_2026_04_09';
const nums = [1,2,3,4,5,7,8,9];

function checkAlpha(n) {
  const name = `\u5de6\u53f3\u62c9\u4f38\u6a19\u984c${n}`;
  const f = path.join(batchDir, name, `${name}_nobg.png`);
  return new Promise((resolve, reject) => {
    fs.createReadStream(f)
      .pipe(new PNG())
      .on('parsed', function() {
        const total = this.width * this.height;
        let transparent = 0;
        for (let i = 3; i < this.data.length; i += 4) {
          if (this.data[i] < 10) transparent++;
        }
        const pct = ((transparent / total) * 100).toFixed(1);
        resolve(`標題${n}: ${this.width}x${this.height}  transparent=${transparent} (${pct}%)  opaque=${total - transparent}`);
      })
      .on('error', reject);
  });
}

Promise.all(nums.map(checkAlpha)).then(r => r.forEach(l => console.log(l))).catch(e => console.error(e));
