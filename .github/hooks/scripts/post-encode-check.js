/**
 * PostToolUse Hook — 自動編碼防災檢查
 * 在 Agent 修改 .md / .json / .ts / .js / .ps1 等高風險文字檔後，
 * 自動執行 check-encoding-touched.js，若發現 BOM 或亂碼立即注入警告。
 */
const path = require('path');
const { execSync } = require('child_process');

/** 高風險副檔名（UTF-8 破損高風險） */
const HIGH_RISK_EXTS = new Set(['.md', '.json', '.ts', '.js', '.ps1']);

/** 從不同工具的 tool_input 結構中提取被修改的檔案路徑列表 */
function extractFilePaths(toolName, toolInput) {
  if (!toolInput) return [];

  switch (toolName) {
    case 'create_file':
    case 'replace_string_in_file':
      return toolInput.filePath ? [toolInput.filePath] : [];

    case 'multi_replace_string_in_file': {
      // replacements 是陣列，每個元素有 filePath
      const reps = toolInput.replacements || [];
      const paths = reps.map(r => r.filePath).filter(Boolean);
      // 去重
      return [...new Set(paths)];
    }

    default:
      return [];
  }
}

let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  const input = JSON.parse(data || '{}');
  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};
  const cwd = input.cwd || process.cwd();

  const filePaths = extractFilePaths(toolName, toolInput);
  if (filePaths.length === 0) {
    process.exit(0);
    return;
  }

  // 只對高風險副檔名執行檢查
  const toCheck = filePaths.filter(fp => {
    const ext = path.extname(fp).toLowerCase();
    return HIGH_RISK_EXTS.has(ext);
  });

  if (toCheck.length === 0) {
    process.exit(0);
    return;
  }

  // 轉成相對路徑（避免引號問題）
  const relPaths = toCheck.map(fp => {
    if (path.isAbsolute(fp)) {
      return path.relative(cwd, fp).replace(/\\/g, '/');
    }
    return fp;
  });

  const filesArg = relPaths.map(p => `"${p}"`).join(' ');
  const cmd = `node tools_node/check-encoding-touched.js --files ${filesArg}`;

  try {
    execSync(cmd, { cwd, stdio: 'pipe' });
    // 編碼正常，靜默通過
    process.exit(0);
  } catch (e) {
    // 編碼異常，注入警告到 Agent 對話
    const badFiles = relPaths.join(', ');
    const output = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          `🚨 編碼防災警告：以下檔案可能有 UTF-8 BOM 或亂碼（mojibake）：\n` +
          `  ${badFiles}\n\n` +
          `請立刻執行修復：\n` +
          `  node tools_node/check-encoding-touched.js --files ${filesArg}\n\n` +
          `若確認有問題，用乾淨 UTF-8 重建檔案，不要做猜字修補。`,
      },
    };
    process.stdout.write(JSON.stringify(output) + '\n');
    process.exit(0); // 不直接 block，讓 Agent 自己判斷是否修復
  }
});
