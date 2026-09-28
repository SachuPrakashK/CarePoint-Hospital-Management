import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, refreshSchema, registerSchema, resetPasswordSchema } from '../validators/auth.validator.js';

export const authRoutes = Router();
authRoutes.post('/login', validate(loginSchema), controller.login);
authRoutes.post('/logout', authenticate, controller.logout);
authRoutes.get('/me', authenticate, controller.me);
authRoutes.post('/refresh', validate(refreshSchema), controller.refresh);
authRoutes.post('/change-password', authenticate, validate(changePasswordSchema), controller.changePassword);
authRoutes.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
authRoutes.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);
authRoutes.post('/register', validate(registerSchema), controller.register);
