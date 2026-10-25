import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { InpatientStore } from '../../../core/services/inpatient.store';
import { ToastService } from '../../../core/services/toast.service';
import { NursingPage } from './nursing-page';

describe('NursingPage', () => {
  let fixture: ComponentFixture<NursingPage>;
  let component: NursingPage;
  let resolveNote: (() => void) | undefined;
  const addNursingNote = vi.fn(() => new Promise<void>((resolve) => (resolveNote = resolve)));
  const store = {
    assignedPatients: signal<any[]>([]),
    activeAdmissions: signal<any[]>([]),
    nursingNotes: signal<any[]>([]),
    medications: signal<any[]>([]),
    handovers: signal<any[]>([]),
    nursingStaff: signal<any[]>([]),
    nursingLoading: signal(false),
    nursingError: signal(''),
    loadNursing: vi.fn(async () => undefined),
    addNursingNote,
    administerMedication: vi.fn(async () => undefined),
    createHandover: vi.fn(async () => undefined),
    acknowledgeHandover: vi.fn(async () => undefined),
  };

  beforeEach(async () => {
    addNursingNote.mockClear();
    await TestBed.configureTestingModule({
      imports: [NursingPage],
      providers: [
        { provide: InpatientStore, useValue: store },
        {
          provide: AuthStore,
          useValue: { has: () => true, user: signal({ roles: [{ code: 'HOSPITAL_ADMIN' }] }) },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: AppDateTimeService, useValue: { formatDateTime: (value: string) => value } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NursingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('enables Record Note only with patient, observation and intervention', () => {
    component.selected.set('admission-id');
    expect(component.noteForm.invalid).toBe(true);
    component.noteForm.patchValue({ observation: 'Stable', intervention: 'Observed' });
    expect(component.noteForm.valid).toBe(true);
  });

  it('prevents duplicate nursing note submission and resets after success', async () => {
    component.selected.set('admission-id');
    component.noteForm.setValue({ observation: 'Stable', intervention: 'Observed', notes: '' });
    const first = component.saveNote();
    const second = component.saveNote();
    expect(addNursingNote).toHaveBeenCalledTimes(1);
    resolveNote?.();
    await Promise.all([first, second]);
    expect(component.savingNote()).toBe(false);
    expect(component.noteForm.controls.observation.value).toBe('');
  });

  it('opens patient-specific MAR and handover forms', () => {
    component.selected.set('admission-id');
    component.openMedication({ id: 'task-id', status: 'Scheduled' });
    expect(component.medicationDialog()?.id).toBe('task-id');
    component.openHandover();
    expect(component.handoverDialog()).toBe(true);
    expect(component.handoverForm.controls.admissionId.value).toBe('admission-id');
  });
});
