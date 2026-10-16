import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PatientStore } from '../patient.store';
import { PatientForm } from './patient-form';

describe('PatientForm', () => {
  const store = { create: vi.fn(), update: vi.fn() };
  beforeEach(async () => { store.create.mockReset(); store.update.mockReset(); await TestBed.configureTestingModule({ imports: [PatientForm], providers: [{ provide: PatientStore, useValue: store }] }).compileComponents(); });
  const valid = { firstName: 'Asha', lastName: 'Rao', dob: '1990-01-01', gender: 'Female', phone: '+91 98765 43210', emergencyContact: '9123456789' };
  it('uses POST/store.create in create mode and normalizes phone values', async () => { store.create.mockResolvedValue({}); const fixture = TestBed.createComponent(PatientForm); fixture.componentRef.setInput('mode', 'create'); fixture.componentInstance.form.patchValue(valid); await fixture.componentInstance.save(); expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ phone: '+919876543210', emergencyContact: '9123456789' })); expect(store.update).not.toHaveBeenCalled(); });
  it('uses update in edit mode and populates existing data', async () => { store.update.mockResolvedValue({}); const fixture = TestBed.createComponent(PatientForm); fixture.componentRef.setInput('mode', 'edit'); fixture.componentRef.setInput('patient', { id: 'p1', mrn: 'P1', createdAt: '', status: 'Active', middleName: '', email: '', city: '', allergies: [], bloodGroup: 'O+', ...valid }); fixture.detectChanges(); expect(fixture.componentInstance.form.controls.firstName.value).toBe('Asha'); await fixture.componentInstance.save(); expect(store.update).toHaveBeenCalledWith('p1', expect.any(Object)); expect(store.create).not.toHaveBeenCalled(); });
  it('rejects letters and short emergency phone numbers without calling the API', async () => { const fixture = TestBed.createComponent(PatientForm); fixture.componentRef.setInput('mode', 'create'); fixture.componentInstance.form.patchValue({ ...valid, emergencyContact: 'call mother' }); await fixture.componentInstance.save(); expect(fixture.componentInstance.form.controls.emergencyContact.hasError('phone')).toBe(true); expect(store.create).not.toHaveBeenCalled(); });
});
