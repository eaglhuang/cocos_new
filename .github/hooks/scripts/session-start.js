/**
 * SessionStart Hook
 * 在每次新 Agent 會話開始時，自動注入 docs/keep.summary.md 的摘要內容，
 * 確保 Agent 不需要手動讀取就能獲得核心專案常識。
 */
const fs = require('fs');
const path = require('path');

let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  const cwd = JSON.parse(data || '{}').cwd || process.cwd();

  const summaryPath = path.join(cwd, 'docs', 'keep.summary.md');
  let summaryContent = '';
  try {
    summaryContent = fs.readFileSync(summaryPath, 'utf8').trim();
  } catch (e) {
    summaryContent = '[keep.summary.md 未找到，請檢查 docs/ 目錄]';
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: [
        '## [Auto-injected by SessionStart hook] docs/keep.summary.md',
        '',
        summaryContent,
        '',
        '---',
        '🚫 禁止事項：不要呼叫 get_changed_files（含大量 PNG binary，必定觸發 413）',
        '📋 完整規則：docs/keep.md §2b / .github/instructions/token-guard.instructions.md',
      ].join('\n'),
    },
  };

  process.stdout.write(JSON.stringify(output) + '\n');
});
