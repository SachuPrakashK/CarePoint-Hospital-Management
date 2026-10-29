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
page.on('response', (r) => {
  if (r.status() >= 400) {
    const value = `${r.status()} ${r.url()}`;
    errors.push(value);
    console.error(value);
  }
});
const stamp = Date.now().toString().slice(-8);
async function createEditDeactivate(
  path,
  code,
  name,
  extraLabel,
  extraValue,
  dependentPath,
  createButton,
  selectLabel,
) {
  await page.goto(`http://127.0.0.1:4200/${path}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Add/ }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Code').fill(code);
  await modal.getByLabel('Name').fill(name);
  await modal.getByLabel(extraLabel).fill(extraValue);
  const created = page.waitForResponse(
    (r) => r.url().includes(`/api/v1/masters/${path}`) && r.request().method() === 'POST',
  );
  await modal.getByRole('button', { name: 'Create' }).click();
  if (!(await created).ok()) throw new Error(`${path} create failed`);
  if (!(await modal.isVisible())) throw new Error(`${path} closed after create`);
  await modal.getByRole('button', { name: 'Close' }).click();
  await modal.waitFor({ state: 'hidden' });
  await page.reload({ waitUntil: 'networkidle' });
  const searched = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/v1/masters/${path}`) &&
      new URL(r.url()).searchParams.get('search') === name,
  );
  await page.getByPlaceholder('Search').fill(name);
  await searched;
  const row = page.getByRole('row').filter({ hasText: name });
  await row.getByRole('button', { name: `${name} actions` }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill(`${name} Updated`);
  const updatedResponse = page.waitForResponse(
    (r) => r.url().includes(`/api/v1/masters/${path}/`) && r.request().method() === 'PUT',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();
  if (!(await updatedResponse).ok()) throw new Error(`${path} update failed`);
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.goto(`http://127.0.0.1:4200/${dependentPath}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: createButton }).click();
  const lookup = page.getByLabel(selectLabel);
  const fallbackValue = await lookup.locator('option').nth(1).getAttribute('value');
  const current = lookup.locator('option').filter({ hasText: `${name} Updated` });
  const selected = (await current.count()) ? await current.getAttribute('value') : fallbackValue;
  if (!selected) throw new Error(`${path} lookup has no database values`);
  await lookup.selectOption(selected);
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.goto(`http://127.0.0.1:4200/${path}`, { waitUntil: 'networkidle' });
  const searchedUpdated = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/v1/masters/${path}`) &&
      new URL(r.url()).searchParams.get('search') === `${name} Updated`,
  );
  await page.getByPlaceholder('Search').fill(`${name} Updated`);
  await searchedUpdated;
  const updated = page.getByRole('row').filter({ hasText: `${name} Updated` });
  await updated.getByRole('button', { name: `${name} Updated actions` }).click();
  await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  const inactiveSearch = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/v1/masters/${path}`) &&
      new URL(r.url()).searchParams.get('search') === `${name} Updated`,
  );
  await page.getByPlaceholder('Search').fill(`${name} Updated`);
  await inactiveSearch;
  if (
    !(await page
      .getByRole('row')
      .filter({ hasText: `${name} Updated` })
      .getByText('Inactive')
      .isVisible())
  )
    throw new Error(`${path} deactivation did not persist`);
  await page.goto(`http://127.0.0.1:4200/${dependentPath}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: createButton }).click();
  if (
    await page
      .getByLabel(selectLabel)
      .locator('option')
      .filter({ hasText: `${name} Updated` })
      .count()
  )
    throw new Error(`${path} inactive value remains selectable`);
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
}
try {
  await page.goto('http://127.0.0.1:4200/auth/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByLabel('Password').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await createEditDeactivate(
    'laboratory-tests',
    `E2ELT${stamp}`,
    `E2E Lab Test ${stamp}`,
    'Category',
    'Biochemistry',
    'laboratory',
    /New order/,
    'Tests',
  );
  await createEditDeactivate(
    'radiology-investigations',
    `E2ERI${stamp}`,
    `E2E Investigation ${stamp}`,
    'Modality',
    'CT',
    'radiology',
    /New radiology order/,
    'Investigation',
  );
  console.log(
    JSON.stringify({
      radiologyInvestigationMaster: 'passed',
      laboratoryTestMaster: 'passed',
      dependentLookups: 'passed',
      deactivationPersistence: 'passed',
      serverErrors: errors.length,
    }),
  );
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
