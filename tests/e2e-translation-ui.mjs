import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const api = 'http://localhost:3000/api/v1';
const call = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  return { response, body: await response.json().catch(() => null) };
};

const login = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: process.env.SEED_HOSPITAL_ADMIN_EMAIL,
    password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
  }),
});
assert.equal(login.response.status, 200);
const headers = { authorization: `Bearer ${login.body.data.access_token}` };
const configured = await call('/languages/configuration', { headers });
const code = ['af', 'sq', 'zu'].find(
  (candidate) => !configured.body.data.some((item) => item.code === candidate),
);
assert.ok(code, 'A disposable catalog language is required for the UI test.');
const created = await call('/languages', {
  method: 'POST',
  headers,
  body: JSON.stringify({ code }),
});
assert.equal(created.response.status, 201);
const language = created.body.data;
const enabled = await call(`/languages/${language.id}`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ enabled: true }),
});
assert.equal(enabled.response.status, 200);
const navigationValue = `Dashboard ${Date.now()}`;
const navigationSeed = await call(`/languages/${language.id}/translations`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ values: { 'nav.dashboard': navigationValue } }),
});
assert.equal(navigationSeed.response.status, 200);

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const firstValue = `UI saved ${Date.now()}`;
const updatedValue = `${firstValue} updated`;
const waitForSave = () =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().endsWith(`/languages/${language.id}/translations`),
  );

const openEditor = async () => {
  const row = page.locator('.language-table article', { hasText: language.name });
  await row.getByRole('button', { name: `Actions for ${language.name}` }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await page.getByRole('dialog').waitFor();
};

try {
  const apiUser = login.body.data.user;
  await page.goto('http://localhost:4200');
  await page.evaluate(
    ({ data, user }) =>
      sessionStorage.setItem(
        'carepoint.auth.tab-session',
        JSON.stringify({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
          remember: false,
          user: {
            id: user.id,
            name: `${user.first_name} ${user.last_name}`.trim(),
            email: user.email,
            phone: user.phone ?? undefined,
            role: user.role,
            roles: user.roles,
            permissions: user.permissions,
          },
        }),
      ),
    { data: login.body.data, user: apiUser },
  );
  await page.goto('http://localhost:4200/settings');
  await page.waitForURL('**/settings');
  await page.locator('.settings-nav').waitFor();
  await page.getByRole('button', { name: 'Languages', exact: true }).click();

  await openEditor();
  const commonSave = page
    .locator('label.translation-field', { hasText: 'common.save' })
    .locator('input');
  await commonSave.fill(firstValue);
  const firstSaveResponsePromise = waitForSave();
  await page.getByRole('button', { name: 'Save translations' }).click();
  const firstSaveResponse = await firstSaveResponsePromise;
  assert.deepEqual(firstSaveResponse.request().postDataJSON(), {
    values: { 'common.save': firstValue },
  });
  assert.equal(firstSaveResponse.status(), 200);
  const firstSaveBody = await firstSaveResponse.json();
  assert.equal(firstSaveBody.data.values['common.save'], firstValue);
  await page.getByRole('dialog').waitFor({ state: 'detached' });

  let database = await call(`/languages/${language.id}/translations`, { headers });
  assert.equal(database.body.data.values['common.save'], firstValue);

  await openEditor();
  const reopened = page
    .locator('label.translation-field', { hasText: 'common.save' })
    .locator('input');
  assert.equal(await reopened.inputValue(), firstValue);
  await reopened.fill(updatedValue);
  const updateResponsePromise = waitForSave();
  await page.getByRole('button', { name: 'Save translations' }).click();
  const updateResponse = await updateResponsePromise;
  assert.deepEqual(updateResponse.request().postDataJSON(), {
    values: { 'common.save': updatedValue },
  });
  assert.equal(updateResponse.status(), 200);
  await page.getByRole('dialog').waitFor({ state: 'detached' });

  database = await call(`/languages/${language.id}/translations`, { headers });
  assert.equal(database.body.data.values['common.save'], updatedValue);

  await page.locator('.language-button').click();
  await page
    .locator('.language-dropdown [role="menuitemradio"]', { hasText: language.nativeName })
    .click();
  const dashboardLabel = page.locator('a[href="/dashboard"] .nav-label');
  await dashboardLabel.getByText(navigationValue, { exact: true }).waitFor();
  await page.reload();
  await dashboardLabel.getByText(navigationValue, { exact: true }).waitFor();
  await page.locator('.language-button').click();
  await page.locator('.language-dropdown [role="menuitemradio"]', { hasText: 'English' }).click();
  await dashboardLabel.getByText('Dashboard', { exact: true }).waitFor();
  console.log(
    JSON.stringify({
      browserSaveTriggered: true,
      modalClosedAfterSave: true,
      databaseValueVerified: true,
      editorRepopulated: true,
      updatePersisted: true,
      globalSwitchUpdatedUi: true,
      preferenceSurvivedRefresh: true,
      englishFallbackRestored: true,
    }),
  );
} finally {
  await browser.close();
  const removed = await call(`/languages/${language.id}`, { method: 'DELETE', headers });
  assert.equal(removed.response.status, 204);
}
