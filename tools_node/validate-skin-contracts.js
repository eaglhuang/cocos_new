/**
 * validate-skin-contracts.js
 * 
 * §9.6 Skin JSON 契約自動驗證腳本
 * 根據 docs/UI參考圖品質分析.md §9.6 定義的可執行化規則進行驗證
 * 
 * 用法：
 *   node tools_node/validate-skin-contracts.js
 *   node tools_node/validate-skin-contracts.js --verbose
 * 
 * 驗證規則：
 *   R1: §4.3  主面板 fill slot alpha 應在 0xDD~0xF0 (221~240) 範圍
 *   R2: §4.2  skin 中若有 frame slot → 必須同時有 bleed slot（不可省略）
 *   R3: §5.4  深色底 label-style → outlineWidth ≥ 1
 *   R4: §5.2  淺色底 label-style → outlineWidth = 0
 *   R5: §2.1  button-skin border 值若存在 → 至少 [20,20,20,20]（dark-metal 家族）
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const SKINS_DIR     = path.resolve(__dirname, '../assets/resources/ui-spec/skins');
const LAYOUTS_DIR   = path.resolve(__dirname, '../assets/resources/ui-spec/layouts');
const FRAGMENTS_DIR = path.resolve(__dirname, '../assets/resources/ui-spec/fragments');
const VERBOSE       = process.argv.includes('--verbose');

// ── 輔助函式 ──────────────────────────────────────────────────────────────────

/**
 * 從 hex color string 取出 Alpha 值（0~255）
 * 支援: #RRGGBBAA, #RRGGBB (預設 FF), #RGBA, #RGB
 */
function parseAlpha(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const h = hex.replace('#', '');
  if (h.length === 8) return parseInt(h.slice(6, 8), 16); // #RRGGBBAA
  if (h.length === 6) return 0xFF;                        // #RRGGBB → fully opaque
  if (h.length === 4) return parseInt(h[3] + h[3], 16);  // #RGBA
  if (h.length === 3) return 0xFF;                        // #RGB
  return null;
}

/**
 * 判斷是否為深色背景顏色（alpha 不透明且亮度低）
 * 這裡用簡化規則：color hex 中 RGB 三通道平均亮度 < 80 視為深色
 */
function isDarkColor(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const h = hex.replace('#', '');
  let r, g, b;
  if (h.length >= 6) {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else if (h.length >= 3) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else {
    return false;
  }
  return (r + g + b) / 3 < 80;
}

/**
 * 判斷是否為淺色背景（RGB 平均亮度 > 180）
 */
function isLightColor(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const h = hex.replace('#', '');
  let r, g, b;
  if (h.length >= 6) {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else if (h.length >= 3) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else {
    return false;
  }
  return (r + g + b) / 3 > 180;
}

// ── 記錄 ──────────────────────────────────────────────────────────────────────
const results = { pass: 0, warn: 0, fail: 0, total: 0 };
const issues  = [];

function log(level, skinFile, slotId, rule, message) {
  results.total++;
  results[level]++;
  const prefix = level === 'pass' ? '✅ PASS' : level === 'warn' ? '⚠️  WARN' : '❌ FAIL';
  const entry  = `${prefix} [${skinFile}] slot="${slotId}" (${rule}): ${message}`;
  if (level !== 'pass' || VERBOSE) {
    issues.push(entry);
  }
}

// ── 主驗證邏輯 ────────────────────────────────────────────────────────────────

function validateSkin(filePath) {
  const fileName = path.basename(filePath);
  let skin;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    skin = JSON.parse(raw);
  } catch (e) {
    log('warn', fileName, '—', 'PARSE', `無法解析 JSON: ${e.message}`);
    return;
  }

  // ── 新增: 處理 $fragments 引用 ────────────────────────────────────
  if (skin.$fragments && Array.isArray(skin.$fragments)) {
    for (const fragId of skin.$fragments) {
      const fragPath = path.join(FRAGMENTS_DIR, 'skins', `${fragId}.json`);
      if (fs.existsSync(fragPath)) {
        try {
          const frag = JSON.parse(fs.readFileSync(fragPath, 'utf8'));
          // 合併 fragment 的 slots 到當前 skin (不覆蓋已有的，模擬 UISpecLoader 邏輯)
          Object.assign(skin.slots, { ...frag.slots, ...skin.slots });
          if (VERBOSE) log('pass', fileName, '$fragments', 'FRAG', `併入碎片: ${fragId}`);
        } catch (e) {
          log('fail', fileName, fragId, 'FRAG', `解析碎片失敗: ${e.message}`);
        }
      } else {
        log('fail', fileName, fragId, 'FRAG', `找不到碎片檔案: ${fragPath}`);
      }
    }
  }

  const slots = skin.slots || skin;

  // 收集所有 slot keys
  const slotKeys = Object.keys(slots);

  // 找到所有 frame slot（slot key 含 .frame 或 kind=sprite-9slice/frame-slot）
  const frameKeys  = slotKeys.filter(k => k.endsWith('.frame'));
  const bleedKeys  = slotKeys.filter(k => k.endsWith('.bleed'));
  const fillKeys   = slotKeys.filter(k => k.endsWith('.fill'));
  const labelKeys  = slotKeys.filter(k => {
    const s = slots[k];
    return s && s.kind === 'label-style';
  });

  // R2: 若有 frame slot → 必須有對應的 bleed slot
  for (const fk of frameKeys) {
    const prefix = fk.replace(/\.frame$/, '');
    const bleedKey = `${prefix}.bleed`;
    if (bleedKeys.includes(bleedKey)) {
      log('pass', fileName, fk, 'R2', `bleed slot "${bleedKey}" 存在`);
    } else {
      log('fail', fileName, fk, 'R2', `缺少 bleed slot "${bleedKey}"（§4.2 要求）`);
    }
  }

  // R1: fill slot 的 color alpha 應在 0xDD~0xF0
  for (const fk of fillKeys) {
    const slot = slots[fk];
    if (!slot) continue;
    const colorStr = slot.color || (slot.fill && slot.fill.color);
    if (!colorStr) {
      if (VERBOSE) log('pass', fileName, fk, 'R1', '無 color 值（跳過 alpha 檢查）');
      continue;
    }
    const alpha = parseAlpha(colorStr);
    if (alpha === null) {
      log('warn', fileName, fk, 'R1', `無法解析 color alpha: "${colorStr}"`);
    } else if (alpha >= 0xDD && alpha <= 0xF0) {
      log('pass', fileName, fk, 'R1', `fill alpha=0x${alpha.toString(16).toUpperCase()} 在 0xDD~0xF0 範圍`);
    } else {
      log('warn', fileName, fk, 'R1', `fill alpha=0x${alpha.toString(16).toUpperCase()} 超出建議範圍 0xDD~0xF0（§4.3）`);
    }
  }

  // R3/R4: label-style 深/淺底 outline 規範
  for (const lk of labelKeys) {
    const slot = slots[lk];
    if (!slot) continue;
    const bg    = slot.backgroundColor || slot.background || null;
    const color = slot.color || null;
    const ow    = typeof slot.outlineWidth === 'number' ? slot.outlineWidth : null;

    // 若 slot 本身有 backgroundColor 可推斷
    if (bg) {
      if (isDarkColor(bg) && ow !== null && ow < 1) {
        log('fail', fileName, lk, 'R3', `深色底(${bg}) label-style 的 outlineWidth=${ow} < 1（§5.4）`);
      } else if (isDarkColor(bg) && ow !== null && ow >= 1) {
        log('pass', fileName, lk, 'R3', `深色底 label-style outlineWidth=${ow} OK`);
      }
      if (isLightColor(bg) && ow !== null && ow > 0) {
        log('warn', fileName, lk, 'R4', `淺色底(${bg}) label-style 的 outlineWidth=${ow} > 0（§5.2）`);
      } else if (isLightColor(bg) && ow !== null && ow === 0) {
        log('pass', fileName, lk, 'R4', `淺色底 label-style outlineWidth=0 OK`);
      }
    }

    // 若 slot 的 color 是白/金 → 推斷為深色底
    if (!bg && color) {
      const isWhiteOrGold = /^#(FFFFFF|FFE088|FFE064|FFF|EEE|E5E2|EEDFCC)/i.test(color);
      if (isWhiteOrGold && ow !== null && ow < 1) {
        log('warn', fileName, lk, 'R3', `疑似深色底（color=${color}）label-style outlineWidth=${ow} < 1（§5.4）`);
      }
    }
  }

  // R5: button-skin border 驗證（若有 border 字段且是 dark-metal 家族路徑）
  const buttonKeys = slotKeys.filter(k => {
    const s = slots[k];
    return s && (s.kind === 'sprite-button' || s.kind === 'button-skin');
  });
  for (const bk of buttonKeys) {
    const slot = slots[bk];
    if (!slot.border) continue;
    const border = slot.border;
    if (!Array.isArray(border) || border.length < 4) continue;
    const minBorder = Math.min(...border);
    // 只對明確使用 dark-metal / nav-ink 家族的按鈕檢查
    const isMetalFamily = ['nav_ink', 'dark_metal', 'equipment', 'warning'].some(f =>
      JSON.stringify(slot).includes(f));
    if (isMetalFamily && minBorder < 20) {
      log('fail', fileName, bk, 'R5', `dark-metal 家族 button border=${JSON.stringify(border)} 最小值 ${minBorder} < 20（§2.1）`);
    } else if (isMetalFamily) {
      log('pass', fileName, bk, 'R5', `border=${JSON.stringify(border)} ≥ [20,20,20,20] OK`);
    }
  }
}

// ── 執行 ──────────────────────────────────────────────────────────────────────

console.log('='.repeat(60));
console.log('§9.6 Skin 契約自動驗證腳本');
console.log(`掃描目錄: ${SKINS_DIR}`);
console.log('='.repeat(60));

if (!fs.existsSync(SKINS_DIR)) {
  console.error(`[ERROR] 目錄不存在: ${SKINS_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(SKINS_DIR)
  .filter(f => f.endsWith('.json') && !f.endsWith('.meta'))
  .sort();

console.log(`找到 ${files.length} 個 skin JSON 檔案\n`);

for (const file of files) {
  validateSkin(path.join(SKINS_DIR, file));
}

// ── 驗證 Layout 中的 $ref ────────────────────────────────────────────────────
console.log('\n驗證佈局碎片引用...');
const layoutFiles = fs.readdirSync(LAYOUTS_DIR)
  .filter(f => f.endsWith('.json') && !f.endsWith('.meta'));

function checkRefs(node, fileName) {
  if (node.$ref) {
    const refPath = path.join(LAYOUTS_DIR, '../../', `ui-spec/${node.$ref}.json`);
    if (fs.existsSync(refPath)) {
      log('pass', fileName, node.$ref, 'LAYOUT_REF', '引用的碎片路徑 OK');
    } else {
      log('fail', fileName, node.$ref, 'LAYOUT_REF', `引用的碎片不存在: ${refPath}`);
    }
  }
  if (node.children) node.children.forEach(c => checkRefs(c, fileName));
  if (node.itemTemplate) checkRefs(node.itemTemplate, fileName);
}

for (const file of layoutFiles) {
  try {
    const layout = JSON.parse(fs.readFileSync(path.join(LAYOUTS_DIR, file), 'utf8'));
    if (layout.root) checkRefs(layout.root, file);
  } catch (e) {}
}

// ── 輸出結果 ─────────────────────────────────────────────────────────────────

if (issues.length > 0) {
  console.log('\n--- 發現的問題與警告 ---');
  issues.forEach(i => console.log(i));
}

console.log('\n' + '='.repeat(60));
console.log('驗證結果統計:');
console.log(`  ✅ PASS: ${results.pass}`);
console.log(`  ⚠️  WARN: ${results.warn}`);
console.log(`  ❌ FAIL: ${results.fail}`);
console.log(`  Total checks: ${results.total}`);
if (results.total > 0) {
  const passRate = ((results.pass / results.total) * 100).toFixed(1);
  console.log(`  通過率: ${passRate}%`);
}
console.log('='.repeat(60));

process.exit(results.fail > 0 ? 1 : 0);
