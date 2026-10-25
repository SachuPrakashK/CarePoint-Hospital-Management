import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { ClinicalStore } from '../../../core/services/clinical.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProcedureStore } from '../procedure.store';
import { ProcedurePage } from './procedure-page';

describe('ProcedurePage', () => {
  let fixture: ComponentFixture<ProcedurePage>;
  let component: ProcedurePage;
  const store = {
    records: signal<any[]>([]),
    total: signal(0),
    totalPages: signal(0),
    loading: signal(false),
    error: signal(''),
    stats: signal({
      total: 0,
      scheduled: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      availableTheatres: 0,
    }),
    lookups: signal({
      theatres: [{ id: 't1', name: 'Main OT' }],
      doctors: [{ id: 'd1', firstName: 'A', lastName: 'Doctor' }],
      admissions: [{ id: 'a1', number: 'ADM-001', patientId: 'inpatient-1' }],
      statuses: ['Planned', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'],
    }),
    initialize: vi.fn(async () => undefined),
    load: vi.fn(async () => undefined),
    save: vi.fn(async () => ({})),
    transition: vi.fn(async () => ({})),
  };
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcedurePage],
      providers: [
        { provide: ProcedureStore, useValue: store },
        {
          provide: ClinicalStore,
          useValue: { patients: signal<any[]>([]), load: vi.fn(async () => undefined) },
        },
        { provide: AuthStore, useValue: { has: () => true } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: AppDateTimeService,
          useValue: {
            formatDateTime: (v: string) => v,
            formDateTime: () => '2026-10-04T10:00',
            formDateTimeToApi: (v: string) => `${v}:00.000Z`,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProcedurePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('renders shared search and the initial empty state', () => {
    expect(
      fixture.nativeElement.querySelector('input[placeholder="Search procedures..."]'),
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('No procedures found');
  });
  it('resets page and reloads for search and combined filters', () => {
    component.page.set(3);
    component.onSearch('Rahul');
    expect(component.page()).toBe(1);
    expect(store.load).toHaveBeenCalled();
    component.draftFromDate.set('2026-10-01');
    component.draftToDate.set('2026-10-03');
    component.draftTheatreId.set('t1');
    component.draftStatus.set('Scheduled');
    component.applyFilters();
    expect(component.activeFilterCount()).toBe(4);
  });
  it('uses one validated create/edit form with meaningful placeholders', () => {
    component.openCreate();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Schedule procedure');
    expect(
      fixture.nativeElement.querySelector('input[placeholder="Enter procedure name"]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('textarea[placeholder="Enter clinical indication"]'),
    ).toBeTruthy();
    expect(component.form.invalid).toBe(true);
  });
  it('only shows admission for a patient with an active inpatient admission', () => {
    component.openCreate();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('select[formControlName="admissionId"]'),
    ).toBeFalsy();
    component.form.controls.patientId.setValue('inpatient-1');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('select[formControlName="admissionId"]'),
    ).toBeTruthy();
  });
  it('clears a selected admission when the patient changes', () => {
    component.form.patchValue({ patientId: 'inpatient-1', admissionId: 'a1' });
    component.onPatientChange();
    expect(component.form.controls.admissionId.value).toBe('');
  });
  it('maps legitimate workflow transitions', () => {
    expect(component.nextStatus({ status: 'Scheduled' })).toBe('In Progress');
    expect(component.nextStatus({ status: 'In Progress' })).toBe('Completed');
    expect(component.nextStatus({ status: 'Completed' })).toBe('');
  });
});
