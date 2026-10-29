import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-that-is-at-least-32-chars';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
  process.env.FILE_STORAGE_DRIVER = 'local';
});

describe('file storage key safety', () => {
  it.each(['../secret.txt', 'nested/../secret.txt', 'nested//secret.txt', '.'])(
    'rejects unsafe key %s',
    async (key) => {
      const { fileStorage } = await import('../src/services/file-storage.service.js');
      await expect(fileStorage.get(key)).rejects.toThrow('Invalid storage key.');
    },
  );
});
