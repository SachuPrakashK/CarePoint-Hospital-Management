import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { PasswordPage } from './password-page';

describe('PasswordPage', () => {
  let fixture: ComponentFixture<PasswordPage>;
  const api = { forgotPassword: vi.fn(), resetPassword: vi.fn() };

  async function create(mode: 'forgot' | 'reset', token: string | null = null) {
    await TestBed.configureTestingModule({
      imports: [PasswordPage],
      providers: [
        { provide: AuthApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode },
              queryParamMap: { get: (key: string) => (key === 'token' ? token : null) },
            },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PasswordPage);
    fixture.detectChanges();
  }

  beforeEach(() => {
    api.forgotPassword.mockReset();
    api.resetPassword.mockReset();
  });

  it('renders the approved authentication branding and forgot-password form', async () => {
    await create('forgot');
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.login-brand__logo')?.getAttribute('src')).toBe(
      'logo-full-light.svg',
    );
    expect(element.querySelector('h2')?.textContent).toContain('Forgot Password?');
    expect(element.querySelector('#reset-email')).not.toBeNull();
  });

  it('submits a trimmed email once and shows success after the API responds', async () => {
    api.forgotPassword.mockReturnValue(of({ message: 'Instructions sent.' }));
    await create('forgot');
    fixture.componentInstance.form.controls.email.setValue('  nurse@medicare.test  ');
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(api.forgotPassword).toHaveBeenCalledTimes(1);
    expect(api.forgotPassword).toHaveBeenCalledWith('nurse@medicare.test');
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Instructions sent.',
    );
  });

  it('blocks reset submission when the token is missing', async () => {
    await create('reset');
    await fixture.componentInstance.submit();
    expect(api.resetPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('reset link is incomplete');
  });

  it('requires matching passwords and submits the token without rendering it', async () => {
    api.resetPassword.mockReturnValue(of({ message: 'Password reset successfully.' }));
    await create('reset', 'secure-token-value-that-is-not-rendered');
    fixture.componentInstance.form.patchValue({
      password: 'NewSecurePassword123!',
      confirmation: 'DifferentPassword123!',
    });
    await fixture.componentInstance.submit();
    expect(api.resetPassword).not.toHaveBeenCalled();
    fixture.componentInstance.form.controls.confirmation.setValue('NewSecurePassword123!');
    await fixture.componentInstance.submit();
    expect(api.resetPassword).toHaveBeenCalledWith(
      'secure-token-value-that-is-not-rendered',
      'NewSecurePassword123!',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'secure-token-value-that-is-not-rendered',
    );
  });

  it('maps expired or reused reset tokens to safe recovery guidance', async () => {
    api.resetPassword.mockReturnValue(
      throwError(() => ({
        status: 422,
        message: 'Some information needs correction.',
        validationErrors: { token: ['The password reset link is invalid or expired.'] },
      })),
    );
    await create('reset', 'expired-token');
    fixture.componentInstance.form.patchValue({
      password: 'NewSecurePassword123!',
      confirmation: 'NewSecurePassword123!',
    });
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.errorMessage()).toContain('invalid, expired, or has already');
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('toggles both password fields without submitting', async () => {
    await create('reset', 'valid-token');
    const toggles = fixture.nativeElement.querySelectorAll('.password-toggle');
    toggles[0].click();
    toggles[1].click();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#new-password') as HTMLInputElement).type).toBe(
      'text',
    );
    expect(
      (fixture.nativeElement.querySelector('#confirm-password') as HTMLInputElement).type,
    ).toBe('text');
    expect(api.resetPassword).not.toHaveBeenCalled();
  });
});
