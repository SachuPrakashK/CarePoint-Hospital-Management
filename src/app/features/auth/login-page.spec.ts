import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import { LoginPage } from './login-page';
import { LanguageService } from '../../core/i18n/language.service';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  const auth = {
    loading: signal(false),
    error: signal<string | null>(null),
    login: vi.fn(async () => true),
  };
  const router = { navigateByUrl: vi.fn() };
  const language = {
    loading: signal(false),
    current: signal('en'),
    enabled: signal([
      {
        id: 'en',
        code: 'en',
        name: 'English',
        nativeName: 'English',
        enabled: true,
        translationCoverage: 100,
        isDefault: true,
      },
      {
        id: 'pt-br',
        code: 'pt-BR',
        name: 'Portuguese (Brazil)',
        nativeName: 'Português',
        enabled: true,
        translationCoverage: 100,
        isDefault: false,
      },
      {
        id: 'zh-hans',
        code: 'zh-Hans',
        name: 'Chinese (Simplified)',
        nativeName: '简体中文',
        enabled: true,
        translationCoverage: 100,
        isDefault: false,
      },
    ]),
    selectPublic: vi.fn(),
  };

  beforeEach(async () => {
    auth.login.mockClear();
    router.navigateByUrl.mockClear();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        { provide: AuthStore, useValue: auth },
        { provide: LanguageService, useValue: language },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
  });

  it('renders the MediCare+ brand and accessible login fields', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.login-brand__logo')).not.toBeNull();
    expect(element.querySelector('.login-brand__logo')?.getAttribute('src')).toBe(
      'logo-full-light.svg',
    );
    expect(element.querySelector('.login-mobile-brand img')?.getAttribute('alt')).toContain(
      'Hospital Management System',
    );
    expect(element.querySelector('.login-brand')?.textContent).toContain('Smarter Healthcare');
    expect(element.querySelector('#login-email')?.getAttribute('placeholder')).toBe(
      'Enter your email address',
    );
    expect(element.querySelector('#login-password')?.getAttribute('placeholder')).toBe(
      'Enter your password',
    );
  });

  it('toggles password visibility without submitting the form', () => {
    const input = fixture.nativeElement.querySelector('#login-password') as HTMLInputElement;
    const toggle = fixture.nativeElement.querySelector('.password-toggle') as HTMLButtonElement;
    expect(input.type).toBe('password');
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('shows enabled language names with canonical display codes and no visible label', () => {
    const element = fixture.nativeElement as HTMLElement;
    const selector = element.querySelector('.auth-language')!;
    const trigger = selector.querySelector('.auth-language__trigger') as HTMLButtonElement;
    expect(trigger.textContent?.replace(/\s+/g, ' ').trim()).toBe('English (EN)');
    trigger.click();
    fixture.detectChanges();
    const options = [...selector.querySelectorAll('[role="option"]')].map((option) =>
      option.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(options).toEqual(['English (EN)', 'Português (PT-BR)', '简体中文 (ZH-Hans)']);
    expect(selector.textContent).not.toContain('Language');
    expect(trigger.getAttribute('aria-label')).toBe('Language');
    expect(selector.querySelector('.auth-language__chevron')).not.toBeNull();
  });

  it('validates and submits valid credentials once', async () => {
    fixture.componentInstance.form.setValue({
      email: 'admin@medicare.test',
      password: 'Password123!',
      remember: true,
    });
    await fixture.componentInstance.submit();
    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
});
