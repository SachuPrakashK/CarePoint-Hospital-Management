import { Router } from 'express';
import * as c from '../controllers/user.controller.js';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  userCreateSchema,
  userIdSchema,
  userListSchema,
  userRoleSchema,
  userResetPasswordSchema,
  userStatusSchema,
  userUpdateSchema,
} from '../validators/user.validator.js';
export const userRoutes = Router();
userRoutes.use(authenticate);
userRoutes.get('/', requirePermissions('users.view'), validate(userListSchema), c.list);
userRoutes.post('/', requirePermissions('users.create'), validate(userCreateSchema), c.create);
userRoutes.get('/:id', requirePermissions('users.view'), validate(userIdSchema), c.details);
userRoutes.put('/:id', requirePermissions('users.update'), validate(userUpdateSchema), c.update);
userRoutes.delete('/:id', requirePermissions('users.delete'), validate(userIdSchema), c.archive);
userRoutes.patch(
  '/:id/status',
  requirePermissions('users.update'),
  validate(userStatusSchema),
  c.status,
);
userRoutes.patch('/:id/role', requirePermissions('users.update'), validate(userRoleSchema), c.role);
userRoutes.patch(
  '/:id/reset-password',
  requirePermissions('users.reset_password'),
  validate(userResetPasswordSchema),
  c.resetPassword,
);
