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
export const refresh = asyncHandler(async (req, res) => res.json({ data: await authService.refresh(req.body.refresh_token, { userAgent: req.get('user-agent'), ipAddress: req.ip }), message: 'Session refreshed.' }));
export const changePassword = asyncHandler(async (req, res) => { await authService.changePassword(req.auth.userId, req.body.current_password, req.body.new_password); res.json({ data: null, message: 'Password changed successfully.' }); });
export const forgotPassword = asyncHandler(async (req, res) => { await authService.forgotPassword(req.body.email); res.json({ data: null, message: 'If an eligible account exists, password reset instructions have been sent.' }); });
export const resetPassword = asyncHandler(async (req, res) => { await authService.resetPassword(req.body.token, req.body.password); res.json({ data: null, message: 'Password reset successfully.' }); });
export const register = asyncHandler(async (req, res) => res.status(201).json({ data: await authService.register(req.body), message: 'Account created successfully. Please sign in.' }));
