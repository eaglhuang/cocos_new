#!/usr/bin/env node
/**
 * sync-figma-proof-mapping.js
 *
 * 讀取 Figma 09_Proof Mapping frame（或本地 config）並輸出標準化
 * proof-mapping-{date}.json，供 scaffold-ui-spec-family.js 消費。
 *
 * 使用範例：
 *   # 從本地 config 驗證並輸出
 *   node tools_node/sync-figma-proof-mapping.js --config artifacts/ui-qa/UI-2-0073/proof-mapping-template.dialog-card.json --dry-run
 *
 *   # 從 Figma 同步（需要 FIGMA_TOKEN 環境變數）
 *   node tools_node/sync-figma-proof-mapping.js --frame-id lf8ByZq8VVBtBTBJ0IpahX --family bloodline-awakening-dialog --dry-run
 *
 *   # 列出當前所有本地 proof mapping
 *   node tools_node/sync-figma-proof-mapping.js --list
 *
 * 選項：
 *   --frame-id <id>   Figma 檔案 ID（預設：keep.md §10 = lf8ByZq8VVBtBTBJ0IpahX）
 *   --family <id>     僅處理特定 family（過濾），否則輸出所有
 *   --config <path>   使用本地 JSON 取代 Figma API
 *   --dry-run         驗證並顯示輸出但不寫入磁碟
 *   --out <dir>       覆蓋輸出目錄（預設：artifacts/ui-qa/<familyId>/）
 *   --list            列出所有現有 proof mapping 快照
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.join(PROJECT_ROOT, 'artifacts', 'ui-qa');
const PROOF_DIR = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec', 'proof', 'screens');
const DEFAULT_FIGMA_FILE_ID = 'lf8ByZq8VVBtBTBJ0IpahX';

// keep.md §12 Proof Mapping Contract 必填欄位
const REQUIRED_FIELDS = [
    'familyId',
    'template',
    'uiId',
    'bundle',
    'atlasPolicy',
    'titleKey',
    'bodyKey',
    'primaryKey',
    'secondaryKey',
    'tabs',
    'railItems',
    'proofVersion',
    'figmaFrame',
    'wireframeRef',
    'slotMapRef',
    'notes',
];

// 解析 CLI 參數
function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        frameId: DEFAULT_FIGMA_FILE_ID,
        family: null,
        config: null,
        dryRun: false,
        out: null,
        list: false,
        proofContract: false,   // --proof-contract: 同時輸出 proof-contract-v1 JSON
        screenId: null,         // --screen-id: 指定 proof contract 的 screenId（預設從 uiId 欄位讀取）
    };
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--frame-id': opts.frameId = args[++i]; break;
            case '--family': opts.family = args[++i]; break;
            case '--config': opts.config = args[++i]; break;
            case '--out': opts.out = args[++i]; break;
            case '--dry-run': opts.dryRun = true; break;
            case '--list': opts.list = true; break;
            case '--proof-contract': opts.proofContract = true; break;
            case '--screen-id': opts.screenId = args[++i]; break;
            case '--help': case '-h': printHelp(); process.exit(0);
        }
    }
    return opts;
}

function printHelp() {
    console.log([
        '',
        '使用方式：',
        '  node tools_node/sync-figma-proof-mapping.js [options]',
        '',
        '選項：',
        '  --frame-id <id>       Figma 檔案 ID（預設 lf8ByZq8VVBtBTBJ0IpahX）',
        '  --family <id>         僅處理特定 family',
        '  --config <path>       使用本地 JSON（不呼叫 Figma API）',
        '  --dry-run             僅驗證，不寫入檔案',
        '  --out <dir>           覆蓋輸出目錄',
        '  --list                列出所有本地 proof mapping 快照',
        '  --proof-contract      同時輸出 proof-contract-v1 JSON 至 ui-spec/proof/screens/',
        '  --screen-id <id>      指定 proof contract screenId（預設從 mapping.uiId 讀取）',
        '',
        '環境變數：',
        '  FIGMA_TOKEN           Figma Personal Access Token（呼叫 Figma API 時必要）',
        '',
        '範例（生成 proof contract 草稿）：',
        '  node tools_node/sync-figma-proof-mapping.js \\',
        '    --config artifacts/ui-qa/UI-2-0073/proof-mapping-template.dialog-card.json \\',
        '    --proof-contract --dry-run',
        '',
    ].join('\n'));
}

/**
 * 從 proof mapping 生成 proof-contract-v1 草稿 JSON。
 * 只生成結構骨架，Agent2 需補齊 visualZones bounds 與 componentIntents 細節。
 *
 * @param {object} mapping - 已驗證的 proof mapping 物件
 * @param {string} screenId - UIScreenSpec.uiId
 * @returns {object} proof contract 草稿
 */
function generateProofContractDraft(mapping, screenId) {
    const today = todayStr();
    const family = mapping.family || 'dark-metal';

    // 以 mapping 中已知欄位推算預設 zone 與 slots
    const defaultZones = [
        {
            id: 'main-panel',
            label: '主要面板',
            family: family,
            frameRecipeRef: `${family}-v1`,
            notes: '（草稿：請依參考圖補齊 bounds 與細節）',
        },
    ];

    // 從 mapping 的 tab / railItems 推算額外 zone
    if (mapping.tabs) {
        defaultZones.push({
            id: 'tab-bar',
            label: 'Tab 切換列',
            family: 'tab',
            notes: `tabs: ${mapping.tabs}`,
        });
    }
    if (mapping.railItems) {
        defaultZones.push({
            id: 'item-rail',
            label: '項目 Rail',
            family: family,
            notes: `railItems: ${mapping.railItems}`,
        });
    }

    // 基本 contentSlots（從 mapping 相關 key 推算）
    const contentSlots = [];
    if (mapping.titleKey)   contentSlots.push({ id: 'title',    type: 'label',  placeholder: mapping.titleKey });
    if (mapping.bodyKey)    contentSlots.push({ id: 'body',     type: 'label',  placeholder: mapping.bodyKey  });
    if (mapping.primaryKey) contentSlots.push({ id: 'primary',  type: 'button', placeholder: mapping.primaryKey, family: 'gold-cta' });
    if (mapping.secondaryKey) contentSlots.push({ id: 'secondary', type: 'button', placeholder: mapping.secondaryKey, optional: true });
    if (mapping.tabs)       contentSlots.push({ id: 'selectedTab', type: 'enum', placeholder: '當前 Tab' });
    if (mapping.railItems)  contentSlots.push({ id: 'items', type: 'list', placeholder: 'Rail 清單', minCount: 0, maxCount: 20 });

    return {
        $schema: '../proof-contract.schema.json',
        version: '1.0',
        screenId,
        proofSource: mapping.wireframeRef ? `ref://${mapping.wireframeRef}` : `ref://docs/UI品質參考圖/${screenId.toLowerCase()}.png`,
        capturedAt: today,
        capturedBy: 'sync-figma-proof-mapping',
        confidence: 0.5, // 草稿初始值；Agent2 填完後手動調高
        _draft: true,    // 草稿旗標，提醒 Agent2 補齊後移除

        visualZones: defaultZones,
        componentIntents: [
            {
                zone: 'main-panel',
                nodeHint: 'panel',
                notes: '（草稿：請補齊 skinSlot 與 bind）',
            },
        ],
        spacingRecipe: {
            containerPadding: 24,
            itemSpacing: 16,
            sectionGap: 32,
            unitBasis: 8,
        },
        contentSlots: contentSlots.length > 0 ? contentSlots : [
            { id: 'placeholder', type: 'label', placeholder: '（草稿：請補齊）' },
        ],
    };
}

/**
 * 將 proof contract 草稿寫出至 ui-spec/proof/screens/{screenId}.proof.json
 */
function writeProofContract(draft, screenId, dryRun) {
    const outputPath = path.join(PROOF_DIR, `${screenId}.proof.json`);
    const content = JSON.stringify(draft, null, 2) + '\n';
    if (dryRun) {
        console.log(`[proof-contract/dry-run] 輸出路徑：${path.relative(PROJECT_ROOT, outputPath)}`);
        console.log('[proof-contract/dry-run] 草稿預覽（前 20 行）：');
        content.split('\n').slice(0, 20).forEach((l) => console.log(l));
    } else {
        if (!fs.existsSync(PROOF_DIR)) fs.mkdirSync(PROOF_DIR, { recursive: true });
        if (fs.existsSync(outputPath)) {
            console.warn(`[proof-contract] 警告：${path.relative(PROJECT_ROOT, outputPath)} 已存在，略過（不覆蓋既有手填 proof contract）`);
            return;
        }
        fs.writeFileSync(outputPath, content, 'utf8');
        console.log(`[proof-contract] 已寫入草稿：${path.relative(PROJECT_ROOT, outputPath)}`);
    }
}

// 驗證 proof mapping 物件是否符合 §12 Contract
function validateMapping(mapping, source) {
    const errors = [];
    const warnings = [];

    for (const field of REQUIRED_FIELDS) {
        const value = mapping[field];
        if (value === undefined || value === null) {
            // tabs/railItems/primaryKey/secondaryKey 可選
            if (['tabs', 'railItems', 'primaryKey', 'secondaryKey'].includes(field)) {
                warnings.push(`[warn] ${source} - 欄位 "${field}" 未設定（可選）`);
            } else {
                errors.push(`[error] ${source} - 必填欄位 "${field}" 缺失`);
            }
        }
    }

    return { errors, warnings };
}

// 格式化今日日期 YYYY-MM-DD
function todayStr() {
    return new Date().toISOString().split('T')[0];
}

// 決定輸出路徑
function resolveOutputPath(mapping, outDir) {
    const baseDir = outDir || path.join(ARTIFACTS_DIR, mapping.familyId);
    const filename = `proof-mapping-${todayStr()}.json`;
    return path.join(baseDir, filename);
}

// 寫出 proof mapping 快照
function writeProofMapping(mapping, outputPath, dryRun) {
    const output = Object.assign({ _synced: new Date().toISOString() }, mapping);
    const content = JSON.stringify(output, null, 2) + '\n';

    if (dryRun) {
        console.log(`[dry-run] 輸出路徑：${path.relative(PROJECT_ROOT, outputPath)}`);
        console.log('[dry-run] 內容預覽：');
        console.log(content);
    } else {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(outputPath, content, 'utf8');
        console.log(`[sync] 已寫入：${path.relative(PROJECT_ROOT, outputPath)}`);
    }
}

// 從 Figma REST API 讀取 frame 資料（需要 FIGMA_TOKEN）
function fetchFigmaFrame(fileId, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.figma.com',
            path: `/v1/files/${fileId}?depth=3`,
            method: 'GET',
            headers: {
                'X-Figma-Token': token,
                'Accept': 'application/json',
            },
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Figma API 回傳 ${res.statusCode}: ${data.substring(0, 200)}`));
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Figma API JSON 解析失敗: ${e.message}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// 從 Figma frame 資料中提取 proof mapping 欄位
// 策略：尋找名稱含 "09_Proof Mapping" 的 frame，讀取其子節點 text
function extractMappingsFromFigma(figmaData, familyFilter) {
    const mappings = [];
    const document = figmaData && figmaData.document;
    if (!document) return mappings;

    function findProofFrames(node) {
        if (!node) return;
        const name = node.name || '';
        // 尋找 09_Proof Mapping frame
        if (/09_Proof Mapping/i.test(name) || /proof.?mapping/i.test(name)) {
            mappings.push(...parseProofFrame(node, familyFilter));
            return;
        }
        if (node.children) node.children.forEach(findProofFrames);
    }

    findProofFrames(document);
    return mappings;
}

// 從 proof mapping frame 中解析欄位
// 假設格式：每個子 frame 代表一個 family，內有 text node 以 "key: value" 格式
function parseProofFrame(frame, familyFilter) {
    const mappings = [];
    if (!frame.children) return mappings;

    for (const child of frame.children) {
        if (child.type !== 'FRAME' && child.type !== 'COMPONENT' && child.type !== 'GROUP') continue;
        const mapping = { _figmaNodeId: child.id, _figmaNodeName: child.name };
        // 收集所有 text 節點
        const texts = [];
        function collectTexts(n) {
            if (!n) return;
            if (n.type === 'TEXT' && n.characters) texts.push(n.characters.trim());
            if (n.children) n.children.forEach(collectTexts);
        }
        collectTexts(child);

        // 解析 "key: value" 文字
        for (const text of texts) {
            const m = text.match(/^([a-zA-Z][a-zA-Z0-9_-]+)\s*[:：]\s*(.+)$/);
            if (m) {
                const key = m[1].trim();
                const value = m[2].trim();
                if (REQUIRED_FIELDS.includes(key) || key === '_figmaFrame') {
                    mapping[key] = value;
                }
            }
        }

        if (!mapping.familyId) continue; // 跳過沒有 familyId 的 frame
        if (familyFilter && mapping.familyId !== familyFilter) continue;
        mappings.push(mapping);
    }
    return mappings;
}

// 列出所有現有 proof mapping 快照
function listExistingMappings() {
    if (!fs.existsSync(ARTIFACTS_DIR)) {
        console.log('artifacts/ui-qa/ 目錄不存在');
        return;
    }
    const found = [];
    for (const dir of fs.readdirSync(ARTIFACTS_DIR)) {
        const dirPath = path.join(ARTIFACTS_DIR, dir);
        if (!fs.statSync(dirPath).isDirectory()) continue;
        for (const file of fs.readdirSync(dirPath)) {
            if (file.startsWith('proof-mapping-') && file.endsWith('.json')) {
                found.push(path.join(dir, file));
            }
        }
    }
    if (found.length === 0) {
        console.log('尚無 proof mapping 快照');
    } else {
        console.log(`找到 ${found.length} 個 proof mapping 快照：`);
        found.forEach((f) => console.log(`  artifacts/ui-qa/${f}`));
    }
}

async function main() {
    const opts = parseArgs();

    if (opts.list) {
        listExistingMappings();
        return;
    }

    let mappings = [];

    // 模式 1：使用本地 config 檔案
    if (opts.config) {
        const configPath = path.resolve(PROJECT_ROOT, opts.config);
        if (!fs.existsSync(configPath)) {
            console.error(`[error] 找不到 config 檔案：${opts.config}`);
            process.exit(1);
        }
        let raw;
        try {
            raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error(`[error] JSON 解析失敗：${e.message}`);
            process.exit(1);
        }
        const entry = Array.isArray(raw) ? raw : [raw];
        mappings = entry.filter((m) => !opts.family || m.familyId === opts.family);
    }
    // 模式 2：從 Figma API 讀取
    else {
        const token = process.env.FIGMA_TOKEN;
        if (!token) {
            console.error([
                '[error] 未設定 FIGMA_TOKEN 環境變數，無法呼叫 Figma API。',
                '',
                '請設定後重試：',
                '  $env:FIGMA_TOKEN="your_token_here"',
                '  node tools_node/sync-figma-proof-mapping.js --frame-id ' + opts.frameId,
                '',
                '或使用本地 config：',
                '  node tools_node/sync-figma-proof-mapping.js --config <path>',
                '',
                '可用的現有 config 範本 (--list 查看所有)：',
                '  artifacts/ui-qa/UI-2-0073/proof-mapping-template.dialog-card.json',
                '  artifacts/ui-qa/UI-2-0073/proof-mapping-template.rail-list.json',
                '  artifacts/ui-qa/UI-2-0073/proof-mapping-template.detail-split.json',
            ].join('\n'));
            process.exit(1);
        }

        console.log(`[sync] 正在從 Figma 讀取 frame：${opts.frameId} ...`);
        let figmaData;
        try {
            figmaData = await fetchFigmaFrame(opts.frameId, token);
        } catch (e) {
            console.error(`[error] Figma API 呼叫失敗：${e.message}`);
            process.exit(1);
        }

        mappings = extractMappingsFromFigma(figmaData, opts.family);
        if (mappings.length === 0) {
            console.warn('[warn] 在 Figma frame 中未找到 09_Proof Mapping 資料');
            console.warn('[hint] 請確認 Figma frame 名稱含有 "09_Proof Mapping"，並且子項目有 "familyId: xxx" 文字'); 
        }
    }

    if (mappings.length === 0) {
        console.log('[sync] 無資料可處理。');
        return;
    }

    // 驗證並輸出
    let hasErrors = false;
    for (const mapping of mappings) {
        const source = mapping.familyId || '(unknown)';
        console.log(`\n[sync] 處理 family：${source}`);

        const { errors, warnings } = validateMapping(mapping, source);
        for (const w of warnings) console.warn(w);
        for (const e of errors) { console.error(e); hasErrors = true; }

        if (errors.length > 0 && !opts.dryRun) {
            console.error(`[error] ${source} 驗證失敗，略過寫入`);
            continue;
        }

        const outputPath = resolveOutputPath(mapping, opts.out ? path.resolve(PROJECT_ROOT, opts.out) : null);
        writeProofMapping(mapping, outputPath, opts.dryRun);

        // --proof-contract: 額外輸出 proof-contract-v1 草稿
        if (opts.proofContract) {
            const screenId = opts.screenId || mapping.uiId || mapping.familyId;
            if (!screenId) {
                console.warn(`[proof-contract] 無法決定 screenId for "${source}"，略過（請補 --screen-id 或 mapping.uiId）`);
            } else {
                const draft = generateProofContractDraft(mapping, screenId);
                writeProofContract(draft, screenId, opts.dryRun);
            }
        }
    }

    if (hasErrors) {
        console.error('\n共有欄位驗證錯誤，請修正後重試。');
        process.exit(1);
    }

    console.log(`\n[sync] 完成。處理了 ${mappings.length} 個 proof mapping${opts.dryRun ? '（dry-run）' : ''}。`);
}

main().catch((e) => {
    console.error('[fatal]', e.message);
    process.exit(1);
});
