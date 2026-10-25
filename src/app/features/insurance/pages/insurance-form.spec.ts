import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { Phase23Store } from '../../../core/services/phase23.store';
import { PatientStore } from '../../patients/patient.store';
import { InsuranceForm, InsuranceFormKind } from './insurance-form';

describe('InsuranceForm select placeholders', () => {
  const patients = {
    patients: signal([{ id: 'patient-1', firstName: 'Asha', lastName: 'Rao', mrn: 'MRN-1' }]),
    load: vi.fn().mockResolvedValue(undefined),
  };
  const store = {
    providers: signal([{ id: 'provider-1', name: 'Health Cover' }]),
    policies: signal([]),
    invoices: signal([]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsuranceForm],
      providers: [
        { provide: PatientStore, useValue: patients },
        { provide: Phase23Store, useValue: store },
        { provide: AppDateTimeService, useValue: { formValueToApi: vi.fn() } },
      ],
    }).compileComponents();
  });

  function render(kind: InsuranceFormKind, entity: any = null) {
    const fixture = TestBed.createComponent(InsuranceForm);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('entity', entity);
    fixture.detectChanges();
    return fixture;
  }

  it.each([
    ['provider', ['Select status']],
    ['policy', ['Select patient', 'Select insurance provider', 'Select priority', 'Select status']],
    ['claim', ['Select patient', 'Select policy', 'Select patient invoice']],
  ] as [InsuranceFormKind, string[]][])('shows every %s placeholder initially', (kind, labels) => {
    const fixture = render(kind);
    const selected = Array.from(
      fixture.nativeElement.querySelectorAll('select') as NodeListOf<HTMLSelectElement>,
      (select) => select.selectedOptions[0]?.textContent?.trim(),
    );

    expect(selected).toEqual(labels);
  });

  it('preserves persisted select values while editing a policy', () => {
    const fixture = render('policy', {
      patientId: 'patient-1',
      providerId: 'provider-1',
      priority: 'Secondary',
      isActive: false,
    });
    const selected = Array.from(
      fixture.nativeElement.querySelectorAll('select') as NodeListOf<HTMLSelectElement>,
      (select) => select.selectedOptions[0]?.textContent?.trim(),
    );

    expect(selected).toEqual(['Asha Rao · MRN-1', 'Health Cover', 'Secondary', 'Inactive']);
  });
});
