#!/usr/bin/env node
/**
 * general-portrait-prompts.js
 * 輸出每位武將的個人化 positive prompt 追加詞。
 * 用法：node general-portrait-prompts.js [generalId]
 *        → 印出該武將的完整 positive prompt（base + 角色詞）
 */

'use strict';

/** 角色詞典：針對知名武將的個人化追加詞 */
const CHARACTER_HINTS = {
  // ── 蜀 ──────────────────────────────────────────────────────────
  'liu-bei':       'middle-aged emperor, royal dragon robe, golden crown, benevolent expression, Shu Han emperor, Liu Bei, kind eyes, imperial regalia',
  'zhuge-liang':   'elegant scholar strategist, white feather fan, Taoist robe, calm intelligent gaze, long sleeves, advisor crown, Zhuge Liang, tactician',
  'huang-zhong':   'elderly warrior general, white beard, heavy armor, bow and arrow, fierce battle veteran, aged but powerful',
  'ma-chao':       'young fierce general, white armor with red trim, silver helmet feathers, intense eyes, Ma Chao, Western warrior',
  'pang-tong':     'eccentric strategist, dark robes, unkempt appearance, unusual features, Pang Tong, genius advisor',
  'wei-yan':       'fierce general, dark armor, bold aggressive face, scar on face, Wei Yan, powerful warrior',
  'jiang-wei':     'young loyal general, blue Wei armor converted to Shu, determined expression, youthful warrior, Jiang Wei',
  'deng-ai':       'steady general, practical heavy armor, Wei colors, strategic expression, Deng Ai',
  'zhong-hui':     'intelligent young general, elegant Wei armor, ambitious cunning eyes, Zhong Hui, Wei strategist',

  // ── 魏 ──────────────────────────────────────────────────────────
  'sima-yi':       'cunning strategist, dark layered robes, sinister calculating expression, silver-streaked hair, Sima Yi, Wei advisor, cold eyes',
  'dian-wei':      'massive bodyguard warrior, heavy iron armor, dual axes, enormous build, fierce loyal expression, Dian Wei, fearsome guard',
  'xu-zhu':        'giant burly warrior, thick iron armor, simple honest face, massive physique, Xu Zhu, loyal guard',
  'zhang-liao':    'elite cavalry general, Wei blue-silver armor, helmet with plume, stern experienced warrior, Zhang Liao',
  'xu-huang':      'disciplined general, Wei armor, axe weapon, calm strict expression, Xu Huang, strict commander',
  'cao-ren':       'steadfast defender general, heavy defensive armor, shield motif, reliable expression, Cao Ren',
  'guo-jia':       'young brilliant advisor, loose scholar robes, wine cup, elegant refined face, prodigy strategist, Guo Jia',
  'xun-yu':        'refined court advisor, formal Han court robes, dignified scholarly expression, Xun Yu',
  'jia-xu':        'mysterious tactician, layered dark robes, inscrutable expression, aged wisdom, Jia Xu',
  'zhang-he':      'agile Wei general, ornate armor, flowing movement pose, Zhang He, skilled fighter',
  'yu-jin':        'rigid disciplined general, standard Wei armor, stern military bearing, Yu Jin',
  'cao-ang':       'young Wei prince, noble costume, youthful earnest face, Cao Ang, eldest son',
  'xiahou-dun':    'one-eyed battle general, eyepatch over left eye, battle-scarred armor, fierce loyal expression, Xiahou Dun',
  'xiahou-yuan':   'swift archer general, light nimble armor, crossbow ready, intense focus, Xiahou Yuan',
  'zhong-hui':     'ambitious young general, refined Wei armor, intelligent scheming gaze',

  // ── 吳 ──────────────────────────────────────────────────────────
  'sun-quan':      'young Wu emperor, jade-green imperial robes, regal crown, confident commanding gaze, Sun Quan, Wu lord',
  'zhou-yu':       'handsome young strategist, elegant Wu teal armor, flute accessory, brilliant charismatic face, Zhou Yu, gifted general',
  'lu-xun':        'youthful Wu strategist, scholar-warrior robes, intelligent modest expression, Lu Xun, tactician',
  'taishi-ci':     'proud Wu warrior, distinctive armor, confident battle-ready stance, Taishi Ci',
  'huang-gai':     'veteran Wu admiral, aged warrior, naval armor motif, battle-hardened expression, Huang Gai',
  'cheng-pu':      'senior Wu general, elder warrior, experienced battle veteran, Cheng Pu',
  'han-dang':      'loyal Wu veteran, standard Wu armor, steady reliable expression, Han Dang',
  'ling-tong':     'young Wu warrior, light agile armor, dual blades, fierce filial warrior, Ling Tong',
  'gan-ning':      'pirate-turned-admiral, flamboyant armor with bells and ornaments, fierce tattooed warrior, Gan Ning',
  'lu-meng':       'rising Wu general, determined ambitious expression, Lu Meng, self-educated warrior',
  'sun-ce':        'young conqueror, heroic powerful build, Sun Ce, founding Wu lord, bold fearless expression',
  'sun-shang-xiang': 'fierce princess warrior, female fighter, ornate bow, Wu princess robes, Sun Shangxiang',
  'da-qiao':       'beautiful Wu noblewoman, elegant ceremonial dress, graceful delicate features, elder Qiao sister',
  'xiao-qiao':     'lovely young noblewoman, cheerful floral dress, youthful beautiful features, younger Qiao sister, Zhou Yu wife',

  // ── 其他 ─────────────────────────────────────────────────────────────
  'diao-chan':     'legendary beauty, graceful dancer courtesan, exquisite face, seductive charming expression, luxurious layered silk hanfu with red and gold, elaborate phoenix crown and dangling jade ornaments, Diaochan, Four Beauties of ancient China, alluring enchanting gaze, soft pink and crimson color scheme',
  'lu-bu':        'legendary supreme warrior, intimidating powerful build, iconic red-feathered crown, ornate black and red heavy armor, sky piercer halberd, fierce domineering expression, Lu Bu, unrivaled warrior',
};

/** 陣營色調關鍵詞 */
const FACTION_COLOR = {
  wei:    'blue and silver color scheme, Wei dynasty colors, cold steel blue accents',
  shu:    'deep green and warm gold color scheme, Shu Han colors, jade ornaments',
  wu:     'teal and crimson color scheme, Wu kingdom colors, naval aesthetic',
  han:    'imperial red and gold, Han dynasty regalia, dragon motifs',
  qun:    'earth tones and neutral colors, independent warlord, diverse regional style',
  enemy:  'rich imposing color scheme, dramatic contrast, dark accent tones',
  other:  'varied color scheme, unique personal style',
};

/** 稀有度品質追加詞 (sd_xl_base 半寫實格式) */
const TIER_QUALITY = {
  legendary: 'ultra detailed masterpiece, exquisite semi-realistic illustration, intricate ornate costume with finest gold embroidery and jade inlay, flowing luxurious silk with dragon or phoenix motifs, radiant commanding aura, flawless detailed facial features, cinematic dramatic rim lighting, elaborate premium hair ornaments, jeweled accessories, museum quality character art, perfect realistic shading',
  SSR:       'detailed masterpiece, refined semi-realistic illustration, intricate ornate costume with gold embroidery and jade ornaments, radiant aura, polished detailed facial features, dramatic lighting, elaborate hair ornaments, high quality realistic shading',
  epic:      'highly detailed illustration, semi-realistic rendering, ornate armor or elegant costume, elaborate decorative elements, strong heroic commanding presence, vibrant color palette, refined detailed facial features, realistic lighting and shadows',
  SR:        'detailed illustration, semi-realistic style, ornate armor or elegant costume, decorative elements, heroic presence, refined facial features, good realistic shading',
  rare:      'detailed illustration, semi-realistic style, armor or costume with decorative elements, clear character design, realistic shading',
  R:         'good quality illustration, semi-realistic style, functional armor or costume, clear character design',
  N:         'illustration, semi-realistic style, functional armor or costume, clear character design',
};

/** 性別 prompt — 女角色加強美感與服裝多樣化 */
const GENDER_HINT = {
  '男': 'male warrior, masculine heroic features, strong jawline, handsome determined face, realistic male portrait',
  '女': [
    'beautiful elegant ancient Chinese woman, stunning classical beauty,',
    'delicate porcelain smooth skin, graceful feminine features, expressive almond-shaped eyes,',
    'refined elegant lips, gorgeous traditional elaborate hairstyle with jade hairpins and gold headdress ornaments,',
    'flowing embroidered silk hanfu with intricate floral and phoenix patterns,',
    'feminine grace combined with classical beauty, soft luminous skin,',
    'elegant aristocratic poise, charming alluring expression, realistic detailed female portrait',
  ].join(' '),
};

/** 服裝風格多樣化池（每個武將依 id hash 選取，保證同一武將每次一致） */
const COSTUME_VARIANTS_MALE = [
  'elaborate ceremonial battle armor with ornate pauldrons and decorative breastplate',
  'flowing scholar robes with wide sleeves and jade belt ornament, strategist attire',
  'light cavalry armor with flowing cape and decorative helmet',
  'heavy siege general armor with thick iron plates and imposing silhouette',
  'noble court robe with intricate embroidery and formal official headgear',
  'battle-worn commander armor with red cape and general\'s insignia',
  'elegant layered silk robes with golden trim, refined aristocrat style',
  'distinctive regional warrior costume with unique cultural elements',
];

const COSTUME_VARIANTS_FEMALE = [
  'layered silk hanfu with peony embroidery and flowing sleeves, court lady style',
  'female warrior light armor with decorative floral patterns over silk inner robe',
  'princess ceremonial robes with phoenix crown and elaborate jewelry',
  'elegant dancer-warrior costume with ribbon streamers and jade accessories',
  'scholar beauty with ink-dyed robes and minimal ornate hairpin',
  'noble consort robes with phoenix and cloud embroidery, imperial style',
  'flowing multicolored silk ensemble with butterfly sleeve and sheer overlay',
  'armored female general with elegant feminine touches, rose and vine motifs on armor',
];

/** 用 id 字串 hash 選服裝（保持每次一致） */
function hashId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h);
}

/**
 * 組合完整 positive prompt
 * @param {object} general  - { id, name, faction, gender, rarityTier }
 * @param {string} basePrompt - portrait-base-positive.txt 的內容
 */
function buildPrompt(general, basePrompt) {
  const id      = general.id ?? general.uid ?? '';
  const faction = general.faction ?? 'qun';
  const gender  = general.gender ?? '男';
  const tier    = general.rarityTier ?? 'N';

  const isFemale = gender === '女';
  const variants = isFemale ? COSTUME_VARIANTS_FEMALE : COSTUME_VARIANTS_MALE;
  const costume  = variants[hashId(id) % variants.length];

  const parts = [
    basePrompt.trim(),
    GENDER_HINT[gender] ?? GENDER_HINT['男'],
    FACTION_COLOR[faction] ?? FACTION_COLOR['qun'],
    TIER_QUALITY[tier] ?? TIER_QUALITY['N'],
    costume,
  ];

  // 已有個人化角色詞時加入
  const hint = CHARACTER_HINTS[id];
  if (hint) {
    parts.push(hint);
  } else {
    parts.push(`${general.name}, Three Kingdoms historical figure`);
  }

  return parts.join(', ');
}

// ── CLI 出口 ─────────────────────────────────────────────────────────

if (require.main === module) {
  const fs   = require('fs');
  const path = require('path');

  const ROOT       = path.resolve(__dirname, '../..');
  const GENERALS   = path.join(ROOT, 'assets/resources/data/master/generals-base.json');
  const BASE_POS   = path.join(__dirname, 'portrait-base-positive.txt');

  const raw     = JSON.parse(fs.readFileSync(GENERALS, 'utf8'));
  const all     = Array.isArray(raw) ? raw : raw.data ?? [];
  const basePos = fs.readFileSync(BASE_POS, 'utf8');

  const targetId = process.argv[2];
  const generals = targetId ? all.filter(g => (g.id ?? g.uid) === targetId) : all;

  if (generals.length === 0) {
    console.error('找不到武將：' + targetId);
    process.exit(1);
  }

  generals.forEach(g => {
    const prompt = buildPrompt(g, basePos);
    if (targetId) {
      process.stdout.write(prompt);
    } else {
      console.log(JSON.stringify({ id: g.id ?? g.uid, name: g.name, prompt }));
    }
  });
}

module.exports = { buildPrompt, CHARACTER_HINTS, FACTION_COLOR, GENDER_HINT };
