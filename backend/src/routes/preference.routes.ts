import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  tablePreferenceParams,
  updateTablePreference,
} from '../validators/preference.validator.js';
export const preferenceRoutes = Router();
preferenceRoutes.use(authenticate);
preferenceRoutes.get(
  '/tables/:tableId',
  validate(tablePreferenceParams),
  asyncHandler(async (req, res) => {
    const data = await prisma.userTablePreference.findUnique({
      where: { userId_tableId: { userId: req.auth!.userId, tableId: String(req.params.tableId) } },
    });
    res.json({
      data: data ? { tableId: data.tableId, visibleColumnIds: data.visibleColumnIds } : null,
    });
  }),
);
preferenceRoutes.put(
  '/tables/:tableId',
  validate(updateTablePreference),
  asyncHandler(async (req, res) => {
    const tableId = String(req.params.tableId);
    const visibleColumnIds = req.body.visibleColumnIds as string[];
    const data = await prisma.userTablePreference.upsert({
      where: { userId_tableId: { userId: req.auth!.userId, tableId } },
      update: { visibleColumnIds },
      create: { userId: req.auth!.userId, tableId, visibleColumnIds },
    });
    res.json({ data: { tableId: data.tableId, visibleColumnIds: data.visibleColumnIds } });
  }),
);
preferenceRoutes.delete(
  '/tables/:tableId',
  validate(tablePreferenceParams),
  asyncHandler(async (req, res) => {
    await prisma.userTablePreference.deleteMany({
      where: { userId: req.auth!.userId, tableId: String(req.params.tableId) },
    });
    res.status(204).send();
  }),
);
