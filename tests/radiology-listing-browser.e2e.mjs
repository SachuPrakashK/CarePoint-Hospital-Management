import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const env = Object.fromEntries(
  fs
    .readFileSync('backend/.env', 'utf8')
    .split(/\r?\n/)
    .filter((x) => x && !x.startsWith('#') && x.includes('='))
    .map((x) => {
      const i = x.indexOf('=');
      return [x.slice(0, i), x.slice(i + 1).replace(/^["']|["']$/g, '')];
    }),
);
const api = 'http://127.0.0.1:3000/api/v1';
const login = await fetch(`${api}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: env.SEED_HOSPITAL_ADMIN_EMAIL,
    password: env.SEED_HOSPITAL_ADMIN_PASSWORD,
  }),
});
const token = (await login.json()).data.access_token;
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const patients = await fetch(`${api}/patients?page=1&page_size=1`, { headers }).then((r) =>
  r.json(),
);
assert.ok(patients.data[0]?.id, 'An active database patient is required');
const marker = `Browser Radiology ${Date.now()}`;
const created = await fetch(`${api}/radiology/orders`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    patientId: patients.data[0].id,
    investigation: 'Ultrasound',
    doctor: marker,
    status: 'Ordered',
  }),
}).then((r) => r.json());
assert.ok(created.data?.id);

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const failures = [];
page.on('response', (r) => {
  if (r.status() >= 500) failures.push(`${r.status()} ${r.url()}`);
});
try {
  await page.goto('http://127.0.0.1:4200/auth/login');
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByLabel('Password').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/dashboard/);
  await page.goto('http://127.0.0.1:4200/radiology');
  await page.getByRole('heading', { name: 'Radiology worklist' }).waitFor();
  const searchBox = await page.getByRole('searchbox').boundingBox(),
    filterBox = await page.getByRole('button', { name: /^Filters/ }).boundingBox(),
    exportBox = await page.getByRole('button', { name: /Export/ }).boundingBox();
  assert.ok(
    searchBox && filterBox && exportBox && searchBox.x < filterBox.x && filterBox.x < exportBox.x,
  );
  await page.getByRole('button', { name: /^Filters/ }).click();
  const panel = page.locator('.filter-panel');
  await panel.waitFor();
  await panel.locator('select').click();
  assert.equal(await panel.isVisible(), true);
  await page.getByRole('heading', { name: 'Radiology worklist' }).click();
  assert.equal(await panel.isVisible(), false);
  await page.getByRole('button', { name: /New radiology order/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('select').first().waitFor();
  assert.ok(
    (await dialog.locator('select').count()) >= 3,
    `Expected Patient, Investigation and Status dropdowns; found ${await dialog.locator('select').count()}`,
  );
  const create = dialog.getByRole('button', { name: 'Create' });
  const db = await dialog.boundingBox(),
    cb = await create.boundingBox();
  assert.ok(db && cb && cb.x > db.x + db.width / 2 && cb.y + cb.height <= db.y + db.height);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('link', { name: 'Manage' }).click();
  await page.waitForURL(/radiology-investigations/);
  const back = page.locator('a.back-link', { hasText: 'Radiology' });
  assert.equal(await back.count(), 1);
  await page.getByRole('button', { name: /Add Radiology Investigation/ }).click();
  const master = page.getByRole('dialog');
  const masterCreate = master.getByRole('button', { name: 'Create' });
  const mb = await master.boundingBox(),
    mcb = await masterCreate.boundingBox();
  assert.ok(mb && mcb && mcb.x > mb.x + mb.width / 2);
  await master.getByRole('button', { name: 'Close' }).click();
  await back.click();
  await page.waitForURL(/\/radiology$/);
  await page.getByRole('searchbox').fill(marker);
  await page.waitForTimeout(1200);
  const row = page.locator('tbody tr').filter({ hasText: marker });
  await row.waitFor();
  await row.locator('td').first().click();
  await page.waitForURL(new RegExp(`/radiology/${created.data.id}$`));
  await page.getByText(marker, { exact: true }).waitFor();
  await page.reload();
  await page.getByText(marker, { exact: true }).waitFor();
  await page.locator('a.back-link', { hasText: 'Radiology' }).click();
  await page.getByRole('searchbox').fill(marker);
  await page.waitForTimeout(1200);
  const row2 = page.locator('tbody tr').filter({ hasText: marker });
  await row2.getByRole('button', { name: 'Radiology order actions' }).click();
  await page.getByRole('menuitem', { name: 'View' }).click();
  await page.waitForURL(new RegExp(`/radiology/${created.data.id}$`));
  assert.deepEqual(failures, []);
  console.log(
    JSON.stringify({
      toolbar: 'passed',
      filterOutsideClick: 'passed',
      modalViewport: 'passed',
      investigationBreadcrumb: 'passed',
      masterFooter: 'passed',
      rowDetails: 'passed',
      actionsView: 'passed',
      directRefresh: 'passed',
      serverErrors: 0,
    }),
  );
} finally {
  await fetch(`${api}/radiology/orders/${created.data.id}`, { method: 'DELETE', headers }).catch(
    () => {},
  );
  await browser.close();
}
