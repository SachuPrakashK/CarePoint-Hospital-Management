import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

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
const api = 'http://localhost:3000/api/v1';
const request = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  return { response, body: await response.json().catch(() => null) };
};
const login = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: env.SEED_HOSPITAL_ADMIN_EMAIL,
    password: env.SEED_HOSPITAL_ADMIN_PASSWORD,
  }),
});
assert.equal(login.response.status, 200);
const headers = { authorization: `Bearer ${login.body.data.access_token}` };
const suffix = Date.now().toString(36);
const roleName = `Browser Role ${suffix}`;
const created = await request('/roles', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    name: roleName,
    description: 'Created for browser role actions verification.',
    status: 'ACTIVE',
    permissionCodes: ['patients.view'],
  }),
});
assert.equal(created.response.status, 201);
const roleId = created.body.data.id;

let browser;
let page;
let deleted = false;
const errors = [];
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
  });
  const apiUser = login.body.data.user;
  await page.addInitScript(
    (session) => sessionStorage.setItem('carepoint.auth.tab-session', JSON.stringify(session)),
    {
      user: {
        id: apiUser.id,
        name: `${apiUser.first_name} ${apiUser.last_name}`.trim(),
        email: apiUser.email,
        phone: apiUser.phone ?? undefined,
        role: apiUser.role,
        roles: apiUser.roles,
        permissions: apiUser.permissions,
      },
      accessToken: login.body.data.access_token,
      refreshToken: login.body.data.refresh_token,
      expiresAt: Date.now() + login.body.data.expires_in * 1000,
      remember: false,
    },
  );
  await page.goto('http://localhost:4302/roles', { waitUntil: 'networkidle' });

  const search = page.getByRole('searchbox', { name: 'Search' });
  await search.fill(roleName);
  await search.press('Enter');
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.locator('.filter-panel select').selectOption('INACTIVE');
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  assert.equal(await search.inputValue(), roleName);
  assert.equal(await page.locator('.filter-panel').count(), 0);
  await page.getByText(roleName, { exact: true }).waitFor();

  const exportButton = page.getByRole('button', { name: 'Export' });
  const exportStyle = await exportButton.evaluate((element) => ({
    display: getComputedStyle(element).display,
    align: getComputedStyle(element).alignItems,
    gap: getComputedStyle(element).gap,
  }));
  assert.ok(['flex', 'inline-flex'].includes(exportStyle.display));
  assert.equal(exportStyle.align, 'center');
  assert.notEqual(exportStyle.gap, 'normal');

  await page.getByRole('button', { name: 'Columns' }).click();
  const actionsColumnToggle = page.getByRole('checkbox', { name: 'Actions' });
  assert.equal(await actionsColumnToggle.isDisabled(), true);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '+ Create Role' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Create Role' });
  await createDialog.waitFor();
  const permissionLabels = await createDialog.locator('.permission-options label').allInnerTexts();
  assert.ok(permissionLabels.length > 0);
  assert.ok(permissionLabels.every((label) => !/[._-]/.test(label.trim())));
  assert.ok(permissionLabels.every((label) => /^[A-Z]/.test(label.trim())));
  await createDialog.getByRole('button', { name: 'Close' }).click();

  const customRow = page.getByRole('row').filter({ hasText: roleName });
  const customTrigger = customRow.getByRole('button', { name: `Actions for ${roleName}` });
  const actionsHeader = page.getByRole('columnheader', { name: 'Actions' });
  const headerBox = await actionsHeader.boundingBox();
  const triggerBox = await customTrigger.boundingBox();
  assert.ok(headerBox && triggerBox);
  assert.ok(
    Math.abs(headerBox.x + headerBox.width / 2 - (triggerBox.x + triggerBox.width / 2)) < 3,
  );
  assert.equal(
    await customRow
      .locator('td.actions-column')
      .evaluate((element) => getComputedStyle(element).display),
    'table-cell',
  );
  await customTrigger.click();
  await page.locator('.action-menu').waitFor();
  assert.equal(await page.locator('.action-menu').count(), 1);
  assert.equal(await page.getByRole('menuitem', { name: 'View' }).count(), 1);
  assert.equal(await page.getByRole('menuitem', { name: 'Edit' }).count(), 1);
  assert.equal(await page.getByRole('menuitem', { name: 'Delete' }).count(), 1);
  await customTrigger.click();
  await page.locator('.action-menu').waitFor({ state: 'detached' });
  await customTrigger.click();
  await page.locator('.action-menu').waitFor();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.locator('.action-menu').waitFor({ state: 'detached' });

  await customTrigger.evaluate((element) => element.click());
  await page.getByRole('menuitem', { name: 'View' }).evaluate((element) => element.click());
  const details = page.getByRole('dialog', { name: 'Role Details' });
  await details.waitFor();
  assert.ok((await details.innerText()).includes(roleName));
  assert.equal(new URL(page.url()).pathname, '/roles');
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      clearFilters: 'passed',
      searchPreserved: 'passed',
      exportAlignment: 'passed',
      actionsAlignment: 'passed',
      requiredActionsColumn: 'passed',
      menuToggleOutsideAndSingle: 'passed',
      permissionAwareActions: 'passed',
      view: 'passed',
      permissionLabels: 'passed',
      consoleErrors: 0,
    }),
  );
} finally {
  if (browser) await browser.close();
  if (!deleted) await request(`/roles/${roleId}`, { method: 'DELETE', headers });
}
