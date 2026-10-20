import { Router } from 'express';
import multer from 'multer';
import * as c from '../controllers/document.controller.js';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../utils/app-error.js';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});
const id = z.object({ params: z.object({ id: z.uuid() }) });
const listing = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).optional(),
    owner_type: z.string().trim().max(50).optional(),
    mime_type: z.string().trim().max(100).optional(),
    created_from: z.iso.date().optional(),
    created_to: z.iso.date().optional(),
    sort_by: z
      .enum(['originalName', 'ownerType', 'mimeType', 'size', 'uploadedBy', 'createdAt'])
      .default('createdAt'),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
  }),
});
export const documentRoutes = Router();
documentRoutes.use(authenticate);
documentRoutes.get('/documents', requirePermissions('documents.view'), validate(listing), c.list);
documentRoutes.post(
  '/documents',
  requirePermissions('documents.create'),
  (req, res, next) =>
    upload.single('file')(req, res, (error) =>
      error
        ? next(
            new AppError(
              422,
              error.code === 'LIMIT_FILE_SIZE'
                ? 'Document must be 10 MB or smaller.'
                : 'The document upload is invalid.',
              'UPLOAD_ERROR',
            ),
          )
        : next(),
    ),
  c.upload,
);
documentRoutes.get('/documents/:id', requirePermissions('documents.view'), validate(id), c.details);
documentRoutes.get(
  '/documents/:id/view',
  requirePermissions('documents.view'),
  validate(id),
  c.preview,
);
documentRoutes.get(
  '/documents/:id/download',
  requirePermissions('documents.download'),
  validate(id),
  c.download,
);
documentRoutes.delete(
  '/documents/:id',
  requirePermissions('documents.delete'),
  validate(id),
  c.remove,
);
documentRoutes.get(
  '/patients/:id/documents',
  requirePermissions('documents.view'),
  validate(id),
  c.forPatient,
);
