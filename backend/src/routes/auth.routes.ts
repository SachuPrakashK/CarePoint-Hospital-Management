import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/app-error.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
} from '../validators/auth.validator.js';

export const authRoutes = Router();
authRoutes.post('/login', validate(loginSchema), controller.login);
authRoutes.post('/logout', authenticate, controller.logout);
authRoutes.get('/me', authenticate, controller.me);
authRoutes.post('/refresh', validate(refreshSchema), controller.refresh);
authRoutes.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  controller.changePassword,
);
authRoutes.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
authRoutes.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);
authRoutes.use((req, _res, next) =>
  next(new AppError(404, `Route ${req.method} ${req.path} was not found.`, 'NOT_FOUND')),
);
