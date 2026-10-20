import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { LanguageService } from '../i18n/language.service';
import { AppTitleService } from './app-title.service';
import { ApplicationSettingsService } from './application-settings.service';

describe('AppTitleService', () => {
  const events = new Subject<NavigationEnd>();
  const language = {
    current: signal('en'),
    translate: (key: string) =>
      ({ 'nav.employees': 'Employees', 'nav.pharmacy': 'Pharmacy' })[key] ?? key,
  };
  const settings = { value: signal({ applicationName: 'MediCare+' }) };
  let title: Title;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AppTitleService,
        { provide: Router, useValue: { url: '/dashboard', events } },
        { provide: LanguageService, useValue: language },
        { provide: ApplicationSettingsService, useValue: settings },
      ],
    });
    title = TestBed.inject(Title);
    TestBed.inject(AppTitleService);
  });

  it('updates from navigation including safe details titles', () => {
    events.next(new NavigationEnd(1, '/employees', '/employees'));
    expect(title.getTitle()).toBe('Employees | MediCare+');
    events.next(new NavigationEnd(2, '/employees/employee-id', '/employees/employee-id'));
    expect(title.getTitle()).toBe('Employee Details | MediCare+');
  });

  it('uses configured branding and never includes record identifiers', () => {
    settings.value.set({ applicationName: 'City Hospital' });
    events.next(new NavigationEnd(3, '/patients/private-mrn', '/patients/private-mrn'));
    expect(title.getTitle()).toBe('Patient Details | City Hospital');
    expect(title.getTitle()).not.toContain('private-mrn');
  });

  it('migrates the legacy CarePoint title to the official MediCare+ brand', () => {
    settings.value.set({ applicationName: 'CarePoint Hospital Management' });
    events.next(new NavigationEnd(4, '/pharmacy', '/pharmacy'));
    expect(title.getTitle()).toBe('Pharmacy | MediCare+');
  });

  it('uses the MediCare+ login title', () => {
    settings.value.set({ applicationName: 'MediCare+' });
    events.next(new NavigationEnd(5, '/auth/login', '/auth/login'));
    expect(title.getTitle()).toBe('Login | MediCare+');
  });

  it('uses the dedicated not-found title without exposing the unknown URL', () => {
    const router = TestBed.inject(Router) as Router & { routerState: unknown };
    Object.defineProperty(router, 'routerState', {
      configurable: true,
      value: {
        snapshot: {
          root: { data: {}, firstChild: { data: { pageTitle: '404 - Page Not Found' } } },
        },
      },
    });
    events.next(new NavigationEnd(6, '/private-unknown-value', '/private-unknown-value'));
    expect(title.getTitle()).toBe('404 - Page Not Found | MediCare+');
    expect(title.getTitle()).not.toContain('private-unknown-value');
  });
});
