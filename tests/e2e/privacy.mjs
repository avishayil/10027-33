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

// E2E_DIST lets CI test a build made for the root path while the deployed build uses the repository sub-path.
const DIST = process.env.E2E_DIST ? new URL(`../../${process.env.E2E_DIST.replace(/\/?$/, '/')}`, import.meta.url).pathname : new URL('../../dist/', import.meta.url).pathname;
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
  const shot = async (name) => shotDir && page.screenshot({ path: `${shotDir}/${name}-${viewport.width}.png`, fullPage: true });

  // First visit: the onboarding wizard.
  await page.waitForSelector('.wizard');
  const initial = requests.length;
  await shot('w0-welcome');
  const next = () => page.locator('.wizard-actions button[type=submit]').click();
  await next();
  // Keyboard / screen reader: focus moves to the step heading, and every visible control has an accessible name.
  const focused = await page.evaluate(() => document.activeElement?.classList.contains('wizard-title'));
  if (!focused) failures.push(`${viewport.width}px: focus did not move to the wizard step heading`);
  await shot('w1-land');
  await next();
  // Capital is required — an empty answer is blocked with a message.
  await next();
  if (!(await page.locator('.wizard .field-error').isVisible())) failures.push(`${viewport.width}px: empty capital was not blocked`);
  await page.getByLabel('כמה כסף פנוי תוכלו להשקיע?').fill('350000');
  await shot('w2-capital');
  await next();
  await page.getByLabel('כמה תוכלו להחזיר בחודש על משכנתא חדשה?').fill('6000');
  await shot('w3-repayment');
  await next();
  await page.getByText('לסיים עם דירה שלמה').click();
  await shot('w4-goal');
  await next();
  await page.locator('.ack input').check();
  await page.getByLabel('אחוז קומבינציה').fill('0.4');
  await shot('w5-terms');
  await next();
  // Saving is opt-in (unchecked by default).
  await page.getByLabel(/לשמור את התשובות/).check();
  await shot('w6-summary');
  await next();
  // Simple view: only the three priorities; the details appear behind the advanced toggle.
  await page.waitForSelector('.priorities');
  if ((await page.locator('.priority-card').count()) === 0) failures.push(`${viewport.width}px: no priorities shown`);
  if (await page.locator('.verdict, .verdict-empty').count()) failures.push(`${viewport.width}px: details visible in simple view`);
  await shot('main');
  await page.getByRole('switch', { name: /תצוגה מתקדמת/ }).check();
  await page.waitForSelector('.verdict, .verdict-empty');
  await shot('main-advanced');

  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('input, select, button')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const id = el.getAttribute('id');
        const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
        return !(el.getAttribute('aria-label') || el.closest('label') || byFor || (el.tagName === 'BUTTON' && el.textContent.trim()));
      })
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  if (unnamed.length) failures.push(`${viewport.width}px: controls without an accessible name: ${unnamed.join(' | ')}`);

  // Main screen interactions.
  await page.getByLabel('רווח יזמי בשירותי בנייה').fill('0.2');
  await page.waitForTimeout(200);
  const afterInputs = requests.slice(initial);
  if (afterInputs.length) failures.push(`${viewport.width}px: inputs triggered requests: ${afterInputs.join(', ')}`);

  // Answers persist after a reload (consent was on by default) …
  await page.reload();
  await page.waitForSelector('.answers-bar');
  if (!(await page.locator('.answers-bar').getByText('350,000').isVisible())) failures.push(`${viewport.width}px: saved answers not restored`);
  // … and can be forgotten.
  await page.getByRole('button', { name: 'מחיקת התשובות השמורות' }).click();
  await page.reload();
  await page.waitForSelector('.wizard');
  await page.evaluate(() => localStorage.clear());

  const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:'));
  if (foreign.length) failures.push(`${viewport.width}px: cross-origin requests: ${foreign.join(', ')}`);
  if (errors.length) failures.push(`${viewport.width}px: console errors: ${errors.join(' | ')}`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) failures.push(`${viewport.width}px: horizontal overflow of ${overflow}px`);

  // Advanced calculator (reachable once onboarded): seed answers and open it.
  await page.evaluate(() => localStorage.setItem('mimush-chacham:answers:v1', JSON.stringify({ version: 1, areaMode: 'sqm', areaText: '167', fractionText: '167/21258', lotId: '', capitalText: '0', repaymentMode: 'none', repaymentText: '', goal: 'balanced', combinationPct: 0.35, developerMarkup: 0.175, basisText: '', deadlineYears: 2 })));
  await page.reload();
  await page.waitForSelector('.answers-bar');
  await page.getByRole('switch', { name: /תצוגה מתקדמת/ }).check();
  await page.getByRole('radio', { name: 'מחשבון ידני' }).click();
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
