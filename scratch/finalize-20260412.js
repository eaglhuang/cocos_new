const { execSync } = require('child_process');

const files = [
  ['docs/遊戲規格文件/討論來源/20260412/傳承：血脈保底機制規格書.md', 'doc_spec_0026,doc_spec_0027'],
  ['docs/遊戲規格文件/討論來源/20260412/培育系統規格書討論.md', 'doc_spec_0026,doc_spec_0027'],
  ['docs/遊戲規格文件/討論來源/20260412/賽馬娘三國傳承系統解析.md', 'doc_spec_0026,doc_spec_0027'],
];

for (const [f, targets] of files) {
  try {
    execSync(`node tools_node/consolidation-backfill.js complete "${f}" --targets ${targets} --notes "StrategyA Phase1-4 20260412補遺已回寫到培育系統.md"`, { stdio: 'pipe' });
    console.log('✅ ' + f.split('/').pop());
  } catch(e) {
    console.log('❌ ' + e.message.slice(0,120));
  }
}

const result = execSync('node tools_node/consolidation-finalize.js report', { encoding: 'utf8' });
console.log(result);
