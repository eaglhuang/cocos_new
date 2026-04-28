const fs = require('fs');
const path = 'assets/resources/ui-spec/layouts/character-ds3-main.json';
const j = JSON.parse(fs.readFileSync(path, 'utf8'));
console.log('top keys:', Object.keys(j));
const root = j.root || j;
function walk(n, d, max) {
  if (d > max) return;
  const tag = `${' '.repeat(d * 2)}${n.name || '?'} [${n.type || '?'}]`;
  const meta = [];
  if (n.skinSlot) meta.push('skin=' + n.skinSlot);
  if (n._ucufId) meta.push('ucuf=' + n._ucufId);
  if (Array.isArray(n.children)) meta.push('children=' + n.children.length);
  console.log(tag + (meta.length ? '  ' + meta.join(' ') : ''));
  for (const c of (n.children || [])) walk(c, d + 1, max);
}
walk(root, 0, 4);
