import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermissions, requireRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { languageService as service } from '../services/language.service.js';
const request = (
  body: z.ZodType = z.object({}).passthrough(),
  params: z.ZodType = z.object({}).passthrough(),
) => z.object({ body, params, query: z.object({}).passthrough() });
const languageCode = z.string().min(2).max(35);
const configuredLanguageIdentifier = z.string().min(2).max(64);
const manage = [requirePermissions('settings.update'), requireRoles('HOSPITAL_ADMIN')];

export const languageRoutes = Router();
languageRoutes.get(
  '/public',
  asyncHandler(async (_q, r) => r.json({ data: await service.listEnabled() })),
);
languageRoutes.use(authenticate);
languageRoutes.get(
  '/',
  asyncHandler(async (_q, r) => r.json({ data: await service.listEnabled() })),
);
languageRoutes.get(
  '/configuration',
  requirePermissions('settings.view'),
  asyncHandler(async (_q, r) => r.json({ data: await service.listAll() })),
);
languageRoutes.get(
  '/catalog',
  ...manage,
  asyncHandler(async (q, r) =>
    r.json({ data: await service.catalog(String(q.query.search ?? '')) }),
  ),
);
languageRoutes.get(
  '/preference',
  asyncHandler(async (q, r) => r.json({ data: await service.preference(q.auth!.userId) })),
);
languageRoutes.put(
  '/preference',
  validate(request(z.object({ code: languageCode }))),
  asyncHandler(async (q, r) => r.json({ data: await service.select(q.auth!.userId, q.body.code) })),
);
languageRoutes.post(
  '/',
  ...manage,
  validate(request(z.object({ code: languageCode }))),
  asyncHandler(async (q, r) => r.status(201).json({ data: await service.add(q.body.code) })),
);
languageRoutes.post(
  '/batch',
  ...manage,
  validate(request(z.object({ codes: z.array(languageCode).min(1).max(50) }))),
  asyncHandler(async (q, r) => r.status(201).json({ data: await service.addMany(q.body.codes) })),
);
languageRoutes.get(
  '/:code/translations',
  ...manage,
  validate(request(z.unknown(), z.object({ code: configuredLanguageIdentifier }))),
  asyncHandler(async (q, r) => r.json({ data: await service.translations(String(q.params.code)) })),
);
languageRoutes.put(
  '/:code/translations',
  ...manage,
  validate(
    request(
      z.object({
        values: z
          .record(z.string().max(120), z.string().max(500))
          .refine((values) => Object.keys(values).length <= 5000, 'Too many translation values.'),
      }),
      z.object({ code: configuredLanguageIdentifier }),
    ),
  ),
  asyncHandler(async (q, r) =>
    r.json({ data: await service.saveTranslations(String(q.params.code), q.body.values) }),
  ),
);
languageRoutes.patch(
  '/:code',
  ...manage,
  validate(
    request(
      z
        .object({ enabled: z.boolean().optional(), isDefault: z.boolean().optional() })
        .refine((value) => value.enabled !== undefined || value.isDefault !== undefined),
      z.object({ code: configuredLanguageIdentifier }),
    ),
  ),
  asyncHandler(async (q, r) =>
    r.json({ data: await service.update(String(q.params.code), q.body) }),
  ),
);
languageRoutes.delete(
  '/:code',
  ...manage,
  validate(request(z.unknown(), z.object({ code: configuredLanguageIdentifier }))),
  asyncHandler(async (q, r) => {
    await service.remove(String(q.params.code));
    r.status(204).send();
  }),
);
