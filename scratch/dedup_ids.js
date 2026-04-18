const fs = require('fs');
const content = fs.readFileSync('docs/遊戲規格文件/討論來源整併狀態.md', 'utf8');
// Deduplicate (ID)` (ID)
let cleaned = content.replace(/\((doc_[a-z]+_\d+)\)`\s*\(\1\)/g, '($1)`');
// Deduplicate (ID) (ID)
cleaned = cleaned.replace(/\((doc_[a-z]+_\d+)\)\s*\(\1\)/g, '($1)');
fs.writeFileSync('docs/遊戲規格文件/討論來源整併狀態.md', cleaned);
console.log('Deduplication complete.');
