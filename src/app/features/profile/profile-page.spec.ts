import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ToastService } from '../../core/services/toast.service';
import { ProfileApiService } from './profile-api.service';
import { ProfilePage } from './profile-page';

describe('ProfilePage change password', () => {
  let fixture: ComponentFixture<ProfilePage>;
  const auth = {
    user: signal({
      id: 'user-1',
      name: 'Test User',
      email: 'test@medicare.test',
      phone: '+91 9876543210',
      role: { id: 'role-1', code: 'DOCTOR', name: 'Doctor' },
    }),
    clear: vi.fn(),
    updateProfile: vi.fn(),
    updateAvatar: vi.fn(),
  };
  const authApi = {
    changePassword: vi.fn(),
    passwordPolicy: vi.fn(() =>
      of({
        data: {
          minimumLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumber: true,
          requireSpecial: true,
        },
      }),
    ),
  };
  const toast = { success: vi.fn() };
  const router = { navigateByUrl: vi.fn(async () => true) };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        { provide: AuthStore, useValue: auth },
        { provide: AuthApiService, useValue: authApi },
        {
          provide: ProfileApiService,
          useValue: { uploadImage: vi.fn(), image: vi.fn(), deleteImage: vi.fn() },
        },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: {} },
        { provide: ConfirmationService, useValue: { confirm: vi.fn(async () => true) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
  });

  it('opens the shared change-password modal from the profile action', () => {
    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (item: HTMLButtonElement) => item.textContent?.includes('Change password'),
    );
    button.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.changePasswordOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-modal')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.crud-modal__header-icon')).not.toBeNull();
  });

  it('updates strength from the configured password policy', () => {
    fixture.componentInstance.passwordForm.controls.newPassword.setValue('short');
    expect(fixture.componentInstance.passwordStrength().label).toBe('Weak');
    fixture.componentInstance.passwordForm.controls.newPassword.setValue('StrongPassword123!');
    expect(fixture.componentInstance.passwordStrength().label).toBe('Strong');
  });

  it('toggles each password field independently', () => {
    fixture.componentInstance.togglePassword('current');
    expect(fixture.componentInstance.passwordVisible()).toEqual({
      current: true,
      next: false,
      confirmation: false,
    });
    fixture.componentInstance.togglePassword('next');
    expect(fixture.componentInstance.passwordVisible()).toEqual({
      current: true,
      next: true,
      confirmation: false,
    });
  });

  it('rejects mismatched passwords without calling the API', async () => {
    fixture.componentInstance.passwordForm.setValue({
      currentPassword: 'CurrentPassword123!',
      newPassword: 'NewPassword123!',
      confirmPassword: 'DifferentPassword123!',
    });
    await fixture.componentInstance.changePassword();
    expect(authApi.changePassword).not.toHaveBeenCalled();
    expect(
      fixture.componentInstance.passwordForm.controls.confirmPassword.hasError('mismatch'),
    ).toBe(true);
  });

  it('submits once, clears the revoked session, and returns to login after success', async () => {
    authApi.changePassword.mockReturnValue(of({ message: 'Password changed successfully.' }));
    fixture.componentInstance.passwordForm.setValue({
      currentPassword: 'CurrentPassword123!',
      newPassword: 'NewPassword456!',
      confirmPassword: 'NewPassword456!',
    });
    await fixture.componentInstance.changePassword();
    expect(authApi.changePassword).toHaveBeenCalledTimes(1);
    expect(authApi.changePassword).toHaveBeenCalledWith('CurrentPassword123!', 'NewPassword456!');
    expect(auth.clear).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/login');
  });

  it('keeps the form usable and maps an incorrect current password', async () => {
    authApi.changePassword.mockReturnValue(
      throwError(() => ({
        status: 422,
        message: 'Validation failed.',
        validationErrors: { current_password: ['Current password is incorrect.'] },
      })),
    );
    fixture.componentInstance.passwordForm.setValue({
      currentPassword: 'WrongPassword123!',
      newPassword: 'NewPassword456!',
      confirmPassword: 'NewPassword456!',
    });
    await fixture.componentInstance.changePassword();
    expect(fixture.componentInstance.passwordError()).toContain('Current password is incorrect.');
    expect(fixture.componentInstance.changingPassword()).toBe(false);
    expect(auth.clear).not.toHaveBeenCalled();
  });
});
