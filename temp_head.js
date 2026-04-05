#!/usr/bin/env node
/**
 * capture-ui-screens.js
 *
 * 隞餃?嚗???瑕? D ?挾 UI ?芸?嚗eadless嚗? *
 * ?冽?嚗? *   node tools_node/capture-ui-screens.js
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
    console.error('[capture-ui-screens] 蝻箏?靘陷 puppeteer-core嚗??銵? npm i -D puppeteer-core');
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
        console.warn('[capture-ui-screens] ?⊥?霈??LoadingScene.scene.meta uuid:', error);
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
