import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './password-page.html',
})
export class PasswordPage {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private api = inject(AuthApiService);
  readonly reset = this.route.snapshot.data['mode'] === 'reset';
  readonly loading = signal(false);
  readonly message = signal('');
  readonly form = this.fb.nonNullable.group({
    email: ['', this.reset ? [] : [Validators.required, Validators.email]],
    password: ['', this.reset ? [Validators.required, Validators.minLength(12)] : []],
    confirmation: ['', this.reset ? Validators.required : []],
  });
  async submit() {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      if (this.reset) {
        const value = this.form.getRawValue();
        if (value.password !== value.confirmation) {
          this.message.set('Passwords do not match.');
          return;
        }
        const token = this.route.snapshot.queryParamMap.get('token') ?? '';
        const response = await firstValueFrom(this.api.resetPassword(token, value.password));
        this.message.set(response.message);
      } else {
        const response = await firstValueFrom(
          this.api.forgotPassword(this.form.controls.email.value),
        );
        this.message.set(response.message);
      }
    } catch {
      this.message.set('Unable to complete the request. Check the entered information.');
    } finally {
      this.loading.set(false);
    }
  }
}
