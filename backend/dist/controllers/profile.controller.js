import { asyncHandler } from '../utils/async-handler.js';
import { profileImageService } from '../services/profile-image.service.js';
export const uploadImage = asyncHandler(async (req, res) => res.status(201).json({ data: await profileImageService.upload(req.auth.userId, req.file), message: 'Profile image updated successfully.' }));
export const deleteImage = asyncHandler(async (req, res) => { await profileImageService.remove(req.auth.userId); res.json({ data: null, message: 'Profile image deleted successfully.' }); });
export const getImage = asyncHandler(async (req, res) => { const image = await profileImageService.read(req.auth.userId); res.type(image.type).set('Cache-Control', 'private, max-age=300').send(image.buffer); });
