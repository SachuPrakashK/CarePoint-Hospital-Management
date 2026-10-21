import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { authRepository } from '../repositories/auth.repository.js';
import { AppError } from '../utils/app-error.js';
import { fileStorage } from './file-storage.service.js';
const signatures = [
  {
    mime: 'image/jpeg',
    test: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    ext: '.jpg',
  },
  {
    mime: 'image/png',
    test: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    ext: '.png',
  },
  {
    mime: 'image/webp',
    test: (b: Buffer) =>
      b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
    ext: '.webp',
  },
];
const storageKey = (key: string) => `profiles/${key}`;
export const profileImageService = {
  async upload(userId: string, file?: Express.Multer.File) {
    if (!file)
      throw new AppError(422, 'Validation failed.', 'VALIDATION_ERROR', {
        image: ['Select an image to upload.'],
      });
    const kind = signatures.find((x) => x.mime === file.mimetype && x.test(file.buffer));
    if (!kind)
      throw new AppError(422, 'Validation failed.', 'VALIDATION_ERROR', {
        image: ['Only valid JPEG, PNG or WebP images are allowed.'],
      });
    const user = await authRepository.findUserById(userId);
    if (!user) throw new AppError(404, 'User was not found.');
    const key = `${randomUUID()}${kind.ext}`;
    await fileStorage.put(storageKey(key), file.buffer);
    try {
      await authRepository.updateAvatar(userId, key);
    } catch (error) {
      await fileStorage.remove(storageKey(key)).catch(() => undefined);
      throw error;
    }
    if (user.avatarKey) await fileStorage.remove(storageKey(user.avatarKey)).catch(() => undefined);
    return { url: '/api/v1/profile/image' };
  },
  async remove(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new AppError(404, 'User was not found.');
    await authRepository.updateAvatar(userId, null);
    if (user.avatarKey) await fileStorage.remove(storageKey(user.avatarKey)).catch(() => undefined);
  },
  async read(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user?.avatarKey) throw new AppError(404, 'Profile image was not found.');
    return {
      buffer: await fileStorage.get(storageKey(user.avatarKey)),
      type:
        extname(user.avatarKey) === '.png'
          ? 'image/png'
          : extname(user.avatarKey) === '.webp'
            ? 'image/webp'
            : 'image/jpeg',
    };
  },
};
