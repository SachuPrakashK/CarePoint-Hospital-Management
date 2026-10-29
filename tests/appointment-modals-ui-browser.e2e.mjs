import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const user = {
  id: 'user-1',
  first_name: 'Hospital',
  last_name: 'Admin',
  email: 'admin@medicare.test',
  role: { code: 'HOSPITAL_ADMIN', name: 'Hospital Admin' },
  roles: [{ code: 'HOSPITAL_ADMIN', name: 'Hospital Admin' }],
  permissions: ['appointments.view', 'appointments.create', 'appointments.edit', 'billing.view'],
};
const appointment = {
  id: 'appointment-1',
  number: 'APT-UI-001',
  patientId: 'patient-1',
  patientName: 'Aarav Kumar',
  patientMrn: 'MRN-001',
  patientGender: 'Male',
  patientPhone: '+919876543210',
  patientAge: '34 yrs',
  departmentId: 'department-1',
  department: 'Cardiology',
  doctorId: 'doctor-1',
  doctor: 'Meera Shah',
  doctorSpecialty: 'Cardiology',
  appointmentAt: new Date(Date.now() + 86_400_000).toISOString(),
  status: 'CONFIRMED',
  type: 'Consultation',
  consultationType: 'In person',
  reason: 'Follow-up consultation',
  fee: 1000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  invoiceId: null,
  invoiceNumber: null,
  paymentStatus: 'Not Billed',
  outstandingBalance: 0,
};
const options = {
  patients: [
    {
      id: 'patient-1',
      firstName: 'Aarav',
      lastName: 'Kumar',
      mrn: 'MRN-001',
      gender: 'Male',
      phone: '+919876543210',
      dob: '1992-01-10',
    },
  ],
  departments: [{ id: 'department-1', name: 'Cardiology' }],
  doctors: [
    {
      id: 'doctor-1',
      firstName: 'Meera',
      lastName: 'Shah',
      departmentId: 'department-1',
      consultationFee: 1000,
      specialization: { name: 'Cardiology' },
    },
  ],
};
const response = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.addInitScript(
    ({ user }) =>
      sessionStorage.setItem(
        'carepoint.auth.tab-session',
        JSON.stringify({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 3_600_000,
          remember: false,
          user: {
            id: user.id,
            name: `${user.first_name} ${user.last_name}`,
            email: user.email,
            role: user.role,
            roles: user.roles,
            permissions: user.permissions,
          },
        }),
      ),
    { user },
  );
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/auth/refresh'))
      return response(route, {
        data: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          user,
        },
      });
    if (path.endsWith('/auth/me')) return response(route, { data: user });
    if (path.endsWith('/languages/public') || path.endsWith('/languages'))
      return response(route, {
        data: [
          {
            id: 'en',
            code: 'en',
            name: 'English',
            nativeName: 'English',
            enabled: true,
            isDefault: true,
            translationCoverage: 100,
            translations: [],
          },
        ],
      });
    if (path.endsWith('/languages/preference')) return response(route, { data: { code: 'en' } });
    if (path.endsWith('/appointments/options')) return response(route, { data: options });
    if (path.endsWith('/appointments/summary'))
      return response(route, {
        data: { today: 1, confirmed: 1, pendingPayment: 0, completed: 0, scope: 'all' },
      });
    if (path.endsWith('/appointments/availability'))
      return response(route, {
        data: {
          date: url.searchParams.get('date'),
          doctorId: 'doctor-1',
          slots: [
            { time: '09:00', available: true },
            { time: '09:30', available: true },
          ],
        },
      });
    if (path.endsWith('/appointments'))
      return response(route, {
        data: [appointment],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      });
    return response(route, { data: {} });
  });

  await page.goto('http://127.0.0.1:4200/appointments');
  await page.getByRole('heading', { name: 'Appointments' }).waitFor();

  await page.getByRole('button', { name: 'New appointment' }).click();
  const create = page.getByRole('dialog', { name: 'Add New Appointment' });
  await create.waitFor();
  assert.equal(await create.locator('.booking-section').count(), 2);
  assert.equal(await create.getByRole('button', { name: 'Cancel' }).count(), 1);
  assert.equal(await create.getByRole('button', { name: 'Book appointment' }).count(), 1);
  assert.equal(
    await create
      .locator('.crud-modal__body')
      .evaluate((element) => getComputedStyle(element).overflowY),
    'auto',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await create.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    true,
  );
  await create.getByRole('button', { name: 'Cancel' }).click();

  await page.setViewportSize({ width: 1440, height: 1000 });
  const row = page.getByRole('row', { name: /APT-UI-001/ });
  await row.getByRole('button', { name: 'Appointment actions' }).click();
  await page.getByRole('menuitem', { name: 'Reschedule' }).click();
  const reschedule = page.getByRole('dialog', { name: 'Reschedule appointment' });
  await reschedule.waitFor();
  assert.equal(await reschedule.locator('.crud-modal__form').count(), 1);
  assert.equal(
    await reschedule
      .locator('.reschedule-form')
      .evaluate((element) => getComputedStyle(element).display),
    'grid',
  );
  assert.equal(await reschedule.getByText('Payment status', { exact: true }).count(), 0);
  assert.equal(await reschedule.getByText('Gender', { exact: true }).count(), 0);
  await reschedule.getByRole('button', { name: 'Cancel' }).click();

  await row.getByRole('button', { name: 'Appointment actions' }).click();
  await page.getByRole('menuitem', { name: 'Change Status' }).click();
  const status = page.getByRole('dialog', { name: 'Change appointment status' });
  await status.waitFor();
  assert.equal(await status.locator('.current-status-card').count(), 1);
  assert.equal(await status.getByRole('button', { name: 'Cancel' }).count(), 1);
  assert.equal(await status.getByRole('button', { name: 'Update' }).count(), 1);

  console.log(
    JSON.stringify({
      newAppointmentStructured: true,
      newAppointmentScrollable: true,
      newAppointmentMobileNoOverflow: true,
      rescheduleGridPreserved: true,
      rescheduleUnrelatedFieldsRemoved: true,
      changeStatusStructured: true,
      fixedFootersPresent: true,
    }),
  );
} finally {
  await browser.close();
}
