import { asyncHandler } from '../utils/async-handler.js';
import { userService as service } from '../services/user.service.js';
export const list = asyncHandler(async (req, res) =>
  res.json(await service.list(req.query as never)),
);
export const details = asyncHandler(async (req, res) =>
  res.json({ data: await service.details(String(req.params.id)) }),
);
export const create = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({ data: await service.create(req.body), message: 'User created successfully.' }),
);
export const update = asyncHandler(async (req, res) =>
  res.json({
    data: await service.update(String(req.params.id), req.body),
    message: 'User updated successfully.',
  }),
);
export const status = asyncHandler(async (req, res) =>
  res.json({
    data: await service.status(String(req.params.id), req.body.status),
    message: 'User status updated.',
  }),
);
export const role = asyncHandler(async (req, res) =>
  res.json({
    data: await service.assignRole(String(req.params.id), req.body.roleCode),
    message: 'User role updated.',
  }),
);
export const archive = asyncHandler(async (req, res) =>
  res.json({ data: await service.archive(String(req.params.id)), message: 'User deleted.' }),
);
export const resetPassword = asyncHandler(async (req, res) =>
  res.json({
    data: await service.resetPassword(String(req.params.id), req.body.password, req.auth!.userId),
    message: 'Password reset successfully.',
  }),
);
