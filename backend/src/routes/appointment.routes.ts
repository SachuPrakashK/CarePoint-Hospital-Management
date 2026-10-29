import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { appointmentService as service } from '../services/appointment.service.js';
import { asyncHandler } from '../utils/async-handler.js';

const statuses = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'WAITING',
  'IN_CONSULTATION',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
const emptyBody = z.object({}).passthrough().optional();
const params = z.object({ id: z.uuid() });
const appointmentBody = z.object({
  patientId: z.uuid(),
  departmentId: z.uuid(),
  doctorId: z.uuid(),
  appointmentAt: z.iso.datetime(),
  type: z.string().trim().min(1).max(80),
  consultationType: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(1000),
  fee: z.coerce.number().nonnegative(),
});
const newPatient = z.object({
  firstName: z.string().trim().min(2).max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1).max(100),
  dob: z.iso.date(),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, 'Enter a valid mobile number with country code.'),
});
const createAppointmentBody = appointmentBody
  .omit({ patientId: true })
  .extend({ patientId: z.uuid().optional(), newPatient: newPatient.optional() })
  .refine((value) => Boolean(value.patientId) !== Boolean(value.newPatient), {
    message: 'Select an existing patient or provide one new patient.',
    path: ['patientId'],
  });
const listSchema = z.object({
  body: emptyBody,
  params: z.object({}).passthrough(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(250).default(10),
    search: z.string().trim().optional(),
    department_id: z.uuid().optional(),
    doctor_id: z.uuid().optional(),
    status: z.enum(statuses).optional(),
    gender: z.string().trim().max(40).optional(),
    payment_status: z
      .enum(['Paid', 'Pending', 'Partially Paid', 'Refunded', 'Not Billed'])
      .optional(),
    start_date: z.iso.datetime().optional(),
    end_date: z.iso.datetime().optional(),
    sort_by: z
      .enum([
        'appointmentAt',
        'createdAt',
        'number',
        'patient',
        'gender',
        'age',
        'department',
        'doctor',
        'type',
        'status',
      ])
      .default('appointmentAt'),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const appointmentRoutes = Router();
appointmentRoutes.use(authenticate);
appointmentRoutes.get(
  '/',
  requirePermissions('appointments.view'),
  validate(listSchema),
  asyncHandler(async (q, r) => r.json(await service.list(q.query as any))),
);
appointmentRoutes.get(
  '/summary',
  requirePermissions('appointments.view'),
  asyncHandler(async (_q, r) => r.json({ data: await service.summary() })),
);
appointmentRoutes.get(
  '/options',
  requirePermissions('appointments.view'),
  asyncHandler(async (_q, r) => r.json({ data: await service.options() })),
);
appointmentRoutes.get(
  '/patients/search',
  requirePermissions('appointments.view'),
  validate(
    z.object({
      params: z.object({}).passthrough(),
      body: emptyBody,
      query: z.object({ search: z.string().trim().min(2).max(100) }),
    }),
  ),
  asyncHandler(async (q, r) =>
    r.json({ data: await service.searchPatients(String(q.query.search)) }),
  ),
);
appointmentRoutes.get(
  '/availability',
  requirePermissions('appointments.view'),
  validate(
    z.object({
      params: z.object({}).passthrough(),
      body: emptyBody,
      query: z.object({
        doctor_id: z.uuid(),
        date: z.iso.date(),
        appointment_id: z.uuid().optional(),
      }),
    }),
  ),
  asyncHandler(async (q, r) =>
    r.json({
      data: await service.availability(
        String(q.query.doctor_id),
        String(q.query.date),
        q.query.appointment_id ? String(q.query.appointment_id) : undefined,
      ),
    }),
  ),
);
appointmentRoutes.get(
  '/:id/invoice',
  requirePermissions('appointments.view'),
  requirePermissions('billing.view'),
  validate(z.object({ params, body: emptyBody, query: z.object({}).passthrough() })),
  asyncHandler(async (q, r) => r.json({ data: await service.invoice(String(q.params.id)) })),
);
appointmentRoutes.get(
  '/:id/invoice.pdf',
  requirePermissions('appointments.view'),
  requirePermissions('billing.view'),
  validate(z.object({ params, body: emptyBody, query: z.object({}).passthrough() })),
  asyncHandler(async (q, r) => {
    const file = await service.invoicePdf(String(q.params.id));
    r.setHeader('content-type', 'application/pdf');
    r.setHeader('content-disposition', `attachment; filename="${file.filename}"`);
    r.send(file.data);
  }),
);
appointmentRoutes.patch(
  '/:id/reschedule',
  requirePermissions('appointments.edit'),
  validate(
    z.object({
      params,
      query: z.object({}).passthrough(),
      body: z.object({
        departmentId: z.uuid(),
        doctorId: z.uuid(),
        appointmentAt: z.iso.datetime(),
        reason: z.string().trim().min(3).max(500),
      }),
    }),
  ),
  asyncHandler(async (q, r) =>
    r.json({
      data: await service.reschedule(String(q.params.id), q.body, q.auth!.userId),
      message: 'Appointment rescheduled.',
    }),
  ),
);
appointmentRoutes.get(
  '/:id',
  requirePermissions('appointments.view'),
  validate(z.object({ params, body: emptyBody, query: z.object({}).passthrough() })),
  asyncHandler(async (q, r) => r.json({ data: await service.get(String(q.params.id)) })),
);
appointmentRoutes.post(
  '/',
  requirePermissions('appointments.create'),
  validate(
    z.object({
      params: z.object({}).passthrough(),
      query: z.object({}).passthrough(),
      body: createAppointmentBody,
    }),
  ),
  asyncHandler(async (q, r) =>
    r.status(201).json({
      data: await service.create(q.body, q.auth!.userId),
      message: 'Appointment created.',
    }),
  ),
);
appointmentRoutes.put(
  '/:id',
  requirePermissions('appointments.edit'),
  validate(z.object({ params, query: z.object({}).passthrough(), body: appointmentBody })),
  asyncHandler(async (q, r) =>
    r.json({
      data: await service.update(String(q.params.id), q.body),
      message: 'Appointment updated.',
    }),
  ),
);
appointmentRoutes.patch(
  '/:id/status',
  requirePermissions('appointments.edit'),
  validate(
    z.object({
      params,
      query: z.object({}).passthrough(),
      body: z.object({ status: z.enum(statuses) }),
    }),
  ),
  asyncHandler(async (q, r) =>
    r.json({ data: await service.status(String(q.params.id), q.body.status) }),
  ),
);
