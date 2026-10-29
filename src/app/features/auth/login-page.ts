import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { AuthLanguageSelector } from './auth-language-selector';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AppIcon, AuthLanguageSelector],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  readonly auth = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly passwordVisible = signal(false);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    remember: [false],
  });

  togglePasswordVisibility() {
    this.passwordVisible.update((visible) => !visible);
  }

  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    if (await this.auth.login(this.form.getRawValue()))
      void this.router.navigateByUrl(
        this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard',
      );
  }
}
