import { z } from 'zod';
const uuid = z.uuid();
export const admissionListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).optional(),
    department_id: uuid.optional(),
    status: z
      .enum(['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED', 'DISCHARGED', 'CANCELLED'])
      .optional(),
    sort_by:z.enum(['admittedAt','number','patient','department','doctor','status']).default('admittedAt'),
    sort_order:z.enum(['asc','desc']).default('desc'),
  }),
});
export const admissionIdSchema = z.object({ params: z.object({ id: uuid }) });
export const admissionCreateSchema = z.object({
  body: z.object({
    patientId: uuid,
    departmentId: uuid,
    attendingDoctorId: uuid,
    bedId: uuid,
    admittedAt: z.iso.datetime(),
    type: z.enum(['Emergency', 'Planned', 'Transfer']),
    reason: z.string().min(1).max(2000),
    initialDiagnosis: z.string().min(1).max(2000),
  }),
});
export const admissionUpdateSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    reason: z.string().min(1).max(2000).optional(),
    initialDiagnosis: z.string().min(1).max(2000).optional(),
  }),
});
export const transferSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ toBedId: uuid, reason: z.string().max(1000).optional() }),
});
export const dischargeSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    finalDiagnosis: z.string().min(1),
    treatmentSummary: z.string(),
    procedures: z.string(),
    investigationSummary: z.string(),
    conditionAtDischarge: z.string(),
    medications: z.string(),
    instructions: z.string(),
    followUp: z.string(),
    attendingDoctor: z.string(),
  }),
});

export const nursingAdmissionQuerySchema = z.object({
  query: z.object({ admission_id: uuid.optional() }),
});

export const handoverCreateSchema = z.object({
  body: z.object({
    admissionId: uuid,
    fromShift: z.enum(['MORNING', 'EVENING', 'NIGHT']),
    toShift: z.enum(['MORNING', 'EVENING', 'NIGHT']),
    handedOverToId: uuid.optional().nullable(),
    clinicalSummary: z.string().trim().min(1).max(4000),
    currentCondition: z.string().trim().min(1).max(2000),
    importantObservations: z.string().trim().max(4000).default(''),
    pendingTasks: z.string().trim().max(4000).default(''),
    medicationNotes: z.string().trim().max(4000).default(''),
    investigationsPending: z.string().trim().max(4000).default(''),
    specialInstructions: z.string().trim().max(4000).default(''),
    riskAlerts: z.string().trim().max(4000).default(''),
    additionalNotes: z.string().trim().max(4000).default(''),
  }).refine((value) => value.fromShift !== value.toShift, {
    message: 'From shift and to shift must be different.',
    path: ['toShift'],
  }),
});

export const handoverAcknowledgeSchema = z.object({
  params: z.object({ id: uuid }),
});
