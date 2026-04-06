/**
 * ingest-generals-wiki.js
 *
 * 從公開 Wiki 資料來源爬取三國武將資訊，映射至標準欄位，
 * 輸出至 temp_workspace/raw-wiki.json。
 *
 * 用法：
 *   node tools_node/ingest-generals-wiki.js [--limit <n>] [--dry-run]
 *
 * 選項：
 *   --limit <n>   最多爬取 n 位武將（預設 50，smoke test 用 10）
 *   --dry-run     印出爬取結果但不寫入檔案
 *
 * 資料來源（依序嘗試）：
 *   1. 本地 temp_workspace/wiki-cache.json（快取，避免重複請求）
 *   2. 維基百科 三國演義人物列表 API（JSON）
 *
 * 注意：此工具使用內建 https 模組，不依賴 npm 套件。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const TEMP_WS = path.join(ROOT, 'temp_workspace');
const OUTPUT = path.join(TEMP_WS, 'raw-wiki.json');
const CACHE = path.join(TEMP_WS, 'wiki-cache.json');

// --- CLI 解析 ---
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 50;

// --- 速率控制 ---
const RATE_DELAY_MS = 500; // 每次請求間隔
const USER_AGENT = '3KLife-DataPipeline/1.0 (Cocos Creator game project; research use)';

// --- 常見三國武將種子清單（確保 smoke test 有資料）---
const SEED_GENERALS = [
  { id: 'cao-cao', name: '曹操', faction: 'wei', role: 'Combat' },
  { id: 'liu-bei', name: '劉備', faction: 'shu', role: 'Commander' },
  { id: 'sun-quan', name: '孫權', faction: 'wu', role: 'Commander' },
  { id: 'zhuge-liang', name: '諸葛亮', faction: 'shu', role: 'Support' },
  { id: 'zhou-yu', name: '周瑜', faction: 'wu', role: 'Combat' },
  { id: 'guan-yu', name: '關羽', faction: 'shu', role: 'Combat' },
  { id: 'zhang-fei', name: '張飛', faction: 'shu', role: 'Combat' },
  { id: 'zhao-yun', name: '趙雲', faction: 'shu', role: 'Combat' },
  { id: 'lu-bu', name: '呂布', faction: 'enemy', role: 'Combat' },
  { id: 'sima-yi', name: '司馬懿', faction: 'wei', role: 'Support' },
  { id: 'dian-wei', name: '典韋', faction: 'wei', role: 'Combat' },
  { id: 'xu-zhu', name: '許褚', faction: 'wei', role: 'Combat' },
  { id: 'huang-zhong', name: '黃忠', faction: 'shu', role: 'Combat' },
  { id: 'ma-chao', name: '馬超', faction: 'shu', role: 'Combat' },
  { id: 'lu-xun', name: '陸遜', faction: 'wu', role: 'Support' },
  { id: 'taishi-ci', name: '太史慈', faction: 'wu', role: 'Combat' },
  { id: 'zhang-liao', name: '張遼', faction: 'wei', role: 'Combat' },
  { id: 'xu-huang', name: '徐晃', faction: 'wei', role: 'Combat' },
  { id: 'cao-ren', name: '曹仁', faction: 'wei', role: 'Combat' },
  { id: 'pang-tong', name: '龐統', faction: 'shu', role: 'Support' },
  // 第二批
  { id: 'guo-jia', name: '郭嘉', faction: 'wei', role: 'Support' },
  { id: 'xun-yu', name: '荀彧', faction: 'wei', role: 'Support' },
  { id: 'jia-xu', name: '賈詡', faction: 'wei', role: 'Support' },
  { id: 'zhang-he', name: '張郃', faction: 'wei', role: 'Combat' },
  { id: 'yu-jin', name: '于禁', faction: 'wei', role: 'Combat' },
  { id: 'cao-cao-junior', name: '曹彰', faction: 'wei', role: 'Combat' },
  { id: 'xiahou-dun', name: '夏侯惇', faction: 'wei', role: 'Combat' },
  { id: 'xiahou-yuan', name: '夏侯淵', faction: 'wei', role: 'Combat' },
  { id: 'wei-yan', name: '魏延', faction: 'shu', role: 'Combat' },
  { id: 'jiang-wei', name: '姜維', faction: 'shu', role: 'Combat' },
  { id: 'deng-ai', name: '鄧艾', faction: 'wei', role: 'Combat' },
  { id: 'zhong-hui', name: '鍾會', faction: 'wei', role: 'Support' },
  { id: 'huang-gai', name: '黃蓋', faction: 'wu', role: 'Combat' },
  { id: 'cheng-pu', name: '程普', faction: 'wu', role: 'Combat' },
  { id: 'han-dang', name: '韓當', faction: 'wu', role: 'Combat' },
  { id: 'gan-ning', name: '甘寧', faction: 'wu', role: 'Combat' },
  { id: 'ling-tong', name: '凌統', faction: 'wu', role: 'Combat' },
  { id: 'zhou-tai', name: '周泰', faction: 'wu', role: 'Combat' },
  { id: 'xu-sheng', name: '徐盛', faction: 'wu', role: 'Combat' },
  { id: 'ding-feng', name: '丁奉', faction: 'wu', role: 'Combat' },
  { id: 'zhang-zhao', name: '張昭', faction: 'wu', role: 'Support' },
  { id: 'lu-meng', name: '呂蒙', faction: 'wu', role: 'Combat' },
  { id: 'sun-ce', name: '孫策', faction: 'wu', role: 'Combat' },
  { id: 'sun-jian', name: '孫堅', faction: 'wu', role: 'Combat' },
  { id: 'dong-zhuo', name: '董卓', faction: 'enemy', role: 'Commander' },
  { id: 'yuan-shao', name: '袁紹', faction: 'enemy', role: 'Commander' },
  { id: 'liu-biao', name: '劉表', faction: 'neutral', role: 'Support' },
  { id: 'ma-teng', name: '馬騰', faction: 'neutral', role: 'Combat' },
  { id: 'gongsun-zan', name: '公孫瓚', faction: 'enemy', role: 'Combat' },
  { id: 'tao-qian', name: '陶謙', faction: 'neutral', role: 'Support' },
  // 第三批（51-100）
  { id: 'liu-zhang', name: '劉璋', faction: 'neutral', role: 'Commander' },
  { id: 'zhang-lu', name: '張魯', faction: 'neutral', role: 'Support' },
  { id: 'han-sui', name: '韓遂', faction: 'enemy', role: 'Combat' },
  { id: 'yuan-shu', name: '袁術', faction: 'enemy', role: 'Commander' },
  { id: 'kong-rong', name: '孔融', faction: 'neutral', role: 'Support' },
  { id: 'liu-yan', name: '劉焉', faction: 'neutral', role: 'Commander' },
  { id: 'cao-cao-pi', name: '曹丕', faction: 'wei', role: 'Commander' },
  { id: 'cao-cao-zhi', name: '曹植', faction: 'wei', role: 'Support' },
  { id: 'sima-zhao', name: '司馬昭', faction: 'wei', role: 'Commander' },
  { id: 'sima-shi', name: '司馬師', faction: 'wei', role: 'Combat' },
  { id: 'zhuge-jin', name: '諸葛瑾', faction: 'wu', role: 'Support' },
  { id: 'zhuge-ke', name: '諸葛恪', faction: 'wu', role: 'Support' },
  { id: 'bu-zhi', name: '步騭', faction: 'wu', role: 'Support' },
  { id: 'zhu-ran', name: '朱然', faction: 'wu', role: 'Combat' },
  { id: 'pan-zhang', name: '潘璋', faction: 'wu', role: 'Combat' },
  { id: 'ma-zhong', name: '馬忠', faction: 'wu', role: 'Combat' },
  { id: 'liu-feng', name: '劉封', faction: 'shu', role: 'Combat' },
  { id: 'meng-da', name: '孟達', faction: 'neutral', role: 'Combat' },
  { id: 'peng-yang', name: '彭羕', faction: 'shu', role: 'Support' },
  { id: 'fa-zheng', name: '法正', faction: 'shu', role: 'Support' },
  { id: 'huang-quan', name: '黃權', faction: 'shu', role: 'Support' },
  { id: 'li-yan', name: '李嚴', faction: 'shu', role: 'Support' },
  { id: 'wang-ping', name: '王平', faction: 'shu', role: 'Combat' },
  { id: 'zhang-yi', name: '張嶷', faction: 'shu', role: 'Combat' },
  { id: 'liao-hua', name: '廖化', faction: 'shu', role: 'Combat' },
  { id: 'guan-xing', name: '關興', faction: 'shu', role: 'Combat' },
  { id: 'zhang-bao', name: '張苞', faction: 'shu', role: 'Combat' },
  { id: 'ma-dai', name: '馬岱', faction: 'shu', role: 'Combat' },
  { id: 'cao-hong', name: '曹洪', faction: 'wei', role: 'Combat' },
  { id: 'cao-zhang', name: '曹璋', faction: 'wei', role: 'Combat' },
  { id: 'man-chong', name: '滿寵', faction: 'wei', role: 'Combat' },
  { id: 'wang-shuang', name: '王雙', faction: 'wei', role: 'Combat' },
  { id: 'guo-huai', name: '郭淮', faction: 'wei', role: 'Combat' },
  { id: 'chen-tai', name: '陳泰', faction: 'wei', role: 'Combat' },
  { id: 'wen-pin', name: '文聘', faction: 'wei', role: 'Combat' },
  { id: 'le-jin', name: '樂進', faction: 'wei', role: 'Combat' },
  { id: 'li-dian', name: '李典', faction: 'wei', role: 'Combat' },
  { id: 'chen-qun', name: '陳群', faction: 'wei', role: 'Support' },
  { id: 'hua-xin', name: '華歆', faction: 'wei', role: 'Support' },
  { id: 'wang-lang', name: '王朗', faction: 'wei', role: 'Support' },
  { id: 'xun-you', name: '荀攸', faction: 'wei', role: 'Support' },
  { id: 'cheng-yu', name: '程昱', faction: 'wei', role: 'Support' },
  { id: 'liu-ye', name: '劉曄', faction: 'wei', role: 'Support' },
  { id: 'sun-shao', name: '孫邵', faction: 'wu', role: 'Support' },
  { id: 'gu-yong', name: '顧雍', faction: 'wu', role: 'Support' },
  { id: 'zhu-jun', name: '朱治', faction: 'wu', role: 'Combat' },
  { id: 'lv-fan', name: '呂範', faction: 'wu', role: 'Support' },
  { id: 'sun-huan', name: '孫桓', faction: 'wu', role: 'Combat' },
  { id: 'sun-jun', name: '孫峻', faction: 'wu', role: 'Combat' },
  // 第四批（101-150）
  { id: 'he-qi', name: '賀齊', faction: 'wu', role: 'Combat' },
  { id: 'quan-zong', name: '全琮', faction: 'wu', role: 'Combat' },
  { id: 'zhu-huan', name: '朱桓', faction: 'wu', role: 'Combat' },
  { id: 'lu-dai', name: '陸胤', faction: 'wu', role: 'Support' },
  { id: 'zheng-bing', name: '鄭秉', faction: 'wu', role: 'Support' },
  { id: 'han-xuan', name: '韓玄', faction: 'neutral', role: 'Commander' },
  { id: 'jin-xuan', name: '金旋', faction: 'neutral', role: 'Commander' },
  { id: 'liu-du', name: '劉度', faction: 'neutral', role: 'Commander' },
  { id: 'zhao-fan', name: '趙范', faction: 'neutral', role: 'Support' },
  { id: 'wen-chou', name: '文醜', faction: 'enemy', role: 'Combat' },
  { id: 'yan-liang', name: '顏良', faction: 'enemy', role: 'Combat' },
  { id: 'zhang-bao-enemy', name: '張寶', faction: 'enemy', role: 'Combat' },
  { id: 'zhang-jue', name: '張角', faction: 'enemy', role: 'Support' },
  { id: 'zhang-liang-enemy', name: '張梁', faction: 'enemy', role: 'Combat' },
  { id: 'hua-tuo', name: '華佗', faction: 'neutral', role: 'Support' },
  { id: 'mi-zhu', name: '麋竺', faction: 'shu', role: 'Support' },
  { id: 'jian-yong', name: '簡雍', faction: 'shu', role: 'Support' },
  { id: 'sun-qian', name: '孫乾', faction: 'shu', role: 'Support' },
  { id: 'yin-mo', name: '尹默', faction: 'shu', role: 'Support' },
  { id: 'deng-zhi', name: '鄧芝', faction: 'shu', role: 'Support' },
  { id: 'yang-yi', name: '楊儀', faction: 'shu', role: 'Support' },
  { id: 'fei-yi', name: '費禕', faction: 'shu', role: 'Support' },
  { id: 'dong-yun', name: '董允', faction: 'shu', role: 'Support' },
  { id: 'xu-shu', name: '徐庶', faction: 'shu', role: 'Support' },
  { id: 'pang-de', name: '龐德', faction: 'enemy', role: 'Combat' },
  { id: 'zhang-xiu', name: '張繡', faction: 'enemy', role: 'Combat' },
  { id: 'zhang-xian', name: '張羨', faction: 'neutral', role: 'Commander' },
  { id: 'liu-bao', name: '劉豹', faction: 'enemy', role: 'Combat' },
  { id: 'ke-bi-neng', name: '軻比能', faction: 'enemy', role: 'Commander' },
  { id: 'meng-huo', name: '孟獲', faction: 'enemy', role: 'Commander' },
  { id: 'zhu-rong', name: '祝融', faction: 'enemy', role: 'Combat' },
  { id: 'wu-tugu', name: '兀突骨', faction: 'enemy', role: 'Combat' },
  { id: 'ahui-nan', name: '阿會喃', faction: 'enemy', role: 'Combat' },
  { id: 'dong-tu-na', name: '董荼那', faction: 'enemy', role: 'Combat' },
  { id: 'jin-huan-san-jie', name: '金環三結', faction: 'enemy', role: 'Combat' },
  { id: 'yuan-tan', name: '袁譚', faction: 'enemy', role: 'Commander' },
  { id: 'yuan-shang', name: '袁尚', faction: 'enemy', role: 'Commander' },
  { id: 'yuan-xi', name: '袁熙', faction: 'enemy', role: 'Combat' },
  { id: 'gao-lan', name: '高覽', faction: 'enemy', role: 'Combat' },
  { id: 'gao-gan', name: '高幹', faction: 'enemy', role: 'Combat' },
  { id: 'tian-feng', name: '田豐', faction: 'enemy', role: 'Support' },
  { id: 'ju-shou', name: '沮授', faction: 'enemy', role: 'Support' },
  { id: 'guo-tu', name: '郭圖', faction: 'enemy', role: 'Support' },
  { id: 'shen-pei', name: '審配', faction: 'enemy', role: 'Support' },
  { id: 'dong-zhao', name: '董昭', faction: 'wei', role: 'Support' },
  { id: 'han-hao', name: '韓浩', faction: 'wei', role: 'Combat' },
  { id: 'wang-yi', name: '王異', faction: 'wei', role: 'Combat' },
  { id: 'xi-zhi-cai', name: '戲志才', faction: 'wei', role: 'Support' },
  { id: 'mao-jie', name: '毛玠', faction: 'wei', role: 'Support' },
  { id: 'lu-su', name: '魯肅', faction: 'wu', role: 'Support' },
];

// 預設數值（當無從 Wiki 獲得精確值時）
const FACTION_DEFAULTS = {
  wei: { str: 70, int: 65, lea: 72, pol: 68, cha: 65, luk: 60 },
  shu: { str: 68, int: 70, lea: 68, pol: 62, cha: 70, luk: 62 },
  wu: { str: 65, int: 68, lea: 67, pol: 65, cha: 68, luk: 63 },
  enemy: { str: 80, int: 45, lea: 70, pol: 30, cha: 55, luk: 55 },
};

function defaultStats(faction) {
  const base = FACTION_DEFAULTS[faction] || FACTION_DEFAULTS.wei;
  // 小幅隨機化以區分各武將（±5）
  const jitter = () => Math.floor((Math.random() - 0.5) * 10);
  return {
    str: Math.min(99, Math.max(1, base.str + jitter())),
    int: Math.min(99, Math.max(1, base.int + jitter())),
    lea: Math.min(99, Math.max(1, base.lea + jitter())),
    pol: Math.min(99, Math.max(1, base.pol + jitter())),
    cha: Math.min(99, Math.max(1, base.cha + jitter())),
    luk: Math.min(99, Math.max(1, base.luk + jitter())),
  };
}

function calcEp(stats) {
  const { str, int, lea, pol, cha, luk } = stats;
  return Math.round((str + int + lea + pol + cha + luk) / 6);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 嘗試從維基百科取得武將摘要文字
 */
function fetchWikiSummary(name) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(name);
    const url = `https://zh.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const opts = {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.extract || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null))
      .on('timeout', () => resolve(null));
  });
}

/**
 * 映射至標準 GeneralBase 格式
 */
function mapToGeneralBase(seed, wikiExtract) {
  const stats = defaultStats(seed.faction);
  const ep = calcEp(stats);

  return {
    id: seed.id,
    name: seed.name,
    faction: seed.faction,
    role: seed.role || 'Combat',
    gender: '男',
    ...stats,
    ep,
    // historicalAnecdote 填入 wiki 摘要（或佔位）
    historicalAnecdote: wikiExtract
      ? wikiExtract.slice(0, 200)
      : `${seed.name}，三國時期著名人物。（詳細資料待補）`,
    _source: 'wiki',
    _fetchedAt: new Date().toISOString(),
  };
}

// --- 主流程 ---
async function main() {
  console.log('=== ingest-generals-wiki.js ===');
  if (isDryRun) console.log('[INFO]  --dry-run 模式，不寫入檔案。');

  // 確保 temp_workspace 目錄存在
  if (!fs.existsSync(TEMP_WS)) {
    fs.mkdirSync(TEMP_WS, { recursive: true });
  }

  // 嘗試讀取快取
  let cache = {};
  if (fs.existsSync(CACHE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE, 'utf-8'));
      console.log(`[INFO]  讀取快取 ${Object.keys(cache).length} 筆。`);
    } catch {
      console.warn('[WARN]  快取解析失敗，忽略。');
    }
  }

  const seeds = SEED_GENERALS.slice(0, limit);
  const results = [];
  let fetched = 0;
  let cached = 0;
  let failed = 0;

  for (const seed of seeds) {
    let extract = null;
    if (cache[seed.id]) {
      extract = cache[seed.id];
      cached++;
    } else {
      console.log(`[FETCH] ${seed.name}（${seed.id}）...`);
      extract = await fetchWikiSummary(seed.name);
      if (extract) {
        cache[seed.id] = extract;
        fetched++;
      } else {
        console.warn(`[WARN]  ${seed.name} 無法取得 Wiki 摘要，使用佔位文字。`);
        failed++;
      }
      await sleep(RATE_DELAY_MS);
    }

    results.push(mapToGeneralBase(seed, extract));
  }

  console.log(`\n[INFO]  完成：新爬取 ${fetched} 筆、快取 ${cached} 筆、無法取得 ${failed} 筆。`);
  console.log(`[INFO]  共產生 ${results.length} 筆武將資料。`);

  if (isDryRun) {
    console.log('\n[DRY-RUN] 範例資料（前 3 筆）:');
    results.slice(0, 3).forEach(r => console.log(JSON.stringify(r, null, 2)));
    console.log('\n[INFO]  --dry-run 結束，未寫入任何檔案。');
    return;
  }

  // 更新快取
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2), 'utf-8');

  // 輸出 raw-wiki.json
  const output = {
    version: '1.0.0',
    source: 'wikipedia',
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
