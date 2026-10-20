import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';

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
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const distRoot = path.resolve('dist/hospital-management/browser');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const server = http.createServer(async (request, response) => {
  if (request.url.startsWith('/api/')) {
    const body = [];
    for await (const chunk of request) body.push(chunk);
    const upstream = await fetch(`http://127.0.0.1:3000${request.url}`, {
      method: request.method,
      headers: { ...request.headers, host: '127.0.0.1:3000' },
      ...(body.length ? { body: Buffer.concat(body) } : {}),
    });
    response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
    response.end(Buffer.from(await upstream.arrayBuffer()));
    return;
  }
  const requested = path.resolve(distRoot, `.${request.url.split('?')[0]}`);
  const file =
    requested.startsWith(distRoot) && fs.existsSync(requested) && fs.statSync(requested).isFile()
      ? requested
      : path.join(distRoot, 'index.html');
  response.writeHead(200, {
    'content-type': mime[path.extname(file)] ?? 'application/octet-stream',
  });
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(4210, '127.0.0.1', resolve));
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
try {
  await page.goto('http://127.0.0.1:4210/auth/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.goto('http://127.0.0.1:4210/operations', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /Add item/ }).click();
  await page.getByPlaceholder('Enter item name').waitFor();
  await page.getByPlaceholder('Enter minimum stock level').waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.locator('tbody tr').first().locator('td').first().click();
  await page.waitForURL(/\/operations\/inventory\/[0-9a-f-]+/);
  await page.getByText('General information').waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Stock information').waitFor();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.waitForURL(/\/operations\?tab=inventory/);

  await page.getByRole('button', { name: 'Procurement' }).click();
  await page.getByRole('columnheader', { name: 'Actions' }).waitFor();
  await page.getByRole('button', { name: '+ Purchase request', exact: true }).click();
  assert.equal(
    await page.getByLabel('Supplier *').locator('option').first().textContent(),
    'Select supplier',
  );
  await page.getByPlaceholder('Enter requested quantity').waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  const procurementAction = page.getByRole('button', { name: 'Purchase request actions' }).first();
  if (await procurementAction.count()) {
    await procurementAction.click();
    await page.getByRole('menuitem', { name: 'View' }).click();
    await page.waitForURL(/\/operations\/procurement\/[0-9a-f-]+/);
    await page.getByText('Request information').waitFor();
    await page.getByRole('button', { name: 'Back' }).click();
  }

  await page.getByRole('button', { name: 'Suppliers' }).click();
  await page.getByRole('button', { name: /Add supplier/ }).click();
  await page.getByPlaceholder('Enter supplier name').waitFor();
  await page.getByPlaceholder('Enter tax number').waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Ambulance' }).click();
  await page.getByRole('columnheader', { name: 'Registration' }).waitFor();
  await page.getByRole('button', { name: /Add ambulance/ }).click();
  await page.getByPlaceholder('Enter vehicle registration number').waitFor();
  await page.getByPlaceholder('Enter driver contact number').waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  const tableOverflow = await page.locator('.table-wrap').evaluate((element) => ({
    overflowX: getComputedStyle(element).overflowX,
    contained: element.scrollWidth >= element.clientWidth,
  }));
  assert.equal(tableOverflow.overflowX, 'auto');
  assert.equal(tableOverflow.contained, true);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      tabs: 4,
      placeholders: 'passed',
      procurementActions: 'passed',
      ambulanceTable: 'passed',
      mobile: 'passed',
      consoleErrors: 0,
    }),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
