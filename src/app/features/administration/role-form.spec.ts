import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ToastService } from '../../core/services/toast.service';
import {
  AdministrationApiService,
  PermissionRecord,
  RoleRecord,
} from './administration-api.service';
import { RoleForm } from './role-form';

const permissions: PermissionRecord[] = [
  { id: '1', code: 'patients.view', module: 'patients', action: 'view' },
  { id: '2', code: 'patients.edit', module: 'patients', action: 'edit' },
  { id: '3', code: 'patients.delete', module: 'patients', action: 'delete' },
];
const role: RoleRecord = {
  id: 'role-1',
  code: 'CUSTOM',
  name: 'Custom',
  description: 'Existing',
  status: 'ACTIVE',
  isSystem: false,
  createdAt: '2026-01-01T00:00:00Z',
  _count: { users: 0 },
  permissions: [{ permission: permissions[1] }],
};

describe('RoleForm', () => {
  let fixture: ComponentFixture<RoleForm>;
  let api: { createRole: ReturnType<typeof vi.fn>; updateRole: ReturnType<typeof vi.fn> };
  beforeEach(async () => {
    api = {
      createRole: vi.fn(() => of({ data: role })),
      updateRole: vi.fn(() => of({ data: role })),
    };
    await TestBed.configureTestingModule({
      imports: [RoleForm],
      providers: [
        { provide: AdministrationApiService, useValue: api },
        { provide: ToastService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RoleForm);
    fixture.componentRef.setInput('permissions', permissions);
    fixture.detectChanges();
  });

  it('keeps individual permissions independent in both directions', () => {
    const component = fixture.componentInstance;
    component.toggle('patients.edit', true);
    expect(component.checked('patients.edit')).toBe(true);
    expect(component.checked('patients.view')).toBe(false);
    component.toggle('patients.delete', true);
    component.toggle('patients.edit', false);
    expect(component.checked('patients.view')).toBe(false);
    expect(component.checked('patients.edit')).toBe(false);
    expect(component.checked('patients.delete')).toBe(true);
  });
  it('supports select all, clear all, and indeterminate group state', () => {
    const component = fixture.componentInstance;
    component.toggle('patients.edit', true);
    expect(component.groupIndeterminate(permissions)).toBe(true);
    component.toggleGroup(permissions, true);
    expect(component.groupChecked(permissions)).toBe(true);
    component.toggleGroup(permissions, false);
    expect(component.selected().size).toBe(0);
  });
  it('renders a keyboard-scrollable permissions region while the footer remains separate', () => {
    const element: HTMLElement = fixture.nativeElement;
    const permissionsRegion = element.querySelector('.permission-matrix')!;
    expect(permissionsRegion.getAttribute('tabindex')).toBe('0');
    expect(permissionsRegion.parentElement?.classList.contains('role-form-body')).toBe(true);
    expect(element.querySelector('.crud-modal__footer')?.parentElement).toBe(
      element.querySelector('form'),
    );
  });
  it('submits exactly the explicitly selected create permissions and prevents duplicate submission', async () => {
    const component = fixture.componentInstance;
    component.form.setValue({ name: 'Independent Editor', description: 'Test', status: 'ACTIVE' });
    component.toggle('patients.edit', true);
    await Promise.all([component.save(), component.save()]);
    expect(api.createRole).toHaveBeenCalledTimes(1);
    expect(api.createRole.mock.calls[0][0].permissionCodes).toEqual(['patients.edit']);
  });
  it('preselects exactly the persisted edit permissions and sends one replacement request', async () => {
    fixture.componentRef.setInput('role', role);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect([...component.selected()]).toEqual(['patients.edit']);
    component.toggle('patients.edit', false);
    component.toggle('patients.delete', true);
    await component.save();
    expect(api.updateRole).toHaveBeenCalledTimes(1);
    expect(api.updateRole.mock.calls[0]).toEqual([
      'role-1',
      expect.objectContaining({ permissionCodes: ['patients.delete'] }),
    ]);
  });
  it('recovers after an API failure', async () => {
    api.createRole.mockReturnValueOnce(throwError(() => new Error('Network unavailable')));
    const component = fixture.componentInstance;
    component.form.setValue({ name: 'Failure Test', description: '', status: 'ACTIVE' });
    await component.save();
    expect(component.submitting()).toBe(false);
    expect(component.error()).toBe('Network unavailable');
  });
});
