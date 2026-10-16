import { chromium } from 'playwright-core';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('backend/.env', 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]; }));
const loginResponse = await fetch('http://127.0.0.1:3100/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: env.SEED_HOSPITAL_ADMIN_EMAIL, password: env.SEED_HOSPITAL_ADMIN_PASSWORD }) });
const login = await loginResponse.json();
const list = await fetch('http://127.0.0.1:3100/api/v1/admissions?page=1&page_size=10', { headers: { authorization: `Bearer ${login.data.access_token}` } }).then((response) => response.json());
const admission = list.data[0];
if (!admission) throw new Error('An admission is required for browser verification.');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
try {
  await page.goto('http://localhost:4302/auth/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByLabel('Password').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.goto('http://localhost:4302/inpatient', { waitUntil: 'networkidle' });
  const searchRequest = page.waitForResponse((response) => response.url().includes('/api/v1/admissions?') && response.url().includes('search='));
  await page.getByLabel('Search admissions').fill(admission.number);
  await searchRequest;
  await page.getByText(admission.number, { exact: true }).waitFor();
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByLabel('Department').selectOption(admission.departmentId);
  await page.getByLabel('Status').selectOption(admission.status);
  const filteredRequest = page.waitForResponse((response) => response.url().includes(`department_id=${admission.departmentId}`) && response.url().includes(`status=${admission.status}`));
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await filteredRequest;
  await page.getByText(admission.number, { exact: true }).click();
  await page.waitForURL(`**/inpatient/${admission.id}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText(admission.number, { exact: true }).waitFor();
  for (const [name, endpoint] of [['Clinical Record', 'clinical-records'], ['Nursing', 'nursing'], ['Bed History', 'bed-history'], ['Medications', 'medications']] ) {
    const response = page.waitForResponse((item) => item.url().includes(`/admissions/${admission.id}/${endpoint}`));
    await page.getByRole('tab', { name }).click(); await response;
  }
  const investigationResponses = Promise.all([page.waitForResponse((item) => item.url().includes(`/admissions/${admission.id}/laboratory`)), page.waitForResponse((item) => item.url().includes(`/admissions/${admission.id}/radiology`))]);
  await page.getByRole('tab', { name: 'Investigations' }).click(); await investigationResponses;
  await page.goto('http://localhost:4302/inpatient', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Wards & rooms' }).click();
  await page.getByRole('button', { name: /Add ward/i }).click();
  const stamp = Date.now(); const wardName = `Browser Ward ${stamp}`;
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Ward name').fill(wardName); await dialog.getByLabel('Ward code').fill(`BW-${stamp}`); await dialog.getByLabel('Floor').fill('E2E floor');
  let createRequests = 0; page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/wards')) createRequests += 1; });
  await dialog.getByRole('button', { name: 'Create ward' }).click();
  await page.getByText(wardName, { exact: true }).waitFor();
  if (createRequests !== 1) throw new Error(`Expected one ward request, received ${createRequests}.`);
  await page.reload({ waitUntil: 'networkidle' }); await page.getByRole('tab', { name: 'Wards & rooms' }).click(); await page.getByText(wardName, { exact: true }).waitFor();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ search: 'passed', combinedFilters: 'passed', rowNavigation: 'passed', directRefresh: 'passed', tabs: 'passed', wardCreateSingleRequest: 'passed', wardRefreshPersistence: 'passed', consoleErrors: 0 }));
} finally { await browser.close(); }
