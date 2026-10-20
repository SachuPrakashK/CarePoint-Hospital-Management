import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { openApiDocument } from './config/openapi.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { authRoutes } from './routes/auth.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { patientRoutes } from './routes/patient.routes.js';
import { profileRoutes } from './routes/profile.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { notificationRoutes } from './routes/notification.routes.js';
import { appointmentRoutes } from './routes/appointment.routes.js';
import { clinicalRoutes } from './routes/clinical.routes.js';
import { inpatientRoutes } from './routes/inpatient.routes.js';
import { documentRoutes } from './routes/document.routes.js';
import { phase23Routes } from './routes/phase23.routes.js';
import { opdQueueRoutes } from './routes/opd-queue.routes.js';
import { administrationRoutes } from './routes/administration.routes.js';
import { staffDirectoryRoutes } from './routes/staff-directory.routes.js';
import { administrationService } from './services/administration.service.js';
import { preferenceRoutes } from './routes/preference.routes.js';
import { languageRoutes } from './routes/language.routes.js';
import { supportRoutes } from './routes/support.routes.js';
import { reportsRoutes } from './routes/reports.routes.js';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const id = req.get('x-request-id') ?? randomUUID();
    res.setHeader('x-request-id', id);
    next();
  });
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(
    '/api/v1/auth/login',
    rateLimit({
      windowMs: 15 * 60_000,
      limit: async () => (await administrationService.security()).maximumLoginAttempts,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  app.use(
    '/api/v1/auth/forgot-password',
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 5,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  app.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/patients', patientRoutes);
  app.use('/api/v1/profile', profileRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1', administrationRoutes);
  app.use('/api/v1', staffDirectoryRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/preferences', preferenceRoutes);
  app.use('/api/v1/languages', languageRoutes);
  app.use('/api/v1/support', supportRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use('/api/v1/appointments', appointmentRoutes);
  app.use('/api/v1/opd-queue', opdQueueRoutes);
  app.use('/api/v1', clinicalRoutes);
  app.use('/api/v1', inpatientRoutes);
  app.use('/api/v1', documentRoutes);
  app.use('/api/v1', phase23Routes);
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/api/docs.json', (_req, res) => res.json(openApiDocument));
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

export default createApp();
