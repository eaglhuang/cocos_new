#!/usr/bin/env node
/**
 * capture-ui-screens.js
 *
 * 任務：自動化擷取 D 階段 UI 截圖（headless）。
 *
 * 用法：
 *   node tools_node/capture-ui-screens.js
 *   node tools_node/capture-ui-screens.js --target LobbyMain
 *   node tools_node/capture-ui-screens.js --target Gacha --outDir artifacts/ui-qa/UI-2-0023
 *   node tools_node/capture-ui-screens.js --browser "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const { writeRuntimeVerdictCaptureResult } = require('./lib/ui-factory-manifest-validator');

let puppeteer;
try {
    // eslint-disable-next-line global-require
    puppeteer = require('puppeteer-core');
} catch (error) {
    console.error('[capture-ui-screens] 缺少依賴 puppeteer-core，請先執行: npm i -D puppeteer-core');
    process.exit(1);
}

const targets = [
    { id: 'LobbyMain', screenId: 'lobby-main-screen', targetIndex: 1 },
    { id: 'ShopMain', screenId: 'shop-main-screen', targetIndex: 2, uiSourceDir: 'shop-main', runtimeScreenId: 'ShopMain' },
    { id: 'Gacha', screenId: 'gacha-main-screen', targetIndex: 3, uiSourceDir: 'gacha-main', runtimeScreenId: 'GachaMain' },
    { id: 'GachaHero', screenId: 'gacha-main-screen', targetIndex: 3, previewVariant: 'hero' },
    { id: 'GachaSupport', screenId: 'gacha-main-screen', targetIndex: 3, previewVariant: 'support' },
    { id: 'GachaLimited', screenId: 'gacha-main-screen', targetIndex: 3, previewVariant: 'limited' },
    { id: 'DuelChallenge', screenId: 'duel-challenge-screen', targetIndex: 4 },
    { id: 'BattleScene', screenId: 'battle-scene', targetIndex: 5, uiSourceDir: 'battle-hud', runtimeScreenId: 'BattleHUD' },
    { id: 'GeneralDetailOverview', screenId: 'general-detail-bloodline-v3-screen', targetIndex: 6, uiSourceDir: 'general-detail-overview', runtimeScreenId: 'GeneralDetailOverview' },
    { id: 'GeneralDetailBloodlineV3', screenId: 'general-detail-bloodline-v3-screen', targetIndex: 6, uiSourceDir: 'general-detail-bloodline-v3', runtimeScreenId: 'GeneralDetailBloodlineV3', hiddenAlias: true },
    { id: 'SpiritTallyDetail', screenId: 'spirit-tally-detail-screen', targetIndex: 7, uiSourceDir: 'spirit-tally-detail', runtimeScreenId: 'SpiritTallyDetail' },
];

function resolveLoadingSceneUuid() {
    const metaPath = path.join(__dirname, '..', 'assets', 'scenes', 'LoadingScene.scene.meta');
    if (!fs.existsSync(metaPath)) {
        return '';
    }

    try {
        const raw = fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, '');
        const meta = JSON.parse(raw);
        return typeof meta.uuid === 'string' ? meta.uuid : '';
    } catch (error) {
        console.warn('[capture-ui-screens] 無法讀取 LoadingScene.scene.meta uuid:', error);
        return '';
    }
}

function parseArg(name, fallback = '') {
    const index = process.argv.indexOf(`--${name}`);
    if (index < 0 || index + 1 >= process.argv.length) {
        return fallback;
    }
    return process.argv[index + 1];
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestUrl(url) {
    const client = url.startsWith('https:') ? https : http;
    return new Promise((resolve, reject) => {
        const req = client.get(url, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                resolve({
                    statusCode: response.statusCode ?? 0,
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
            'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
        );
    } else if (process.platform === 'darwin') {
        candidates.push(
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
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

function selectTargets(targetId) {
    if (!targetId) {
        return targets.filter(t => !t.hiddenAlias);
    }
    const selected = targets.find(t => t.id.toLowerCase() === targetId.toLowerCase());
    if (!selected) {
        throw new Error(`未知 target: ${targetId}，可用值: ${targets.map(t => t.id).join(', ')}`);
    }
    return [selected];
}

function createPageDiagnostics(page) {
    const diagnostics = {
        console: [],
        pageErrors: [],
        requestFailures: [],
    };

    page.on('console', async (message) => {
        let text = message.text();
        try {
            const args = await Promise.all(message.args().map(async (arg) => {
                try {
                    return await arg.jsonValue();
                } catch {
                    return undefined;
                }
            }));
            if (args.some((arg) => arg !== undefined)) {
                text = `${text} ${JSON.stringify(args.filter((arg) => arg !== undefined))}`;
            }
        } catch {
            // 忽略 console 參數提取失敗，保留原始文字即可
        }

        diagnostics.console.push({
            type: message.type(),
            text,
        });
    });

    page.on('pageerror', (error) => {
        diagnostics.pageErrors.push(String(error));
    });

    page.on('requestfailed', (request) => {
        diagnostics.requestFailures.push({
            url: request.url(),
            method: request.method(),
            failure: request.failure()?.errorText ?? 'unknown',
        });
    });

    return diagnostics;
}

function summarizeBodyText(bodyText) {
    return String(bodyText || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300);
}

/**
 * 這是 capture 階段的安全縮圖，不等於最終 view_image 讀圖尺寸。
 * 使用 PowerShell System.Drawing，不需要額外 npm 依賴。
 * maxWidth=0 代表跳過縮圖；capture 端預設仍可用 512px，但實際讀圖時仍應回到 `125 -> 250 -> 500` 的 progressive zoom 規則。
 */
function resizePng(filePath, maxWidth) {
    if (!maxWidth || maxWidth <= 0) return;
    const fp = filePath.replace(/'/g, "''"); // escape single quotes for PS string
    const ps = [
        'Add-Type -AssemblyName System.Drawing',
        `$fp = '${fp}'`,
        '$src = [System.Drawing.Image]::FromFile($fp)',
        '$w = $src.Width; $h = $src.Height',
        `if ($w -le ${maxWidth}) { $src.Dispose(); exit 0 }`,
        `$scale = ${maxWidth} / [double]$w`,
        `$nw = ${maxWidth}; $nh = [int]($h * $scale)`,
        '$dst = New-Object System.Drawing.Bitmap $nw, $nh',
        '$g = [System.Drawing.Graphics]::FromImage($dst)',
        '$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
        '$g.DrawImage($src, 0, 0, $nw, $nh)',
        '$g.Dispose(); $src.Dispose()',
        '$dst.Save($fp, [System.Drawing.Imaging.ImageFormat]::Png)',
        '$dst.Dispose()',
    ].join('\n');
    try {
        execSync('powershell -NoProfile -NonInteractive -Command -', { input: ps, timeout: 15000 });
        console.log(`[capture-ui-screens] resized to max ${maxWidth}px wide: ${path.basename(filePath)}`);
    } catch (err) {
        console.warn(`[capture-ui-screens] resize failed (non-fatal): ${err.message}`);
    }
}

function isRetryableCaptureError(error, debugState) {
    const message = String(error);
    const bodyText = debugState?.state?.bodyText ?? '';
    return message.includes('TimeoutError')
        || message.includes('Unable to resolve bare specifier')
        || bodyText.includes('Unable to resolve bare specifier')
        || bodyText.includes('Please open the console to see detailed errors');
}

function resolveUiSourceScreenDir(target) {
    if (!target.uiSourceDir) {
        return '';
    }
    return path.join(__dirname, '..', 'artifacts', 'ui-source', target.uiSourceDir);
}

function summarizeDiagnostics(diagnostics) {
    const consoleEntries = Array.isArray(diagnostics?.console) ? diagnostics.console : [];
    const pageErrors = Array.isArray(diagnostics?.pageErrors) ? diagnostics.pageErrors : [];
    const requestFailures = Array.isArray(diagnostics?.requestFailures) ? diagnostics.requestFailures : [];
    const consoleErrorCount = consoleEntries.filter((entry) => entry.type === 'error').length;
    const consoleWarningCount = consoleEntries.filter((entry) => entry.type === 'warning' || entry.type === 'warn').length;

    return {
        consoleErrorCount,
        consoleWarningCount,
        pageErrorCount: pageErrors.length,
        requestFailureCount: requestFailures.length,
    };
}

function collectDiagnosticSamples(diagnostics) {
    const consoleEntries = Array.isArray(diagnostics?.console) ? diagnostics.console : [];
    const counts = new Map();

    for (const entry of consoleEntries) {
        if (!entry || (entry.type !== 'warning' && entry.type !== 'warn' && entry.type !== 'error')) {
            continue;
        }
        const text = String(entry.text || '').replace(/\s+/g, ' ').trim();
        const key = `${entry.type}:${text}`;
        counts.set(key, {
            type: entry.type,
            text,
            count: (counts.get(key)?.count || 0) + 1,
        });
    }

    return Array.from(counts.values())
        .sort((left, right) => right.count - left.count || left.text.localeCompare(right.text))
        .slice(0, 20);
}

function buildRuntimeResiduals(summary, extraResiduals = []) {
    const residuals = [];
    if (summary.consoleErrorCount > 0) {
        residuals.push(`console errors: ${summary.consoleErrorCount}`);
    }
    if (summary.consoleWarningCount > 0) {
        residuals.push(`console warnings: ${summary.consoleWarningCount}`);
    }
    if (summary.pageErrorCount > 0) {
        residuals.push(`page errors: ${summary.pageErrorCount}`);
    }
    if (summary.requestFailureCount > 0) {
        residuals.push(`request failures: ${summary.requestFailureCount}`);
    }
    return residuals.concat(extraResiduals.filter(Boolean));
}

function buildRuntimeStatus(summary, failed) {
    if (failed || summary.pageErrorCount > 0 || summary.requestFailureCount > 0) {
        return 'fail';
    }
    if (summary.consoleErrorCount > 0 || summary.consoleWarningCount > 0) {
        return 'pass-with-minor-residuals';
    }
    return 'pass';
}

function writeRuntimeVerdictForTarget(target, outDir, metadata) {
    const screenDir = resolveUiSourceScreenDir(target);
    if (!screenDir || !fs.existsSync(screenDir)) {
        return;
    }

    writeRuntimeVerdictCaptureResult(screenDir, {
        screenId: target.runtimeScreenId || metadata.screenId || target.id,
        latestStage: 'runtimeCapture',
        ...metadata,
    });
}

async function captureOne(browser, baseUrl, outputDir, target, timeoutMs, sceneUuid) {
    const page = await browser.newPage();
    const diagnostics = createPageDiagnostics(page);

    await page.setCacheEnabled(false);
    await page.setExtraHTTPHeaders({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
    });

    await page.evaluateOnNewDocument((targetIndex, previewVariant, debugHidePaths) => {
        localStorage.setItem('PREVIEW_MODE', 'true');
        localStorage.setItem('PREVIEW_TARGET', String(targetIndex));
        if (previewVariant) {
            localStorage.setItem('PREVIEW_VARIANT', previewVariant);
        } else {
            localStorage.removeItem('PREVIEW_VARIANT');
        }
        if (debugHidePaths) {
            localStorage.setItem('GENERAL_DETAIL_OVERVIEW_HIDE_PATHS', debugHidePaths);
        } else {
            localStorage.removeItem('GENERAL_DETAIL_OVERVIEW_HIDE_PATHS');
        }
    }, target.targetIndex, target.previewVariant ?? '', target.debugHidePaths ?? '');

    const query = new URLSearchParams();
    query.set('previewMode', 'true');
    query.set('previewTarget', String(target.targetIndex));
    if (target.previewVariant) {
        query.set('previewVariant', target.previewVariant);
    }
    if (target.debugHidePaths) {
        query.set('debugHidePaths', target.debugHidePaths);
    }
    query.set('t', String(Date.now()));
    if (sceneUuid) {
        query.set('scene', sceneUuid);
    }

    const url = `${baseUrl}?${query.toString()}`;
    try {
        // Cocos Editor preview 頁常駐長連線，不能用 networkidle2 當成功條件。
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

        await Promise.race([
            page.waitForFunction(
                (screenId) => {
                    const state = window.__UI_CAPTURE_STATE__;
                    if (!state) {
                        return false;
                    }
                    if (state.status === 'error') {
                        throw new Error(`UI capture error: ${state.error || 'unknown'}`);
                    }
                    return state.status === 'ready' && state.screenId === screenId;
                },
                { timeout: timeoutMs },
                target.screenId
            ),
            page.waitForFunction(
                () => {
                    const bodyText = document.body ? document.body.innerText : '';
                    return bodyText.includes('Unable to resolve bare specifier');
                },
                { timeout: timeoutMs }
            ).then(async () => {
                const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
                throw new Error(`Preview compile failed: ${summarizeBodyText(bodyText)}`);
            }),
        ]);

        const filePath = path.join(outputDir, `${target.id}.png`);

        if (target.id === 'BattleScene') {
            const dump = await page.evaluate(() => {
                let scene = undefined;
                try {
                    const gameWin = document.querySelector('iframe')?.contentWindow || window;
                    const cc = gameWin.cc;
                    if (cc && cc.director) {
                        scene = cc.director.getScene();
                    }
                } catch(e) {}

                if (!scene) return "No scene";

                // Find BattleLogPanel canvas node
                const findNode = (root, name) => {
                    if (root.name === name) return root;
                    for (const c of (root.children || [])) {
                        const found = findNode(c, name);
                        if (found) return found;
                    }
                    return null;
                };

                const getInfo = (n) => {
                    if (!n) return null;
                    const tf = n.getComponent && n.getComponent('cc.UITransform');
                    const wp = n.worldPosition;
                    return {
                        name: n.name,
                        active: n.active,
                        actH: n.activeInHierarchy,
                        wx: wp ? Math.round(wp.x) : null,
                        wy: wp ? Math.round(wp.y) : null,
                        w: tf ? Math.round(tf.width) : null,
                        h: tf ? Math.round(tf.height) : null,
                        children: n.children ? n.children.length : 0
                    };
                };

                const logPanelCanvasNode = findNode(scene, 'BattleLogPanel');
                const sidePanelRoot = logPanelCanvasNode ? findNode(logPanelCanvasNode, 'SidePanelRoot') : null;

                const result = {
                    BattleLogPanelNode: getInfo(logPanelCanvasNode),
                    SidePanelRoot: getInfo(sidePanelRoot),
                };

                if (sidePanelRoot) {
                    for (const child of (sidePanelRoot.children || [])) {
                        result[child.name] = getInfo(child);
                        // Also check grandchildren of BattleLogPanel sub-node
                        if (child.name === 'BattleLogPanel') {
                            for (const gc of (child.children || [])) {
                                result['BLP.' + gc.name] = getInfo(gc);
                            }
                        }
                    }
                }

                // Canvas info
                const canvas = findNode(scene, 'Canvas');
                if (canvas) {
                    const tf = canvas.getComponent && canvas.getComponent('cc.UITransform');
                    result.Canvas = {
                        wx: Math.round(canvas.worldPosition.x),
                        wy: Math.round(canvas.worldPosition.y),
                        w: tf ? Math.round(tf.width) : null,
                        h: tf ? Math.round(tf.height) : null,
                    };
                }

                return result;
            });
            require('fs').writeFileSync('artifacts/dump.json', JSON.stringify(dump, null, 2));
        }

        // 量測 Cocos Editor 工具列高度，裁切後僅保留遊戲畫布區域
        const toolbarHeight = await page.evaluate(() => {
            const canvasEl = document.querySelector('canvas') || document.querySelector('#GameDiv');
            if (canvasEl) {
                const rect = canvasEl.getBoundingClientRect();
                return Math.max(0, Math.round(rect.top));
            }
            return 30;
        });
        const vp = { width: 1920, height: 1080 };
        const clip = toolbarHeight > 0
            ? { x: 0, y: toolbarHeight, width: vp.width, height: vp.height - toolbarHeight }
            : undefined;
        await page.screenshot({ path: filePath, fullPage: false, ...(clip ? { clip } : {}) });
        return { filePath, page, diagnostics };
    } catch (error) {
        error.diagnostics = diagnostics;
        error.page = page;
        throw error;
    }
}

async function writeFailureArtifacts(page, outputDir, target, error, diagnostics) {
    const safeTarget = target ? target.id : 'unknown';
    const debugScreenshotPath = path.join(outputDir, `${safeTarget}-debug.png`);
    const debugStatePath = path.join(outputDir, `${safeTarget}-debug-state.json`);

    try {
        await page.screenshot({ path: debugScreenshotPath, fullPage: true });
    } catch (screenshotError) {
        console.warn('[capture-ui-screens] 無法寫入 debug screenshot:', screenshotError);
    }

    try {
        const state = await page.evaluate(() => ({
            href: window.location.href,
            title: document.title,
            captureState: (window).__UI_CAPTURE_STATE__ ?? null,
            bodyText: document.body ? document.body.innerText.slice(0, 1200) : '',
            iframeCount: document.querySelectorAll('iframe').length,
            canvasCount: document.querySelectorAll('canvas').length,
        }));

        fs.writeFileSync(debugStatePath, JSON.stringify({
            createdAt: new Date().toISOString(),
            target: safeTarget,
            error: String(error),
            state,
            diagnostics,
        }, null, 2), 'utf8');
    } catch (stateError) {
        console.warn('[capture-ui-screens] 無法寫入 debug state:', stateError);
    }
}

async function main() {
    const targetId = parseArg('target', '');
    const outDir = parseArg('outDir', path.join('artifacts', 'ui-qa', 'UI-2-0023'));
    const baseUrl = parseArg('url', 'http://localhost:7456');
    const timeoutMs = Number(parseArg('timeout', '45000'));
    const browserArg = parseArg('browser', '');
    const sceneUuid = parseArg('sceneUuid', resolveLoadingSceneUuid());
    const retries = Number(parseArg('retries', '1'));
    const refreshBefore = parseArg('refreshBefore', 'true') !== 'false';
    const maxWidth = Number(parseArg('maxWidth', '125'));
    const hidePaths = parseArg('hidePaths', '').trim();

    const browserExecutable = resolveBrowserExecutable(browserArg);
    if (!browserExecutable) {
        console.error('[capture-ui-screens] 找不到可用瀏覽器，請用 --browser 指定 Edge/Chrome executable path');
        process.exit(1);
    }

    const selectedTargets = selectTargets(targetId).map((target) => ({
        ...target,
        debugHidePaths: hidePaths,
    }));
    fs.mkdirSync(outDir, { recursive: true });

    console.log('='.repeat(70));
    console.log('[capture-ui-screens] Headless capture start');
    console.log(`- host: ${baseUrl}`);
    console.log(`- targets: ${selectedTargets.map(t => t.id).join(', ')}`);
    console.log(`- output: ${outDir}`);
    console.log(`- browser: ${browserExecutable}`);
    console.log(`- sceneUuid: ${sceneUuid || '(none)'}`);
    console.log(`- retries: ${retries}`);
    console.log('='.repeat(70));

    if (refreshBefore) {
        console.log('[capture-ui-screens] refreshing asset-db before capture...');
        await triggerEditorRefresh(baseUrl);
        await delay(1200);
    }

    const browser = await puppeteer.launch({
        executablePath: browserExecutable,
        headless: true,
        defaultViewport: { width: 1920, height: 1080 },
        args: [
            '--disable-gpu',
            '--disable-http-cache',
            '--no-sandbox',
            '--disable-dev-shm-usage',
        ],
    });

    const captured = [];
    const runtimeUpdates = [];

    try {
        for (const target of selectedTargets) {
            let lastError = null;

            for (let attempt = 1; attempt <= retries + 1; attempt++) {
                let captureResult = null;
                try {
                    console.log(`[capture-ui-screens] ${target.id} attempt ${attempt}/${retries + 1}`);
                    captureResult = await captureOne(browser, baseUrl, outDir, target, timeoutMs, sceneUuid);
                    resizePng(captureResult.filePath, maxWidth);
                    const diagnosticsSummary = summarizeDiagnostics(captureResult.diagnostics);
                    const diagnosticSamples = collectDiagnosticSamples(captureResult.diagnostics);
                    const status = buildRuntimeStatus(diagnosticsSummary, false);
                    const residuals = buildRuntimeResiduals(diagnosticsSummary);
                    const relativeFile = path.relative(path.join(__dirname, '..'), captureResult.filePath).replace(/\\/g, '/');
                    captured.push({
                        target: target.id,
                        screenId: target.runtimeScreenId || target.screenId,
                        file: captureResult.filePath,
                        diagnosticsSummary,
                        diagnosticSamples,
                        status,
                    });
                    writeRuntimeVerdictForTarget(target, outDir, {
                        runId: path.basename(outDir),
                        status,
                        residuals,
                        promoteable: status !== 'fail',
                        diagnosticsSummary,
                        captureArtifacts: {
                            screenshotPath: relativeFile,
                        },
                        factoryLearnings: status === 'pass'
                            ? ['runtime capture connected to capture-ui-screens.js']
                            : [],
                    });
                    runtimeUpdates.push({ target: target.id, status });
                    console.log(`[capture-ui-screens] captured ${target.id} -> ${captureResult.filePath}`);
                    await captureResult.page.close();
                    lastError = null;
                    break;
                } catch (error) {
                    lastError = error;
                    const debugState = {
                        state: null,
                        diagnostics: error.diagnostics ?? null,
                    };
                    if (error.page) {
                        await writeFailureArtifacts(error.page, outDir, target, error, error.diagnostics ?? null);
                        try {
                            debugState.state = JSON.parse(fs.readFileSync(path.join(outDir, `${target.id}-debug-state.json`), 'utf8'));
                        } catch {
                            // 讀不到 debug 檔時，保留 null
                        }
                        await error.page.close();
                    }

                    const retryable = attempt <= retries && isRetryableCaptureError(error, debugState.state);
                    const diagnosticsSummary = summarizeDiagnostics(error.diagnostics);
                    const diagnosticSamples = collectDiagnosticSamples(error.diagnostics);
                    const residuals = buildRuntimeResiduals(diagnosticsSummary, [String(error)]);
                    writeRuntimeVerdictForTarget(target, outDir, {
                        runId: path.basename(outDir),
                        status: retryable ? 'pass-with-minor-residuals' : 'fail',
                        residuals,
                        promoteable: false,
                        diagnosticsSummary,
                        factoryLearnings: ['runtime capture failure should be triaged before promoting the screen'],
                        captureArtifacts: {
                            debugScreenshotPath: path.relative(path.join(__dirname, '..'), path.join(outDir, `${target.id}-debug.png`)).replace(/\\/g, '/'),
                            debugStatePath: path.relative(path.join(__dirname, '..'), path.join(outDir, `${target.id}-debug-state.json`)).replace(/\\/g, '/'),
                        },
                    });
                    const debugSamplesPath = path.join(outDir, `${target.id}-diagnostic-samples.json`);
                    fs.writeFileSync(debugSamplesPath, JSON.stringify({ diagnosticSamples }, null, 2), 'utf8');
                    console.warn(`[capture-ui-screens] ${target.id} attempt ${attempt} failed: ${error}`);
                    if (!retryable) {
                        throw error;
                    }

                    console.log('[capture-ui-screens] retryable failure detected, refreshing asset-db and retrying...');
                    await triggerEditorRefresh(baseUrl);
                    await delay(1500);
                }
            }

            if (lastError) {
                throw lastError;
            }
        }
    } catch (error) {
        throw error;
    } finally {
        await browser.close();
    }

    const report = {
        createdAt: new Date().toISOString(),
        host: baseUrl,
        machine: os.hostname(),
        captures: captured,
        runtimeUpdates,
    };
    const captureReportPath = path.join(outDir, 'capture-report.json');
    fs.writeFileSync(captureReportPath, JSON.stringify(report, null, 2), 'utf8');

    for (const target of selectedTargets) {
        const matched = captured.find((entry) => entry.target === target.id);
        if (!matched) {
            continue;
        }
        writeRuntimeVerdictForTarget(target, outDir, {
            runId: path.basename(outDir),
            captureArtifacts: {
                captureReportPath: path.relative(path.join(__dirname, '..'), captureReportPath).replace(/\\/g, '/'),
            },
        });
    }

    console.log(`[capture-ui-screens] 完成，共 ${captured.length} 張。`);
}

main().catch((error) => {
    console.error('[capture-ui-screens] failed:', error);
    process.exit(1);
});
