import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { Breadcrumbs } from '../../shared/components/breadcrumbs/breadcrumbs';
import { AppNotification, NotificationStore } from '../../core/notifications/notification.store';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { LanguageService } from '../../core/i18n/language.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
interface NavItem {
  label: string;
  key: string;
  icon: string;
  path: string;
  permission: string;
}
@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AppIcon, Breadcrumbs, TranslatePipe],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  readonly auth = inject(AuthStore);
  readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);
  private readonly dates = inject(AppDateTimeService);
  readonly language = inject(LanguageService);
  readonly collapsed = signal(localStorage.getItem('hms.sidebar.collapsed') === 'true');
  readonly mobileOpen = signal(false);
  readonly userMenu = signal(false);
  readonly notificationMenu = signal(false);
  readonly languageMenu = signal(false);
  readonly sidebarTooltip = signal<{ label: string; top: number } | null>(null);
  readonly nav: NavItem[] = [
    { label: 'Dashboard', key:'nav.dashboard', icon: 'dashboard', path: '/dashboard', permission: 'dashboard.view' },
    { label: 'Patients', key:'nav.patients', icon: 'patients', path: '/patients', permission: 'patients.view' },
    {
      label: 'Appointments',
      key:'nav.appointments',
      icon: 'calendar',
      path: '/appointments',
      permission: 'appointments.view',
    },
    { label: 'OPD & Queue', key:'nav.opd', icon: 'queue', path: '/opd', permission: 'queue.view' },
    { label: 'Clinical EMR', key:'nav.clinical', icon: 'clinical', path: '/clinical', permission: 'emr.view' },
    { label: 'Laboratory', key:'nav.laboratory', icon: 'lab', path: '/laboratory', permission: 'laboratory.view' },
    { label: 'Radiology', key:'nav.radiology', icon: 'radiology', path: '/radiology', permission: 'radiology.view' },
    { label: 'Admissions & Beds', key:'nav.admissions', icon: 'bed', path: '/inpatient', permission: 'admissions.view' },
    { label: 'Nursing', key:'nav.nursing', icon: 'nursing', path: '/nursing', permission: 'nursing.view' },
    {
      label: 'Procedures & OT',
      key:'nav.procedures',
      icon: 'procedure',
      path: '/procedures',
      permission: 'procedures.view',
    },
    { label: 'Pharmacy', key:'nav.pharmacy', icon: 'pharmacy', path: '/pharmacy', permission: 'pharmacy.view' },
    { label: 'Billing', key:'nav.billing', icon: 'billing', path: '/billing', permission: 'billing.view' },
    { label: 'Insurance', key:'nav.insurance', icon: 'insurance', path: '/insurance', permission: 'insurance.view' },
    {
      label: 'Inventory & Ops',
      key:'nav.inventory',
      icon: 'inventory',
      path: '/operations',
      permission: 'inventory.view',
    },
    { label: 'Reports', key:'nav.reports', icon: 'reports', path: '/reports', permission: 'reports.view' },
    { label: 'Audit logs', key:'nav.audit', icon: 'audit', path: '/audit-logs', permission: 'audit.view' },
    { label: 'Documents', key:'nav.documents', icon: 'documents', path: '/documents', permission: 'documents.view' },
    { label: 'Doctors', key:'nav.doctors', icon: 'doctor', path: '/doctors', permission: 'doctors.view' },
    { label: 'Employees', key:'nav.employees', icon: 'users', path: '/employees', permission: 'employees.view' },
    {
      label: 'Departments',
      key:'nav.departments',
      icon: 'department',
      path: '/departments',
      permission: 'departments.view',
    },
    { label: 'Users', key:'nav.users', icon: 'users', path: '/users', permission: 'users.view' },
    { label: 'Roles', key:'nav.roles', icon: 'shield', path: '/roles', permission: 'roles.view' },
  ];
  constructor() {
    void this.notifications.load();
  }
  toggleSidebar() {
    if (window.innerWidth <= 850) {
      this.mobileOpen.update((value) => !value);
      return;
    }
    this.collapsed.update((v) => !v);
    this.sidebarTooltip.set(null);
    localStorage.setItem('hms.sidebar.collapsed', String(this.collapsed()));
  }
  closeMobile() {
    this.mobileOpen.set(false);
  }
  toggleNotifications(event: Event) {
    event.stopPropagation();
    this.userMenu.set(false);
    this.notificationMenu.update((value) => !value);
    if (this.notificationMenu()) void this.notifications.load();
  }
  async openNotification(item: AppNotification) {
    await this.notifications.markRead(item);
    this.notificationMenu.set(false);
    const path =
      item.relatedEntityType === 'User'
        ? '/users'
        : item.relatedEntityType === 'Appointment'
          ? '/appointments'
          : '/notifications';
    await this.router.navigateByUrl(path);
  }
  timeAgo(value: string) {
    return this.dates.relativeTime(value);
  }
  t(key:string){return this.language.translate(key);}
  showSidebarTooltip(event: Event, label: string) {
    if (!this.collapsed() || window.innerWidth <= 850) return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.sidebarTooltip.set({ label, top: bounds.top + bounds.height / 2 });
  }
  hideSidebarTooltip() {
    this.sidebarTooltip.set(null);
  }
  @HostListener('document:click') closeUserMenu() {
    this.userMenu.set(false);
    this.notificationMenu.set(false);
    this.languageMenu.set(false);
  }
  @HostListener('document:keydown.escape') closeOverlays() {
    this.userMenu.set(false);
    this.notificationMenu.set(false);
    this.languageMenu.set(false);
    this.mobileOpen.set(false);
    this.sidebarTooltip.set(null);
  }
}
