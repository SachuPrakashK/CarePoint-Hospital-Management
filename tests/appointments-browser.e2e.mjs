import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../backend/.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, '')]; }),
);
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:4200/auth/sign-in');
  await page.locator('input[type="email"]').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
  await page.goto('http://localhost:4200/appointments');
  await page.getByRole('heading', { name: 'Appointments' }).waitFor();

  const search = page.getByRole('searchbox', { name: 'Search appointments' });
  await search.fill('APT');
  await page.waitForTimeout(500);
  assert.equal(await page.getByRole('button', { name: 'Clear search' }).count(), 1);
  await page.getByRole('button', { name: 'Clear search' }).click();
  assert.equal(await search.inputValue(), '');

  await page.getByRole('button', { name: /^Filters/ }).click();
  const department = page.locator('.filter-panel select').nth(0);
  const firstDepartment = await department.locator('option').nth(1).getAttribute('value');
  assert.ok(firstDepartment);
  await department.selectOption(firstDepartment);
  const doctorOptions = await page.locator('.filter-panel select').nth(1).locator('option').count();
  assert.ok(doctorOptions >= 1);
  await page.getByRole('button', { name: 'Clear Filters' }).click();

  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.count()) {
    const listUrl = page.url();
    await firstRow.getByRole('button', { name: 'Appointment actions' }).click();
    assert.equal(page.url(), listUrl);
    await page.keyboard.press('Escape');
    await firstRow.click();
    await page.waitForURL(/\/appointments\/[0-9a-f-]+$/);
    await page.getByRole('heading', { name: 'Appointment details' }).waitFor();
    await page.goBack();
  }

  await page.getByRole('tab', { name: 'Calendar' }).click();
  await page.locator('.week .day').first().waitFor();
  assert.equal(await page.locator('.week .day').count(), 7);
  const currentLabel = await page.locator('.week-current b').textContent();
  await page.getByRole('button', { name: 'Next week' }).click();
  await page.waitForTimeout(300);
  assert.notEqual(await page.locator('.week-current b').textContent(), currentLabel);
  await page.locator('.week-current').click();
  await page.waitForFunction((label) => document.querySelector('.week-current b')?.textContent === label, currentLabel);
  assert.equal(await page.locator('.week-current b').textContent(), currentLabel);

  await page.getByRole('button', { name: 'New appointment' }).click();
  const sourceUrl = page.url();
  const submit = page.getByRole('button', { name: 'Create appointment' });
  assert.equal(await submit.isDisabled(), true);
  assert.equal(page.url(), sourceUrl);

  const modal = page.getByRole('dialog').filter({ hasText: 'Create appointment' });
  await modal.locator('select[formcontrolname="patientId"]').selectOption({ index: 1 });
  const departmentSelect = modal.locator('select[formcontrolname="departmentId"]');
  const departmentValues = await departmentSelect.locator('option').evaluateAll((options) => options.slice(1).map((option) => option.value));
  let matchedDepartment = '';
  for (const value of departmentValues) {
    await departmentSelect.selectOption(value);
    if (await modal.locator('select[formcontrolname="doctorId"] option').count() > 1) { matchedDepartment = value; break; }
  }
  assert.ok(matchedDepartment);
  await modal.locator('select[formcontrolname="doctorId"]').selectOption({ index: 1 });
  const appointmentDate = `2026-11-${String(20 + (Date.now() % 8)).padStart(2, '0')}`;
  await modal.locator('input[formcontrolname="date"]').fill(appointmentDate);
  await modal.locator('select[formcontrolname="time"]').selectOption('10:15');
  const reason = `Browser E2E ${Date.now()}`;
  await modal.locator('textarea[formcontrolname="reason"]').fill(reason);
  await submit.click();
  await modal.waitFor({ state: 'hidden' });
  await page.getByRole('tab', { name: 'List' }).waitFor();
  await search.fill(reason);
  await page.waitForTimeout(500);
  assert.equal(await page.locator('tbody tr').count(), 1);
  await page.reload();
  await page.getByRole('heading', { name: 'Appointments' }).waitFor();
  await page.getByRole('searchbox', { name: 'Search appointments' }).fill(reason);
  await page.waitForTimeout(500);
  const createdRow = page.locator('tbody tr').first();
  await createdRow.getByRole('button', { name: 'Appointment actions' }).click();
  await page.getByRole('menuitem', { name: 'Change Status' }).click();
  const statusModal = page.getByRole('dialog').filter({ hasText: 'Change appointment status' });
  await statusModal.locator('select').selectOption('CONFIRMED');
  await statusModal.getByRole('button', { name: 'Update' }).click();
  await statusModal.waitFor({ state: 'hidden' });
  assert.match(await page.locator('tbody tr').first().textContent(), /CONFIRMED/);
  await page.reload();
  await page.getByRole('searchbox', { name: 'Search appointments' }).fill(reason);
  await page.waitForTimeout(500);
  assert.match(await page.locator('tbody tr').first().textContent(), /CONFIRMED/);
  console.log('Appointments browser E2E passed.');
} finally {
  await browser.close();
}
