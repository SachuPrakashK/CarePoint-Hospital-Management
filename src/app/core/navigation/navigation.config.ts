export interface NavigationItem {
  id: string;
  label: string;
  translationKey: string;
  icon: string;
  path: string;
  permission: string;
}

export interface NavigationGroup {
  id: string;
  label: string;
  items: readonly NavigationItem[];
}

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        translationKey: 'nav.dashboard',
        icon: 'dashboard',
        path: '/dashboard',
        permission: 'dashboard.view',
      },
    ],
  },
  {
    id: 'patient-management',
    label: 'Patient Management',
    items: [
      {
        id: 'patients',
        label: 'Patients',
        translationKey: 'nav.patients',
        icon: 'patients',
        path: '/patients',
        permission: 'patients.view',
      },
      {
        id: 'appointments',
        label: 'Appointments',
        translationKey: 'nav.appointments',
        icon: 'calendar',
        path: '/appointments',
        permission: 'appointments.view',
      },
      {
        id: 'opd',
        label: 'OPD & Queue',
        translationKey: 'nav.opd',
        icon: 'queue',
        path: '/opd',
        permission: 'queue.view',
      },
    ],
  },
  {
    id: 'clinical-operations',
    label: 'Clinical Operations',
    items: [
      {
        id: 'clinical',
        label: 'Clinical EMR',
        translationKey: 'nav.clinical',
        icon: 'clinical',
        path: '/clinical',
        permission: 'emr.view',
      },
      {
        id: 'admissions',
        label: 'Admissions & Beds',
        translationKey: 'nav.admissions',
        icon: 'bed',
        path: '/inpatient',
        permission: 'admissions.view',
      },
      {
        id: 'nursing',
        label: 'Nursing',
        translationKey: 'nav.nursing',
        icon: 'nursing',
        path: '/nursing',
        permission: 'nursing.view',
      },
      {
        id: 'procedures',
        label: 'Procedures & OT',
        translationKey: 'nav.procedures',
        icon: 'procedure',
        path: '/procedures',
        permission: 'procedures.view',
      },
    ],
  },
  {
    id: 'diagnostics-pharmacy',
    label: 'Diagnostics & Pharmacy',
    items: [
      {
        id: 'laboratory',
        label: 'Laboratory',
        translationKey: 'nav.laboratory',
        icon: 'lab',
        path: '/laboratory',
        permission: 'laboratory.view',
      },
      {
        id: 'radiology',
        label: 'Radiology',
        translationKey: 'nav.radiology',
        icon: 'radiology',
        path: '/radiology',
        permission: 'radiology.view',
      },
      {
        id: 'pharmacy',
        label: 'Pharmacy',
        translationKey: 'nav.pharmacy',
        icon: 'pharmacy',
        path: '/pharmacy',
        permission: 'pharmacy.view',
      },
    ],
  },
  {
    id: 'finance-insurance',
    label: 'Finance & Insurance',
    items: [
      {
        id: 'billing',
        label: 'Billing',
        translationKey: 'nav.billing',
        icon: 'billing',
        path: '/billing',
        permission: 'billing.view',
      },
      {
        id: 'insurance',
        label: 'Insurance',
        translationKey: 'nav.insurance',
        icon: 'insurance',
        path: '/insurance',
        permission: 'insurance.view',
      },
    ],
  },
  {
    id: 'inventory-operations',
    label: 'Inventory & Operations',
    items: [
      {
        id: 'operations',
        label: 'Inventory & Ops',
        translationKey: 'nav.inventory',
        icon: 'inventory',
        path: '/operations',
        permission: 'inventory.view',
      },
      {
        id: 'documents',
        label: 'Documents',
        translationKey: 'nav.documents',
        icon: 'documents',
        path: '/documents',
        permission: 'documents.view',
      },
    ],
  },
  {
    id: 'workforce-administration',
    label: 'Workforce & Administration',
    items: [
      {
        id: 'doctors',
        label: 'Doctors',
        translationKey: 'nav.doctors',
        icon: 'doctor',
        path: '/doctors',
        permission: 'doctors.view',
      },
      {
        id: 'employees',
        label: 'Employees',
        translationKey: 'nav.employees',
        icon: 'users',
        path: '/employees',
        permission: 'employees.view',
      },
      {
        id: 'departments',
        label: 'Departments',
        translationKey: 'nav.departments',
        icon: 'department',
        path: '/departments',
        permission: 'departments.view',
      },
      {
        id: 'users',
        label: 'Users',
        translationKey: 'nav.users',
        icon: 'users',
        path: '/users',
        permission: 'users.view',
      },
      {
        id: 'roles',
        label: 'Roles',
        translationKey: 'nav.roles',
        icon: 'shield',
        path: '/roles',
        permission: 'roles.view',
      },
    ],
  },
  {
    id: 'analytics-reports',
    label: 'Analytics & Reports',
    items: [
      {
        id: 'reports',
        label: 'Reports',
        translationKey: 'nav.reports',
        icon: 'reports',
        path: '/reports',
        permission: 'reports.view',
      },
      {
        id: 'audit',
        label: 'Audit Logs',
        translationKey: 'nav.audit',
        icon: 'audit',
        path: '/audit-logs',
        permission: 'audit.view',
      },
    ],
  },
  {
    id: 'system-support',
    label: 'System & Support',
    items: [
      {
        id: 'support',
        label: 'Help & Support',
        translationKey: 'nav.support',
        icon: 'help',
        path: '/help-support',
        permission: 'support.view',
      },
      {
        id: 'settings',
        label: 'Settings',
        translationKey: 'nav.settings',
        icon: 'settings',
        path: '/settings',
        permission: 'settings.view',
      },
    ],
  },
];

export const SIDEBAR_NAVIGATION_GROUPS = NAVIGATION_GROUPS.filter(
  (group) => group.id !== 'system-support',
);

export const SIDEBAR_BOTTOM_ITEMS =
  NAVIGATION_GROUPS.find((group) => group.id === 'system-support')?.items ?? [];

export function resolveNavigation(url: string) {
  const path = url.split(/[?#]/, 1)[0] || '/dashboard';
  for (const group of NAVIGATION_GROUPS) {
    const item = [...group.items]
      .sort((a, b) => b.path.length - a.path.length)
      .find((candidate) => path === candidate.path || path.startsWith(`${candidate.path}/`));
    if (item) return { group, item };
  }
  return null;
}
