import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Phase23Store } from '../../../core/services/phase23.store';
import { PatientStore } from '../../patients/patient.store';
import { BillForm } from './bill-form';

describe('BillForm', () => {
  let fixture: ComponentFixture<BillForm>;
  const billing = { saveInvoice: vi.fn() };
  const patients = {
    patients: signal([{ id: 'patient-1', firstName: 'Asha', lastName: 'Rao', mrn: 'MRN-1' }]),
    loading: signal(false),
    error: signal(''),
    pageSize: signal(20),
    load: vi.fn(),
  };

  beforeEach(async () => {
    billing.saveInvoice.mockReset().mockResolvedValue(undefined);
    patients.load.mockReset();
    await TestBed.configureTestingModule({
      imports: [BillForm],
      providers: [
        { provide: Phase23Store, useValue: billing },
        { provide: PatientStore, useValue: patients },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BillForm);
    fixture.detectChanges();
  });

  it('adds and removes line items while requiring at least one', () => {
    const component = fixture.componentInstance;
    expect(component.items.length).toBe(1);

    component.remove(0);
    expect(component.items.length).toBe(0);
    expect(component.form.invalid).toBe(true);

    component.add();
    expect(component.items.length).toBe(1);
  });

  it('calculates totals from quantity and unit price', () => {
    const component = fixture.componentInstance;
    component.items.at(0).patchValue({ quantity: 2, unitPrice: 125.5 });

    expect(component.lineTotal(0)).toBe(251);
    expect(component.total()).toBe(251);
  });

  it('filters the real patient options without selecting one automatically', () => {
    const component = fixture.componentInstance;
    expect(component.form.controls.patientId.value).toBe('');

    component.patientQuery.set('MRN-1');

    expect(component.filteredPatients().map((patient) => patient.id)).toEqual(['patient-1']);
  });

  it('persists the supported invoice payload only after valid submission', async () => {
    const component = fixture.componentInstance;
    component.form.controls.patientId.setValue('patient-1');
    component.items.at(0).patchValue({ description: 'Consultation', quantity: 1, unitPrice: 650 });

    await component.submit();

    expect(billing.saveInvoice).toHaveBeenCalledOnce();
    expect(billing.saveInvoice.mock.calls[0][0]).toMatchObject({
      patientId: 'patient-1',
      items: [{ description: 'Consultation', source: 'Manual', quantity: 1, unitPrice: 650 }],
    });
  });
});
