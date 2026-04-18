#!/usr/bin/env node
/**
 * tools_node/consolidation-doubt-mcq.js
 *
 * MCQ 產出與管理——自動將疑點轉為多選題格式，記錄至整併疑問書.md，
 * 並在人類決策後自動回寫到正式規格書。
 *
 * Usage:
 *   # Step 1: Agent 產出 MCQ 到整併疑問書.md
 *   node tools_node/consolidation-doubt-mcq.js generate \
 *       --summary  "疑點摘要（三到五字的題目名稱）" \
 *       --sources  "doc_id1,doc_id2" \
 *       --options  "A:選項A|B:選項B|C:選項C|D:選項D" \
 *       --conflict "完整的衝突段落說明（必填）——直接寫清楚哪份文件說什麼、矛盾在哪、不拍板的風險" \
 *       [--rewrite-targets "doc_id1,doc_id2,doc_id3"]  回寫目標（可比 sources 更多）\
 *       [--notes    "額外背景補充（可選）"]
 *
 *   ⚠  --conflict 為強制必填；缺少則拒絕寫入。
 *      規則：每一題 MCQ 必須自包含所有衝突資訊，人類無需回查原始文件。
 *      格式：對齊整併疑問書 Q14~Q30 既有格式（來源衝突：單段落，選項純文字）。
 *
 *   # Step 2: 人類在整併疑問書.md 中填寫答案（格式：👉 **請在此填寫你的決策**：A）
 *
 *   # Step 3: Agent 掃描已填寫的答案
 *   node tools_node/consolidation-doubt-mcq.js scan-answers
 *
 *   # Step 4: Agent 自動回寫到正式規格書
 *   node tools_node/consolidation-doubt-mcq.js rewrite-all
 *   # 或單獨回寫某個 MCQ
 *   node tools_node/consolidation-doubt-mcq.js rewrite <Q_NUMBER>
 *
 *   # 其他命令：
 *   node tools_node/consolidation-doubt-mcq.js list
 *       列出所有未解決的 MCQ
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DOUBT_FILE = path.join(ROOT, 'docs/遊戲規格文件/整併疑問書.md');
const CONFLICT_FILE = path.join(ROOT, 'docs/遊戲規格文件/正式規格矛盾審查.md');
const DEFAULT_MANIFEST = path.join(ROOT, 'docs/遊戲規格文件/consolidation-manifest.json');

const args = process.argv.slice(2);
const cmd = args[0];

// ── Helper: 讀取檔案 ────────────────────────────────────────────────────────
function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] File not found: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// ── Helper: 寫入檔案 ────────────────────────────────────────────────────────
function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

// ── Helper: 提取最大 Q 編號 ──────────────────────────────────────────────────
function getMaxQuestionNumber() {
  const content = readFile(DOUBT_FILE);
  const matches = content.match(/^## Q(\d+)\./gm);
  if (!matches || matches.length === 0) return 0;
  return Math.max(...matches.map(m => parseInt(m.match(/\d+/)[0], 10)));
}

// ── Helper: 讀取 manifest ────────────────────────────────────────────────────
function loadManifest() {
  if (!fs.existsSync(DEFAULT_MANIFEST)) {
    console.error(`[ERROR] Manifest not found: ${DEFAULT_MANIFEST}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(DEFAULT_MANIFEST, 'utf8'));
}

// ── Helper: 寫入 manifest ────────────────────────────────────────────────────
function saveManifest(manifest) {
  fs.writeFileSync(DEFAULT_MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
}

// ── Parse Arguments ──────────────────────────────────────────────────────────
function parseArgs() {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      opts[key] = args[i + 1] || '';
      i++;
    }
  }
  return opts;
}

// ── Command: generate ───────────────────────────────────────────────────────
function cmdGenerate() {
  const opts = parseArgs();
  const summary       = opts.summary    || '';
  const sources       = opts.sources    ? opts.sources.split(',').map(s => s.trim()).filter(Boolean)        : [];
  const rwTargets     = opts['rewrite-targets']
                          ? opts['rewrite-targets'].split(',').map(s => s.trim()).filter(Boolean) : [];
  const notesStr      = opts.notes      || '';
  const optionsStr    = opts.options    || '';
  // --conflict：整段衝突說明（必填），對應 Q14-Q30 格式的「來源衝突：...」段落
  const conflictStr   = opts.conflict   || '';

  // ── 必填驗證 ──────────────────────────────────────────────────────────────
  const errors = [];
  if (!summary)      errors.push('--summary（題目名稱）');
  if (!optionsStr)   errors.push('--options（選項）');
  if (!conflictStr)  errors.push('--conflict（衝突段落說明）—— 必須把哪份文件說什麼、矛盾在哪、不拍板的風險寫清楚');

  if (errors.length > 0) {
    console.error(`[ERROR] generate 拒絕寫入，缺少必填參數：`);
    errors.forEach(e => console.error(`  ✗ ${e}`));
    console.error(`\n每一題 MCQ 必須自包含所有衝突資訊，人類無需回查原始文件。`);
    process.exit(1);
  }

  // 解析選項 "A:內容|B:內容|..."，保持純文字 "A. 內容" 格式（對齊 Q14-Q30）
  const optPairs = optionsStr.split('|').map(pair => pair.trim());
  const optionLines = optPairs.map(p => {
    const colonIdx = p.indexOf(':');
    if (colonIdx === -1) return p;
    const label = p.substring(0, colonIdx).trim();
    const text  = p.substring(colonIdx + 1).trim();
    return `${label}. ${text}`;
  }).join('\n\n');

  // 產生新 Q 編號
  const maxQ = getMaxQuestionNumber();
  const newQ = maxQ + 1;

  // ── 組合 MCQ 內容（對齊 Q14-Q30 格式）─────────────────────────────────────
  let mcqContent = `\n## Q${newQ}. ${summary}\n\n`;

  // 來源衝突段落（單段無子標題，對齊既有格式）
  mcqContent += `來源衝突：${sources.length > 0 ? sources.map(s => `\`${s}\``).join('、') + '  ' : ''}${conflictStr}\n\n`;

  // 背景補充（可選）
  if (notesStr) {
    mcqContent += `${notesStr}\n\n`;
  }

  // 選項（純文字，對齊既有格式）
  mcqContent += `${optionLines}\n\n`;
  mcqContent += `👉 **請在此填寫你的決策**：[待填寫]\n\n`;

  // ── 機器可讀 metadata（HTML comment，不影響 Markdown 渲染）──────────────
  // rewrite-all 讀這些 comment 來決定要回寫哪些文件
  mcqContent += `<!-- mcq-sources: ${sources.join(',')} -->\n`;

  // 回寫目標：優先用 --rewrite-targets，否則等同 sources
  const allRewriteTargets = rwTargets.length > 0 ? rwTargets : sources;
  mcqContent += `<!-- mcq-rewrite-targets: ${allRewriteTargets.join(',')} -->\n`;

  // 每個選項文字存下來
  for (const pair of optPairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) continue;
    const lbl = pair.substring(0, colonIdx).trim();
    const txt = pair.substring(colonIdx + 1).trim();
    mcqContent += `<!-- mcq-opt-${lbl}: ${txt} -->\n`;
  }
  // 衝突描述存一份給 rewrite 貼到文件裡
  mcqContent += `<!-- mcq-conflict: ${conflictStr.replace(/\n/g, ' ')} -->\n`;

  mcqContent += `\n---\n`;

  // 附加到 整併疑問書.md
  const doubtContent = readFile(DOUBT_FILE);
  writeFile(DOUBT_FILE, doubtContent + mcqContent);

  console.log(`\n[consolidation-doubt-mcq] Generated MCQ\n`);
  console.log(`Question: Q${newQ}`);
  console.log(`Summary:  ${summary}`);
  console.log(`Sources:  ${sources.join(', ') || '(none)'}`);
  console.log(`Rewrite targets: ${allRewriteTargets.join(', ') || '(same as sources)'}`);
  console.log(`\nOptions:\n${optionLines}`);
  console.log(`\n✓ Appended to ${path.relative(ROOT, DOUBT_FILE)}\n`);
}

// ── Command: resolve ────────────────────────────────────────────────────────
function cmdResolve() {
  const qNum = args[1];
  const opts = parseArgs();
  const answer = opts.answer || '';

  if (!qNum || !answer) {
    console.error(`[ERROR] Missing question number or --answer`);
    process.exit(1);
  }

  const doubtContent = readFile(DOUBT_FILE);
  const searchText = `## Q${qNum}.`;

  if (!doubtContent.includes(searchText)) {
    console.error(`[ERROR] Question not found: Q${qNum}`);
    process.exit(1);
  }

  // 在 Q 題後補上決策記錄
  const qIndex = doubtContent.indexOf(searchText);
  const nextQIndex = doubtContent.indexOf('\n## Q', qIndex + 1);
  const qEnd = nextQIndex > 0 ? nextQIndex : doubtContent.length;

  let qBlock = doubtContent.substring(qIndex, qEnd);

  // 檢查是否已有 "✓ 決策" 標記
  if (qBlock.includes('✓ 決策') || qBlock.includes('✓ 已裁決')) {
    console.warn(`[WARN] Q${qNum} already resolved\n`);
    return;
  }

  // 在 "---" 之前插入決策記錄
  qBlock = qBlock.replace(/\n---\n?$/, `\n\n✓ 決策：選項 ${answer}\n\n---\n`);

  const updated = doubtContent.substring(0, qIndex) + qBlock + doubtContent.substring(qEnd);
  writeFile(DOUBT_FILE, updated);

  console.log(`\n[consolidation-doubt-mcq] Resolved MCQ\n`);
  console.log(`Question: Q${qNum}`);
  console.log(`Decision: ${answer}\n`);
}

// ── Command: list ───────────────────────────────────────────────────────────
function cmdList() {
  const doubtContent = readFile(DOUBT_FILE);
  const questions = doubtContent.match(/^## Q(\d+)\. (.+)$/gm) || [];

  console.log(`\n[consolidation-doubt-mcq] Open Questions\n`);
  console.log(`Total: ${questions.length}\n`);

  for (const q of questions) {
    const [, qNum, summary] = q.match(/Q(\d+)\. (.+)/);
    
    // 檢查是否已決策
    const hasDecision = doubtContent.includes(`✓ 決策：`) && 
                        doubtContent.substring(doubtContent.indexOf(`## Q${qNum}`))
                                   .substring(0, 500)
                                   .includes(`✓ 決策`);

    const status = hasDecision ? '✓' : '◯';
    console.log(`${status} Q${qNum}: ${summary}`);
  }

  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// MCQ Rewrite Rules (需要人工維護：每個 MCQ 對應的回寫規則)
// ─────────────────────────────────────────────────────────────────────────────
const MCQ_REWRITE_RULES = {
  31: {
    question: '重修代價機制',
    targetSpec: 'docs/遊戲規格文件/系統規格書/培育系統.md',
    targetSpecId: 'doc_spec_0026',
    targetSection: '§ 二、學業期與重修機制',
    rewriteRules: {
      A: {
        action: 'append',
        content: `

### 重修代價機制

當學生在某學期成績不佳時，可以選擇「重修」該學期：
- **第1次重修**：無代價，屬性獲得率 100%
- **第2次重修**：獲得 [疲憊] 負面因子（-5% 體力上限）
- **第3次重修**：額外獲得 [厭學] 因子（-3% 體力上限）

機制目的：避免玩家無限重刷成績單，同時保留一定容錯空間。
`
      },
      B: {
        action: 'append',
        content: `

### 重修機制說明
- 學生可消耗體力藥水（補腦湯）進行重修，最多保留 3 份記錄。
- **重修代價**：完全無代價。玩家可自由從 3 份成績單中挑選最優異者，不附加任何負面因子。
`
      },
      C: {
        action: 'manual',
        note: '需要根據人類補充說明手工編輯'
      }
    }
  },
  32: {
    question: '戰法提示保底機制',
    targetSpec: 'docs/遊戲規格文件/系統規格書/培育系統.md',
    targetSpecId: 'doc_spec_0026',
    targetSection: '§ 四、戰法點與習得',
    rewriteRules: {
      A: {
        action: 'append',
        content: `

### 戰法提示機制
戰法提示觸發：完全隨機，無保底機制。運氣也是實力的一部分。
`
      },
      B: {
        action: 'append',
        content: `

### 戰法提示保底機制
- 高資質小孩（資質 ≥ 90）在第 70 回合時必定觸發戰法提示事件。
`
      },
      D: {
        action: 'append',
        content: `

### 戰法提示：世家血脈連動機制
- **機制**：若 [子嗣姓氏] 與 [支援卡家族] 一致（例：關家子弟裝備 SSR 關羽卡）。
- **效果**：
  1. **優先排程**：連續事件的觸發權重設為最高（Priority Overide）。
  2. **保證成功**：第 3 段事件 **保證在第 60 回合前觸發**，且 100% 成功。
  3. **減輕負擔**：金戰法的戰法點需求（PT）額外折扣 20%。
- **反之**：異姓子弟裝備關羽卡，則回歸 RNG 邏輯（不保證能跑完三段事件）。
`
      },
      C: {
        action: 'manual',
        note: '需要根據人類補充說明手工編輯'
      }
    }
  },
  33: {
    question: '格子屬性 JSON 結構',
    targetSpec: 'docs/遊戲規格文件/討論來源/更舊的討論/模組化戰場系統開發策略.md',
    targetSpecId: 'doc_spec_0089',
    targetSection: '#### **1. 統一的技術框架：Tile-State Machine**',
    rewriteRules: {
      D: {
        action: 'append',
        content: `

### 格子屬性資料結構 (Final Decision)
- **結構選型**：採用「混合模式 (D)」。
- **基礎定義 (Static)**：狀態 ID、觸發時機、基礎數值等採用靜態 JSON，方便版控與基本編輯。
- **動態隨機 (Procedural)**：針對火燒、落石等「場外支援」引發的環境效果，由程式根據場景實例動態計算格子坐標。
- **Rogue-like 體驗**：確保每次進入戰場（即使場景相同）時，火焰蔓延與落石覆蓋的格子具有隨機性，避免固定化模式。
`
      }
    }
  },
  34: {
    question: '技能能量與官職條邏輯',
    targetSpec: 'docs/遊戲規格文件/討論來源/更舊的討論/策略遊戲視覺與系統設計.md',
    targetSpecId: 'doc_spec_0080',
    targetSection: '### **智力軍師發動機制與 UI**',
    rewriteRules: {
      D: {
        action: 'append',
        content: `

### 技能能量充能規則
- **基礎充能**：戰場回合數固定累加（每回合 +X 能量）。
- **戰果充能**：成功擊殺敵軍部隊時，發動技能的能量條將獲得額外加成。
- **設計目的**：在保證戰役可預測性的同時，獎勵主動進攻且具備擊殺能力的激進玩家。
`
      }
    }
  },
  35: {
    question: '適性減益具體比例',
    targetSpec: 'docs/遊戲規格文件/系統規格書/戰場適性系統.md',
    targetSpecId: 'doc_spec_0041',
    targetSection: '## 二、適性等級定義',
    rewriteRules: {
      A: {
        action: 'append',
        content: `

### 適性與數值懲罰係數 (Hardcore)
根據「全球遠征」戰略深度要求，適性等級對主屬性的削弱比例定案如下：
- **S 級**：屬性 100% 發揮（無減益，甚至有微量加成預留）
- **A 級**：屬性 90% 發揮
- **B 級**：屬性 70% 發揮（即懲罰 -30%）
- **C 級 / D 級**：屬性 50% / 30% 發揮
- **注意**：這項係數應用於「力量（破陣）」與「毅力（抗性）」等核心對抗屬性。
`
      }
    }
  },
  36: {
    question: '首位後宮女官/參謀專屬事件',
    targetSpec: 'docs/遊戲規格文件/討論來源/更舊的討論/馬娘養成機制三國化設計.md',
    targetSpecId: 'doc_spec_0079',
    targetSection: '### **4. 培育過程中的「隨機性」與「耐玩度」**',
    rewriteRules: {
      D: {
        action: 'append',
        content: `

### 支援卡 (紅顏參謀) 加成體系
- **屬性連動**：加成數值與事件成功率由支援卡本身的 R/SR/SSR 屬性以及其「絆」等級決定。
- **戰法習得**：卡片自帶的事件機率觸發，可習得該卡片對應的戰法。
- **經濟模型**：習得該卡片推薦戰法的 PT 消耗（戰法點）隨卡片突破數與等級獲得額外折扣。
- **系統整合**：所有支援卡上的戰法圖示與傳承邏輯必須強制引用正式「戰法系統」的 ID 庫。
`
      }
    }
  },
  37: {
    question: '全服排行榜 AI 投影模式',
    targetSpec: 'docs/遊戲規格文件/討論來源/最早的討論/養成遊戲的遺憾與挑戰設計.md',
    targetSpecId: 'doc_spec_0123',
    targetSection: '#### **2. AI 軍閥的「數據鏡像」 (Ghost Player AI)**',
    rewriteRules: {
      C: {
        action: 'append',
        content: `

### 全服排行榜 AI 投影模式 (決策定案)
- **模式**：鏡像試煉 (Mirror Trial)。
- **機制**：系統自動實時抓取當前伺服器中最強前 10% 玩家的部隊配置與虎符。
- **動態縮放**：AI 不僅僅是快照，會根據挑戰者的即時實力（裝備與階級）進行難度動態映射與比例縮放，確保挑戰賽永遠具備「超越自我\"的高壓感受。
`
      }
    }
  }
};

// ── Command: scan-answers ───────────────────────────────────────────────────
function cmdScanAnswers() {
  const doubtContent = readFile(DOUBT_FILE);
  const lines = doubtContent.split('\n');
  const answered = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 找到「👉 **請在此填寫你的決策**：」這行
    if (line.includes('👉') && line.includes('請在此填寫你的決策')) {
      const match = line.match(/：\s*\[?([A-D])\]?/);
      if (match && match[1] !== '待填寫') {
        // 往前找 Q 編號
        for (let j = i - 1; j >= 0; j--) {
          const qMatch = lines[j].match(/##\s*Q(\d+)\./);
          if (qMatch) {
            answered.push({ qNum: parseInt(qMatch[1], 10), answer: match[1] });
            break;
          }
        }
      }
    }
  }

  if (answered.length === 0) {
    console.log('No answered MCQs found.');
    console.log('請先在整併疑問書.md中填寫答案（格式：👉 **請在此填寫你的決策**：A）');
    return;
  }

  console.log(`✓ Found ${answered.length} answered MCQ(s):`);
  answered.forEach(({ qNum, answer }) => {
    const rule = MCQ_REWRITE_RULES[qNum];
    const question = rule ? rule.question : 'Unknown';
    console.log(`  Q${qNum}: ${answer} (${question})`);
  });

  console.log('\nReady to rewrite? Run:');
  console.log('  node tools_node/consolidation-doubt-mcq.js rewrite-all');
}

// ── Command: rewrite-all ────────────────────────────────────────────────────
function cmdRewriteAll() {
  const doubtContent = readFile(DOUBT_FILE);
  const lines = doubtContent.split('\n');
  const answered = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('👉') && line.includes('請在此填寫你的決策')) {
      const match = line.match(/：\s*\[?([A-D])\]?/);
      if (match && match[1] !== '待填寫') {
        for (let j = i - 1; j >= 0; j--) {
          const qMatch = lines[j].match(/##\s*Q(\d+)\./);
          if (qMatch) {
            answered.push({ qNum: parseInt(qMatch[1], 10), answer: match[1] });
            break;
          }
        }
      }
    }
  }

  if (answered.length === 0) {
    console.log('No answered MCQs to rewrite.');
    return;
  }

  console.log(`Rewriting ${answered.length} MCQ(s)...`);
  answered.forEach(({ qNum, answer }) => {
    rewriteSingleMCQ(qNum, answer);
  });

  console.log('\n✓ All answered MCQs have been rewritten.');
}

// ── Command: rewrite <qNum> ─────────────────────────────────────────────────
function cmdRewrite() {
  const qNum = parseInt(process.argv[3], 10);
  if (isNaN(qNum)) {
    console.error('[ERROR] Usage: rewrite <Q_NUMBER>');
    process.exit(1);
  }

  // 從整併疑問書讀取答案
  const doubtContent = readFile(DOUBT_FILE);
  const lines = doubtContent.split('\n');

  let answer = null;
  for (let i = 0; i < lines.length; i++) {
    const qMatch = lines[i].match(/##\s*Q(\d+)\./);
    if (qMatch && parseInt(qMatch[1], 10) === qNum) {
      // 往後找答案行
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].includes('👉') && lines[j].includes('請在此填寫你的決策')) {
          const aMatch = lines[j].match(/：\s*([A-D])/);
          if (aMatch && aMatch[1] !== '待填寫') {
            answer = aMatch[1];
          }
          break;
        }
      }
      break;
    }
  }

  if (!answer) {
    console.error(`[ERROR] Q${qNum} has not been answered yet.`);
    console.log('請先在整併疑問書.md中填寫答案');
    process.exit(1);
  }

  rewriteSingleMCQ(qNum, answer);
}

// ── Helper: 從 doc-id-registry.json 解析 doc_id → 絕對路徑 ─────────────────
function resolveDocPath(docId) {
  const registryPath = path.join(ROOT, 'docs/doc-id-registry.json');
  if (!fs.existsSync(registryPath)) return null;
  const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const registry = reg.registry || reg;
  const entry = registry[docId];
  if (!entry || !entry.path) return null;
  return path.join(ROOT, entry.path);
}

// ── Helper: 從 manifest 反查某題應回寫的正式 targetSpecs ───────────────────
function resolveManifestTargetsForQ(qNum) {
  if (!fs.existsSync(DEFAULT_MANIFEST)) return [];

  const manifest = JSON.parse(fs.readFileSync(DEFAULT_MANIFEST, 'utf8'));
  const qRef = `Q${qNum}`;
  const targets = [];

  for (const file of manifest.files || []) {
    const refs = Array.isArray(file.mcqRefs) ? file.mcqRefs : [];
    if (!refs.includes(qRef)) continue;

    for (const docId of (file.targetSpecs || [])) {
      const resolvedPath = resolveDocPath(docId);
      if (!resolvedPath) continue;
      // 只把正式規格 / UI 規格 / 名詞 / schema 這類可回寫目標帶進來；討論來源檔不算正式承接面
      if (resolvedPath.includes(`${path.sep}討論來源${path.sep}`)) continue;
      targets.push(docId);
    }
  }

  return [...new Set(targets)];
}

// ── Helper: 從整併疑問書.md 中取出某題的完整區塊文字 ─────────────────────────
function getMCQBlock(doubtContent, qNum) {
  const marker = `## Q${qNum}.`;
  const idx = doubtContent.indexOf(marker);
  if (idx === -1) return null;
  const nextIdx = doubtContent.indexOf('\n## Q', idx + 1);
  return doubtContent.substring(idx, nextIdx > 0 ? nextIdx : doubtContent.length);
}

// ── Helper: 從 MCQ 區塊解析 metadata comment ──────────────────────────────
function parseMCQMeta(block) {
  const sources = [];
  let rewriteTargets = [];
  const opts = {};
  let conflict = '';

  const srcMatch = block.match(/<!--\s*mcq-sources:\s*([^-]+?)\s*-->/);
  if (srcMatch) srcMatch[1].split(',').map(s => s.trim()).filter(Boolean).forEach(s => sources.push(s));

  // 優先讀 mcq-rewrite-targets，沒有就 fallback 到舊版 mcq-target
  const rwtMatch = block.match(/<!--\s*mcq-rewrite-targets:\s*([^-]+?)\s*-->/);
  if (rwtMatch) {
    rewriteTargets = rwtMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  } else {
    const tgtMatch = block.match(/<!--\s*mcq-target:\s*([^\s-][^-]*?)\s*-->/);
    if (tgtMatch) rewriteTargets = [tgtMatch[1].trim()];
  }

  const optMatches = [...block.matchAll(/<!--\s*mcq-opt-([A-Z]):\s*(.+?)\s*-->/g)];
  for (const m of optMatches) opts[m[1]] = m[2];

  // 優先讀新版 mcq-conflict，沒有就 fallback 到舊版 mcq-doubt
  const cfMatch = block.match(/<!--\s*mcq-conflict:\s*(.+?)\s*-->/);
  if (cfMatch) conflict = cfMatch[1];
  else {
    const dbtMatch = block.match(/<!--\s*mcq-doubt:\s*(.+?)\s*-->/);
    if (dbtMatch) conflict = dbtMatch[1];
  }

  return { sources, rewriteTargets, opts, conflict };
}

// ── Core rewrite logic ──────────────────────────────────────────────────────
function rewriteSingleMCQ(qNum, answer) {
  const doubtContent = readFile(DOUBT_FILE);
  const block = getMCQBlock(doubtContent, qNum);
  if (!block) {
    console.error(`[ERROR] Q${qNum} block not found in 整併疑問書.md`);
    return;
  }

  // 先取題目名稱
  const titleMatch = block.match(/##\s*Q\d+\.\s*(.+)/);
  const questionTitle = titleMatch ? titleMatch[1].trim() : `Q${qNum}`;

  // 嘗試從 metadata comment 讀配置
  const meta = parseMCQMeta(block);

  // 如果沒有任何 metadata（老題目），回落到 MCQ_REWRITE_RULES
  if (meta.sources.length === 0 && meta.rewriteTargets.length === 0 && Object.keys(meta.opts).length === 0) {
    return legacyRewriteSingleMCQ(qNum, answer);
  }

  // 回寫目標：先取 MCQ metadata，再合併 manifest 內對該題的正式 targetSpecs
  const baseTargets = meta.rewriteTargets.length > 0 ? meta.rewriteTargets : meta.sources;
  const manifestTargets = resolveManifestTargetsForQ(qNum);
  const allDocIds = [...new Set([...baseTargets, ...manifestTargets])];
  const resolvedFiles = [];
  const unresolvedIds = [];
  for (const docId of allDocIds) {
    const p = resolveDocPath(docId);
    if (p) resolvedFiles.push({ docId, filePath: p });
    else unresolvedIds.push(docId);
  }

  if (unresolvedIds.length > 0) {
    console.warn(`[WARN] 以下 doc_id 在 registry 找不到路徑，跳過：${unresolvedIds.join(', ')}`);
  }

  if (resolvedFiles.length === 0) {
    console.warn(`[WARN] Q${qNum} 沒有任何可解析的回寫目標，請手動確認 doc_id 是否正確。`);
    return;
  }

  const selectedOptText = meta.opts[answer] || `選項 ${answer}`;
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  // 組合要附加到各文件的「決策記錄」區塊
  const decisionBlock = `

---
## 🗳 MCQ 決策記錄（Q${qNum}）

- **問題**：${questionTitle}
- **衝突說明**：${meta.conflict || '（未提供）'}
- **裁決**：**選項 ${answer}** — ${selectedOptText}
- **回寫時間**：${now}
- **來源**：由 \`consolidation-doubt-mcq.js rewrite-all\` 自動寫入

---
`;

  // 寫入所有相關文件
  for (const { docId, filePath } of resolvedFiles) {
    if (!fs.existsSync(filePath)) {
      console.warn(`[WARN] 檔案不存在：${filePath}（${docId}），跳過`);
      continue;
    }
    const existing = fs.readFileSync(filePath, 'utf8');
    // 防重複：同一題不寫兩次
    if (existing.includes(`MCQ 決策記錄（Q${qNum}）`)) {
      console.log(`  ⚠ Q${qNum} 已寫入過 ${docId}，跳過`);
      continue;
    }
    fs.writeFileSync(filePath, existing + decisionBlock, 'utf8');
    console.log(`  ✅ Q${qNum} (${answer}) → ${docId}  ${path.relative(ROOT, filePath)}`);
  }

  markAsRewritten(qNum, allDocIds, answer, resolvedFiles.map(f => f.docId));
}

// ── Legacy fallback（針對沒有嵌入 metadata 的舊題目 Q31/Q32）──────────────────
function legacyRewriteSingleMCQ(qNum, answer) {
  const rule = MCQ_REWRITE_RULES[qNum];
  if (!rule) {
    console.warn(`[WARN] Q${qNum} 沒有 metadata comment，也沒有 MCQ_REWRITE_RULES，跳過。`);
    console.log(`  → 請用新版 generate 指令（含 --doubt / --quote-* / --target 參數）重新產生此題。`);
    return;
  }

  const rewriteRule = rule.rewriteRules[answer];
  if (!rewriteRule) {
    console.warn(`[WARN] No rewrite rule for Q${qNum} answer ${answer}, skipping.`);
    return;
  }

  if (rewriteRule.action === 'manual') {
    console.log(`[MANUAL] Q${qNum}: ${rewriteRule.note}`);
    return;
  }

  const specPath = path.join(ROOT, rule.targetSpec);
  if (!fs.existsSync(specPath)) {
    console.error(`[ERROR] Target spec not found: ${specPath}`);
    return;
  }

  let specContent = fs.readFileSync(specPath, 'utf8');

  if (rewriteRule.action === 'append') {
    const sectionMatch = specContent.match(new RegExp(`(${escapeRegex(rule.targetSection)}.*?)(?=\\n##|$)`, 's'));
    if (sectionMatch) {
      const sectionEnd = sectionMatch.index + sectionMatch[0].length;
      specContent = specContent.slice(0, sectionEnd) + rewriteRule.content + specContent.slice(sectionEnd);
    } else {
      specContent += `\n${rule.targetSection}\n${rewriteRule.content}`;
    }
    fs.writeFileSync(specPath, specContent, 'utf8');
    console.log(`  ✅ Q${qNum} (${answer}) → ${rule.targetSpecId} ${rule.targetSection}`);
  } else if (rewriteRule.action === 'note') {
    console.log(`[NOTE] Q${qNum}: ${rewriteRule.content}`);
    return;
  }

  markAsRewritten(qNum, [rule.targetSpecId], answer, [rule.targetSpecId]);
}

// ── Helper: Escape regex special chars ─────────────────────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Mark MCQ as rewritten in 整併疑問書 ─────────────────────────────────────
function markAsRewritten(qNum, allDocIds, answer, writtenDocIds) {
  let content = readFile(DOUBT_FILE);

  const marker = `## Q${qNum}.`;
  const idx = content.indexOf(marker);
  if (idx === -1) return;

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const writtenList = writtenDocIds.join(', ');
  const rewriteNote =
    `\n✅ **已回寫到**：${writtenList}\n` +
    `✅ **回寫時間**：${now}\n` +
    `✅ **裁決選項**：${answer}\n`;

  let nextIdx = content.indexOf('\n## Q', idx + 1);
  if (nextIdx === -1) nextIdx = content.length;

  let qBlock = content.slice(idx, nextIdx);
  qBlock = qBlock.replace(/\n✅ \*\*已回寫到\*\*：[^\n]*\n✅ \*\*回寫時間\*\*：[^\n]*\n✅ \*\*裁決選項\*\*：[^\n]*\n?/g, '\n');
  qBlock = qBlock.replace(/\n{3,}/g, '\n\n').replace(/\s+$/g, '');
  qBlock += `${rewriteNote}`;

  content = content.slice(0, idx) + qBlock + content.slice(nextIdx);
  fs.writeFileSync(DOUBT_FILE, content, 'utf8');
}

// ── Cleanup: dedupe all rewrite status notes in 整併疑問書 ──────────────────
function cmdCleanupRewriteStatus() {
  let content = readFile(DOUBT_FILE);
  const questionMatches = [...content.matchAll(/^## Q(\d+)\./gm)];

  if (questionMatches.length === 0) {
    console.log('[cleanup-rewrite-status] No Q blocks found.');
    return;
  }

  for (let i = questionMatches.length - 1; i >= 0; i--) {
    const qNum = parseInt(questionMatches[i][1], 10);
    const marker = `## Q${qNum}.`;
    const idx = content.indexOf(marker);
    if (idx === -1) continue;

    let nextIdx = content.indexOf('\n## Q', idx + 1);
    if (nextIdx === -1) nextIdx = content.length;

    let qBlock = content.slice(idx, nextIdx);
    const matches = [...qBlock.matchAll(/\n✅ \*\*已回寫到\*\*：[^\n]*\n✅ \*\*回寫時間\*\*：[^\n]*\n✅ \*\*裁決選項\*\*：[^\n]*\n?/g)];
    if (matches.length <= 1) continue;

    const latest = matches[matches.length - 1][0].trimEnd();
    qBlock = qBlock.replace(/\n✅ \*\*已回寫到\*\*：[^\n]*\n✅ \*\*回寫時間\*\*：[^\n]*\n✅ \*\*裁決選項\*\*：[^\n]*\n?/g, '\n');
    qBlock = qBlock.replace(/\n{3,}/g, '\n\n').replace(/\s+$/g, '');
    qBlock += `\n${latest}\n`;

    content = content.slice(0, idx) + qBlock + content.slice(nextIdx);
  }

  fs.writeFileSync(DOUBT_FILE, content, 'utf8');
  console.log('[cleanup-rewrite-status] Deduplicated rewrite status notes, kept latest entry per Q block.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy MCQ_REWRITE_RULES（僅供舊題目 Q31 / Q32 fallback）
// 新題目一律透過 generate --target / --sources metadata 自動處理，不需要在此新增
// ─────────────────────────────────────────────────────────────────────────────

// ── Main ────────────────────────────────────────────────────────────────────
switch (cmd) {
  case 'generate':
    cmdGenerate();
    break;
  case 'resolve':
    cmdResolve();
    break;
  case 'list':
    cmdList();
    break;
  case 'scan-answers':
    cmdScanAnswers();
    break;
  case 'rewrite-all':
    cmdRewriteAll();
    break;
  case 'rewrite':
    cmdRewrite();
    break;
  case 'cleanup-rewrite-status':
    cmdCleanupRewriteStatus();
    break;
  default:
    console.log(`
[consolidation-doubt-mcq] — MCQ 產出與管理

Usage:
  node tools_node/consolidation-doubt-mcq.js generate \\
      --summary "疑點摘要" \\
      --sources "doc_id1,doc_id2" \\
      --options "A:選項A|B:選項B|C:選項C|D:選項D" \\
      --conflict "完整衝突說明——哪份文件說什麼、矛盾在哪、不拍板的風險"
      [--rewrite-targets "doc_id1,doc_id2,doc_id3"]
      產出新 MCQ（格式對齊整併疑問書 Q14-Q30）

  node tools_node/consolidation-doubt-mcq.js scan-answers
      掃描整併疑問書中已填寫的答案

  node tools_node/consolidation-doubt-mcq.js rewrite-all
      對所有已答題自動回寫相關規格文件

  node tools_node/consolidation-doubt-mcq.js rewrite <Q_NUMBER>
      單獨回寫某題

      node tools_node/consolidation-doubt-mcq.js cleanup-rewrite-status
        清理整併疑問書中重複的「已回寫到 / 回寫時間 / 裁決選項」狀態，僅保留最新一筆

  node tools_node/consolidation-doubt-mcq.js list
      列出所有 MCQ 與解決狀態

Example:
  node tools_node/consolidation-doubt-mcq.js generate \\
      --summary "EP 天命門檻" \\
      --sources "doc_spec_0011,doc_ui_0012" \\
      --options "A:90+為天命|B:98+為天命|C:折衷五階|D:前後端不同層級" \\
      --conflict "血統理論系統.md (doc_spec_0011) 將天命之子定義為 EP >= 90，但武將人物介面規格書.md (doc_ui_0012) 卻寫成 EP >= 98。這會直接影響人物頁評語、培育預覽、結緣 UI 與名士預言的評等文案。若不拍板，兩份文件的評語文案會繼續不一致。" \\
      --rewrite-targets "doc_spec_0011,doc_ui_0012,doc_spec_0028,doc_spec_0006"
`);
}
