/**
 * Browser check against the production build (run `npm run build` first).
 *  - Changing personal financial inputs triggers no network requests.
 *  - No request ever leaves the page's own origin.
 *  - No CSP violations or console errors; no horizontal scroll at phone width.
 * Usage: node tests/e2e/privacy.mjs [screenshotDir]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

// Resolved with require() so a globally installed Playwright (NODE_PATH) also works.
const { chromium } = createRequire(import.meta.url)('playwright');

const DIST = new URL('../../dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
const shotDir = process.argv[2];

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '');
  const file = path === '' || path === '.' ? 'index.html' : path;
  try {
    const body = await readFile(join(DIST, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const browser = await chromium.launch();
for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const page = await browser.newPage({ viewport });
  const requests = [];
  const errors = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(origin + '/');
  await page.waitForSelector('.verdict, .verdict-empty');
  const initial = requests.length;

  await page.getByPlaceholder('למשל 200,000 — או 0').fill('350000');
  await page.getByLabel('החזר חודשי מקסימלי').fill('6000');
  await page.getByText('לקבל כמה שיותר דירות').click();
  await page.getByLabel('אחוז קומבינציה').fill('0.4');
  await page.getByRole('button', { name: 'ללא משכנתא' }).click();
  await page.getByRole('button', { name: 'לא יודע/ת' }).click();
  await page.waitForTimeout(300);
  const afterInputs = requests.slice(initial);
  if (afterInputs.length) failures.push(`${viewport.width}px: inputs triggered requests: ${afterInputs.join(', ')}`);

  const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:'));
  if (foreign.length) failures.push(`${viewport.width}px: cross-origin requests: ${foreign.join(', ')}`);
  if (errors.length) failures.push(`${viewport.width}px: console errors: ${errors.join(' | ')}`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) failures.push(`${viewport.width}px: horizontal overflow of ${overflow}px`);

  if (shotDir) {
    await page.getByLabel('החזר חודשי מקסימלי').fill('6000');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${shotDir}/smart-${viewport.width}.png`, fullPage: true });
  }
  await page.getByRole('radio', { name: 'השוואה מתקדמת' }).click();
  await page.waitForSelector('.legacy-intro');
  if (errors.length) failures.push(`${viewport.width}px: errors on advanced tab: ${errors.join(' | ')}`);
  await page.close();
}
await browser.close();
server.close();

if (failures.length) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log('privacy/e2e: OK — no network requests from inputs, no cross-origin requests, no console errors, no overflow');
