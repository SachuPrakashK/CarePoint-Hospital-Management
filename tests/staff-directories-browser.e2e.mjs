import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../backend/.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((x) => x && !x.startsWith('#') && x.includes('='))
    .map((x) => {
      const i = x.indexOf('=');
      return [x.slice(0, i), x.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);
const api = 'http://127.0.0.1:3000/api/v1',
  front = process.argv[2] || process.env.FRONTEND_URL || 'http://127.0.0.1:4200';
const request = async (path, options = {}) => {
  const r = await fetch(api + path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = r.status === 204 ? null : await r.json();
  return { status: r.status, body };
};
const login = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: env.SEED_HOSPITAL_ADMIN_EMAIL,
    password: env.SEED_HOSPITAL_ADMIN_PASSWORD,
  }),
});
assert.equal(login.status, 200);
const auth = { authorization: `Bearer ${login.body.data.access_token}` };
const options = (await request('/doctors/options', { headers: auth })).body.data;
const stamp = Date.now();
let doctor, employee;
try {
  const specialization = options.specializations[0];
  const department = options.departments.find((x) => x.id === specialization.departmentId);
  const common = {
    firstName: 'E2E',
    lastName: 'Clinician',
    gender: 'FEMALE',
    phone: '9876543210',
    email: `doctor.${stamp}@carepoint.test`,
    employeeCode: `DOC-${stamp}`,
    departmentId: department.id,
    status: 'ACTIVE',
  };
  let r = await request('/doctors', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      ...common,
      specializationId: specialization.id,
      medicalRegistration: `REG-${stamp}`,
      qualification: 'MBBS',
      yearsOfExperience: 5,
      consultationFee: 500,
    }),
  });
  assert.equal(r.status, 201);
  doctor = r.body.data;
  r = await request(`/doctors/${doctor.id}`, { headers: auth });
  assert.equal(r.body.data.employeeCode, common.employeeCode);
  r = await request(`/doctors/${doctor.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      ...common,
      lastName: 'Updated',
      specializationId: doctor.specializationId,
      medicalRegistration: doctor.medicalRegistration,
      qualification: 'MBBS, MD',
      yearsOfExperience: 6,
      consultationFee: 600,
    }),
  });
  assert.equal(r.body.data.lastName, 'Updated');
  const empCommon = {
    firstName: 'E2E',
    lastName: 'Employee',
    gender: 'MALE',
    phone: '9876543211',
    email: `employee.${stamp}@carepoint.test`,
    employeeCode: `EMP-${stamp}`,
    departmentId: options.departments[0].id,
    designation: 'Staff Nurse',
    joiningDate: '2026-01-02',
    employmentType: 'FULL_TIME',
    roleCode: 'NURSE',
    status: 'ACTIVE',
  };
  r = await request('/employees', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(empCommon),
  });
  assert.equal(r.status, 201);
  employee = r.body.data;
  assert.equal(
    (await request(`/employees?search=${empCommon.employeeCode}`, { headers: auth })).body
      .pagination.total,
    1,
  );
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${front}/auth/sign-in`);
    await page.locator('input[type="email"]').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${front}/doctors/${doctor.id}`);
    await page.getByRole('heading', { name: 'E2E Updated' }).waitFor();
    await page.reload();
    await page.getByText(common.employeeCode).waitFor();
    await page.goto(`${front}/employees`);
    await page.getByRole('heading', { name: 'Employees' }).waitFor();
    await page.getByRole('searchbox', { name: 'Search' }).fill(empCommon.employeeCode);
    const employeeRow = page.getByRole('row').filter({ hasText: empCommon.employeeCode });
    await employeeRow.waitFor();
    await employeeRow.getByText(empCommon.phone).waitFor();
    for (const name of ['Filters', 'Export']) {
      const button = page.getByRole('button', { name: new RegExp(name, 'i') });
      assert.ok(['flex', 'inline-flex'].includes(await button.evaluate((element) => getComputedStyle(element).display)));
      assert.equal(await button.evaluate((element) => getComputedStyle(element).alignItems), 'center');
    }
    await page.getByRole('button', { name: '+ Add Employee' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Add Employment' });
    const body = createDialog.locator('.staff-form-body');
    assert.equal(await body.evaluate((element) => getComputedStyle(element).overflowY), 'auto');
    assert.ok(await createDialog.locator('.crud-modal__footer').isVisible());
    await createDialog.getByRole('button', { name: 'Cancel' }).click();
    await employeeRow.getByRole('button', { name: /record actions/i }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit Employee' });
    assert.equal(await editDialog.getByPlaceholder('Enter phone number').inputValue(), empCommon.phone);
    assert.equal(await editDialog.locator('select[formControlName="departmentId"]').inputValue(), empCommon.departmentId);
    assert.equal(await editDialog.locator('input[formControlName="joiningDate"]').inputValue(), empCommon.joiningDate);
    await editDialog.getByPlaceholder('Enter designation').fill('Senior Staff Nurse');
    await editDialog.getByRole('button', { name: 'Save Changes' }).click();
    await editDialog.waitFor({ state: 'detached' });
    const persisted = await request(`/employees/${employee.id}`, { headers: auth });
    assert.equal(persisted.body.data.designation, 'Senior Staff Nurse');
    assert.equal(persisted.body.data.phone, empCommon.phone);
    await page.goto(`${front}/employees/${employee.id}`);
    await page.getByRole('heading', { name: 'E2E Employee' }).waitFor();
    await page.getByText(empCommon.phone).waitFor();
    await page.getByText('Senior Staff Nurse').waitFor();
    await page.reload();
    await page.getByText(empCommon.employeeCode).waitFor();
  } finally {
    await browser.close();
  }
  console.log('Doctors and Employees PostgreSQL/browser verification passed.');
} finally {
  if (doctor) await request(`/doctors/${doctor.id}`, { method: 'DELETE', headers: auth });
  if (employee) await request(`/employees/${employee.id}`, { method: 'DELETE', headers: auth });
}
