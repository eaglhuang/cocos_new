#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveLoadingSceneUuid() {
  const metaPath = path.join(__dirname, '..', 'assets', 'scenes', 'LoadingScene.scene.meta');
  const raw = fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw).uuid;
}

async function waitForReady(page, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ready = await page.evaluate(() => {
      const state = window.__UI_CAPTURE_STATE__ ?? null;
      return state?.status === 'ready' && state?.screenId === 'battle-scene';
    }).catch(() => false);
    if (ready) {
      return;
    }
    await delay(250);
  }
  throw new Error('Timed out waiting for battle-scene ready state');
}

async function main() {
  const outDir = path.join(__dirname, '..', 'artifacts', 'ui-qa', 'flood-surface-qa', 'sequence');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--disable-gpu', '--disable-http-cache', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setExtraHTTPHeaders({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('PREVIEW_MODE', 'true');
      localStorage.setItem('PREVIEW_TARGET', '5');
    });

    const query = new URLSearchParams({
      previewMode: 'true',
      previewTarget: '5',
      battleTactic: 'flood-attack',
      scene: resolveLoadingSceneUuid(),
      t: String(Date.now()),
    });
    const url = `http://localhost:7456?${query.toString()}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForReady(page, 60000);
    await delay(1600);

    const metrics = await page.evaluate(() => {
      const canvasEl = document.querySelector('canvas') || document.querySelector('#GameDiv');
      const rect = canvasEl ? canvasEl.getBoundingClientRect() : { top: 30, width: 1920, height: 1050 };
      return {
        toolbarHeight: Math.max(0, Math.round(rect.top || 0)),
        canvasWidth: Math.round(rect.width || 1920),
        canvasHeight: Math.round(rect.height || 1050),
      };
    });

    const gameClip = {
      x: 0,
      y: metrics.toolbarHeight,
      width: 1920,
      height: 1080 - metrics.toolbarHeight,
    };
    const boardClip = {
      x: 360,
      y: metrics.toolbarHeight + 90,
      width: 1180,
      height: 760,
    };

    const frame1Full = path.join(outDir, 'frame1-full.png');
    const frame1Board = path.join(outDir, 'frame1-board.png');
    const frame2Board = path.join(outDir, 'frame2-board.png');

    await page.screenshot({ path: frame1Full, clip: gameClip });
    await page.screenshot({ path: frame1Board, clip: boardClip });
    await delay(1200);
    await page.screenshot({ path: frame2Board, clip: boardClip });

    const report = {
      createdAt: new Date().toISOString(),
      url,
      metrics,
      files: {
        frame1Full,
        frame1Board,
        frame2Board,
      },
    };
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
