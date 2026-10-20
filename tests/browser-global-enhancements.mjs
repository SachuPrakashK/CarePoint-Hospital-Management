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
page.on('console', (message) => {
  const url = message.location().url;
  if (message.type() === 'error' && !url.includes('/settings/hospital/logo'))
    errors.push(`${message.text()} ${url}`);
});
page.on('response', (response) => {
  if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
});
try {
  await page.goto('http://localhost:4200/auth/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  const sidebarText = await page.locator('aside').innerText();
  if (
    sidebarText.indexOf('Help & Support') < 0 ||
    sidebarText.indexOf('Help & Support') > sidebarText.lastIndexOf('Settings')
  )
    throw new Error('Help & Support is not directly ordered above Settings');
  await page.locator('.language-button').click();
  const selectedLanguage = page.getByRole('menuitemradio', { checked: true });
  if (!(await selectedLanguage.innerText()).includes('English'))
    throw new Error('English is not the selected default language');
  await page.keyboard.press('Escape');

  await page.goto('http://localhost:4200/help-support', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Help & Support', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'All support requests' }).waitFor();
  await page.getByRole('button', { name: /Columns/ }).click();
  await page.getByText('Configure Columns', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Create Support Ticket' }).first().click();
  await page.getByRole('button', { name: 'Create Ticket' }).click();
  if ((await page.locator('input[formControlName="subject"].ng-invalid').count()) !== 1)
    throw new Error('Support form required validation did not remain active');
  await page.locator('input[formControlName="subject"]').fill('E2E browser support request');
  await page.locator('select[formControlName="module"]').selectOption('Settings');
  await page.locator('select[formControlName="issueType"]').selectOption('TECHNICAL');
  await page
    .locator('textarea[formControlName="description"]')
    .fill('Verify the complete browser support request workflow.');
  await page.getByRole('button', { name: 'Create Ticket' }).click();
  await page.getByText(/Support request SUP-.* submitted\./).waitFor();
  const ticketSearch = page.getByRole('searchbox', { name: 'Search support tickets' });
  await ticketSearch.fill('E2E browser support request');
  await page.getByText('E2E browser support request', { exact: true }).first().waitFor();
  await page.locator('.ticket-link').first().click();
  await page.getByRole('heading', { name: /^SUP-/ }).waitFor();
  await page.getByRole('heading', { name: 'Status history' }).waitFor();
  await page.locator('.crud-modal__footer .secondary').click();
  const ticketRow = page.locator('tbody tr').filter({ hasText: 'E2E browser support request' }).first();
  await ticketRow.getByRole('combobox', { name: /Status for SUP-/ }).selectOption('IN_PROGRESS');
  await page.getByText(/SUP-.* updated\./).waitFor();
  const articleSearch = page.getByRole('searchbox', { name: 'Search help articles and FAQs' });
  await articleSearch.fill('no-matching-approved-help-content-e2e');
  await page.getByText('No matching help articles').waitFor();
  await articleSearch.fill('');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 8)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
  }));
  if (mobileOverflow.overflow)
    throw new Error(`Help & Support has horizontal overflow on mobile: ${JSON.stringify(mobileOverflow)}`);

  await page.goto('http://localhost:4200/settings', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Languages/ }).click();
  await page.getByRole('heading', { name: 'Language Configuration' }).waitFor();
  await page.getByRole('list', { name: 'Available languages' }).waitFor();
  console.log(
    JSON.stringify({
      sidebarOrder: 'passed',
      englishDefault: 'passed',
      supportRoute: 'passed',
      columnsPanel: 'passed',
      supportValidation: 'passed',
      supportCreate: 'passed',
      supportSearch: 'passed',
      supportDetails: 'passed',
      supportStatusUpdate: 'passed',
      supportResponsive: 'passed',
      languageConfiguration: 'passed',
      consoleErrors: errors.length,
    }),
  );
  if (errors.length) throw new Error(errors.slice(0, 5).join('\n'));
} finally {
  await browser.close();
}
