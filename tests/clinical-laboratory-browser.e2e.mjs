import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../backend/.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, '')];
    }),
);
const frontend = process.env.E2E_FRONTEND_URL ?? 'http://127.0.0.1:4200';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});

try {
  const page = await browser.newPage();
  await page.goto(`${frontend}/auth/login`);
  await page.locator('input[type="email"]').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto(`${frontend}/laboratory`);
  await page.getByRole('heading', { name: 'Laboratory worklist' }).waitFor();
  await page.getByRole('button', { name: /new order/i }).click();
  const dialog = page.getByRole('dialog');
  const create = dialog.getByRole('button', { name: 'Create order' });
  assert.equal(await create.isDisabled(), true);
  const dropdowns = dialog.locator('select');
  assert.equal(await dropdowns.count() >= 4, true);
  for (let index = 0; index < 4; index++) {
    const box = await dropdowns.nth(index).boundingBox();
    assert.ok(box && box.width > 250 && box.y + box.height < 720);
  }
  await dialog.locator('select[formcontrolname="patientId"]').selectOption({ index: 1 });
  await dialog.locator('select[formcontrolname="doctorId"]').selectOption({ index: 1 });
  await dialog.locator('select[formcontrolname="testDefinitionId"]').selectOption({ index: 1 });
  assert.equal(await create.isEnabled(), true);
  await create.click();
  try { await page.getByText('Laboratory order created.').waitFor({ timeout: 10000 }); }
  catch (error) { throw new Error(`Laboratory create failed: ${(await dialog.textContent())?.replace(/\s+/g, ' ').trim()}`, { cause: error }); }
  assert.equal(await dialog.isVisible(), true);
  await dialog.getByRole('button', { name: 'Close' }).click();

  const createdRow = page.locator('tbody tr').first();
  const orderNumber = (await createdRow.locator('td').first().locator('b').textContent())?.trim();
  assert.ok(orderNumber);
  const search = page.getByRole('searchbox', { name: 'Search laboratory orders' });
  await search.fill(orderNumber);
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('tbody tr').count(), 1);
  await page.reload();
  await page.getByRole('heading', { name: 'Laboratory worklist' }).waitFor();
  const filterButton = page.getByRole('button', { name: /^Filters/ });
  await filterButton.click();
  const filterPanel = page.locator('.filter-panel');
  await filterPanel.waitFor();
  await filterPanel.locator('select').first().click();
  assert.equal(await filterPanel.isVisible(), true);
  await page.getByRole('heading', { name: 'Laboratory worklist' }).click();
  assert.equal(await filterPanel.isVisible(), false);
  await filterButton.click();
  await filterButton.click();
  assert.equal(await filterPanel.isVisible(), false);
  await page.getByRole('searchbox', { name: 'Search laboratory orders' }).fill(orderNumber);
  await page.waitForTimeout(1500);
  const row = page.locator('tbody tr').first();
  assert.match((await row.textContent()) ?? '', new RegExp(orderNumber));
  await row.click();
  await page.waitForURL(/\/laboratory\/[0-9a-f-]+$/);
  await page.getByRole('heading', { name: 'Laboratory order' }).waitFor();
  await page.getByText(orderNumber, { exact: true }).waitFor();
  assert.match((await page.textContent('body')) ?? '', new RegExp(orderNumber));

  await page.goto(`${frontend}/laboratory-tests`);
  await page.getByRole('heading', { name: 'Laboratory Test Definitions' }).waitFor();
  const laboratoryBack = page.getByRole('link', { name: 'Laboratory' }).last();
  assert.equal(await laboratoryBack.count(), 1);
  await page.getByRole('button', { name: /add laboratory test definition/i }).click();
  const masterDialog = page.getByRole('dialog');
  const masterCreate = masterDialog.getByRole('button', { name: 'Create' });
  const masterBox = await masterDialog.boundingBox();
  const masterButtonBox = await masterCreate.boundingBox();
  assert.ok(masterBox && masterButtonBox && masterButtonBox.x > masterBox.x + masterBox.width / 2);
  await masterDialog.getByRole('button', { name: 'Close' }).click();
  const testSearch = page.getByRole('searchbox', { name: /search tests/i });
  await testSearch.fill('CBC');
  await page.waitForTimeout(500);
  assert.equal(await page.locator('tbody tr').count() > 0, true);
  await laboratoryBack.click();
  await page.waitForURL(/\/laboratory$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /new order/i }).click();
  const mobileDialog = page.getByRole('dialog');
  const mobileFirst = await mobileDialog.locator('select').nth(0).boundingBox();
  const mobileSecond = await mobileDialog.locator('select').nth(1).boundingBox();
  assert.ok(mobileFirst && mobileSecond && Math.abs(mobileFirst.width - mobileSecond.width) < 2 && Math.abs(mobileFirst.x - mobileSecond.x) < 2);
  await mobileDialog.getByRole('button', { name: 'Close' }).click();
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto(`${frontend}/opd`);
  await page.getByRole('heading', { name: 'OPD & Queue' }).waitFor();
  const queueCards = page.locator('.queue-stats .metric-card');
  assert.equal(await queueCards.count(), 4);
  const cardBackgrounds = await queueCards.evaluateAll((cards) => cards.map((card) => getComputedStyle(card).backgroundImage));
  assert.equal(new Set(cardBackgrounds).size, 4);
  await page.getByRole('button', { name: /^Filters/ }).click();
  const opdPanel = page.locator('.filter-panel');
  await opdPanel.waitFor();
  const opdWidths = await opdPanel.locator('select,input').evaluateAll((controls) => controls.map((control) => control.getBoundingClientRect().width));
  assert.equal(opdWidths.every((width) => Math.abs(width - opdWidths[0]) < 2), true);
  await page.getByRole('heading', { name: 'OPD & Queue' }).click();
  assert.equal(await opdPanel.isVisible(), false);

  await page.goto(`${frontend}/clinical`);
  const openRecord = page.getByRole('link', { name: /open record/i }).first();
  await openRecord.focus();
  assert.equal(await openRecord.evaluate((element) => element.matches(':focus-visible')), true);
  await openRecord.click();
  await page.locator('.page-head h1').waitFor();
  const emrUrl = page.url();
  await page.reload();
  await page.locator('.page-head h1').waitFor();
  assert.equal(page.url(), emrUrl);
  await page.getByText(/No medications recorded|Loading medications|Medication information could not be loaded/).waitFor();
  await page.getByRole('button', { name: 'Timeline' }).click();
  const timelineFilters = page.locator('.timeline-heading').getByRole('button', { name: /^Filters/ });
  await timelineFilters.click();
  const timelinePanel = page.locator('.timeline-filter-panel');
  await timelinePanel.waitFor();
  const timelineFields = timelinePanel.locator('.field');
  const firstWidth = (await timelineFields.nth(0).boundingBox())?.width;
  const secondWidth = (await timelineFields.nth(1).boundingBox())?.width;
  assert.ok(firstWidth && secondWidth && Math.abs(firstWidth - secondWidth) < 2);
  await timelinePanel.locator('.app-calendar .days button').first().click();
  assert.equal(await timelinePanel.isVisible(), true);
  await timelinePanel.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByText(/No clinical records found|Clinical events shown/).first().waitFor();

  console.log(JSON.stringify({ laboratoryCreate: 'passed', refreshPersistence: 'passed', laboratoryDetails: 'passed', laboratoryFilters: 'passed', createOrderResponsiveLayout: 'passed', testDefinitionBreadcrumbAndFooter: 'passed', opdCardVariantsAndFilters: 'passed', emrDirectRefresh: 'passed', medicationState: 'passed', emrTimelineFilters: 'passed' }));
} finally {
  await browser.close();
}
