import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Explicit opt-in: these are real provider requests, never fixture responses.
const appUrl = process.env.WAITS_APP_URL || 'http://127.0.0.1:3000';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = `test-results/waits-live-${stamp}`;
const reportPath = `evals/runs/waits-browser-gemini-${stamp}.json`;
await mkdir(output, { recursive: true });
await mkdir('evals/runs', { recursive: true });
const report = { kind: 'real-browser-gemini-seeded-waits', appUrl, recordedAt: new Date().toISOString(), voice: 'Typed browser input; automated speech tests elsewhere are mocks.', waitSource: 'seeded', retries: 'None', requests: [], pageErrors: [], checkpoints: [] };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.on('pageerror', error => report.pageErrors.push(String(error)));
async function submit(text) {
  const pending = page.waitForResponse(response => response.url().endsWith('/api/interpret'), { timeout: 22000 });
  await page.getByTestId('text-input').fill(text);
  await page.getByTestId('submit').click();
  const response = await pending;
  const body = await response.json();
  report.requests.push({ text, status: response.status(), response: body });
  await expect(page.getByTestId('badge-busy')).toHaveCount(0, { timeout: 22000 });
  if (response.status() !== 200 || body.parser !== 'gemini' || body.fallbackReason !== null) throw new Error('A real successful Gemini response with no fallback is required. See recorded response.');
}
async function checkpoint(name, total, wait) {
  await expect(page.getByTestId('total')).toHaveText(total);
  await expect(page.getByTestId('wait-estimate')).toContainText(`${wait} min`);
  report.checkpoints.push({ name, total, waitMinutes: wait, passed: true });
}
try {
  await page.goto(appUrl);
  await expect(page.getByTestId('dining-location')).toHaveValue('188');
  await page.getByRole('checkbox', { name: 'Read replies aloud' }).uncheck();
  await submit("I'd like one Nashville Sandwich - Southern-style Fried Chicken, please.");
  await checkpoint('original', '$9.20', 14);
  await expect(page.getByTestId('swap-price-change')).toContainText('$0.79 more for 1');
  await expect(page.getByTestId('swap-offer')).toContainText('Simulated wait times');
  await page.screenshot({ path: `${output}/offer.png`, fullPage: false });
  await page.getByTestId('accept-swap').click();
  await checkpoint('accepted', '$9.99', 4);
  await expect(page.getByTestId('cart')).toContainText("The Grill at Scotty's");
  await expect(page.getByTestId('dining-location')).toHaveValue('109');
  await submit('Make that two.');
  await checkpoint('conversational edit of replacement', '$19.98', 4);
  await page.getByTestId('undo').click();
  await checkpoint('undo quantity change', '$9.99', 4);
  await page.getByTestId('review').click();
  await page.getByTestId('confirm').click();
  const ticket = page.getByTestId('ticket');
  await expect(ticket).toContainText('$9.99');
  await expect(ticket).toContainText("The Grill at Scotty's");
  await expect(ticket).toContainText('4 min');
  await expect(ticket).toContainText('Simulated wait times');
  report.receipt = await ticket.innerText();
  await page.screenshot({ path: `${output}/receipt.png`, fullPage: true });
  await page.getByTestId('eng-toggle').click();
  const pendingDownload = page.waitForEvent('download');
  await page.getByTestId('export-log').click();
  await (await pendingDownload).saveAs(`${output}/audit.json`);
  await page.goto(appUrl);
  await page.getByRole('checkbox', { name: 'Read replies aloud' }).uncheck();
  await submit("One fresh cut fries and one Nashville Sandwich - Southern-style Fried Chicken, please.");
  await checkpoint('multi-item original', '$12.65', 14);
  await expect(page.getByTestId('swap-cart-change')).toContainText('stays 14 min');
  await page.getByTestId('accept-swap').click();
  await checkpoint('faster item, unchanged whole-cart estimate', '$13.44', 14);
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile horizontal overflow');
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: false });
  if (report.pageErrors.length) throw new Error('Browser page errors');
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = String(error);
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: report.passed, realRequests: report.requests.length, reportPath, output, error: report.error }));
  await browser.close();
}
