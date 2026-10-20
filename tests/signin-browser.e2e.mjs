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

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});

try {
  const page = await browser.newPage();
  await page.goto(process.env.E2E_FRONTEND_URL ?? 'http://localhost:4200/auth/login');
  await page.locator('input[type="email"]').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  assert.match(page.url(), /dashboard/);
  console.log(JSON.stringify({ hospitalAdminSignIn: 'passed' }));
} finally {
  await browser.close();
}
