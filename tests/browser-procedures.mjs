import { chromium } from 'playwright-core';
import { PrismaClient } from '../backend/node_modules/@prisma/client/default.js';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(fs.readFileSync('backend/.env', 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]; }));
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
let browser; let theatreId = ''; let procedureId = '';
try {
  const [patient, doctor] = await Promise.all([prisma.patient.findFirst(), prisma.user.findFirst({ where: { status: 'ACTIVE', roles: { some: { role: { code: 'DOCTOR' } } } } })]);
  if (!patient || !doctor) throw new Error('Procedure browser prerequisites are missing.');
  const marker = `Browser procedure ${randomUUID().slice(0, 8)}`;
  const theatre = await prisma.operationTheatre.create({ data: { code: `BR-${randomUUID().slice(0, 6)}`, name: `Browser OT ${randomUUID().slice(0, 5)}` } }); theatreId = theatre.id;
  const scheduledAt = new Date(Date.now() + 15 * 86400000); scheduledAt.setUTCHours(11, 0, 0, 0);
  const procedure = await prisma.procedure.create({ data: { patientId: patient.id, doctorId: doctor.id, theatreId, name: marker, team: [], scheduledAt, durationMinutes: 75, indication: 'Browser verification', notes: '', status: 'Scheduled', preOpChecklist: [] } }); procedureId = procedure.id;
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const errors = []; const listRequests = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', (request) => { if (request.method() === 'GET' && request.url().includes('/api/v1/procedures?')) listRequests.push(request.url()); });
  await page.goto('http://127.0.0.1:4200/auth/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL); await page.getByLabel('Password').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD); await page.getByRole('button', { name: 'Sign in' }).click(); await page.waitForURL('**/dashboard');
  await page.goto('http://127.0.0.1:4200/procedures', { waitUntil: 'networkidle' }); await page.getByRole('heading', { name: 'Procedures & operation theatre' }).waitFor();
  const widgets = page.locator('.procedure-stats .metric-card'); if (await widgets.count() !== 5) throw new Error('Procedure widgets are missing.');
  const backgrounds = await widgets.evaluateAll((items) => items.map((item) => getComputedStyle(item).backgroundImage || getComputedStyle(item).backgroundColor)); if (new Set(backgrounds).size !== backgrounds.length) throw new Error('Procedure widgets do not have unique backgrounds.');
  await page.getByLabel('Search procedures').fill(marker); await page.waitForTimeout(450); await page.getByText(marker).waitFor();
  if (!listRequests.some((url) => url.includes(`search=${encodeURIComponent(marker)}`))) throw new Error('Search was not sent to the API.');
  await page.getByRole('button', { name: /^Filters/ }).click(); const panel = page.locator('.filter-panel');
  const date = scheduledAt.toISOString().slice(0, 10); await panel.getByLabel('From date').fill(date); await panel.getByLabel('To date').fill(date); await panel.getByLabel('Theatre').selectOption(theatreId); await panel.getByLabel('Status').selectOption('Scheduled'); await panel.getByRole('button', { name: 'Apply Filters' }).click(); await page.getByText(marker).waitFor();
  if (!listRequests.some((url) => url.includes(`theatre_id=${theatreId}`) && url.includes('status=Scheduled') && url.includes(`from_date=${date}`))) throw new Error('Combined filters were not sent to the API.');
  await page.getByLabel('Search procedures').fill(`no-match-${randomUUID()}`); await page.waitForTimeout(450); await page.getByText('No procedures match your search or filters.').waitFor(); if (await page.locator('app-pagination nav').count()) throw new Error('Pagination remained visible for empty results.');
  await page.getByRole('button', { name: 'Clear filters' }).click(); await page.waitForTimeout(450);
  await page.getByRole('button', { name: '+ Schedule procedure' }).click(); const createDialog = page.getByRole('dialog', { name: 'Schedule procedure' }); await createDialog.waitFor();
  for (const placeholder of ['Enter procedure name', 'Enter estimated duration in minutes', 'Enter clinical indication', 'Enter procedure notes']) if (!await createDialog.getByPlaceholder(placeholder).count()) throw new Error(`Missing placeholder: ${placeholder}`);
  await createDialog.getByRole('button', { name: 'Close' }).click();
  await page.getByLabel('Search procedures').fill(marker); await page.waitForTimeout(450); const row = page.locator('tbody tr').filter({ hasText: marker });
  await row.getByLabel('Record actions').click(); if (!page.url().endsWith('/procedures')) throw new Error('Actions triggered row navigation.'); await page.getByRole('menuitem', { name: 'View' }).click(); await page.waitForURL(`**/procedures/${procedureId}`); await page.reload({ waitUntil: 'networkidle' }); await page.getByText(marker).waitFor();
  await page.getByRole('button', { name: 'Back to procedures' }).click(); await page.waitForURL('**/procedures'); await page.getByLabel('Search procedures').fill(marker); await page.waitForTimeout(450); await page.locator('tbody tr').filter({ hasText: marker }).click(); await page.waitForURL(`**/procedures/${procedureId}`);
  console.log(JSON.stringify({ search: 'passed', filters: 'passed', widgets: 'passed', emptyState: 'passed', placeholders: 'passed', actions: 'passed', rowNavigation: 'passed', directRefresh: 'passed', consoleErrors: errors.length })); if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser?.close(); if (procedureId) await prisma.procedure.deleteMany({ where: { id: procedureId } }); if (theatreId) await prisma.operationTheatre.deleteMany({ where: { id: theatreId } }); await prisma.$disconnect();
}
