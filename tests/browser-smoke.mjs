import { chromium } from 'playwright-core';
import fs from 'node:fs';
const env = Object.fromEntries(
  fs
    .readFileSync('backend/.env', 'utf8')
    .split(/\r?\n/)
    .filter((x) => x && !x.startsWith('#') && x.includes('='))
    .map((x) => {
      const i = x.indexOf('=');
      return [x.slice(0, i), x.slice(i + 1).replace(/^['"]|['"]$/g, '')];
    }),
);
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
});
try {
  await page.goto('http://localhost:4200/auth/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByLabel('Password').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.goto('http://localhost:4200/operations', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Add item/ }).click();
  const modal = page.getByRole('dialog');
  await modal.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  if (!(await modal.isVisible())) throw new Error('Escape closed CRUD modal');
  await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } });
  if (!(await modal.isVisible())) throw new Error('Backdrop closed CRUD modal');
  await modal.getByRole('button', { name: 'Close' }).click();
  await modal.waitFor({ state: 'hidden' });
  await page.goto('http://localhost:4200/pharmacy', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Stock receipt/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.goto('http://localhost:4200/laboratory', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /New order/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.goto('http://localhost:4200/radiology', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /New radiology order/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.goto('http://localhost:4200/billing', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /New invoice/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.goto('http://localhost:4200/insurance', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Create claim/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.goto('http://localhost:4200/patients', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Patients' }).waitFor();
  console.log(
    JSON.stringify({
      login: 'passed',
      dashboard: 'passed',
      operationsModal: 'passed',
      pharmacyModal: 'passed',
      laboratoryModal: 'passed',
      radiologyModal: 'passed',
      billingModal: 'passed',
      insuranceModal: 'passed',
      patients: 'passed',
      consoleErrors: errors.length,
    }),
  );
  if (errors.length) console.error(errors.slice(0, 5));
} finally {
  await browser.close();
}
