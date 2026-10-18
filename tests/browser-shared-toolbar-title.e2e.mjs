import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const env = Object.fromEntries(fs.readFileSync('backend/.env', 'utf8').split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]; }));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
  await page.goto('http://127.0.0.1:4200/auth/sign-in');
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByLabel('Password').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.waitForFunction(() => document.title.startsWith('Dashboard | '));
  await page.setViewportSize({ width: 1280, height: 520 });
  const sidebar = page.locator('aside');
  const sidebarNav = sidebar.locator('.sidebar-nav');
  const scrollbar = await sidebarNav.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      overflowY: style.overflowY,
      overflowX: style.overflowX,
      scrollbarWidth: style.scrollbarWidth,
      scrollbarColor: style.scrollbarColor,
      scrollable: element.scrollHeight > element.clientHeight,
    };
  });
  assert.equal(scrollbar.overflowY, 'auto');
  assert.equal(scrollbar.overflowX, 'hidden');
  assert.equal(scrollbar.scrollbarWidth, 'thin');
  assert.match(scrollbar.scrollbarColor, /rgba?\(255, 255, 255/);
  assert.equal(scrollbar.scrollable, true);
  const logoTop = await sidebar.locator('.logo').evaluate((element) => element.getBoundingClientRect().top);
  const footerBottom = await sidebar.locator('.sidebar-footer').evaluate((element) => element.getBoundingClientRect().bottom);
  await sidebarNav.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  assert.equal(await sidebar.locator('.logo').evaluate((element) => element.getBoundingClientRect().top), logoTop);
  assert.equal(await sidebar.locator('.sidebar-footer').evaluate((element) => element.getBoundingClientRect().bottom), footerBottom);

  await page.goto('http://127.0.0.1:4200/employees');
  await page.getByRole('heading', { name: 'Employees' }).waitFor();
  assert.match(await page.title(), /^Employees \| /);

  const filter = page.getByRole('button', { name: /Filters/ });
  await filter.click();
  const filterDialog = page.getByRole('dialog', { name: 'Filters' });
  await filterDialog.waitFor();
  await filter.click();
  await filterDialog.waitFor({ state: 'detached' });

  const exportButton = page.getByRole('button', { name: /^Export$/ });
  assert.equal(await exportButton.evaluate((element) => getComputedStyle(element).alignItems), 'center');

  const search = page.getByRole('searchbox', { name: 'Search' });
  await search.fill('no-match-e2e-unique-query');
  await page.getByText('No records match your search or filters.').waitFor();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.locator('tbody tr').first().waitFor();

  await page.goto('http://127.0.0.1:4200/pharmacy');
  await page.waitForFunction(() => document.title.startsWith('Pharmacy | '));
  assert.match(await page.title(), /^Pharmacy \| /);
  console.log(JSON.stringify({ sidebarScrollbar: 'passed', sharedFilter: 'passed', sharedExport: 'passed', searchClear: 'passed', routeTitles: 'passed' }));
} finally {
  await browser.close();
}
