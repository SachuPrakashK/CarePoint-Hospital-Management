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

  await page.goto(`${frontend}/roles`);
  await page.getByRole('heading', { name: 'Roles' }).waitFor();
  await page.locator('tbody tr').first().waitFor();
  assert.ok((await page.locator('tbody tr').count()) > 0);
  await page.getByRole('button', { name: /create role/i }).click();
  const roleDialog = page.getByRole('dialog');
  await roleDialog
    .getByText(/permissions/i)
    .first()
    .waitFor();
  assert.ok((await roleDialog.locator('input[type="checkbox"]').count()) > 10);
  await roleDialog.getByRole('button', { name: 'Close' }).click();

  await page.goto(`${frontend}/users`);
  await page.getByRole('heading', { name: 'Users' }).waitFor();
  await page.getByRole('button', { name: /filters/i }).click();
  await page.locator('.filter-panel').waitFor();
  assert.equal(await page.locator('.filter-panel select').count(), 2);
  await page.locator('h1').click();
  await page.locator('.filter-panel').waitFor({ state: 'detached' });

  await page.goto(`${frontend}/settings`);
  await page.getByRole('heading', { name: 'Settings' }).waitFor();
  await page.getByRole('button', { name: 'Application' }).click();
  const name = page.locator('input[formcontrolname="applicationName"]');
  await name.waitFor();
  assert.ok((await name.inputValue()).length > 0);
  await page.getByRole('button', { name: 'Security' }).click();
  assert.ok(await page.locator('input[formcontrolname="passwordMinimumLength"]').isVisible());
  console.log('Roles, Users and Settings browser verification passed.');
} finally {
  await browser.close();
}
