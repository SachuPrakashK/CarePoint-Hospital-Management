import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/repositories/auth.repository.js', () => ({
  authRepository: {
    findUserById: vi.fn(),
  },
}));

import { authRepository } from '../src/repositories/auth.repository.js';
import { authService } from '../src/services/auth.service.js';

const roleNames = {
  HOSPITAL_ADMIN: 'Hospital Admin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  PHARMACIST: 'Pharmacist',
} as const;

const databaseUser = (code: keyof typeof roleNames) => ({
  id: 'user-id',
  email: 'user@carepoint.test',
  firstName: 'CarePoint',
  lastName: 'User',
  phone: null,
  status: 'ACTIVE',
  roles: [
    {
      role: {
        id: `${code}-id`,
        code,
        name: roleNames[code],
        permissions: [{ permission: { code: 'dashboard.view' } }],
      },
    },
  ],
});

describe('database-backed authentication roles', () => {
  beforeEach(() => vi.clearAllMocks());

  for (const [code, name] of Object.entries(roleNames)) {
    it(`returns ${code} as ${name}`, async () => {
      vi.mocked(authRepository.findUserById).mockResolvedValue(
        databaseUser(code as keyof typeof roleNames) as never,
      );

      const user = await authService.me('user-id');

      expect(user.role).toEqual({ id: `${code}-id`, code, name });
      expect(user.permissions).toContain('dashboard.view');
    });
  }

  it('rejects an account without a role instead of treating it as a patient', async () => {
    vi.mocked(authRepository.findUserById).mockResolvedValue({
      ...databaseUser('PATIENT'),
      roles: [],
    } as never);

    await expect(authService.me('user-id')).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_ROLE_MISSING',
    });
  });

});
