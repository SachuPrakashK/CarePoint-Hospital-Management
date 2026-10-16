import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { env } from '../config/env.js';
const root = resolve(env.FILE_UPLOAD_PATH);
const pathFor = (key: string) => {
  const value = resolve(root, key);
  if (!value.startsWith(root + sep)) throw new Error('Invalid storage key.');
  return value;
};
export const fileStorage = {
  async put(key: string, data: Buffer) {
    const destination = pathFor(key);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, data, { flag: 'wx' });
  },
  get: (key: string) => readFile(pathFor(key)),
  async remove(key: string) {
    try {
      await unlink(pathFor(key));
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  },
};
