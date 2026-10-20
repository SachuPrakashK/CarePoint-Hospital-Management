import { chromium } from 'playwright-core';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync('backend/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
    }),
);
const baseUrl = process.argv[2] || process.env.E2E_BASE_URL || 'http://localhost:4200';
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('response', (response) => {
  if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
});

try {
  await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.goto(`${baseUrl}/audit-logs`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Audit Logs', exact: true }).waitFor();
  if (await page.getByRole('button', { name: /Export/ }).count())
    throw new Error('Export control remains visible');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('dialog', { name: 'Filters' }).waitFor();
  await page.getByLabel('From date').fill('2026-10-18');
  await page.getByLabel('To date').fill('2026-10-01');
  if (await page.getByRole('button', { name: 'Apply' }).isEnabled())
    throw new Error('Invalid date range can be applied');
  await page.getByRole('button', { name: 'Clear' }).click();

  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor();
  const listingText = await firstRow.innerText();
  await firstRow.click();
  await page.waitForURL(/\/audit-logs\/[^/]+$/);
  await page.getByText('Read-only audit record').waitFor();
  const detailText = await page.locator('main').innerText();
  if (!detailText.includes('Event summary') || !detailText.includes('Recorded metadata'))
    throw new Error('Details sections missing');
  if (/\b(Edit|Delete)\b/.test(detailText))
    throw new Error('Mutating action rendered on immutable audit details');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Read-only audit record').waitFor();
  if (!listingText.trim()) throw new Error('Listing row did not contain API data');

  await page.setViewportSize({ width: 390, height: 844 });
  const horizontalOverflow = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    mobileMedia: window.matchMedia('(max-width: 850px)').matches,
    workspaceMargin: getComputedStyle(document.querySelector('.workspace')).marginLeft,
    viewport: document.documentElement.clientWidth,
    width: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('body *')]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.right > document.documentElement.clientWidth + 1)
      .sort((left, right) => right.rect.right - left.rect.right)
      .slice(0, 10)
      .map(
        ({ element, rect }) =>
          `${element.tagName.toLowerCase()}.${element.className}[${Math.round(rect.left)},${Math.round(rect.width)},${Math.round(rect.right)}]`,
      ),
  }));
  if (horizontalOverflow.overflow)
    throw new Error(
      `Audit details page has mobile horizontal overflow: ${JSON.stringify(horizontalOverflow)}`,
    );
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  console.log(
    JSON.stringify({
      listing: 'passed',
      filterValidation: 'passed',
      detailsRoute: 'passed',
      refresh: 'passed',
      mobile: 'passed',
      consoleErrors: 0,
    }),
  );
} finally {
  await browser.close();
}
