import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { Breadcrumbs } from '../../shared/components/breadcrumbs/breadcrumbs';
interface NavItem {
  label: string;
  icon: string;
  path: string;
  permission: string;
}
@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AppIcon, Breadcrumbs],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  readonly auth = inject(AuthStore);
  readonly collapsed = signal(localStorage.getItem('hms.sidebar.collapsed') === 'true');
  readonly mobileOpen = signal(false);
  readonly userMenu = signal(false);
  readonly nav: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', path: '/dashboard', permission: 'dashboard.view' },
    { label: 'Patients', icon: 'patients', path: '/patients', permission: 'patients.view' },
    {
      label: 'Appointments',
      icon: 'calendar',
      path: '/appointments',
      permission: 'appointments.view',
    },
    { label: 'OPD & Queue', icon: 'queue', path: '/opd', permission: 'queue.view' },
    { label: 'Clinical EMR', icon: 'clinical', path: '/clinical', permission: 'emr.view' },
    { label: 'Laboratory', icon: 'lab', path: '/laboratory', permission: 'laboratory.view' },
    { label: 'Radiology', icon: 'radiology', path: '/radiology', permission: 'radiology.view' },
    { label: 'Admissions & Beds', icon: 'bed', path: '/inpatient', permission: 'admissions.view' },
    { label: 'Nursing', icon: 'nursing', path: '/nursing', permission: 'nursing.view' },
    {
      label: 'Procedures & OT',
      icon: 'procedure',
      path: '/procedures',
      permission: 'procedures.view',
    },
    { label: 'Pharmacy', icon: 'pharmacy', path: '/pharmacy', permission: 'pharmacy.view' },
    { label: 'Billing', icon: 'billing', path: '/billing', permission: 'billing.view' },
    { label: 'Insurance', icon: 'insurance', path: '/insurance', permission: 'insurance.view' },
    {
      label: 'Inventory & Ops',
      icon: 'inventory',
      path: '/operations',
      permission: 'inventory.view',
    },
    { label: 'Reports', icon: 'reports', path: '/reports', permission: 'reports.view' },
    { label: 'Audit logs', icon: 'audit', path: '/audit-logs', permission: 'audit.view' },
    { label: 'Documents', icon: 'documents', path: '/documents', permission: 'documents.view' },
    { label: 'Doctors', icon: 'doctor', path: '/doctors', permission: 'doctors.view' },
    { label: 'Employees', icon: 'users', path: '/employees', permission: 'employees.view' },
    {
      label: 'Departments',
      icon: 'department',
      path: '/departments',
      permission: 'departments.view',
    },
    { label: 'Users', icon: 'users', path: '/users', permission: 'users.view' },
    { label: 'Super Admins', icon: 'shield', path: '/super-admins', permission: 'users.view' },
    { label: 'Roles', icon: 'shield', path: '/roles', permission: 'roles.view' },
  ];
  toggleSidebar() {
    if (window.innerWidth <= 850) {
      this.mobileOpen.update((value) => !value);
      return;
    }
    this.collapsed.update((v) => !v);
    localStorage.setItem('hms.sidebar.collapsed', String(this.collapsed()));
  }
  closeMobile() {
    this.mobileOpen.set(false);
  }
  @HostListener('document:click') closeUserMenu() { this.userMenu.set(false); }
  @HostListener('document:keydown.escape') closeOverlays() { this.userMenu.set(false); this.mobileOpen.set(false); }
}
