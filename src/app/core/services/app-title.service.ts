import { effect, inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { LanguageService } from '../i18n/language.service';
import { ApplicationSettingsService } from './application-settings.service';

const ROUTE_TITLES: Record<string, string> = {
  dashboard: 'nav.dashboard',
  patients: 'nav.patients',
  appointments: 'nav.appointments',
  opd: 'nav.opd',
  clinical: 'nav.clinical',
  laboratory: 'nav.laboratory',
  radiology: 'nav.radiology',
  inpatient: 'nav.admissions',
  nursing: 'nav.nursing',
  procedures: 'nav.procedures',
  pharmacy: 'nav.pharmacy',
  billing: 'nav.billing',
  insurance: 'nav.insurance',
  operations: 'nav.inventory',
  reports: 'nav.reports',
  'audit-logs': 'nav.audit',
  documents: 'nav.documents',
  doctors: 'nav.doctors',
  employees: 'nav.employees',
  departments: 'nav.departments',
  users: 'nav.users',
  roles: 'nav.roles',
  settings: 'nav.settings',
  'help-support': 'nav.support',
  notifications: 'header.notifications',
  profile: 'header.profile',
};
const DETAIL_TITLES: Record<string, string> = {
  patients: 'Patient Details',
  appointments: 'Appointment Details',
  laboratory: 'Laboratory Details',
  radiology: 'Radiology Details',
  inpatient: 'Admission Details',
  procedures: 'Procedure Details',
  doctors: 'Doctor Details',
  employees: 'Employee Details',
};

@Injectable({ providedIn: 'root' })
export class AppTitleService {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly language = inject(LanguageService);
  private readonly settings = inject(ApplicationSettingsService);
  private currentUrl = this.router.url;

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl = event.urlAfterRedirects;
        this.update();
      });
    effect(() => {
      this.language.current();
      this.settings.value();
      this.update();
    });
  }

  update() {
    const segments = this.currentUrl.split('?')[0].split('#')[0].split('/').filter(Boolean);
    const root = segments[0] ?? '';
    const configuredName = this.settings.value().applicationName?.trim();
    const appName =
      !configuredName || /^CarePoint(?: Hospital Management)?$/i.test(configuredName)
        ? 'MediCare+'
        : configuredName;
    let pageTitle = '';
    if (root === 'auth') {
      pageTitle =
        segments[1] === 'forgot-password'
          ? 'Forgot Password'
          : segments[1] === 'reset-password'
            ? 'Reset Password'
            : 'Login';
    } else if (root === 'forbidden') pageTitle = 'Access Restricted';
    else if (root === 'unauthorized') pageTitle = 'Session Required';
    else if (segments.length > 1 && DETAIL_TITLES[root]) pageTitle = DETAIL_TITLES[root];
    else if (ROUTE_TITLES[root]) pageTitle = this.language.translate(ROUTE_TITLES[root]);
    this.title.setTitle(pageTitle ? `${pageTitle} | ${appName}` : appName);
  }
}
