import {
  NAVIGATION_GROUPS,
  resolveNavigation,
  SIDEBAR_BOTTOM_ITEMS,
  SIDEBAR_NAVIGATION_GROUPS,
} from './navigation.config';

describe('navigation configuration', () => {
  it('keeps module routes unique and categorized', () => {
    const items = NAVIGATION_GROUPS.flatMap((group) => group.items);
    expect(new Set(items.map((item) => item.path)).size).toBe(items.length);
    expect(NAVIGATION_GROUPS.every((group) => group.items.length > 0)).toBe(true);
  });

  it.each([
    ['/dashboard', 'Overview', 'Dashboard'],
    ['/patients/patient-1', 'Patient Management', 'Patients'],
    ['/clinical/patient-1', 'Clinical Operations', 'Clinical EMR'],
    ['/laboratory/orders/order-1', 'Diagnostics & Pharmacy', 'Laboratory'],
    ['/billing/invoices/invoice-1', 'Finance & Insurance', 'Billing'],
    ['/insurance/claims/claim-1', 'Finance & Insurance', 'Insurance'],
    ['/operations?tab=suppliers', 'Inventory & Operations', 'Inventory & Ops'],
    ['/audit-logs/log-1', 'Analytics & Reports', 'Audit Logs'],
    ['/settings', 'System & Support', 'Settings'],
  ])('resolves %s to its shared category and module', (url, category, module) => {
    const active = resolveNavigation(url);
    expect(active?.group.label).toBe(category);
    expect(active?.item.label).toBe(module);
  });

  it('does not match a route that merely shares a text prefix', () => {
    expect(resolveNavigation('/billing-export')).toBeNull();
  });

  it('keeps Help & Support above Settings outside the scrollable groups', () => {
    expect(SIDEBAR_NAVIGATION_GROUPS.some((group) => group.id === 'system-support')).toBe(false);
    expect(SIDEBAR_BOTTOM_ITEMS.map((item) => item.id)).toEqual(['support', 'settings']);
  });
});
