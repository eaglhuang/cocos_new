#!/usr/bin/env node
/**
 * tools_node/consolidation-rescan-all.js
 *
 * 全量重掃工具 (Strategy A)
 *
 * Usage:
 *   node tools_node/consolidation-rescan-all.js extract-all
 *       批量 parse + summary 全 112 檔，存至 artifacts/consolidation/extraction/
 *
 *   node tools_node/consolidation-rescan-all.js gap-report
 *       讀取 extraction 結果，對比現行 67 份規格書，輸出差異報告
 *
 *   node tools_node/consolidation-rescan-all.js list-pending
 *       列出 manifest 中所有仍為 pending 的檔案
 *
 *   node tools_node/consolidation-rescan-all.js stats
 *       顯示各目錄段落統計
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const SOURCES_DIR = path.join(ROOT, 'docs/遊戲規格文件/討論來源');
const SPECS_DIR = path.join(ROOT, 'docs/遊戲規格文件/系統規格書');
const MANIFEST_PATH = path.join(ROOT, 'docs/遊戲規格文件/consolidation-manifest.json');
const EXTRACTION_DIR = path.join(ROOT, 'artifacts/consolidation/extraction');
const REPORT_PATH = path.join(ROOT, 'artifacts/consolidation/gap-report.md');

const args = process.argv.slice(2);
const cmd = args[0];

// ── Helpers ────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function extractParagraphs(content, filePath) {
  const lines = content.split('\n');
  const paragraphs = [];
  let currentPara = null;
  let idx = 0;

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (currentPara) paragraphs.push(currentPara);
      currentPara = {
        index: idx++,
        heading: line.replace(/^##\s+/, '').trim(),
        lines: [line],
        preview: '',
      };
    } else if (/^#\s/.test(line) && !currentPara) {
      // Top-level heading as lead paragraph
      currentPara = {
        index: idx++,
        heading: line.replace(/^#\s+/, '').trim(),
        lines: [line],
        preview: '',
      };
    } else if (currentPara) {
      currentPara.lines.push(line);
    }
  }
  if (currentPara) paragraphs.push(currentPara);

  // If no ## headings found, treat whole file as one paragraph
  if (paragraphs.length === 0 && content.trim()) {
    paragraphs.push({
      index: 0,
      heading: path.basename(filePath, '.md'),
      lines: content.split('\n'),
      preview: '',
    });
  }

  // Build previews (first 120 chars of body)
  for (const p of paragraphs) {
    const body = p.lines.slice(1).join(' ').replace(/\s+/g, ' ').trim();
    p.preview = body.slice(0, 150);
    delete p.lines; // save memory
  }

  return paragraphs;
}

// Extract key topics/keywords from content
function extractKeyTopics(content) {
  const topics = new Set();
  const keywords = [
    '虎符', '兵種', '培育', '血統', '英靈', '轉蛋', '壽命', '名將', '傭兵',
    '教官', '結緣', '配種', '大廳', '關卡', '戰場', '部署', '戰法', '因子',
    '爆發', '數值', '經濟', '商城', '留存', '官職', '領地', '治理', '俘虜',
    '武將', '子嗣', '世家', '奧義', '同步', '資源', '道具', '運氣', '新手',
    '開場', 'AI', '美術', '視覺', '競技', '挑戰賽', '精力', '登入', '時間',
    '軍師', '武力', '智力', '政治', '魅力', '忠誠',
  ];
  for (const kw of keywords) {
    if (content.includes(kw)) topics.add(kw);
  }
  return [...topics];
}

// ── Command: stats ─────────────────────────────────────────────────────────
function cmdStats() {
  const manifest = loadManifest();
  const byDir = {};
  for (const f of manifest.files) {
    const dir = f.path.split('/').slice(0, -1).join('/').replace('docs/遊戲規格文件/討論來源', '') || '/';
    if (!byDir[dir]) byDir[dir] = { files: 0, pending: 0, completed: 0 };
    byDir[dir].files++;
    if (f.status === 'pending') byDir[dir].pending++;
    else if (f.status === 'completed') byDir[dir].completed++;
  }
  console.log('\n[Stats] 各目錄狀態：');
  for (const [dir, stat] of Object.entries(byDir)) {
    console.log(`  ${dir || '/'}: ${stat.files} files | completed: ${stat.completed} | pending: ${stat.pending}`);
  }
}

// ── Command: list-pending ──────────────────────────────────────────────────
function cmdListPending() {
  const manifest = loadManifest();
  const pending = manifest.files.filter(f => f.status === 'pending');
  console.log(`\n[Pending] ${pending.length} files:\n`);
  for (const f of pending) {
    console.log(`  ${f.path}`);
  }
}

// ── Command: extract-all ───────────────────────────────────────────────────
function cmdExtractAll() {
  ensureDir(EXTRACTION_DIR);
  const manifest = loadManifest();

  let processed = 0;
  let errors = 0;

  for (const file of manifest.files) {
    const fullPath = path.join(ROOT, file.path);
    if (!fs.existsSync(fullPath)) {
      console.log(`  ⚠ NOT FOUND: ${file.path}`);
      errors++;
      continue;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const paragraphs = extractParagraphs(content, fullPath);
      const topics = extractKeyTopics(content);

      const extraction = {
        path: file.path,
        hash: crypto.createHash('sha256').update(content).digest('hex').slice(0, 12),
        paragraphCount: paragraphs.length,
        topics,
        paragraphs,
        stats: {
          charCount: content.length,
          wordCount: content.split(/\s+/).length,
        },
      };

      const outPath = path.join(EXTRACTION_DIR, file.hash || extraction.hash + '.json');
      fs.writeFileSync(outPath, JSON.stringify(extraction, null, 2), 'utf8');

      // Update manifest paragraph total
      file.paragraphs = {
        total: paragraphs.length,
        consolidated: 0, doubt: 0, discarded: 0,
        pending: paragraphs.length,
      };
      file.coverage_percentage = 0;
      file._extractionHash = extraction.hash;

      processed++;
      if (processed % 10 === 0) console.log(`  ... ${processed}/${manifest.files.length} done`);
    } catch (e) {
      console.log(`  ❌ ERROR: ${file.path}: ${e.message}`);
      errors++;
    }
  }

  // Save updated manifest
  manifest._meta.lastUpdated = new Date().toISOString().split('T')[0];
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\n[extract-all] Done: ${processed} processed, ${errors} errors`);
  console.log(`Extraction files saved to: ${EXTRACTION_DIR}`);
}

// ── Command: gap-report ────────────────────────────────────────────────────
function cmdGapReport() {
  ensureDir(path.dirname(REPORT_PATH));

  // Load all spec docs and index their keywords
  const specFiles = fs.readdirSync(SPECS_DIR).filter(f => f.endsWith('.md'));
  const specIndex = {};
  for (const sf of specFiles) {
    const content = fs.readFileSync(path.join(SPECS_DIR, sf), 'utf8');
    const topics = extractKeyTopics(content);
    const docIdMatch = content.match(/doc_id:\s*([\w_]+)/);
    specIndex[sf] = {
      fileName: sf,
      docId: docIdMatch ? docIdMatch[1] : null,
      topics,
      charCount: content.length,
    };
  }

  // Load all extraction results
  if (!fs.existsSync(EXTRACTION_DIR)) {
    console.error('[ERROR] No extraction data found. Run extract-all first.');
    process.exit(1);
  }

  const extractionFiles = fs.readdirSync(EXTRACTION_DIR).filter(f => f.endsWith('.json'));
  const extractions = [];
  for (const ef of extractionFiles) {
    try {
      extractions.push(JSON.parse(fs.readFileSync(path.join(EXTRACTION_DIR, ef), 'utf8')));
    } catch {}
  }

  // Analyze gaps
  const gapItems = [];
  const allSpecTopics = new Set();
  for (const spec of Object.values(specIndex)) {
    for (const t of spec.topics) allSpecTopics.add(t);
  }

  // Find topics in discussions NOT well-covered in specs
  const topicCoverage = {};
  for (const ext of extractions) {
    for (const topic of ext.topics) {
      if (!topicCoverage[topic]) topicCoverage[topic] = { discussion: 0, specs: [] };
      topicCoverage[topic].discussion++;
    }
  }
  for (const [sf, spec] of Object.entries(specIndex)) {
    for (const t of spec.topics) {
      if (!topicCoverage[t]) topicCoverage[t] = { discussion: 0, specs: [] };
      topicCoverage[t].specs.push(sf);
    }
  }

  // Find potentially uncovered topics
  const uncovered = Object.entries(topicCoverage)
    .filter(([t, v]) => v.discussion > 0 && v.specs.length === 0)
    .sort((a, b) => b[1].discussion - a[1].discussion);

  // Find files with content not mapped to specs
  const manifest = loadManifest();
  const pendingFiles = manifest.files.filter(f => f.status === 'pending');

  // Build report
  let report = `# 全量整併差異分析報告 (Gap Report)\n\n`;
  report += `生成時間: ${new Date().toISOString()}\n`;
  report += `策略: A（完全重設）\n\n`;
  report += `---\n\n`;
  report += `## 1. 整體統計\n\n`;
  report += `| 項目 | 數量 |\n|---|---|\n`;
  report += `| 討論來源文件 | ${manifest.files.length} |\n`;
  report += `| 正式規格書 | ${specFiles.length} |\n`;
  report += `| Pending 待分析 | ${pendingFiles.length} |\n`;
  report += `| 提取分析完成 | ${extractions.length} |\n\n`;

  report += `## 2. 待分析檔案列表（依目錄）\n\n`;
  const byDir = {};
  for (const f of pendingFiles) {
    const dir = f.path.replace('docs/遊戲規格文件/討論來源/', '').split('/')[0] || '根目錄';
    if (!byDir[dir]) byDir[dir] = [];
    byDir[dir].push(f.path);
  }
  for (const [dir, files] of Object.entries(byDir)) {
    report += `### ${dir} (${files.length} 檔)\n\n`;
    for (const f of files) {
      const name = f.split('/').pop().replace('.md', '');
      report += `- [ ] \`${name}\`\n`;
    }
    report += '\n';
  }

  report += `## 3. 主題覆蓋分析\n\n`;
  report += `### 3.1 規格書已涵蓋的討論主題\n\n`;
  const covered = Object.entries(topicCoverage)
    .filter(([t, v]) => v.discussion > 0 && v.specs.length > 0)
    .sort((a, b) => b[1].discussion - a[1].discussion);
  for (const [topic, val] of covered.slice(0, 20)) {
    report += `- **${topic}**: 出現於 ${val.discussion} 份討論，已有 ${val.specs.length} 份規格涵蓋\n`;
  }

  report += `\n### 3.2 討論中提及但規格書可能不足的主題\n\n`;
  if (uncovered.length === 0) {
    report += `✅ 所有討論主題在現行規格書中均有對應！\n\n`;
  } else {
    for (const [topic, val] of uncovered) {
      report += `- ⚠️ **${topic}**: 出現於 ${val.discussion} 份討論，但規格書中 [主題關鍵字] 未直接對應\n`;
    }
    report += '\n';
  }

  report += `## 4. 規格書現況（${specFiles.length} 份）\n\n`;
  const sortedSpecs = Object.values(specIndex).sort((a, b) => b.charCount - a.charCount);
  report += `| 規格書 | 大小(KB) | 主題數 |\n|---|---|---|\n`;
  for (const spec of sortedSpecs.slice(0, 20)) {
    report += `| ${spec.fileName.replace('.md', '')} | ${Math.round(spec.charCount/1024)} | ${spec.topics.length} |\n`;
  }
  report += `\n*(顯示最大 20 份)*\n\n`;

  report += `## 5. 下一步行動\n\n`;
  report += `Agent 需要逐檔閱讀 pending 列表，對每個段落：\n`;
  report += `1. 如已有現行規格涵蓋 → 標記 \`consolidated\` + target spec\n`;
  report += `2. 如有衝突或新規則 → 生成 MCQ (Q61+)\n`;
  report += `3. 如屬過時廢案 → 標記 \`discarded\`\n`;
  report += `4. 如主題量大且無現行規格 → 建立新規格書\n\n`;
  report += `> Q1~Q60 裁決視為正式規則，直接引用，不重新提問。\n`;

  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(`\n[gap-report] Report saved to: ${REPORT_PATH}`);
  console.log(`Pending files: ${pendingFiles.length}`);
  console.log(`Covered topics: ${covered.length}, Potentially uncovered: ${uncovered.length}`);
}

// ── Main ───────────────────────────────────────────────────────────────────
switch (cmd) {
  case 'extract-all': cmdExtractAll(); break;
  case 'gap-report': cmdGapReport(); break;
  case 'list-pending': cmdListPending(); break;
  case 'stats': cmdStats(); break;
  default:
    console.log(`
[consolidation-rescan-all]

Usage:
  node tools_node/consolidation-rescan-all.js extract-all
  node tools_node/consolidation-rescan-all.js gap-report
  node tools_node/consolidation-rescan-all.js list-pending
  node tools_node/consolidation-rescan-all.js stats
`);
}
