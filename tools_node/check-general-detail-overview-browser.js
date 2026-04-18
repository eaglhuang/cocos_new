#!/usr/bin/env node
/**
 * check-general-detail-overview-browser.js
 *
 * Browser-level smoke test：用 puppeteer-core 開啟 Cocos Preview（previewTarget=6，
 * General Detail Overview），驗證右側資訊頁「真的在畫面上佔空間且有資料」。
 *
 * 這個測試填補 Node.js governance test 的盲點：Node 層的靜態分析
 * 無法偵測 node.active=true 但 opacity=0、world-size=0、或 sibling-covered 等
 * 「技術上存在、視覺上消失」的情況。
 *
 * 用法：
 *   node tools_node/check-general-detail-overview-browser.js
 *   node tools_node/check-general-detail-overview-browser.js --base http://localhost:7456
 *   node tools_node/check-general-detail-overview-browser.js --timeout 20000
 *
 * 退出碼：0 = PASS，1 = FAIL
 */

'use strict';

const path = require('path');
const fs = require('fs');

let puppeteer;
try {
    puppeteer = require('puppeteer-core');
} catch (_) {
    console.error('[overview-browser-smoke] 缺少 puppeteer-core。請執行: npm i -D puppeteer-core');
    process.exit(1);
}

// ─── 參數解析 ────────────────────────────────────────────────────────────────

function parseArg(name, fallback) {
    const idx = process.argv.indexOf(`--${name}`);
    if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
    return fallback;
}

const BASE_URL    = parseArg('base', 'http://localhost:7456');
const TIMEOUT_MS  = parseInt(parseArg('timeout', '25000'), 10);
const PREVIEW_TARGET = 6; // General Detail Overview

// ─── 瀏覽器執行檔偵測（與 capture-ui-screens 相同邏輯）─────────────────────

function resolveBrowserExecutable() {
    const candidates = process.platform === 'win32'
        ? [
            'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
            'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
          ]
        : process.platform === 'darwin'
        ? [
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          ]
        : ['/usr/bin/microsoft-edge', '/usr/bin/google-chrome'];

    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return '';
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ─── 主流程 ──────────────────────────────────────────────────────────────────

async function main() {
    const executablePath = resolveBrowserExecutable();
    if (!executablePath) {
        console.error('[overview-browser-smoke] 找不到 Chrome/Edge 執行檔。');
        process.exit(1);
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--allow-running-insecure-content',
            ],
            defaultViewport: { width: 1920, height: 1080 },
        });
    } catch (err) {
        console.error('[overview-browser-smoke] 無法啟動瀏覽器:', err.message);
        process.exit(1);
    }

    const page = await browser.newPage();

    // 攔截頁面 error overlay
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));

    try {
        // 設定 localStorage flags（與 capture-ui-screens 相同）
        await page.evaluateOnNewDocument((targetIndex) => {
            localStorage.setItem('PREVIEW_MODE', 'true');
            localStorage.setItem('PREVIEW_TARGET', String(targetIndex));
            localStorage.removeItem('PREVIEW_VARIANT');
        }, PREVIEW_TARGET);

        const url = `${BASE_URL}?previewMode=true&previewTarget=${PREVIEW_TARGET}&t=${Date.now()}`;
        console.log(`[overview-browser-smoke] 開啟 ${url}`);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });

        // 等待 Cocos 場景載入完成（最多 TIMEOUT_MS）
        console.log('[overview-browser-smoke] 等待場景就緒...');
        const sceneReady = await waitForSceneReady(page, TIMEOUT_MS);
        if (!sceneReady) {
            throw new Error('Timeout: Cocos scene never became ready');
        }

        // 額外緩衝讓 UI 動畫完成
        await delay(1500);

        console.log('[overview-browser-smoke] 執行 overview visibility checks...');
        const result = await page.evaluate(runOverviewChecks);

        // 輸出結果
        console.log('\n─────────────────────────────────────────────');
        console.log('  General Detail Overview Browser Smoke');
        console.log('─────────────────────────────────────────────');
        for (const check of result.checks) {
            const icon = check.passed ? '✅' : '❌';
            console.log(`  ${icon} ${check.name}`);
            if (!check.passed) console.log(`     └─ ${check.detail}`);
        }
        const failCount = result.checks.filter(c => !c.passed).length;
        const status = failCount === 0 ? '🟢  ALL PASS' : `🔴  FAILED: ${failCount} failed`;
        console.log(`\n  ${status} (${result.checks.length} checks)`);
        console.log('─────────────────────────────────────────────\n');

        if (pageErrors.length > 0) {
            console.warn('[overview-browser-smoke] Page errors detected:');
            pageErrors.slice(0, 5).forEach(e => console.warn(' ', e));
        }

        await browser.close();
        process.exit(failCount > 0 ? 1 : 0);

    } catch (err) {
        console.error('[overview-browser-smoke] 執行失敗:', err.message);
        try { await browser.close(); } catch (_) {}
        process.exit(1);
    }
}

// ─── 等待 Cocos 場景就緒 ─────────────────────────────────────────────────────

async function waitForSceneReady(page, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const ready = await page.evaluate(() => {
            try {
                const cc = window.cc;
                if (!cc || !cc.director) return false;
                const scene = cc.director.getScene();
                if (!scene) return false;
                // 確認 Canvas node 存在且有子節點（場景真的已建立）
                const canvas = scene.getChildByName('Canvas');
                return canvas != null && canvas.children && canvas.children.length > 0;
            } catch (_) {
                return false;
            }
        });
        if (ready) return true;
        await delay(300);
    }
    return false;
}

// ─── Overview 可視性檢查（在 browser context 執行）───────────────────────────
//
// 此函式由 page.evaluate 注入瀏覽器，不可使用 Node.js API。
// 只依賴 window.cc（Cocos runtime）。

function runOverviewChecks() {
    const checks = [];

    function pass(name) { checks.push({ name, passed: true, detail: '' }); }
    function fail(name, detail) { checks.push({ name, passed: false, detail }); }

    try {
        const cc = window.cc;
        if (!cc || !cc.director) {
            fail('Cocos runtime 存在', 'window.cc or cc.director not found');
            return { checks };
        }

        const scene = cc.director.getScene();
        if (!scene) {
            fail('場景存在', 'cc.director.getScene() returned null');
            return { checks };
        }

        // ── 找 GeneralDetailComposite 節點 ──────────────────────────────────

        function findNode(root, name) {
            if (!root) return null;
            if (root.name === name) return root;
            for (const c of (root.children || [])) {
                const found = findNode(c, name);
                if (found) return found;
            }
            return null;
        }

        function findByPath(root, pathStr) {
            if (!root) return null;
            const parts = pathStr.split('/');
            let node = root;
            for (const p of parts) {
                node = node.getChildByName ? node.getChildByName(p) : null;
                if (!node) return null;
            }
            return node;
        }

        function getWorldBounds(node) {
            try {
                const tf = node.getComponent && node.getComponent('cc.UITransform');
                if (!tf) return null;
                const wp = node.worldPosition || { x: 0, y: 0 };
                return {
                    x: wp.x - tf.width / 2,
                    y: wp.y - tf.height / 2,
                    width: tf.width,
                    height: tf.height,
                };
            } catch (_) {
                return null;
            }
        }

        function getOpacity(node) {
            try {
                const op = node.getComponent && node.getComponent('cc.UIOpacity');
                return op ? op.opacity : 255;
            } catch (_) {
                return 255;
            }
        }

        const gdComposite = findNode(scene, 'GeneralDetailComposite');
        if (!gdComposite) {
            fail('GeneralDetailComposite 節點存在', 'node not found in scene tree');
            return { checks };
        }
        pass('GeneralDetailComposite 節點存在');

        if (!gdComposite.activeInHierarchy) {
            fail('GeneralDetailComposite activeInHierarchy', `active=${gdComposite.active}, activeInHierarchy=false`);
            return { checks };
        }
        pass('GeneralDetailComposite activeInHierarchy');

        // ── 找 Overview content host（支援 shell 或 unified 兩種路徑）──────

        // 找 GeneralDetailRoot（可能包在 __safeArea 裡）
        const gdRoot = findByPath(gdComposite, '__safeArea/GeneralDetailRoot')
                    || findNode(gdComposite, 'GeneralDetailRoot');

        if (!gdRoot) {
            fail('GeneralDetailRoot 存在', 'getChildByPath failed');
            return { checks };
        }
        pass('GeneralDetailRoot 存在');

        // 嘗試找 shell host 或 overview slot
        const shellHost = gdRoot.getChildByName('GeneralDetailOverviewShellHost');
        const overviewSlot = gdRoot.getChildByName('OverviewSlot');

        // ── Check 1: 至少一個 content host active ───────────────────────────

        const shellActive = shellHost && shellHost.activeInHierarchy;
        const slotActive  = overviewSlot && overviewSlot.activeInHierarchy;

        if (!shellActive && !slotActive) {
            const shellInfo = shellHost
                ? `ShellHost active=${shellHost.active}, activeInHier=${shellHost.activeInHierarchy}`
                : 'ShellHost not found';
            const slotInfo = overviewSlot
                ? `OverviewSlot active=${overviewSlot.active}, activeInHier=${overviewSlot.activeInHierarchy}`
                : 'OverviewSlot not found';
            fail('Overview content host 至少一個 active', `${shellInfo} | ${slotInfo}`);
        } else {
            pass(`Overview content host active (${shellActive ? 'ShellHost' : 'OverviewSlot'})`);
        }

        // ── 決定走哪條路徑 ──────────────────────────────────────────────────

        let contentRoot = null;
        let pathLabel = '';

        if (shellActive) {
            // shell path: ShellHost > GeneralDetailBloodlineRoot > InfoContent
            const blRoot = shellHost.getChildByName('GeneralDetailBloodlineRoot');
            contentRoot = blRoot ? blRoot.getChildByName('InfoContent') : null;
            pathLabel = 'ShellHost/GeneralDetailBloodlineRoot/InfoContent';
        } else if (slotActive) {
            // unified path: OverviewSlot > OverviewTabContent
            contentRoot = overviewSlot.getChildByName('OverviewTabContent');
            pathLabel = 'OverviewSlot/OverviewTabContent';
        }

        if (!contentRoot) {
            fail('Overview 內容根節點存在', `contentRoot not found under ${pathLabel}`);
            return { checks };
        }
        if (!contentRoot.activeInHierarchy) {
            fail('Overview 內容根節點 activeInHierarchy', `${pathLabel} active=false`);
            return { checks };
        }
        pass(`Overview 內容根節點 active (${pathLabel})`);

        // ── Check 2: 真實佔畫面空間（world AABB width > 100）──────────────

        const bounds = getWorldBounds(contentRoot);
        if (!bounds) {
            fail('Overview 內容根節點有 UITransform', 'UITransform not found');
        } else if (bounds.width < 100) {
            fail('Overview 內容根節點 world width > 100px', `width=${bounds.width}`);
        } else {
            pass(`Overview 內容根節點 world width=${Math.round(bounds.width)}px`);
        }

        // ── Check 3: UIOpacity > 0 ──────────────────────────────────────────

        const opacity = getOpacity(contentRoot);
        if (opacity === 0) {
            fail('Overview 內容根節點 opacity > 0', 'opacity=0');
        } else {
            pass(`Overview 內容根節點 opacity=${opacity}`);
        }

        // ── Check 4: NameLabel 有非空文字 ───────────────────────────────────

        // 在 contentRoot 下找 NameLabel（深搜）
        function findLabel(root) {
            if (!root) return null;
            if (root.name === 'NameLabel') return root;
            for (const c of (root.children || [])) {
                const found = findLabel(c);
                if (found) return found;
            }
            return null;
        }

        const nameLabel = findLabel(contentRoot);
        if (!nameLabel) {
            fail('NameLabel 節點存在', `not found under ${pathLabel}`);
        } else {
            try {
                const labelComp = nameLabel.getComponent('cc.Label')
                                || nameLabel.getComponent && nameLabel.getComponent('Label');
                const text = labelComp ? (labelComp.string || '') : '';
                if (!text || text.trim().length === 0) {
                    fail('NameLabel 有非空文字', `string="${text}"`);
                } else {
                    pass(`NameLabel="${text.trim().slice(0, 20)}"`);
                }
            } catch (e) {
                fail('NameLabel 文字讀取', String(e));
            }
        }

        // ── Check 5: 至少一個摘要模組節點存在且 active ──────────────────────

        function findActive(root, name) {
            const n = findNode(root, name);
            return n && n.activeInHierarchy ? n : null;
        }

        const coreStats = findActive(contentRoot, 'CoreStatsCard');
        const bloodlineSummary = findActive(contentRoot, 'BloodlineSummaryCard');

        if (!coreStats && !bloodlineSummary) {
            fail('至少一個摘要模組 active', 'CoreStatsCard 和 BloodlineSummaryCard 都不在 hierarchy 中');
        } else {
            const which = [coreStats && 'CoreStatsCard', bloodlineSummary && 'BloodlineSummaryCard']
                .filter(Boolean).join(', ');
            pass(`摘要模組 active: ${which}`);
        }

    } catch (err) {
        checks.push({ name: '執行 overview checks', passed: false, detail: String(err) });
    }

    return { checks };
}

// ─── 執行 ─────────────────────────────────────────────────────────────────────

main();
