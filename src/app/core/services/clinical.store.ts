import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Appointment, AppointmentStatus, Consultation } from '../../shared/models/clinical.models';
import {
  AppointmentApiService,
  ApiAppointment,
} from '../../features/appointments/appointment-api.service';
import { PatientStore } from '../../features/patients/patient.store';
import { AppDateTimeService } from './app-date-time.service';

const statusToApi: Record<AppointmentStatus, string> = {
  Scheduled: 'SCHEDULED',
  Confirmed: 'CONFIRMED',
  'Checked In': 'CHECKED_IN',
  Waiting: 'WAITING',
  'In Consultation': 'IN_CONSULTATION',
  Completed: 'COMPLETED',
  Cancelled: 'CANCELLED',
  'No Show': 'NO_SHOW',
};
const apiToStatus = (value: string) =>
  value
    .toLowerCase()
    .replace(/(^|_)(\w)/g, (_, s, c) => `${s ? ' ' : ''}${c.toUpperCase()}`) as AppointmentStatus;

@Injectable({ providedIn: 'root' })
export class ClinicalStore {
  private readonly http = inject(HttpClient);
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly patientStore = inject(PatientStore);
  private readonly dates = inject(AppDateTimeService);
  private readonly appointmentsState = signal<Appointment[]>([]);
  private readonly consultationsState = signal<Consultation[]>([]);
  readonly patients = this.patientStore.patients;
  readonly appointments = this.appointmentsState.asReadonly();
  readonly consultations = this.consultationsState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly todaysAppointments = computed(() =>
    this.appointments().filter((item) => item.date === this.dates.today()),
  );
  readonly queue = computed(() =>
    this.todaysAppointments()
      .filter((item) => ['Checked In', 'Waiting', 'In Consultation'].includes(item.status))
      .sort((a, b) => (a.token ?? 999) - (b.token ?? 999)),
  );

  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.patientStore.load();
      const [appointments, consultations] = await Promise.all([
        firstValueFrom(this.appointmentApi.list()),
        firstValueFrom(this.http.get<{ data: any[] }>('/api/v1/consultations')),
      ]);
      this.appointmentsState.set(appointments.data.map((item) => this.mapAppointment(item)));
      this.consultationsState.set(consultations.data.map((item) => this.mapConsultation(item)));
    } catch {
      this.error.set('Clinical data could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  async updateStatus(id: string, status: AppointmentStatus) {
    if (!id) return;
    const response = await firstValueFrom(this.appointmentApi.status(id, statusToApi[status]));
    this.appointmentsState.update((items) =>
      items.map((item) => (item.id === id ? this.mapAppointment(response.data) : item)),
    );
  }
  async saveConsultation(value: Consultation) {
    const response = await firstValueFrom(
      this.http.post<{ data: any }>('/api/v1/consultations', {
        ...value,
        vitals: value.vitals.map(
          ({ id: _id, recordedAt: _at, recordedBy: _by, ...vital }) => vital,
        ),
        followUpDate: value.followUpDate
          ? this.dates.formValueToApi(value.followUpDate, '12:00')
          : undefined,
      }),
    );
    this.consultationsState.update((items) => [
      this.mapConsultation(response.data),
      ...items.filter((item) => item.appointmentId !== value.appointmentId),
    ]);
    await this.loadAppointments();
    return response.data;
  }
  private async loadAppointments() {
    const response = await firstValueFrom(this.appointmentApi.list());
    this.appointmentsState.set(response.data.map((item) => this.mapAppointment(item)));
  }
  private mapAppointment(item: ApiAppointment): Appointment {
    return {
      id: item.id,
      number: item.number,
      patientId: item.patientId,
      patientName: item.patientName,
      department: item.department,
      doctor: item.doctor,
      date: this.isoDate(item.appointmentAt),
      time: this.isoTime(item.appointmentAt),
      type: item.type,
      consultationType: item.consultationType,
      reason: item.reason,
      fee: Number(item.fee),
      status: apiToStatus(item.status),
    };
  }
  private mapConsultation(item: any): Consultation {
    const diagnoses = item.diagnoses ?? [];
    return {
      appointmentId: item.appointmentId,
      chiefComplaint: item.chiefComplaint,
      symptoms: item.symptoms ?? '',
      examination: item.examination ?? '',
      notes: item.notes ?? '',
      treatmentPlan: item.treatmentPlan ?? '',
      primaryDiagnosis: diagnoses.find((x: any) => x.type === 'Primary')?.description ?? '',
      secondaryDiagnoses: diagnoses
        .filter((x: any) => x.type !== 'Primary')
        .map((x: any) => x.description),
      vitals: item.vitals ?? [],
      prescription: item.prescriptions?.flatMap((x: any) => x.items ?? []) ?? [],
    };
  }
  private isoDate(value: string) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value));
  }
  private isoTime(value: string) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  }
}
