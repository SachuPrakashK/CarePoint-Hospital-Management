import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../backend/.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:4200/auth/login');
  await page.locator('input[type=email]').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.locator('input[type=password]').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
  await page.goto('http://localhost:4200/opd');
  await page.getByRole('heading', { name: 'OPD & Queue' }).waitFor();
  const rows = page.locator('tbody tr');
  await rows.first().waitFor();
  assert.ok((await rows.count()) >= 2);
  const token = (await rows.first().locator('.token').textContent()).trim();
  assert.match(token, /^[A-Z]+-\d{3}$/);
  const search = page.getByRole('searchbox', { name: 'Search OPD queue' });
  await search.fill(token);
  await page.waitForTimeout(450);
  assert.equal(await page.locator('tbody tr').count(), 1);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.locator('.filter-panel').waitFor();
  assert.ok(await page.locator('.filter-panel').isVisible());
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  const waitingRow = page.locator('tbody tr').filter({ hasText: 'WAITING' }).first();
  if (await waitingRow.count()) {
    await waitingRow.getByRole('button', { name: 'Queue actions' }).click();
    const statusAction = page.getByRole('menuitem', { name: 'CALLED' });
    await statusAction.click();
    await page.waitForTimeout(500);
    await page.reload();
    await page.getByRole('heading', { name: 'OPD & Queue' }).waitFor();
    assert.ok((await page.locator('tbody tr').filter({ hasText: 'CALLED' }).count()) >= 1);
  }
  const source = page.url();
  const first = page.locator('tbody tr').first();
  await first.getByRole('button', { name: 'Queue actions' }).click();
  assert.equal(page.url(), source);
  await page.keyboard.press('Escape');
  await first.click();
  await page.waitForURL(/\/appointments\/[0-9a-f-]+$/);
  await page.getByRole('heading', { name: 'Appointment details' }).waitFor();
  console.log('OPD browser E2E passed.');
} finally {
  await browser.close();
}
