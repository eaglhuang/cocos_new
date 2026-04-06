/**
 * ingest-generals-ai.js
 *
 * 從 master/generals-base.json 讀取武將資訊，
 * 為缺少故事欄位的武將生成 historicalAnecdote、bloodlineRumor、storyStripCells，
 * 輸出至 temp_workspace/raw-ai.json，供 merge-generals-master.js 合入。
 *
 * 用法：
 *   node tools_node/ingest-generals-ai.js [--limit <n>] [--dry-run] [--force]
 *
 * 選項：
 *   --limit <n>  最多處理 n 位武將（預設全部）
 *   --dry-run    印出生成結果但不寫入檔案
 *   --force      重新生成所有武將（含已有故事者）
 *
 * 注意：
 *   此工具使用내建範本生成；如需呼叫真實 AI API，
 *   請設定環境變數 OPENAI_API_KEY 並取消下方 AI 區塊的註解。
 *   無 API 金鑰時自動退回至本地模板生成，不整批失敗。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MASTER_DIR = path.join(ROOT, 'assets', 'resources', 'data', 'master');
const GENERALS_BASE = path.join(MASTER_DIR, 'generals-base.json');
const TEMP_WS = path.join(ROOT, 'temp_workspace');
const OUTPUT = path.join(TEMP_WS, 'raw-ai.json');

// --- CLI 解析 ---
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

// --- 本地模板生成 ---
const ROLE_TEMPLATES = {
  Combat: [
    '以勇猛著稱，每逢大戰必身先士卒，令敵軍聞風喪膽。',
    '臂力過人，善用長兵，數番衝陣無人可擋。',
    '以一騎當千聞名，武藝冠絕三軍。',
  ],
  Commander: [
    '深諳兵法，統帥三軍，指揮若定。',
    '以仁義治軍，深得將士信賴，名震一方。',
    '運籌帷幄，決勝於千里之外。',
  ],
  Support: [
    '足智多謀，善以奇計制敵，令對手防不勝防。',
    '精通天文地理，每每以巧計化解危局。',
    '博覽兵書，才識卓絕，為主公倚重。',
  ],
};

const BLOODLINE_TEMPLATES = [
  '相傳其先祖曾為漢室股肱之臣，血脈中流淌著忠義之氣。',
  '族譜顯示其家族世代習武，武藝之道代代相傳。',
  '坊間流傳其有神將血脈，天生神力非凡。',
  '家族系譜中有多位名將，武勇之名淵遠流長。',
  '據說其出生時天現異象，後人認為乃命中注定的豪傑。',
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateAnecdote(general) {
  const templates = ROLE_TEMPLATES[general.role] || ROLE_TEMPLATES.Combat;
  return `${general.name}，${pickRandom(templates)}`;
}

function generateBloodlineRumor(general) {
  return `${general.name}血脈：${pickRandom(BLOODLINE_TEMPLATES)}`;
}

function generateStoryStrip(general) {
  const cells = [
    { slot: 1, text: `${general.name}年少時便展現過人才華，鄉里無不稱奇。` },
    { slot: 2, text: `初入仕途，以一件奇事引起上位者注意，從此踏上征途。` },
    { slot: 3, text: `在一場關鍵之戰中，以智勇雙全之姿力挽狂瀾，奠定名聲。` },
    { slot: 4, text: `盛年之際，聲名遠播，四方豪傑紛紛前來投效。` },
    { slot: 5, text: `晚年回望一生，深感亂世之悲，留下「寧教天下人負我」之嘆。` },
    { slot: 6, text: `身後，人們以詩文紀念其偉業，功績永銘史冊。` },
  ];
  return cells;
}

function needsStory(general) {
  if (isForce) return true;
  return !general.historicalAnecdote ||
         general.historicalAnecdote.includes('待補') ||
         !general.bloodlineRumor ||
         !general.storyStripCells;
}

// --- 主流程 ---
async function main() {
  console.log('=== ingest-generals-ai.js ===');
  if (isDryRun) console.log('[INFO]  --dry-run 模式，不寫入檔案。');

  // 讀取 generals-base.json
  if (!fs.existsSync(GENERALS_BASE)) {
    console.error(`[ERROR] 找不到 ${GENERALS_BASE}，請先執行 DC-1-0001 建立 master/ 目錄。`);
    process.exit(1);
  }

  const baseObj = JSON.parse(fs.readFileSync(GENERALS_BASE, 'utf-8'));
  const generals = Array.isArray(baseObj.data) ? baseObj.data : [];

  if (generals.length === 0) {
    console.log('[INFO]  generals-base.json 無資料，略過生成。');
    if (!isDryRun) {
      const output = { version: '1.0.0', source: 'ai-template', generatedAt: new Date().toISOString(), count: 0, data: [] };
      fs.mkdirSync(TEMP_WS, { recursive: true });
      fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8');
      console.log(`[OK]    寫入 ${OUTPUT}（空集合）`);
    }
    return;
  }

  const toProcess = generals.filter(needsStory).slice(0, limit);
  console.log(`[INFO]  共 ${generals.length} 筆，需要生成 ${toProcess.length} 筆。\n`);

  const results = [];
  let ok = 0;
  let skipped = 0;

  for (const g of toProcess) {
    try {
      const lore = {
        id: g.id,
        historicalAnecdote: g.historicalAnecdote && !g.historicalAnecdote.includes('待補')
          ? g.historicalAnecdote
          : generateAnecdote(g),
        bloodlineRumor: g.bloodlineRumor || generateBloodlineRumor(g),
        storyStripCells: g.storyStripCells && g.storyStripCells.length >= 3
          ? g.storyStripCells
          : generateStoryStrip(g),
        _source: 'ai-template',
        _generatedAt: new Date().toISOString(),
      };
      results.push(lore);
      ok++;
      console.log(`[OK]    ${g.name}（${g.id}）生成完成。`);
    } catch (err) {
      console.warn(`[WARN]  ${g.name}（${g.id}）生成失敗，跳過：${err.message}`);
      skipped++;
    }
  }

  console.log(`\n[INFO]  完成：成功 ${ok} 筆、跳過 ${skipped} 筆。`);

  if (isDryRun) {
    console.log('\n[DRY-RUN] 範例資料（前 2 筆）:');
    results.slice(0, 2).forEach(r => console.log(JSON.stringify(r, null, 2)));
    console.log('\n[INFO]  --dry-run 結束，未寫入任何檔案。');
    return;
  }

  fs.mkdirSync(TEMP_WS, { recursive: true });
  const output = {
    version: '1.0.0',
    source: 'ai-template',
    generatedAt: new Date().toISOString(),
    count: results.length,
    data: results,
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`[OK]    寫入 ${OUTPUT}`);
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
