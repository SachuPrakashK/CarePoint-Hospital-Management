import { chromium } from 'playwright-core';
import { PrismaClient } from '../backend/node_modules/@prisma/client/default.js';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('backend/.env', 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]; }));
process.env.DATABASE_URL ||= env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const created = { admissionId: '', bedId: '', assignmentId: '', medicationId: '', noteIds: [], handoverIds: [] };
let browser;

try {
  let admission = await prisma.admission.findFirst({ where: { status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED'] } } });
  if (!admission) {
    const [patient, department, doctor, bed] = await Promise.all([
      prisma.patient.findFirst(), prisma.department.findFirst({ where: { status: 'Active' } }),
      prisma.user.findFirst({ where: { roles: { some: { role: { code: 'DOCTOR' } } }, status: 'ACTIVE' } }),
      prisma.bed.findFirst({ where: { allocations: { none: { endedAt: null } } } }),
    ]);
    if (!patient || !department || !doctor || !bed) throw new Error('Nursing browser test prerequisites are missing.');
    admission = await prisma.$transaction(async (tx) => {
      const item = await tx.admission.create({ data: { number: `ADM-BROWSER-${Date.now()}`, patientId: patient.id, departmentId: department.id, attendingDoctorId: doctor.id, admittedAt: new Date(), type: 'Planned', reason: 'Nursing browser verification', initialDiagnosis: 'Observation' } });
      await tx.bedAllocation.create({ data: { admissionId: item.id, bedId: bed.id, reason: 'Admission' } });
      await tx.bed.update({ where: { id: bed.id }, data: { status: 'OCCUPIED' } });
      return item;
    });
    created.admissionId = admission.id; created.bedId = bed.id;
  }
  const [nurse, admin] = await Promise.all([
    prisma.user.findFirst({ where: { roles: { some: { role: { code: 'NURSE' } } }, status: 'ACTIVE' } }),
    prisma.user.findUnique({ where: { email: env.SEED_HOSPITAL_ADMIN_EMAIL } }),
  ]);
  if (!nurse || !admin) throw new Error('Nurse or administrator is missing.');
  let assignment = await prisma.nurseAssignment.findFirst({ where: { admissionId: admission.id, nurseId: nurse.id, endedAt: null } });
  if (!assignment) { assignment = await prisma.nurseAssignment.create({ data: { admissionId: admission.id, nurseId: nurse.id, assignedById: admin.id, shift: 'MORNING' } }); created.assignmentId = assignment.id; }
  const medication = await prisma.medicationAdministration.create({ data: { admissionId: admission.id, medication: 'Browser verification medicine', dose: '1 tablet', route: 'Oral', scheduledAt: new Date() } });
  created.medicationId = medication.id;

  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; let noteRequests = 0;
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/nursing-notes')) noteRequests++; });
  await page.goto('http://127.0.0.1:4200/auth/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByLabel('Password').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.goto('http://127.0.0.1:4200/nursing', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Nursing workspace' }).waitFor();
  await page.getByLabel('Patient context').selectOption(admission.id);

  const marker = `Browser note ${Date.now()}`;
  await page.getByLabel('Observation').fill(marker);
  await page.getByLabel('Intervention').fill('Continued monitoring');
  const record = page.getByRole('button', { name: 'Record note' });
  if (await record.isDisabled()) throw new Error('Record Note remained disabled with valid fields.');
  await record.dblclick();
  await page.getByText(marker).waitFor();
  if (noteRequests !== 1) throw new Error(`Expected one note request, received ${noteRequests}.`);

  const medicationRow = page.locator('.med').filter({ hasText: 'Browser verification medicine' });
  await medicationRow.getByRole('button', { name: 'Administer' }).click();
  await page.getByRole('dialog', { name: 'Record medication administration' }).getByRole('button', { name: 'Record administration' }).click();
  await medicationRow.getByText('ADMINISTERED').waitFor();

  await page.getByRole('button', { name: 'Shift handover' }).click();
  const handover = page.getByRole('dialog', { name: 'Shift handover' });
  await handover.getByLabel('Clinical summary').fill('Stable during browser verification.');
  await handover.getByLabel('Current condition').fill('Stable');
  await handover.getByLabel('Receiving nurse').selectOption(nurse.id);
  await handover.getByRole('button', { name: 'Submit handover' }).click();
  await handover.waitFor({ state: 'hidden' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText(marker).waitFor();
  await page.getByText('Browser verification medicine').waitFor();
  await page.getByText('MORNING → EVENING').waitFor();
  await page.locator('.clickable-row').first().click();
  await page.waitForURL('**/inpatient/**');

  created.noteIds = (await prisma.nursingNote.findMany({ where: { admissionId: admission.id, observation: marker }, select: { id: true } })).map((item) => item.id);
  created.handoverIds = (await prisma.shiftHandover.findMany({ where: { admissionId: admission.id, clinicalSummary: 'Stable during browser verification.' }, select: { id: true } })).map((item) => item.id);
  console.log(JSON.stringify({ assignedPatients: 'passed', rowNavigation: 'passed', recordNote: 'passed', duplicateSubmit: 'passed', mar: 'passed', handover: 'passed', refreshPersistence: 'passed', consoleErrors: errors.length }));
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser?.close();
  if (created.handoverIds.length) await prisma.shiftHandover.deleteMany({ where: { id: { in: created.handoverIds } } });
  if (created.medicationId) await prisma.medicationAdministration.deleteMany({ where: { id: created.medicationId } });
  if (created.noteIds.length) await prisma.nursingNote.deleteMany({ where: { id: { in: created.noteIds } } });
  if (created.assignmentId) await prisma.nurseAssignment.deleteMany({ where: { id: created.assignmentId } });
  if (created.admissionId) {
    await prisma.bedAllocation.deleteMany({ where: { admissionId: created.admissionId } });
    await prisma.admission.deleteMany({ where: { id: created.admissionId } });
    if (created.bedId) await prisma.bed.update({ where: { id: created.bedId }, data: { status: 'AVAILABLE' } });
  }
  await prisma.$disconnect();
}
