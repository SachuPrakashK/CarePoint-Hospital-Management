import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { appointmentService as service } from '../services/appointment.service.js';
import { asyncHandler } from '../utils/async-handler.js';

const statuses = ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
const emptyBody = z.object({}).passthrough().optional();
const params = z.object({ id: z.uuid() });
const appointmentBody = z.object({
  patientId: z.uuid(), departmentId: z.uuid(), doctorId: z.uuid(), appointmentAt: z.iso.datetime(),
  type: z.string().trim().min(1).max(80), consultationType: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(1000), fee: z.coerce.number().nonnegative(),
});
const listSchema = z.object({
  body: emptyBody, params: z.object({}).passthrough(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1), page_size: z.coerce.number().int().min(1).max(250).default(10),
    search: z.string().trim().optional(), department_id: z.uuid().optional(), doctor_id: z.uuid().optional(),
    status: z.enum(statuses).optional(), start_date: z.iso.datetime().optional(), end_date: z.iso.datetime().optional(),
    sort_by: z.enum(['appointmentAt', 'createdAt', 'number', 'patient', 'department', 'doctor', 'type', 'status']).default('appointmentAt'), sort_order: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const appointmentRoutes = Router();
appointmentRoutes.use(authenticate);
appointmentRoutes.get('/', requirePermissions('appointments.view'), validate(listSchema), asyncHandler(async (q, r) => r.json(await service.list(q.query as any))));
appointmentRoutes.get('/options', requirePermissions('appointments.view'), asyncHandler(async (_q, r) => r.json({ data: await service.options() })));
appointmentRoutes.get('/:id', requirePermissions('appointments.view'), validate(z.object({ params, body: emptyBody, query: z.object({}).passthrough() })), asyncHandler(async (q, r) => r.json({ data: await service.get(String(q.params.id)) })));
appointmentRoutes.post('/', requirePermissions('appointments.create'), validate(z.object({ params: z.object({}).passthrough(), query: z.object({}).passthrough(), body: appointmentBody })), asyncHandler(async (q, r) => r.status(201).json({ data: await service.create(q.body), message: 'Appointment created.' })));
appointmentRoutes.put('/:id', requirePermissions('appointments.edit'), validate(z.object({ params, query: z.object({}).passthrough(), body: appointmentBody })), asyncHandler(async (q, r) => r.json({ data: await service.update(String(q.params.id), q.body), message: 'Appointment updated.' })));
appointmentRoutes.patch('/:id/status', requirePermissions('appointments.edit'), validate(z.object({ params, query: z.object({}).passthrough(), body: z.object({ status: z.enum(statuses) }) })), asyncHandler(async (q, r) => r.json({ data: await service.status(String(q.params.id), q.body.status) })));
