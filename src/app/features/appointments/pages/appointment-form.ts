import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SafeApiError } from '../../../core/interceptors/api-error.interceptor';
import { NotificationStore } from '../../../core/notifications/notification.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { ToastService } from '../../../core/services/toast.service';
import { SearchField } from '../../../shared/components/search/search-field';
import {
  ApiAppointment,
  AppointmentApiService,
  AppointmentOptions,
  AppointmentPatientOption,
} from '../appointment-api.service';
import { AppointmentInvalidationService } from '../appointment-invalidation.service';

@Component({
  selector: 'app-appointment-form',
  imports: [ReactiveFormsModule, SearchField],
  templateUrl: './appointment-form.html',
  styleUrl: './appointment-form.scss',
})
export class AppointmentForm {
  private readonly api = inject(AppointmentApiService);
  private readonly invalidation = inject(AppointmentInvalidationService);
  private readonly notifications = inject(NotificationStore);
  private readonly fb = inject(FormBuilder);
  readonly dates = inject(AppDateTimeService);
  private readonly toast = inject(ToastService);
  readonly patientId = input('');
  readonly patientName = input('');
  readonly appointment = input<ApiAppointment | null>(null);
  readonly saved = output<ApiAppointment>();
  readonly cancelled = output<void>();
  readonly error = signal('');
  readonly saving = signal(false);
  readonly options = signal<AppointmentOptions>({ patients: [], departments: [], doctors: [] });
  readonly patientResults = signal<AppointmentPatientOption[]>([]);
  readonly patientSearch = signal('');
  readonly patientSearching = signal(false);
  readonly selectedPatient = signal<AppointmentPatientOption | null>(null);
  readonly slots = signal<{ time: string; available: boolean }[]>([]);
  readonly slotsLoading = signal(false);
  readonly selectedDepartment = signal('');
  readonly filteredDoctors = computed(() => {
    const departmentId = this.selectedDepartment();
    return this.options().doctors.filter(
      (doctor) => !departmentId || doctor.departmentId === departmentId,
    );
  });
  readonly selectedDoctor = computed(() =>
    this.options().doctors.find((doctor) => doctor.id === this.form.controls.doctorId.value),
  );
  readonly isEdit = computed(() => Boolean(this.appointment()));
  readonly form = this.fb.nonNullable.group({
    bookingMode: ['existing' as 'existing' | 'new', Validators.required],
    patientId: [''],
    firstName: ['', Validators.maxLength(100)],
    middleName: ['', Validators.maxLength(100)],
    lastName: ['', Validators.maxLength(100)],
    mobile: ['', Validators.pattern(/^\+?[0-9]{8,15}$/)],
    gender: [''],
    dob: [''],
    departmentId: ['', Validators.required],
    doctorId: ['', Validators.required],
    date: [this.dates.today(), Validators.required],
    time: ['', Validators.required],
    type: ['Consultation', Validators.required],
    consultationType: ['In person', Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(1000)]],
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
      bookingMode: 'existing',
      patientId: item.patientId,
      departmentId: item.departmentId,
      doctorId: item.doctorId,
      date,
      time: time.slice(0, 5),
      type: item.type,
      consultationType: item.consultationType,
      reason: item.reason,
      fee: item.fee,
    });
    this.selectedPatient.set({
      id: item.patientId,
      firstName: item.patientName,
      lastName: '',
      mrn: item.patientMrn,
      gender: item.patientGender ?? '',
      phone: item.patientPhone ?? '',
      dob: '',
    });
    this.form.markAsPristine();
    void this.loadSlots();
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
    this.form.controls.doctorId.valueChanges.subscribe((doctorId) => {
      const doctor = this.options().doctors.find((item) => item.id === doctorId);
      if (doctor?.consultationFee != null && !this.isEdit())
        this.form.controls.fee.setValue(Number(doctor.consultationFee));
      void this.loadSlots();
    });
    this.form.controls.date.valueChanges.subscribe(() => void this.loadSlots());
  }

  async loadOptions() {
    try {
      const data = (await firstValueFrom(this.api.options())).data;
      this.options.set(data);
      if (this.patientId()) {
        const patient = data.patients.find((item) => item.id === this.patientId());
        if (patient) this.selectPatient(patient);
      }
    } catch {
      this.error.set('Appointment options could not be loaded.');
    }
  }

  setMode(mode: 'existing' | 'new') {
    if (this.isEdit()) return;
    this.form.controls.bookingMode.setValue(mode);
    this.form.controls.patientId.setValue('');
    this.selectedPatient.set(null);
    this.patientResults.set([]);
    this.error.set('');
  }

  async searchPatients(value = this.patientSearch()) {
    this.patientSearch.set(value);
    const search = value.trim();
    if (search.length < 2) {
      this.patientResults.set([]);
      return;
    }
    this.patientSearching.set(true);
    try {
      this.patientResults.set((await firstValueFrom(this.api.searchPatients(search))).data);
    } catch {
      this.error.set('Patient search could not be completed.');
    } finally {
      this.patientSearching.set(false);
    }
  }

  selectPatient(patient: AppointmentPatientOption) {
    this.selectedPatient.set(patient);
    this.form.controls.patientId.setValue(patient.id);
    this.patientResults.set([]);
    this.patientSearch.set(`${patient.firstName} ${patient.lastName} · ${patient.mrn}`);
  }

  async loadSlots() {
    const doctorId = this.form.controls.doctorId.value;
    const date = this.form.controls.date.value;
    if (!doctorId || !date) {
      this.slots.set([]);
      this.form.controls.time.disable({ emitEvent: false });
      return;
    }
    this.slotsLoading.set(true);
    this.form.controls.time.disable({ emitEvent: false });
    try {
      const response = await firstValueFrom(
        this.api.availability(doctorId, date, this.appointment()?.id),
      );
      this.slots.set(response.data.slots);
      const current = this.form.controls.time.value;
      if (!response.data.slots.some((slot) => slot.available && slot.time === current))
        this.form.controls.time.setValue('');
    } catch {
      this.slots.set([]);
      this.error.set('Available appointment slots could not be loaded.');
    } finally {
      this.slotsLoading.set(false);
      this.form.controls.time.enable({ emitEvent: false });
    }
  }

  private patientValid() {
    if (this.form.controls.bookingMode.value === 'existing')
      return Boolean(this.form.controls.patientId.value);
    const value = this.form.getRawValue();
    return Boolean(
      value.firstName.trim().length >= 2 &&
      value.lastName.trim() &&
      value.mobile.match(/^\+?[0-9]{8,15}$/) &&
      value.gender &&
      value.dob,
    );
  }

  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.patientValid() || this.saving()) {
      this.error.set('Complete the required patient and appointment information.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    try {
      const patient =
        value.bookingMode === 'existing'
          ? { patientId: value.patientId }
          : {
              newPatient: {
                firstName: value.firstName,
                middleName: value.middleName || undefined,
                lastName: value.lastName,
                phone: value.mobile,
                gender: value.gender,
                dob: value.dob,
              },
            };
      const payload = {
        ...patient,
        departmentId: value.departmentId,
        doctorId: value.doctorId,
        appointmentAt: this.dates.formValueToApi(value.date, value.time),
        type: value.type,
        consultationType: value.consultationType,
        reason: value.reason,
        fee: value.fee,
      };
      const current = this.appointment();
      const response = await firstValueFrom(
        current
          ? this.api.update(current.id, { ...payload, patientId: current.patientId })
          : this.api.create(payload),
      );
      this.invalidation.notify();
      void this.notifications.load();
      this.toast.success(
        current ? 'Appointment updated successfully.' : 'Appointment created successfully.',
      );
      this.form.markAsPristine();
      this.saved.emit(response.data);
    } catch (error) {
      this.error.set(
        (error as SafeApiError).message ||
          `Appointment could not be ${this.isEdit() ? 'updated' : 'created'}.`,
      );
      await this.loadSlots();
    } finally {
      this.saving.set(false);
    }
  }

  cancel() {
    if (!this.saving()) this.cancelled.emit();
  }
}
