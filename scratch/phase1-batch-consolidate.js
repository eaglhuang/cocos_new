#!/usr/bin/env node
/**
 * Phase 1~4 批次整併引擎
 * 策略 A：逐檔讀取所有段落，對照現行規格書，
 * 若內容已被涵蓋 → 標記 consolidated
 * 若有新內容/衝突 → 輸出到 doubt-queue.md 供人工 MCQ
 * 
 * Usage: node scratch/phase1-batch-consolidate.js [--dir 根目錄|新手開場|比較舊的|更舊的討論|最早的討論|20260410|20260412]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'docs/遊戲規格文件/consolidation-manifest.json');
const EXTRACTION_DIR = path.join(ROOT, 'artifacts/consolidation/extraction');
const DOUBT_QUEUE = path.join(ROOT, 'artifacts/consolidation/doubt-queue.md');

const args = process.argv.slice(2);
const targetDir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : null;

// 讀取所有現行規格書的摘要（只讀前 3000 字節加 doc_id 識別）
const SPECS_DIR = path.join(ROOT, 'docs/遊戲規格文件/系統規格書');
const specCache = {};
function loadSpec(fileName) {
  if (specCache[fileName]) return specCache[fileName];
  const fp = path.join(SPECS_DIR, fileName);
  if (!fs.existsSync(fp)) return null;
  const content = fs.readFileSync(fp, 'utf8');
  const docIdMatch = content.match(/<!--\s*doc_id:\s*([\w_]+)\s*-->/);
  const docId = docIdMatch ? docIdMatch[1] : null;
  specCache[fileName] = { fileName, docId, content: content.slice(0, 3000), fullPath: fp };
  return specCache[fileName];
}

// 預載所有規格書
const specFiles = fs.readdirSync(SPECS_DIR).filter(f => f.endsWith('.md'));
for (const sf of specFiles) loadSpec(sf);

// 建立 topic -> specFiles 的索引
const TOPIC_SPEC_MAP = {
  '虎符': ['兵種（虎符）系統.md', '戰場部署系統.md'],
  '兵種': ['兵種（虎符）系統.md'],
  '培育': ['培育系統.md'],
  '血統': ['血統理論系統.md', '英靈世家系統.md'],
  '英靈': ['英靈世家系統.md'],
  '轉蛋': ['轉蛋系統.md'],
  '壽命': ['武將壽命系統.md'],
  '名將': ['武將系統.md', '名將挑戰賽系統.md'],
  '傭兵': ['傭兵系統（試用）.md'],
  '教官': ['教官系統（支援卡）.md'],
  '結緣': ['結緣系統（配種）.md'],
  '配種': ['結緣系統（配種）.md'],
  '大廳': ['大廳系統.md'],
  '關卡': ['關卡設計系統.md'],
  '戰場': ['主戰場UI規格書.md', '戰場部署系統.md', '關卡設計系統.md'],
  '部署': ['戰場部署系統.md'],
  '戰法': ['戰法系統.md', '教官系統（支援卡）.md'],
  '因子': ['因子解鎖系統.md', '因子爆發系統.md'],
  '爆發': ['因子爆發系統.md'],
  '數值': ['數值系統.md'],
  '經濟': ['經濟系統.md'],
  '商城': ['大廳系統.md', '經濟系統.md'],
  '留存': ['留存系統.md'],
  '官職': ['官職系統.md'],
  '領地': ['領地治理系統.md'],
  '治理': ['治理模式他國AI系統.md', '領地治理系統.md'],
  '俘虜': ['俘虜處理系統.md'],
  '武將': ['武將系統.md'],
  '子嗣': ['英靈世家系統.md', '結緣系統（配種）.md'],
  '世家': ['英靈世家系統.md'],
  '奧義': ['奧義系統.md'],
  '同步': ['同步API規格書.md'],
  '資源': ['資源循環系統.md', '經濟系統.md'],
  '道具': ['道具系統（付費免費道具）.md'],
  '運氣': ['運氣系統.md'],
  '新手': ['新手開場規格書.md'],
  '開場': ['新手開場規格書.md'],
  'AI': ['AI武將強度系統.md', '治理模式他國AI系統.md'],
  '美術': ['美術風格規格書.md'],
  '視覺': ['美術風格規格書.md', '關卡設計系統.md'],
  '挑戰賽': ['名將挑戰賽系統.md'],
  '精力': ['數值系統.md'],
  '登入': ['留存系統.md'],
  '時間': ['遊戲時間系統.md'],
};

function getTargetSpecs(topics) {
  const specSet = new Set();
  for (const topic of topics) {
    const specs = TOPIC_SPEC_MAP[topic] || [];
    for (const s of specs) {
      const spec = loadSpec(s);
      if (spec && spec.docId) specSet.add(spec.docId);
    }
  }
  return [...specSet];
}

// 讀取 manifest
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

// 篩選要處理的檔案
let targetFiles = manifest.files.filter(f => f.status === 'pending');
if (targetDir) {
  const dirFilter = targetDir === '根目錄' 
    ? f => !f.path.replace('docs/遊戲規格文件/討論來源/', '').includes('/')
    : f => f.path.includes(`/討論來源/${targetDir}/`);
  targetFiles = targetFiles.filter(dirFilter);
}

console.log(`[Phase1~4] 處理 ${targetFiles.length} 個 pending 檔案${targetDir ? ` (目錄: ${targetDir})` : ''}\n`);

// 初始化 doubt queue
let doubtEntries = [];

let consolidated = 0;
let doubtCount = 0;

for (const file of targetFiles) {
  // 讀取 extraction 資料
  const extractFiles = fs.readdirSync(EXTRACTION_DIR);
  const extFile = extractFiles.find(ef => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(EXTRACTION_DIR, ef), 'utf8'));
      return data.path === file.path;
    } catch { return false; }
  });
  
  if (!extFile) {
    console.log(`  ⚠ 無提取資料: ${file.path}`);
    continue;
  }
  
  const extraction = JSON.parse(fs.readFileSync(path.join(EXTRACTION_DIR, extFile), 'utf8'));
  const topics = extraction.topics || [];
  const targetSpecs = getTargetSpecs(topics);
  
  // 基本判斷：有 target specs 且 topics 已在規格書中 → 整合
  // 特殊判斷：file path 含有 20260412（新文件）或特定關鍵字 → 需要更仔細檢查
  const isNew20260412 = file.path.includes('20260412');
  const hasUncoveredTopics = topics.some(t => !TOPIC_SPEC_MAP[t]);
  
  if (isNew20260412) {
    // 20260412 為最新討論，需更仔細整合，加入配對
    const note = `新增討論(20260412)：${extraction.paragraphCount}段，主題：${topics.join(',')}，建議目標：${targetSpecs.join(',')}`;
    doubtEntries.push({
      file: file.path,
      issue: '最新討論文件，需確認內容是否有對應規格書尚未收錄的機制',
      paragraphs: extraction.paragraphs ? extraction.paragraphs.map(p => p.heading).join('；') : '',
      suggestedTargets: targetSpecs,
      note,
    });
    doubtCount++;
  } else if (targetSpecs.length > 0) {
    // 主題已被規格書涵蓋，標記為 consolidated
    try {
      const targetsStr = targetSpecs.join(',');
      execSync(`node tools_node/consolidation-backfill.js complete "${file.path}" --targets ${targetsStr} --notes "StrategyA全量重掃 topics:${topics.slice(0,5).join(',')}"`, 
        { cwd: ROOT, stdio: 'pipe' });
      consolidated++;
      const name = file.path.split('/').pop().replace('.md','');
      console.log(`  ✅ ${name.slice(0,30).padEnd(32)} → ${targetsStr.slice(0,60)}`);
    } catch(e) {
      console.log(`  ❌ BACKFILL ERROR: ${file.path}: ${e.message.slice(0,80)}`);
    }
  } else {
    // 無匹配 → 加入 doubt queue
    doubtEntries.push({
      file: file.path,
      issue: '主題無對應規格書，可能需要新增規格書',
      paragraphs: extraction.paragraphs ? extraction.paragraphs.map(p => p.heading).join('；') : '',
      suggestedTargets: [],
      note: `topics: ${topics.join(',')}`,
    });
    doubtCount++;
  }
}

// 輸出 doubt queue
if (doubtEntries.length > 0) {
  let doubtMd = `# Doubt Queue — 需人工確認整併\n\n生成時間: ${new Date().toISOString()}\n\n`;
  for (const [i, d] of doubtEntries.entries()) {
    doubtMd += `## Q${i+1}: ${d.file.split('/').pop().replace('.md','')}\n\n`;
    doubtMd += `**來源**: \`${d.file}\`\n\n`;
    doubtMd += `**問題**: ${d.issue}\n\n`;
    if (d.paragraphs) doubtMd += `**段落標題**: ${d.paragraphs}\n\n`;
    doubtMd += `**建議目標規格書**: ${d.suggestedTargets.length > 0 ? d.suggestedTargets.join(', ') : '⚠️ 無對應，可能需新建規格書'}\n\n`;
    doubtMd += `**備註**: ${d.note}\n\n---\n\n`;
  }
  fs.writeFileSync(DOUBT_QUEUE, doubtMd, 'utf8');
  console.log(`\n⚠ Doubt queue 已輸出至: ${DOUBT_QUEUE}`);
}

// 更新 manifest 總覽
const finalManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const completedCount = finalManifest.files.filter(f => f.status === 'completed').length;
const pendingCount = finalManifest.files.filter(f => f.status === 'pending').length;

console.log(`\n[Phase1~4 結果]`);
console.log(`  整合完成: ${consolidated}`);
console.log(`  需人工確認: ${doubtCount}`);
console.log(`  Manifest: ${completedCount} completed / ${pendingCount} still pending`);
