import { Router } from 'express';
import * as c from '../controllers/inpatient.controller.js';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as v from '../validators/inpatient.validator.js';
import { z } from 'zod';
export const inpatientRoutes = Router();
inpatientRoutes.use(authenticate);
inpatientRoutes.get(
  '/admissions',
  requirePermissions('admissions.view'),
  validate(v.admissionListSchema),
  c.list,
);
inpatientRoutes.post(
  '/admissions',
  requirePermissions('admissions.create'),
  validate(v.admissionCreateSchema),
  c.create,
);
inpatientRoutes.get(
  '/admissions/:id',
  requirePermissions('admissions.view'),
  validate(v.admissionIdSchema),
  c.details,
);
inpatientRoutes.get(
  '/admissions/:id/clinical-records',
  requirePermissions('clinical.view'),
  validate(v.admissionIdSchema),
  c.clinicalRecords,
);
inpatientRoutes.get(
  '/admissions/:id/nursing',
  requirePermissions('nursing.view'),
  validate(v.admissionIdSchema),
  c.admissionNursing,
);
inpatientRoutes.get(
  '/admissions/:id/bed-history',
  requirePermissions('admissions.view'),
  validate(v.admissionIdSchema),
  c.bedHistory,
);
inpatientRoutes.get(
  '/admissions/:id/medications',
  requirePermissions('nursing.view'),
  validate(v.admissionIdSchema),
  c.admissionMedications,
);
inpatientRoutes.get(
  '/admissions/:id/laboratory',
  requirePermissions('laboratory.view'),
  validate(v.admissionIdSchema),
  c.admissionLaboratory,
);
inpatientRoutes.get(
  '/admissions/:id/radiology',
  requirePermissions('radiology.view'),
  validate(v.admissionIdSchema),
  c.admissionRadiology,
);
inpatientRoutes.put(
  '/admissions/:id',
  requirePermissions('admissions.manage'),
  validate(v.admissionUpdateSchema),
  c.update,
);
inpatientRoutes.post(
  '/admissions/:id/transfer',
  requirePermissions('admissions.transfer'),
  validate(v.transferSchema),
  c.transfer,
);
inpatientRoutes.post(
  '/admissions/:id/discharge',
  requirePermissions('admissions.discharge'),
  validate(v.dischargeSchema),
  c.discharge,
);
inpatientRoutes.get('/wards', requirePermissions('admissions.view'), c.wards);
inpatientRoutes.get('/rooms', requirePermissions('admissions.view'), c.rooms);
inpatientRoutes.get('/beds', requirePermissions('admissions.view'), c.beds);
inpatientRoutes.get('/beds/availability', requirePermissions('admissions.view'), c.availableBeds);
inpatientRoutes.get('/inpatient-lookups', requirePermissions('admissions.view'), c.lookups);
const shell = (body: z.ZodType) =>
  z.object({ body, query: z.object({}).passthrough(), params: z.object({}).passthrough() });
const entity = (body: z.ZodType) =>
  z.object({ body, query: z.object({}).passthrough(), params: z.object({ id: z.uuid() }) });
const ward = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(100),
  floor: z.string().trim().min(1).max(50),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});
inpatientRoutes.post(
  '/wards',
  requirePermissions('admissions.manage'),
  validate(shell(ward)),
  c.createWard,
);
inpatientRoutes.put(
  '/wards/:id',
  requirePermissions('admissions.manage'),
  validate(entity(ward.partial())),
  c.updateWard,
);
const room = z.object({
  name: z.string().trim().min(1).max(80),
  ward: z.string().trim().min(1).max(100),
  wardId: z.uuid().optional().nullable(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});
inpatientRoutes.post(
  '/rooms',
  requirePermissions('admissions.manage'),
  validate(shell(room)),
  c.createRoom,
);
inpatientRoutes.put(
  '/rooms/:id',
  requirePermissions('admissions.manage'),
  validate(entity(room.partial())),
  c.updateRoom,
);
const bed = z.object({
  roomId: z.uuid(),
  name: z.string().trim().min(1).max(50),
  status: z
    .enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE', 'BLOCKED'])
    .default('AVAILABLE'),
});
inpatientRoutes.post(
  '/beds',
  requirePermissions('admissions.manage'),
  validate(shell(bed)),
  c.createBed,
);
inpatientRoutes.put(
  '/beds/:id',
  requirePermissions('admissions.manage'),
  validate(entity(bed.partial())),
  c.updateBed,
);
inpatientRoutes.get(
  '/nursing/assigned-patients',
  requirePermissions('nursing.view'),
  c.assignedPatients,
);
inpatientRoutes.get('/nursing/staff', requirePermissions('nursing.view'), c.nursingStaff);
inpatientRoutes.get(
  '/nursing/handovers',
  requirePermissions('nursing.view'),
  validate(v.nursingAdmissionQuerySchema),
  c.handovers,
);
inpatientRoutes.post(
  '/nursing/handovers',
  requirePermissions('nursing.edit'),
  validate(v.handoverCreateSchema),
  c.createHandover,
);
inpatientRoutes.post(
  '/nursing/handovers/:id/acknowledge',
  requirePermissions('nursing.edit'),
  validate(v.handoverAcknowledgeSchema),
  c.acknowledgeHandover,
);
inpatientRoutes.get(
  '/nursing-notes',
  requirePermissions('nursing.view'),
  validate(v.nursingAdmissionQuerySchema),
  c.nursingNotes,
);
inpatientRoutes.post(
  '/nursing-notes',
  requirePermissions('nursing.edit'),
  validate(
    shell(
      z.object({
        admissionId: z.uuid(),
        observation: z.string().trim().min(1).max(2000),
        intervention: z.string().trim().min(1).max(2000),
        notes: z.string().trim().max(4000).default(''),
      }),
    ),
  ),
  c.addNursingNote,
);
inpatientRoutes.get(
  '/medication-administrations',
  requirePermissions('nursing.view'),
  validate(v.nursingAdmissionQuerySchema),
  c.medications,
);
inpatientRoutes.patch(
  '/medication-administrations/:id',
  requirePermissions('nursing.edit'),
  validate(
    entity(
      z.object({
        status: z.enum(['Administered', 'Missed', 'Refused', 'Held']),
        notes: z.string().max(1000).optional(),
      }),
    ),
  ),
  c.administerMedication,
);
const procedure = z.object({
  patientId: z.uuid(),
  admissionId: z.uuid().optional().nullable(),
  doctorId: z.uuid(),
  theatreId: z.uuid().optional().nullable(),
  name: z.string().min(2),
  team: z.array(z.string()).default([]),
  scheduledAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  indication: z.string().min(1),
  notes: z.string().default(''),
  status: z
    .enum(['Planned', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'])
    .default('Scheduled'),
  preOpChecklist: z.array(z.string()).default([]),
});
const procedureList = z.object({ query: z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  from_date: z.iso.date().optional(),
  to_date: z.iso.date().optional(),
  theatre_id: z.uuid().optional(),
  status: z.enum(['Planned', 'Scheduled', 'In Progress', 'Completed', 'Cancelled']).optional(),
  sort_by: z.enum(['scheduledAt','patient','name','doctor','theatre','durationMinutes','status']).default('scheduledAt'),
  sort_order: z.enum(['asc','desc']).default('desc'),
}).refine((value) => !value.from_date || !value.to_date || value.from_date <= value.to_date, { message: 'From date must be on or before to date.', path: ['to_date'] }) });
inpatientRoutes.get('/procedures', requirePermissions('procedures.view'), validate(procedureList), c.procedures);
inpatientRoutes.get('/procedures/stats', requirePermissions('procedures.view'), c.procedureStats);
inpatientRoutes.get('/procedure-lookups', requirePermissions('procedures.view'), c.procedureLookups);
inpatientRoutes.get('/procedures/:id', requirePermissions('procedures.view'), validate(v.admissionIdSchema), c.procedureDetails);
inpatientRoutes.post(
  '/procedures',
  requirePermissions('procedures.create'),
  validate(shell(procedure)),
  c.scheduleProcedure,
);
inpatientRoutes.put(
  '/procedures/:id',
  requirePermissions('procedures.edit'),
  validate(entity(procedure.partial())),
  c.updateProcedure,
);
