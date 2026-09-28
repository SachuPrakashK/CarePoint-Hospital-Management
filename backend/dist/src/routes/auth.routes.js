import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validators/auth.validator.js';
export const authRoutes = Router();
authRoutes.post('/login', validate(loginSchema), controller.login);
authRoutes.post('/logout', authenticate, controller.logout);
authRoutes.get('/me', authenticate, controller.me);
