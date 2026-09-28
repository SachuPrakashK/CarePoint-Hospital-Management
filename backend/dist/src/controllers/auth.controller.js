import { authService } from '../services/auth.service.js';
import { asyncHandler } from '../utils/async-handler.js';
export const login = asyncHandler(async (req, res) => {
    const data = await authService.login(req.body.email, req.body.password, { userAgent: req.get('user-agent'), ipAddress: req.ip });
    res.json({ data, message: 'Login successful.' });
});
export const logout = asyncHandler(async (req, res) => {
    await authService.logout(req.auth.sessionId);
    res.json({ data: null, message: 'Logout successful.' });
});
export const me = asyncHandler(async (req, res) => {
    res.json({ data: { id: req.auth.userId, permissions: req.auth.permissions } });
});
