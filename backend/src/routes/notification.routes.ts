import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { notificationService as service } from '../services/notification.service.js';
const page = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
  }),
});
const id = z.object({ params: z.object({ id: z.uuid() }) });
export const notificationRoutes = Router();
notificationRoutes.use(authenticate);
notificationRoutes.get(
  '/',
  validate(page),
  asyncHandler(async (req, res) =>
    res.json(
      await service.list(req.auth!.userId, Number(req.query.page), Number(req.query.page_size)),
    ),
  ),
);
notificationRoutes.get(
  '/unread-count',
  asyncHandler(async (req, res) =>
    res.json({ data: { count: await service.unreadCount(req.auth!.userId) } }),
  ),
);
notificationRoutes.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await service.readAll(req.auth!.userId);
    res.json({ data: null, message: 'Notifications marked as read.' });
  }),
);
notificationRoutes.patch(
  '/:id/read',
  validate(id),
  asyncHandler(async (req, res) =>
    res.json({ data: await service.read(req.auth!.userId, String(req.params.id)) }),
  ),
);
