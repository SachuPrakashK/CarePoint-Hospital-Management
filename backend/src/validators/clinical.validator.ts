import { z } from 'zod';
const uuid = z.uuid();
export const patientClinicalSchema = z.object({
  params: z.object({ id: uuid }),
  query: z
    .object({
      type: z.string().trim().max(40).optional(),
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
    })
    .optional(),
});
export const consultationIdSchema = z.object({ params: z.object({ id: uuid }) });
export const consultationCreateSchema = z.object({
  body: z.object({
    appointmentId: uuid,
    chiefComplaint: z.string().min(1).max(2000),
    symptoms: z.string().max(5000).optional(),
    examination: z.string().max(5000).optional(),
    notes: z.string().max(10000).optional(),
    treatmentPlan: z.string().max(5000).optional(),
    primaryDiagnosis: z.string().max(1000).optional(),
    secondaryDiagnoses: z.array(z.string().max(1000)).optional(),
    vitals: z
      .array(
        z.object({
          temperature: z.number().optional(),
          pulse: z.number().int().optional(),
          systolic: z.number().int().optional(),
          diastolic: z.number().int().optional(),
          spo2: z.number().int().optional(),
          height: z.number().optional(),
          weight: z.number().optional(),
          bmi: z.number().optional(),
          painScore: z.number().int().optional(),
        }),
      )
      .optional(),
    prescription: z
      .array(
        z.object({
          medicine: z.string().min(1),
          strength: z.string(),
          dose: z.string(),
          frequency: z.string(),
          route: z.string(),
          duration: z.string(),
          quantity: z.number().int().positive(),
          instructions: z.string(),
        }),
      )
      .optional(),
    followUpDate: z.iso.datetime().optional(),
    followUpInstructions: z.string().max(2000).optional(),
  }),
});
export const consultationUpdateSchema = z.object({
  params: z.object({ id: uuid }),
  body: consultationCreateSchema.shape.body.omit({ appointmentId: true }).partial(),
});
export const vitalCreateSchema = z.object({
  body: z.object({
    patientId: uuid,
    consultationId: uuid.optional(),
    temperature: z.number().min(25).max(50).optional(),
    pulse: z.number().int().min(1).max(300).optional(),
    systolic: z.number().int().min(30).max(300).optional(),
    diastolic: z.number().int().min(20).max(200).optional(),
    spo2: z.number().int().min(1).max(100).optional(),
    height: z.number().positive().optional(),
    weight: z.number().positive().optional(),
    bmi: z.number().positive().optional(),
    painScore: z.number().int().min(0).max(10).optional(),
  }),
});
export const diagnosisCreateSchema = z.object({
  body: z.object({
    patientId: uuid,
    consultationId: uuid,
    code: z.string().max(30).optional(),
    description: z.string().min(1).max(1000),
    type: z.string().max(30).optional(),
    status: z.string().max(30).optional(),
  }),
});
export const diagnosisUpdateSchema = z.object({
  params: z.object({ id: uuid }),
  body: diagnosisCreateSchema.shape.body.omit({ patientId: true, consultationId: true }).partial(),
});
const item = z.object({
  medicine: z.string().min(1),
  strength: z.string(),
  dose: z.string(),
  frequency: z.string(),
  route: z.string(),
  duration: z.string(),
  quantity: z.number().int().positive(),
  instructions: z.string(),
});
export const prescriptionCreateSchema = z.object({
  body: z.object({
    patientId: uuid,
    consultationId: uuid.optional(),
    doctorId: uuid.optional(),
    status: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(item).min(1),
  }),
});
export const prescriptionUpdateSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ status: z.string().optional(), notes: z.string().optional() }),
});
