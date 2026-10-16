import { describe, expect, it } from 'vitest';
import { formatPermissionLabel } from './permission-label';

describe('formatPermissionLabel', () => {
  it.each([
    ['view patients', 'View Patients'],
    ['create_role', 'Create Role'],
    ['edit.permissions', 'Edit Permissions'],
    ['admission_beds', 'Admission Beds'],
    ['audit-logs', 'Audit Logs'],
    ['clinical_emr.view', 'Clinical EMR View'],
  ])('formats %s without changing the underlying value', (code, expected) => {
    expect(formatPermissionLabel(code)).toBe(expected);
    expect(code).not.toBe(expected);
  });
});
