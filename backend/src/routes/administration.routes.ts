import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { administrationService as service } from '../services/administration.service.js';
import multer from 'multer';
import { hospitalLogoService } from '../services/hospital-logo.service.js';
import { AppError } from '../utils/app-error.js';

const shell = (body: z.ZodTypeAny) =>
  z.object({ body, params: z.object({}).passthrough(), query: z.object({}).passthrough() });
const id = z.object({
  body: z.object({}).passthrough().optional().default({}),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.uuid() }),
});
const role = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  permissionCodes: z.array(z.string().regex(/^[a-z_]+\.[a-z_]+$/)).default([]),
});
export const administrationRoutes = Router();
administrationRoutes.use(authenticate);
administrationRoutes.get(
  '/settings/application-config',
  asyncHandler(async (_q, r) => r.json({ data: await service.application() })),
);
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_q, file, done) =>
    done(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});
administrationRoutes.get(
  '/settings/hospital/logo',
  requirePermissions('settings.view'),
  asyncHandler(async (_q, r) => {
    const image = await hospitalLogoService.read();
    r.type(image.type).set('Cache-Control', 'private, max-age=300').send(image.buffer);
  }),
);
administrationRoutes.post(
  '/settings/hospital/logo',
  requirePermissions('settings.update'),
  (q, r, next) =>
    logoUpload.single('logo')(q, r, (e) =>
      e
        ? next(
            new AppError(
              422,
              e.code === 'LIMIT_FILE_SIZE'
                ? 'Logo must be 2 MB or smaller.'
                : 'Invalid logo upload.',
              'UPLOAD_ERROR',
            ),
          )
        : next(),
    ),
  asyncHandler(async (q, r) =>
    r.status(201).json({ data: await hospitalLogoService.upload(q.file) }),
  ),
);
administrationRoutes.delete(
  '/settings/hospital/logo',
  requirePermissions('settings.update'),
  asyncHandler(async (_q, r) => {
    await hospitalLogoService.remove();
    r.json({ data: null });
  }),
);
administrationRoutes.get(
  '/permissions',
  requirePermissions('roles.view'),
  asyncHandler(async (_q, r) => r.json({ data: await service.permissions() })),
);
administrationRoutes.get(
  '/roles',
  requirePermissions('roles.view'),
  validate(
    z.object({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        page_size: z.coerce.number().int().min(1).max(100).default(10),
        search: z.string().trim().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
        sort_by: z.enum(['name', 'description', 'users', 'status', 'createdAt']).optional(),
        sort_order: z.enum(['asc', 'desc']).optional(),
      }),
    }),
  ),
  asyncHandler(async (q, r) => r.json(await service.roles(q.query as any))),
);
administrationRoutes.get(
  '/roles/:id',
  requirePermissions('roles.view'),
  validate(id),
  asyncHandler(async (q, r) => r.json({ data: await service.role(String(q.params.id)) })),
);
administrationRoutes.post(
  '/roles',
  requirePermissions('roles.create'),
  validate(shell(role)),
  asyncHandler(async (q, r) =>
    r.status(201).json({ data: await service.createRole(q.body, q.auth!.userId) }),
  ),
);
administrationRoutes.put(
  '/roles/:id',
  requirePermissions('roles.update'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: role.partial(),
    }),
  ),
  asyncHandler(async (q, r) =>
    r.json({ data: await service.updateRole(String(q.params.id), q.body, q.auth!.userId) }),
  ),
);
administrationRoutes.delete(
  '/roles/:id',
  requirePermissions('roles.delete'),
  validate(id),
  asyncHandler(async (q, r) => {
    await service.deleteRole(String(q.params.id), q.auth!.userId);
    r.json({ data: null });
  }),
);
const hospital = z.object({
  hospitalName: z.string().trim().min(2).max(160),
  hospitalCode: z.string().trim().min(2).max(40),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(30),
  email: z.union([z.literal(''), z.email()]),
  website: z.union([z.literal(''), z.url()]),
  registrationNumber: z.string().trim().max(80),
});
const application = z.object({
  applicationName: z.string().trim().min(2).max(160),
  dateFormat: z.enum(['DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD']),
  timeFormat: z.enum(['12-hour', '24-hour']),
  timezone: z.literal('Asia/Kolkata'),
  defaultRowsPerPage: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]),
});
const notifications = z.object({
  appointmentCreated: z.boolean(),
  appointmentCancelled: z.boolean(),
  laboratoryResultVerified: z.boolean(),
  radiologyResultVerified: z.boolean(),
  lowInventory: z.boolean(),
  paymentReceived: z.boolean(),
});
const security = z.object({
  sessionTimeoutMinutes: z.number().int().min(5).max(1440),
  passwordMinimumLength: z.number().int().min(8).max(128),
  requireUppercase: z.boolean(),
  requireLowercase: z.boolean(),
  requireNumber: z.boolean(),
  requireSpecial: z.boolean(),
  maximumLoginAttempts: z.number().int().min(3).max(20),
  accountLockMinutes: z.number().int().min(5).max(1440),
});
for (const [section, schema] of Object.entries({
  hospital,
  application,
  notifications,
  security,
}) as [any, any][]) {
  administrationRoutes.get(
    `/settings/${section}`,
    requirePermissions('settings.view'),
    asyncHandler(async (_q, r) => r.json({ data: await (service as any)[section]() })),
  );
  administrationRoutes.patch(
    `/settings/${section}`,
    requirePermissions('settings.update'),
    validate(shell(schema)),
    asyncHandler(async (q, r) =>
      r.json({ data: await service.updateSettings(section, q.body, q.auth!.userId) }),
    ),
  );
}
