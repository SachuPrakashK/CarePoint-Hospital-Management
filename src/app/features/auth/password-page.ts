import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import type { SafeApiError } from '../../core/interceptors/api-error.interceptor';
import { AppIcon } from '../../shared/components/icon/app-icon';
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AppIcon],
  templateUrl: './password-page.html',
  styleUrls: ['./login-page.scss', './password-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordPage {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AuthApiService);
  readonly reset = this.route.snapshot.data['mode'] === 'reset';
  private readonly token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
  readonly missingToken = this.reset && !this.token;
  readonly loading = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly passwordVisible = signal(false);
  readonly confirmationVisible = signal(false);
  readonly passwordPolicyErrors = signal<string[]>([]);
  readonly form = this.fb.nonNullable.group({
    email: ['', this.reset ? [] : [Validators.required, Validators.email]],
    password: [
      '',
      this.reset ? [Validators.required, Validators.minLength(12), Validators.maxLength(128)] : [],
    ],
    confirmation: [
      '',
      this.reset ? [Validators.required, Validators.minLength(12), Validators.maxLength(128)] : [],
    ],
  });

  togglePasswordVisibility() {
    this.passwordVisible.update((visible) => !visible);
  }
  toggleConfirmationVisibility() {
    this.confirmationVisible.update((visible) => !visible);
  }

  async submit() {
    if (this.loading() || this.missingToken || this.successMessage()) return;
    this.errorMessage.set('');
    this.passwordPolicyErrors.set([]);
    if (!this.reset) {
      this.form.controls.email.setValue(this.form.controls.email.value.trim());
    }
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.reset && value.password !== value.confirmation)
      this.form.controls.confirmation.setErrors({ mismatch: true });
    if (this.form.invalid) return;
    this.loading.set(true);
    try {
      const response = this.reset
        ? await firstValueFrom(this.api.resetPassword(this.token, value.password))
        : await firstValueFrom(this.api.forgotPassword(value.email.trim()));
      this.successMessage.set(response.message);
      this.form.reset();
    } catch (error) {
      this.handleError(error as SafeApiError);
    } finally {
      this.loading.set(false);
    }
  }

  private handleError(error: SafeApiError) {
    const passwordErrors = error.validationErrors?.['password'] ?? [];
    if (passwordErrors.length) {
      this.passwordPolicyErrors.set(passwordErrors);
      this.errorMessage.set('Your password does not meet the security requirements.');
      return;
    }
    if (error.validationErrors?.['token']?.length) {
      this.errorMessage.set(
        'This password reset link is invalid, expired, or has already been used.',
      );
      return;
    }
    this.errorMessage.set(
      error.status === 0
        ? 'The service is unreachable. Check your connection and try again.'
        : 'Unable to complete the request. Please try again.',
    );
  }
}
