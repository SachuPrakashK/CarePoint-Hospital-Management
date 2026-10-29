import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  staffDirectoryService as service,
  type StaffKind,
} from '../services/staff-directory.service.js';
const list = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    department_id: z.uuid().optional(),
    specialization_id: z.uuid().optional(),
    designation: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(),
    sort_by: z
      .enum([
        'employeeCode',
        'firstName',
        'department',
        'specialization',
        'designation',
        'phone',
        'email',
        'yearsOfExperience',
        'joiningDate',
        'status',
      ])
      .default('firstName'),
    sort_order: z.enum(['asc', 'desc']).default('asc'),
  }),
});
const params = z.object({ id: z.uuid() });
const body = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  dateOfBirth: z.iso.date().optional().nullable(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/),
  email: z.email(),
  address: z.string().trim().max(500).optional(),
  employeeCode: z.string().trim().min(2).max(40),
  departmentId: z.uuid(),
  specializationId: z.uuid().optional().nullable(),
  medicalRegistration: z.string().trim().min(2).max(80).optional().nullable(),
  qualification: z.string().trim().max(150).optional(),
  yearsOfExperience: z.number().int().nonnegative().max(80).optional().nullable(),
  consultationFee: z.number().nonnegative().max(1000000).optional().nullable(),
  designation: z.string().trim().max(100).optional(),
  joiningDate: z.iso.date().optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  roleCode: z.string().trim().optional(),
  password: z.string().min(12).max(128).optional(),
});
export const staffDirectoryRoutes = Router();
staffDirectoryRoutes.use(authenticate);
for (const kind of ['doctors', 'employees'] as StaffKind[]) {
  const permission = (action: string) => `${kind}.${action}`;
  staffDirectoryRoutes.get(
    `/${kind}`,
    requirePermissions(permission('view')),
    validate(list),
    asyncHandler(async (q, r) => r.json(await service.list(kind, q.query as any))),
  );
  staffDirectoryRoutes.get(
    `/${kind}/options`,
    requirePermissions(permission('view')),
    asyncHandler(async (_q, r) => r.json({ data: await service.options() })),
  );
  staffDirectoryRoutes.get(
    `/${kind}/:id`,
    requirePermissions(permission('view')),
    validate(
      z.object({
        params,
        query: z.object({}).passthrough(),
        body: z.object({}).passthrough().optional(),
      }),
    ),
    asyncHandler(async (q, r) => r.json({ data: await service.get(kind, String(q.params.id)) })),
  );
  staffDirectoryRoutes.post(
    `/${kind}`,
    requirePermissions(permission('create')),
    validate(
      z.object({ body, params: z.object({}).passthrough(), query: z.object({}).passthrough() }),
    ),
    asyncHandler(async (q, r) =>
      r.status(201).json({ data: await service.create(kind, q.body, q.auth!.userId) }),
    ),
  );
  staffDirectoryRoutes.patch(
    `/${kind}/:id`,
    requirePermissions(permission('update')),
    validate(z.object({ params, body, query: z.object({}).passthrough() })),
    asyncHandler(async (q, r) =>
      r.json({ data: await service.update(kind, String(q.params.id), q.body, q.auth!.userId) }),
    ),
  );
  staffDirectoryRoutes.delete(
    `/${kind}/:id`,
    requirePermissions(permission('delete')),
    validate(
      z.object({
        params,
        body: z.object({}).passthrough().optional(),
        query: z.object({}).passthrough(),
      }),
    ),
    asyncHandler(async (q, r) => {
      await service.remove(kind, String(q.params.id), q.auth!.userId);
      r.json({ data: null });
    }),
  );
}
