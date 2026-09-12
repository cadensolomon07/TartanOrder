import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Explicitly run this script only after rebuilding the target app. It is not part
// of npm test. All utterances below are fictional test data, never human profiles.
// Seven real Gemini requests; no retry, mock, credential loading or provider fallback.
const appUrl = process.env.MEAL_APP_URL || 'http://127.0.0.1:3000';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = fileURLToPath(new URL(`../../work/meal-browser-${stamp}.json`, import.meta.url));
const report = {
  kind: 'real-browser-meal-gemini-synthetic', appOrigin: new URL(appUrl).origin,
  recordedAt: new Date().toISOString(),
  evidence: 'Synthetic typed browser input, including the spoken-equivalent decision phrase; no human microphone trial.',
  retries: 'None', requests: [], checkpoints: [], pageErrorCount: 0,
  passed: false, failedCheckpoint: null,
};
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.setDefaultTimeout(10000);
let activeCheckpoint = 'startup';
let actualRequests = 0;
page.on('pageerror', () => { report.pageErrorCount += 1; });
page.on('request', request => { if (new URL(request.url()).pathname === '/api/interpret') actualRequests += 1; });

async function checkpoint(id, verify) {
  activeCheckpoint = id;
  await verify();
  report.checkpoints.push({ id, passed: true });
}
async function freshSession(id) {
  activeCheckpoint = id;
  await page.goto(appUrl);
  await expect(page.getByTestId('requirements-panel')).toBeVisible();
  await page.getByTestId('dining-location').selectOption('demo');
  await expect(page.getByTestId('dining-location')).toHaveValue('demo');
  await expect(page.getByTestId('price-source')).toContainText('Fictional recipes');
  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await expect(page.getByTestId('dietary-preference')).toHaveValue('none');
  await page.getByRole('checkbox', { name: 'Read replies aloud' }).uncheck();
  await page.getByTestId('eng-toggle').click();
  await expect(page.getByTestId('local-only')).not.toBeChecked();
  await page.getByTestId('eng-toggle').click();
}
async function submit(id, text) {
  activeCheckpoint = id;
  if (actualRequests >= 8) throw new Error('Synthetic request cap reached.');
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/interpret', { timeout: 22000 });
  await page.getByTestId('text-input').fill(text);
  await page.getByTestId('submit').click();
  const response = await pending;
  const body = await response.json();
  const record = {
    id, httpStatus: response.status(),
    parserMode: ['gemini', 'rules', 'fixture'].includes(body.parser) ? body.parser : 'unexpected',
    fallback: body.fallbackReason !== null, passed: false,
  };
  report.requests.push(record);
  // Do not log body, text, requirement values, DOM content or assertion details.
  if (response.status() !== 200 || body.parser !== 'gemini' || body.fallbackReason !== null) throw new Error('Real Gemini with no fallback required.');
  await expect(page.getByTestId('badge-busy')).toHaveCount(0, { timeout: 22000 });
  await expect(page.getByTestId('badge-parser')).toContainText('gemini');
  record.passed = true;
}
async function openExcluded() {
  const excluded = page.getByTestId('excluded-menu');
  await expect(excluded).toBeVisible();
  if (await excluded.getAttribute('open') === null) await excluded.locator('summary').click();
}

try {
  await freshSession('meal-session');
  await submit('exact-budget-request', 'I have twelve dollars. Get me a main, a side, and a drink. Keep the fries and lemonade.');
  await checkpoint('exact-budget-accepted', async () => {
    await expect(page.getByTestId('cart').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('cart')).toContainText('Grilled Cheese');
    await expect(page.getByTestId('cart')).toContainText('Fries');
    await expect(page.getByTestId('cart')).toContainText('Lemonade');
    await expect(page.getByTestId('total')).toHaveText('$12.00');
    await expect(page.getByTestId('meal-requirement-summary')).toContainText('Menu budget $12.00');
    for (const component of ['mains', 'sides', 'drinks']) await expect(page.getByTestId(`component-${component}`)).toBeChecked();
    await expect(page.getByTestId('lock-fries')).toHaveText('Unlock');
    await expect(page.getByTestId('lock-lemonade')).toHaveText('Unlock');
    await expect(page.getByTestId('meal-remaining')).toContainText('$0.00');
    await expect(page.getByTestId('requirements-decision')).toHaveCount(0);
    await expect(page.getByTestId('confirm')).toHaveCount(0);
  });
  const acceptedLineIds = await page.getByTestId('cart').locator('li').evaluateAll(rows => rows.map(row => row.getAttribute('data-line-id')));
  const acceptedCartText = await page.getByTestId('cart').innerText();
  await submit('conflicting-main-request', 'Actually, make it a chicken sandwich.');
  await checkpoint('conflict-preserves-accepted-meal', async () => {
    expect(await page.getByTestId('cart').locator('li').evaluateAll(rows => rows.map(row => row.getAttribute('data-line-id')))).toEqual(acceptedLineIds);
    expect(await page.getByTestId('cart').innerText()).toBe(acceptedCartText);
    await expect(page.getByTestId('total')).toHaveText('$12.00');
    await expect(page.getByTestId('meal-budget')).toHaveValue('12.00');
    await expect(page.getByTestId('requirements-decision')).toBeVisible();
    await expect(page.getByTestId('proposed-meal')).toContainText('Proposed · not applied');
    await expect(page.getByTestId('proposed-meal')).toContainText('Chicken Sandwich');
    await expect(page.getByTestId('proposed-meal')).toContainText('$14.00');
    await expect(page.getByTestId('proposed-meal')).toContainText('$2.00 more');
    await expect(page.getByTestId('requirement-choice-raise_budget')).toBeEnabled();
    await expect(page.getByTestId('requirement-choice-keep')).toBeEnabled();
    await expect(page.getByTestId('review')).toBeDisabled();
    await expect(page.getByTestId('confirm')).toHaveCount(0);
  });
  await submit('explicit-budget-decision', 'Yes, increase the budget to fourteen dollars.');
  await checkpoint('explicit-budget-applied', async () => {
    await expect(page.getByTestId('requirements-decision')).toHaveCount(0);
    await expect(page.getByTestId('cart').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('cart')).toContainText('Chicken Sandwich');
    await expect(page.getByTestId('cart')).not.toContainText('Grilled Cheese');
    await expect(page.getByTestId('total')).toHaveText('$14.00');
    await expect(page.getByTestId('meal-budget')).toHaveValue('14.00');
    await expect(page.getByTestId('lock-fries')).toHaveText('Unlock');
    await expect(page.getByTestId('lock-lemonade')).toHaveText('Unlock');
    await expect(page.getByTestId('review')).toBeEnabled();
  });
  await checkpoint('review-and-explicit-simulated-receipt', async () => {
    await expect(page.getByTestId('ticket')).toHaveCount(0);
    await page.getByTestId('review').click();
    await expect(page.getByTestId('review-total')).toHaveText('$14.00');
    for (const label of ['1× Chicken Sandwich', '1× Fries', '1× Lemonade']) await expect(page.getByTestId('review')).toContainText(label);
    await page.getByTestId('confirm').click();
    await expect(page.getByTestId('ticket')).toContainText('$14.00');
    await expect(page.getByTestId('ticket')).toContainText('Simulated');
    await expect(page.getByTestId('ticket')).toContainText('Nothing was sent');
  });

  await freshSession('preference-session');
  await submit('preference-declaration', "I'm vegan.");
  await checkpoint('supported-preference-filter', async () => {
    await expect(page.getByTestId('dietary-preference')).toHaveValue('vegan');
    await expect(page.getByTestId('requirements-panel').getByRole('button', { name: 'Preference: vegan ×', exact: true })).toBeVisible();
    await expect(page.getByTestId('compatibility-fries')).toContainText('Matches recorded requirements');
    await openExcluded();
    await expect(page.getByTestId('compatibility-grilled_cheese')).toContainText('Conflicts with requirements');
    await expect(page.getByTestId('cart-empty')).toBeVisible();
  });
  await submit('preference-conflicting-food', 'Add a grilled cheese, please.');
  await checkpoint('known-preference-conflict-preserves-empty-cart', async () => {
    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await expect(page.getByTestId('dietary-preference')).toHaveValue('vegan');
    await expect(page.getByTestId('requirements-decision')).toBeVisible();
    await expect(page.getByTestId('requirements-decision')).toContainText(/vegan|milk|dairy/i);
    await expect(page.getByTestId('confirm')).toHaveCount(0);
  });

  await freshSession('allergy-session');
  await submit('allergy-plus-conflicting-food', 'I have a sesame allergy. Add a burger, please.');
  await checkpoint('allergy-kept-and-food-blocked', async () => {
    await expect(page.getByTestId('requirements-panel').getByRole('button', { name: 'Allergy: sesame ×', exact: true })).toBeVisible();
    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await expect(page.locator('[data-testid="requirements-decision"]:visible, [data-testid="requirements-message"]:visible').first()).toContainText(/sesame/i);
    await expect(page.getByTestId('staff-summary')).toBeVisible();
    await page.getByTestId('staff-summary').locator('summary').click();
    await expect(page.getByTestId('staff-summary')).toContainText('No staff member has been contacted');
    await expect(page.getByTestId('requirement-choice-allow_preference')).toHaveCount(0);
    await expect(page.getByTestId('confirm')).toHaveCount(0);
  });

  await freshSession('unknown-allergen-session');
  await submit('additional-allergen-declaration', 'I am allergic to kiwi fruit.');
  await checkpoint('unknown-allergen-persists-with-staff-review', async () => {
    await expect(page.getByTestId('requirements-panel').getByRole('button', { name: /Allergy: kiwi(?: fruit)? ×/ })).toBeVisible();
    await expect(page.getByTestId('menu-match-count')).toContainText('0 choices match');
    await openExcluded();
    await expect(page.getByTestId('compatibility-burger')).toContainText('Needs verification');
    await expect(page.getByTestId('menu-burger')).toBeDisabled();
    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await expect(page.getByTestId('staff-summary')).toBeVisible();
    await expect(page.getByTestId('confirm')).toHaveCount(0);
  });
  await checkpoint('bounded-real-provider-traffic-and-clean-browser', async () => {
    expect(actualRequests).toBe(7);
    expect(report.requests).toHaveLength(7);
    expect(report.requests.every(record => record.passed && !record.fallback && record.parserMode === 'gemini')).toBe(true);
    expect(report.pageErrorCount).toBe(0);
  });
  report.passed = true;
} catch (error) {
  // Playwright errors may contain full DOM/profile values: do not serialize them.
  report.failedCheckpoint = activeCheckpoint;
  // A numeric source line identifies the failed assertion without retaining the
  // assertion's error text, which can include complete requirement values.
  const ownLine = typeof error?.stack === 'string' ? error.stack.match(/verify-meal-browser\.mjs:(\d+):/) : null;
  report.failedScriptLine = ownLine ? Number(ownLine[1]) : null;
  process.exitCode = 1;
} finally {
  report.requestCount = actualRequests;
  await mkdir(fileURLToPath(new URL('../../work/', import.meta.url)), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: report.passed, requestCount: actualRequests, failedCheckpoint: report.failedCheckpoint, reportPath }));
  await browser.close();
}
