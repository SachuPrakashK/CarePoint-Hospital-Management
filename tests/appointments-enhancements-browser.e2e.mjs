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
const options = await call('/appointments/options', { headers });
assert.equal(options.response.status, 200);
const patient = options.body.data.patients[0];
assert.ok(patient);

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
  await page.goto('http://localhost:4200/appointments');
  await page.getByRole('heading', { name: 'Appointments' }).waitFor();

  for (const title of [
    "Today's appointments",
    'Confirmed',
    'Pending payment',
    'Completed appointments',
  ])
    await page.locator('.summary-card', { hasText: title }).waitFor();
  assert.equal(await page.locator('.appointment-summary .summary-card').count(), 4);
  for (const header of ['Gender', 'Age', 'Payment status'])
    await page.getByRole('columnheader', { name: header }).waitFor();

  await page.getByRole('button', { name: 'New appointment' }).click();
  const modal = page.getByRole('dialog', { name: 'Add New Appointment' });
  await modal.waitFor();
  assert.equal(await modal.getByRole('radio', { name: /Existing patient/ }).isChecked(), true);
  assert.equal(await modal.getByRole('radio', { name: /New patient/ }).isChecked(), false);
  const search = modal.getByRole('searchbox', { name: 'Search patient' });
  const searchResponse = page.waitForResponse((response) =>
    response.url().includes('/appointments/patients/search?'),
  );
  await search.fill(patient.mrn);
  assert.equal((await searchResponse).status(), 200);
  await modal.locator('.patient-results [role="option"]').first().click();
  await modal.locator('.selected-patient', { hasText: patient.gender }).waitFor();
  await modal.locator('.selected-patient', { hasText: patient.phone }).waitFor();

  await modal.getByRole('radio', { name: /New patient/ }).check();
  await modal.getByPlaceholder('First name').waitFor();
  await modal.getByPlaceholder('+919876543210').waitFor();
  assert.equal(
    await modal.locator('select[formcontrolname="gender"] option').first().textContent(),
    'Select gender',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await modal.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  );
  assert.equal(mobileOverflow, true);
  await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
  const rtlOverflow = await modal.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  );
  assert.equal(rtlOverflow, true);
  await modal.getByRole('button', { name: 'Cancel' }).click();
  await modal.waitFor({ state: 'detached' });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.setAttribute('dir', 'ltr'));
  const confirmedRow = page.locator('tbody tr', { hasText: 'CONFIRMED' }).first();
  await confirmedRow.waitFor();
  await confirmedRow.getByRole('button', { name: 'Appointment actions' }).click();
  await page.getByRole('menuitem', { name: 'Reschedule' }).click();
  const rescheduleModal = page.getByRole('dialog', { name: 'Reschedule appointment' });
  await rescheduleModal.waitFor();
  assert.equal(await rescheduleModal.locator('.crud-modal__form').count(), 1);
  assert.equal(
    await rescheduleModal
      .locator('.reschedule-form')
      .evaluate((element) => getComputedStyle(element).display),
    'grid',
  );
  assert.equal(await rescheduleModal.getByText('Payment status', { exact: true }).count(), 0);
  assert.equal(await rescheduleModal.getByText('Gender', { exact: true }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await rescheduleModal.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    true,
  );
  await rescheduleModal.getByRole('button', { name: 'Cancel' }).click();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await confirmedRow.getByRole('button', { name: 'Appointment actions' }).click();
  await page.getByRole('menuitem', { name: 'Change Status' }).click();
  const statusModal = page.getByRole('dialog', { name: 'Change appointment status' });
  await statusModal.waitFor();
  assert.equal(await statusModal.locator('.current-status-card').count(), 1);
  assert.equal(await statusModal.getByRole('button', { name: 'Cancel' }).count(), 1);
  assert.equal(await statusModal.getByRole('button', { name: 'Update' }).count(), 1);

  console.log(
    JSON.stringify({
      kpiCards: true,
      demographicColumns: true,
      paymentColumn: true,
      existingPatientSearch: true,
      demographicPrepopulation: true,
      newPatientMode: true,
      genderPlaceholder: true,
      mobileLayout: true,
      rtlLayout: true,
      rescheduleModalLayout: true,
      rescheduleMobileLayout: true,
      statusModalLayout: true,
    }),
  );
} finally {
  await browser.close();
}
