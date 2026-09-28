import { computed, Injectable, signal } from '@angular/core';
import {
  Admission,
  AuditEvent,
  Bed,
  DischargeSummary,
  LabOrder,
  LabResult,
  MedicationAdministration,
  NursingNote,
  Procedure,
  RadiologyOrder,
  TimelineEvent,
} from '../../shared/models/inpatient.models';
const now = () => new Date().toISOString();
@Injectable({ providedIn: 'root' })
export class InpatientStore {
  private bedsState = signal<Bed[]>([
    {
      id: 'b1',
      name: 'A-101-1',
      room: '101',
      roomType: 'Private',
      ward: 'Medical Ward',
      floor: '1st Floor',
      status: 'Occupied',
      patientId: 'p1',
      admissionId: 'adm1',
    },
    {
      id: 'b2',
      name: 'A-101-2',
      room: '101',
      roomType: 'Private',
      ward: 'Medical Ward',
      floor: '1st Floor',
      status: 'Available',
    },
    {
      id: 'b3',
      name: 'A-102-1',
      room: '102',
      roomType: 'Semi-private',
      ward: 'Medical Ward',
      floor: '1st Floor',
      status: 'Cleaning',
    },
    {
      id: 'b4',
      name: 'ICU-01',
      room: 'ICU Bay',
      roomType: 'ICU',
      ward: 'Critical Care',
      floor: '2nd Floor',
      status: 'Available',
    },
    {
      id: 'b5',
      name: 'ICU-02',
      room: 'ICU Bay',
      roomType: 'ICU',
      ward: 'Critical Care',
      floor: '2nd Floor',
      status: 'Maintenance',
    },
    {
      id: 'b6',
      name: 'S-201-1',
      room: '201',
      roomType: 'General',
      ward: 'Surgical Ward',
      floor: '2nd Floor',
      status: 'Available',
    },
  ]);
  private admissionsState = signal<Admission[]>([
    {
      id: 'adm1',
      number: 'IPD-260927-041',
      patientId: 'p1',
      patientName: 'Meera Iyer',
      admittedAt: now(),
      type: 'Emergency',
      department: 'Cardiology',
      attendingDoctor: 'Dr. Vikram Rao',
      reason: 'Chest discomfort under observation',
      initialDiagnosis: 'Acute coronary syndrome – evaluation',
      notes: 'Monitor closely',
      status: 'Admitted',
      allocations: [
        {
          id: 'alloc1',
          bedId: 'b1',
          ward: 'Medical Ward',
          room: '101',
          startedAt: now(),
          reason: 'Admission',
        },
      ],
    },
  ]);
  private labState = signal<LabOrder[]>([
    {
      id: 'lab1',
      number: 'LAB-260927-118',
      patientId: 'p1',
      patientName: 'Meera Iyer',
      doctor: 'Dr. Vikram Rao',
      tests: ['Complete Blood Count', 'Troponin I'],
      priority: 'STAT',
      clinicalNotes: 'Chest discomfort',
      sampleType: 'Blood',
      collectedAt: now(),
      collectedBy: 'Riya Patel',
      results: [],
      status: 'Processing',
      version: 1,
    },
    {
      id: 'lab2',
      number: 'LAB-260927-119',
      patientId: 'p2',
      patientName: 'Rohan Kapoor',
      doctor: 'Dr. Ananya Sen',
      tests: ['HbA1c'],
      priority: 'Routine',
      clinicalNotes: 'Diabetes review',
      sampleType: 'Blood',
      results: [],
      status: 'Ordered',
      version: 1,
    },
  ]);
  private radiologyState = signal<RadiologyOrder[]>([
    {
      id: 'rad1',
      number: 'RAD-260927-031',
      patientId: 'p1',
      patientName: 'Meera Iyer',
      investigation: 'Chest X-Ray',
      doctor: 'Dr. Vikram Rao',
      scheduledAt: now(),
      status: 'Scheduled',
    },
  ]);
  private notesState = signal<NursingNote[]>([]);
  private medicationsState = signal<MedicationAdministration[]>([
    {
      id: 'mar1',
      admissionId: 'adm1',
      patientId: 'p1',
      medication: 'Aspirin',
      scheduledAt: now(),
      dose: '75 mg',
      route: 'Oral',
      status: 'Scheduled',
      notes: '',
    },
  ]);
  private proceduresState = signal<Procedure[]>([
    {
      id: 'proc1',
      patientId: 'p1',
      patientName: 'Meera Iyer',
      admissionId: 'adm1',
      name: 'Coronary angiography',
      doctor: 'Dr. Vikram Rao',
      team: ['Dr. Vikram Rao'],
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      location: 'OT 1',
      theatre: 'OT 1',
      durationMinutes: 60,
      indication: 'Suspected coronary obstruction',
      notes: '',
      status: 'Scheduled',
    },
  ]);
  private dischargesState = signal<DischargeSummary[]>([]);
  private timelineState = signal<TimelineEvent[]>([
    {
      id: 'tl1',
      patientId: 'p1',
      occurredAt: now(),
      type: 'Admission',
      title: 'Admitted to Cardiology',
      description: 'Emergency admission to Medical Ward, room 101.',
      referenceId: 'adm1',
      actor: 'Aarav Sharma',
    },
  ]);
  private auditState = signal<AuditEvent[]>([]);
  readonly beds = this.bedsState.asReadonly();
  readonly admissions = this.admissionsState.asReadonly();
  readonly labOrders = this.labState.asReadonly();
  readonly radiologyOrders = this.radiologyState.asReadonly();
  readonly nursingNotes = this.notesState.asReadonly();
  readonly medications = this.medicationsState.asReadonly();
  readonly procedures = this.proceduresState.asReadonly();
  readonly discharges = this.dischargesState.asReadonly();
  readonly audit = this.auditState.asReadonly();
  readonly activeAdmissions = computed(() =>
    this.admissionsState().filter((a) => !['Discharged', 'Cancelled'].includes(a.status)),
  );
  readonly availableBeds = computed(() => this.bedsState().filter((b) => b.status === 'Available'));
  readonly occupiedBeds = computed(() => this.bedsState().filter((b) => b.status === 'Occupied'));
  readonly pendingLabs = computed(() =>
    this.labState().filter((o) => !['Completed', 'Cancelled'].includes(o.status)),
  );
  timeline(patientId: string) {
    return computed(() =>
      this.timelineState()
        .filter((e) => e.patientId === patientId)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    );
  }
  admit(input: Omit<Admission, 'id' | 'number' | 'status' | 'allocations'>, bedId: string) {
    if (this.activeAdmissions().some((a) => a.patientId === input.patientId))
      throw new Error('Patient already has an active admission.');
    this.assertAvailable(bedId);
    const id = crypto.randomUUID(),
      bed = this.bedsState().find((b) => b.id === bedId)!;
    const admission: Admission = {
      ...input,
      id,
      number: `IPD-${Date.now().toString().slice(-8)}`,
      status: 'Admitted',
      allocations: [
        {
          id: crypto.randomUUID(),
          bedId,
          ward: bed.ward,
          room: bed.room,
          startedAt: now(),
          reason: 'Admission',
        },
      ],
    };
    this.admissionsState.update((v) => [admission, ...v]);
    this.occupy(bedId, input.patientId, id);
    this.record(
      input.patientId,
      'Admission',
      'Patient admitted',
      `${bed.ward}, room ${bed.room}`,
      id,
    );
    this.auditAction('ADMIT', 'Admission', id, input.reason);
    return admission;
  }
  transfer(admissionId: string, toBedId: string) {
    const admission = this.requireActive(admissionId);
    this.assertAvailable(toBedId);
    const current = admission.allocations.find((a) => !a.endedAt);
    if (!current) throw new Error('Admission has no active bed allocation.');
    const target = this.bedsState().find((b) => b.id === toBedId)!;
    this.bedsState.update((v) =>
      v.map((b) =>
        b.id === current.bedId
          ? { ...b, status: 'Cleaning', patientId: undefined, admissionId: undefined }
          : b.id === toBedId
            ? { ...b, status: 'Occupied', patientId: admission.patientId, admissionId }
            : b,
      ),
    );
    this.admissionsState.update((v) =>
      v.map((a) =>
        a.id === admissionId
          ? {
              ...a,
              status: 'Transferred',
              allocations: [
                ...a.allocations.map((x) => (x.id === current.id ? { ...x, endedAt: now() } : x)),
                {
                  id: crypto.randomUUID(),
                  bedId: toBedId,
                  ward: target.ward,
                  room: target.room,
                  startedAt: now(),
                  reason: 'Transfer',
                },
              ],
            }
          : a,
      ),
    );
    this.record(
      admission.patientId,
      'Bed Transfer',
      'Bed transferred',
      `${current.ward}/${current.room} → ${target.ward}/${target.room}`,
      admissionId,
    );
    this.auditAction('TRANSFER', 'Admission', admissionId, toBedId);
  }
  addLabOrder(order: Omit<LabOrder, 'id' | 'number' | 'status' | 'results' | 'version'>) {
    const item: LabOrder = {
      ...order,
      id: crypto.randomUUID(),
      number: `LAB-${Date.now().toString().slice(-8)}`,
      status: 'Ordered',
      results: [],
      version: 1,
    };
    this.labState.update((v) => [item, ...v]);
    this.record(
      order.patientId,
      'Lab Order',
      'Laboratory order created',
      order.tests.join(', '),
      item.id,
    );
    return item;
  }
  collectSample(id: string, actor: string) {
    this.labState.update((v) =>
      v.map((o) =>
        o.id === id && o.status === 'Ordered'
          ? { ...o, status: 'Sample Collected', collectedAt: now(), collectedBy: actor }
          : o,
      ),
    );
    this.auditAction('COLLECT_SAMPLE', 'LabOrder', id, actor);
  }
  enterLabResults(id: string, results: LabResult[]) {
    const order = this.labState().find((o) => o.id === id);
    if (!order || ['Verified', 'Completed', 'Cancelled'].includes(order.status))
      throw new Error('Verified or completed results cannot be modified.');
    this.labState.update((v) =>
      v.map((o) =>
        o.id === id ? { ...o, results, status: 'Result Entered', version: o.version + 1 } : o,
      ),
    );
    this.auditAction('ENTER_RESULT', 'LabOrder', id, `${results.length} results`);
  }
  verifyLab(id: string, actor: string) {
    const order = this.labState().find((o) => o.id === id);
    if (!order || order.status !== 'Result Entered')
      throw new Error('Results must be entered before verification.');
    const at = now();
    this.labState.update((v) =>
      v.map((o) =>
        o.id === id
          ? {
              ...o,
              status: 'Verified',
              results: o.results.map((r) => ({ ...r, verifiedBy: actor, verifiedAt: at })),
            }
          : o,
      ),
    );
    this.record(
      order.patientId,
      'Lab Result',
      'Laboratory results verified',
      order.tests.join(', '),
      id,
    );
    this.auditAction('VERIFY_RESULT', 'LabOrder', id, actor);
  }
  addNursingNote(note: Omit<NursingNote, 'id' | 'recordedAt'>) {
    this.requireActive(note.admissionId);
    const item = { ...note, id: crypto.randomUUID(), recordedAt: now() };
    this.notesState.update((v) => [item, ...v]);
    this.auditAction('NURSING_NOTE', 'Admission', note.admissionId, note.observation);
  }
  administerMedication(
    id: string,
    status: MedicationAdministration['status'],
    actor: string,
    notes = '',
  ) {
    if (status === 'Scheduled') throw new Error('Administration must record an outcome.');
    const item = this.medicationsState().find((m) => m.id === id);
    if (!item || item.status !== 'Scheduled')
      throw new Error('This medication task has already been recorded.');
    this.medicationsState.update((v) =>
      v.map((m) =>
        m.id === id ? { ...m, status, administeredAt: now(), administeredBy: actor, notes } : m,
      ),
    );
    this.record(
      item.patientId,
      'Medication',
      `${item.medication}: ${status}`,
      `${item.dose} ${item.route}`,
      id,
    );
    this.auditAction('MEDICATION_ADMINISTRATION', 'MedicationAdministration', id, status);
  }
  scheduleProcedure(input: Omit<Procedure, 'id'>) {
    if (
      input.theatre &&
      this.proceduresState().some(
        (p) =>
          p.theatre === input.theatre &&
          p.status !== 'Cancelled' &&
          Math.abs(new Date(p.scheduledAt).getTime() - new Date(input.scheduledAt).getTime()) <
            Math.max(p.durationMinutes ?? 0, input.durationMinutes ?? 0) * 60000,
      )
    )
      throw new Error('Theatre schedule conflicts with an existing procedure.');
    const item = { ...input, id: crypto.randomUUID() };
    this.proceduresState.update((v) => [item, ...v]);
    this.record(
      input.patientId,
      'Procedure',
      'Procedure scheduled',
      `${input.name} · ${input.location}`,
      item.id,
    );
    return item;
  }
  discharge(
    admissionId: string,
    summary: Omit<DischargeSummary, 'id' | 'admissionId' | 'patientId' | 'dischargedAt'>,
  ) {
    const admission = this.requireActive(admissionId),
      allocation = admission.allocations.find((a) => !a.endedAt);
    if (!allocation) throw new Error('Cannot discharge without an active bed allocation.');
    const item: DischargeSummary = {
      ...summary,
      id: crypto.randomUUID(),
      admissionId,
      patientId: admission.patientId,
      dischargedAt: now(),
    };
    this.dischargesState.update((v) => [item, ...v]);
    this.admissionsState.update((v) =>
      v.map((a) =>
        a.id === admissionId
          ? {
              ...a,
              status: 'Discharged',
              dischargedAt: item.dischargedAt,
              dischargeSummaryId: item.id,
              allocations: a.allocations.map((x) =>
                x.id === allocation.id
                  ? { ...x, endedAt: item.dischargedAt, reason: 'Release' }
                  : x,
              ),
            }
          : a,
      ),
    );
    this.bedsState.update((v) =>
      v.map((b) =>
        b.id === allocation.bedId
          ? { ...b, status: 'Cleaning', patientId: undefined, admissionId: undefined }
          : b,
      ),
    );
    this.record(
      admission.patientId,
      'Discharge',
      'Patient discharged',
      summary.finalDiagnosis,
      item.id,
    );
    this.auditAction('DISCHARGE', 'Admission', admissionId, summary.conditionAtDischarge);
    return item;
  }
  private assertAvailable(id: string) {
    if (this.bedsState().find((b) => b.id === id)?.status !== 'Available')
      throw new Error('The selected bed is not available.');
  }
  private requireActive(id: string) {
    const a = this.admissionsState().find(
      (x) => x.id === id && !['Discharged', 'Cancelled'].includes(x.status),
    );
    if (!a) throw new Error('No active admission was found.');
    return a;
  }
  private occupy(bedId: string, patientId: string, admissionId: string) {
    this.bedsState.update((v) =>
      v.map((b) => (b.id === bedId ? { ...b, status: 'Occupied', patientId, admissionId } : b)),
    );
  }
  private record(
    patientId: string,
    type: TimelineEvent['type'],
    title: string,
    description: string,
    referenceId: string,
  ) {
    this.timelineState.update((v) => [
      {
        id: crypto.randomUUID(),
        patientId,
        occurredAt: now(),
        type,
        title,
        description,
        referenceId,
        actor: 'Current user',
      },
      ...v,
    ]);
  }
  private auditAction(action: string, entity: string, entityId: string, detail: string) {
    this.auditState.update((v) => [
      {
        id: crypto.randomUUID(),
        occurredAt: now(),
        actor: 'Current user',
        action,
        entity,
        entityId,
        detail,
      },
      ...v,
    ]);
  }
}
