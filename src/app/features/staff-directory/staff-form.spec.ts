import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { StaffDirectoryApiService, StaffOptions, StaffRecord } from './staff-directory-api.service';
import { StaffForm } from './staff-form';

const options: StaffOptions = {
  departments: [{ id: 'dept-1', name: 'Cardiology' }],
  specializations: [],
  roles: [{ id: 'role-1', code: 'NURSE', name: 'Nurse' }],
};

const employee: StaffRecord = {
  id: 'employee-1', employeeCode: 'EMP-0001', firstName: 'Asha', lastName: 'Rao',
  gender: 'FEMALE', dateOfBirth: '1991-04-12T00:00:00.000Z', phone: '+91 98765 43210',
  email: 'asha@example.com', address: 'Bengaluru', status: 'ACTIVE', departmentId: 'dept-1',
  department: options.departments[0], designation: 'Staff Nurse', joiningDate: '2025-06-15T00:00:00.000Z',
  employmentType: 'FULL_TIME', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
  roles: [{ role: { code: 'NURSE', name: 'Nurse' } }],
};

describe('StaffForm employees', () => {
  let fixture: ComponentFixture<StaffForm>;
  let api: { save: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = { save: vi.fn(() => of({ data: employee })) };
    await TestBed.configureTestingModule({
      imports: [StaffForm],
      providers: [{ provide: StaffDirectoryApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(StaffForm);
    fixture.componentRef.setInput('kind', 'employees');
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('record', employee);
    fixture.detectChanges();
  });

  it('patches IDs, date-only values, phone, role, and employment fields', () => {
    expect(fixture.componentInstance.form.getRawValue()).toEqual(expect.objectContaining({
      departmentId: 'dept-1', dateOfBirth: '1991-04-12', phone: '+91 98765 43210',
      designation: 'Staff Nurse', joiningDate: '2025-06-15', employmentType: 'FULL_TIME', roleCode: 'NURSE',
    }));
    expect(fixture.componentInstance.form.pristine).toBe(true);
  });

  it('uses a scrollable shared-modal body with a separate footer', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.staff-form-body')?.getAttribute('tabindex')).toBe('0');
    expect(element.querySelector('.crud-modal__footer')?.parentElement).toBe(element.querySelector('form'));
  });

  it('submits one complete update and preserves unchanged values', async () => {
    await Promise.all([fixture.componentInstance.submit(), fixture.componentInstance.submit()]);
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save).toHaveBeenCalledWith('employees', 'employee-1', expect.objectContaining({
      phone: '+91 98765 43210', departmentId: 'dept-1', joiningDate: '2025-06-15', roleCode: 'NURSE',
    }));
  });

  it('remains usable after an API failure', async () => {
    api.save.mockReturnValueOnce(throwError(() => ({ message: 'Network unavailable' })));
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.submitting()).toBe(false);
    expect(fixture.componentInstance.error()).toBe('Network unavailable');
  });

  it('resets stale edit values when switched to create mode', () => {
    fixture.componentRef.setInput('record', null);
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.phone.value).toBe('');
    expect(fixture.componentInstance.form.controls.departmentId.value).toBe('');
    expect(fixture.componentInstance.form.controls.roleCode.value).toBe('');
  });
});
