import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SafeApiError } from '../../core/interceptors/api-error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { UserApiService } from './user-api.service';
import { ManagedUser } from './user-api.service';
import { AdministrationApiService, RoleRecord } from '../administration/administration-api.service';

@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule],
  templateUrl: './user-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserForm {
  private readonly api = inject(UserApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly administration = inject(AdministrationApiService);
  readonly roles = signal<RoleRecord[]>([]);
  readonly passwordMinimumLength = signal(12);
  readonly mode = input.required<'create' | 'edit'>();
  readonly user = input<ManagedUser | null>(null);
  readonly saved = output<void>();
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: [''],
    username: [''],
    password: ['', [Validators.required, Validators.minLength(12)]],
    confirmPassword: ['', Validators.required],
    roleCode: ['DOCTOR', Validators.required],
    status: ['ACTIVE' as 'ACTIVE' | 'INACTIVE', Validators.required],
  });
  private readonly populate = effect(() => {
    const mode = this.mode();
    const user = this.user();
    const minimumLength = this.passwordMinimumLength();
    this.form.controls.password.setValidators(
      mode === 'create'
        ? [Validators.required, Validators.minLength(minimumLength)]
        : [Validators.minLength(minimumLength)],
    );
    this.form.controls.confirmPassword.setValidators(
      mode === 'create' ? Validators.required : null,
    );
    this.form.controls.password.updateValueAndValidity({ emitEvent: false });
    this.form.controls.confirmPassword.updateValueAndValidity({ emitEvent: false });
    if (mode === 'edit' && user) {
      this.form.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone ?? '',
        username: user.username ?? '',
        status: user.status === 'LOCKED' ? 'INACTIVE' : user.status,
        password: '',
        confirmPassword: '',
        roleCode: user.roles[0]?.role.code ?? 'DOCTOR',
      });
    }
  });
  constructor() {
    void firstValueFrom(this.administration.roles({ pageSize: 100, status: 'ACTIVE' })).then((r) =>
      this.roles.set(r.data),
    );
    void firstValueFrom(this.administration.setting<any>('security')).then((r) =>
      this.passwordMinimumLength.set(r.data.passwordMinimumLength),
    );
  }

  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const value = this.form.getRawValue();
      if (value.password !== value.confirmPassword) {
        this.form.controls.confirmPassword.setErrors({ mismatch: true });
        return;
      }
      const { confirmPassword, ...payload } = value;
      const user = this.user();
      if (this.mode() === 'edit' && user) {
        const { roleCode, ...update } = payload;
        await firstValueFrom(
          this.api.update(user.id, { ...update, password: update.password || undefined }),
        );
        if (roleCode !== user.roles[0]?.role.code)
          await firstValueFrom(this.api.role(user.id, roleCode as never));
      } else await firstValueFrom(this.api.create({ ...payload, roleCode: payload.roleCode }));
      this.form.markAsPristine();
      this.toast.success(`User ${this.mode() === 'edit' ? 'updated' : 'created'} successfully.`);
      this.saved.emit();
    } catch (cause) {
      this.error.set((cause as SafeApiError).message || 'User could not be created.');
    } finally {
      this.submitting.set(false);
    }
  }
}
