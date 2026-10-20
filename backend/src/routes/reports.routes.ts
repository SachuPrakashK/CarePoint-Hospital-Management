import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { reportsService } from '../services/reports.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export const reportQuerySchema = z.object({
  body: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough(),
  query: z
    .object({
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
      department_id: z.uuid().optional(),
    })
    .refine((value) => !value.from || !value.to || value.from <= value.to, {
      path: ['to'],
      message: 'To date must be on or after From date.',
    }),
});

export const reportsRoutes = Router();
reportsRoutes.use(authenticate, requirePermissions('reports.view'));
reportsRoutes.get(
  '/export.csv',
  validate(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const canViewFinance = req.auth?.permissions.includes('billing.view') ?? false;
    const csv = await reportsService.csv(req.query, canViewFinance);
    const suffix =
      typeof req.query.to === 'string' ? req.query.to : new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="medicare-report-${suffix}.csv"`);
    res.send(csv);
  }),
);
reportsRoutes.get(
  '/overview',
  validate(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const canViewFinance = req.auth?.permissions.includes('billing.view') ?? false;
    res.json({ data: await reportsService.overview(req.query, canViewFinance) });
  }),
);
