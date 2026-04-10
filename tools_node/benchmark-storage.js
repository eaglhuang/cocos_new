/**
 * benchmark-storage.js
 *
 * DC-2-0006: M2 分層載入效能基準測試
 *
 * 模擬 350 位武將資料，量測：
 *   - App 啟動 L0 載入時間（generals-index.json）
 *   - L1 陣容預載時間
 *   - L2 倉庫分頁載入時間
 *   - L3 單筆詳情載入時間
 *   - 記憶體峰值估算
 *
 * 驗收：L0 < 100ms，L2 分頁 < 50ms
 *
 * Usage:
 *   node tools_node/benchmark-storage.js
 *   node tools_node/benchmark-storage.js --runs 5         # 重複 N 次取平均
 *   node tools_node/benchmark-storage.js --out docs/tasks/benchmark-storage-report.md
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const runsIdx = args.indexOf('--runs');
const RUNS = runsIdx >= 0 ? parseInt(args[runsIdx + 1], 10) || 3 : 3;
const outIdx = args.indexOf('--out');
const OUTPUT_PATH = outIdx >= 0 ? args[outIdx + 1] : 'docs/tasks/benchmark-storage-report.md';

// ─── 測試資料生成器 ────────────────────────────────────────────────────────────
const FACTIONS = ['wei', 'shu', 'wu', 'qun', 'han'];
const RARITY = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const CATEGORY = ['civilian', 'general', 'famed', 'mythical', 'titled'];

function genUid(i) {
    return `general-${String(i).padStart(4, '0')}`;
}

function genGeneral(i) {
    const faction = FACTIONS[i % FACTIONS.length];
    const rarityTier = RARITY[i % RARITY.length];
    const characterCategory = CATEGORY[i % CATEGORY.length];
    return {
        id: genUid(i),
        name: `武將${i}`,
        faction,
        rarityTier,
        characterCategory,
        str: 50 + (i % 50),
        int: 45 + (i % 55),
        cha: 40 + (i % 60),
        lead: 35 + (i % 65),
        pol: 30 + (i % 70),
        luk: 20 + (i % 80),
        ep: 800 + i * 3,
        ancestor_chain: Array.from({ length: 14 }, (_, j) => `anc-${i}-${j}`),
        gene_refs: Array.from({ length: 6 }, (_, j) => `GENE_${(i * 6 + j) % 100}`),
    };
}

function genIndex(generals) {
    return {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        data: generals.map(g => ({
            uid: g.id,
            name: g.name,
            faction: g.faction,
            rarityTier: g.rarityTier,
            layerKey: 'storage',
        })),
    };
}

function genLore(i) {
    return {
        id: genUid(i),
        historicalAnecdote: `武將${i}的歷史趣聞：相傳其早年投身軍旅，以戰功聞名天下，素有"萬夫莫敵"之稱。`,
        bloodlineRumor: `關於武將${i}的血統傳聞：據可靠史料記載，其先祖曾在漢末亂世中輔佐一方諸侯。`,
        storyStripCells: Array.from({ length: 6 }, (_, j) => ({
            title: `第${j + 1}話`,
            content: `武將${i}的第${j + 1}則故事，詳述其在戰場上的英勇事蹟與謀略智慧。`,
        })),
    };
}

// ─── 量測工具 ─────────────────────────────────────────────────────────────────
function bench(label, fn) {
    const times = [];
    for (let r = 0; r < RUNS; r++) {
        const start = performance.now();
        fn();
        times.push(performance.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    return { label, avg: +avg.toFixed(2), min: +min.toFixed(2), max: +max.toFixed(2), runs: RUNS };
}

async function benchAsync(label, fn) {
    const times = [];
    for (let r = 0; r < RUNS; r++) {
        const start = performance.now();
        await fn();
        times.push(performance.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    return { label, avg: +avg.toFixed(2), min: +min.toFixed(2), max: +max.toFixed(2), runs: RUNS };
}

function estimateBytes(obj) {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}

// ─── 主測試 ───────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n[benchmark-storage] 開始測試（${RUNS} runs / 量測）\n`);

    const TOTAL = 350;
    const PAGE_SIZE = 20;
    const L1_COUNT = 12;

    // 生成模擬資料
    const generals = Array.from({ length: TOTAL }, (_, i) => genGeneral(i));
    const lores = Array.from({ length: TOTAL }, (_, i) => genLore(i));
    const index = genIndex(generals);

    // ── L0: generals-index.json 啟動載入 ──
    const indexJson = JSON.stringify(index);
    const indexBytes = Buffer.byteLength(indexJson, 'utf8');
    const r0 = bench('L0 generals-index.json 解析（啟動）', () => {
        JSON.parse(indexJson);
    });

    // ── L1: 陣容預載（12 位武將） ──
    const l1Generals = generals.slice(0, L1_COUNT);
    const l1Json = JSON.stringify({ data: l1Generals });
    const l1Bytes = Buffer.byteLength(l1Json, 'utf8');
    const r1 = bench('L1 陣容預載（12 位武將）', () => {
        JSON.parse(l1Json);
    });

    // ── L2: 倉庫分頁（20 位 / 頁） ──
    const page0 = generals.slice(0, PAGE_SIZE);
    const l2Json = JSON.stringify({ data: page0 });
    const l2Bytes = Buffer.byteLength(l2Json, 'utf8');
    const r2 = bench('L2 倉庫分頁載入（20 位 / 頁）', () => {
        JSON.parse(l2Json);
    });

    // ── L3: 單筆詳情（含 lore） ──
    const singleLore = lores[0];
    const l3Json = JSON.stringify(singleLore);
    const l3Bytes = Buffer.byteLength(l3Json, 'utf8');
    const r3 = bench('L3 單筆詳情載入（含 lore）', () => {
        JSON.parse(l3Json);
    });

    // ── 記憶體峰值估算 ──
    const fullIndexBytes = indexBytes;
    const l1ActiveBytes = l1Bytes;
    const lruLoreBytes = estimateBytes({ data: lores.slice(0, 20) }); // LRU 20 位常駐
    const totalEstimateBytes = fullIndexBytes + l1ActiveBytes + lruLoreBytes;

    // ── 驗收判定 ──
    const l0Pass = r0.avg <= 100;
    const l2Pass = r2.avg <= 50;

    // ── 輸出到 console ──
    const results = [r0, r1, r2, r3];
    console.log('─'.repeat(70));
    console.log('測試結果（ms）');
    console.log('─'.repeat(70));
    results.forEach(r => {
        const pass = r.label.includes('L0') ? (r.avg <= 100 ? '✅ PASS' : '❌ FAIL') :
                     r.label.includes('L2') ? (r.avg <= 50 ? '✅ PASS' : '❌ FAIL') : '  --  ';
        console.log(`${pass}  ${r.label.padEnd(38)} avg:${String(r.avg).padStart(7)}ms  min:${r.min}ms  max:${r.max}ms`);
    });

    console.log('─'.repeat(70));
    console.log('資料量估算');
    console.log('─'.repeat(70));
    console.log(`  L0 index JSON:            ${(fullIndexBytes / 1024).toFixed(1)} KB（350 武將索引）`);
    console.log(`  L1 active JSON:            ${(l1ActiveBytes / 1024).toFixed(1)} KB（12 位陣容武將）`);
    console.log(`  L2 page JSON:              ${(l2Bytes / 1024).toFixed(1)} KB（20 位 / 頁）`);
    console.log(`  L3 single lore JSON:       ${(l3Bytes / 1024).toFixed(1)} KB（單筆 lore）`);
    console.log(`  記憶體峰值估算（L0+L1+LRU20）: ${(totalEstimateBytes / 1024).toFixed(1)} KB`);
    console.log('─'.repeat(70));

    const overallPass = l0Pass && l2Pass;
    console.log(`\n總驗收結果: ${overallPass ? '✅ PASS' : '❌ FAIL（部分超標）'}`);
    console.log(`  L0 < 100ms: ${l0Pass ? '✅' : '❌'}（avg ${r0.avg}ms）`);
    console.log(`  L2 < 50ms:  ${l2Pass ? '✅' : '❌'}（avg ${r2.avg}ms）`);

    // ── 寫出報告 ──
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' (UTC+8)';
    const report = `# Benchmark Storage 效能基準報告

> 生成日期：${timestamp}
> 工具：tools_node/benchmark-storage.js
> 測試 runs：${RUNS}
> 模擬武將數：${TOTAL}

## 測試結果（ms）

| 驗收 | 測試項目 | avg | min | max | 目標 |
|------|---------|-----|-----|-----|------|
| ${l0Pass ? '✅' : '❌'} | L0 generals-index.json 解析（啟動） | ${r0.avg}ms | ${r0.min}ms | ${r0.max}ms | < 100ms |
| -- | L1 陣容預載（12 位武將） | ${r1.avg}ms | ${r1.min}ms | ${r1.max}ms | 參考值 |
| ${l2Pass ? '✅' : '❌'} | L2 倉庫分頁載入（20 位 / 頁） | ${r2.avg}ms | ${r2.min}ms | ${r2.max}ms | < 50ms |
| -- | L3 單筆詳情載入（含 lore） | ${r3.avg}ms | ${r3.min}ms | ${r3.max}ms | 參考值 |

## 資料量估算

| 層級 | 說明 | 大小 |
|------|------|------|
| L0 index JSON | 350 武將索引（uid/name/faction/rarityTier） | ${(fullIndexBytes / 1024).toFixed(1)} KB |
| L1 active JSON | 12 位陣容武將完整資料 | ${(l1ActiveBytes / 1024).toFixed(1)} KB |
| L2 page JSON | 倉庫單頁 20 位武將 | ${(l2Bytes / 1024).toFixed(1)} KB |
| L3 single lore | 單筆武將 lore（故事/血脈） | ${(l3Bytes / 1024).toFixed(1)} KB |
| **記憶體峰值估算** | **L0 + L1 + LRU 20 故事** | **${(totalEstimateBytes / 1024).toFixed(1)} KB** |

## 總驗收結果

**${overallPass ? '✅ PASS' : '❌ FAIL（部分超標，詳見上表）'}**

- L0 < 100ms：${l0Pass ? '✅ PASS' : '❌ FAIL'}（avg ${r0.avg}ms）
- L2 < 50ms：${l2Pass ? '✅ PASS' : '❌ FAIL'}（avg ${r2.avg}ms）

## 備注

- 本測試使用 Node.js in-memory JSON.parse 模擬，不含網路/磁碟 I/O。
- 實際遊戲環境因 Cocos cc.resources.load 的 async I/O 可能略高於此值。
- 若 L0 > 80ms 或 L2 > 40ms 建議開啟欄位壓縮（field-abbreviation-map）。
- 相依：DataPageLoader.ts、DataCatalog.ts、DataStorageAdapter.ts (DC-2-0001~0003)。
`;

    fs.writeFileSync(path.resolve(OUTPUT_PATH), report, 'utf8');
    console.log(`\n報告已寫出：${OUTPUT_PATH}`);

    process.exit(overallPass ? 0 : 1);
}

main().catch(err => {
    console.error('[benchmark-storage] Error:', err);
    process.exit(1);
});
