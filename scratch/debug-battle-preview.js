const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--disable-gpu', '--disable-http-cache', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warn') {
      console.log('CONSOLE', message.type(), message.text());
    }
  });
  page.on('pageerror', (error) => {
    console.log('PAGEERROR', error.message);
    if (error.stack) {
      console.log(error.stack);
    }
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    console.log('REQFAIL', request.url(), failure ? failure.errorText : 'unknown');
  });

  const url = 'http://localhost:7456?previewMode=true&previewTarget=5&battleTactic=flood-attack&t=' + Date.now() + '&scene=05b67b52-831e-4d74-a8a7-5955746bde7f';
  console.log('URL', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 20000));

  const state = await page.evaluate(() => ({
    href: window.location.href,
    title: document.title,
    bodyText: document.body ? document.body.innerText.slice(0, 2000) : '',
    captureState: window.__UI_CAPTURE_STATE__ ?? null,
    iframeCount: document.querySelectorAll('iframe').length,
    canvasCount: document.querySelectorAll('canvas').length,
  }));
  console.log('STATE', JSON.stringify(state, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
