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
      return [x.slice(0, i), x.slice(i + 1).replace(/^["']|["']$/g, '')];
    }),
);
const suffix = Date.now();
const loginResponse=await fetch('http://127.0.0.1:3000/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:env.SEED_HOSPITAL_ADMIN_EMAIL,password:env.SEED_HOSPITAL_ADMIN_PASSWORD})});const token=(await loginResponse.json()).data.access_token;const apiHeaders={authorization:`Bearer ${token}`};
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(8000);
const failures = [];
page.on('response', (r) => {
  if (r.status() >= 400) failures.push(`${r.status()} ${r.url()} ${r.request().postData()??''}`);
});
const close = async () => page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
const firstOption = async (label) => {
  const select = page.getByLabel(label);
  const values = await select
    .locator('option')
    .evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
  assert.ok(values[0], `${label} has no database options`);
  await select.selectOption(values[0]);
};
try {
  await page.goto('http://127.0.0.1:4200/auth/login');
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByLabel('Password').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  const investigation = 'Ultrasound';
  await page.goto('http://127.0.0.1:4200/radiology', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /New radiology order/ }).click();
  await firstOption('Patient *');
  await page.getByLabel('Investigation *').selectOption('Ultrasound');
  await page.getByLabel('Ordering doctor *').fill('E2E Doctor');
  const radiologyCreated=page.waitForResponse(r=>r.url().includes('/api/v1/radiology/orders')&&r.request().method()==='POST');
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await radiologyCreated;
  await page.getByText('Radiology order created.').waitFor();
  await close();
  await page.reload({ waitUntil: 'networkidle' });
  const radRow = page.getByRole('row').filter({ hasText: 'E2E Doctor' }).last();
  await radRow.getByRole('button', { name: 'Radiology order actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await page.getByLabel('Ordering doctor *').fill(`E2E Doctor Updated ${suffix}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();
  await page.getByText('Radiology order updated.').waitFor({ state: 'attached' });
  await close();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('row').filter({ hasText: `E2E Doctor Updated ${suffix}` }).waitFor();
  const description = `E2E Charge ${suffix}`;
  await page.goto('http://127.0.0.1:4200/billing', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /New invoice/ }).click();
  await firstOption('Patient *');
  await page.getByLabel('Description *').fill(description);
  await page.getByLabel('Unit price *').fill('125');
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await page.getByText('Invoice created.').waitFor({ state: 'attached' });
  await close();
  await page.reload({ waitUntil: 'networkidle' });
  assert.ok((await page.getByRole('row').count()) > 1, 'Invoice listing did not persist');
  const provider = `E2E Provider ${suffix}`;
  await page.goto('http://127.0.0.1:4200/insurance', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Providers' }).click();
  await page.getByRole('button', { name: /Add provider/ }).click();
  await page.getByLabel('Name *').fill(provider);
  await page.getByLabel('Code *').fill(`E2E${String(suffix).slice(-8)}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await page.getByText('provider created.').waitFor({ state: 'attached' });
  await close();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Providers' }).click();
  const providerRow = page.getByRole('row').filter({ hasText: provider });
  await providerRow.click();
  await page.getByLabel('Name *').fill(`${provider} Updated`);
  await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();
  await page.getByText('provider updated.').waitFor({ state: 'attached' });
  await close();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Providers' }).click();
  await page.getByText(`${provider} Updated`).waitFor();
  const [radiology,invoices,providers]=await Promise.all([fetch('http://127.0.0.1:3000/api/v1/radiology/orders?page_size=100',{headers:apiHeaders}).then(r=>r.json()),fetch('http://127.0.0.1:3000/api/v1/billing?page_size=100',{headers:apiHeaders}).then(r=>r.json()),fetch('http://127.0.0.1:3000/api/v1/insurance/providers?page_size=100',{headers:apiHeaders}).then(r=>r.json())]);const rad=radiology.data.find(x=>x.investigation===`${investigation} Updated`);const invoice=invoices.data.find(x=>x.items?.some(i=>i.description===description));const insurer=providers.data.find(x=>x.name===`${provider} Updated`);await Promise.all([rad&&fetch(`http://127.0.0.1:3000/api/v1/radiology/orders/${rad.id}`,{method:'DELETE',headers:apiHeaders}),invoice&&fetch(`http://127.0.0.1:3000/api/v1/billing/${invoice.id}`,{method:'DELETE',headers:apiHeaders}),insurer&&fetch(`http://127.0.0.1:3000/api/v1/insurance/providers/${insurer.id}`,{method:'DELETE',headers:apiHeaders})]);
  assert.deepEqual(failures, []);
  console.log(
    JSON.stringify({
      radiologyCreateEditRefresh: 'passed',
      billingCreateRefresh: 'passed',
      insuranceProviderCreateEditRefresh: 'passed',
      serverErrors: 0,
    }),
  );
} catch(error){console.error(JSON.stringify({failures,formErrors:await page.locator('.error').allTextContents()}));throw error;} finally {
  await browser.close();
}
