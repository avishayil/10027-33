/**
 * V1.0 Milestone E browser checks (RELEASE-CRITERIA), on a production build served under the deployed base path:
 *  - the wizard can be completed with the keyboard only; the document is RTL Hebrew;
 *  - no serious or critical accessibility violations (axe, WCAG 2 A/AA) in the wizard, the summary and the advanced view;
 *  - print shows the snapshot header and the report and hides the controls; print is disabled while recalculating;
 *  - the actual-offer check sends nothing and stores nothing; "forget" removes every app key;
 *  - the shared-device warning is shown before saving;
 *  - timings at 4× CPU slowdown against the proposed budgets (reported; fails only far beyond them).
 * Usage: node tests/e2e/release.mjs   (E2E_DIST, E2E_BASE as for privacy.mjs; E2E_PERF_OUT=<file> writes timings)
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { serve } from './server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');

const failures = [];
const timings = {};
const srv = await serve();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const requests = [];
const errors = [];
page.on('request', (r) => requests.push(r.url()));
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const axe = async (where) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  for (const v of bad) failures.push(`axe (${where}): ${v.id} — ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target?.join(' ')}`);
};
/** Press Tab until the focused element matches; fails if it is not reachable. */
const tabTo = async (selector, what, max = 40) => {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), selector)) return true;
  }
  failures.push(`keyboard: could not reach ${what} with Tab`);
  return false;
};

await page.goto(srv.url);
await page.waitForSelector('.wizard');
// RTL Hebrew document.
const dir = await page.evaluate(() => [document.documentElement.dir, document.documentElement.lang].join('/'));
if (dir !== 'rtl/he') failures.push(`document is ${dir}, expected rtl/he`);
await axe('wizard');

// Keyboard-only wizard.
const submit = '.wizard-actions button[type=submit]';
const step = async (title) => (await page.locator('.wizard-title').textContent())?.includes(title);
await tabTo(submit, 'next (welcome)');
await page.keyboard.press('Enter');
await tabTo(submit, 'next (land)');
await page.keyboard.press('Enter');
if (await tabTo('input', 'capital input')) await page.keyboard.type('350000');
await page.keyboard.press('Enter');
if (await tabTo('input', 'repayment input')) await page.keyboard.type('6000');
await page.keyboard.press('Enter');
if (await tabTo('input[type=radio]', 'a goal')) await page.keyboard.press('Space');
await tabTo(submit, 'next (goal)');
await page.keyboard.press('Enter');
if (await tabTo('.ack input', 'the acknowledgement')) await page.keyboard.press('Space');
await tabTo(submit, 'next (terms)');
await page.keyboard.press('Enter');
// Summary: the shared-device warning before the save box is used.
if (!(await page.locator('.shared-device-warning').isVisible())) failures.push('shared-device warning not shown at the save box');
if (await tabTo('.ack input', 'the save box')) await page.keyboard.press('Space');
await tabTo(submit, 'finish');
await page.keyboard.press('Enter');
try {
  await page.waitForSelector('.priorities', { timeout: 15_000 });
} catch {
  failures.push(`keyboard: wizard not completed (stuck at "${await page.locator('.wizard-title').textContent().catch(() => '?')}")`);
}
void step;
// The previous result is dimmed (aria-busy) while a newer one computes — a transient state; check the settled page.
await page.waitForFunction(() => !document.querySelector('.results-updating'), null, { timeout: 15_000 });
await axe('summary');

/** Money must read correctly: never "1,000 אלף" (that is a million), no "1.00 / 1.50 מיליון", no English "K". */
const badNumbers = async (where) => {
  const text = await page.evaluate(() => document.body.innerText);
  const bad = [...text.matchAll(/\d{1,3}(,\d{3})+ אלף|\d\.\d*0 מיליון|\d\.0+ מיליון|\d+K\b/g)].map((m) => m[0]);
  if (bad.length) failures.push(`numbers (${where}): ${[...new Set(bad)].slice(0, 5).join(' | ')}`);
};
await badNumbers('summary');

// Advanced view, offer check: nothing sent, nothing stored.
await page.getByRole('switch', { name: /תצוגה מתקדמת/ }).check();
await page.waitForSelector('#offer-title');
await page.waitForFunction(() => !document.querySelector('.results-updating'), null, { timeout: 15_000 });
await axe('advanced view');
await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
await badNumbers('advanced view');
const before = requests.length;
const offer = page.locator('section[aria-labelledby="offer-title"]');
await offer.getByLabel('אחוז קומבינציה (%)').fill('41.5');
await offer.getByText('לפי ההצעה').waitFor({ timeout: 15_000 });
await page.waitForTimeout(300);
if (requests.length > before) failures.push(`offer check triggered requests: ${requests.slice(before).join(', ')}`);
const stored = await page.evaluate(() => Object.keys(localStorage).map((k) => `${k}=${localStorage.getItem(k)}`).join('\n'));
if (/0\.415|41\.5/.test(stored)) failures.push('offer terms found in localStorage');

// Print: the snapshot header and the report; controls hidden.
await page.emulateMedia({ media: 'print' });
const header = page.locator('.print-header');
if (!(await header.isVisible())) failures.push('print: header not visible');
else if (!/חישוב [0-9a-f]{8}/.test((await header.textContent()) ?? '')) failures.push('print: snapshot id missing in the header');
if (!(await page.locator('.print-report').isVisible())) failures.push('print: report not visible');
if (await page.locator('.answers-bar').isVisible()) failures.push('print: answers bar (controls) printed');
if (await page.locator('.offer-grid').isVisible()) failures.push('print: offer form printed');
await badNumbers('print');
await page.emulateMedia({ media: 'screen' });

// Stale then print: right after an input change the print button is disabled; it comes back when the result is current.
const printBtn = page.getByRole('button', { name: 'הדפסת סיכום לפגישה' }).first();
await page.getByLabel('רווח יזמי בשירותי בנייה').fill('0.15');
if (!(await printBtn.isDisabled())) failures.push('print enabled while a newer calculation is pending');
await page.waitForFunction(() => !document.querySelector('.results-updating'), null, { timeout: 15_000 });
if (await printBtn.isDisabled()) failures.push('print still disabled after the calculation finished');

// Performance at 4× CPU slowdown.
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const slider = page.getByLabel('רווח יזמי בשירותי בנייה');
timings.inputPaintMs = await slider.evaluate(
  (el) =>
    new Promise((resolve) => {
      const t = performance.now();
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(el, '0.18');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(Math.round(performance.now() - t))));
    }),
);
const t0 = Date.now();
await page.waitForFunction(() => !!document.querySelector('.results-updating'), null, { timeout: 5000 }).catch(() => {});
await page.waitForFunction(() => !document.querySelector('.results-updating'), null, { timeout: 30_000 });
timings.recalculationMs = Date.now() - t0; // includes the 250 ms debounce
const joint = page.locator('section[aria-labelledby="joint-title"]');
const t1 = Date.now();
await joint.getByRole('button', { name: 'חיפוש תנאים' }).click();
await joint.getByText(/נבדקו \d+ חוזים/).waitFor({ timeout: 120_000 });
timings.jointSearchMs = Date.now() - t1;
const t2 = Date.now();
await offer.getByLabel('אחוז קומבינציה (%)').fill('42');
await page.waitForTimeout(50);
await offer.getByText('לפי ההצעה').waitFor({ timeout: 30_000 });
timings.offerCheckMs = Date.now() - t2;
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const BUDGET = { inputPaintMs: 100, recalculationMs: 1250, jointSearchMs: 3000, offerCheckMs: 1000 };
for (const [k, b] of Object.entries(BUDGET)) if (timings[k] > 3 * b) failures.push(`performance: ${k} ${timings[k]} ms is more than 3× the budget (${b} ms)`);

// Reset: forget removes every app key.
await page.getByRole('button', { name: 'מחיקת התשובות השמורות' }).click();
const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mimush-chacham:')));
if (left.length) failures.push(`forget left keys: ${left.join(', ')}`);

const foreign = requests.filter((u) => !u.startsWith(srv.origin) && !u.startsWith('data:'));
if (foreign.length) failures.push(`cross-origin requests: ${foreign.join(', ')}`);
if (errors.length) failures.push(`console errors: ${errors.join(' | ')}`);

await browser.close();
srv.close();
console.log(`timings at 4× CPU slowdown: ${JSON.stringify(timings)}`);
if (process.env.E2E_PERF_OUT) writeFileSync(process.env.E2E_PERF_OUT, JSON.stringify(timings, null, 2) + '\n');
if (failures.length) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log('release/e2e: OK — keyboard, RTL, accessibility, print, stale print, offer privacy, reset, performance');
