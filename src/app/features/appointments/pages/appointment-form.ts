import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  ApiAppointment,
  AppointmentApiService,
  AppointmentOptions,
} from '../appointment-api.service';
import { AppointmentInvalidationService } from '../appointment-invalidation.service';
import { NotificationStore } from '../../../core/notifications/notification.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { ToastService } from '../../../core/services/toast.service';
import { SafeApiError } from '../../../core/interceptors/api-error.interceptor';
@Component({
  selector: 'app-appointment-form',
  imports: [ReactiveFormsModule],
  templateUrl: './appointment-form.html',
})
export class AppointmentForm {
  private api = inject(AppointmentApiService);
  private invalidation = inject(AppointmentInvalidationService);
  private notifications = inject(NotificationStore);
  private fb = inject(FormBuilder);
  readonly dates = inject(AppDateTimeService);
  private toast = inject(ToastService);
  readonly patientId = input('');
  readonly patientName = input('');
  readonly appointment = input<ApiAppointment | null>(null);
  readonly saved = output<ApiAppointment>();
  readonly error = signal('');
  readonly saving = signal(false);
  readonly options = signal<AppointmentOptions>({ patients: [], departments: [], doctors: [] });
  readonly selectedDepartment = signal('');
  readonly filteredDoctors = computed(() => {
    const departmentId = this.selectedDepartment();
    return this.options().doctors.filter(
      (doctor) => !departmentId || doctor.departmentId === departmentId,
    );
  });
  readonly isEdit = computed(() => Boolean(this.appointment()));
  readonly form = this.fb.nonNullable.group({
    patientId: ['', Validators.required],
    departmentId: ['', Validators.required],
    doctorId: ['', Validators.required],
    date: [this.dates.today(), Validators.required],
    time: ['09:00', Validators.required],
    type: ['Consultation'],
    consultationType: ['In person'],
    reason: ['', Validators.required],
    fee: [650, [Validators.required, Validators.min(0)]],
  });
  private readonly patientContext = effect(() => {
    const id = this.patientId();
    if (id) this.form.controls.patientId.setValue(id);
  });
  private readonly editContext = effect(() => {
    const item = this.appointment();
    if (!item) return;
    const [date, time] = this.dates.formDateTime(new Date(item.appointmentAt)).split('T');
    this.form.patchValue({
      patientId: item.patientId,
      departmentId: item.departmentId,
      doctorId: item.doctorId,
      date,
      time,
      type: item.type,
      consultationType: item.consultationType,
      reason: item.reason,
      fee: item.fee,
    });
    this.form.markAsPristine();
  });
  constructor() {
    void this.loadOptions();
    this.form.controls.departmentId.valueChanges.subscribe((departmentId) => {
      this.selectedDepartment.set(departmentId);
      const selected = this.options().doctors.find(
        (doctor) => doctor.id === this.form.controls.doctorId.value,
      );
      if (selected && selected.departmentId !== departmentId)
        this.form.controls.doctorId.setValue('');
    });
  }
  async loadOptions() {
    try {
      this.options.set((await firstValueFrom(this.api.options())).data);
    } catch {
      this.error.set('Appointment options could not be loaded.');
    }
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const v = this.form.getRawValue();
    try {
      const payload = {
        patientId: v.patientId,
        departmentId: v.departmentId,
        doctorId: v.doctorId,
        appointmentAt: this.dates.formValueToApi(v.date, v.time),
        type: v.type,
        consultationType: v.consultationType,
        reason: v.reason,
        fee: v.fee,
      };
      const current = this.appointment();
      const response = await firstValueFrom(
        current ? this.api.update(current.id, payload) : this.api.create(payload),
      );
      this.invalidation.notify();
      void this.notifications.load();
      this.toast.success(
        current ? 'Appointment updated successfully.' : 'Appointment created successfully.',
      );
      this.form.markAsPristine();
      this.saved.emit(response.data);
    } catch (e) {
      this.error.set(
        (e as SafeApiError).message ||
          `Appointment could not be ${this.isEdit() ? 'updated' : 'created'}.`,
      );
    } finally {
      this.saving.set(false);
    }
  }
}
