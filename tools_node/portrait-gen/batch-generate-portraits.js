#!/usr/bin/env node
/**
 * batch-generate-portraits.js
 *
 * 批次為缺少立繪的武將生成 portrait PNG，透過本機 ComfyUI SDXL。
 *
 * 用法：
 *   node tools_node/portrait-gen/batch-generate-portraits.js            # 全部缺圖武將
 *   node tools_node/portrait-gen/batch-generate-portraits.js --tier legendary,epic  # 指定稀有度
 *   node tools_node/portrait-gen/batch-generate-portraits.js --id liu-bei           # 指定單一武將
 *   node tools_node/portrait-gen/batch-generate-portraits.js --dry-run              # 只列出清單，不生圖
 *   node tools_node/portrait-gen/batch-generate-portraits.js --port 8188            # 指定 ComfyUI port
 *
 * 輸出：assets/resources/sprites/generals/{id}_portrait.png
 * 尺寸：512×640（與甄姬 447×559 接近的 SDXL 友善比例）
 */

'use strict';

const fs          = require('fs');
const path        = require('path');
const { execSync } = require('child_process');
const { buildPrompt } = require('./general-portrait-prompts');

const ROOT         = path.resolve(__dirname, '../..');
const GENERALS_PATH = path.join(ROOT, 'assets/resources/data/master/generals-base.json');
const OUT_DIR      = path.join(ROOT, 'assets/resources/sprites/generals');
const NEG_FILE     = path.join(__dirname, 'portrait-base-negative.txt');
const COMFYUI_SCRIPT = path.join(ROOT, '.github/skills/comfyui-sdxl-partial-asset-gen/scripts/generate-comfyui-sdxl.js');
const BASE_POS     = path.join(__dirname, 'portrait-base-positive.txt');
const TMP_DIR      = path.join(ROOT, 'tools_node/portrait-gen/tmp-prompts');

// ── 引數解析 ─────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');

/** 解析 --flag value 或 --flag=value，flag 名稱不帶 -- */
function getArg(name) {
    const eq = args.find(a => a.startsWith(`--${name}=`));
    if (eq) return eq.slice(`--${name}=`.length);
    const idx = args.indexOf(`--${name}`);
    if (idx !== -1 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
        return args[idx + 1];
    }
    return null;
}

const port  = Number(getArg('port') ?? 8188);
const tiers = getArg('tier') ? getArg('tier').split(',') : null;
const idArg = getArg('id');

// ── 載入武將資料 ─────────────────────────────────────────────────────

const rawData  = JSON.parse(fs.readFileSync(GENERALS_PATH, 'utf8'));
const allGenerals = Array.isArray(rawData) ? rawData : rawData.data ?? [];
const basePos  = fs.readFileSync(BASE_POS, 'utf8');

// ── 篩選缺圖武將 ─────────────────────────────────────────────────────

const existingFiles = fs.readdirSync(OUT_DIR)
    .filter(f => f.endsWith('_portrait.png'))
    .map(f => f.replace('_portrait.png', ''));

function hasPortrait(general) {
    const id = (general.id ?? general.uid ?? '').replace(/-/g, '_');
    return existingFiles.some(e => e === id || e.startsWith(id + '_'));
}

const TIER_ORDER = ['legendary', 'SSR', 'epic', 'SR', 'R', 'N'];

let targets = allGenerals
    .filter(g => !hasPortrait(g))
    .sort((a, b) => {
        const ta = TIER_ORDER.indexOf(a.rarityTier ?? 'N');
        const tb = TIER_ORDER.indexOf(b.rarityTier ?? 'N');
        return (ta === -1 ? 99 : ta) - (tb === -1 ? 99 : tb);
    });

if (idArg) {
    targets = targets.filter(g => (g.id ?? g.uid) === idArg);
}
if (tiers) {
    targets = targets.filter(g => tiers.includes(g.rarityTier));
}

console.log(`\n武將立繪批次生成 — 目標 ${targets.length} 筆  port=${port}  dryRun=${dryRun}\n`);
if (targets.length === 0) {
    console.log('沒有需要生成的武將，結束。');
    process.exit(0);
}

if (dryRun) {
    targets.forEach((g, i) => {
        const id = g.id ?? g.uid;
        console.log(`  [${String(i+1).padStart(3)}] ${id.padEnd(24)} ${g.name} (${g.rarityTier ?? '?'} / ${g.faction ?? '?'})`);
    });
    process.exit(0);
}

// ── 建立暫存 prompt 目錄 ─────────────────────────────────────────────

fs.mkdirSync(TMP_DIR, { recursive: true });

// ── 生成流程 ─────────────────────────────────────────────────────────

let ok = 0, fail = 0, skip = 0;

for (const general of targets) {
    const id      = general.id ?? general.uid;
    const fileId  = id.replace(/-/g, '_');
    const outPath = path.join(OUT_DIR, `${fileId}_portrait.png`);

    // 雙保險：若在此次迭代間已被生成
    if (fs.existsSync(outPath)) {
        console.log(`  ⏭  ${id}  已存在，跳過`);
        skip++;
        continue;
    }

    const prompt     = buildPrompt(general, basePos);
    const promptFile = path.join(TMP_DIR, `${fileId}_prompt.txt`);
    fs.writeFileSync(promptFile, prompt, 'utf8');

    // 稀有度越高 → 更多 steps（LoRA 已關閉）
    const tier  = general.rarityTier ?? 'N';
    const steps = ['legendary','SSR'].includes(tier) ? 40
                : ['epic','SR'].includes(tier)         ? 35
                :                                        30;
    const lora1 = 0;
    const lora2 = 0;
    const cfg   = ['legendary','SSR'].includes(tier) ? 7.5
                : ['epic','SR'].includes(tier)         ? 7.0
                :                                        6.5;

    const cmd = [
        `node "${COMFYUI_SCRIPT}"`,
        `--checkpoint sd_xl_base_1.0.safetensors`,
        `--prompt-file "${promptFile}"`,
        `--negative-file "${NEG_FILE}"`,
        `--width 512`,
        `--height 768`,
        `--steps ${steps}`,
        `--cfg ${cfg}`,
        `--sampler dpmpp_2m`,
        `--scheduler karras`,
        `--lora1-strength 0`,
        `--lora2-strength 0`,
        `--port ${port}`,
        `--output "${outPath}"`,
    ].join(' ');

    process.stdout.write(`  ⏳  ${id.padEnd(24)} (${general.name}) ... `);

    try {
        execSync(cmd, { stdio: 'pipe', timeout: 120_000 });
        if (fs.existsSync(outPath)) {
            console.log('✓ 完成');
            ok++;
        } else {
            console.log('⚠ 腳本成功但找不到輸出檔');
            fail++;
        }
    } catch (err) {
        const msg = (err.stderr?.toString() ?? err.message ?? '').split('\n')[0].slice(0, 80);
        console.log(`✗ 失敗  ${msg}`);
        fail++;
    }
}

// ── 結果 ─────────────────────────────────────────────────────────────

console.log(`\n結果：${ok} 成功  ${fail} 失敗  ${skip} 跳過`);
if (ok > 0) {
    console.log(`輸出目錄：${path.relative(ROOT, OUT_DIR)}`);
    console.log('\n⚠  記得在 Cocos Creator 執行 Refresh Assets 更新 .meta 檔');
}
if (fail > 0) process.exit(1);
