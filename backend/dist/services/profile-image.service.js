import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { authRepository } from '../repositories/auth.repository.js';
import { AppError } from '../utils/app-error.js';
const uploadRoot = resolve(env.FILE_UPLOAD_PATH, 'profiles');
const signatures = [{ mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, ext: '.jpg' }, { mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), ext: '.png' }, { mime: 'image/webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP', ext: '.webp' }];
const safePath = (key) => { const value = resolve(uploadRoot, key); if (!value.startsWith(uploadRoot + sep))
    throw new AppError(400, 'Invalid file reference.'); return value; };
export const profileImageService = { async upload(userId, file) { if (!file)
        throw new AppError(422, 'Validation failed.', 'VALIDATION_ERROR', { image: ['Select an image to upload.'] }); const kind = signatures.find(x => x.mime === file.mimetype && x.test(file.buffer)); if (!kind)
        throw new AppError(422, 'Validation failed.', 'VALIDATION_ERROR', { image: ['Only valid JPEG, PNG or WebP images are allowed.'] }); await mkdir(uploadRoot, { recursive: true }); const user = await authRepository.findUserById(userId); if (!user)
        throw new AppError(404, 'User was not found.'); const key = `${randomUUID()}${kind.ext}`; await writeFile(safePath(key), file.buffer, { flag: 'wx' }); await authRepository.updateAvatar(userId, key); if (user.avatarKey)
        await unlink(safePath(user.avatarKey)).catch(() => undefined); return { url: '/api/v1/profile/image' }; }, async remove(userId) { const user = await authRepository.findUserById(userId); if (!user)
        throw new AppError(404, 'User was not found.'); await authRepository.updateAvatar(userId, null); if (user.avatarKey)
        await unlink(safePath(user.avatarKey)).catch(() => undefined); }, async read(userId) { const user = await authRepository.findUserById(userId); if (!user?.avatarKey)
        throw new AppError(404, 'Profile image was not found.'); return { buffer: await readFile(safePath(user.avatarKey)), type: extname(user.avatarKey) === '.png' ? 'image/png' : extname(user.avatarKey) === '.webp' ? 'image/webp' : 'image/jpeg' }; } };
