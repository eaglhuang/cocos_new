const fs = require('fs');

const checkListFile = 'docs/agent-briefs/CheckList.md';
const tasksIndexFile = 'docs/agent-briefs/tasks_index.md';

// Update CheckList
let checkListContent = fs.readFileSync(checkListFile, 'utf8');
checkListContent = checkListContent.replace(
  '| P1 | [UI-2-0024](tasks/UI-2-0024.md) | `UIPreviewBuilder.ts` 中文密度過高且曾出現編碼災難風險，多人同檔衝突成本過大 | 2026-03-31 | 在目前修復穩定後，拆分 `UIPreviewBuilder.ts` 為 helper 模組以降低編碼與 merge 風險 | not-started | 0% | — | Agent1 |',
  '| P1 | [UI-2-0024](tasks/UI-2-0024.md) | `UIPreviewBuilder.ts` 中文密度過高且曾出現編碼災難風險，多人同檔衝突成本過大 | 2026-03-31 | 在目前修復穩定後，拆分 `UIPreviewBuilder.ts` 為 helper 模組以降低編碼與 merge 風險 | in-progress | 35% | — | Agent1 |'
);

// Update tasks_index
let tasksIndexContent = fs.readFileSync(tasksIndexFile, 'utf8');
tasksIndexContent = tasksIndexContent.replace(
  '| UI-2-0024 | Agent1 | not-started',
  '| UI-2-0024 | Agent1 | in-progress'
);

fs.writeFileSync(checkListFile, checkListContent, 'utf8');
fs.writeFileSync(tasksIndexFile, tasksIndexContent, 'utf8');
console.log('✓ Updated CheckList and tasks_index');
