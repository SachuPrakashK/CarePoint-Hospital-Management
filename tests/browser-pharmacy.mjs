import { chromium } from 'playwright-core';
import { PrismaClient } from '../backend/node_modules/@prisma/client/default.js';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

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
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const frontend = process.env.PHARMACY_FRONTEND_URL || 'http://127.0.0.1:4200';
let browser;
let medicineId = '';
try {
  const marker = `Browser Medicine ${randomUUID().slice(0, 7)}`;
  const category = `Browser Category ${randomUUID().slice(0, 5)}`;
  const batchNumber = `BR-${randomUUID().slice(0, 7)}`;
  const medicine = await prisma.medicine.create({
    data: {
      name: marker,
      genericName: 'Browser Generic',
      brand: 'Browser Brand',
      category,
      strength: '250 mg',
      form: 'Tablet',
      unit: 'Tablet',
      status: 'Active',
    },
  });
  medicineId = medicine.id;
  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const stockRequests = [];
  let receiptPosts = 0;
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().includes('/api/v1/pharmacy/batches?'))
      stockRequests.push(request.url());
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/pharmacy/batches'))
      receiptPosts += 1;
  });
  await page.goto(`${frontend}/auth/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByLabel('Password').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.goto(`${frontend}/pharmacy`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Pharmacy' }).waitFor();
  const actions = page.locator('.pharmacy-actions');
  const actionButtons = actions.locator('button');
  if ((await actionButtons.count()) !== 2) throw new Error('Pharmacy actions are missing.');
  const classes = await actionButtons.evaluateAll((items) => items.map((item) => item.className));
  if (!classes.every((value) => value.includes('primary')))
    throw new Error('Pharmacy actions do not share the same variant.');
  const gap = await actions.evaluate((item) => getComputedStyle(item).gap);
  if (!gap || gap === 'normal' || gap === '0px')
    throw new Error('Pharmacy action spacing is missing.');
  await page.getByRole('button', { name: '+ Medicine' }).click();
  const medicineDialog = page.getByRole('dialog', { name: 'Create medicine' });
  await medicineDialog.waitFor();
  for (const placeholder of [
    'Enter medicine name',
    'Enter generic name',
    'Enter brand name',
    'Enter medicine category',
    'Enter strength, for example 500 mg',
    'Enter dosage form',
    'Enter dispensing unit',
    'Enter barcode',
  ])
    if (!(await medicineDialog.getByPlaceholder(placeholder).count()))
      throw new Error(`Missing medicine placeholder: ${placeholder}`);
  await medicineDialog.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: '+ Stock receipt' }).click();
  const receiptDialog = page.getByRole('dialog', { name: 'Create stock receipt' });
  await receiptDialog.waitFor();
  for (const placeholder of [
    'Enter batch number',
    'Enter purchase price',
    'Enter selling price',
    'Enter received quantity',
    'Enter reorder level',
  ])
    if (!(await receiptDialog.getByPlaceholder(placeholder).count()))
      throw new Error(`Missing receipt placeholder: ${placeholder}`);
  await receiptDialog.getByLabel('Medicine').selectOption(medicineId);
  await receiptDialog.getByLabel('Batch number').fill(batchNumber);
  const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  await receiptDialog.getByLabel('Expiry').fill(expiry);
  await receiptDialog.getByLabel('Purchase price').fill('10');
  await receiptDialog.getByLabel('Selling price').fill('12');
  await receiptDialog.getByLabel('Quantity').fill('5');
  await receiptDialog.getByLabel('Reorder level').fill('5');
  await receiptDialog.getByRole('button', { name: 'Create' }).click();
  await page.getByText('Pharmacy record created.').waitFor();
  if (receiptPosts !== 1)
    throw new Error(`Expected one stock receipt request, received ${receiptPosts}.`);
  await page.getByRole('tab', { name: 'Medicine stock' }).click();
  await page.getByLabel('Search medicines').fill(marker);
  await page.waitForTimeout(450);
  await page.getByText(marker).waitFor();
  if (!stockRequests.some((url) => url.includes(`search=${encodeURIComponent(marker)}`)))
    throw new Error('Medicine search was not sent to the API.');
  await page.getByRole('button', { name: /^Filters/ }).click();
  const panel = page.locator('.filter-panel');
  await panel.getByLabel('Category').selectOption(category);
  await panel.getByLabel('Stock level').selectOption('true');
  await panel.getByLabel('Expiry').selectOption('expiring_soon');
  await panel.getByRole('button', { name: 'Apply Filters' }).click();
  await page.getByText(marker).waitFor();
  if (
    !stockRequests.some(
      (url) =>
        url.includes(`category=${encodeURIComponent(category)}`) &&
        url.includes('low_stock=true') &&
        url.includes('expiry=expiring_soon'),
    )
  )
    throw new Error('Combined stock filters were not sent to the API.');
  const stockRow = page.locator('tbody tr').filter({ hasText: marker });
  const rowText = await stockRow.textContent();
  if (rowText.includes('T00:00:00') || rowText.includes('Invalid Date'))
    throw new Error('Expiry is not formatted.');
  await page.getByLabel('Search medicines').fill(`no-match-${randomUUID()}`);
  await page.waitForTimeout(450);
  await page.getByText('No medicines match your search or filters.').waitFor();
  if (await page.getByRole('button', { name: /^Filters/ }).isDisabled())
    throw new Error('Filters were disabled for a filtered-empty result.');
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await page.getByRole('tab', { name: 'Stock ledger' }).click();
  const ledgerRow = page.locator('tbody tr').filter({ hasText: batchNumber });
  await ledgerRow.waitFor();
  const ledgerText = await ledgerRow.textContent();
  if (
    !ledgerText.includes(marker) ||
    !ledgerText.includes(batchNumber) ||
    !ledgerText.includes('RCV-')
  )
    throw new Error('Ledger relational values are incomplete.');
  if (ledgerText.includes(medicineId)) throw new Error('Ledger exposes an internal medicine ID.');
  console.log(
    JSON.stringify({
      buttons: 'passed',
      search: 'passed',
      filters: 'passed',
      filteredEmpty: 'passed',
      expiry: 'passed',
      ledgerRelations: 'passed',
      placeholders: 'passed',
      singleReceiptRequest: 'passed',
      persistence: 'passed',
      consoleErrors: errors.length,
    }),
  );
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser?.close();
  if (medicineId) {
    const batches = await prisma.medicineBatch.findMany({
      where: { medicineId },
      select: { id: true },
    });
    const ids = batches.map((item) => item.id);
    await prisma.auditLog.deleteMany({ where: { module: 'pharmacy', entityId: { in: ids } } });
    await prisma.stockTransaction.deleteMany({ where: { batchId: { in: ids } } });
    await prisma.medicineBatch.deleteMany({ where: { medicineId } });
    await prisma.medicine.deleteMany({ where: { id: medicineId } });
  }
  await prisma.$disconnect();
}
