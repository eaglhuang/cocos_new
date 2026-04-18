#!/usr/bin/env node
/**
 * run-vfx-browser-qa.js
 *
 * Browser Review 自動驗收：
 * 1) 單積木 (scope=blocks)
 * 2) 積木組合 (scope=combos)
 *
 * 輸出：
 * artifacts/vfx-qa/<runId>/
 *   - report.json
 *   - summary.md
 *   - screenshots/<case>.png
 *
 * Unity 對照：
 * - 這支工具相當於在 Unity Editor PlayMode 裡跑一輪 VFX smoke/regression 測試，
 *   並把結果導出成可追蹤報告。
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execSync } = require('child_process');

let puppeteer;
try {
    // eslint-disable-next-line global-require
    puppeteer = require('puppeteer-core');
} catch (error) {
    console.error('[run-vfx-browser-qa] 缺少依賴 puppeteer-core，請先安裝後再執行。');
    process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const FALLBACK_CATEGORIES = [
    'glow',
    'fire',
    'lightning',
    'trails',
    'impact',
    'smoke',
    'projectile',
    'status',
    'shapes',
    'rings',
    'particle3d',
    'shaderfx',
];

// Procedural shader blocks currently live in VfxComposerTool (not vfx-block-registry),
// so Browser QA keeps a minimal fallback list to include them in smoke runs.
const PROCEDURAL_BLOCK_FALLBACKS = [
    {
        id: 'shader_water_ripple',
        label: 'Water Ripple',
        category: 'shaderfx',
        texPath: 'shaders/tex_shader_line',
        blendMode: 'transparent',
        audio: 'wave',
        scale: 2.2,
        renderMode: 'auto',
        space: 'both',
    },
];

function parseArg(name, fallback = '') {
    const key = `--${name}`;
    const index = process.argv.indexOf(key);
    if (index < 0 || index + 1 >= process.argv.length) {
        return fallback;
    }
    return process.argv[index + 1];
}

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

function parseBooleanArg(name, fallback) {
    const raw = parseArg(name, '');
    if (!raw) return fallback;
    const normalized = String(raw).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    return fallback;
}

function parseNumberArg(name, fallback) {
    const raw = parseArg(name, '');
    if (!raw) return fallback;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(task, timeoutMs, label) {
    return Promise.race([
        task,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`TimeoutError: ${label} exceeded ${timeoutMs}ms`)), timeoutMs);
        }),
    ]);
}

function requestUrl(url) {
    const client = url.startsWith('https:') ? https : http;
    return new Promise((resolve, reject) => {
        const req = client.get(url, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                resolve({
                    statusCode: response.statusCode || 0,
                    body: Buffer.concat(chunks).toString('utf8'),
                });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function triggerEditorRefresh(baseUrl) {
    const refreshUrl = new URL('/asset-db/refresh', baseUrl).toString();
    const response = await requestUrl(refreshUrl);
    if (response.statusCode >= 400) {
        throw new Error(`asset-db refresh failed (${response.statusCode}): ${response.body.slice(0, 200)}`);
    }
    return response.body;
}

function resolveLoadingSceneUuid() {
    const metaPath = path.join(ROOT, 'assets', 'scenes', 'LoadingScene.scene.meta');
    if (!fs.existsSync(metaPath)) return '';

    try {
        const raw = fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, '');
        const meta = JSON.parse(raw);
        return typeof meta.uuid === 'string' ? meta.uuid : '';
    } catch (error) {
        console.warn('[run-vfx-browser-qa] 無法讀取 LoadingScene.scene.meta uuid:', error);
        return '';
    }
}

function resolveBrowserExecutable(customPath) {
    if (customPath && fs.existsSync(customPath)) {
        return customPath;
    }

    const candidates = [];
    if (process.platform === 'win32') {
        candidates.push(
            'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
            'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        );
    } else if (process.platform === 'darwin') {
        candidates.push(
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        );
    } else {
        candidates.push('/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium-browser');
    }

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return '';
}

function ensureTsRuntime() {
    if (global.__VFX_BROWSER_QA_TS_READY__) return;
    process.env.TS_NODE_PROJECT = path.join(ROOT, 'tsconfig.test.json');
    // eslint-disable-next-line global-require
    require('ts-node/register/transpile-only');
    // eslint-disable-next-line global-require
    require('tsconfig-paths/register');
    global.__VFX_BROWSER_QA_TS_READY__ = true;
}

function loadVfxBlockDefs() {
    ensureTsRuntime();
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(path.join(ROOT, 'assets/scripts/tools/vfx-block-registry'));
    const list = Array.isArray(mod?.VFX_BLOCK_REGISTRY) ? mod.VFX_BLOCK_REGISTRY : [];
    const mapped = list.map((item) => ({
        id: String(item.id),
        label: String(item.label || item.id),
        category: String(item.category || ''),
        texPath: typeof item.texPath === 'string' ? item.texPath : '',
        blendMode: item.blendMode === 'transparent' ? 'transparent' : 'additive',
        audio: typeof item.audio === 'string' ? item.audio : undefined,
        scale: typeof item.scale === 'number' ? item.scale : 1,
        renderMode: ['cpu', 'gpu', 'auto'].includes(item.renderMode) ? item.renderMode : 'auto',
        space: ['2d', '3d', 'both'].includes(item.space) ? item.space : '3d',
        prefabPath: typeof item.prefabPath === 'string' ? item.prefabPath : undefined,
    }));

    const existingIds = new Set(mapped.map((item) => item.id));
    for (const fallback of PROCEDURAL_BLOCK_FALLBACKS) {
        if (!existingIds.has(fallback.id)) {
            mapped.push({ ...fallback });
        }
    }
    return mapped;
}

function normalizeBlocksField(blocks) {
    if (!Array.isArray(blocks)) return [];
    const ids = [];
    for (const entry of blocks) {
        if (typeof entry === 'string' && entry.trim()) {
            ids.push(entry.trim());
            continue;
        }
        if (entry && typeof entry === 'object' && typeof entry.blockId === 'string' && entry.blockId.trim()) {
            ids.push(entry.blockId.trim());
        }
    }
    return ids;
}

function loadVfxCombos() {
    const filePath = path.join(ROOT, 'assets', 'resources', 'data', 'vfx-effects.json');
    if (!fs.existsSync(filePath)) {
        return [];
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const effects = raw && typeof raw === 'object' ? raw.effects : null;
    if (!effects || typeof effects !== 'object') {
        return [];
    }

    const result = [];
    for (const [effectId, def] of Object.entries(effects)) {
        if (!def || typeof def !== 'object') continue;
        const blockIds = normalizeBlocksField(def.blocks);
        if (blockIds.length === 0 && typeof def.blockId === 'string' && def.blockId.trim()) {
            blockIds.push(def.blockId.trim());
        }
        if (blockIds.length === 0) continue;
        result.push({
            caseId: String(effectId),
            kind: 'combo',
            label: String(effectId),
            blockIds,
        });
    }
    return result;
}

function buildCases(scope, caseFilter, limit) {
    const blockDefs = loadVfxBlockDefs();
    const blockMap = new Map(blockDefs.map((item) => [item.id, item]));

    const buckets = [];
    if (scope === 'blocks' || scope === 'all') {
        buckets.push(...blockDefs.map((item) => ({
            caseId: item.id,
            kind: 'block',
            label: item.label,
            blockIds: [item.id],
            blockDefs: [item],
        })));
    }
    if (scope === 'combos' || scope === 'all') {
        const combos = loadVfxCombos().map((item) => ({
            ...item,
            blockDefs: item.blockIds
                .map((blockId) => blockMap.get(blockId))
                .filter(Boolean),
        }));
        buckets.push(...combos);
    }

    const filtered = caseFilter.size > 0
        ? buckets.filter((item) => caseFilter.has(item.caseId))
        : buckets;
    const deduped = [];
    const seen = new Set();
    for (const item of filtered) {
        const key = `${item.kind}:${item.caseId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
    }

    if (limit > 0) {
        return deduped.slice(0, limit);
    }
    return deduped;
}

async function waitForCaptureReady(page, timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        let snapshot;
        try {
            snapshot = await page.evaluate(() => {
                const state = window.__UI_CAPTURE_STATE__ || null;
                const bodyText = document.body ? document.body.innerText : '';
                return { state, bodyText };
            });
        } catch (error) {
            const text = String(error);
            if (text.includes('Execution context was destroyed') || text.includes('Cannot find context with specified id')) {
                await delay(500);
                continue;
            }
            throw error;
        }

        const state = snapshot?.state || null;
        const bodyText = snapshot?.bodyText || '';

        if (state?.status === 'error') {
            throw new Error(`UI capture state error: ${state.error || 'unknown'}`);
        }
        if (bodyText.includes('Unable to resolve bare specifier')) {
            throw new Error(`Preview compile failed: ${bodyText.slice(0, 240)}`);
        }
        if (state?.status === 'ready' && state.screenId === 'battle-scene') {
            return state;
        }
        await delay(400);
    }

    throw new Error(`TimeoutError: Waiting capture ready exceeded ${timeoutMs}ms`);
}

async function resolveCanvasClip(page, viewport) {
    const toolbarHeight = await page.evaluate(() => {
        const canvasEl = document.querySelector('canvas') || document.querySelector('#GameDiv');
        if (!canvasEl) return 30;
        const rect = canvasEl.getBoundingClientRect();
        return Math.max(0, Math.round(rect.top));
    });
    if (!toolbarHeight || toolbarHeight <= 0) return null;
    return {
        x: 0,
        y: toolbarHeight,
        width: viewport.width,
        height: viewport.height - toolbarHeight,
    };
}

function sanitizeFileName(name) {
    return String(name || 'case')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 120);
}

function extractRelevantConsole(events) {
    return events
        .map((event) => ({
            type: event.type,
            text: String(event.text || '').trim(),
        }))
        .filter((event) => /VfxComposerTool|EffectSystem|VFX|Particle|Prefab|PoolSystem|BuffGainEffectPool|battle-scene/i.test(event.text));
}

function collectFatalHits(texts) {
    const fatalPattern = /(載入失敗|播放失敗|未在 PoolSystem 中註冊|無法預覽|not found|exception|failed|error|TimeoutError)/i;
    return texts.filter((text) => fatalPattern.test(text));
}

function buildCaseVerdict(caseInfo, playResult, warnings, errors) {
    const failReasons = [];
    const warnReasons = [];
    const caseBlockDefs = Array.isArray(caseInfo?.blockDefs) ? caseInfo.blockDefs : [];
    const shaderLikeCase = caseBlockDefs.some((def) => {
        const id = String(def?.id || '');
        const category = String(def?.category || '');
        return category === 'shaderfx' || id.startsWith('shader_');
    });

    if (!playResult.composerFound) {
        failReasons.push('VfxComposerTool not found');
    }
    if (Array.isArray(playResult.missingBlocks) && playResult.missingBlocks.length > 0) {
        failReasons.push(`missing blocks: ${playResult.missingBlocks.join(', ')}`);
    }
    if (!playResult.played) {
        failReasons.push('played=false');
    }
    if (shaderLikeCase && (playResult.entryCount || 0) <= 0) {
        failReasons.push('entryCount=0 for shaderfx case');
    }
    if (!shaderLikeCase && (playResult.psCount || 0) === 0 && (playResult.animCount || 0) === 0) {
        failReasons.push('ParticleSystem=0 and Animation=0');
    }
    if (playResult.exception) {
        failReasons.push(`exception: ${String(playResult.exception)}`);
    }

    const allTexts = [
        ...errors.map((item) => item.text),
        ...warnings.map((item) => item.text),
        String(playResult.statusText || ''),
        String(playResult.exception || ''),
    ].filter(Boolean);
    const fatalHits = collectFatalHits(allTexts);
    if (fatalHits.length > 0) {
        failReasons.push(...fatalHits.map((hit) => `fatal-log: ${hit}`));
    }

    const hasFallback = warnings.some((item) => /改用動畫 Quad 預覽|改用 Quad 預覽|fallback/i.test(item.text));
    if (hasFallback) {
        warnReasons.push('fallback path triggered');
    }
    if (warnings.length > 0) {
        warnReasons.push(`warnings=${warnings.length}`);
    }

    const status = failReasons.length > 0
        ? 'fail'
        : (warnReasons.length > 0 ? 'warn' : 'pass');

    return {
        caseId: caseInfo.caseId,
        kind: caseInfo.kind,
        blockIds: caseInfo.blockIds,
        status,
        played: Boolean(playResult.played),
        composerFound: Boolean(playResult.composerFound),
        entryCount: playResult.entryCount || 0,
        psCount: playResult.psCount || 0,
        animCount: playResult.animCount || 0,
        resolvedBlockIds: Array.isArray(playResult.resolvedBlockIds) ? playResult.resolvedBlockIds : [],
        missingBlocks: Array.isArray(playResult.missingBlocks) ? playResult.missingBlocks : [],
        statusText: String(playResult.statusText || ''),
        errors: errors.map((item) => item.text),
        warnings: warnings.map((item) => item.text),
        failReasons,
        warnReasons,
        exception: playResult.exception ? String(playResult.exception) : undefined,
    };
}

function buildSummaryMarkdown(report, reportPath) {
    const lines = [];
    lines.push(`# VFX Browser QA Summary`);
    lines.push('');
    lines.push(`- runId: \`${report.runId}\``);
    lines.push(`- scope: \`${report.scope}\``);
    lines.push(`- host: \`${report.host}\``);
    lines.push(`- createdAt: \`${report.createdAt}\``);
    lines.push(`- report: \`${reportPath.replace(/\\/g, '/')}\``);
    lines.push('');
    lines.push(`## 統計`);
    lines.push('');
    lines.push(`| 指標 | 數量 |`);
    lines.push(`|---|---:|`);
    lines.push(`| total | ${report.counts.total} |`);
    lines.push(`| pass | ${report.counts.pass} |`);
    lines.push(`| warn | ${report.counts.warn} |`);
    lines.push(`| fail | ${report.counts.fail} |`);
    lines.push('');

    const failed = report.cases.filter((item) => item.status === 'fail');
    lines.push(`## Fail Cases`);
    lines.push('');
    if (failed.length === 0) {
        lines.push(`- 無`);
    } else {
        for (const item of failed) {
            lines.push(`- \`${item.caseId}\`: ${item.failReasons.join(' | ')}`);
        }
    }
    lines.push('');

    const warns = report.cases.filter((item) => item.status === 'warn');
    lines.push(`## Warn Cases`);
    lines.push('');
    if (warns.length === 0) {
        lines.push(`- 無`);
    } else {
        for (const item of warns) {
            lines.push(`- \`${item.caseId}\`: ${item.warnReasons.join(' | ')}`);
        }
    }
    lines.push('');

    return lines.join('\n') + '\n';
}

function printHelp() {
    console.log(`
Usage:
  node tools_node/run-vfx-browser-qa.js [options]

Options:
  --scope <blocks|combos|all>   驗收範圍（預設 all）
  --case <id1,id2,...>          只跑指定 caseId
  --limit <N>                   限制執行筆數
  --runId <id>                  報告 run id（預設以時間戳生成）
  --outDir <path>               輸出目錄（預設 artifacts/vfx-qa/<runId>）
  --url <http://localhost:7456> Browser Review host
  --browser <path>              指定 Edge/Chrome executable
  --timeout <ms>                單次頁面/就緒等待上限（預設 70000）
  --settleMs <ms>               每個 case 播放後等待時間（預設 220）
  --composerReadyTimeout <ms>   等待 VfxComposerTool UI 就緒上限（預設 20000）
  --refreshBefore <true|false>  開始前是否 refresh asset-db（預設 true）
  --sceneUuid <uuid>            覆寫 scene query 參數
  --headless <true|false>       是否 headless（預設 true）
  --dryRun <true|false>         只列出 cases，不啟動瀏覽器
  --help                        顯示說明

Examples:
  node tools_node/run-vfx-browser-qa.js --scope blocks --runId VFX-QA-2026-04-16
  node tools_node/run-vfx-browser-qa.js --scope combos --case skill_zhang_fei,skill_lu_bu
  node tools_node/run-vfx-browser-qa.js --scope all --limit 20 --dryRun true
`.trim());
}

async function runCase(page, caseInfo, settleMs, composerReadyTimeoutMs) {
    return page.evaluate(async (payload) => {
        const result = {
            caseId: payload.caseId,
            composerFound: false,
            played: false,
            entryCount: 0,
            psCount: 0,
            animCount: 0,
            resolvedBlockIds: [],
            missingBlocks: [],
            statusText: '',
            exception: '',
        };

        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        try {
            const gameWin = document.querySelector('iframe')?.contentWindow || window;
            const cc = gameWin?.cc;
            if (!cc || !cc.director) {
                result.exception = 'cc.director not available';
                return result;
            }

            const scene = cc.director.getScene();
            if (!scene) {
                result.exception = 'scene not found';
                return result;
            }

            const composerCandidates = [];
            const collectVfxComposer = (node) => {
                if (!node) return;
                const comps = Array.isArray(node.components) ? node.components : (node._components || []);
                for (const comp of comps) {
                    if (comp?.constructor?.name === 'VfxComposerTool') {
                        composerCandidates.push({ comp, node });
                    }
                }
                const children = Array.isArray(node.children) ? node.children : [];
                for (const child of children) {
                    collectVfxComposer(child);
                }
            };
            collectVfxComposer(scene);

            if (composerCandidates.length === 0) {
                result.exception = 'VfxComposerTool not found';
                return result;
            }

            const pickBy = (predicate) => composerCandidates.find((item) => {
                try {
                    return predicate(item);
                } catch (_error) {
                    return false;
                }
            });
            const picked = pickBy((item) => item.node?.activeInHierarchy && item.comp?.worldPreviewRoot)
                || pickBy((item) => item.node?.activeInHierarchy)
                || composerCandidates[0];
            const tool = picked.comp;
            result.composerFound = true;

            const timeoutAt = Date.now() + payload.composerReadyTimeoutMs;
            let triedBuildUi = false;
            let triedOnLoad = false;
            while (!tool.worldPreviewRoot && Date.now() < timeoutAt) {
                if (!triedOnLoad && typeof tool.onLoad === 'function') {
                    try {
                        tool.onLoad();
                    } catch (_error) {
                        // ignore and continue waiting
                    }
                    triedOnLoad = true;
                }
                if (!triedBuildUi && typeof tool.buildUI === 'function') {
                    try {
                        tool.buildUI();
                    } catch (_error) {
                        // ignore and continue waiting
                    }
                    triedBuildUi = true;
                }
                await sleep(100);
            }
            if (!tool.worldPreviewRoot) {
                result.exception = 'VfxComposerTool not ready (worldPreviewRoot missing)';
                return result;
            }

            tool.autoPreviewOnSelect = false;
            if (typeof tool.clearPreview === 'function') tool.clearPreview();
            if (typeof tool.clearComposition === 'function') tool.clearComposition();

            const resolvedBlocks = [];
            const blockDefMap = new Map(
                (Array.isArray(payload.blockDefs) ? payload.blockDefs : [])
                    .filter((item) => item && typeof item.id === 'string')
                    .map((item) => [item.id, item]),
            );

            for (const id of payload.blockIds) {
                const block = blockDefMap.get(id);
                if (!block) {
                    result.missingBlocks.push(id);
                    continue;
                }
                result.resolvedBlockIds.push(block.id);
                resolvedBlocks.push(block);
            }

            if (resolvedBlocks.length === 0 && tool.blockListContainer) {
                const categories = Array.isArray(tool.tabNodes) && tool.tabNodes.length > 0
                    ? tool.tabNodes.map((item) => item.id).filter(Boolean)
                    : payload.categories;

                for (const id of payload.blockIds) {
                    for (const cat of categories) {
                        try {
                            if (typeof tool.selectCategory === 'function') {
                                tool.selectCategory(cat);
                            }
                            const blocks = Array.isArray(tool.filteredBlocks) ? tool.filteredBlocks : [];
                            const found = blocks.find((block) => block?.id === id);
                            if (found) {
                                result.resolvedBlockIds.push(found.id);
                                resolvedBlocks.push(found);
                                break;
                            }
                        } catch (_error) {
                            // ignore and continue
                        }
                    }
                }
            }

            if (resolvedBlocks.length === 0) {
                result.exception = 'no resolved blocks';
                return result;
            }

            // combos 用 Particle 模式，讓 prefab 與動態 quad 都能走同一條播放路徑。
            if (payload.kind === 'combo') {
                tool.currentPreviewMode = 1;
            }

            const hasUiPanel = Boolean(tool.blockListContainer && tool.selectedPreviewSprite && tool.compLabel);
            if ((payload.kind === 'block' || resolvedBlocks.length === 1) && hasUiPanel) {
                if (typeof tool.selectBlock === 'function') {
                    tool.selectBlock(resolvedBlocks[0]);
                } else {
                    tool.composition = [resolvedBlocks[0]];
                }
            } else {
                tool.composition = resolvedBlocks;
                tool.selectedBlockId = resolvedBlocks[0].id;
                if (typeof tool.refreshCompLabel === 'function') {
                    tool.refreshCompLabel();
                }
                if (typeof tool.refreshSelectedBlockPanel === 'function') {
                    tool.refreshSelectedBlockPanel(resolvedBlocks[0]);
                }
            }

            if (typeof tool.fireComposition !== 'function') {
                result.exception = 'fireComposition() not found';
                return result;
            }

            await tool.fireComposition();
            await sleep(payload.settleMs);

            const entries = Array.isArray(tool.previewEntries) ? tool.previewEntries : [];
            result.entryCount = entries.length;
            result.played = entries.length > 0;

            for (const entry of entries) {
                const node = entry?.node;
                if (!node || !node.isValid) continue;
                const ps = node.getComponentsInChildren ? node.getComponentsInChildren(cc.ParticleSystem) : [];
                const anims = node.getComponentsInChildren ? node.getComponentsInChildren(cc.Animation) : [];
                result.psCount += Array.isArray(ps) ? ps.length : 0;
                result.animCount += Array.isArray(anims) ? anims.length : 0;
            }

            result.statusText = String(tool.statusLabel?.string || '');
            return result;
        } catch (error) {
            result.exception = String(error?.stack || error);
            return result;
        }
    }, {
        caseId: caseInfo.caseId,
        kind: caseInfo.kind,
        blockIds: caseInfo.blockIds,
        blockDefs: caseInfo.blockDefs || [],
        settleMs,
        composerReadyTimeoutMs,
        categories: FALLBACK_CATEGORIES,
    });
}

async function main() {
    if (hasFlag('help')) {
        printHelp();
        return;
    }

    const scopeRaw = parseArg('scope', 'all').trim().toLowerCase();
    const scope = ['blocks', 'combos', 'all'].includes(scopeRaw) ? scopeRaw : 'all';
    const caseFilter = new Set(
        parseArg('case', '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
    );
    const limit = parseNumberArg('limit', 0);
    const timeoutMs = parseNumberArg('timeout', 70000);
    const settleMs = parseNumberArg('settleMs', 220);
    const composerReadyTimeoutMs = parseNumberArg('composerReadyTimeout', 20000);
    const refreshBefore = parseBooleanArg('refreshBefore', true);
    const headless = parseBooleanArg('headless', true);
    const baseUrl = parseArg('url', 'http://localhost:7456');
    const browserArg = parseArg('browser', '');
    const dryRun = parseBooleanArg('dryRun', false);
    const runId = parseArg('runId', `VFX-QA-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
    const outDir = parseArg('outDir', path.join('artifacts', 'vfx-qa', runId));
    const outputRoot = path.resolve(ROOT, outDir);
    const screenshotDir = path.join(outputRoot, 'screenshots');
    const sceneUuid = parseArg('sceneUuid', resolveLoadingSceneUuid());

    const cases = buildCases(scope, caseFilter, limit);
    if (cases.length === 0) {
        console.error('[run-vfx-browser-qa] 沒有可執行案例（請檢查 --scope / --case / 資料來源）。');
        process.exit(2);
    }

    console.log('='.repeat(72));
    console.log('[run-vfx-browser-qa] Config');
    console.log(`- scope: ${scope}`);
    console.log(`- cases: ${cases.length}`);
    console.log(`- runId: ${runId}`);
    console.log(`- outDir: ${outputRoot}`);
    console.log(`- host: ${baseUrl}`);
    console.log(`- sceneUuid: ${sceneUuid || '(none)'}`);
    console.log(`- dryRun: ${dryRun}`);
    console.log('='.repeat(72));

    if (dryRun) {
        cases.forEach((item, index) => {
            console.log(`${index + 1}. [${item.kind}] ${item.caseId} -> ${item.blockIds.join(', ')}`);
        });
        return;
    }

    const browserExecutable = resolveBrowserExecutable(browserArg);
    if (!browserExecutable) {
        throw new Error('找不到可用瀏覽器，請用 --browser 指定 executable path。');
    }

    fs.mkdirSync(screenshotDir, { recursive: true });

    if (refreshBefore) {
        console.log('[run-vfx-browser-qa] refreshing asset-db...');
        await triggerEditorRefresh(baseUrl);
        await delay(1200);
    }

    const browser = await puppeteer.launch({
        executablePath: browserExecutable,
        headless,
        defaultViewport: { width: 1920, height: 1080 },
        args: [
            '--disable-gpu',
            '--disable-http-cache',
            '--no-sandbox',
            '--disable-dev-shm-usage',
        ],
    });

    const page = await browser.newPage();
    const consoleEvents = [];
    const pageErrorEvents = [];
    const requestFailureEvents = [];

    page.on('console', (message) => {
        const type = message.type();
        if (type !== 'warning' && type !== 'warn' && type !== 'error') return;
        consoleEvents.push({
            type,
            text: message.text(),
            ts: Date.now(),
        });
    });
    page.on('pageerror', (error) => {
        pageErrorEvents.push({
            text: String(error),
            ts: Date.now(),
        });
    });
    page.on('requestfailed', (request) => {
        requestFailureEvents.push({
            text: `${request.method()} ${request.url()} => ${request.failure()?.errorText || 'unknown'}`,
            ts: Date.now(),
        });
    });

    const results = [];
    try {
        await page.setCacheEnabled(false);
        await page.setExtraHTTPHeaders({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });

        await page.evaluateOnNewDocument((targetIndex) => {
            localStorage.setItem('PREVIEW_MODE', 'true');
            localStorage.setItem('PREVIEW_TARGET', String(targetIndex));
        }, 5);

        const query = new URLSearchParams();
        query.set('previewMode', 'true');
        query.set('previewTarget', '5');
        query.set('t', String(Date.now()));
        if (sceneUuid) {
            query.set('scene', sceneUuid);
        }
        const url = `${baseUrl}?${query.toString()}`;

        console.log(`[run-vfx-browser-qa] navigate -> ${url}`);
        await withTimeout(
            page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
            timeoutMs + 5000,
            'page.goto',
        );
        await withTimeout(waitForCaptureReady(page, timeoutMs), timeoutMs + 5000, 'waitForCaptureReady');
        await delay(200);

        const clip = await resolveCanvasClip(page, { width: 1920, height: 1080 });

        for (let i = 0; i < cases.length; i++) {
            const caseInfo = cases[i];
            console.log(`[run-vfx-browser-qa] (${i + 1}/${cases.length}) ${caseInfo.kind}:${caseInfo.caseId}`);

            const startConsole = consoleEvents.length;
            const startPageErr = pageErrorEvents.length;
            const startReqFail = requestFailureEvents.length;
            const startedAt = Date.now();

            let playResult;
            try {
                playResult = await withTimeout(
                    runCase(page, caseInfo, settleMs, composerReadyTimeoutMs),
                    timeoutMs,
                    `runCase:${caseInfo.caseId}`,
                );
            } catch (error) {
                playResult = {
                    composerFound: false,
                    played: false,
                    entryCount: 0,
                    psCount: 0,
                    animCount: 0,
                    resolvedBlockIds: [],
                    missingBlocks: [],
                    statusText: '',
                    exception: String(error?.stack || error),
                };
            }

            await delay(120);
            const rawConsole = consoleEvents.slice(startConsole);
            const rawPageErrors = pageErrorEvents.slice(startPageErr).map((item) => ({ type: 'error', text: item.text }));
            const rawRequestFailures = requestFailureEvents.slice(startReqFail).map((item) => ({ type: 'error', text: item.text }));
            const relevantConsole = extractRelevantConsole(rawConsole);
            const warnings = relevantConsole.filter((item) => item.type === 'warning' || item.type === 'warn');
            const errors = relevantConsole.filter((item) => item.type === 'error').concat(rawPageErrors, rawRequestFailures);

            const verdict = buildCaseVerdict(caseInfo, playResult, warnings, errors);
            verdict.durationMs = Date.now() - startedAt;

            const screenshotName = `${String(i + 1).padStart(3, '0')}_${sanitizeFileName(caseInfo.kind)}_${sanitizeFileName(caseInfo.caseId)}.png`;
            const screenshotPath = path.join(screenshotDir, screenshotName);
            try {
                await withTimeout(
                    page.screenshot({
                        path: screenshotPath,
                        fullPage: false,
                        ...(clip ? { clip } : {}),
                    }),
                    20000,
                    `screenshot:${caseInfo.caseId}`,
                );
                verdict.screenshot = path.relative(outputRoot, screenshotPath).replace(/\\/g, '/');
            } catch (error) {
                verdict.screenshot = '';
                verdict.warnings.push(`screenshot failed: ${String(error)}`);
                if (verdict.status === 'pass') {
                    verdict.status = 'warn';
                    verdict.warnReasons.push('screenshot capture failed');
                }
            }

            results.push(verdict);
        }
    } finally {
        await browser.close();
    }

    const counts = {
        total: results.length,
        pass: results.filter((item) => item.status === 'pass').length,
        warn: results.filter((item) => item.status === 'warn').length,
        fail: results.filter((item) => item.status === 'fail').length,
    };

    const report = {
        runId,
        scope,
        host: baseUrl,
        createdAt: new Date().toISOString(),
        counts,
        cases: results,
    };

    const reportPath = path.join(outputRoot, 'report.json');
    const summaryPath = path.join(outputRoot, 'summary.md');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    fs.writeFileSync(summaryPath, buildSummaryMarkdown(report, reportPath), 'utf8');

    console.log('='.repeat(72));
    console.log('[run-vfx-browser-qa] Done');
    console.log(`- report: ${reportPath}`);
    console.log(`- summary: ${summaryPath}`);
    console.log(`- counts: pass=${counts.pass}, warn=${counts.warn}, fail=${counts.fail}, total=${counts.total}`);
    console.log('='.repeat(72));

    if (counts.fail > 0) {
        process.exitCode = 2;
    }
}

main().catch((error) => {
    console.error('[run-vfx-browser-qa] failed:', error);
    process.exit(1);
});
