/**
 * PreToolUse Hook
 * 在 Agent 呼叫工具前執行：
 * 1. 完全封鎖 get_changed_files（本專案含大量 PNG binary，必定 413）
 * 2. 對直接讀取大型已知重量檔案時注入 token 警告訊息
 */
const path = require('path');

let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  const input = JSON.parse(data || '{}');
  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};

  // ─── 1. 完全封鎖 get_changed_files ────────────────────────────────────────
  if (toolName === 'get_changed_files') {
    process.stderr.write(
      '[token-guard] ❌ get_changed_files 已被封鎖！\n' +
      '本專案含大量 PNG/binary QA artifact，此工具會把所有 diff（含 PNG binary）\n' +
      '一次塞入 context，必定觸發 413 Request Entity Too Large 並導致 Agent 凍結。\n\n' +
      '替代方式：\n' +
      '  • 查 git 狀態：git status --short\n' +
      '  • 查特定檔 diff：git diff -- <filepath>（限 .ts/.json/.md）\n' +
      '  • 查最新 commit：git log -1 --stat\n'
    );
    process.exit(2); // exit code 2 = blocking error，Agent 看到 stderr 作為上下文
    return;
  }

  // ─── 2. 大型已知重量檔案警告 ───────────────────────────────────────────────
  const HEAVY_FILES = [
    'docs/keep.md',
    'docs/ui-quality-todo.json',
    'docs/cross-reference-index.md',
  ];

  if (toolName === 'read_file') {
    const filePath = toolInput.filePath || toolInput.file_path || '';
    const isHeavy = HEAVY_FILES.some(f => filePath.replace(/\\/g, '/').includes(f));

    if (isHeavy) {
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason:
            `⚠️ Token 警告：${path.basename(filePath)} 是大型重量檔案（估算 >6000 tokens）。\n` +
            `建議替代方式：\n` +
            `  • docs/keep.md → 先讀 docs/keep.summary.md\n` +
            `  • 其他大型 doc → 用 grep_search 搜尋特定關鍵字\n` +
            `  • ui-quality-todo.json → 讀對應 shard docs/ui-quality-tasks/*.json\n` +
            `確定仍要整份讀入？`,
        },
      };
      process.stdout.write(JSON.stringify(output) + '\n');
      return;
    }
  }

  // ─── 3. grep_search 萬用路徑 artifacts 警告 ────────────────────────────────
  if (toolName === 'grep_search') {
    const includePattern = toolInput.includePattern || '';
    if (includePattern.includes('artifacts') && !toolInput.maxResults) {
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext:
            '⚠️ token-guard：在 artifacts/ 目錄使用 grep_search 時，' +
            '請加上 "maxResults": 10 避免大量 PNG 路徑塞滿結果。',
        },
      };
      process.stdout.write(JSON.stringify(output) + '\n');
      return;
    }
  }

  // 預設允許
  process.exit(0);
});
