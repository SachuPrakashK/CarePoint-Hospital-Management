import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  templateUrl: './not-found-page.html',
  styleUrl: './not-found-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  readonly authenticated = this.auth.authenticated;
  readonly primaryLabel = computed(() =>
    this.authenticated() ? 'Go to Dashboard' : 'Go to Login',
  );

  goPrimary() {
    void this.router.navigateByUrl(this.authenticated() ? '/dashboard' : '/auth/login');
  }

  goBack() {
    const referrer = this.document.referrer;
    const hasSafeHistory =
      history.length > 1 && (!referrer || new URL(referrer).origin === location.origin);
    if (hasSafeHistory) history.back();
    else this.goPrimary();
  }
}
