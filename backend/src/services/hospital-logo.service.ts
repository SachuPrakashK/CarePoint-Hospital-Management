import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { fileStorage } from './file-storage.service.js';

const storageKey = (key: string) => `hospital/${key}`;
const kinds = [
  {
    mime: 'image/jpeg',
    ext: '.jpg',
    test: (buffer: Buffer) => buffer[0] === 255 && buffer[1] === 216,
  },
  {
    mime: 'image/png',
    ext: '.png',
    test: (buffer: Buffer) =>
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    mime: 'image/webp',
    ext: '.webp',
    test: (buffer: Buffer) =>
      buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP',
  },
];

export const hospitalLogoService = {
  async upload(file?: Express.Multer.File) {
    if (!file) throw new AppError(422, 'Select a logo.', 'VALIDATION_ERROR');
    const kind = kinds.find((item) => item.mime === file.mimetype && item.test(file.buffer));
    if (!kind)
      throw new AppError(
        422,
        'Only valid JPEG, PNG or WebP logos are allowed.',
        'VALIDATION_ERROR',
      );
    const settings = await prisma.hospitalSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    const key = `${randomUUID()}${kind.ext}`;
    await fileStorage.put(storageKey(key), file.buffer);
    try {
      await prisma.hospitalSettings.update({
        where: { id: 'default' },
        data: { logoKey: key },
      });
    } catch (error) {
      await fileStorage.remove(storageKey(key)).catch(() => undefined);
      throw error;
    }
    if (settings.logoKey)
      await fileStorage.remove(storageKey(settings.logoKey)).catch(() => undefined);
    return { url: '/api/v1/settings/hospital/logo' };
  },
  async remove() {
    const settings = await prisma.hospitalSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    await prisma.hospitalSettings.update({
      where: { id: 'default' },
      data: { logoKey: null },
    });
    if (settings.logoKey)
      await fileStorage.remove(storageKey(settings.logoKey)).catch(() => undefined);
  },
  async read() {
    const settings = await prisma.hospitalSettings.findUnique({ where: { id: 'default' } });
    if (!settings?.logoKey) throw new AppError(404, 'Hospital logo not found.');
    return {
      buffer: await fileStorage.get(storageKey(settings.logoKey)),
      type:
        extname(settings.logoKey) === '.png'
          ? 'image/png'
          : extname(settings.logoKey) === '.webp'
            ? 'image/webp'
            : 'image/jpeg',
    };
  },
};
