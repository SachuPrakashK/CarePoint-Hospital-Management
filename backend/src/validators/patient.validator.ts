import { z } from 'zod';
const normalizeIndianPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? `+${digits}` : digits;
};
const indianPhone = z.string().trim().transform(normalizeIndianPhone).pipe(
  z.string().regex(/^(?:\+91)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number.'),
);
const patientBody = z.object({
  firstName: z.string().trim().min(2).max(100).regex(/^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u, 'Enter a valid first name.'),
  middleName: z.string().trim().max(100).regex(/^[\p{L}\p{M}' .-]*$/u, 'Enter a valid middle name.').optional().or(z.literal('')),
  lastName: z.string().trim().min(1).max(100).regex(/^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u, 'Enter a valid last name.'),
  dob: z.coerce.date().max(new Date()),
  gender: z.string().min(1).max(40),
  bloodGroup: z.string().max(10).default('Unknown'),
  phone: indianPhone,
  email: z.union([z.string().trim().toLowerCase().email(), z.literal('')]).optional(),
  city: z.string().trim().max(100).optional(),
  emergencyContact: z.union([indianPhone, z.literal('')]).optional(),
  allergies: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});
const envelope = <T extends z.ZodType>(body: T) =>
  z.object({ body, query: z.object({}).passthrough(), params: z.object({}).passthrough() });
export const createPatientSchema = envelope(patientBody);
export const updatePatientSchema = envelope(patientBody.partial());
export const patientIdSchema = z.object({
  body: z.unknown(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.uuid() }),
});
export const patientListSchema = z.object({
  body: z.unknown(),
  params: z.object({}).passthrough(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(100).optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
    gender: z.string().trim().min(1).max(40).optional(),
    min_age: z.coerce.number().int().min(0).max(130).optional(),
    max_age: z.coerce.number().int().min(0).max(130).optional(),
    created_from: z.iso.date().optional(),
    created_to: z.iso.date().optional(),
    sort_by: z.enum(['createdAt', 'firstName', 'lastName', 'mrn']).default('createdAt'),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
  }).refine((query) => query.min_age == null || query.max_age == null || query.min_age <= query.max_age, {
    message: 'Minimum age cannot exceed maximum age.',
    path: ['min_age'],
  }).refine((query) => !query.created_from || !query.created_to || query.created_from <= query.created_to, {
    message: 'Start date cannot be after end date.',
    path: ['created_from'],
  }),
});
