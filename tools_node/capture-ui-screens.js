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
    { id: 'ShopMain', screenId: 'shop-main-screen', targetIndex: 2 },
    { id: 'Gacha', screenId: 'gacha-main-screen', targetIndex: 3 },
    { id: 'DuelChallenge', screenId: 'duel-challenge-screen', targetIndex: 4 },
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
        return targets;
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

function isRetryableCaptureError(error, debugState) {
    const message = String(error);
    const bodyText = debugState?.state?.bodyText ?? '';
    return message.includes('TimeoutError')
        || message.includes('Unable to resolve bare specifier')
        || bodyText.includes('Unable to resolve bare specifier')
        || bodyText.includes('Please open the console to see detailed errors');
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

    await page.evaluateOnNewDocument((targetIndex) => {
        localStorage.setItem('PREVIEW_MODE', 'true');
        localStorage.setItem('PREVIEW_TARGET', String(targetIndex));
    }, target.targetIndex);

    const query = new URLSearchParams();
    query.set('previewMode', 'true');
    query.set('previewTarget', String(target.targetIndex));
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
        await page.screenshot({ path: filePath, fullPage: false });
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

    const browserExecutable = resolveBrowserExecutable(browserArg);
    if (!browserExecutable) {
        console.error('[capture-ui-screens] 找不到可用瀏覽器，請用 --browser 指定 Edge/Chrome executable path');
        process.exit(1);
    }

    const selectedTargets = selectTargets(targetId);
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

    try {
        for (const target of selectedTargets) {
            let lastError = null;

            for (let attempt = 1; attempt <= retries + 1; attempt++) {
                let captureResult = null;
                try {
                    console.log(`[capture-ui-screens] ${target.id} attempt ${attempt}/${retries + 1}`);
                    captureResult = await captureOne(browser, baseUrl, outDir, target, timeoutMs, sceneUuid);
                    captured.push({ target: target.id, screenId: target.screenId, file: captureResult.filePath });
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
    };
    fs.writeFileSync(path.join(outDir, 'capture-report.json'), JSON.stringify(report, null, 2), 'utf8');

    console.log(`[capture-ui-screens] 完成，共 ${captured.length} 張。`);
}

main().catch((error) => {
    console.error('[capture-ui-screens] failed:', error);
    process.exit(1);
});
