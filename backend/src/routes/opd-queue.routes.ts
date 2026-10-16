import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { opdQueueService } from '../services/opd-queue.service.js';

const statuses = ['WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED'] as const;
const params = z.object({ id: z.uuid() });
const empty = z.object({}).passthrough().optional();
export const opdQueueRoutes = Router();
opdQueueRoutes.use(authenticate);
opdQueueRoutes.get('/', requirePermissions('queue.view'), validate(z.object({ body: empty, params: z.object({}).passthrough(), query: z.object({ page: z.coerce.number().int().min(1).default(1), page_size: z.coerce.number().int().min(1).max(100).default(10), search: z.string().trim().max(100).optional(), department_id: z.uuid().optional(), doctor_id: z.uuid().optional(), status: z.enum(statuses).optional(), date: z.iso.date().optional(),sort_by:z.enum(['tokenNumber','patient','doctor','department','appointment','checkedInAt','status']).default('tokenNumber'),sort_order:z.enum(['asc','desc']).default('asc') }) })), asyncHandler(async (req, res) => res.json(await opdQueueService.list(req.query))));
opdQueueRoutes.get('/:id', requirePermissions('queue.view'), validate(z.object({ body: empty, query: z.object({}).passthrough(), params })), asyncHandler(async (req, res) => res.json({ data: await opdQueueService.get(String(req.params.id)) })));
opdQueueRoutes.patch('/:id/status', requirePermissions('appointments.edit'), validate(z.object({ body: z.object({ status: z.enum(statuses) }), query: z.object({}).passthrough(), params })), asyncHandler(async (req, res) => res.json({ data: await opdQueueService.status(String(req.params.id), req.body.status) })));
