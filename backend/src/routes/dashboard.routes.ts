import { Router } from 'express';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { dashboardService } from '../services/dashboard.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export const dashboardRoutes = Router();
dashboardRoutes.use(authenticate, requirePermissions('dashboard.view'));
dashboardRoutes.get('/summary', asyncHandler(async (_req, res) => { res.json({ data: await dashboardService.summary() }); }));
dashboardRoutes.get('/patient-trends', asyncHandler(async (req, res) => { res.json({ data: await dashboardService.patientTrends(Number(req.query.days) || 30) }); }));
dashboardRoutes.get('/appointments-by-department', asyncHandler(async (_req, res) => { res.json({ data: await dashboardService.appointmentsByDepartment() }); }));
dashboardRoutes.get('/appointment-status', asyncHandler(async (_req, res) => { res.json({ data: await dashboardService.appointmentStatus() }); }));
dashboardRoutes.get('/recent-appointments', asyncHandler(async (_req, res) => { res.json({ data: await dashboardService.recentAppointments() }); }));
