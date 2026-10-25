import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdmissionQuery, InpatientApiService } from './inpatient-api.service';
import { Phase23Store } from './phase23.store';
import { DashboardInvalidationService } from './dashboard-invalidation.service';
import {
  Admission,
  Bed,
  DischargeSummary,
  MedicationAdministration,
  NursingNote,
  Procedure,
  TimelineEvent,
} from '../../shared/models/inpatient.models';
const title = (v: string) =>
  v.toLowerCase().replace(/(^|_)(\w)/g, (_, s, c) => `${s ? ' ' : ''}${c.toUpperCase()}`);
@Injectable({ providedIn: 'root' })
export class InpatientStore {
  private api = inject(InpatientApiService);
  private phase23 = inject(Phase23Store);
  private dashboard = inject(DashboardInvalidationService);
  private bedsState = signal<Bed[]>([]);
  private admissionsState = signal<Admission[]>([]);
  private wardsState = signal<any[]>([]);
  private notesState = signal<NursingNote[]>([]);
  private medicationsState = signal<MedicationAdministration[]>([]);
  private assignedPatientsState = signal<any[]>([]);
  private handoversState = signal<any[]>([]);
  private nursingStaffState = signal<any[]>([]);
  private proceduresState = signal<Procedure[]>([]);
  private dischargesState = signal<DischargeSummary[]>([]);
  readonly lookups = signal<any>({ departments: [], doctors: [] });
  private timelineState = signal<Record<string, TimelineEvent[]>>({});
  private timelineLoading = new Set<string>();
  private admissionRequest = 0;
  private nursingAllLoaded = false;
  private nursingFlight?: Promise<void>;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly beds = this.bedsState.asReadonly();
  readonly admissions = this.admissionsState.asReadonly();
  readonly wards = this.wardsState.asReadonly();
  readonly admissionsTotal = signal(0);
  readonly admissionsTotalPages = signal(0);
  readonly nursingNotes = this.notesState.asReadonly();
  readonly medications = this.medicationsState.asReadonly();
  readonly assignedPatients = this.assignedPatientsState.asReadonly();
  readonly handovers = this.handoversState.asReadonly();
  readonly nursingStaff = this.nursingStaffState.asReadonly();
  readonly nursingLoading = signal(false);
  readonly nursingError = signal('');
  readonly procedures = this.proceduresState.asReadonly();
  readonly discharges = this.dischargesState.asReadonly();
  readonly labOrders = this.phase23.labOrders;
  readonly radiologyOrders = this.phase23.radiologyOrders;
  readonly audit = signal<any[]>([]).asReadonly();
  readonly activeAdmissions = computed(() =>
    this.admissions().filter((a) => !['Discharged', 'Cancelled'].includes(a.status)),
  );
  readonly availableBeds = computed(() => this.beds().filter((b) => b.status === 'Available'));
  readonly occupiedBeds = computed(() => this.beds().filter((b) => b.status === 'Occupied'));
  readonly pendingLabs = computed(() =>
    this.labOrders().filter((x: any) => !['Completed', 'Cancelled'].includes(x.status)),
  );
  constructor() {
    void this.load();
  }
  async load() {
    await Promise.all([
      this.loadAdmissions({ page: 1, pageSize: 10 }),
      this.loadSupportingData(),
      this.loadNursing(),
    ]);
  }
  private async loadSupportingData() {
    const [beds, lookups, wards, procedures] = await Promise.allSettled([
      firstValueFrom(this.api.beds()),
      firstValueFrom(this.api.lookups()),
      firstValueFrom(this.api.wards()),
      firstValueFrom(this.api.procedures()),
    ]);
    if (beds.status === 'fulfilled') this.bedsState.set(beds.value.data.map(this.mapBed));
    if (lookups.status === 'fulfilled') this.lookups.set(lookups.value.data);
    if (wards.status === 'fulfilled') this.wardsState.set(wards.value.data);
    if (procedures.status === 'fulfilled')
      this.proceduresState.set(
        procedures.value.data.map((item: any) => ({
          ...item,
          patientName: `${item.patient?.firstName ?? ''} ${item.patient?.lastName ?? ''}`.trim(),
          doctor: `${item.doctor?.firstName ?? ''} ${item.doctor?.lastName ?? ''}`.trim(),
          location: item.theatre?.name ?? '',
          theatre: item.theatre?.name,
        })),
      );
  }
  async loadNursing(admissionId?: string) {
    if (!admissionId && this.nursingAllLoaded) return;
    if (!admissionId && this.nursingFlight) return this.nursingFlight;
    const load = async () => {
      this.nursingLoading.set(true);
      this.nursingError.set('');
      const [assignments, notes, medications, handovers, staff] = await Promise.allSettled([
        firstValueFrom(this.api.assignedPatients()),
        firstValueFrom(this.api.notes(admissionId)),
        firstValueFrom(this.api.medications(admissionId)),
        firstValueFrom(this.api.handovers(admissionId)),
        firstValueFrom(this.api.nursingStaff()),
      ]);
      if (assignments.status === 'fulfilled')
        this.assignedPatientsState.set(assignments.value.data.map(this.mapAssignment));
      if (notes.status === 'fulfilled')
        this.notesState.set(notes.value.data.map(this.mapNursingNote));
      if (medications.status === 'fulfilled')
        this.medicationsState.set(medications.value.data.map(this.mapMedication));
      if (handovers.status === 'fulfilled') this.handoversState.set(handovers.value.data);
      if (staff.status === 'fulfilled') this.nursingStaffState.set(staff.value.data);
      if (
        [assignments, notes, medications, handovers, staff].some(
          (result) => result.status === 'rejected',
        )
      )
        this.nursingError.set('Some nursing information could not be loaded.');
      if (!admissionId) this.nursingAllLoaded = true;
      this.nursingLoading.set(false);
    };
    if (admissionId) return load();
    this.nursingFlight = load().finally(() => (this.nursingFlight = undefined));
    return this.nursingFlight;
  }
  private mapAssignment = (item: any) => {
    const admission = this.mapAdmission(item.admission);
    return {
      ...item,
      admission,
      patientName: admission.patientName,
      mrn: item.admission?.patient?.mrn ?? '',
      nurseName: `${item.nurse?.firstName ?? ''} ${item.nurse?.lastName ?? ''}`.trim(),
    };
  };
  private mapNursingNote = (item: any): NursingNote => ({
    ...item,
    patientId: item.admission?.patientId,
    nurse: `${item.nurse?.firstName ?? ''} ${item.nurse?.lastName ?? ''}`.trim() || item.nurseId,
  });
  private mapMedication = (item: any): MedicationAdministration => ({
    ...item,
    patientId: item.admission?.patientId,
    administeredBy:
      `${item.administeredBy?.firstName ?? ''} ${item.administeredBy?.lastName ?? ''}`.trim() ||
      undefined,
    frequency: item.prescriptionItem?.frequency,
    orderedBy: item.prescriptionItem?.prescription?.doctor
      ? `${item.prescriptionItem.prescription.doctor.firstName} ${item.prescriptionItem.prescription.doctor.lastName}`
      : undefined,
  });
  async loadAdmissions(query: AdmissionQuery) {
    const request = ++this.admissionRequest;
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.api.admissions(query));
      if (request !== this.admissionRequest) return;
      this.admissionsState.set(response.data.map(this.mapAdmission));
      const pagination = response.pagination;
      this.admissionsTotal.set(pagination?.total ?? response.data.length);
      this.admissionsTotalPages.set(pagination?.total_pages ?? (response.data.length ? 1 : 0));
      this.dischargesState.set(
        response.data
          .filter((item: any) => item.discharge)
          .map((item: any) => ({ ...item.discharge, patientId: item.patientId })),
      );
    } catch {
      if (request === this.admissionRequest) this.error.set('Admissions could not be loaded.');
    } finally {
      if (request === this.admissionRequest) this.loading.set(false);
    }
  }
  async loadAdmission(id: string) {
    const response = await firstValueFrom(this.api.admission(id));
    return this.mapAdmission(response.data);
  }
  async createWard(value: { code: string; name: string; floor: string; status: string }) {
    const response = await firstValueFrom(this.api.createWard(value));
    const wards = await firstValueFrom(this.api.wards());
    this.wardsState.set(wards.data);
    this.dashboard.invalidate('inpatient');
    return response.data;
  }
  private mapBed = (x: any): Bed => {
    const active = x.allocations?.[0];
    return {
      id: x.id,
      name: x.name,
      room: x.room?.name ?? '',
      roomType: x.room?.name ?? '',
      ward: x.room?.wardModel?.name ?? x.room?.ward ?? '',
      floor: x.room?.wardModel?.floor ?? '',
      status: title(x.status) as Bed['status'],
      patientId: active?.admission?.patientId,
      admissionId: active?.admissionId,
    };
  };
  private mapAdmission = (x: any): Admission => ({
    id: x.id,
    number: x.number,
    patientId: x.patientId,
    patientName: `${x.patient?.firstName ?? ''} ${x.patient?.lastName ?? ''}`.trim(),
    admittedAt: x.admittedAt,
    type: x.type,
    department: x.department?.name ?? '',
    attendingDoctor:
      `${x.attendingDoctor?.firstName ?? ''} ${x.attendingDoctor?.lastName ?? ''}`.trim(),
    reason: x.reason,
    initialDiagnosis: x.initialDiagnosis,
    notes: '',
    status: title(x.status) as Admission['status'],
    allocations: (x.allocations ?? []).map((v: any) => ({
      id: v.id,
      bedId: v.bedId,
      bedName: v.bed?.name ?? '',
      ward: v.bed?.room?.wardModel?.name ?? v.bed?.room?.ward ?? '',
      room: v.bed?.room?.name ?? '',
      startedAt: v.startedAt,
      endedAt: v.endedAt,
      reason: v.reason,
    })),
    dischargedAt: x.dischargedAt,
    dischargeSummaryId: x.discharge?.id,
  });
  timeline(patientId: string) {
    void this.loadTimeline(patientId);
    return computed<TimelineEvent[]>(() => this.timelineState()[patientId] ?? []);
  }
  private async loadTimeline(patientId: string) {
    if (!patientId || this.timelineLoading.has(patientId) || this.timelineState()[patientId])
      return;
    this.timelineLoading.add(patientId);
    try {
      const r = await firstValueFrom(this.api.timeline(patientId));
      this.timelineState.update((v) => ({
        ...v,
        [patientId]: r.data.map((x: any) => ({ ...x, patientId, actor: 'System' })),
      }));
    } finally {
      this.timelineLoading.delete(patientId);
    }
  }
  async admit(input: any, bedId: string) {
    const r = await firstValueFrom(
      this.api.admit({
        patientId: input.patientId,
        departmentId: input.departmentId,
        attendingDoctorId: input.attendingDoctorId,
        bedId,
        admittedAt: input.admittedAt,
        type: input.type,
        reason: input.reason,
        initialDiagnosis: input.initialDiagnosis,
      }),
    );
    await this.load();
    this.dashboard.invalidate('inpatient');
    return r.data;
  }
  async transfer(id: string, toBedId: string) {
    await firstValueFrom(this.api.transfer(id, toBedId));
    await this.load();
    this.dashboard.invalidate('inpatient');
  }
  async discharge(id: string, value: any) {
    const r = await firstValueFrom(this.api.discharge(id, value));
    await this.load();
    this.dashboard.invalidate('inpatient');
    return r.data;
  }
  async addNursingNote(value: any) {
    await firstValueFrom(
      this.api.addNote({
        admissionId: value.admissionId,
        observation: value.observation,
        intervention: value.intervention,
        notes: value.notes ?? '',
      }),
    );
    const notes = await firstValueFrom(this.api.notes(value.admissionId));
    this.notesState.set(notes.data.map(this.mapNursingNote));
  }
  async administerMedication(id: string, status: any, notes = '') {
    await firstValueFrom(this.api.administer(id, { status, notes }));
    const admissionId = this.medicationsState().find((item) => item.id === id)?.admissionId;
    const medications = await firstValueFrom(this.api.medications(admissionId));
    this.medicationsState.set(medications.data.map(this.mapMedication));
  }
  async createHandover(value: any) {
    const response = await firstValueFrom(this.api.createHandover(value));
    const handovers = await firstValueFrom(this.api.handovers());
    this.handoversState.set(handovers.data);
    return response.data;
  }
  async acknowledgeHandover(id: string) {
    await firstValueFrom(this.api.acknowledgeHandover(id));
    const handovers = await firstValueFrom(this.api.handovers());
    this.handoversState.set(handovers.data);
  }
  async scheduleProcedure(value: any) {
    const doc =
      this.lookups().doctors.find(
        (x: any) =>
          `${x.firstName} ${x.lastName}` === value.doctor ||
          `Dr. ${x.firstName} ${x.lastName}` === value.doctor,
      ) ?? this.lookups().doctors[0];
    if (!doc) throw new Error('A valid doctor is required.');
    const r = await firstValueFrom(
      this.api.createProcedure({
        patientId: value.patientId,
        admissionId: value.admissionId || null,
        doctorId: doc.id,
        theatreId: null,
        name: value.name,
        team: value.team,
        scheduledAt: value.scheduledAt,
        durationMinutes: value.durationMinutes ?? 60,
        indication: value.indication,
        notes: value.notes,
        status: value.status,
        preOpChecklist: value.preOpChecklist ?? [],
      }),
    );
    await this.load();
    this.dashboard.invalidate('operations');
    return r.data;
  }
  collectSample(id: string, actor: string) {
    return this.phase23.collectSample(id, actor);
  }
  enterLabResults(id: string, results: any[]) {
    return this.phase23.enterLabResults(id, results);
  }
  verifyLab(id: string, actor: string) {
    return this.phase23.verifyLab(id, actor);
  }
}
