import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { env } from '../config/env.js';
const root = resolve(env.FILE_UPLOAD_PATH);
const blobPrefix = 'medicare-private';
const blobSdk = () => import('@vercel/blob');
const normalizedKey = (key: string) => {
  const value = key.replaceAll('\\', '/').replace(/^\/+/, '');
  if (
    !value ||
    value.length > 500 ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error('Invalid storage key.');
  }
  return value;
};
const pathFor = (key: string) => {
  const value = resolve(root, normalizedKey(key));
  if (!value.startsWith(root + sep)) throw new Error('Invalid storage key.');
  return value;
};
const blobPathFor = (key: string) => `${blobPrefix}/${normalizedKey(key)}`;
export const fileStorage = {
  async put(key: string, data: Buffer) {
    if (env.STORAGE_DRIVER === 'vercel-blob') {
      const { put } = await blobSdk();
      await put(blobPathFor(key), data, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      return;
    }
    const destination = pathFor(key);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, data, { flag: 'wx' });
  },
  async get(key: string) {
    if (env.STORAGE_DRIVER === 'vercel-blob') {
      const { get } = await blobSdk();
      const result = await get(blobPathFor(key), { access: 'private' });
      if (!result || result.statusCode !== 200 || !result.stream) {
        const error = new Error('Stored object was not found.');
        Object.assign(error, { code: 'ENOENT' });
        throw error;
      }
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    }
    return readFile(pathFor(key));
  },
  async remove(key: string) {
    if (env.STORAGE_DRIVER === 'vercel-blob') {
      const { del } = await blobSdk();
      await del(blobPathFor(key));
      return;
    }
    try {
      await unlink(pathFor(key));
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  },
};
