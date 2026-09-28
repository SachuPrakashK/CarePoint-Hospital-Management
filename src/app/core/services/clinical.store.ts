import { computed, Injectable, signal } from '@angular/core';
import {
  Appointment,
  AppointmentStatus,
  Consultation,
  Patient,
} from '../../shared/models/clinical.models';
const today = new Date().toISOString().slice(0, 10);
@Injectable({ providedIn: 'root' })
export class ClinicalStore {
  private readonly patientsState = signal<Patient[]>([
    {
      id: 'p1',
      mrn: 'CP-2026-00128',
      firstName: 'Meera',
      lastName: 'Iyer',
      dob: '1989-04-18',
      gender: 'Female',
      bloodGroup: 'B+',
      phone: '+91 98765 10234',
      email: 'meera@example.com',
      city: 'Bengaluru',
      emergencyContact: 'Arun Iyer',
      allergies: ['Penicillin'],
      status: 'Active',
      createdAt: '2026-09-24',
    },
    {
      id: 'p2',
      mrn: 'CP-2026-00127',
      firstName: 'Rohan',
      lastName: 'Kapoor',
      dob: '1974-11-02',
      gender: 'Male',
      bloodGroup: 'O+',
      phone: '+91 98204 73561',
      city: 'Mumbai',
      allergies: [],
      status: 'Active',
      createdAt: '2026-09-23',
    },
    {
      id: 'p3',
      mrn: 'CP-2026-00126',
      firstName: 'Fatima',
      lastName: 'Khan',
      dob: '2001-01-12',
      gender: 'Female',
      bloodGroup: 'A-',
      phone: '+91 99588 42110',
      city: 'Delhi',
      allergies: ['Latex'],
      status: 'Active',
      createdAt: '2026-09-22',
    },
  ]);
  private readonly appointmentsState = signal<Appointment[]>([
    {
      id: 'a1',
      number: 'APT-260927-018',
      patientId: 'p1',
      patientName: 'Meera Iyer',
      department: 'Cardiology',
      doctor: 'Dr. Vikram Rao',
      date: today,
      time: '09:30',
      type: 'Consultation',
      consultationType: 'In person',
      reason: 'Chest discomfort',
      fee: 900,
      status: 'Waiting',
      token: 12,
    },
    {
      id: 'a2',
      number: 'APT-260927-019',
      patientId: 'p2',
      patientName: 'Rohan Kapoor',
      department: 'General Medicine',
      doctor: 'Dr. Ananya Sen',
      date: today,
      time: '10:00',
      type: 'Follow-up',
      consultationType: 'In person',
      reason: 'Diabetes review',
      fee: 650,
      status: 'Confirmed',
    },
    {
      id: 'a3',
      number: 'APT-260927-020',
      patientId: 'p3',
      patientName: 'Fatima Khan',
      department: 'Dermatology',
      doctor: 'Dr. Nisha Das',
      date: today,
      time: '10:15',
      type: 'Consultation',
      consultationType: 'In person',
      reason: 'Skin rash',
      fee: 700,
      status: 'Checked In',
      token: 13,
    },
  ]);
  private readonly consultationsState = signal<Consultation[]>([]);
  readonly patients = this.patientsState.asReadonly();
  readonly appointments = this.appointmentsState.asReadonly();
  readonly consultations = this.consultationsState.asReadonly();
  readonly todaysAppointments = computed(() =>
    this.appointmentsState().filter((a) => a.date === today),
  );
  readonly queue = computed(() =>
    this.todaysAppointments()
      .filter((a) => ['Checked In', 'Waiting', 'In Consultation'].includes(a.status))
      .sort((a, b) => (a.token ?? 999) - (b.token ?? 999)),
  );
  addPatient(input: Omit<Patient, 'id' | 'mrn' | 'createdAt'>) {
    const next = this.patientsState().length + 126;
    this.patientsState.update((v) => [
      {
        ...input,
        id: crypto.randomUUID(),
        mrn: `CP-2026-${String(next).padStart(5, '0')}`,
        createdAt: today,
      },
      ...v,
    ]);
  }
  updatePatient(id: string, changes: Partial<Omit<Patient, 'id' | 'mrn' | 'createdAt'>>) {
    if (!this.patientsState().some((patient) => patient.id === id)) throw new Error('Patient not found.');
    this.patientsState.update((patients) =>
      patients.map((patient) => (patient.id === id ? { ...patient, ...changes } : patient)),
    );
  }
  deactivatePatient(id: string) {
    if (this.appointmentsState().some((appointment) => appointment.patientId === id && !['Completed', 'Cancelled', 'No Show'].includes(appointment.status))) {
      throw new Error('A patient with an active appointment cannot be deactivated.');
    }
    this.updatePatient(id, { status: 'Inactive' });
  }
  addAppointment(input: Omit<Appointment, 'id' | 'number' | 'status'>) {
    if (
      this.appointmentsState().some(
        (a) =>
          a.doctor === input.doctor &&
          a.date === input.date &&
          a.time === input.time &&
          a.status !== 'Cancelled',
      )
    )
      throw new Error('This doctor already has an appointment in the selected slot.');
    this.appointmentsState.update((v) => [
      {
        ...input,
        id: crypto.randomUUID(),
        number: `APT-${Date.now().toString().slice(-8)}`,
        status: 'Scheduled',
      },
      ...v,
    ]);
  }
  updateStatus(id: string, status: AppointmentStatus) {
    this.appointmentsState.update((v) =>
      v.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              token:
                a.token ??
                (status === 'Checked In'
                  ? Math.max(0, ...v.map((x) => x.token ?? 0)) + 1
                  : a.token),
            }
          : a,
      ),
    );
  }
  saveConsultation(value: Consultation) {
    this.consultationsState.update((v) => [
      ...v.filter((x) => x.appointmentId !== value.appointmentId),
      value,
    ]);
    this.updateStatus(value.appointmentId, 'Completed');
  }
}
