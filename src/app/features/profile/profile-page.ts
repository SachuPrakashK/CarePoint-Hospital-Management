import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthApiService } from '../../core/auth/auth-api.service';
import type { SafeApiError } from '../../core/interceptors/api-error.interceptor';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ToastService } from '../../core/services/toast.service';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { AppModal } from '../../shared/components/modal/app-modal';
import { ProfileApiService } from './profile-api.service';
@Component({
  imports: [ReactiveFormsModule, RouterLink, AppIcon, AppModal],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage implements OnDestroy {
  readonly auth = inject(AuthStore);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private confirmation = inject(ConfirmationService);
  private api = inject(ProfileApiService);
  private authApi = inject(AuthApiService);
  private router = inject(Router);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly imageError = signal('');
  readonly changePasswordOpen = signal(false);
  readonly changingPassword = signal(false);
  readonly passwordError = signal('');
  readonly passwordVisible = signal({ current: false, next: false, confirmation: false });
  readonly passwordPolicy = signal({
    minimumLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
  });
  private objectUrl?: string;
  readonly form = this.fb.nonNullable.group({
    firstName: [this.auth.user()?.name.split(' ')[0] ?? '', Validators.required],
    lastName: [this.auth.user()?.name.split(' ').slice(1).join(' ') ?? '', Validators.required],
    email: [this.auth.user()?.email ?? '', [Validators.required, Validators.email]],
    phone: [
      this.auth.user()?.phone ?? '',
      [Validators.required, Validators.pattern(/^[+\d][\d\s-]{7,}$/)],
    ],
  });
  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: [
      '',
      [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    ],
    newPassword: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
    confirmPassword: [
      '',
      [Validators.required, Validators.minLength(12), Validators.maxLength(128)],
    ],
  });
  private readonly newPasswordValue = toSignal(
    this.passwordForm.controls.newPassword.valueChanges,
    {
      initialValue: '',
    },
  );
  readonly passwordStrength = computed(() => {
    const password = this.newPasswordValue();
    const policy = this.passwordPolicy();
    const requirements = [
      password.length >= policy.minimumLength,
      !policy.requireLowercase || /[a-z]/.test(password),
      !policy.requireUppercase || /[A-Z]/.test(password),
      !policy.requireNumber || /\d/.test(password),
      !policy.requireSpecial || /[^A-Za-z0-9]/.test(password),
    ];
    const ratio = requirements.filter(Boolean).length / requirements.length;
    const score = password ? Math.max(1, Math.ceil(ratio * 4)) : 0;
    const levels = [
      { label: 'Weak', className: 'weak' },
      { label: 'Weak', className: 'weak' },
      { label: 'Fair', className: 'fair' },
      { label: 'Good', className: 'good' },
      { label: 'Strong', className: 'strong' },
    ];
    return { score, ...levels[score] };
  });

  openChangePassword() {
    this.passwordError.set('');
    this.passwordForm.reset();
    this.passwordVisible.set({ current: false, next: false, confirmation: false });
    this.changePasswordOpen.set(true);
    firstValueFrom(this.authApi.passwordPolicy())
      .then(({ data }) => {
        this.passwordPolicy.set(data);
        this.passwordForm.controls.newPassword.setValidators([
          Validators.required,
          Validators.minLength(data.minimumLength),
          Validators.maxLength(128),
        ]);
        this.passwordForm.controls.confirmPassword.setValidators([
          Validators.required,
          Validators.minLength(data.minimumLength),
          Validators.maxLength(128),
        ]);
        this.passwordForm.controls.newPassword.updateValueAndValidity();
        this.passwordForm.controls.confirmPassword.updateValueAndValidity();
      })
      .catch(() => undefined);
  }

  closeChangePassword() {
    if (!this.changingPassword()) this.changePasswordOpen.set(false);
  }

  togglePassword(field: 'current' | 'next' | 'confirmation') {
    this.passwordVisible.update((value) => ({ ...value, [field]: !value[field] }));
  }

  async changePassword() {
    if (this.changingPassword()) return;
    this.passwordError.set('');
    this.passwordForm.markAllAsTouched();
    const value = this.passwordForm.getRawValue();
    if (value.newPassword !== value.confirmPassword)
      this.passwordForm.controls.confirmPassword.setErrors({ mismatch: true });
    if (value.currentPassword === value.newPassword)
      this.passwordForm.controls.newPassword.setErrors({ sameAsCurrent: true });
    if (this.passwordForm.invalid) return;

    this.changingPassword.set(true);
    try {
      await firstValueFrom(this.authApi.changePassword(value.currentPassword, value.newPassword));
      this.passwordForm.reset();
      this.changePasswordOpen.set(false);
      this.toast.success('Password changed successfully. Please sign in again.');
      this.auth.clear();
      await this.router.navigateByUrl('/auth/login');
    } catch (error) {
      const safe = error as SafeApiError;
      const currentErrors = safe.validationErrors?.['current_password'];
      const newErrors =
        safe.validationErrors?.['new_password'] ?? safe.validationErrors?.['password'];
      if (currentErrors?.length)
        this.passwordForm.controls.currentPassword.setErrors({ server: true });
      if (newErrors?.length) this.passwordForm.controls.newPassword.setErrors({ server: true });
      this.passwordError.set(
        [...(currentErrors ?? []), ...(newErrors ?? [])].join(' ') ||
          (safe.status === 0
            ? 'The service is unreachable. Check your connection and try again.'
            : 'Unable to change your password. Please try again.'),
      );
    } finally {
      this.changingPassword.set(false);
    }
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.auth.updateProfile({
      name: `${v.firstName} ${v.lastName}`.trim(),
      email: v.email,
      phone: v.phone,
    });
    this.saving.set(false);
    this.toast.success('Profile updated successfully.');
  }
  async selectImage(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.imageError.set('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.imageError.set('Select a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.imageError.set('Profile image must be 5 MB or smaller.');
      return;
    }
    this.uploading.set(true);
    try {
      await firstValueFrom(this.api.uploadImage(file));
      const blob = await firstValueFrom(this.api.image());
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = URL.createObjectURL(blob);
      this.auth.updateAvatar(this.objectUrl);
      this.toast.success('Profile image updated successfully.');
    } catch {
      this.imageError.set('Unable to upload the profile image.');
    } finally {
      this.uploading.set(false);
    }
  }
  async deleteImage() {
    if (!this.auth.user()?.avatarUrl) return;
    const confirmed = await this.confirmation.confirm({
      title: 'Delete profile image?',
      message: 'Your current image will be removed and replaced by the default avatar.',
      confirmLabel: 'Delete image',
      danger: true,
    });
    if (confirmed) {
      await firstValueFrom(this.api.deleteImage());
      this.auth.updateAvatar();
      this.toast.success('Profile image deleted successfully.');
    }
  }
  ngOnDestroy() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}
