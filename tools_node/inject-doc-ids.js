/**
 * inject-doc-ids.js — 批次將 doc_id 插入所有 registry 記錄的 .md 文件
 *
 * Usage:
 *   node tools_node/inject-doc-ids.js --dry-run   # 只列出會改的文件，不真正修改
 *   node tools_node/inject-doc-ids.js             # 正式插入
 *
 * 規則:
 *   - 有 YAML frontmatter (以 --- 開頭)：在 frontmatter 內加一行 doc_id: <id>
 *   - 無 YAML frontmatter：在第一行之前插入 <!-- doc_id: <id> -->
 *   - 已有 doc_id 的文件：略過（冪等）
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const REGISTRY_JSON = path.join(ROOT, 'docs', 'doc-id-registry.json');

function hasDocId(content) {
  return (
    /<!--\s*doc_id:\s*\S/.test(content) ||
    /\bdoc_id:\s*\S/m.test(content)
  );
}

function injectDocId(fullPath, docId, dryRun) {
  let content;
  try { content = fs.readFileSync(fullPath, 'utf8'); }
  catch (e) { return `ERROR reading: ${e.message}`; }

  if (hasDocId(content)) return 'skip';

  const hasFm  = content.startsWith('---\n') || content.startsWith('---\r\n');
  const eol    = content.includes('\r\n') ? '\r\n' : '\n';
  let newContent;

  if (hasFm) {
    // Insert doc_id: <id> as the FIRST key inside the frontmatter block
    newContent = content.replace(/^---[\r\n]/, `---${eol}doc_id: ${docId}${eol}`);
  } else {
    newContent = `<!-- doc_id: ${docId} -->\n${content}`;
  }

  if (!dryRun) {
    try { fs.writeFileSync(fullPath, newContent, 'utf8'); }
    catch (e) { return `ERROR writing: ${e.message}`; }
  }

  return hasFm ? 'yaml' : 'html';
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(REGISTRY_JSON)) {
    console.error('Registry not found.\nRun: node tools_node/doc-id-registry.js');
    process.exit(1);
  }

  const { registry } = JSON.parse(fs.readFileSync(REGISTRY_JSON, 'utf8'));
  const entries      = Object.entries(registry);

  console.log(dryRun
    ? '🔍 DRY RUN — no files will be modified\n'
    : '💉 Injecting doc_ids...\n');

  let injected = 0, skipped = 0, errors = 0;
  const changedPaths = [];

  for (const [docId, data] of entries) {
    const fullPath = path.join(ROOT, data.path);

    if (!fs.existsSync(fullPath)) {
      console.error(`  ❌ not found: ${data.path}`);
      errors++;
      continue;
    }

    const result = injectDocId(fullPath, docId, dryRun);

    if (result === 'skip') {
      skipped++;
    } else if (result.startsWith('ERROR')) {
      console.error(`  ❌ ${data.path}: ${result}`);
      errors++;
    } else {
      injected++;
      changedPaths.push(data.path);
      // Show all in dry-run; show first 30 in real run
      if (dryRun || injected <= 30) {
        const icon  = dryRun ? '🔍' : '✅';
        const label = result === 'yaml' ? '[YAML]' : '[HTML]';
        console.log(`  ${icon} ${docId.padEnd(22)} ${label} ${data.path}`);
      } else if (injected === 31) {
        console.log(`  ... (remaining files omitted from output)`);
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  ${dryRun ? 'Would inject' : 'Injected'} : ${injected}`);
  console.log(`  Skipped (already have doc_id): ${skipped}`);
  if (errors > 0) console.error(`  Errors: ${errors}`);

  if (!dryRun && changedPaths.length > 0) {
    // Write changed-files list for encoding check
    const listPath = path.join(ROOT, 'temp_doc_id_changed.txt');
    fs.writeFileSync(listPath, changedPaths.join('\n'), 'utf8');
    console.log(`\n📋 Changed files list saved: temp_doc_id_changed.txt`);
    console.log('   Encoding check:');
    console.log('   node tools_node/check-encoding-touched.js $(cat temp_doc_id_changed.txt)');
    console.log('\n   Verify:');
    console.log('   node tools_node/doc-id-registry.js --verify');
  }

  if (dryRun) {
    console.log('\n   Run without --dry-run to apply changes.');
  }
}

main();
